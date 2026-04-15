import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label }) => {
  return (
    <label className="group inline-flex items-center gap-3 whitespace-nowrap">
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={`relative flex h-7 w-12 items-center rounded-full border p-1 transition-all duration-[260ms] [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] active:scale-95 ${
          checked
            ? 'border-emerald-400/35 bg-emerald-400/20 shadow-[0_12px_30px_rgba(52,211,153,0.18)]'
            : 'border-white/10 bg-white/[0.06]'
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition-all duration-[260ms] [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] ${
            checked ? 'translate-x-5 bg-emerald-300' : 'translate-x-0 bg-slate-200'
          }`}
        />
      </button>
      {label && <span className="text-sm font-medium text-slate-200">{label}</span>}
    </label>
  );
};
