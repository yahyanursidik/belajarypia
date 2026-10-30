import { Check } from "lucide-react";
export function WizardSteps({ steps, current }: { steps: string[]; current: number }) {
  return <ol className="wizard-steps" aria-label="Langkah pengaturan">
    {steps.map((step, index) => <li key={step} aria-current={current === index ? "step" : undefined} data-complete={current > index}>
      <span>{current > index ? <Check size={15} aria-hidden="true" /> : index + 1}</span><strong>{step}</strong>
    </li>)}
  </ol>;
}
