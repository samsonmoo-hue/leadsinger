'use client';
import { useEffect, useState } from 'react';
import { AudioLines, Mic2, Guitar, ArrowRight, Plus, RotateCcw, Repeat2, Flag, Play, LogOut, Radio, ChevronDown } from 'lucide-react';
import { watch, createRoom, joinRoom, sendCue, type Room } from '../lib/realtime';
const cues = [ { id: 'start', label: '從頭', en: 'FROM THE TOP', Icon: RotateCcw }, { id: 'chorus', label: '副歌', en: 'CHORUS', Icon: Repeat2 }, { id: 'ending', label: '尾句', en: 'LAST LINE', Icon: Flag }, { id: 'continue', label: '音樂繼續', en: 'KEEP PLAYING', Icon: Play } ];
export default function Home() {
  const [rooms, setRooms] = useState<Room[]>([]), [selected, setSelected] = useState(''), [name, setName] = useState('');
  const [role, setRole] = useState('musician'), [room, setRoom] = useState<Room | null>(null);
  const [mode, setMode] = useState('join'), [busy, setBusy] = useState(false), [error, setError] = useState(''), [connected, setConnected] = useState(false);
  useEffect(() => {
    let disposed = false, stop: (() => void) | undefined;
    setConnected(false);
    watch(room?.id, value => {
      if (disposed) return;
      if (Array.isArray(value)) setRooms(value);
      else setRoom(old => old && old.id === value.id && value.revision >= old.revision ? value : old);
    }, value => { if (!disposed) setConnected(value); }, message => { if (!disposed) setError(message); })
      .then(unsubscribe => { if (disposed) unsubscribe(); else stop = unsubscribe; })
      .catch(() => { if (!disposed) { setConnected(false); setError('無法連接同步服務，請重新整理後重試。'); } });
    return () => { disposed = true; stop?.(); };
  }, [room?.id]);
  async function enter(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      let id = selected;
      const nextRole = mode === 'create' ? 'leader' : role;
      if (mode === 'create') {
        const created = await createRoom(name); id = created.id;
        setSelected(id); setMode('join'); setRole('leader');
      }
      const joined = await joinRoom(id, nextRole);
      setRole(nextRole); setRoom(joined);
    } catch (e) { setError(e instanceof Error ? e.message : '無法加入房間。'); }
    finally { setBusy(false); }
  }
  async function send(cue: string) {
    if (!room || role !== 'leader' || !connected || busy) return;
    setBusy(true); setError('');
    try {
      const state = await sendCue(room.id, cue);
      setRoom(old => old && old.id === room.id && state.revision >= old.revision ? { ...old, ...state } : old);
    } catch { setError('提示未送出。請檢查連線，或重新以領唱身分加入。'); }
    finally { setBusy(false); }
  }
  return <main>
    <header><a className="brand" href="./"><span className="brand-icon"><AudioLines /></span><span>領唱提示</span></a><span className={`connection ${connected ? 'online' : ''}`}><i />{connected ? '已連線' : '連線中／重試中'}</span></header>
    {!room ? <section className="lobby">
      <span className="eyebrow lobby-tagline">LET’S PLAY TOGETHER</span>
      <div className="join-card"><div className="tabs"><button className={mode === 'join' ? 'chosen' : ''} disabled={busy} onClick={() => { setMode('join'); setError(''); }}>加入房間</button><button className={mode === 'create' ? 'chosen' : ''} disabled={busy} onClick={() => { setMode('create'); setError(''); }}><Plus size={17} />領唱建立房間</button></div>
      <form onSubmit={enter}><span className="eyebrow">{mode === 'create' ? 'CREATE A ROOM' : 'JOIN THE SESSION'}</span><h2>{mode === 'create' ? '從一首歌開始' : '準備好，一起進入'}</h2><p className="form-note">{mode === 'create' ? '房間名稱就是歌名，建立後以領唱身分進入。' : '請與團隊選擇同一首歌。'}</p>
      {mode === 'create' ? <label>歌曲名稱<input value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="輸入要演唱的歌名" required /></label> : <><label>選擇房間（歌曲）<span className="song-select"><select value={selected} onChange={e => setSelected(e.target.value)} required><option value="">{rooms.length ? '請選擇歌曲' : '尚無房間，請領唱先建立'}</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select><ChevronDown size={20} aria-hidden="true" /></span></label><fieldset><legend>選擇身分</legend><div className="roles">{[{ id: 'leader', label: '領唱', sub: '發送演奏提示', Icon: Mic2 }, { id: 'musician', label: '樂手', sub: '觀看同步提示', Icon: Guitar }].map(({ id, label, sub, Icon }) => <label className={`role ${role === id ? 'selected' : ''}`} key={id}><input type="radio" name="role" value={id} checked={role === id} onChange={() => setRole(id)} /><Icon size={25} /><strong>{label}</strong><small>{sub}</small></label>)}</div></fieldset></>}
      {error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy || !connected || (mode === 'join' ? !selected : !name.trim())}>{busy ? '處理中…' : mode === 'create' ? '建立並進入房間' : '進入房間'}<ArrowRight size={20} /></button></form><div className="card-footer"><Radio size={16} />所有裝置加入同一房間，即可同步</div></div>
    </section> : <section className="stage"><div className="room-heading"><div><span className="eyebrow">LIVE SESSION · {role === 'leader' ? '領唱' : '樂手'}</span><h1>{room.name}</h1></div><button className="leave" disabled={busy} onClick={() => { setRoom(null); setError(''); }}><LogOut size={18} />離開房間</button></div><div className={`now ${!connected ? 'stale' : ''}`} aria-live="polite"><span>{connected ? '目前提示' : '連線中斷 · 以下為最後收到的提示'}</span><strong>{cues.find(c => c.id === room.cue)?.label || '等待領唱提示'}</strong><span>{role === 'leader' ? '點選下方按鈕，提示所有樂手' : '跟隨亮起的提示演奏'}</span></div><div className="cue-grid">{cues.map(({ id, label, en, Icon }, index) => <button key={id} className={`cue ${room.cue === id ? 'lit' : ''}`} aria-pressed={room.cue === id} disabled={role !== 'leader' || busy || !connected} onClick={() => send(id)}><span className="cue-top"><Icon size={30} /><span>0{index + 1}</span></span><strong>{label}</strong><span className="cue-bottom">{en}<i>{room.cue === id ? '● 目前提示' : '○'}</i></span></button>)}</div>{error && <p className="error" role="alert">{error}</p>}<p className="stage-note">{role === 'leader' ? '每次只亮起一個提示，直到你選擇下一個。' : '樂手模式 · 提示會自動更新'}</p></section>}
  </main>;
}
