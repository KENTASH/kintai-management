// app/layout.tsx
import './globals.css';
import { Inter } from 'next/font/google';
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/lib/i18n/context";
import { Toaster } from "@/components/ui/toaster";
import type { Metadata } from 'next';
import { AuthLayout } from "@/components/layout/auth-layout";

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '勤怠管理システム',
  description: '勤怠管理システム',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider>
            <AuthLayout>
              {children}
              <Toaster />
            </AuthLayout>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
