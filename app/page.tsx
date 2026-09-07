'use client';
import { useEffect, useState } from 'react';
import { AudioLines, Mic2, Guitar, ArrowRight, Plus, RotateCcw, Repeat2, Flag, Play, LogOut, Radio } from 'lucide-react';
type Room = { id: string; name: string; cue: string | null; revision: number };
const cues = [ { id: 'start', label: '從頭', en: 'FROM THE TOP', Icon: RotateCcw }, { id: 'chorus', label: '副歌', en: 'CHORUS', Icon: Repeat2 }, { id: 'ending', label: '尾句', en: 'LAST LINE', Icon: Flag }, { id: 'continue', label: '音樂繼續', en: 'KEEP PLAYING', Icon: Play } ];
async function api<T = Room>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...options, cache: 'no-store', signal: AbortSignal.timeout(6000), headers: { 'Content-Type': 'application/json', ...options?.headers } });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || '連線失敗，請稍後再試。');
  return data;
}
export default function Home() {
  const [rooms, setRooms] = useState<Room[]>([]), [selected, setSelected] = useState(''), [name, setName] = useState('');
  const [role, setRole] = useState('musician'), [room, setRoom] = useState<Room | null>(null), [token, setToken] = useState('');
  const [mode, setMode] = useState('join'), [busy, setBusy] = useState(false), [error, setError] = useState(''), [connected, setConnected] = useState(false);
  useEffect(() => {
    let stopped = false, timer: ReturnType<typeof setTimeout>;
    async function sync() {
      try {
        const data = room ? await api(`/api/cue?room=${encodeURIComponent(room.id)}`) : await api<Room[]>('/api/rooms');
        if (stopped) return;
        if (!Array.isArray(data)) setRoom(old => old && data.revision >= old.revision ? data : old); else setRooms(data);
        setConnected(true);
      } catch { if (!stopped) setConnected(false); }
      if (!stopped) timer = setTimeout(sync, room ? 750 : 2500);
    }
    setConnected(false); sync();
    return () => { stopped = true; clearTimeout(timer); };
  }, [room?.id]);
  async function enter(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      let id = selected;
      if (mode === 'create') { const created = await api('/api/rooms', { method: 'POST', body: JSON.stringify({ name }) }); id = created.id; setSelected(id); setMode('join'); setRole('leader'); setRooms(old => [...old, created]); }
      const data = await api<{ token: string; room: Room }>('/api/join', { method: 'POST', body: JSON.stringify({ roomId: id, role: mode === 'create' ? 'leader' : role }) });
      setToken(data.token); setRoom(data.room);
    } catch (e) { setError(e instanceof Error ? e.message : '無法加入房間。'); } finally { setBusy(false); }
  }
  async function send(cue: string) {
    setBusy(true); setError('');
    try { const data = await api('/api/cue', { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ cue }) }); setRoom(old => old && data.revision >= old.revision ? data : old); setConnected(true); }
    catch (e) { setConnected(false); setError(e instanceof Error ? e.message : '提示未送出，請重試。'); } finally { setBusy(false); }
  }
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: object, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context || !room || role !== 'leader') return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: 'send_song_cue', title: '發送領唱提示', description: '在目前歌曲房間發送一個提示，更新領唱與樂手的顯示。',
        inputSchema: { type: 'object', properties: { cue: { type: 'string', enum: cues.map(c => c.id) } }, required: ['cue'], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input: unknown) {
          const cue = (input as { cue?: string })?.cue;
          if (!cues.some(c => c.id === cue)) throw new Error('無效的提示。');
          const data = await api('/api/cue', { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ cue }) });
          setRoom(old => old && data.revision >= old.revision ? data : old);
          return { cue: data.cue, revision: data.revision };
        },
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch { /* Optional browser capability. */ }
    return () => lifecycle.abort();
  }, [room?.id, role, token]);
  return <main>
    <header><a className="brand" href="/"><span className="brand-icon"><AudioLines /></span>同拍<span className="brand-sub">領唱提示</span></a><span className={`connection ${connected ? 'online' : ''}`}><i />{connected ? '已連線' : '連線中／重試中'}</span></header>
    {!room ? <section className="lobby">
      <div className="intro"><span className="eyebrow">LET’S PLAY TOGETHER</span><h1>同一首歌，<br /><em>同一個提示。</em></h1><p>領唱輕點，樂手同步看見。<br />讓每一次轉折，都有默契。</p><div className="steps"><span><b>01</b> 領唱建立房間</span><span><b>02</b> 選房間與身分</span><span><b>03</b> 同步提示</span></div><div className="wave" aria-hidden="true">{Array.from({ length: 25 }, (_, i) => <i key={i} style={{ height: `${18 + ((i * 17) % 53)}px` }} />)}</div></div>
      <div className="join-card"><div className="tabs"><button className={mode === 'join' ? 'chosen' : ''} disabled={busy} onClick={() => { setMode('join'); setError(''); }}>加入房間</button><button className={mode === 'create' ? 'chosen' : ''} disabled={busy} onClick={() => { setMode('create'); setError(''); }}><Plus size={17} />領唱建立房間</button></div>
      <form onSubmit={enter}><span className="eyebrow">{mode === 'create' ? 'CREATE A ROOM' : 'JOIN THE SESSION'}</span><h2>{mode === 'create' ? '從一首歌開始' : '準備好，一起進入'}</h2><p className="form-note">{mode === 'create' ? '房間名稱就是歌名，建立後以領唱身分進入。' : '請與團隊選擇同一首歌。'}</p>
      {mode === 'create' ? <label>歌曲名稱<input value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="輸入要演唱的歌名" required /></label> : <><label>選擇房間（歌曲）<select value={selected} onChange={e => setSelected(e.target.value)} required><option value="">{rooms.length ? '請選擇歌曲' : '尚無房間，請領唱先建立'}</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><fieldset><legend>選擇身分</legend><div className="roles">{[{ id: 'leader', label: '領唱', sub: '發送演奏提示', Icon: Mic2 }, { id: 'musician', label: '樂手', sub: '觀看同步提示', Icon: Guitar }].map(({ id, label, sub, Icon }) => <label className={`role ${role === id ? 'selected' : ''}`} key={id}><input type="radio" name="role" value={id} checked={role === id} onChange={() => setRole(id)} /><Icon size={25} /><strong>{label}</strong><small>{sub}</small></label>)}</div></fieldset></>}
      {error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy || !connected || (mode === 'join' ? !selected : !name.trim())}>{busy ? '處理中…' : mode === 'create' ? '建立並進入房間' : '進入房間'}<ArrowRight size={20} /></button></form><div className="card-footer"><Radio size={16} />所有裝置加入同一房間，即可同步</div></div>
    </section> : <section className="stage"><div className="room-heading"><div><span className="eyebrow">LIVE SESSION · {role === 'leader' ? '領唱' : '樂手'}</span><h1>{room.name}</h1></div><button className="leave" disabled={busy} onClick={() => { setRoom(null); setToken(''); setError(''); }}><LogOut size={18} />離開房間</button></div><div className={`now ${!connected ? 'stale' : ''}`} aria-live="polite"><span>{connected ? '目前提示' : '連線中斷 · 以下為最後收到的提示'}</span><strong>{cues.find(c => c.id === room.cue)?.label || '等待領唱提示'}</strong><span>{role === 'leader' ? '點選下方按鈕，提示所有樂手' : '跟隨亮起的提示演奏'}</span></div><div className="cue-grid">{cues.map(({ id, label, en, Icon }, index) => <button key={id} className={`cue ${room.cue === id ? 'lit' : ''}`} aria-pressed={room.cue === id} disabled={role !== 'leader' || busy || !connected} onClick={() => send(id)}><span className="cue-top"><Icon size={30} /><span>0{index + 1}</span></span><strong>{label}</strong><span className="cue-bottom">{en}<i>{room.cue === id ? '● 目前提示' : '○'}</i></span></button>)}</div>{error && <p className="error" role="alert">{error}</p>}<p className="stage-note">{role === 'leader' ? '每次只亮起一個提示，直到你選擇下一個。' : '樂手模式 · 提示會自動更新'}</p></section>}
    <footer><span>同拍 / SONG CUE</span><span>專注音樂，默契同步。</span></footer>
  </main>;
}

