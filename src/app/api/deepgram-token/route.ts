// Mints a short-lived Deepgram token so the browser can stream audio
// without ever seeing DEEPGRAM_API_KEY.

export async function POST() {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    return Response.json({ error: "DEEPGRAM_API_KEY is not set. Add it to .env.local." }, { status: 500 });
  }
  const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttl_seconds: 30 }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text();
    const hint =
      res.status === 403 ? " The API key needs the Member role or higher to create browser tokens." : "";
    return Response.json({ error: `Deepgram token request failed (${res.status}).${hint}`, detail }, { status: 502 });
  }
  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  return Response.json({ token: access_token, expiresIn: expires_in }, { headers: { "Cache-Control": "no-store" } });
}
