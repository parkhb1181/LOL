import type { Metadata } from 'next';
import BattleClient from '@/components/battle/BattleClient';

export const metadata: Metadata = {
  title: 'Ball Battle — GRANDSLAM',
  robots: { index: false, follow: false },
};

export default function BattlePage() {
  return (
    <main className="min-h-screen bg-[#0d0d1a] flex flex-col items-center py-10 px-4">
      <h1 className="text-2xl font-bold text-white mb-8 tracking-widest">BALL BATTLE</h1>
      <BattleClient />
    </main>
  );
}
