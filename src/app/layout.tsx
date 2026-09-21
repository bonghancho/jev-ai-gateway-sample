import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Support Ticket Triage - Jev AI Gateway',
  description: 'TypeSafe AI Jev evaluation via Vercel AI Gateway',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
