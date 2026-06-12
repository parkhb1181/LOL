'use client'
// English-only — i18n 제거, ko 토글 삭제
import { en } from './en'

export function useLang() {
  return { t: en }
}

// Passthrough — layout.tsx import 호환용
export function LangProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
