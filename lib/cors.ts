const pagesOrigin = 'https://samsonmoo-hue.github.io';
export function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return origin === new URL(request.url).origin || origin === pagesOrigin;
}
export async function withCors(request: Request, action: () => Promise<Response>) {
  const origin = request.headers.get('origin');
  const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' });
  if (origin && allowedOrigin(request)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Max-Age', '600');
  }
  if (request.method === 'OPTIONS') return new Response(null, { status: allowedOrigin(request) ? 204 : 403, headers });
  try {
    const response = await action();
    headers.forEach((value, key) => response.headers.set(key, value));
    return response;
  } catch {
    return Response.json({ error: '同步服務暫時無法使用，請稍後重試。' }, { status: 503, headers });
  }
}
