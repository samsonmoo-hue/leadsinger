'use client';
import { useEffect, useState } from 'react';

export default function ScreenAwake() {
  const [status, setStatus] = useState('正在啟用螢幕長亮…');
  const [attempt, setAttempt] = useState(0);
  const [retry, setRetry] = useState(false);
  useEffect(() => {
    if (!('wakeLock' in navigator)) {
      setStatus('此瀏覽器不支援螢幕長亮，請調整手機的自動鎖定設定。');
      return;
    }
    let disposed = false;
    let pending = false;
    let lock: WakeLockSentinel | undefined;
    async function acquire() {
      if (disposed || pending || (lock && !lock.released) || document.visibilityState !== 'visible') return;
      pending = true;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (disposed) { await next.release(); return; }
        lock = next;
        setStatus('螢幕長亮已啟用');
        setRetry(false);
        next.addEventListener('release', () => {
          if (disposed || lock !== next) return;
          lock = undefined;
          setStatus('螢幕長亮已暫停');
          setRetry(true);
        });
      } catch {
        if (!disposed) {
          setStatus('未能啟用螢幕長亮，請檢查省電模式或自動鎖定設定。');
          setRetry(true);
        }
      } finally { pending = false; }
    }
    const onVisible = () => { void acquire(); };
    document.addEventListener('visibilitychange', onVisible);
    void acquire();
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => {});
    };
  }, [attempt]);
  return <div className="stage-note screen-awake"><span role="status">{status}</span>{retry && <> <button type="button" className="secondary" onClick={() => setAttempt(value => value + 1)}>重新啟用</button></>}</div>;
}
