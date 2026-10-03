# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through [GitHub security advisories](https://github.com/sam-willi/cue/security/advisories/new). Don't open a public issue. Include steps to reproduce and the impact you believe it has.

## Handling secrets and speech data

- The Deepgram API key lives only in `.env.local` (git-ignored) and is used server-side to mint 30-second tokens. It must never be sent to the browser or committed.
- If a key is ever exposed (committed, pasted in a chat or issue, or logged), revoke it in the Deepgram console and create a new one.
- Transcripts, session downloads, and audio are sensitive personal data and must not be committed or attached to issues.
