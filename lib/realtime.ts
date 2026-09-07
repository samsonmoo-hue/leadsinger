import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { getDatabase, ref, onValue, get, set, runTransaction } from 'firebase/database';
import { firebaseConfig } from './firebase-config';
export type Room = { id: string; name: string; cue: string | null; revision: number };
type StoredRoom = { name: string; state: { cue: string; revision: number } };
let pending: ReturnType<typeof connect> | undefined;
async function connect() {
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await setPersistence(auth, inMemoryPersistence);
  const { user } = await signInAnonymously(auth);
  return { db: getDatabase(app), uid: user.uid };
}
export function client() {
  return pending ??= connect().catch(error => { pending = undefined; throw error; });
}
function fromStored(id: string, value: StoredRoom): Room {
  return { id, name: value.name, cue: value.state.cue === 'waiting' ? null : value.state.cue, revision: value.state.revision };
}
export async function watch(roomId: string | undefined, receive: (value: Room | Room[]) => void, connection: (value: boolean) => void, error: (message: string) => void) {
  const { db } = await client();
  const stopConnection = onValue(ref(db, '.info/connected'), snapshot => connection(snapshot.val() === true));
  const stopData = onValue(ref(db, roomId ? `rooms/${roomId}` : 'rooms'), snapshot => {
    if (roomId) {
      if (!snapshot.exists()) { connection(false); error('房間不存在，請離開後重新選擇。'); return; }
      receive(fromStored(roomId, snapshot.val()));
    } else {
      const values = snapshot.val() ?? {};
      receive(Object.entries(values).map(([id, value]) => fromStored(id, value as StoredRoom)).sort((a,b) => a.name.localeCompare(b.name, 'zh-Hant')));
    }
  }, () => { connection(false); error('無法取得房間資料，請重新整理後重試。'); });
  return () => { stopConnection(); stopData(); };
}
export async function createRoom(input: string) {
  const name = input.trim().normalize('NFC');
  if (!name || name.length > 80) throw new Error('請輸入 1–80 字的歌名。');
  const { db } = await client();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(name));
  const id = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  const result = await runTransaction(ref(db, `rooms/${id}`), old => old === null ? { name, state: { cue: 'waiting', revision: 0 } } : undefined, { applyLocally: false });
  if (!result.committed) throw new Error('這首歌的房間已存在，請從清單加入。');
  return fromStored(id, result.snapshot.val());
}
export async function joinRoom(id: string, role: string) {
  if (!['leader', 'musician'].includes(role)) throw new Error('請選擇有效的身分。');
  const { db, uid } = await client();
  const snapshot = await get(ref(db, `rooms/${id}`));
  if (!snapshot.exists()) throw new Error('房間不存在，請重新選擇。');
  await set(ref(db, `members/${id}/${uid}`), role);
  return fromStored(id, snapshot.val());
}
export async function sendCue(id: string, cue: string) {
  if (!['start', 'chorus', 'ending', 'continue'].includes(cue)) throw new Error('無效的提示。');
  const { db } = await client();
  const result = await runTransaction(ref(db, `rooms/${id}/state`), state => state ? { cue, revision: state.revision + 1 } : undefined, { applyLocally: false });
  if (!result.committed) throw new Error('提示未送出，請重新加入房間。');
  return result.snapshot.val() as { cue: string; revision: number };
}

