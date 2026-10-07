# Unprompted

A personal speaking-practice studio. Spin a prompt, record a take, add an optional note, and keep every session in a searchable library.

## Features

- Random prompts across six categories, with Off the cuff and Deep research modes
- Browser microphone recording, live timer, and waveform
- Searchable session library with playback, notes, filters, and deletion
- Single-owner password login for the hosted app
- Responsive interface and keyboard shortcuts (`Space` to spin, `R` to record, `Esc` to close)
- English speaking practice with focused follow-up prompts, a 10-minute preparation timer, and 2-, 3-, 5-minute or custom speaking turns

## Run locally

Requires Node.js 20 or newer.

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000). Browsers allow microphone access on `localhost`; hosted sites need HTTPS.

Without Supabase variables, recordings and metadata are saved under `data/`. Set `DATA_DIR` to choose another location and `PORT` to choose a port.

## Run with Docker

```powershell
Copy-Item .env.example .env
# Edit .env and replace the example secrets.
docker compose up --build -d
```

Docker Compose keeps local recordings in a named volume. Use an `APP_PASSWORD` of at least 12 characters and a random `SESSION_SECRET` of at least 32 characters for production.

## Free hosted deployment: Render + Supabase

The repository includes a Render Blueprint (`render.yaml`) for a free Docker web service. Render Free does not provide a persistent disk, so this app uses Supabase for both session metadata and private audio storage. Apply the SQL migration in `supabase/migrations/202610040001_sessions_and_private_audio.sql` in the Supabase SQL Editor before deploying.

Configure these Render environment variables:

- `APP_PASSWORD`: a private password with at least 12 characters
- `SESSION_SECRET`: a random value with at least 32 characters (the Blueprint generates one)
- `SUPABASE_URL`: your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: the project's service role key; keep it only in Render secrets and never in browser code or Git
- `SUPABASE_BUCKET`: `session-audio` (set by the Blueprint)

Use the service role key only on the server. The bucket is private, and the app's password login protects the API. The SQL migration grants table access only to `service_role`.

### Free-tier limits

- Render Free sleeps after about 15 minutes without traffic, so the first visit after idle may take around a minute to wake. Its local filesystem is temporary.
- Supabase Free includes 1 GB of file storage and allows audio files up to 50 MB. The app rejects larger takes so they are not lost on Render; it keeps a downloaded local copy instead.
- Supabase Free projects can pause after a period of low activity and need to be restored from the Supabase dashboard. Free projects do not include downloadable database backups.
- Treat this as a personal practice app. Export or otherwise keep your own copies of important recordings; free-tier quotas and availability can change.

## Storage and privacy

In local mode, the server writes audio and session metadata to disk. With Supabase configured, audio goes to a private Storage bucket and session metadata goes to the `public.sessions` table. The browser only talks to this app; the Supabase service role key stays on the server. Supported formats include WebM, Ogg, MP4, WAV, and MP3. Recording length is capped at 60 minutes.

