// app/layout.tsx
"use client";

import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from "@/components/theme-provider";
import { MainLayout } from "@/components/layout/main-layout";
import { I18nProvider } from "@/lib/i18n/context";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ['latin'] });

// metadataはサーバーコンポーネントで定義する必要があるため、ここでは削除
// もしmetadataを設定したい場合は、このファイルをサーバーコンポーネントに変更してください

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={inter.className}>
        <I18nProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <MainLayout>{children}</MainLayout>
            <Toaster />
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}