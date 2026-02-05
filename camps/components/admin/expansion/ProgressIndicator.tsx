'use client';

import { ExpansionStatus } from './types';

const STEPS: { key: ExpansionStatus | 'complete'; label: string }[] = [
  { key: 'not_started', label: 'Start' },
  { key: 'domain_purchased', label: 'Domain' },
  { key: 'dns_configured', label: 'DNS' },
  { key: 'city_created', label: 'City' },
  { key: 'launched', label: 'Launch' },
];

interface ProgressIndicatorProps {
  currentStatus: ExpansionStatus;
  activeStep: number;
}

export function ProgressIndicator({ currentStatus, activeStep }: ProgressIndicatorProps) {
  const statusToStep: Record<ExpansionStatus, number> = {
    not_started: 0,
    domain_purchased: 1,
    dns_configured: 2,
    city_created: 3,
    launched: 4,
  };

  const completedStep = statusToStep[currentStatus];

  return (
    <div className="flex items-center justify-between">
      {STEPS.map((step, index) => {
        const isCompleted = index <= completedStep;
        const isActive = index === activeStep;
        const isCurrent = index === completedStep + 1;

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  transition-colors duration-200
                  ${isCompleted
                    ? 'bg-green-500 text-white'
                    : isActive || isCurrent
                      ? 'bg-primary text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }
                `}
              >
                {isCompleted ? (
                  <CheckIcon />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`
                  mt-1 text-xs
                  ${isCompleted || isActive
                    ? 'text-slate-900 dark:text-white font-medium'
                    : 'text-slate-500 dark:text-slate-400'
                  }
                `}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {index < STEPS.length - 1 && (
              <div
                className={`
                  flex-1 h-0.5 mx-2 transition-colors duration-200
                  ${index < completedStep
                    ? 'bg-green-500'
                    : 'bg-slate-200 dark:bg-slate-700'
                  }
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
