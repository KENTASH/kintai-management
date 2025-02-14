"use client";
import React from "react";
import { createContext, useContext, useState, ReactNode } from "react";
import { translations } from "./translations";

type Language = "ja" | "en";

type TranslationKeys = keyof typeof translations.ja;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKeys) => string;
}

const defaultValues: I18nContextType = {
  language: "ja",
  setLanguage: () => {}, // 空の関数を設定
  t: (key: TranslationKeys) => translations["ja"][key] || key,
};

const I18nContext = createContext<I18nContextType>(defaultValues);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("ja");

  const t = (key: TranslationKeys): string => {
    return translations[language][key] || key;
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
