import type { Metadata } from 'next';
import DraftDuel from './DraftDuel';

export const metadata: Metadata = {
  title: 'Draft Duel | Pretzel Quest',
  description: 'Draft an all-era fantasy roster against the computer. 32 franchises. Nine picks. Every player at their best.',
};
export default function DraftDuelPage() { return <DraftDuel />; }
