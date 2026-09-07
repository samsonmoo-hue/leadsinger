import { getDb } from '../../../db';
export async function GET() {
  const { results } = await getDb().prepare('SELECT id, name, cue, revision FROM rooms ORDER BY name').all();
  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, string> | null;
  const name = typeof body?.name === 'string' ? body.name.trim().normalize('NFC') : '';
  if (!name || name.length > 80) return Response.json({ error: '請輸入 1–80 字的歌名。' }, { status: 400 });
  const id = crypto.randomUUID();
  const result = await getDb().prepare('INSERT INTO rooms (id, name) VALUES (?, ?) ON CONFLICT(name) DO NOTHING').bind(id, name).run();
  if (!result.meta.changes) return Response.json({ error: '這首歌的房間已存在，請從清單加入。' }, { status: 409 });
  return Response.json({ id, name, cue: null, revision: 0 }, { status: 201 });
}

