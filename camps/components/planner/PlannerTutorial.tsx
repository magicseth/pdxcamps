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
  /** If true, skip this step when the target element isn't found */
  optional?: boolean;
  /** Selector for a specific sub-element to spotlight (everything else gets dimmed) */
  spotlightSelector?: string;
}

const steps: TutorialStep[] = [
  {
    title: 'Your summer at a glance',
    description:
      'This is your planner. Each row is one of your kids, and each column is a week from June through August.',
    emoji: '📅',
    target: 'grid',
    placement: 'below',
  },
  {
    title: 'Spot the gaps',
    description:
      'Orange cells are weeks that still need a camp. Green means registered. Blue means a family event has that week covered.',
    emoji: '🎨',
    target: 'grid',
    placement: 'below',
    spotlightSelector: 'first-gap-row',
  },
  {
    title: 'Tap a gap to fill it',
    description:
      'Click any orange cell to see camps available that week, already filtered for your child\u2019s age and schedule.',
    emoji: '👆',
    target: 'grid',
    placement: 'below',
    spotlightSelector: 'first-numbered-gap',
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
  const [ready, setReady] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [activeSteps, setActiveSteps] = useState<TutorialStep[]>(steps);
  // Overlay rects for dimming everything except a sub-region of the grid
  const [innerSpotlight, setInnerSpotlight] = useState<SpotlightRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const highlightedElRef = useRef<HTMLElement | null>(null);
  const boostedParentsRef = useRef<{ el: HTMLElement; origZIndex: string }[]>([]);

  useEffect(() => {
    try {
      if (localStorage.getItem(TUTORIAL_SEEN_KEY)) return;
    } catch {
      return;
    }
    // Filter out optional steps whose targets don't exist in the DOM.
    // Retry a few times since Convex data may still be loading.
    let attempt = 0;
    const maxAttempts = 5;
    const checkAndShow = () => {
      attempt++;
      const available = steps.filter((step) => {
        if (!step.optional) return true;
        if (!step.target) return true;
        return !!document.querySelector(`[data-tutorial="${step.target}"]`);
      });
      // If optional targets are missing and we haven't exhausted retries, try again
      if (available.length < steps.length && attempt < maxAttempts) {
        timer = setTimeout(checkAndShow, 1000);
        return;
      }
      setActiveSteps(available);
      setVisible(true);
    };
    let timer = setTimeout(checkAndShow, 1000);
    return () => clearTimeout(timer);
  }, []);

  /** Clean up z-index boosts on parent stacking contexts */
  const cleanupBoostedParents = useCallback(() => {
    for (const { el, origZIndex } of boostedParentsRef.current) {
      if (origZIndex) {
        el.style.zIndex = origZIndex;
      } else {
        el.style.removeProperty('z-index');
      }
    }
    boostedParentsRef.current = [];
  }, []);

  // Position spotlight and tooltip when step changes
  const positionSpotlight = useCallback(() => {
    if (!visible) return;
    const step = activeSteps[currentStep];
    if (!step) return;

    // Clean up previous highlight
    if (highlightedElRef.current) {
      highlightedElRef.current.style.removeProperty('position');
      highlightedElRef.current.style.removeProperty('z-index');
      highlightedElRef.current.style.removeProperty('box-shadow');
      highlightedElRef.current.style.removeProperty('border-radius');
      highlightedElRef.current = null;
    }
    cleanupBoostedParents();
    setInnerSpotlight(null);

    if (!step.target) {
      setSpotlight(null);
      setTooltipStyle({ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '340px' });
      setReady(true);
      return;
    }

    const el = document.querySelector(`[data-tutorial="${step.target}"]`) as HTMLElement | null;
    if (!el) {
      setSpotlight(null);
      setTooltipStyle({ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '340px' });
      setReady(true);
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

        // Handle inner spotlight for specific sub-elements
        if (step.spotlightSelector) {
          const innerRect = findSpotlightTarget(step.spotlightSelector, el);
          if (innerRect) {
            setInnerSpotlight(innerRect);
          }
        }

        // Lift element above overlay — also boost any ancestor stacking contexts
        highlightedElRef.current = el;
        const computedPos = window.getComputedStyle(el).position;
        if (computedPos === 'static') {
          el.style.position = 'relative';
        }
        el.style.zIndex = '51';
        el.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.2)';
        el.style.borderRadius = '8px';

        // Walk up ancestors and boost any that create stacking contexts (e.g. sticky header)
        let parent = el.parentElement;
        while (parent && parent !== document.body) {
          const style = window.getComputedStyle(parent);
          const zIndex = style.zIndex;
          if (zIndex !== 'auto' && parseInt(zIndex, 10) < 51) {
            boostedParentsRef.current.push({ el: parent, origZIndex: parent.style.zIndex });
            parent.style.zIndex = '51';
          }
          parent = parent.parentElement;
        }

        // Position tooltip
        const viewportRect = el.getBoundingClientRect();
        const tooltipWidth = 340;

        let top: number;
        let left = Math.max(16, Math.min(viewportRect.left + viewportRect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16));

        const tooltipH = 200; // estimated max tooltip height
        const minTop = 16; // never go above this

        if (step.placement === 'below') {
          top = viewportRect.bottom + HIGHLIGHT_PAD + 12;
          // If tooltip would go off-screen bottom, flip above
          if (top + tooltipH > window.innerHeight) {
            top = Math.max(minTop, viewportRect.top - HIGHLIGHT_PAD - 12 - tooltipH);
          }
        } else if (step.placement === 'above') {
          top = viewportRect.top - HIGHLIGHT_PAD - 12 - tooltipH;
          // If above goes off-screen, flip below
          if (top < minTop) {
            top = viewportRect.bottom + HIGHLIGHT_PAD + 12;
          }
        } else {
          top = Math.max(minTop, (window.innerHeight - tooltipH) / 2);
        }

        // Final clamp: never let tooltip go above viewport
        top = Math.max(minTop, top);

        setTooltipStyle({
          position: 'fixed',
          top: `${top}px`,
          left: `${left}px`,
          width: `${tooltipWidth}px`,
        });
        setReady(true);
      }, 350); // wait for scroll
    });
  }, [visible, currentStep, activeSteps, cleanupBoostedParents]);

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
    cleanupBoostedParents();
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
  }, [onDismiss, cleanupBoostedParents]);

  const next = useCallback(() => {
    if (currentStep < activeSteps.length - 1) {
      setReady(false);
      setCurrentStep((s) => s + 1);
    } else {
      // User completed the tutorial (clicked "Share Now")
      dismiss();
      onComplete?.();
    }
  }, [currentStep, activeSteps.length, dismiss, onComplete]);

  const prev = useCallback(() => {
    if (currentStep > 0) {
      setReady(false);
      setCurrentStep((s) => s - 1);
    }
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

  const step = activeSteps[currentStep];
  const isLast = currentStep === activeSteps.length - 1;
  if (!step) return null;

  // Don't render until positioning is computed to avoid flash at 0,0
  const opacity = ready && !exiting ? 1 : 0;

  return (
    <>
      {/* Backdrop - separate stacking context at z-50 */}
      <div
        className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-300"
        style={{ opacity }}
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Inner spotlight overlay: dims the grid except the target sub-region */}
      {innerSpotlight && spotlight && ready && (
        <InnerDimOverlay
          gridRect={{
            top: spotlight.top - window.scrollY,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
          holeRect={innerSpotlight}
          opacity={opacity}
        />
      )}

      {/* Tooltip card - separate stacking context at z-[52], above highlighted elements at z-51 */}
      <div
        ref={tooltipRef}
        style={{ ...tooltipStyle, opacity, transition: 'opacity 300ms ease-out' }}
        role="dialog"
        aria-modal="true"
        aria-label="Planner tutorial"
        className="fixed z-[52]"
      >
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 pt-4 pb-1">
            {activeSteps.map((_, i) => (
              <button
                key={i}
                onClick={() => { setReady(false); setCurrentStep(i); }}
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
    </>
  );
}

/**
 * Renders 4 semi-transparent rectangles around a "hole" inside a grid region,
 * dimming the grid except for the hole area.
 */
function InnerDimOverlay({
  gridRect,
  holeRect,
  opacity,
}: {
  gridRect: SpotlightRect;
  holeRect: SpotlightRect;
  opacity: number;
}) {
  const dimColor = 'rgba(0,0,0,0.55)';
  // Compute hole position relative to the grid
  const holeTop = holeRect.top - gridRect.top;
  const holeLeft = holeRect.left - gridRect.left;
  const holeBottom = holeTop + holeRect.height;
  const holeRight = holeLeft + holeRect.width;

  return (
    <div
      className="fixed z-[51] pointer-events-none"
      style={{ opacity, transition: 'opacity 300ms', top: gridRect.top, left: gridRect.left, width: gridRect.width, height: gridRect.height }}
    >
      {/* Top strip */}
      {holeTop > 0 && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: holeTop, background: dimColor }} />
      )}
      {/* Bottom strip */}
      {holeBottom < gridRect.height && (
        <div style={{ position: 'absolute', top: holeBottom, left: 0, width: '100%', height: gridRect.height - holeBottom, background: dimColor }} />
      )}
      {/* Left strip (between top and bottom) */}
      {holeLeft > 0 && (
        <div style={{ position: 'absolute', top: holeTop, left: 0, width: holeLeft, height: holeRect.height, background: dimColor }} />
      )}
      {/* Right strip (between top and bottom) */}
      {holeRight < gridRect.width && (
        <div style={{ position: 'absolute', top: holeTop, left: holeRight, width: gridRect.width - holeRight, height: holeRect.height, background: dimColor }} />
      )}
    </div>
  );
}

/**
 * Find the bounding rect for a spotlight sub-target within the grid.
 * - 'first-gap-row': finds the first row of gap cells (orange) and highlights them
 * - 'first-numbered-gap': finds the first gap cell that has a number in it
 */
function findSpotlightTarget(selector: string, gridEl: HTMLElement): SpotlightRect | null {
  if (selector === 'first-gap-row') {
    // Find all gap cells, group by row (same top position), return the first row's bounds
    const gapCells = gridEl.querySelectorAll('[data-tutorial="gap"]');
    if (gapCells.length === 0) return null;

    // Get all gap cells and group by approximate Y position (same row)
    const cellsByRow = new Map<number, DOMRect[]>();
    gapCells.forEach((cell) => {
      const rect = cell.getBoundingClientRect();
      // Round to nearest 5px to group cells in the same row
      const rowKey = Math.round(rect.top / 5) * 5;
      if (!cellsByRow.has(rowKey)) cellsByRow.set(rowKey, []);
      cellsByRow.get(rowKey)!.push(rect);
    });

    // Get the first row (smallest Y)
    const sortedRows = [...cellsByRow.entries()].sort((a, b) => a[0] - b[0]);
    if (sortedRows.length === 0) return null;
    const firstRowCells = sortedRows[0][1];

    // Compute bounding box of all cells in the first row
    const minLeft = Math.min(...firstRowCells.map((r) => r.left));
    const maxRight = Math.max(...firstRowCells.map((r) => r.right));
    const minTop = Math.min(...firstRowCells.map((r) => r.top));
    const maxBottom = Math.max(...firstRowCells.map((r) => r.bottom));

    return {
      top: minTop - 4,
      left: minLeft - 4,
      width: maxRight - minLeft + 8,
      height: maxBottom - minTop + 8,
    };
  }

  if (selector === 'first-numbered-gap') {
    // Find the first gap cell that contains a number (available camp count)
    const gapCells = gridEl.querySelectorAll('[data-tutorial="gap"]');
    for (const cell of gapCells) {
      const text = cell.textContent?.trim() || '';
      if (/^\d+$/.test(text) && parseInt(text, 10) > 0) {
        const rect = cell.getBoundingClientRect();
        return {
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
        };
      }
    }
    // Fallback to first gap cell
    if (gapCells.length > 0) {
      const rect = gapCells[0].getBoundingClientRect();
      return {
        top: rect.top - 4,
        left: rect.left - 4,
        width: rect.width + 8,
        height: rect.height + 8,
      };
    }
    return null;
  }

  return null;
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
