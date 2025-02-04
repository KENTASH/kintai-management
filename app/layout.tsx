import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from "@/components/theme-provider";
import { MainLayout } from "@/components/layout/main-layout";
import { I18nProvider } from "@/lib/i18n/context";

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '勤怠管理システム',
  description: 'NIS Attendance Management System',
};

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
            <MainLayout>
              {children}
            </MainLayout>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}