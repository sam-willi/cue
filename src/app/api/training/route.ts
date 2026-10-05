// Saves a labeled training session (audio + what Deepgram heard + the user's filler labels)
// to ./training/<id>/ on this machine. Local development only: training audio of real
// conversations must never be stored by a deployed server.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(process.cwd(), "training");

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Training data can only be saved when running locally." }, { status: 403 });
  }
  const form = await request.formData();
  const session = form.get("session");
  const audio = form.get("audio");
  if (typeof session !== "string") return Response.json({ error: "Missing session JSON." }, { status: 400 });
  let parsed: { fillerLabels?: unknown[]; messages?: unknown[] };
  try {
    parsed = JSON.parse(session);
  } catch {
    return Response.json({ error: "Session JSON is invalid." }, { status: 400 });
  }
  if (!Array.isArray(parsed.messages) || !Array.isArray(parsed.fillerLabels)) {
    return Response.json({ error: "Session needs messages and fillerLabels." }, { status: 400 });
  }

  const id = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join(ROOT, id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "session.json"), session);
  if (audio instanceof Blob && audio.size > 0)
    await writeFile(join(dir, "audio.wav"), Buffer.from(await audio.arrayBuffer()));
  return Response.json({
    id,
    folder: `training/${id}`,
    labels: parsed.fillerLabels.length,
    audio: audio instanceof Blob,
  });
}
