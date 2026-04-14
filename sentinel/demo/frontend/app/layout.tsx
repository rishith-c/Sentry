import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SENTINEL — Incident Command',
  description: 'Real-time emergency operations command interface',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full overflow-hidden">
      <body className="h-full overflow-hidden" style={{ background: '#050507', color: '#e2e8f0', margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
