export type BoxNumber = 1 | 2 | 3 | 4 | 5;

export interface LeitnerBoxMeta {
  box: BoxNumber;
  title: string;
  shortLabel: string;
  intervalDays: number;
  intervalText: string;
  description: string;
  accentHex: string;
}

export interface Flashcard {
  id: string;
  deck: string;
  front: string;
  back: string;
  phoneticOrHint?: string;
  example?: string;
  box: BoxNumber;
  nextReviewAt: number; // timestamp in ms
  lastReviewedAt: number | null;
  passCount: number;
  failCount: number;
  streak: number;
  createdAt: number;
}

export interface ReviewLogEntry {
  id: string;
  cardId: string;
  cardFront: string;
  outcome: 'pass' | 'fail';
  previousBox: BoxNumber;
  newBox: BoxNumber;
  timestamp: number;
}

export const DAY_MS = 86_400_000;

export const LEITNER_BOXES: Record<BoxNumber, LeitnerBoxMeta> = {
  1: {
    box: 1,
    title: 'Box 1 · Immediate Recall',
    shortLabel: 'Box 1',
    intervalDays: 1,
    intervalText: 'Every 1 Day',
    description: 'New cards and items that recently missed recall',
    accentHex: '#F43F5E', // Coral Rose
  },
  2: {
    box: 2,
    title: 'Box 2 · Short-Term Encoding',
    shortLabel: 'Box 2',
    intervalDays: 2,
    intervalText: 'Every 2 Days',
    description: 'First successful recall milestone',
    accentHex: '#8B5CF6', // Electric Violet
  },
  3: {
    box: 3,
    title: 'Box 3 · Synaptic Stabilization',
    shortLabel: 'Box 3',
    intervalDays: 4,
    intervalText: 'Every 4 Days',
    description: 'Surviving the initial forgetting curve',
    accentHex: '#38BDF8', // Sky Cyan
  },
  4: {
    box: 4,
    title: 'Box 4 · Deep Consolidation',
    shortLabel: 'Box 4',
    intervalDays: 8,
    intervalText: 'Every 8 Days',
    description: 'High durability retrieval strength',
    accentHex: '#F59E0B', // Amber Gold
  },
  5: {
    box: 5,
    title: 'Box 5 · Long-Term Mastery',
    shortLabel: 'Box 5',
    intervalDays: 16,
    intervalText: 'Every 16 Days',
    description: 'Mastered knowledge in permanent memory',
    accentHex: '#10B981', // Cyber Emerald
  },
};

const RTL_CHAR_REGEX = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
const LTR_CHAR_REGEX = /[A-Za-z\u00C0-\u024F]/;

/**
 * Automatically detects whether text should be rendered RTL (Persian/Farsi, Arabic, Hebrew)
 * or LTR (English, Latin) by inspecting directional characters.
 */
export function detectTextDirection(text: string): 'rtl' | 'ltr' {
  if (!text || typeof text !== 'string') return 'ltr';
  const trimmed = text.trim();
  if (!trimmed) return 'ltr';

  let rtlCount = 0;
  let ltrCount = 0;
  let firstStrong: 'rtl' | 'ltr' | null = null;

  for (const char of trimmed) {
    if (RTL_CHAR_REGEX.test(char)) {
      rtlCount++;
      if (!firstStrong) firstStrong = 'rtl';
    } else if (LTR_CHAR_REGEX.test(char)) {
      ltrCount++;
      if (!firstStrong) firstStrong = 'ltr';
    }
  }

  if (rtlCount === 0 && ltrCount === 0) return 'ltr';
  if (rtlCount > ltrCount) return 'rtl';
  if (ltrCount > rtlCount) return 'ltr';
  return firstStrong ?? 'ltr';
}

/**
 * Applies standard Leitner 5-Box transition rules:
 * - 'pass' (Swipe Right): advances card by +1 box (capped at Box 5) and sets nextReviewAt = now + intervalDays.
 * - 'fail' (Swipe Left): demotes card directly back to Box 1 and marks it due for immediate re-consolidation.
 */
export function processCardReview(
  card: Flashcard,
  outcome: 'pass' | 'fail',
  nowMs: number = Date.now()
): Flashcard {
  if (outcome === 'pass') {
    const nextBox = Math.min(5, card.box + 1) as BoxNumber;
    const intervalMs = LEITNER_BOXES[nextBox].intervalDays * DAY_MS;
    return {
      ...card,
      box: nextBox,
      lastReviewedAt: nowMs,
      nextReviewAt: nowMs + intervalMs,
      passCount: card.passCount + 1,
      streak: card.streak + 1,
    };
  } else {
    return {
      ...card,
      box: 1,
      lastReviewedAt: nowMs,
      nextReviewAt: nowMs, // Immediately due in Box 1
      failCount: card.failCount + 1,
      streak: 0,
    };
  }
}

/**
 * Returns cards eligible for study, ordered by lowest box first, then earliest due timestamp.
 */
export function getDueCards(
  cards: Flashcard[],
  nowMs: number = Date.now(),
  filterBox: BoxNumber | null = null,
  filterDeck: string | null = null,
  includeFutureIfEmpty: boolean = false
): Flashcard[] {
  const filtered = cards.filter((c) => {
    if (filterBox !== null && c.box !== filterBox) return false;
    if (filterDeck !== null && filterDeck !== 'All Decks' && c.deck !== filterDeck) return false;
    return true;
  });

  const due = filtered.filter((c) => c.nextReviewAt <= nowMs);
  const pool = due.length > 0 || !includeFutureIfEmpty ? due : filtered;

  return [...pool].sort((a, b) => {
    if (a.box !== b.box) return a.box - b.box;
    return a.nextReviewAt - b.nextReviewAt;
  });
}

export interface LeitnerAnalytics {
  totalCards: number;
  dueNowCount: number;
  masteredCount: number; // Box 4 & 5
  masteryPercentage: number;
  accuracyPercentage: number;
  boxCounts: Record<BoxNumber, number>;
  boxDueCounts: Record<BoxNumber, number>;
  retentionCurve: { day: number; withoutLeitner: number; withLeitner: number }[];
}

export function calculateLeitnerStats(
  cards: Flashcard[],
  nowMs: number = Date.now()
): LeitnerAnalytics {
  const boxCounts: Record<BoxNumber, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const boxDueCounts: Record<BoxNumber, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  let totalPass = 0;
  let totalFail = 0;
  let dueNowCount = 0;

  for (const c of cards) {
    boxCounts[c.box] = (boxCounts[c.box] || 0) + 1;
    if (c.nextReviewAt <= nowMs) {
      boxDueCounts[c.box] = (boxDueCounts[c.box] || 0) + 1;
      dueNowCount++;
    }
    totalPass += c.passCount;
    totalFail += c.failCount;
  }

  const totalCards = cards.length;
  const masteredCount = boxCounts[4] + boxCounts[5];
  const masteryPercentage =
    totalCards > 0
      ? Math.round(
          ((boxCounts[1] * 0.15 +
            boxCounts[2] * 0.35 +
            boxCounts[3] * 0.6 +
            boxCounts[4] * 0.85 +
            boxCounts[5] * 1.0) /
            totalCards) *
            100
        )
      : 0;

  const totalReviews = totalPass + totalFail;
  const accuracyPercentage =
    totalReviews > 0 ? Math.round((totalPass / totalReviews) * 100) : 92;

  // Ebbinghaus forgetting curve vs Leitner spaced repetition curve over 16 days
  const retentionCurve = [0, 1, 2, 4, 8, 12, 16].map((day) => {
    const withoutLeitner = Math.round(100 * Math.exp(-0.28 * day));
    const baseBoost = masteryPercentage * 0.25;
    const withLeitner = Math.min(
      99,
      Math.max(72, Math.round(96 - day * 0.9 + baseBoost * 0.15))
    );
    return { day, withoutLeitner, withLeitner };
  });

  return {
    totalCards,
    dueNowCount,
    masteredCount,
    masteryPercentage,
    accuracyPercentage,
    boxCounts,
    boxDueCounts,
    retentionCurve,
  };
}

/**
 * Simulates advancing the clock by `days` so users can immediately test future spaced repetition intervals.
 */
export function advanceSimulationClock(cards: Flashcard[], days: number): Flashcard[] {
  const shiftMs = days * DAY_MS;
  return cards.map((card) => ({
    ...card,
    nextReviewAt: card.nextReviewAt - shiftMs,
    lastReviewedAt: card.lastReviewedAt ? card.lastReviewedAt - shiftMs : null,
  }));
}

export function createInitialCards(nowMs: number = Date.now()): Flashcard[] {
  return [
    {
      id: 'card-1',
      deck: 'Persian & Literary Mastery',
      front: 'حافظه بلندمدت و تکرار با فاصله',
      back: 'Long-Term Memory & Spaced Repetition — A cognitive encoding technique where review intervals grow exponentially (1d → 2d → 4d → 8d → 16d) each time a concept is retrieved effortlessly.',
      phoneticOrHint: 'Hāfeze-ye Boland-Moddat · Cognitive Phrase',
      example: 'مرور منظم در جعبه لایتنر مانع فراموشی می‌شود.',
      box: 1,
      nextReviewAt: nowMs - 3600_000,
      lastReviewedAt: nowMs - DAY_MS,
      passCount: 2,
      failCount: 1,
      streak: 1,
      createdAt: nowMs - 5 * DAY_MS,
    },
    {
      id: 'card-2',
      deck: 'Cognitive Neuroscience',
      front: 'What is the Testing Effect (Active Retrieval Practice)?',
      back: 'Actively retrieving knowledge from memory strengthens synaptic pathways significantly more than passively re-reading the same material, especially when retrieval requires effort just before forgetting.',
      phoneticOrHint: 'Roediger & Karpicke (2006)',
      example: 'Flipping a card only after formulating a complete mental answer.',
      box: 1,
      nextReviewAt: nowMs - 1800_000,
      lastReviewedAt: nowMs - DAY_MS,
      passCount: 3,
      failCount: 0,
      streak: 3,
      createdAt: nowMs - 6 * DAY_MS,
    },
    {
      id: 'card-3',
      deck: 'Persian & Literary Mastery',
      front: 'خردمند و دانش‌پژوه',
      back: 'Wise Scholar & Seeker of Knowledge — Derived from classical Persian literature (Ferdowsi & Saadi), describing one who combines deep contemplation with disciplined practice.',
      phoneticOrHint: 'Kheradmand va Dānesh-pajouh · Classical Persian',
      example: 'توانا بود هر که دانا بود / ز دانش دل پیر برنا بود',
      box: 2,
      nextReviewAt: nowMs - 900_000,
      lastReviewedAt: nowMs - 2 * DAY_MS,
      passCount: 4,
      failCount: 1,
      streak: 2,
      createdAt: nowMs - 8 * DAY_MS,
    },
    {
      id: 'card-4',
      deck: 'Systems Architecture',
      front: 'Why does a B-Tree outperform a Binary Search Tree on NVMe/SSD storage?',
      back: 'B-Trees pack high branching factors (hundreds of keys per node) aligned to 4KB–16KB OS page blocks, minimizing sequential/random disk I/O operations and maximizing CPU cache locality.',
      phoneticOrHint: 'O(log_B N) Page Reads · Storage Engines',
      example: 'A 3-level B+Tree with branching factor 512 indexes over 134 million rows.',
      box: 2,
      nextReviewAt: nowMs - 600_000,
      lastReviewedAt: nowMs - 2 * DAY_MS,
      passCount: 5,
      failCount: 1,
      streak: 3,
      createdAt: nowMs - 9 * DAY_MS,
    },
    {
      id: 'card-5',
      deck: 'Persian & Literary Mastery',
      front: 'پشتکار و استمرار در یادگیری',
      back: 'Perseverance & Consistency in Learning — Small, daily focused sessions compound into mastery far more reliably than sporadic marathon study sessions.',
      phoneticOrHint: 'Poshtkār va Estemrār · Essential Idiom',
      example: 'رهرو آن نیست که گهی تند و گهی خسته رود / رهرو آن است که آهسته و پیوسته رود',
      box: 3,
      nextReviewAt: nowMs - 300_000,
      lastReviewedAt: nowMs - 4 * DAY_MS,
      passCount: 6,
      failCount: 0,
      streak: 6,
      createdAt: nowMs - 12 * DAY_MS,
    },
    {
      id: 'card-6',
      deck: 'Cognitive Neuroscience',
      front: 'How does Synaptic Long-Term Potentiation (LTP) relate to sleep spindles?',
      back: 'During slow-wave and REM sleep, hippocampal sharp-wave ripples coupled with thalamocortical sleep spindles replay daytime learning traces, transferring fragile memories to the neocortex.',
      phoneticOrHint: 'Hippocampal-Neocortical Consolidation',
      example: 'Reviewing difficult Box 1 cards 60 minutes before sleep boosts 7-day retention by ~35%.',
      box: 3,
      nextReviewAt: nowMs - 120_000,
      lastReviewedAt: nowMs - 4 * DAY_MS,
      passCount: 7,
      failCount: 1,
      streak: 4,
      createdAt: nowMs - 14 * DAY_MS,
    },
    {
      id: 'card-7',
      deck: 'Systems Architecture',
      front: 'Explain Linearizability vs. Serializability in Distributed Consensus.',
      back: 'Linearizability is a single-object, real-time ordering guarantee (reads see the most recent completed write), whereas Serializability is a multi-operation transactional isolation guarantee without strict wall-clock ordering.',
      phoneticOrHint: 'Strict Serializability = Both',
      example: 'Raft/Paxos state machine replication provides linearizable reads and writes.',
      box: 4,
      nextReviewAt: nowMs - 60_000,
      lastReviewedAt: nowMs - 8 * DAY_MS,
      passCount: 9,
      failCount: 1,
      streak: 5,
      createdAt: nowMs - 18 * DAY_MS,
    },
    {
      id: 'card-8',
      deck: 'Persian & Literary Mastery',
      front: 'نوروز و نوزایی طبیعت',
      back: 'Nowruz & Vernal Renewal — The astronomical vernal equinox marking the first day of Farvardin, symbolizing intellectual and natural renewal.',
      phoneticOrHint: 'Nowruz · Cultural Heritage',
      example: 'ز کوی یار می‌آید نسیم باد نوروزی',
      box: 5,
      nextReviewAt: nowMs + 6 * DAY_MS,
      lastReviewedAt: nowMs - 10 * DAY_MS,
      passCount: 12,
      failCount: 0,
      streak: 12,
      createdAt: nowMs - 30 * DAY_MS,
    },
    {
      id: 'card-9',
      deck: 'Cognitive Neuroscience',
      front: 'Ebbinghaus Forgetting Curve Formula: R = exp(-t / S)',
      back: 'Retrievability (R) decays exponentially over time (t) divided by Memory Stability (S). Each successful Leitner box promotion multiplies S, flattening the decay slope.',
      phoneticOrHint: 'Hermann Ebbinghaus (1885)',
      example: 'Moving from Box 1 (1d) to Box 5 (16d) increases stability S by 16x.',
      box: 4,
      nextReviewAt: nowMs + 2 * DAY_MS,
      lastReviewedAt: nowMs - 6 * DAY_MS,
      passCount: 8,
      failCount: 1,
      streak: 6,
      createdAt: nowMs - 22 * DAY_MS,
    },
    {
      id: 'card-10',
      deck: 'Systems Architecture',
      front: 'Zero-Copy Serialization & Memory-Mapped Files (mmap)',
      back: 'Allows applications to access structured binary data directly from OS page cache virtual memory addresses without parsing overhead or user-space buffer allocation.',
      phoneticOrHint: 'Cap’n Proto / FlatBuffers / LMDB',
      example: 'Reading a 2GB vector index instantly upon process startup.',
      box: 5,
      nextReviewAt: nowMs + 11 * DAY_MS,
      lastReviewedAt: nowMs - 5 * DAY_MS,
      passCount: 14,
      failCount: 0,
      streak: 14,
      createdAt: nowMs - 35 * DAY_MS,
    },
  ];
}
