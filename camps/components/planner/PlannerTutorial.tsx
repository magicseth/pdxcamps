'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const TUTORIAL_SEEN_KEY = 'pdxcamps-planner-tutorial-seen';

interface TutorialStep {
  title: string;
  description: string;
  emoji: string;
  /** data-tutorial attribute value to highlight, or null for no highlight */
  target: string | null;
  /** Where to place the tooltip relative to the highlighted element */
  placement: 'below' | 'above' | 'center';
}

const steps: TutorialStep[] = [
  {
    title: 'Your summer at a glance',
    description:
      'This is your planner. Each row is one of your kids, and each column is a week from June through August.',
    emoji: '📅',
    target: 'grid',
    placement: 'above',
  },
  {
    title: 'Spot the gaps',
    description:
      'Orange cells are weeks that still need a camp. Green means registered. Blue means a family event has that week covered.',
    emoji: '🎨',
    target: 'gap',
    placement: 'below',
  },
  {
    title: 'Tap a gap to fill it',
    description:
      'Click any orange cell to see camps available that week, already filtered for your child\u2019s age and schedule.',
    emoji: '👆',
    target: 'gap',
    placement: 'below',
  },
  {
    title: 'Filter by interest',
    description:
      'Use these chips to filter by category or organization. The numbers in the grid update instantly to match.',
    emoji: '🏷️',
    target: 'filters',
    placement: 'below',
  },
  {
    title: 'Track your progress',
    description:
      'This bar shows how much of summer is planned. Save camps you like, then register when you\u2019re ready.',
    emoji: '✅',
    target: 'progress',
    placement: 'below',
  },
  {
    title: 'Share with your people',
    description:
      'Tap the share button to send your calendar to a co-parent, partner, grandparent, or nanny. Everyone stays on the same page.',
    emoji: '💌',
    target: 'share',
    placement: 'below',
  },
];

// Padding around highlighted element
const HIGHLIGHT_PAD = 8;

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function PlannerTutorial({
  onDismiss,
  onComplete,
}: {
  onDismiss?: () => void;
  /** Called only when the user finishes the last step (not when skipping) */
  onComplete?: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const tooltipRef = useRef<HTMLDivElement>(null);
  const highlightedElRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(TUTORIAL_SEEN_KEY)) return;
    } catch {
      return;
    }
    const timer = setTimeout(() => setVisible(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Position spotlight and tooltip when step changes
  const positionSpotlight = useCallback(() => {
    if (!visible) return;
    const step = steps[currentStep];

    // Clean up previous highlight
    if (highlightedElRef.current) {
      highlightedElRef.current.style.removeProperty('position');
      highlightedElRef.current.style.removeProperty('z-index');
      highlightedElRef.current.style.removeProperty('box-shadow');
      highlightedElRef.current.style.removeProperty('border-radius');
      highlightedElRef.current = null;
    }

    if (!step.target) {
      setSpotlight(null);
      setTooltipStyle({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
      return;
    }

    const el = document.querySelector(`[data-tutorial="${step.target}"]`) as HTMLElement | null;
    if (!el) {
      setSpotlight(null);
      setTooltipStyle({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
      return;
    }

    // Scroll element into view smoothly
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });

    // Wait for scroll to settle then measure
    requestAnimationFrame(() => {
      setTimeout(() => {
        const rect = el.getBoundingClientRect();

        // Set spotlight cutout
        const spotRect: SpotlightRect = {
          top: rect.top - HIGHLIGHT_PAD + window.scrollY,
          left: rect.left - HIGHLIGHT_PAD,
          width: rect.width + HIGHLIGHT_PAD * 2,
          height: rect.height + HIGHLIGHT_PAD * 2,
        };
        setSpotlight(spotRect);

        // Lift element above overlay
        highlightedElRef.current = el;
        const computedPos = window.getComputedStyle(el).position;
        if (computedPos === 'static') {
          el.style.position = 'relative';
        }
        el.style.zIndex = '51';
        el.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.2)';
        el.style.borderRadius = '8px';

        // Position tooltip
        const viewportRect = el.getBoundingClientRect();
        const tooltipWidth = 340;

        let top: number;
        let left = Math.max(16, Math.min(viewportRect.left + viewportRect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16));

        if (step.placement === 'below') {
          top = viewportRect.bottom + HIGHLIGHT_PAD + 12;
          // If tooltip would go off-screen bottom, flip above
          if (top + 200 > window.innerHeight) {
            top = viewportRect.top - HIGHLIGHT_PAD - 12;
            setTooltipStyle({
              position: 'fixed',
              top: `${top}px`,
              left: `${left}px`,
              width: `${tooltipWidth}px`,
              transform: 'translateY(-100%)',
            });
            return;
          }
        } else if (step.placement === 'above') {
          top = viewportRect.top - HIGHLIGHT_PAD - 12;
          // If above goes off-screen, flip below
          if (top < 80) {
            top = viewportRect.bottom + HIGHLIGHT_PAD + 12;
            setTooltipStyle({
              position: 'fixed',
              top: `${top}px`,
              left: `${left}px`,
              width: `${tooltipWidth}px`,
            });
            return;
          }
          setTooltipStyle({
            position: 'fixed',
            top: `${top}px`,
            left: `${left}px`,
            width: `${tooltipWidth}px`,
            transform: 'translateY(-100%)',
          });
          return;
        } else {
          top = window.innerHeight / 2;
          setTooltipStyle({
            position: 'fixed',
            top: `${top}px`,
            left: `${left}px`,
            width: `${tooltipWidth}px`,
            transform: 'translateY(-50%)',
          });
          return;
        }

        setTooltipStyle({
          position: 'fixed',
          top: `${top}px`,
          left: `${left}px`,
          width: `${tooltipWidth}px`,
        });
      }, 350); // wait for scroll
    });
  }, [visible, currentStep]);

  useEffect(() => {
    positionSpotlight();
  }, [positionSpotlight]);

  // Reposition on resize
  useEffect(() => {
    if (!visible) return;
    const handler = () => positionSpotlight();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [visible, positionSpotlight]);

  const dismiss = useCallback(() => {
    // Clean up highlight
    if (highlightedElRef.current) {
      highlightedElRef.current.style.removeProperty('position');
      highlightedElRef.current.style.removeProperty('z-index');
      highlightedElRef.current.style.removeProperty('box-shadow');
      highlightedElRef.current.style.removeProperty('border-radius');
      highlightedElRef.current = null;
    }
    setExiting(true);
    try {
      localStorage.setItem(TUTORIAL_SEEN_KEY, 'true');
    } catch {
      // ignore
    }
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
      onDismiss?.();
    }, 300);
  }, [onDismiss]);

  const next = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      // User completed the tutorial (clicked "Share Now")
      dismiss();
      onComplete?.();
    }
  }, [currentStep, dismiss, onComplete]);

  const prev = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  // Keyboard navigation
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        next();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, next, prev, dismiss]);

  if (!visible) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-300 ${exiting ? 'opacity-0' : 'opacity-100'}`}
      role="dialog"
      aria-modal="true"
      aria-label="Planner tutorial"
    >
      {/* Backdrop - click to dismiss */}
      <div className="absolute inset-0 bg-black/50" onClick={dismiss} />

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        style={tooltipStyle}
        className={`z-[52] transition-all duration-300 ease-out ${
          exiting ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 pt-4 pb-1">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? 'w-6 bg-primary'
                    : i < currentStep
                      ? 'w-1.5 bg-primary/40'
                      : 'w-1.5 bg-slate-300 dark:bg-slate-600'
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          {/* Content */}
          <div className="px-5 py-3 text-center">
            <div className="text-3xl mb-2" aria-hidden="true">
              {step.emoji}
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">{step.title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{step.description}</p>
          </div>

          {/* Actions */}
          <div className="px-5 pb-4 flex items-center gap-3">
            <button
              onClick={dismiss}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              Skip
            </button>
            <div className="flex-1" />
            {currentStep > 0 && (
              <button
                onClick={prev}
                className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="px-4 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              {isLast ? 'Share Now' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Button to replay the tutorial from settings or help */
export function TutorialReplayButton() {
  return (
    <button
      onClick={() => {
        try {
          localStorage.removeItem(TUTORIAL_SEEN_KEY);
        } catch {
          // ignore
        }
        window.location.reload();
      }}
      className="text-sm text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-white flex items-center gap-1.5"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      Replay tutorial
    </button>
  );
}
