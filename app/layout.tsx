import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '領唱提示', description: '領唱編排歌單，樂手加入一次，同步切歌與演奏提示。' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
