'use client';
import { useRef, useState } from 'react';
import { GripVertical, ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react';
import type { Song } from '../lib/realtime';
export default function SongEditor({ songs, onChange, disabled }: { songs: Song[]; onChange: (songs: Song[]) => void; disabled: boolean }) {
  const [name, setName] = useState('');
  const [over, setOver] = useState<number | null>(null);
  const drag = useRef<{ from: number; to: number } | null>(null);
  function move(from: number, to: number) {
    if (disabled || from === to || to < 0 || to >= songs.length) return;
    const next = [...songs]; const [song] = next.splice(from, 1); next.splice(to, 0, song); onChange(next);
  }
  function add() {
    if (disabled || !name.trim()) return;
    onChange([...songs, { id: crypto.randomUUID(), name: name.trim() }]); setName('');
  }
  return <>
    <form className="add-song" onSubmit={event => { event.preventDefault(); add(); }}>
      <label htmlFor="song-name">詩歌名稱</label><div><input id="song-name" value={name} onChange={event => setName(event.target.value)} placeholder="輸入歌名" maxLength={80} disabled={disabled} /><button className="secondary" disabled={disabled || !name.trim()}><Plus size={18} />增加一首歌</button></div>
    </form>
    <p className="form-note">拖曳左側把手調整順序，也可使用上下箭頭。共 {songs.length} 首</p>
    <ol className="song-list">{songs.map((song, index) => <li key={song.id} data-song-index={index} className={over === index ? 'drag-over' : ''}>
      <button className="drag-handle icon-button" type="button" aria-label={`拖曳排序：${song.name}`} disabled={disabled}
        onPointerDown={event => { if (event.button !== 0) return; drag.current = { from: index, to: index }; setOver(index); event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { if (!drag.current) return; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-song-index]'); if (target) { drag.current.to = Number(target.getAttribute('data-song-index')); setOver(drag.current.to); } if (event.clientY < 80) window.scrollBy(0, -14); else if (event.clientY > window.innerHeight - 80) window.scrollBy(0, 14); }}
        onPointerUp={() => { if (drag.current) move(drag.current.from, drag.current.to); drag.current = null; setOver(null); }}
        onPointerCancel={() => { drag.current = null; setOver(null); }}
        onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); move(index, index + (event.key === 'ArrowUp' ? -1 : 1)); } }}><GripVertical size={20} /></button>
      <span className="song-number">{index + 1}</span><span className="song-name">{song.name}</span>
      <div className="song-actions"><button type="button" className="icon-button" aria-label={`上移：${song.name}`} disabled={disabled || index === 0} onClick={() => move(index, index - 1)}><ArrowUp size={17} /></button><button type="button" className="icon-button" aria-label={`下移：${song.name}`} disabled={disabled || index === songs.length - 1} onClick={() => move(index, index + 1)}><ArrowDown size={17} /></button><button type="button" className="icon-button delete-song" aria-label={`刪除詩歌：${song.name}`} disabled={disabled} onClick={() => onChange(songs.filter(item => item.id !== song.id))}><Trash2 size={17} /></button></div>
    </li>)}</ol>
    {!songs.length && <p className="empty-songs">先新增第一首詩歌，再確認進入房間。</p>}
  </>;
}
