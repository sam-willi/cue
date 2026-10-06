# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through [GitHub security advisories](https://github.com/sam-willi/cue/security/advisories/new). Don't open a public issue. Include steps to reproduce and the impact you believe it has.

## Handling secrets and speech data

- **Server key.** `DEEPGRAM_API_KEY` is optional. Locally it lives only in `.env.local` (git-ignored); on a deployment it is a server environment variable. The public demo sets none. When set, it is used server-side to mint 30-second tokens and must never be sent to the browser or committed.
- **`/api/deepgram-token` is unauthenticated.** It only mints tokens when a server key is set (otherwise it answers 503), but then anyone who can reach the site can spend that key. Add rate limiting (and ideally authentication) before setting a server key on a public deployment.
- **Own keys in the browser.** A visitor's own Deepgram key is stored in `sessionStorage`, or `localStorage` if they choose "Remember on this device", and is sent only to Deepgram. Any cross-site scripting bug in the app could read it, so treat XSS as high impact here.
- If a key is ever exposed (committed, pasted in a chat or issue, or logged), revoke it in the Deepgram console and create a new one.
- Transcripts, session downloads, and audio (including training recordings in `training/`, which are only saved under `npm run dev`) are sensitive personal data and must not be committed or attached to issues.
