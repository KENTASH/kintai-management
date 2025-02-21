"use client";
import { createContext, useContext, useState, ReactNode } from "react";
import { translations } from "./translations";

type Language = "ja" | "en";

// TranslationKeysをexportして外部から使用可能に
export type TranslationKeys = keyof typeof translations.ja;
type TranslationValues = typeof translations.ja;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKeys, params?: Record<string, number | string>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("ja");

  const t = (key: TranslationKeys, params?: Record<string, number | string>): string => {
    const baseText = translations[language][key] as string;
    
    if (params) {
      return Object.entries(params).reduce(
        (text, [paramKey, value]) => text.replace(`{${paramKey}}`, String(value)),
        baseText
      );
    }
    
    return baseText;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
