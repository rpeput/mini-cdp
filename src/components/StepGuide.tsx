import { Check } from 'lucide-react';

export interface GuideStep {
  label: string;
  /** One short line shown only while this step is the current one. */
  hint: string;
}

interface StepGuideProps {
  steps: GuideStep[];
  /** Zero-based index of the step the user should do next. */
  current: number;
  label: string;
}

/** A quiet progress strip: finished steps get a tick, the current one is highlighted and says what to do. */
export function StepGuide({ steps, current, label }: StepGuideProps) {
  return (
    <nav className="step-guide" aria-label={label}>
      <ol>
        {steps.map((step, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'todo';
          return (
            <li key={step.label} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="step-mark" aria-hidden="true">{state === 'done' ? <Check size={14} /> : index + 1}</span>
              <span className="step-text">
                <strong>{step.label}</strong>
                {state === 'current' && <small>{step.hint}</small>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
