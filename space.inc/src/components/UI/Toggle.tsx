import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label }) => {
  return (
    <label className="group inline-flex items-center gap-[var(--space-gap-sm)] whitespace-nowrap">
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={`relative flex h-[var(--size-control-xs)] w-[var(--size-control-xl)] items-center rounded-[var(--radius-pill)] border p-[var(--space-1)] transition-all duration-100 ease-out active:scale-95 ${
          checked
            ? 'border-[color:var(--theme-accent)] bg-[color:var(--theme-accent)]'
            : 'border-[color:var(--border)] bg-[color:var(--bg-base)]'
        }`}
      >
        <span
          className={`h-[var(--size-icon-md)] w-[var(--size-icon-md)] rounded-[var(--radius-pill)] bg-white shadow-[0_8px_20px_rgba(0,0,0,0.18)] transition-all duration-100 ease-out ${
            checked ? 'translate-x-[var(--size-icon-md)] bg-[color:var(--theme-on-accent)]' : 'translate-x-0 bg-[color:var(--text-muted)]'
          }`}
        />
      </button>
      {label && <span className="text-[length:var(--font-size-sm)] font-medium text-[color:var(--text-primary)]">{label}</span>}
    </label>
  );
};
