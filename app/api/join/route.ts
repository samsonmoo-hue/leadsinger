import { allowedOrigin, withCors } from '../../../lib/cors';
import { getDb } from '../../../db';
async function handlePOST(request: Request) {
  if (!allowedOrigin(request)) return new Response(null, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, string> | null;
  if (!body || !['leader', 'musician'].includes(body.role) || typeof body.roomId !== 'string') return new Response(null, { status: 400 });
  const room = await getDb().prepare('SELECT id, name, cue, revision FROM rooms WHERE id = ?').bind(body.roomId).first();
  if (!room) return Response.json({ error: '房間不存在，請重新選擇。' }, { status: 404 });
  const token = crypto.randomUUID();
  await getDb().prepare('INSERT INTO sessions (token, room_id, role, expires) VALUES (?, ?, ?, ?)').bind(token, body.roomId, body.role, Date.now() + 86400000).run();
  return Response.json({ token, room }, { headers: { 'Cache-Control': 'no-store' } });
}


export const POST = (request: Request) => withCors(request, () => handlePOST(request));
export const OPTIONS = (request: Request) => withCors(request, async () => new Response(null));
