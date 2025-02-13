export const translations = {
  ja: {
    // ... 既存の翻訳
    "employee-id": "社員番号",
    "department": "部署",
    "last-name": "姓",
    "first-name": "名",
    "last-name-en": "姓（英語）",
    "first-name-en": "名（英語）",
    "email": "メールアドレス",
    "leader": "担当リーダー",
    "sub-leader": "担当サブリーダー",
    "leader-permission": "リーダー権限",
    "admin-permission": "管理者権限",
    "member-status": "メンバーステータス",
    "member-actions": "アクション",
    "disable": "無効化",
    "invite": "招待",
    'select-branch': '部署を選択',
    'clear': 'クリア'
  },
  en: {
    // ... 既存の翻訳
    "employee-id": "Employee ID",
    "department": "Department",
    "last-name": "Last Name",
    "first-name": "First Name",
    "last-name-en": "Last Name (English)",
    "first-name-en": "First Name (English)",
    "email": "Email",
    "leader": "Leader",
    "sub-leader": "Sub Leader",
    "leader-permission": "Leader Permission",
    "admin-permission": "Admin Permission",
    "member-status": "Member Status",
    "member-actions": "Actions",
    "disable": "Disable",
    "invite": "Invite",
    'select-branch': 'Select Branch',
    'clear': 'Clear'
  }
} as const;

// 型定義を拡張
declare module '@/lib/i18n/context' {
  interface I18nTranslations {
    'select-branch': string
    'member-status': string
    'member-actions': string
    'clear': string
  }
} 