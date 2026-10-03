const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const AUDIO_DIR = path.join(DATA_DIR, 'recordings');
const INDEX_FILE = path.join(DATA_DIR, 'sessions.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_AUDIO_BYTES = 80 * 1024 * 1024;
const MAX_REQUEST_BYTES = Math.ceil(MAX_AUDIO_BYTES * 4 / 3) + 256_000;
const MIME_EXT = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/mpeg': 'mp3' };
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const AUTH_REQUIRED = Boolean(APP_PASSWORD || process.env.NODE_ENV === 'production');
const SESSION_SECONDS = 7 * 24 * 60 * 60;
if (process.env.NODE_ENV === 'production' && (APP_PASSWORD.length < 12 || SESSION_SECRET.length < 32)) {
  throw new Error('Production requires APP_PASSWORD (at least 12 characters) and SESSION_SECRET (at least 32 characters).');
}

function cookieValue(req, name) {
  const prefix = `${name}=`;
  return (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(prefix))?.slice(prefix.length) || '';
}
function sessionToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET || 'local-development-session').update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
function hasValidSession(req) {
  if (!AUTH_REQUIRED) return true;
  if (!SESSION_SECRET) return false;
  const token = cookieValue(req, 'unprompted_session');
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest();
  let actual;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return false; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).exp > Math.floor(Date.now() / 1000); }
  catch { return false; }
}
function secureCookie(req) { return process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https' || Boolean(req.socket.encrypted); }

async function readSessions() {
  try { return JSON.parse(await fs.readFile(INDEX_FILE, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}
async function writeSessions(sessions) {
  const tmp = `${INDEX_FILE}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(sessions, null, 2));
  await fs.rename(tmp, INDEX_FILE);
}
function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(body));
}
function readBody(req, limit = MAX_REQUEST_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) { reject(Object.assign(new Error('Request too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function safeText(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }

const failedLogins = new Map();
async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    if (req.method === 'GET' && url.pathname === '/api/auth') return json(res, 200, { authRequired: AUTH_REQUIRED, authenticated: hasValidSession(req) });
    if (req.method === 'POST' && url.pathname === '/api/auth') {
      if (!AUTH_REQUIRED) return json(res, 200, { authenticated: true });
      const address = req.socket.remoteAddress || 'unknown';
      const attempts = failedLogins.get(address) || { count: 0, start: Date.now() };
      if (Date.now() - attempts.start > 15 * 60 * 1000) { attempts.count = 0; attempts.start = Date.now(); }
      if (attempts.count >= 10) return json(res, 429, { error: 'Too many attempts. Wait 15 minutes and try again.' });
      let input;
      try { input = JSON.parse((await readBody(req, 10_000)).toString('utf8')); }
      catch { return json(res, 400, { error: 'Invalid sign-in request.' }); }
      const candidate = Buffer.from(typeof input.password === 'string' ? input.password : '');
      const expected = Buffer.from(APP_PASSWORD);
      const valid = candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
      if (!valid) { attempts.count++; failedLogins.set(address, attempts); return json(res, 401, { error: 'That password did not match. Try again.' }); }
      failedLogins.delete(address);
      res.setHeader('set-cookie', `unprompted_session=${sessionToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}${secureCookie(req) ? '; Secure' : ''}`);
      return json(res, 200, { authenticated: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      res.setHeader('set-cookie', `unprompted_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie(req) ? '; Secure' : ''}`);
      return json(res, 200, { authenticated: false });
    }
    if (AUTH_REQUIRED && !hasValidSession(req)) return json(res, 401, { error: 'Sign in to access your practice library.' });
    if (req.method === 'GET' && url.pathname === '/api/sessions') {
      const sessions = await readSessions();
      return json(res, 200, sessions.sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
    }
    if (req.method === 'POST' && url.pathname === '/api/sessions') {
      let input;
      try { input = JSON.parse((await readBody(req, MAX_REQUEST_BYTES)).toString('utf8')); }
      catch (e) { return json(res, e.status || 400, { error: e.status === 413 ? 'Recording is too large. Keep it under 80 MB.' : 'Invalid session data.' }); }
      const topic = safeText(input.topic, 240);
      const audio = typeof input.audio === 'string' ? input.audio : '';
      const match = audio.match(/^data:(audio\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+=*)$/i);
      if (!topic || !match) return json(res, 400, { error: 'A topic and supported audio recording are required.' });
      const mimeType = match[1].toLowerCase();
      const ext = MIME_EXT[mimeType];
      if (!ext) return json(res, 415, { error: 'This recording format is not supported by the server.' });
      const bytes = Buffer.from(match[2], 'base64');
      if (!bytes.length || bytes.length > MAX_AUDIO_BYTES) return json(res, 413, { error: 'Recording is empty or larger than 80 MB.' });
      await fs.mkdir(AUDIO_DIR, { recursive: true });
      const id = crypto.randomUUID();
      await fs.writeFile(path.join(AUDIO_DIR, `${id}.${ext}`), bytes, { flag: 'wx' });
      const session = {
        id, topic, category: safeText(input.category, 40) || 'General',
        duration: Math.max(0, Math.min(3600, Number(input.duration) || 0)),
        notes: safeText(input.notes, 4000), createdAt: new Date().toISOString(), mimeType,
        audioUrl: `/api/sessions/${id}/audio`
      };
      const sessions = await readSessions();
      sessions.push(session);
      await writeSessions(sessions);
      return json(res, 201, session);
    }
    const match = url.pathname.match(/^\/api\/sessions\/([0-9a-f-]+)(?:\/(audio))?$/i);
    if (match) {
      const [, id, audioRoute] = match;
      const sessions = await readSessions();
      const index = sessions.findIndex(s => s.id === id);
      if (index < 0) return json(res, 404, { error: 'Session not found.' });
      if (req.method === 'GET' && audioRoute) {
        const files = await fs.readdir(AUDIO_DIR).catch(() => []);
        const file = files.find(name => name.startsWith(`${id}.`));
        if (!file) return json(res, 404, { error: 'Recording not found.' });
        res.writeHead(200, { 'content-type': sessions[index].mimeType, 'content-length': (await fs.stat(path.join(AUDIO_DIR, file))).size, 'content-disposition': 'inline', 'x-content-type-options': 'nosniff', 'cache-control': 'private, max-age=3600' });
        return fs.createReadStream(path.join(AUDIO_DIR, file)).pipe(res);
      }
      if (req.method === 'DELETE' && !audioRoute) {
        const files = await fs.readdir(AUDIO_DIR).catch(() => []);
        const file = files.find(name => name.startsWith(`${id}.`));
        if (file) await fs.unlink(path.join(AUDIO_DIR, file));
        sessions.splice(index, 1); await writeSessions(sessions);
        res.writeHead(204); return res.end();
      }
    }
    return json(res, 404, { error: 'API route not found.' });
  }

  const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = path.resolve(PUBLIC_DIR, `.${pathname}`);
  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) { res.writeHead(403); return res.end('Forbidden'); }
  try {
    const data = await fs.readFile(filePath);
    const type = filePath.endsWith('.html') ? 'text/html; charset=utf-8' : filePath.endsWith('.css') ? 'text/css; charset=utf-8' : filePath.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'x-content-type-options': 'nosniff', 'cache-control': 'no-cache' }); res.end(data);
  } catch { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Not found'); }
}

fs.mkdir(DATA_DIR, { recursive: true }).then(() => {
  http.createServer((req, res) => handle(req, res).catch(error => {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: 'Something went wrong while saving your session.' });
    else res.destroy();
  })).listen(PORT, '0.0.0.0', () => console.log(`Unprompted is ready on http://localhost:${PORT}`));
});
