import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '同拍｜領唱提示', description: '建立歌曲房間，讓領唱與樂手同步看見下一個提示。' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
