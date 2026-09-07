import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { getDatabase, ref, onValue, get, set, update, runTransaction } from 'firebase/database';
import { firebaseConfig } from './firebase-config';
export type Song = { id: string; name: string; bpm?: number };
export type Room = { id: string; name: string; songs: Song[]; songId: string; cue: string | null; revision: number };
type StoredRoom = { name: string; createdBy?: string; songs?: Record<string, { name: string; order: number; bpm?: number }>; state: { cue: string; revision: number; songId?: string } };
const bibleNames = ['大衛', '摩西', '約書亞', '撒母耳', '以利亞', '以利沙', '但以理', '約瑟', '以撒', '雅各', '亞伯拉罕', '挪亞', '彼得', '保羅', '約翰', '馬太', '馬可', '路加', '提摩太', '巴拿巴', '腓利', '安得烈', '西拉', '提多', '路得', '以斯帖', '底波拉', '哈拿', '馬利亞', '馬大', '撒拉', '利百加'];
export function suggestRoomName(used: string[], random = Math.random): string {
  const available = bibleNames.filter(name => !used.includes(name));
  if (available.length) return available[Math.floor(random() * available.length)];
  const name = bibleNames[Math.floor(random() * bibleNames.length)];
  let suffix = 2;
  while (used.includes(`${name} ${suffix}`)) suffix++;
  return `${name} ${suffix}`;
}
let pending: ReturnType<typeof connect> | undefined;
async function connect() {
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await setPersistence(auth, inMemoryPersistence);
  const { user } = await signInAnonymously(auth);
  return { db: getDatabase(app), uid: user.uid };
}
export function client() { return pending ??= connect().catch(error => { pending = undefined; throw error; }); }
function fromStored(id: string, value: StoredRoom): Room {
  // Existing one-song rooms stay usable until a leader confirms their new playlist.
  const legacy = value.state.songId === undefined;
  const songs = legacy ? [{ id: 'legacy', name: value.name }] : Object.entries(value.songs ?? {}).sort((a,b) => a[1].order - b[1].order || a[0].localeCompare(b[0])).map(([id, song]) => ({ id, name: song.name, ...(song.bpm === undefined ? {} : { bpm: song.bpm }) }));
  return { id, name: value.name, songs, songId: value.state.songId ?? 'legacy', cue: value.state.cue === 'waiting' ? null : value.state.cue, revision: value.state.revision };
}
export async function watch(roomId: string | undefined, receive: (value: Room | Room[] | null) => void, connection: (value: boolean) => void, error: (message: string) => void) {
  const { db } = await client();
  const stopConnection = onValue(ref(db, '.info/connected'), snapshot => connection(snapshot.val() === true));
  const stopData = onValue(ref(db, roomId ? `rooms/${roomId}` : 'rooms'), snapshot => {
    if (roomId) receive(snapshot.exists() ? fromStored(roomId, snapshot.val()) : null);
    else receive(Object.entries(snapshot.val() ?? {}).map(([id, value]) => fromStored(id, value as StoredRoom)).sort((a,b) => a.name.localeCompare(b.name, 'zh-Hant')));
  }, () => { connection(false); error('無法取得房間資料，請重新整理後重試。'); });
  return () => { stopConnection(); stopData(); };
}
export async function createRoom(preferred: string) {
  const { db, uid } = await client();
  let name = preferred.trim();
  if (!name || name.length > 80) throw new Error('房間名稱須為 1–80 字。');
  for (let attempt = 0; attempt < 20; attempt++) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(name.normalize('NFC')));
    const id = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
    const result = await runTransaction(ref(db, `rooms/${id}`), old => old === null ? { name, createdBy: uid, state: { cue: 'waiting', revision: 0, songId: '' } } : undefined, { applyLocally: false });
    if (result.committed) return fromStored(id, result.snapshot.val());
    const snapshot = await get(ref(db, 'rooms'));
    name = suggestRoomName(Object.values(snapshot.val() ?? {}).map(value => (value as StoredRoom).name));
  }
  throw new Error('建立房間的人較多，請再試一次。');
}
export async function joinRoom(id: string, role: string) {
  if (!id || !['leader', 'musician'].includes(role)) throw new Error('請選擇房間與身分。');
  const { db, uid } = await client();
  const snapshot = await get(ref(db, `rooms/${id}`));
  if (!snapshot.exists()) throw new Error('房間不存在，請重新選擇。');
  await set(ref(db, `members/${id}/${uid}`), role);
  return fromStored(id, snapshot.val());
}
async function changeRoom(id: string, change: (room: StoredRoom) => StoredRoom | undefined) {
  const { db } = await client();
  const initial = await get(ref(db, `rooms/${id}`));
  if (!initial.exists()) throw new Error('房間已被刪除，請重新選擇。');
  // Firebase may first call the updater with null before its local cache is ready.
  // Seed only that first call; server retries always use the authoritative value.
  let firstCall = true;
  const result = await runTransaction(ref(db, `rooms/${id}`), old => {
    const value = old ?? (firstCall ? initial.val() : null);
    firstCall = false;
    return value ? change(value) : undefined;
  }, { applyLocally: false });
  if (!result.committed) throw new Error('房間或歌單已變更，請重新開啟歌單再試一次。');
  return fromStored(id, result.snapshot.val());
}
export async function saveSongs(id: string, songs: Song[], expectedSongs: Song[]) {
  if (!songs.length || songs.some(song => !song.name.trim() || song.name.trim().length > 80)) throw new Error('請至少新增一首詩歌，每首歌名限 1–80 字。');
  if (songs.some(song => song.bpm !== undefined && (!Number.isInteger(song.bpm) || song.bpm < 1 || song.bpm > 300))) throw new Error('拍子速度請填入 1–300 的整數，或留空。');
  const storedSongs = Object.fromEntries(songs.map((song, order) => [song.id, { name: song.name.trim(), order, ...(song.bpm === undefined ? {} : { bpm: song.bpm }) }]));
  return changeRoom(id, old => {
    const current = fromStored(id, old);
    if (JSON.stringify(current.songs) !== JSON.stringify(expectedSongs)) return undefined;
    const songId = songs.some(song => song.id === current.songId) ? current.songId : songs[0].id;
    return { ...old, songs: storedSongs, state: { songId, cue: 'waiting', revision: old.state.revision + 1 } };
  });
}
export async function sendCue(id: string, cue: string, expectedSongId: string) {
  if (!['start', 'chorus', 'ending', 'continue'].includes(cue)) throw new Error('無效的提示。');
  return changeRoom(id, old => {
    const room = fromStored(id, old);
    if (!room.songId || room.songId !== expectedSongId) return undefined;
    return { ...old, state: { ...old.state, cue, revision: old.state.revision + 1 } };
  });
}
export async function selectSong(id: string, songId: string) {
  return changeRoom(id, old => {
    if (!fromStored(id, old).songs.some(song => song.id === songId)) return undefined;
    return { ...old, state: { songId, cue: 'waiting', revision: old.state.revision + 1 } };
  });
}
export async function deleteRoom(id: string) {
  const { db } = await client();
  await update(ref(db), { [`rooms/${id}`]: null, [`members/${id}`]: null });
}
