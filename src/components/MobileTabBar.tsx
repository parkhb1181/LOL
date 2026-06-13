// 모바일 하단 탭바 — COLLECTION/DRAFT 공유 컴포넌트 (md:hidden)
import Link from 'next/link'

type Props = { activePage?: 'collection' | 'draft' }

const CollectionIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="7" height="18" rx="1" />
    <rect x="9.5" y="5" width="5" height="16" rx="1" />
    <rect x="15.5" y="7" width="6.5" height="14" rx="1" />
  </svg>
)

const DraftIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="3" />
    <path d="M8 10v4M6 12h4" />
    <circle cx="16" cy="11" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)

export default function MobileTabBar({ activePage }: Props) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 w-full z-50 bg-surface-container-lowest/90 backdrop-blur-md border-t border-outline-variant/30"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-16">
        <Link
          href="/dex"
          className={`flex flex-col items-center justify-center flex-1 gap-1 transition-colors ${
            activePage === 'collection' ? 'text-secondary' : 'text-on-surface-variant hover:text-secondary'
          }`}
        >
          <CollectionIcon />
          <span className="font-label-caps text-[10px] uppercase">Collection</span>
        </Link>
        <Link
          href="/draft"
          className={`flex flex-col items-center justify-center flex-1 gap-1 transition-colors ${
            activePage === 'draft' ? 'text-secondary' : 'text-on-surface-variant hover:text-secondary'
          }`}
        >
          <DraftIcon />
          <span className="font-label-caps text-[10px] uppercase">Draft</span>
        </Link>
      </div>
    </nav>
  )
}
