import { allowedOrigin, withCors } from '../../../lib/cors';
import { getDb } from '../../../db';
async function handleGET(request: Request) {
  const id = new URL(request.url).searchParams.get('room') ?? '';
  const room = await getDb().prepare('SELECT id, name, cue, revision FROM rooms WHERE id = ?').bind(id).first();
  return Response.json(room ?? { error: '房間不存在。' }, { status: room ? 200 : 404, headers: { 'Cache-Control': 'no-store' } });
}
async function handlePUT(request: Request) {
  if (!allowedOrigin(request)) return new Response(null, { status: 403 });
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  const session = await getDb().prepare("SELECT room_id FROM sessions WHERE token = ? AND role = 'leader' AND expires > ?").bind(token, Date.now()).first<{ room_id: string }>();
  if (!session) return Response.json({ error: '只有領唱可以發送提示；請重新加入房間。' }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, string> | null;
  if (!['start', 'chorus', 'ending', 'continue'].includes(body?.cue ?? '')) return new Response(null, { status: 400 });
  const room = await getDb().prepare('UPDATE rooms SET cue = ?, revision = revision + 1 WHERE id = ? RETURNING id, name, cue, revision').bind(body!.cue, session.room_id).first();
  return Response.json(room, { headers: { 'Cache-Control': 'no-store' } });
}



export const GET = (request: Request) => withCors(request, () => handleGET(request));
export const PUT = (request: Request) => withCors(request, () => handlePUT(request));
export const OPTIONS = (request: Request) => withCors(request, async () => new Response(null));
