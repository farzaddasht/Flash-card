import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RotateCw, Check, X, Sparkles, Volume2, ArrowLeft, ArrowRight } from 'lucide-react';
import {
  Flashcard,
  LEITNER_BOXES,
  detectTextDirection,
  BoxNumber,
} from '../utils/leitner';

interface SwipeableCardDeckProps {
  cards: Flashcard[];
  onReviewCard: (card: Flashcard, outcome: 'pass' | 'fail') => void;
  onPracticeAllAnytime: () => void;
  onOpenCreateModal: () => void;
  sessionReviewedCount: number;
  sessionPassCount: number;
}

export const SwipeableCardDeck: React.FC<SwipeableCardDeckProps> = ({
  cards,
  onReviewCard,
  onPracticeAllAnytime,
  onOpenCreateModal,
  sessionReviewedCount,
  sessionPassCount,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [flingDirection, setFlingDirection] = useState<'left' | 'right' | null>(null);

  const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const activeCard = cards[0] || null;
  const visibleStack = cards.slice(0, 3);

  // Reset flip and drag state when active card changes
  useEffect(() => {
    setIsFlipped(false);
    setDragOffset({ x: 0, y: 0 });
    setFlingDirection(null);
    setIsDragging(false);
  }, [activeCard?.id]);

  const triggerHaptic = useCallback((pattern: number | number[] = 14) => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {
      // Ignore if vibration API is unsupported
    }
  }, []);

  const handleFlip = useCallback(() => {
    if (!activeCard || flingDirection) return;
    triggerHaptic(10);
    setIsFlipped((prev) => !prev);
  }, [activeCard, flingDirection, triggerHaptic]);

  const triggerSwipeCommit = useCallback(
    (outcome: 'pass' | 'fail') => {
      if (!activeCard || flingDirection) return;
      triggerHaptic(outcome === 'pass' ? [15, 30, 20] : [25, 40]);
      setFlingDirection(outcome === 'pass' ? 'right' : 'left');
      setDragOffset({
        x: outcome === 'pass' ? 460 : -460,
        y: 24,
      });

      window.setTimeout(() => {
        onReviewCard(activeCard, outcome);
      }, 190);
    },
    [activeCard, flingDirection, onReviewCard, triggerHaptic]
  );

  // Keyboard shortcuts: Space/Enter to Flip, ArrowRight to Pass, ArrowLeft to Fail
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!activeCard) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        triggerSwipeCommit('pass');
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        triggerSwipeCommit('fail');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCard, handleFlip, triggerSwipeCommit]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeCard || flingDirection) return;
    // Ignore if clicking a nested button inside card
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current || flingDirection) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = (e.clientY - dragStartRef.current.y) * 0.35;
    setDragOffset({ x: dx, y: dy });
  };

  const handlePointerUp = () => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = dragOffset.x;
    const dy = dragOffset.y;
    const elapsed = Date.now() - dragStartRef.current.time;
    dragStartRef.current = null;
    setIsDragging(false);

    const swipeThreshold = 95;
    if (dx > swipeThreshold) {
      triggerSwipeCommit('pass');
    } else if (dx < -swipeThreshold) {
      triggerSwipeCommit('fail');
    } else {
      // If minimal movement and quick tap, flip card
      if (Math.hypot(dx, dy) < 10 && elapsed < 350) {
        handleFlip();
      }
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const speakCardText = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const dir = detectTextDirection(text);
        utterance.lang = dir === 'rtl' ? 'fa-IR' : 'en-US';
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      // Ignore if speech synthesis is unavailable
    }
  };

  if (!activeCard) {
    return (
      <div className="obsidian-glass relative flex min-h-[420px] flex-col items-center justify-center rounded-3xl p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#10B981]/15 text-[#10B981]">
          <Sparkles className="h-8 w-8" />
        </div>
        <h2 className="font-display text-2xl font-bold text-white">
          All Due Cards Reviewed!
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300">
          You completed {sessionReviewedCount} reviews this session with{' '}
          <span className="font-mono font-semibold text-[#10B981] tabular-nums">
            {sessionReviewedCount > 0
              ? Math.round((sessionPassCount / sessionReviewedCount) * 100)
              : 100}
            %
          </span>{' '}
          recall accuracy. Your Leitner boxes are synchronized offline.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onPracticeAllAnytime}
            className="min-h-[44px] cursor-pointer rounded-xl bg-[#8B5CF6] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#8B5CF6]/25 transition-transform hover:bg-[#7C3AED] active:scale-[0.98] whitespace-nowrap shrink-0"
          >
            Study Ahead (Simulate +24h)
          </button>
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="min-h-[44px] cursor-pointer rounded-xl border border-slate-700 bg-slate-800/70 px-5 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-slate-600 hover:text-white whitespace-nowrap shrink-0"
          >
            Create New Flashcard
          </button>
        </div>
      </div>
    );
  }

  const swipeRatio = Math.max(-1, Math.min(1, dragOffset.x / 130));
  const passOpacity = swipeRatio > 0.08 ? Math.min(1, swipeRatio * 1.25) : 0;
  const failOpacity = swipeRatio < -0.08 ? Math.min(1, Math.abs(swipeRatio) * 1.25) : 0;

  return (
    <div className="flex flex-col items-center select-none">
      {/* Top status bar above deck: clean unboxed metadata */}
      <div className="mb-3 flex w-full flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-200 whitespace-nowrap">{activeCard.deck}</span>
          <span aria-hidden="true">·</span>
          <span
            style={{ color: LEITNER_BOXES[activeCard.box].accentHex }}
            className="font-mono font-semibold tabular-nums whitespace-nowrap"
          >
            {LEITNER_BOXES[activeCard.box].shortLabel} (
            {LEITNER_BOXES[activeCard.box].intervalText})
          </span>
        </div>
        <div className="font-mono tabular-nums text-slate-300 whitespace-nowrap">
          <span>{cards.length} in queue</span>
        </div>
      </div>

      {/* 3D Stacked Card Stage */}
      <div
        data-testid="card-deck-stage"
        className="perspective-1200 relative mb-6 h-[320px] w-full max-w-[560px] sm:mb-8 sm:h-[385px]"
      >
        {visibleStack
          .slice()
          .reverse()
          .map((card) => {
            const stackIndex = visibleStack.findIndex((c) => c.id === card.id);
            const isTop = stackIndex === 0;
            const frontDir = detectTextDirection(card.front);
            const backDir = detectTextDirection(card.back);
            const exampleDir = card.example ? detectTextDirection(card.example) : 'ltr';
            const nextPromotionBox = Math.min(5, card.box + 1) as BoxNumber;

            // Compute 3D stack depth transform for background cards vs active dragged top card
            const stackScale = 1 - stackIndex * 0.055;
            const stackTranslateY = stackIndex * 20;
            const stackOpacity = 1 - stackIndex * 0.18;

            const topTransform = isTop
              ? `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0px) rotate(${
                  dragOffset.x * 0.05
                }deg)`
              : `translate3d(0px, ${stackTranslateY}px, -${
                  stackIndex * 35
                }px) scale(${stackScale})`;

            return (
              <div
                key={card.id}
                data-testid={isTop ? 'active-flashcard' : `stacked-card-${stackIndex}`}
                onPointerDown={isTop ? handlePointerDown : undefined}
                onPointerMove={isTop ? handlePointerMove : undefined}
                onPointerUp={isTop ? handlePointerUp : undefined}
                onPointerCancel={isTop ? handlePointerUp : undefined}
                style={{
                  transform: topTransform,
                  opacity: stackOpacity,
                  zIndex: 30 - stackIndex * 10,
                  transition:
                    isTop && isDragging
                      ? 'none'
                      : 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease',
                  touchAction: isTop ? 'pan-y' : 'none',
                }}
                className={`perspective-1200 absolute inset-0 ${
                  isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'
                }`}
              >
                {/* Dynamic Tint Overlays & Tinder-Style Stamp Badges on Top Card */}
                {isTop && passOpacity > 0 && (
                  <div
                    style={{ opacity: passOpacity }}
                    className="pointer-events-none absolute inset-0 z-30 flex items-start justify-start rounded-3xl border-2 border-[#10B981] bg-[#10B981]/15 p-6"
                  >
                    <div className="rotate-[-8deg] rounded-xl border-2 border-[#10B981] bg-[#090D16]/90 px-4 py-1.5 font-mono text-sm font-bold tracking-wider text-[#10B981] shadow-lg">
                      GOT IT (+1 BOX → BOX {nextPromotionBox})
                    </div>
                  </div>
                )}

                {isTop && failOpacity > 0 && (
                  <div
                    style={{ opacity: failOpacity }}
                    className="pointer-events-none absolute inset-0 z-30 flex items-start justify-end rounded-3xl border-2 border-[#F43F5E] bg-[#F43F5E]/15 p-6"
                  >
                    <div className="rotate-[8deg] rounded-xl border-2 border-[#F43F5E] bg-[#090D16]/90 px-4 py-1.5 font-mono text-sm font-bold tracking-wider text-[#F43F5E] shadow-lg">
                      AGAIN (RESET → BOX 1)
                    </div>
                  </div>
                )}

                {/* 3D Flipping Inner Wrapper */}
                <div
                  data-testid={isTop ? 'active-card-flipper' : undefined}
                  data-flipped={isTop ? String(isFlipped) : 'false'}
                  style={{
                    transform: isTop && isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    transition: 'transform 380ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  className="preserve-3d relative h-full w-full"
                >
                  {/* FRONT FACE */}
                  <div
                    className={`backface-hidden obsidian-card-surface absolute inset-0 flex flex-col justify-between rounded-3xl border p-5 sm:p-8 ${
                      isTop
                        ? 'border-white/15'
                        : 'border-[#8B5CF6]/35 shadow-xl shadow-black/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-3 text-xs text-slate-400">
                      <span>
                        Prompt · {frontDir === 'rtl' ? 'RTL (Persian/Farsi)' : 'LTR (English)'}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono tabular-nums text-[#F59E0B]">
                          Streak {card.streak}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => speakCardText(card.front, e)}
                          aria-label="Pronounce card prompt"
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                        >
                          <Volume2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="my-auto flex flex-col justify-center py-4">
                      <p
                        dir={frontDir}
                        className={`font-display text-2xl font-bold leading-snug text-white sm:text-3xl ${
                          frontDir === 'rtl' ? 'text-right leading-relaxed' : 'text-left'
                        }`}
                      >
                        {card.front}
                      </p>

                      {card.phoneticOrHint && (
                        <p className="mt-4 font-mono text-xs text-slate-400">
                          Hint · {card.phoneticOrHint}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <ArrowLeft className="h-3.5 w-3.5 text-[#F43F5E]" />
                        Swipe left: Box 1
                      </span>
                      <span className="font-medium text-[#8B5CF6]">
                        Tap card or Space to flip 180°
                      </span>
                      <span className="flex items-center gap-1.5">
                        Swipe right: +1 Box
                        <ArrowRight className="h-3.5 w-3.5 text-[#10B981]" />
                      </span>
                    </div>
                  </div>

                  {/* BACK FACE (Rotated 180 deg Y) */}
                  <div className="backface-hidden rotate-y-180 obsidian-card-back absolute inset-0 flex flex-col justify-between rounded-3xl border border-[#10B981]/30 p-6 sm:p-8">
                    <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-3 text-xs text-slate-400">
                      <span className="font-semibold text-[#10B981]">
                        Verified Answer & Explanation
                      </span>
                      <span className="font-mono tabular-nums text-slate-400">
                        Next if passed: Box {nextPromotionBox} (
                        {LEITNER_BOXES[nextPromotionBox].intervalDays}d)
                      </span>
                    </div>

                    <div className="my-auto flex flex-col justify-center space-y-4 overflow-y-auto py-2">
                      <p
                        dir={backDir}
                        className={`text-base leading-relaxed text-slate-100 sm:text-lg ${
                          backDir === 'rtl' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {card.back}
                      </p>

                      {card.example && (
                        <div className="border-t border-white/10 pt-3">
                          <span className="block text-[11px] font-medium text-slate-400">
                            Contextual Example
                          </span>
                          <p
                            dir={exampleDir}
                            className={`mt-1 text-sm italic text-slate-300 ${
                              exampleDir === 'rtl' ? 'text-right' : 'text-left'
                            }`}
                          >
                            “{card.example}”
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-3 text-xs text-slate-400">
                      <span>
                        Recall history · {card.passCount} passed / {card.failCount} missed
                      </span>
                      <span className="font-medium text-slate-300">
                        Tap to flip back
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Quick-Action Floating Controls Below Deck */}
      <div className="mt-8 flex w-full max-w-[560px] items-center justify-between gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => triggerSwipeCommit('fail')}
          aria-label="Again — Reset to Box 1"
          className="flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#F43F5E]/40 bg-[#F43F5E]/10 px-4 py-3 text-sm font-semibold text-[#F43F5E] transition-all hover:bg-[#F43F5E]/20 active:scale-[0.98] whitespace-nowrap shrink-0"
        >
          <X className="h-4 w-4 shrink-0" />
          <span>Again (Box 1)</span>
        </button>

        <button
          type="button"
          onClick={handleFlip}
          aria-label="Flip Flashcard 180 degrees"
          className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#8B5CF6]/50 bg-[#8B5CF6]/15 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-[#8B5CF6]/25 active:scale-[0.98] whitespace-nowrap shrink-0"
        >
          <RotateCw className="h-4 w-4 shrink-0 text-[#8B5CF6]" />
          <span>Flip Card</span>
        </button>

        <button
          type="button"
          onClick={() => triggerSwipeCommit('pass')}
          aria-label="Got It — Advance to next Leitner Box"
          className="flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#10B981]/40 bg-[#10B981]/15 px-4 py-3 text-sm font-semibold text-[#10B981] transition-all hover:bg-[#10B981]/25 active:scale-[0.98] whitespace-nowrap shrink-0"
        >
          <Check className="h-4 w-4 shrink-0" />
          <span>Got It (+1 Box)</span>
        </button>
      </div>
    </div>
  );
};
