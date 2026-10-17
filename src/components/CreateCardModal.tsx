import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { BoxNumber, detectTextDirection, Flashcard } from '../utils/leitner';

interface CreateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCard: (card: Omit<Flashcard, 'id' | 'createdAt' | 'passCount' | 'failCount' | 'streak' | 'lastReviewedAt' | 'nextReviewAt'>) => void;
  existingDecks: string[];
}

export const CreateCardModal: React.FC<CreateCardModalProps> = ({
  isOpen,
  onClose,
  onAddCard,
  existingDecks,
}) => {
  const [deck, setDeck] = useState(existingDecks[0] || 'Persian & Literary Mastery');
  const [customDeck, setCustomDeck] = useState('');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [phoneticOrHint, setPhoneticOrHint] = useState('');
  const [example, setExample] = useState('');
  const [initialBox, setInitialBox] = useState<BoxNumber>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const frontDir = detectTextDirection(front);
  const backDir = detectTextDirection(back);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedFront = front.trim();
    const trimmedBack = back.trim();
    const targetDeck = deck === '__custom__' ? customDeck.trim() : deck;

    if (!trimmedFront || !trimmedBack) {
      setErrorMsg('Both Front Prompt and Back Answer are required.');
      return;
    }
    if (!targetDeck) {
      setErrorMsg('Please provide a deck name.');
      return;
    }

    onAddCard({
      deck: targetDeck,
      front: trimmedFront,
      back: trimmedBack,
      phoneticOrHint: phoneticOrHint.trim() || undefined,
      example: example.trim() || undefined,
      box: initialBox,
    });

    setFront('');
    setBack('');
    setPhoneticOrHint('');
    setExample('');
    setErrorMsg(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-card-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="obsidian-glass relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl p-6 sm:p-8">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 id="create-card-title" className="font-display text-xl font-bold text-white">
              Add Flashcard to Leitner Box
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Supports automatic LTR (English) and RTL (Persian/Farsi) direction detection
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-[#F43F5E]/40 bg-[#F43F5E]/10 px-4 py-2.5 text-xs font-medium text-[#F43F5E]"
            >
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="card-deck-select" className="block text-xs font-medium text-slate-300">
                Deck Collection
              </label>
              <select
                id="card-deck-select"
                value={deck}
                onChange={(e) => setDeck(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090D16] px-3.5 py-2.5 text-sm text-white focus:border-[#8B5CF6] focus:outline-none"
              >
                {existingDecks.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                <option value="__custom__">+ Create New Deck...</option>
              </select>
            </div>

            <div>
              <label htmlFor="card-box-select" className="block text-xs font-medium text-slate-300">
                Starting Leitner Box
              </label>
              <select
                id="card-box-select"
                value={initialBox}
                onChange={(e) => setInitialBox(Number(e.target.value) as BoxNumber)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090D16] px-3.5 py-2.5 text-sm text-white focus:border-[#8B5CF6] focus:outline-none"
              >
                <option value={1}>Box 1 · Every 1 Day (Default)</option>
                <option value={2}>Box 2 · Every 2 Days</option>
                <option value={3}>Box 3 · Every 4 Days</option>
                <option value={4}>Box 4 · Every 8 Days</option>
                <option value={5}>Box 5 · Every 16 Days</option>
              </select>
            </div>
          </div>

          {deck === '__custom__' && (
            <div>
              <label htmlFor="custom-deck-input" className="block text-xs font-medium text-slate-300">
                New Deck Title
              </label>
              <input
                id="custom-deck-input"
                type="text"
                value={customDeck}
                onChange={(e) => setCustomDeck(e.target.value)}
                placeholder="e.g., Medical Pharmacology or ادبیات فارسی"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090D16] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-[#8B5CF6] focus:outline-none"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="card-front-input" className="block text-xs font-medium text-slate-300">
                Front Prompt (Question / Term)
              </label>
              <span className="font-mono text-[11px] text-slate-400">
                Detected: {frontDir.toUpperCase()}
              </span>
            </div>
            <textarea
              id="card-front-input"
              rows={2}
              dir={frontDir}
              value={front}
              onChange={(e) => {
                setFront(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="Type in English or Persian (e.g., دستاورد علمی or What is Synaptic Consolidation?)..."
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090D16] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-[#8B5CF6] focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="card-back-input" className="block text-xs font-medium text-slate-300">
                Back Answer & Explanation
              </label>
              <span className="font-mono text-[11px] text-slate-400">
                Detected: {backDir.toUpperCase()}
              </span>
            </div>
            <textarea
              id="card-back-input"
              rows={3}
              dir={backDir}
              value={back}
              onChange={(e) => {
                setBack(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="Clear definition, translation, or conceptual synthesis..."
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090D16] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-[#8B5CF6] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="card-hint-input" className="block text-xs font-medium text-slate-300">
                Phonetic / Memory Hint (Optional)
              </label>
              <input
                id="card-hint-input"
                type="text"
                value={phoneticOrHint}
                onChange={(e) => setPhoneticOrHint(e.target.value)}
                placeholder="e.g., Dastāvard-e Elmi"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090D16] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-[#8B5CF6] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="card-example-input" className="block text-xs font-medium text-slate-300">
                Contextual Example (Optional)
              </label>
              <input
                id="card-example-input"
                type="text"
                dir={detectTextDirection(example)}
                value={example}
                onChange={(e) => setExample(e.target.value)}
                placeholder="Example sentence or formula..."
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090D16] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-[#8B5CF6] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] cursor-pointer rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-[#8B5CF6] px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-[#8B5CF6]/25 transition-colors hover:bg-[#7C3AED] whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Save Flashcard</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
