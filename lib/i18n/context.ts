import { createContext, useContext } from 'react'

interface I18nContextType {
  language: string
  setLanguage: (lang: string) => void
  t: (key: string) => string
}

export const I18nContext = createContext<I18nContextType | null>(null)

export const useI18n = () => {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}

// 既存の型定義を拡張
declare module '@/lib/i18n/context' {
  interface I18nTranslations {
    'select-branch': string
    'member-status': string
    'member-actions': string
    'clear': string
    // 他の必要な翻訳キー
  }
} 