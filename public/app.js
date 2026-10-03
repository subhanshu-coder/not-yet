const topics = {
  'General': [
    ['What’s something you changed your mind about?', 'Sometimes the best stories start with “I used to think…”'],
    ['What does a really good day feel like to you?', 'Walk through the little details.'],
    ['What is a skill you wish everyone learned?', 'Think about the world if we all had it.'],
    ['What is something you appreciate more as you get older?', 'A person, a ritual, a tiny thing.'],
    ['If your life had a chapter title right now, what would it be?', 'And why does it fit this season?'],
    ['What is a belief you hold that you rarely get to talk about?', 'There’s no need to make it sound polished.'],
    ['What is the best advice you have ever ignored?', 'Tell the whole story.'],
    ['What ordinary thing makes life feel meaningful?', 'Small answers count.']
  ],
  'Everyday life': [
    ['What small ritual makes your day feel like yours?', 'Tell us how it began.'],
    ['What would your ideal slow Sunday look like?', 'Start from when you wake up.'],
    ['What place in your neighborhood deserves more love?', 'Describe it to someone who has never been.'],
    ['What is something you do the long way on purpose?', 'There is probably a good story there.'],
    ['What is the best meal you have had this year?', 'Take us to the table.'],
    ['What is something you recently fixed, made, or figured out?', 'It can be wonderfully small.']
  ],
  'Big ideas': [
    ['What should we teach every kid about money?', 'Make the case for your one essential lesson.'],
    ['Is convenience always a good thing?', 'Think of a time when easy came at a cost.'],
    ['What makes a life feel well lived?', 'No need to borrow someone else’s answer.'],
    ['What deserves a second chance in our culture?', 'Make a case for bringing it back.'],
    ['If you could redesign one everyday system, what would you change?', 'Start with the friction people accept.'],
    ['Can you be ambitious and content at the same time?', 'Talk through what that looks like for you.']
  ],
  'Culture': [
    ['What film, book, or song stayed with you longer than expected?', 'Talk about the moment that stuck.'],
    ['What trend from the past should make a comeback?', 'Pitch it like the world needs convincing.'],
    ['Who is a storyteller you always make time for?', 'What do they understand about people?'],
    ['What does your taste in music say about your life?', 'Pick a song that explains this chapter.'],
    ['What cultural ritual brings people closer together?', 'It can be from anywhere in the world.'],
    ['What is a wildly popular thing you just do not get?', 'Give it a fair, honest review.']
  ],
  'Work & growth': [
    ['What kind of work makes you forget to check the time?', 'Describe what makes it click.'],
    ['What have you learned from a project that did not go to plan?', 'Focus on what you know now.'],
    ['What would you try if being a beginner felt exciting?', 'Imagine you get to start this week.'],
    ['What makes someone a great teammate?', 'Think beyond the job title.'],
    ['What is a piece of feedback you still remember?', 'What did you do with it?'],
    ['How do you know when it is time to move on?', 'There may be more than one signal.']
  ],
  'Silly & strange': [
    ['Which animal would make the most interesting roommate?', 'Set the house rules.'],
    ['What would be the least useful superpower?', 'Give us the inconvenient details.'],
    ['If your pet, or an animal nearby, had a podcast, what is it about?', 'And who is the ideal guest?'],
    ['Which object in your home would win a talent show?', 'Tell us its origin story.'],
    ['What harmless conspiracy theory could you almost believe?', 'Build your case with dramatic evidence.'],
    ['If clouds had names, what would you call today’s?', 'Then explain the naming system.']
  ]
};

const $ = id => document.getElementById(id);
const state = { topic: null, mode: 'off', sessions: [], stream: null, recorder: null, chunks: [], startedAt: 0, elapsed: 0, timerInterval: null, pendingAudio: null, pendingMime: null, spinCount: 0, spinning: false };
const supportedMime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => window.MediaRecorder && MediaRecorder.isTypeSupported(type)) || '';

function escapeText(value = '') { return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char])); }
function formatTime(seconds) { const min = Math.floor(seconds / 60).toString().padStart(2, '0'); const sec = Math.floor(seconds % 60).toString().padStart(2, '0'); return `${min}:${sec}`; }
function formatDate(iso) { const date = new Date(iso); return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toast.timeout); toast.timeout = setTimeout(() => el.classList.remove('visible'), 3400); }

async function loadSessions() {
  try { const response = await fetch('/api/sessions'); if (!response.ok) throw new Error(); state.sessions = await response.json(); renderSessions(); }
  catch { toast('Could not reach your practice library. Is the server still running?'); }
}
function renderSessions() {
  const count = state.sessions.length;
  $('navCount').textContent = count;
  $('libraryTotal').textContent = count.toString().padStart(2, '0');
  const recent = state.sessions.slice(0, 3);
  $('recentList').innerHTML = recent.length ? recent.map(session => sessionRow(session, false)).join('') : `<div class="empty-row"><div class="empty-icon">✳</div><div><strong>Your first reflection is waiting.</strong><span>Spin a topic and record your thoughts to start your library.</span></div></div>`;
  renderLibrary();
}
function sessionRow(session, full) {
  const length = session.duration ? formatTime(session.duration) : '—';
  return `<article class="session-row ${full ? 'session-full' : ''}" data-session="${escapeText(session.id)}"><div class="session-play">${full ? '♫' : '▶'}</div><div class="session-info"><div class="session-tags"><span>${escapeText(session.category)}</span><i>·</i><span>${formatDate(session.createdAt)}</span></div><h3>${escapeText(session.topic)}</h3>${session.notes ? `<p class="session-notes">${escapeText(session.notes)}</p>` : ''}</div><div class="session-meta"><span class="session-duration">◷ &nbsp;${length}</span><button class="delete-session" data-delete="${escapeText(session.id)}" title="Delete recording" aria-label="Delete recording">×</button></div><div class="session-player"><audio controls preload="none" src="${escapeText(session.audioUrl)}"></audio></div></article>`;
}
function renderLibrary() {
  const query = $('searchInput').value.trim().toLowerCase();
  const category = $('filterCategory').value;
  const found = state.sessions.filter(s => (category === 'all' || s.category === category) && (!query || s.topic.toLowerCase().includes(query) || (s.notes || '').toLowerCase().includes(query)));
  $('libraryList').innerHTML = found.length ? found.map(s => sessionRow(s, true)).join('') : `<div class="library-empty"><div class="library-empty-icon">${state.sessions.length ? '⌕' : '✳'}</div><h3>${state.sessions.length ? 'No reflections found.' : 'Your story starts with a spin.'}</h3><p>${state.sessions.length ? 'Try another search or category.' : 'Your saved voice recordings will live here.'}</p>${state.sessions.length ? '' : '<button class="save-btn" data-goto="home">Go to practice <span>↗</span></button>'}</div>`;
}

function setPage(page) {
  const library = page === 'library';
  $('homePage').classList.toggle('hidden', library); $('libraryPage').classList.toggle('hidden', !library);
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.page === page));
  $('pageCrumb').textContent = library ? 'My recordings' : 'Practice';
  if (library) renderLibrary();
  window.location.hash = library ? 'library' : 'home';
}
document.querySelectorAll('[data-page]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); setPage(link.dataset.page); }));
document.querySelectorAll('[data-goto]').forEach(link => link.addEventListener('click', () => setPage(link.dataset.goto)));
document.querySelectorAll('.mode-btn').forEach(button => button.addEventListener('click', () => {
  state.mode = button.dataset.mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('selected', b === button));
  $('topicHint').textContent = state.mode === 'deep' ? 'Take a moment to gather your thoughts first.' : 'No perfect answer. Just yours.';
  $('recordHint').textContent = state.mode === 'deep' ? 'Take a moment, then record your take' : 'Up to 60 minutes per take';
}));

function spin() {
  if (state.spinning || state.recorder?.state === 'recording') return;
  const category = $('categorySelect').value;
  const pool = topics[category] || topics.General;
  let pick = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1 && state.topic?.text === pick[0]) pick = pool[(pool.indexOf(pick) + 1) % pool.length];
  state.spinning = true; $('topicStage').classList.add('is-spinning'); $('spinBtn').disabled = true;
  setTimeout(() => {
    state.topic = { text: pick[0], hint: pick[1], category };
    $('topicCategory').textContent = category.toUpperCase(); $('topicText').textContent = pick[0]; $('topicHint').textContent = state.mode === 'deep' ? 'Take a moment to gather your thoughts first.' : pick[1];
    state.spinCount++; $('stageIndex').innerHTML = `${String(state.spinCount).padStart(2, '0')} <span>/</span> ∞`;
    $('topicStage').classList.remove('is-spinning'); $('spinBtn').disabled = false;
    if ($('recordStatus').textContent === 'Your mic is ready') $('recordSubtext').textContent = 'Your topic is ready. Tap to begin.';
    state.spinning = false;
  }, 560);
}
$('spinBtn').addEventListener('click', spin);
$('categorySelect').addEventListener('change', () => { if (state.topic) $('topicCategory').textContent = $('categorySelect').value.toUpperCase(); });

async function startRecording() {
  if (!state.topic) { spin(); toast('Spin for a topic before you start your take.'); return; }
  if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) { toast('Voice recording needs a modern browser and a secure connection.'); return; }
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    state.chunks = [];
    state.recorder = new MediaRecorder(state.stream, supportedMime ? { mimeType: supportedMime } : undefined);
    state.recorder.ondataavailable = event => { if (event.data.size) state.chunks.push(event.data); };
    state.recorder.onstop = onRecordingStopped;
    state.recorder.start(1000); state.startedAt = Date.now(); state.elapsed = 0;
    state.timerInterval = setInterval(() => { state.elapsed = Math.floor((Date.now() - state.startedAt) / 1000); $('timer').textContent = formatTime(state.elapsed); if (state.elapsed >= 3600) stopRecording(); }, 250);
    document.body.classList.add('recording'); $('recordStatus').textContent = 'You’re on the record'; $('recordSubtext').textContent = 'One thought at a time. Keep going.';
    $('recordBtn').setAttribute('aria-label', 'Stop recording'); $('stopBtn').disabled = false; $('recordHint').textContent = 'Recording in progress'; document.querySelector('.live-pill').innerHTML = '<i></i> RECORDING';
  } catch (error) {
    toast(error.name === 'NotAllowedError' ? 'Microphone access is blocked. Allow mic access in your browser settings.' : 'Could not access your microphone. Please try again.');
  }
}
function stopRecording() {
  if (state.recorder?.state !== 'recording') return;
  state.recorder.stop(); clearInterval(state.timerInterval); state.stream?.getTracks().forEach(track => track.stop());
  state.stream = null; $('stopBtn').disabled = true;
}
function onRecordingStopped() {
  document.body.classList.remove('recording'); $('recordStatus').textContent = 'A thought, captured.'; $('recordSubtext').textContent = 'Take a breath. You did the work.';
  $('recordBtn').setAttribute('aria-label', 'Start another recording'); $('recordHint').textContent = 'Your take is ready to save'; document.querySelector('.live-pill').innerHTML = '<i></i> TAKE READY';
  const type = state.recorder.mimeType || state.chunks[0]?.type || supportedMime.split(';')[0] || 'audio/webm';
  state.pendingMime = type.split(';')[0];
  const blob = new Blob(state.chunks, { type });
  if (!blob.size) { toast('No audio was captured. Check your microphone and try again.'); resetRecorder(); return; }
  const reader = new FileReader(); reader.onload = () => { state.pendingAudio = reader.result; openSaveModal(); }; reader.readAsDataURL(blob);
}
function resetRecorder() {
  $('timer').textContent = '00:00'; $('recordStatus').textContent = 'Your mic is ready'; $('recordSubtext').textContent = 'Pick a topic, then tap to begin'; $('recordHint').textContent = 'Up to 60 minutes per take'; document.querySelector('.live-pill').innerHTML = '<i></i> READY';
  state.recorder = null; state.pendingAudio = null; state.pendingMime = null;
}
$('recordBtn').addEventListener('click', () => state.recorder?.state === 'recording' ? stopRecording() : state.pendingAudio ? openSaveModal() : startRecording());
$('stopBtn').addEventListener('click', stopRecording);

function openSaveModal() { $('modalTopic').textContent = state.topic?.text || 'Voice reflection'; $('sessionNotes').value = ''; $('saveError').textContent = ''; $('saveModal').classList.remove('hidden'); $('sessionNotes').focus(); }
function closeSaveModal() { $('saveModal').classList.add('hidden'); }
$('modalClose').addEventListener('click', closeSaveModal);
$('saveModal').addEventListener('click', event => { if (event.target.classList.contains('modal-backdrop')) closeSaveModal(); });
$('saveBtn').addEventListener('click', async () => {
  if (!state.pendingAudio || !state.topic) return;
  const button = $('saveBtn'); button.disabled = true; button.innerHTML = 'Saving your reflection <span>…</span>'; $('saveError').textContent = '';
  try {
    const response = await fetch('/api/sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topic: state.topic.text, category: state.topic.category, duration: state.elapsed, notes: $('sessionNotes').value, audio: state.pendingAudio }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not save your recording.');
    state.sessions.unshift(result); renderSessions(); closeSaveModal(); resetRecorder(); toast('Reflection saved to your private library.');
  } catch (error) { $('saveError').textContent = error.message; }
  finally { button.disabled = false; button.innerHTML = 'Save reflection <span>↗</span>'; }
});
$('discardBtn').addEventListener('click', () => { closeSaveModal(); resetRecorder(); toast('Take discarded. Ready for another.'); });
$('searchInput').addEventListener('input', renderLibrary); $('filterCategory').addEventListener('change', renderLibrary);
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-delete]'); if (!button) return;
  const session = state.sessions.find(s => s.id === button.dataset.delete); if (!session || !window.confirm(`Delete this recording about “${session.topic}”? This cannot be undone.`)) return;
  button.disabled = true;
  try { const response = await fetch(`/api/sessions/${encodeURIComponent(session.id)}`, { method: 'DELETE' }); if (!response.ok && response.status !== 204) throw new Error(); state.sessions = state.sessions.filter(s => s.id !== session.id); renderSessions(); toast('Recording deleted.'); }
  catch { button.disabled = false; toast('Could not delete this recording. Please try again.'); }
});

$('helpBtn').addEventListener('click', () => $('helpModal').classList.remove('hidden'));
$('helpClose').addEventListener('click', () => $('helpModal').classList.add('hidden'));
$('helpModal').addEventListener('click', event => { if (event.target.classList.contains('modal-backdrop')) $('helpModal').classList.add('hidden'); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { $('saveModal').classList.add('hidden'); $('helpModal').classList.add('hidden'); }
  if (event.code === 'Space' && !['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement.tagName) && $('saveModal').classList.contains('hidden')) { event.preventDefault(); spin(); }
  if (event.key.toLowerCase() === 'r' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && $('saveModal').classList.contains('hidden')) { event.preventDefault(); state.recorder?.state === 'recording' ? stopRecording() : startRecording(); }
});

const today = new Date(); $('todayDate').textContent = today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
if (window.location.hash === '#library') setPage('library');
if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { $('recordSubtext').textContent = 'Voice recording is not available in this browser'; $('recordBtn').disabled = true; }
loadSessions();
