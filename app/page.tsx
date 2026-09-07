'use client';
import { useEffect, useState } from 'react';
import { AudioLines, Mic2, Guitar, ArrowRight, Plus, RotateCcw, Repeat2, Flag, Play, LogOut, Radio, ChevronDown, ChevronLeft, ChevronRight, ListMusic, Trash2 } from 'lucide-react';
import { watch, createRoom, joinRoom, sendCue, suggestRoomName, saveSongs, selectSong, deleteRoom, type Room, type Song } from '../lib/realtime';
import SongEditor from '../components/SongEditor';
import ScreenAwake from '../components/ScreenAwake';
const cues = [ { id: 'start', label: '從頭', en: 'FROM THE TOP', Icon: RotateCcw }, { id: 'chorus', label: '副歌', en: 'CHORUS', Icon: Repeat2 }, { id: 'ending', label: '尾句', en: 'LAST LINE', Icon: Flag }, { id: 'continue', label: '音樂繼續', en: 'KEEP PLAYING', Icon: Play } ];
export default function Home() {
  const [rooms, setRooms] = useState<Room[]>([]), [selected, setSelected] = useState(''), [name, setName] = useState('');
  const [role, setRole] = useState('musician'), [room, setRoom] = useState<Room | null>(null);
  const [mode, setMode] = useState('join'), [busy, setBusy] = useState(false), [error, setError] = useState(''), [connected, setConnected] = useState(false);
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState<Song[]>([]), [originalSongs, setOriginalSongs] = useState<Song[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    let disposed = false, stop: (() => void) | undefined;
    setConnected(false);
    watch(room?.id, value => {
      if (disposed) return;
      if (Array.isArray(value)) setRooms(value);
      else if (value === null) { setRoom(null); setEditing(false); setConfirmDelete(false); setError('房間已被刪除，請選擇其他房間。'); }
      else setRoom(old => old && old.id === value.id && value.revision >= old.revision ? value : old);
    }, value => { if (!disposed) setConnected(value); }, message => { if (!disposed) setError(message); })
      .then(unsubscribe => { if (disposed) unsubscribe(); else stop = unsubscribe; })
      .catch(() => { if (!disposed) { setConnected(false); setError('無法連接同步服務，請重新整理後重試。'); } });
    return () => { disposed = true; stop?.(); };
  }, [room?.id]);
  async function perform(action: () => Promise<void>) {
    if (busy || !connected) return;
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : '操作未完成，請再試一次。'); }
    finally { setBusy(false); }
  }
  function accept(next: Room) { setRoom(old => !old || old.id === next.id && next.revision >= old.revision ? next : old); }
  function editPlaylist(next: Room) { setDraft(next.songs); setOriginalSongs(next.songs); setEditing(true); setConfirmDelete(false); setError(''); }
  function leave() { setRoom(null); setEditing(false); setConfirmDelete(false); setError(''); setMode('join'); }
  function enter(event: React.FormEvent) {
    event.preventDefault();
    void perform(async () => {
      if (mode === 'create') {
        const created = await createRoom(name); setRoom(created); setRole('leader'); setSelected(created.id); editPlaylist(created);
      } else {
        const joined = await joinRoom(selected, role); setRoom(joined);
        if (role === 'leader' && !joined.songs.length) editPlaylist(joined); else setEditing(false);
      }
    });
  }
  const currentIndex = room?.songs.findIndex(song => song.id === room.songId) ?? -1;
  const currentSong = room?.songs[currentIndex];
  const locked = busy || !connected;
  const errorMessage = error && <p className="error" role="alert">{error}</p>;
  return <main>
    <header><a className="brand" href="./"><span className="brand-icon"><AudioLines /></span><span>領唱提示</span></a><span className={`connection ${connected ? 'online' : ''}`}><i />{connected ? '已連線' : '連線中／重試中'}</span></header>
    {!room ? <section className="lobby">
      <span className="eyebrow lobby-tagline">LET’S PLAY TOGETHER</span>
      <div className="join-card"><div className="tabs"><button className={mode === 'join' ? 'chosen' : ''} disabled={busy} onClick={() => { setMode('join'); setError(''); }}>加入房間</button><button className={mode === 'create' ? 'chosen' : ''} disabled={busy} onClick={() => { setMode('create'); setName(suggestRoomName(rooms.map(item => item.name))); setError(''); }}><Plus size={17} />領唱建立房間</button></div>
      <form onSubmit={enter}><span className="eyebrow">{mode === 'create' ? 'CREATE A ROOM' : 'JOIN THE SESSION'}</span><h2>{mode === 'create' ? '先建立團隊的房間' : '準備好，一起進入'}</h2><p className="form-note">{mode === 'create' ? '以隨機聖經人名命名，下一步確認詩歌與順序。' : '加入領唱的房間，整份歌單都會自動同步。'}</p>
      {mode === 'create' ? <label>房間名稱<div className="room-name-row"><input value={name} readOnly aria-label="隨機房間名稱" /><button type="button" className="secondary" disabled={busy} onClick={() => setName(suggestRoomName([...rooms.map(item => item.name), name]))}><RotateCcw size={17} />換一個</button></div></label> : <><label>選擇房間<span className="song-select"><select value={selected} onChange={e => setSelected(e.target.value)} required><option value="">{rooms.length ? '請選擇房間' : '尚無房間，請領唱先建立'}</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.name}{!r.songs.length ? '（準備歌單中）' : ''}</option>)}</select><ChevronDown size={20} aria-hidden="true" /></span></label><fieldset><legend>選擇身分</legend><div className="roles">{[{ id: 'leader', label: '領唱', sub: '管理歌單與發送提示', Icon: Mic2 }, { id: 'musician', label: '樂手', sub: '觀看同步提示', Icon: Guitar }].map(({ id, label, sub, Icon }) => <label className={`role ${role === id ? 'selected' : ''}`} key={id}><input type="radio" name="role" value={id} checked={role === id} disabled={busy} onChange={() => setRole(id)} /><Icon size={25} /><strong>{label}</strong><small>{sub}</small></label>)}</div></fieldset></>}
      {errorMessage}<button className="primary" disabled={locked || (mode === 'join' ? !selected : !name)}>{busy ? '處理中…' : mode === 'create' ? '建立房間，確認詩歌' : '進入房間'}<ArrowRight size={20} /></button></form><div className="card-footer"><Radio size={16} />加入一次，跟隨領唱同步切歌與提示</div></div>
    </section> : editing && role === 'leader' ? <section className="playlist-page">
      <span className="eyebrow">{room.name} · 領唱</span><h1>詩歌確認</h1><p className="form-note">新增詩歌並排好順序，確認後就能開始。</p>
      <SongEditor songs={draft} onChange={setDraft} disabled={locked} />
      {errorMessage}<button className="primary" disabled={locked || !draft.length} onClick={() => void perform(async () => { const next = await saveSongs(room.id, draft, originalSongs); accept(next); setEditing(false); })}>{busy ? '處理中…' : '確認並進入房間'}<ArrowRight size={20} /></button>
      <div className="playlist-bottom"><button className="secondary" disabled={locked} onClick={() => { if (room.songs.length) { setEditing(false); setError(''); } else leave(); }}>{room.songs.length ? '取消，回到房間' : '回到房間列表'}</button><button className="danger" disabled={locked} onClick={() => setConfirmDelete(true)}><Trash2 size={17} />刪除房間</button></div>
      {confirmDelete && <div className="delete-confirm" role="alert"><p>確定刪除「{room.name}」房間與整份歌單？所有團員將離開此房間。</p><div><button className="danger" disabled={locked} onClick={() => void perform(async () => { await deleteRoom(room.id); leave(); })}>確定刪除房間</button><button className="secondary" disabled={busy} onClick={() => setConfirmDelete(false)}>取消</button></div></div>}
    </section> : <section className="stage"><div className="room-heading"><div><span className="eyebrow">{room.name} · {role === 'leader' ? '領唱' : '樂手'}</span><h1 aria-live="polite">{currentSong?.name || '領唱準備歌單中'}</h1>{currentSong && <p className="song-position">第 {currentIndex + 1} 首 / 共 {room.songs.length} 首</p>}</div><div className="room-actions">{role === 'leader' && <button className="leave" disabled={locked} onClick={() => editPlaylist(room)}><ListMusic size={18} />詩歌確認</button>}<button className="leave" disabled={busy} onClick={leave}><LogOut size={18} />離開房間</button></div></div>
      {role === 'leader' && room.songs.length > 0 && <div className="song-navigation"><button className="secondary" disabled={locked || currentIndex <= 0} onClick={() => void perform(async () => accept(await selectSong(room.id, room.songs[currentIndex - 1].id)))}><ChevronLeft size={19} />上一首</button><label>跳到詩歌<span className="song-select"><select value={room.songId} disabled={locked} onChange={event => { const id = event.target.value; void perform(async () => accept(await selectSong(room.id, id))); }}>{room.songs.map((song, index) => <option key={song.id} value={song.id}>{index + 1}. {song.name}</option>)}</select><ChevronDown size={20} aria-hidden="true" /></span></label><button className="secondary" disabled={locked || currentIndex < 0 || currentIndex >= room.songs.length - 1} onClick={() => void perform(async () => accept(await selectSong(room.id, room.songs[currentIndex + 1].id)))}>下一首<ChevronRight size={19} /></button></div>}
      <div className={`now ${!connected ? 'stale' : ''}`} aria-live="polite"><span>{connected ? '目前提示' : '連線中斷 · 以下為最後收到的提示'}</span><strong>{cues.find(c => c.id === room.cue)?.label || '等待領唱提示'}</strong><span>{role === 'leader' ? '點選下方按鈕，提示所有樂手' : '歌名與提示會自動更新，跟隨亮起的提示演奏'}</span></div><div className="cue-grid">{cues.map(({ id, label, en, Icon }, index) => <button key={id} className={`cue cue-${id} ${room.cue === id ? 'lit' : ''}`} aria-pressed={room.cue === id} disabled={role !== 'leader' || locked || !currentSong} onClick={() => void perform(async () => accept(await sendCue(room.id, id, room.songId)))}><span className="cue-top"><Icon size={30} /><span>0{index + 1}</span></span><strong>{label}</strong><span className="cue-bottom">{en}<i>{room.cue === id ? '● 目前提示' : '○'}</i></span></button>)}</div>{errorMessage}<p className="stage-note">{role === 'leader' ? '切歌會清除上一首提示，每次只亮起一顆燈。' : '樂手模式 · 不需重新選歌或加入房間'}</p></section>}
    {room && <ScreenAwake />}
  </main>;
}
