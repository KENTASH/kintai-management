"use client";

import { createContext, useContext, useState } from "react";

type Language = "ja" | "en";

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  ja: {
    "app-title": "勤怠管理システム",
    "save": "保存",
    "loading": "読み込み中...",
    "under-construction": "工事中",
    "under-construction-message": "このページは現在開発中です。近日公開予定です。",
    "hours": "時間",
    "days": "日",
    "search": "検索",
    "cancel": "キャンセル",
    "delete": "削除",
    "confirm-delete": "を削除してもよろしいですか？",
    "add-row": "新規行追加",
    "select-all": "全て",
    "holiday-work": "休出",
    "paid-leave": "有給休暇",
    "am-leave": "前休",
    "pm-leave": "後休",
    "special-leave": "特休",
    "compensatory-leave": "振休",
    "compensatory-leave-planned": "振休予定",
    "absence": "欠勤",
    "late": "遅刻",
    "early-leave": "早退",
    "delay": "遅延",
    "shift": "シフト",
    "business-holiday": "休業"
  },
  en: {
    "app-title": "Attendance Management System",
    "save": "Save",
    "loading": "Loading...",
    "under-construction": "Under Construction",
    "under-construction-message": "This page is currently under development. Coming soon.",
    "hours": "hours",
    "days": "days",
    "search": "Search",
    "cancel": "Cancel",
    "delete": "Delete",
    "confirm-delete": "Are you sure you want to delete?",
    "add-row": "Add New Row",
    "select-all": "All",
    "holiday-work": "Holiday Work",
    "paid-leave": "Paid Leave",
    "am-leave": "AM Leave",
    "pm-leave": "PM Leave",
    "special-leave": "Special Leave",
    "compensatory-leave": "Compensatory Leave",
    "compensatory-leave-planned": "Planned Compensatory Leave",
    "absence": "Absence",
    "late": "Late",
    "early-leave": "Early Leave",
    "delay": "Delay",
    "shift": "Shift",
    "business-holiday": "Business Holiday"
  }
} as const;

type TranslationKeys = keyof typeof translations.ja;

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("ja");

  const t = (key: string): string => {
    return (translations[language] as Record<string, string>)[key] || key;
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
