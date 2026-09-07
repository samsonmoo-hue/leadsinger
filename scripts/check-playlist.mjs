import assert from 'node:assert/strict';
import { build } from 'rolldown';
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, signInAnonymously, deleteUser } from 'firebase/auth';
import { getDatabase, ref, get, set, update, onValue } from 'firebase/database';
import { firebaseConfig } from '../lib/firebase-config.ts';
await build({ input: 'lib/realtime.ts', external: id => id.startsWith('firebase/'), output: { file: 'work/realtime-check.mjs', format: 'esm' } });
const api = await import('../work/realtime-check.mjs');
const created = [];
let observerApp, observer, stop;
const seen = [];
async function observed(predicate) {
  const deadline = Date.now() + 10000;
  while (!seen.some(predicate)) {
    if (Date.now() > deadline) throw new Error('Realtime listener timed out');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
try {
  assert.equal((await fetch(firebaseConfig.databaseURL + '/rooms.json')).status, 401);
  const usedNames = [];
  for (let index = 0; index < 100; index++) { const name = api.suggestRoomName(usedNames, () => 0); assert.ok(!usedNames.includes(name)); usedNames.push(name); }
  const { db } = await api.client();
  const before = (await get(ref(db, 'rooms'))).val() ?? {};
  const preferred = `測試-${Date.now()}`;
  const attempt = await Promise.allSettled([api.createRoom(preferred), api.createRoom(preferred)]);
  for (const result of attempt) if (result.status === 'fulfilled') created.push(result.value);
  assert.equal(created.length, 2, JSON.stringify(attempt.map(item => item.status)));
  assert.notEqual(created[0].id, created[1].id);
  assert.notEqual(created[0].name, created[1].name);
  const room = created[0];
  assert.deepEqual(room.songs, []);
  assert.equal(room.songId, '');
  observerApp = initializeApp(firebaseConfig, 'musician-check');
  ({ user: observer } = await signInAnonymously(getAuth(observerApp)));
  const musicianDb = getDatabase(observerApp);
  await set(ref(musicianDb, `members/${room.id}/${observer.uid}`), 'musician');
  stop = onValue(ref(musicianDb, `rooms/${room.id}`), snapshot => seen.push(snapshot.val()));
  const songs = ['第一首', '第二首', '第三首'].map(name => ({ id: crypto.randomUUID(), name }));
  let live = await api.saveSongs(room.id, songs, []);
  assert.equal(live.songId, songs[0].id);
  await observed(value => value?.state.songId === songs[0].id);
  let tempoSongs = songs.map((song, index) => index === 0 ? { ...song, bpm: 60 } : song);
  live = await api.saveSongs(room.id, tempoSongs, songs);
  assert.equal(live.songs[0].bpm, 60);
  await observed(value => value?.songs?.[songs[0].id]?.bpm === 60);
  const fasterSongs = tempoSongs.map((song, index) => index === 0 ? { ...song, bpm: 120 } : song);
  live = await api.saveSongs(room.id, fasterSongs, tempoSongs);
  await observed(value => value?.songs?.[songs[0].id]?.bpm === 120);
  await assert.rejects(api.saveSongs(room.id, tempoSongs, tempoSongs));
  for (const bpm of [0, -1, 301, 80.5, '80']) {
    await assert.rejects(api.saveSongs(room.id, [{ ...songs[0], bpm }], fasterSongs));
    await assert.rejects(set(ref(db, `rooms/${room.id}`), { name: room.name, songs: { [songs[0].id]: { name: 'invalid', order: 0, bpm } }, state: { cue: 'waiting', songId: songs[0].id, revision: live.revision + 1 } }));
  }
  await assert.rejects(set(ref(musicianDb, `rooms/${room.id}/songs/${songs[0].id}/bpm`), 90));
  live = await api.saveSongs(room.id, songs, fasterSongs);
  assert.equal(live.songs[0].bpm, undefined);
  await observed(value => value?.state.revision === live.revision && value?.songs?.[songs[0].id]?.bpm === undefined);
  for (const cue of ['start', 'chorus', 'ending', 'continue']) {
    live = await api.sendCue(room.id, cue, live.songId);
    const revision = live.revision;
    await observed(value => value?.state.revision === revision && value?.state.cue === cue);
  }
  live = await api.selectSong(room.id, songs[1].id);
  assert.equal(live.cue, null);
  await observed(value => value?.state.songId === songs[1].id && value?.state.cue === 'waiting');
  await assert.rejects(api.sendCue(room.id, 'start', songs[0].id));
  await assert.rejects(api.selectSong(room.id, 'missing-song'));
  await assert.rejects(api.saveSongs(room.id, [], songs));
  live = await api.saveSongs(room.id, [songs[2], songs[0]], songs);
  assert.deepEqual(live.songs, [songs[2], songs[0]]);
  assert.equal(live.songId, songs[2].id);
  assert.equal(live.cue, null);
  await observed(value => value?.songs?.[songs[2].id]?.order === 0 && !value?.songs?.[songs[1].id]);
  await assert.rejects(api.saveSongs(room.id, songs, songs));
  await assert.rejects(set(ref(musicianDb, `rooms/${room.id}/state`), { cue: 'chorus', revision: live.revision + 1, songId: live.songId }));
  await assert.rejects(set(ref(musicianDb, `rooms/${room.id}/songs`), null));
  await assert.rejects(update(ref(musicianDb), { [`rooms/${room.id}`]: null, [`members/${room.id}`]: null }));
  // Invalid song references and song changes retaining the previous cue must be rejected server-side.
  await assert.rejects(set(ref(db, `rooms/${room.id}/state`), { cue: 'waiting', revision: live.revision + 1, songId: 'missing-song' }));
  await assert.rejects(set(ref(db, `rooms/${room.id}/state`), { cue: 'chorus', revision: live.revision + 1, songId: songs[0].id }));
  // A leader rejoining from another device can also manage and delete the room.
  await set(ref(musicianDb, `members/${room.id}/${observer.uid}`), 'leader');
  await set(ref(musicianDb, `rooms/${room.id}/state`), { cue: 'start', revision: live.revision + 1, songId: live.songId });
  await observed(value => value?.state.revision === live.revision + 1 && value?.state.cue === 'start');
  await update(ref(musicianDb), { [`rooms/${room.id}`]: null, [`members/${room.id}`]: null });
  await observed(value => value === null);
  assert.equal((await get(ref(musicianDb, `members/${room.id}/${observer.uid}`))).exists(), false);
  await assert.rejects(api.sendCue(room.id, 'start', live.songId));
  const after = (await get(ref(db, 'rooms'))).val() ?? {};
  for (const [id, value] of Object.entries(before)) assert.deepEqual(after[id], value, 'Existing rooms must be preserved');
  console.log('PASS: optional BPM create/update/clear and realtime delivery; invalid BPM and musician BPM writes rejected; unique concurrent rooms; playlist create/reorder/remove; realtime four cues and song switching; stale/invalid commands rejected; musician writes denied; deletion notification and member cleanup; existing rooms preserved.');
} finally {
  stop?.();
  for (const room of created) {
    const { db } = await api.client();
    if ((await get(ref(db, `rooms/${room.id}`))).exists()) await api.deleteRoom(room.id);
  }
  if (observer) await deleteUser(observer);
  const app = getApps().find(item => item.name === '[DEFAULT]');
  if (app && getAuth(app).currentUser) await deleteUser(getAuth(app).currentUser);
  for (const app of getApps()) await deleteApp(app);
}


