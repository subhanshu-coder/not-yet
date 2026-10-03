# Unprompted

A personal speaking-practice studio. Spin a prompt, record a take, add an optional note, and keep every session in a searchable library.

## What it includes

- Random prompts across six categories, with Off the cuff and Deep research practice modes
- Microphone recording in the browser, a live timer, and a recording waveform
- Persistent server-side audio files and session metadata, plus playback, search, filtering, notes, and deletion
- A responsive interface with keyboard shortcuts (`Space` to spin, `R` to record, `Esc` to close)
- No external database or application dependencies

## Run locally

Requires Node.js 20 or newer.

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000). Browsers require a secure context to allow microphone access. `localhost` is treated as secure; when hosted remotely, use HTTPS.

Sessions are saved under `data/`: metadata in `data/sessions.json` and audio in `data/recordings/`. Back up this folder to keep your recordings. Set `DATA_DIR` to choose another persistent location and `PORT` to choose a port.

## Run with Docker

```sh
Copy-Item .env.example .env
# Edit .env and replace both example values with long, private secrets.
docker compose up --build -d
```

`docker compose` keeps recordings in a named volume when the container is replaced. For production, set `APP_PASSWORD` to a unique password with at least 12 characters and set `SESSION_SECRET` to a random secret with at least 32 characters. Production startup stops if either secret is missing or too short. The `.env` file is ignored by Git.

Generate a session secret with Node.js:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

## Deploying

This app needs a persistent Node.js process and persistent disk for recordings. Deploy the repository to a VPS or a container host that offers persistent volumes. Set `APP_PASSWORD` and `SESSION_SECRET` in the host's secret settings, mount a persistent volume at `/data`, and expose port `3000` behind HTTPS. The production login protects the session list, recording playback, and deletion API with an HTTP-only signed cookie. Serverless/static hosting with ephemeral filesystems does not persist uploaded recordings.

## Storage and privacy

The server writes recordings to local disk and does not send them to a third-party API. This is a private, single-owner app. Browser microphone access is requested only when recording starts.

Audio is stored in the browser's supported recording format (typically WebM/Opus). The app accepts recordings up to 80 MB and takes up to 60 minutes. Supported recording types on the backend are WebM, Ogg, MP4, WAV, and MP3.
