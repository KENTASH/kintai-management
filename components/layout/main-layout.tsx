"use client"

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { SideNav } from './side-nav'
import { Header } from './header'

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [loginDate, setLoginDate] = useState('')
  const [isSidebarOpen, setSidebarOpen] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  const pathname = usePathname()
  const isLoginPage = pathname === "/"

  useEffect(() => {
    setIsMounted(true)
    setLoginDate(new Date().toLocaleString('ja-JP'))
  }, [])

  // クライアントサイドでのレンダリングが準備できるまで何も表示しない
  if (!isMounted) {
    return null
  }

  if (isLoginPage) {
    return <div className="min-h-screen bg-blue-50 dark:bg-blue-950">{children}</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <Header toggleSideNav={() => setSidebarOpen(!isSidebarOpen)} />
      
      <div className="flex pt-16">
        <div className="fixed left-0 top-16 bottom-8 z-[150]">
          <SideNav isOpen={isSidebarOpen} onToggle={() => setSidebarOpen(!isSidebarOpen)} />
        </div>
        <div className={`flex-1 transition-all duration-200 ease-in-out ${isSidebarOpen ? 'ml-72' : 'ml-16'}`}>
          <main className="h-[calc(100vh-6rem)] overflow-y-auto p-8 bg-blue-50 dark:bg-blue-950 custom-scrollbar relative z-[1]">
            {children}
          </main>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 z-[200] border-t py-1.5 bg-gradient-to-r from-blue-900 via-blue-600 to-blue-400">
        <div className="flex justify-between items-center px-4">
          <div className="text-xs text-gray-200">© NISZ HAMAMATSU 2025</div>
          <div className="text-xs text-gray-200">{loginDate}</div>
        </div>
      </footer>
    </div>
  )
}