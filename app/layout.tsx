import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from './components/Navbar';
import OfflineBanner from './components/OfflineBanner';
import RemoveExtensionAttrs from './components/RemoveExtensionAttrs';
import { LanguageProvider } from './contexts/LanguageContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AgriConsult Hub',
  description: 'Farming content platform with multi-language support',
  manifest: '/manifest.json',
  themeColor: '#22c55e',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <RemoveExtensionAttrs />
        <LanguageProvider>
          <OfflineBanner />
          <Navbar />
          <main className="min-h-screen bg-gray-50">
            {children}
          </main>
        </LanguageProvider>
      </body>
    </html>
  );
}

