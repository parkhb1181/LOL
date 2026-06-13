'use client'
// §6.3 i18n Context — ko 기본값, localStorage 'lang' 영속
// §13.5 Hydration 방어: 초기 렌더 ko 고정, mount 후 localStorage 반영

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { ko } from './ko'
import { en } from './en'

export type Lang = 'ko' | 'en'
type Dict = typeof ko

type LangContextType = {
  lang: Lang
  t: Dict
  toggleLang: () => void
}

const LangContext = createContext<LangContextType>({
  lang: 'ko',
  t: ko,
  toggleLang: () => {},
})

export function LangProvider({ children }: { children: ReactNode }) {
  // 초기값 ko 고정 — 서버 렌더와 동일 상태 유지 (hydration 방어)
  const [lang, setLang] = useState<Lang>('ko')

  // mount 후 localStorage 반영
  useEffect(() => {
    const stored = localStorage.getItem('lang') as Lang | null
    if (stored === 'ko' || stored === 'en') setLang(stored)
  }, [])

  const toggleLang = () => {
    setLang(prev => {
      const next: Lang = prev === 'ko' ? 'en' : 'ko'
      localStorage.setItem('lang', next)
      return next
    })
  }

  // en/ko 딕셔너리는 동일 구조 — 타입 캐스팅 안전
  const t = (lang === 'ko' ? ko : en) as unknown as Dict

  return (
    <LangContext.Provider value={{ lang, t, toggleLang }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
