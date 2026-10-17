/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Flame,
  Plus,
  Layers,
  BookOpen,
  BarChart3,
  Clock,
  Search,
  Trash2,
  RotateCcw,
  Download,
  CheckCircle2,
  XCircle,
  Sparkles,
  FastForward,
} from 'lucide-react';
import {
  Flashcard,
  BoxNumber,
  LEITNER_BOXES,
  ReviewLogEntry,
  createInitialCards,
  processCardReview,
  getDueCards,
  calculateLeitnerStats,
  advanceSimulationClock,
  detectTextDirection,
} from './utils/leitner';
import { SwipeableCardDeck } from './components/SwipeableCardDeck';
import { ParticleCelebrationCanvas } from './components/ParticleCelebrationCanvas';
import { RetentionChartCanvas } from './components/RetentionChartCanvas';
import { CreateCardModal } from './components/CreateCardModal';

const STORAGE_KEY_CARDS = 'leitnerflow_cards_v1';
const STORAGE_KEY_LOGS = 'leitnerflow_logs_v1';
const STORAGE_KEY_STREAK = 'leitnerflow_streak_v1';

type ActiveTab = 'study' | 'boxes' | 'library' | 'analytics';

export default function App() {
  const [cards, setCards] = useState<Flashcard[]>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_CARDS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback to initial deterministic cards
    }
    return createInitialCards();
  });

  const [reviewLogs, setReviewLogs] = useState<ReviewLogEntry[]>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_LOGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore
    }
    return [];
  });

  const [dailyStreak, setDailyStreak] = useState<number>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_STREAK);
      return saved ? Number(saved) || 14 : 14;
    } catch {
      return 14;
    }
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('study');
  const [selectedBoxFilter, setSelectedBoxFilter] = useState<BoxNumber | null>(null);
  const [selectedDeckFilter, setSelectedDeckFilter] = useState<string>('All Decks');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scriptFilter, setScriptFilter] = useState<'all' | 'ltr' | 'rtl'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [celebrating, setCelebrating] = useState<boolean>(false);
  const [simulatedDaysOffset, setSimulatedDaysOffset] = useState<number>(0);
  const [sessionReviewedCount, setSessionReviewedCount] = useState<number>(0);
  const [sessionPassCount, setSessionPassCount] = useState<number>(0);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(cards));
    } catch {
      // Ignore storage quota errors
    }
  }, [cards]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(reviewLogs.slice(0, 60)));
    } catch {
      // Ignore
    }
  }, [reviewLogs]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_STREAK, String(dailyStreak));
    } catch {
      // Ignore
    }
  }, [dailyStreak]);

  const existingDecks = useMemo(() => {
    const set = new Set<string>();
    cards.forEach((c) => set.add(c.deck));
    return Array.from(set);
  }, [cards]);

  const stats = useMemo(() => calculateLeitnerStats(cards), [cards]);

  const dueCards = useMemo(
    () => getDueCards(cards, Date.now(), selectedBoxFilter, selectedDeckFilter, false),
    [cards, selectedBoxFilter, selectedDeckFilter]
  );

  // Trigger particle celebration when due queue hits 0 after at least 1 review in session
  useEffect(() => {
    if (dueCards.length === 0 && sessionReviewedCount > 0) {
      setCelebrating(true);
      const timer = window.setTimeout(() => setCelebrating(false), 3800);
      return () => window.clearTimeout(timer);
    }
  }, [dueCards.length, sessionReviewedCount]);

  const handleReviewCard = (card: Flashcard, outcome: 'pass' | 'fail') => {
    const now = Date.now();
    const updatedCard = processCardReview(card, outcome, now);

    setCards((prev) => prev.map((c) => (c.id === card.id ? updatedCard : c)));
    setSessionReviewedCount((c) => c + 1);
    if (outcome === 'pass') {
      setSessionPassCount((c) => c + 1);
    }

    const logEntry: ReviewLogEntry = {
      id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
      cardId: card.id,
      cardFront: card.front,
      outcome,
      previousBox: card.box,
      newBox: updatedCard.box,
      timestamp: now,
    };
    setReviewLogs((prev) => [logEntry, ...prev.slice(0, 49)]);
  };

  const handleAdvanceDay = (days: number = 1) => {
    setCards((prev) => advanceSimulationClock(prev, days));
    setSimulatedDaysOffset((d) => d + days);
    setDailyStreak((s) => s + days);
  };

  const handleAddCard = (
    newCardData: Omit<
      Flashcard,
      'id' | 'createdAt' | 'passCount' | 'failCount' | 'streak' | 'lastReviewedAt' | 'nextReviewAt'
    >
  ) => {
    const now = Date.now();
    const newCard: Flashcard = {
      ...newCardData,
      id: `card-${now}`,
      createdAt: now,
      lastReviewedAt: null,
      nextReviewAt: now - 1000, // Immediately due so user can study it right away
      passCount: 0,
      failCount: 0,
      streak: 0,
    };
    setCards((prev) => [newCard, ...prev]);
  };

  const handleDeleteCard = (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  };

  const handleResetDemoDeck = () => {
    const fresh = createInitialCards();
    setCards(fresh);
    setReviewLogs([]);
    setSessionReviewedCount(0);
    setSessionPassCount(0);
    setSimulatedDaysOffset(0);
    setSelectedBoxFilter(null);
    setSelectedDeckFilter('All Decks');
  };

  const handleExportJson = () => {
    const payload = JSON.stringify({ cards, reviewLogs, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leitnerflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLibraryCards = useMemo(() => {
    return cards.filter((c) => {
      if (selectedBoxFilter !== null && c.box !== selectedBoxFilter) return false;
      if (selectedDeckFilter !== 'All Decks' && c.deck !== selectedDeckFilter) return false;
      if (scriptFilter !== 'all') {
        const dir = detectTextDirection(c.front);
        if (dir !== scriptFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.front.toLowerCase().includes(q) ||
          c.back.toLowerCase().includes(q) ||
          c.deck.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [cards, selectedBoxFilter, selectedDeckFilter, scriptFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 pb-20 md:pb-12">
      {/* Top Bar Contract: Strictly 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 border-b border-white/10 bg-[#090D16]/90 px-6 py-4 backdrop-blur-md">
        <a
          href="#study"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('study');
          }}
          className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          LeitnerFlow
        </a>

        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
        >
          <button
            type="button"
            onClick={() => setActiveTab('study')}
            className={`cursor-pointer py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'study'
                ? 'border-b-2 border-[#8B5CF6] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Study Deck
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('boxes')}
            className={`cursor-pointer py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'boxes'
                ? 'border-b-2 border-[#8B5CF6] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            5-Box Pipeline
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`cursor-pointer py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'library'
                ? 'border-b-2 border-[#8B5CF6] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Card Library
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`cursor-pointer py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'analytics'
                ? 'border-b-2 border-[#8B5CF6] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Retention Analytics
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="min-h-[40px] cursor-pointer rounded-xl bg-[#8B5CF6] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#8B5CF6]/20 transition-colors hover:bg-[#7C3AED] whitespace-nowrap shrink-0"
          >
            + New Flashcard
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        {/* Workspace Summary Strip */}
        <section
          aria-label="Spaced Repetition Telemetry"
          className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5"
        >
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {activeTab === 'study' && 'Active Recall & 3D Leitner Deck'}
              {activeTab === 'boxes' && 'Leitner 5-Box Spaced Repetition Architecture'}
              {activeTab === 'library' && 'Bilingual Flashcard Vault (LTR & RTL)'}
              {activeTab === 'analytics' && 'Memory Consolidation & Retention Curve'}
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              <span>100% Offline LocalStorage Engine</span>
              <span aria-hidden="true"> · </span>
              <span className="font-mono tabular-nums text-slate-300">
                {stats.dueNowCount} Due Now
              </span>
              <span aria-hidden="true"> · </span>
              <span className="font-mono tabular-nums text-[#10B981]">
                {stats.masteryPercentage}% Memory Index
              </span>
              {simulatedDaysOffset > 0 && (
                <>
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono tabular-nums text-[#8B5CF6]">
                    +{simulatedDaysOffset}d Simulated
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Flame className="h-4 w-4 text-[#F59E0B]" />
              <span className="font-mono text-sm font-bold text-[#F59E0B] tabular-nums">
                {dailyStreak} Day Streak
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-400">
                {sessionReviewedCount} reviewed today
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleAdvanceDay(1)}
              className="flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/90 px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-[#8B5CF6]/50 hover:text-white whitespace-nowrap shrink-0"
            >
              <FastForward className="h-3.5 w-3.5 text-[#8B5CF6]" />
              <span>Simulate +1 Day</span>
            </button>
          </div>
        </section>

        {/* VIEW 1: STUDY ARENA */}
        {activeTab === 'study' && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
            {/* Left 7 Cols: Interactive Filter Controls + 3D Stacked Swipeable Card Deck */}
            <div className="relative lg:col-span-7">
              <ParticleCelebrationCanvas active={celebrating} />

              {/* Deck & Box Segmented Controls */}
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div
                  role="group"
                  aria-label="Filter by Deck"
                  className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-900/90 p-1 border border-white/5"
                >
                  {['All Decks', ...existingDecks].map((deckName) => (
                    <button
                      key={deckName}
                      type="button"
                      onClick={() => setSelectedDeckFilter(deckName)}
                      className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        selectedDeckFilter === deckName
                          ? 'bg-[#8B5CF6] text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {deckName}
                    </button>
                  ))}
                </div>

                {selectedBoxFilter !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedBoxFilter(null)}
                    className="cursor-pointer text-xs font-medium text-[#8B5CF6] hover:underline whitespace-nowrap shrink-0"
                  >
                    Showing Box {selectedBoxFilter} only · Reset filter
                  </button>
                )}
              </div>

              {/* 3D Stacked Card Deck Component */}
              <SwipeableCardDeck
                cards={dueCards}
                onReviewCard={handleReviewCard}
                onPracticeAllAnytime={() => handleAdvanceDay(2)}
                onOpenCreateModal={() => setIsCreateModalOpen(true)}
                sessionReviewedCount={sessionReviewedCount}
                sessionPassCount={sessionPassCount}
              />

              {/* Recent Session Transitions Log */}
              <div className="mt-10 border-t border-white/10 pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold text-slate-200">
                    Recent Box Transitions
                  </h3>
                  <span className="font-mono text-xs text-slate-400 tabular-nums">
                    {reviewLogs.length} logged events
                  </span>
                </div>

                {reviewLogs.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-400">
                    Swipe right (Got It) or swipe left (Again) on the active card above to record real-time Leitner box transitions.
                  </p>
                ) : (
                  <div className="mt-3 divide-y divide-white/5">
                    {reviewLogs.slice(0, 4).map((log) => {
                      const dir = detectTextDirection(log.cardFront);
                      return (
                        <div
                          key={log.id}
                          className="flex items-center justify-between gap-4 py-2.5 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {log.outcome === 'pass' ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10B981]" />
                            ) : (
                              <XCircle className="h-4 w-4 shrink-0 text-[#F43F5E]" />
                            )}
                            <span
                              dir={dir}
                              className="truncate font-medium text-slate-200"
                            >
                              {log.cardFront}
                            </span>
                          </div>
                          <div className="font-mono text-slate-400 tabular-nums whitespace-nowrap shrink-0">
                            <span>Box {log.previousBox}</span>
                            <span aria-hidden="true"> → </span>
                            <span
                              className={
                                log.outcome === 'pass'
                                  ? 'font-semibold text-[#10B981]'
                                  : 'font-semibold text-[#F43F5E]'
                              }
                            >
                              Box {log.newBox}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right 5 Cols: Live 5-Box Leitner Pipeline & Spaced Repetition Matrix */}
            <aside className="obsidian-glass rounded-3xl p-6 sm:p-7 lg:col-span-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-white">
                    Leitner 5-Box System
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Select any box to isolate its due queue
                  </p>
                </div>
                <span className="font-mono text-xs text-slate-300 tabular-nums">
                  {stats.totalCards} Total Cards
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {([1, 2, 3, 4, 5] as BoxNumber[]).map((boxNum) => {
                  const meta = LEITNER_BOXES[boxNum];
                  const count = stats.boxCounts[boxNum];
                  const dueCount = stats.boxDueCounts[boxNum];
                  const pct =
                    stats.totalCards > 0 ? Math.round((count / stats.totalCards) * 100) : 0;
                  const isSelected = selectedBoxFilter === boxNum;

                  return (
                    <button
                      key={boxNum}
                      type="button"
                      onClick={() =>
                        setSelectedBoxFilter((prev) => (prev === boxNum ? null : boxNum))
                      }
                      className={`w-full cursor-pointer rounded-2xl border p-4 text-left transition-all ${
                        isSelected
                          ? 'border-[#8B5CF6] bg-[#8B5CF6]/15 shadow-lg shadow-[#8B5CF6]/10'
                          : 'border-white/10 bg-[#090D16]/65 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            style={{ color: meta.accentHex }}
                            className="font-display text-sm font-bold"
                          >
                            {meta.title}
                          </span>
                        </div>
                        <div className="font-mono text-xs tabular-nums text-slate-300">
                          <span className="font-semibold text-white">{dueCount} due</span>
                          <span aria-hidden="true"> / </span>
                          <span>{count} cards</span>
                        </div>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                        <span>{meta.description}</span>
                        <span className="font-mono tabular-nums">{meta.intervalText}</span>
                      </div>

                      {/* Capacity bar */}
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          style={{
                            width: `${Math.max(count > 0 ? 8 : 0, pct)}%`,
                            backgroundColor: meta.accentHex,
                          }}
                          className="h-full rounded-full transition-all duration-300"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Spaced Repetition Rules Callout */}
              <div className="mt-6 border-t border-white/10 pt-5 text-xs leading-relaxed text-slate-400">
                <div className="flex items-center justify-between font-medium text-slate-200">
                  <span>Algorithm Rules</span>
                  <span className="font-mono text-[#10B981] tabular-nums">
                    {stats.accuracyPercentage}% Accuracy
                  </span>
                </div>
                <p className="mt-1.5">
                  Swiping right promotes a card by <strong className="text-[#10B981]">+1 Box</strong>{' '}
                  and doubles its review interval (1d → 2d → 4d → 8d → 16d). Swiping left returns any
                  card to <strong className="text-[#F43F5E]">Box 1</strong> for immediate daily
                  re-encoding.
                </p>
              </div>
            </aside>
          </div>
        )}

        {/* VIEW 2: 5-BOX PIPELINE EXPLORER */}
        {activeTab === 'boxes' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              {([1, 2, 3, 4, 5] as BoxNumber[]).map((boxNum) => {
                const meta = LEITNER_BOXES[boxNum];
                const boxCards = cards.filter((c) => c.box === boxNum);
                const dueInBox = stats.boxDueCounts[boxNum];

                return (
                  <div
                    key={boxNum}
                    className="obsidian-glass flex flex-col justify-between rounded-3xl p-5"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <span
                          style={{ color: meta.accentHex }}
                          className="font-display text-base font-bold"
                        >
                          Box {boxNum}
                        </span>
                        <span className="font-mono text-xs text-slate-400 tabular-nums">
                          {meta.intervalText}
                        </span>
                      </div>

                      <div className="mt-4 flex items-baseline justify-between">
                        <span className="font-mono text-3xl font-bold text-white tabular-nums">
                          {boxCards.length}
                        </span>
                        <span className="font-mono text-xs text-[#10B981] tabular-nums">
                          {dueInBox} due now
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{meta.description}</p>

                      <div className="mt-4 space-y-2.5 border-t border-white/5 pt-3">
                        {boxCards.length === 0 ? (
                          <p className="py-4 text-center text-xs text-slate-500">
                            No cards in Box {boxNum}
                          </p>
                        ) : (
                          boxCards.map((c) => {
                            const dir = detectTextDirection(c.front);
                            return (
                              <div
                                key={c.id}
                                className="rounded-xl border border-white/5 bg-[#090D16]/70 p-3 text-xs"
                              >
                                <p
                                  dir={dir}
                                  className="font-medium text-slate-100 line-clamp-2"
                                >
                                  {c.front}
                                </p>
                                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                                  <span>Streak {c.streak}</span>
                                  <div className="flex items-center gap-2">
                                    {c.box < 5 && (
                                      <button
                                        type="button"
                                        onClick={() => handleReviewCard(c, 'pass')}
                                        className="cursor-pointer font-medium text-[#10B981] hover:underline"
                                      >
                                        +1 Box
                                      </button>
                                    )}
                                    {c.box > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handleReviewCard(c, 'fail')}
                                        className="cursor-pointer font-medium text-[#F43F5E] hover:underline"
                                      >
                                        Reset
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBoxFilter(boxNum);
                        setActiveTab('study');
                      }}
                      className="mt-5 min-h-[40px] w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#8B5CF6] whitespace-nowrap shrink-0"
                    >
                      Study Box {boxNum}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 3: CARD LIBRARY (LTR & RTL VAULT) */}
        {activeTab === 'library' && (
          <div className="space-y-6">
            <div className="obsidian-glass flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  aria-label="Search flashcards in English or Persian"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search English or Persian flashcards..."
                  className="w-full rounded-xl border border-white/10 bg-[#090D16] py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div
                  role="group"
                  aria-label="Filter by text direction"
                  className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#090D16] p-1"
                >
                  {(['all', 'ltr', 'rtl'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setScriptFilter(mode)}
                      className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        scriptFilter === mode
                          ? 'bg-[#8B5CF6] text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {mode === 'all' ? 'All Scripts' : mode === 'ltr' ? 'LTR (English)' : 'RTL (Persian)'}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleExportJson}
                  className="flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-[#090D16] px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-white/25 whitespace-nowrap shrink-0"
                >
                  <Download className="h-3.5 w-3.5 text-[#10B981]" />
                  <span>Export JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetDemoDeck}
                  className="flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-[#090D16] px-3.5 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-[#F43F5E]/50 hover:text-[#F43F5E] whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Demo Cards</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredLibraryCards.map((card) => {
                const frontDir = detectTextDirection(card.front);
                const backDir = detectTextDirection(card.back);
                const boxMeta = LEITNER_BOXES[card.box];

                return (
                  <article
                    key={card.id}
                    className="obsidian-glass flex flex-col justify-between rounded-3xl p-6 transition-colors hover:border-white/20"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                        <div>
                          <span className="font-medium text-slate-200">{card.deck}</span>
                          <span aria-hidden="true"> · </span>
                          <span style={{ color: boxMeta.accentHex }} className="font-mono font-semibold">
                            Box {card.box} ({boxMeta.intervalDays}d)
                          </span>
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono">{frontDir.toUpperCase()}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteCard(card.id)}
                          aria-label={`Delete card ${card.front}`}
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-[#F43F5E]/15 hover:text-[#F43F5E]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <h3
                        dir={frontDir}
                        className={`mt-3 font-display text-lg font-bold text-white ${
                          frontDir === 'rtl' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {card.front}
                      </h3>

                      <p
                        dir={backDir}
                        className={`mt-2 text-sm leading-relaxed text-slate-300 ${
                          backDir === 'rtl' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {card.back}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs text-slate-400">
                      <span className="font-mono tabular-nums">
                        Passed {card.passCount} · Missed {card.failCount} · Streak {card.streak}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleReviewCard(card, 'pass')}
                          className="cursor-pointer font-medium text-[#10B981] hover:underline"
                        >
                          Promote (+1 Box)
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 4: RETENTION ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="obsidian-glass rounded-3xl p-6 sm:p-8 lg:col-span-8">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-white">
                    16-Day Ebbinghaus Decay vs. Leitner 5-Box Curve
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Rendered 100% offline via HTML5 Canvas based on your active box distribution
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="font-medium text-[#10B981]">
                    Solid: Leitner 5-Box Recall
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-[#F43F5E]">
                    Dashed: Unassisted Decay
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <RetentionChartCanvas data={stats.retentionCurve} />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-5 sm:grid-cols-4">
                <div>
                  <span className="text-xs text-slate-400">Total Flashcards</span>
                  <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
                    {stats.totalCards}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Mastery Index</span>
                  <p className="mt-1 font-mono text-2xl font-bold text-[#10B981] tabular-nums">
                    {stats.masteryPercentage}%
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Recall Accuracy</span>
                  <p className="mt-1 font-mono text-2xl font-bold text-[#8B5CF6] tabular-nums">
                    {stats.accuracyPercentage}%
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Active Streak</span>
                  <p className="mt-1 font-mono text-2xl font-bold text-[#F59E0B] tabular-nums">
                    {dailyStreak}d
                  </p>
                </div>
              </div>
            </div>

            <div className="obsidian-glass rounded-3xl p-6 sm:p-8 lg:col-span-4">
              <h2 className="font-display text-lg font-bold text-white">
                Interval Schedule Breakdown
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Exponential spacing prevents synaptic decay
              </p>

              <div className="mt-6 space-y-4">
                {([1, 2, 3, 4, 5] as BoxNumber[]).map((boxNum) => {
                  const meta = LEITNER_BOXES[boxNum];
                  const count = stats.boxCounts[boxNum];
                  return (
                    <div
                      key={boxNum}
                      className="flex items-center justify-between border-b border-white/5 pb-3 text-xs"
                    >
                      <div>
                        <p style={{ color: meta.accentHex }} className="font-semibold">
                          {meta.title}
                        </p>
                        <p className="mt-0.5 text-slate-400">{meta.intervalText}</p>
                      </div>
                      <span className="font-mono text-sm font-bold text-white tabular-nums">
                        {count} cards
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Tab Bar (<= 15% viewport height, >= 44px touch targets) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 grid h-16 grid-cols-4 items-center border-t border-white/10 bg-[#090D16]/95 px-2 backdrop-blur-md md:hidden"
      >
        <button
          type="button"
          onClick={() => setActiveTab('study')}
          className={`flex min-h-[44px] cursor-pointer flex-col items-center justify-center ${
            activeTab === 'study' ? 'text-[#8B5CF6]' : 'text-slate-400'
          }`}
        >
          <Sparkles className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-medium whitespace-nowrap">Study</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('boxes')}
          className={`flex min-h-[44px] cursor-pointer flex-col items-center justify-center ${
            activeTab === 'boxes' ? 'text-[#8B5CF6]' : 'text-slate-400'
          }`}
        >
          <Layers className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-medium whitespace-nowrap">5-Boxes</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('library')}
          className={`flex min-h-[44px] cursor-pointer flex-col items-center justify-center ${
            activeTab === 'library' ? 'text-[#8B5CF6]' : 'text-slate-400'
          }`}
        >
          <BookOpen className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-medium whitespace-nowrap">Library</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`flex min-h-[44px] cursor-pointer flex-col items-center justify-center ${
            activeTab === 'analytics' ? 'text-[#8B5CF6]' : 'text-slate-400'
          }`}
        >
          <BarChart3 className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-medium whitespace-nowrap">Analytics</span>
        </button>
      </nav>

      <CreateCardModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onAddCard={handleAddCard}
        existingDecks={existingDecks}
      />
    </div>
  );
}
