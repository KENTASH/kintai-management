"use client"

import { createContext, useContext, useState } from "react"

type Language = "ja" | "en"

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKeys) => string
}

const translations = {
  ja: {
    // App Title
    "app-title": "勤怠管理システム",
    
    // Common
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
    
    // Navigation
    "dashboard": "ダッシュボード",
    "dashboard-description": "勤怠状況の概要と重要な通知を確認できます。",
    "attendance-and-expenses": "勤怠入力・経費請求",
    "attendance-and-expenses-description": "日々の勤怠情報と経費を登録します",
    "leave": "休暇申請",
    "leave-description": "休暇の申請と取得状況を管理します",
    "overtime": "残業申請",
    "overtime-description": "残業の事前申請と実績を登録します",
    "notifications": "お知らせ",
    "notifications-description": "システムからの通知を確認します",
    "settings": "設定",
    "settings-description": "システムの設定ができます",
    
    // Admin Menu
    "admin-menu": "管理者メニュー",
    "approve-attendance": "勤怠承認",
    "approve-attendance-description": "メンバーの勤怠情報を承認します",
    "approve-leave": "休暇承認",
    "approve-leave-description": "メンバーの休暇申請を承認します",
    "approve-overtime": "残業承認",
    "approve-overtime-description": "メンバーの残業申請を承認します",
    "members": "メンバー管理",
    "members-description": "チームメンバーの情報を管理します",
    "holidays": "休日マスタ設定",
    "holidays-description": "休日カレンダーを設定します",
    
    // Settings
    "theme-settings": "テーマ設定",
    "theme-settings-description": "システムの表示テーマを切り替えることができます",
    "light-mode": "ライトモード",
    "dark-mode": "ダークモード",
    "language-settings": "言語設定",
    "language-settings-description": "システムの表示言語を切り替えることができます",
    "user-info": "ユーザー情報",
    "user-info-description": "ユーザー情報を編集できます",
    
    // User Form
    "employee-id": "社員番号",
    "last-name": "姓",
    "first-name": "名",
    "last-name-en": "姓（英語）",
    "first-name-en": "名（英語）",
    "email": "メール",
    "department": "所属",
    "select-department": "所属を選択してください",
    
    // Validation
    "required-last-name-en": "姓（英語）を入力してください",
    "required-first-name-en": "名（英語）を入力してください",
    "required-department": "所属を選択してください",

    // Dashboard
    "monthly-working-hours": "今月の勤務時間",
    "remaining-paid-leave": "残り有給休暇",
    "monthly-overtime": "今月の残業時間",
    "target": "目標",
    "annual-grant": "今年度付与",
    "limit": "上限",
    "team-status": "チームメンバーの状況",
    "team-status-description": "本日の出勤・休暇状況",
    "new-year-holiday-notice": "年末年始の休暇について",
    "health-checkup-notice": "健康診断の実施について",
    "member-name-1": "山田 花子",
    "member-name-2": "鈴木 一郎",
    "working": "出勤中",
    "on-leave": "休暇",
    "checked-in": "出勤",
    "paid-leave": "有給休暇",

    // Attendance
    "date": "日付",
    "start-time": "開始時間",
    "end-time": "終了時間",
    "break-time": "休憩時間",
    "actual-time": "実働時間",
    "attendance-type": "勤務区分",
    "remarks": "備考",
    "remarks-placeholder": "備考を入力...",
    "name": "氏名",
    "workplace": "作業場所",
    "enter-workplace": "作業場所を入力...",
    "regular-work": "通常",
    "full-leave": "全休",
    "half-leave": "半休",
    "late": "遅刻",
    "early-leave": "早退",
    "absence": "欠勤",
    "special-leave": "特休",
    "holiday-work": "休出",
    "compensatory-leave": "代休",
    "compensatory-leave-planned": "代休予定",
    "late-early-hours": "遅刻早退(h)",
    "late-early-days": "遅刻早退日数",

    // Attendance Summary
    "total-work-days": "総勤務日数",
    "regular-work-days": "通常出勤",
    "holiday-work-days": "休日出勤",
    "absence-days": "欠勤日数",
    "total-work-time": "総実働時間",
    "paid-leave-days": "有給日数",
    "days-suffix": "日",
    "times-suffix": "回",

    // Avatar Menu
    "avatar-settings": "アイコン設定",
    "select-avatar": "使用したいアイコンを選択してください",
    "name-label": "氏名：",
    "employee-id-label": "社員番号：",
    "department-label": "所属：",
    "logout": "ログアウト",

    // Holiday Settings
    "holiday-settings": "休日マスタ設定",
    "holiday-settings-description": "会社指定の休日を設定します。",
    "holiday-list": "休日一覧",
    "delete-holiday": "休日の削除",
    "year": "年",
    "year-suffix": "年",
    "select-year": "年を選択",
    "enter-remarks": "備考を入力...",

    // Notifications Management
    "notifications-management": "お知らせ編集",
    "notifications-management-description": "ダッシュボードに表示するお知らせを管理します。",
    "notification-list": "お知らせ一覧",
    "notification-title": "タイトル",
    "notification-content": "内容",
    "publish-date": "公開日",
    "expiry-date": "終了日",
    "published": "公開",
    "delete-notification": "お知らせの削除",
    "enter-notification-title": "タイトルを入力...",
    "enter-notification-content": "内容を入力...",

    // Attendance Types
    "Attendance-Types-holiday-work": "休出",
    "Attendance-Types-paid-leave": "有休",
    "am-leave": "前休",
    "pm-leave": "後休",
    "Attendance-Types-special-leave": "特休",
    "Attendance-Types-compensatory-leave": "振休",
    "Attendance-Types-compensatory-leave-planned": "振予",
    "Attendance-Types-absence": "欠勤",
    "Attendance-Types-late": "遅刻",
    "Attendance-Types-early-leave": "早退",
    "delay": "遅延",
    "shift": "シフト",
    "business-holiday": "休業",

    // Member Management
    "member-management": "メンバー管理",
    "member-management-description": "システムユーザーのアカウント情報を管理します。",
    "member-list": "メンバー一覧",
    "delete-member": "メンバーの削除",
    "select-leader": "リーダーを選択",
    "select-sub-leader": "サブリーダーを選択",
    "select-member": "メンバーを選択してください",
    "select": "選択",
    "no-members-found": "メンバーが見つかりません",
    "enter-employee-id": "例：1234",
    "enter-name": "例：山田 太郎",
    "last-name-ja": "姓",
    "first-name-ja": "名",
    "member-management-last-name-en": "姓（英語）",
    "member-management-first-name-en": "名（英語）",
    "leader": "リーダー",
    "sub-leader": "サブリーダー",
    "is-leader": "リーダー権限",
    "is-admin": "管理者権限",
    "add-member": "メンバーを追加",
    "confirm-delete-member": "このメンバーを削除してもよろしいですか？",
    "search-placeholder": "検索...",
    "filter-by-department": "所属で絞り込み",

    // Member Management Additional Keys
    "members-list": "メンバー一覧",
    "leader-permission": "リーダー権限",
    "admin-permission": "管理者権限",
    "member-info": "メンバー情報",
    "member-info-description": "メンバー情報を編集します",
    "member-list-description": "システムユーザーの一覧を表示します",
    "member-search": "メンバー検索",
    "member-search-description": "メンバーを検索します",

    // Form Validation Messages
    "required-field": "この項目は必須です",
    "invalid-email": "有効なメールアドレスを入力してください",
    "last-name-en-required": "姓（英語）は必須です",
    "first-name-en-required": "名（英語）は必須です",
    "department-required": "所属を選択してください",
    "employee-id-required": "社員番号は必須です",
    "name-required": "氏名は必須です",
  },
  en: {
    // App Title
    "app-title": "Attendance Management System",
    
    // Common
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
    
    // Navigation
    "dashboard": "Dashboard",
    "dashboard-description": "View attendance status overview and important notifications",
    "attendance-and-expenses": "Attendance & Expenses",
    "attendance-and-expenses-description": "Record daily attendance and expenses",
    "leave": "Leave Request",
    "leave-description": "Manage leave requests and status",
    "overtime": "Overtime Request",
    "overtime-description": "Submit and manage overtime requests",
    "notifications": "Notifications",
    "notifications-description": "Check system notifications",
    "settings": "Settings",
    "settings-description": "Configure system settings",
    
    // Admin Menu
    "admin-menu": "Admin Menu",
    "approve-attendance": "Approve Attendance",
    "approve-attendance-description": "Approve team members' attendance",
    "approve-leave": "Approve Leave",
    "approve-leave-description": "Approve team members' leave requests",
    "approve-overtime": "Approve Overtime",
    "approve-overtime-description": "Approve team members' overtime requests",
    "members": "Member Management",
    "members-description": "Manage team members",
    "holidays": "Holiday Settings",
    "holidays-description": "Configure holiday calendar",
    
    // Settings
    "theme-settings": "Theme Settings",
    "theme-settings-description": "Switch between light and dark themes",
    "light-mode": "Light Mode",
    "dark-mode": "Dark Mode",
    "language-settings": "Language Settings",
    "language-settings-description": "Change the display language",
    "user-info": "User Information",
    "user-info-description": "Edit user information",
    
    // User Form
    "employee-id": "Employee ID",
    "last-name": "Last Name",
    "first-name": "First Name",
    "last-name-en": "Last Name (English)",
    "first-name-en": "First Name (English)",
    "email": "Email",
    "department": "Department",
    "select-department": "Select department",
    
    // Validation
    "required-last-name-en": "Please enter your last name in English",
    "required-first-name-en": "Please enter your first name in English",
    "required-department": "Please select your department",

    // Dashboard
    "monthly-working-hours": "Monthly Working Hours",
    "remaining-paid-leave": "Remaining Paid Leave",
    "monthly-overtime": "Monthly Overtime",
    "target": "Target",
    "annual-grant": "Annual Grant",
    "limit": "Limit",
    "team-status": "Team Status",
    "team-status-description": "Today's attendance and leave status",
    "new-year-holiday-notice": "New Year Holiday Schedule",
    "health-checkup-notice": "Health Checkup Information",
    "member-name-1": "Hanako Yamada",
    "member-name-2": "Ichiro Suzuki",
    "working": "Working",
    "on-leave": "On Leave",
    "checked-in": "checked in",
    "paid-leave": "Paid Leave",

    // Attendance
    "date": "Date",
    "start-time": "Start Time",
    "end-time": "End Time",
    "break-time": "Break Time",
    "actual-time": "Actual Time",
    "attendance-type": "Type",
    "remarks": "Remarks",
    "remarks-placeholder": "Enter remarks...",
    "name": "Name",
    "workplace": "Workplace",
    "enter-workplace": "Enter workplace...",
    "regular-work": "Regular",
    "full-leave": "Full Day Leave",
    "half-leave": "Half Day Leave",
    "late": "Late",
    "early-leave": "Early Leave",
    "absence": "Absence",
    "special-leave": "Special Leave",
    "holiday-work": "Holiday Work",
    "compensatory-leave": "Compensatory Leave",
    "compensatory-leave-planned": "Planned Compensatory Leave",
    "late-early-hours": "Late/Early Hours",
    "late-early-days": "Late/Early Leave Days",

    // Member Management
    "member-management": "Member Management",
    "member-management-description": "Manage user account information for system users.",
    "member-list": "Member List",
    "delete-member": "Delete Member",
    "select-leader": "Select Leader",
    "select-sub-leader": "Select Sub-Leader",
    "select-member": "Please select a member",
    "select": "Select",
    "no-members-found": "No members found",
    "enter-employee-id": "e.g., 1234",
    "enter-name": "e.g., John Smith",
    "last-name-ja": "Last Name",
    "first-name-ja": "First Name",
    "member-management-last-name-en": "Last Name (EN)",
    "member-management-first-name-en": "First Name (EN)",
    "leader": "Leader",
    "sub-leader": "Sub-Leader",
    "is-leader": "Leader Authority",
    "is-admin": "Admin Authority",
    "add-member": "Add Member",
    "member-management-delete-member": "Delete Member",
    "confirm-delete-member": "Are you sure you want to delete this member?",
    "search-placeholder": "Search...",
    "filter-by-department": "Filter by Department",

    // Member Management Additional Keys
    "members-list": "Member List",
    "leader-permission": "Leader Permission",
    "admin-permission": "Admin Permission",
    "member-info": "Member Information",
    "member-info-description": "Edit member information",
    "member-list-description": "Display system user list",
    "member-search": "Member Search",
    "member-search-description": "Search for members",

    // Attendance Summary
    "total-work-days": "Total Work Days",
    "regular-work-days": "Regular Work Days",
    "holiday-work-days": "Holiday Work Days",
    "absence-days": "Absence Days",
    "total-work-time": "Total Work Time",
    "paid-leave-days": "Paid Leave Days",
    "days-suffix": "days",
    "times-suffix": "times",

    // Avatar Menu
    "avatar-settings": "Avatar Settings",
    "select-avatar": "Please select your avatar",
    "name-label": "Name:",
    "employee-id-label": "Employee ID:",
    "department-label": "Department:",
    "logout": "Logout",

    // Holiday Settings
    "holiday-settings": "Holiday Settings",
    "holiday-settings-description": "Configure company holidays.",
    "holiday-list": "Holiday List",
    "delete-holiday": "Delete Holiday",
    "year": "Year",
    "year-suffix": "",
    "select-year": "Select year",
    "enter-remarks": "Enter remarks...",

    // Notifications Management
    "notifications-management": "Notifications Management",
    "notifications-management-description": "Manage notifications displayed on the dashboard.",
    "notification-list": "Notification List",
    "notification-title": "Title",
    "notification-content": "Content",
    "publish-date": "Publish Date",
    "expiry-date": "Expiry Date",
    "published": "Published",
    "delete-notification": "Delete Notification",
    "enter-notification-title": "Enter title...",
    "enter-notification-content": "Enter content...",

    // Attendance Types
    "Attendance-Types-holiday-work": "Holiday Work",
    "Attendance-Types-paid-leave": "Paid Leave",
    "am-leave": "AM Leave",
    "pm-leave": "PM Leave", 
    "Attendance-Types-special-leave": "Special Leave",
    "Attendance-Types-compensatory-leave": "Compensatory Leave",
    "Attendance-Types-compensatory-leave-planned": "Planned Compensatory",
    "Attendance-Types-absence": "Absence",
    "Attendance-Types-late": "Late",
    "Attendance-Types-early-leave": "Early Leave",
    "delay": "Delay",
    "shift": "Shift",
    "business-holiday": "Business Holiday",

    // Form Validation Messages
    "required-field": "This field is required",
    "invalid-email": "Please enter a valid email address",
    "last-name-en-required": "Last name (English) is required",
    "first-name-en-required": "First name (English) is required",
    "department-required": "Please select your department",
    "employee-id-required": "Employee ID is required",
    "name-required": "Name is required",
  }
} as const

type TranslationKeys = keyof typeof translations.ja;

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const defaultLanguage: Language = typeof navigator !== "undefined" && navigator.language.startsWith("ja") ? "ja" : "en";
  const [language, setLanguage] = useState<Language>(defaultLanguage);
  const t = (key: TranslationKeys): string => {
    return translations[language][key] ?? key;
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