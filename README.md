# Unprompted

A personal speaking-practice studio. Spin a prompt, record a take, add an optional note, and keep every session in a searchable library.

## What it includes

- Random prompts across six categories, with Off the cuff and Deep research practice modes
- Microphone recording in the browser, a live timer, and a recording waveform
- Persistent server-side audio files and session metadata, plus playback, search, filtering, notes, and deletion
- A responsive interface with keyboard shortcuts (`Space` to spin, `R` to record, `Esc` to close)
- No account, external database, API key, or application dependencies

## Run locally

Requires Node.js 20 or newer.

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000). Browsers require a secure context to allow microphone access. `localhost` is treated as secure; when hosted remotely, use HTTPS.

Sessions are saved under `data/`: metadata in `data/sessions.json` and audio in `data/recordings/`. Back up this folder to keep your recordings. Set `DATA_DIR` to choose another persistent location and `PORT` to choose a port.

## Run with Docker

```sh
docker build -t unprompted .
docker run --name unprompted -p 3000:3000 -v unprompted-data:/data unprompted
```

The named volume keeps recordings when the container is replaced. A Docker host with a persistent disk is required; ephemeral containers lose their data when removed.

## Deploying

This app needs a persistent Node.js process and persistent disk for recordings. Deploy the repository to a VPS or a container host that offers persistent volumes. Map the volume to `/data` (or configure `DATA_DIR`) and expose port `3000` behind HTTPS. Serverless/static hosting with ephemeral filesystems does not persist uploaded recordings.

## Storage and privacy

The server writes recordings to local disk and does not send them to a third-party API. The library is intended for a private, single-user server: it has no login or access control. Keep it on your own machine or behind a private network, or add authentication before exposing it to the public internet. Browser microphone access is requested only when recording starts.

Audio is stored in the browser's supported recording format (typically WebM/Opus). The app accepts recordings up to 80 MB and takes up to 60 minutes. Supported recording types on the backend are WebM, Ogg, MP4, WAV, and MP3.
