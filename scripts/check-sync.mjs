import assert from 'node:assert/strict';
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
async function request(path, method = 'GET', body, token) {
  const response = await fetch(origin + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json().catch(() => null) };
}
const song = `同步驗證-${Date.now()}`;
assert.equal((await request('/api/join', 'POST', { roomId: 'does-not-exist', role: 'musician' })).status, 404);
assert.equal((await request('/api/rooms', 'POST', { name: ' ' })).status, 400);
const a = await request('/api/rooms', 'POST', { name: song });
assert.equal(a.status, 201);
assert.equal((await request('/api/rooms', 'POST', { name: song })).status, 409);
const b = await request('/api/rooms', 'POST', { name: song + '-另一首歌' });
const leader = await request('/api/join', 'POST', { roomId: a.data.id, role: 'leader' });
const musician = await request('/api/join', 'POST', { roomId: a.data.id, role: 'musician' });
assert.equal((await request('/api/cue', 'PUT', { cue: 'chorus' }, musician.data.token)).status, 403);
assert.equal((await request('/api/cue', 'PUT', { cue: 'invalid' }, leader.data.token)).status, 400);
for (const cue of ['start', 'chorus', 'ending', 'continue']) {
  const sent = await request('/api/cue', 'PUT', { cue }, leader.data.token);
  assert.equal(sent.status, 200);
  const viewers = await Promise.all(Array.from({ length: 3 }, () => request(`/api/cue?room=${a.data.id}`)));
  for (const viewer of viewers) { assert.equal(viewer.data.cue, cue); assert.equal(viewer.data.revision, sent.data.revision); }
  assert.equal((await request(`/api/cue?room=${b.data.id}`)).data.cue, null);
}
const late = await request('/api/join', 'POST', { roomId: a.data.id, role: 'musician' });
assert.equal(late.data.room.cue, 'continue');
console.log('PASS: creation, duplicate/empty validation, join gating, all four cues, 3 independent readers, room isolation, musician permissions, late join.');
