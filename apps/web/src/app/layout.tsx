import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { AppHeader } from '@/components/shell/header';

export const metadata: Metadata = {
  title: 'FieldOps — Field Force & Task Management',
  description: 'Operations, dispatch, visit verification, and workforce management platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <AppHeader />
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
