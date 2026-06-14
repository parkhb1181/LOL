import type { Metadata } from 'next';
import BattleArena from '@/components/battle/BattleArena';

export const metadata: Metadata = {
  title: 'Ball Battle — GRANDSLAM',
  robots: { index: false, follow: false },
};

export default function BattlePage() {
  return (
    <main className="min-h-screen bg-[#0d0d1a] flex flex-col items-center justify-center py-10 px-4">
      <h1 className="text-2xl font-bold text-white mb-8 tracking-widest">BALL BATTLE</h1>
      <BattleArena />
    </main>
  );
}
