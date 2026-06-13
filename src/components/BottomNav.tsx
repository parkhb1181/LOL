// 모바일 하단 탭바 — COLLECTION / DRAFT (모바일 전용, md:hidden)
import Link from 'next/link'

type Props = {
  activePage?: 'collection' | 'draft'
}

function CollectionIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="3" width="8" height="7" rx="1"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth={active ? 0 : 1.5}
      />
      <rect x="13" y="3" width="8" height="7" rx="1"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth={active ? 0 : 1.5}
      />
      <rect x="3" y="13" width="8" height="7" rx="1"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth={active ? 0 : 1.5}
      />
      <rect x="13" y="13" width="8" height="7" rx="1"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth={active ? 0 : 1.5}
      />
    </svg>
  )
}

function DraftIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="7" width="20" height="13" rx="3"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth={active ? 0 : 1.5}
      />
      {/* 왼쪽 D-패드 */}
      <path d="M8 11v4M6 13h4"
        stroke={active ? '#14141c' : 'currentColor'}
        strokeWidth="1.5" strokeLinecap="round"
      />
      {/* 오른쪽 버튼 */}
      <circle cx="15" cy="12" r="1"
        fill={active ? '#14141c' : 'currentColor'}
      />
      <circle cx="17.5" cy="14" r="1"
        fill={active ? '#14141c' : 'currentColor'}
      />
    </svg>
  )
}

export default function BottomNav({ activePage }: Props) {
  const active  = 'text-secondary'
  const idle    = 'text-on-surface-variant hover:text-secondary'

  return (
    <nav
      className="fixed bottom-0 left-0 w-full z-50 bg-surface-container-lowest/70 backdrop-blur-md border-t border-outline-variant/20 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-16">
        <Link
          href="/dex"
          className={`flex flex-col items-center justify-center w-full gap-1 transition-colors ${activePage === 'collection' ? active : idle}`}
        >
          <CollectionIcon active={activePage === 'collection'} />
          <span className="font-label-caps text-[10px] uppercase tracking-wider">COLLECTION</span>
        </Link>
        <Link
          href="/draft"
          className={`flex flex-col items-center justify-center w-full gap-1 transition-colors ${activePage === 'draft' ? active : idle}`}
        >
          <DraftIcon active={activePage === 'draft'} />
          <span className="font-label-caps text-[10px] uppercase tracking-wider">DRAFT</span>
        </Link>
      </div>
    </nav>
  )
}
