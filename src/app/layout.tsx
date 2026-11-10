import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Supplier Recall — decisions with a memory',
  description: 'Discover suppliers, compare quotes, and learn from every order.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
