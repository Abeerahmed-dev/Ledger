import React from 'react';
import './globals.css';
import { AppShell } from './components/AppShell';

export const viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata = {
  title: 'Textile Micro-ERP',
  description: 'Karachi Textile Business Operations & Financial Ledger Engine',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TextileERP',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex font-sans antialiased pb-16 md:pb-0">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
