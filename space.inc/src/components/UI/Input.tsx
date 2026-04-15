import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-2 block px-0.5 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 bg-[rgba(8,10,15,0.68)] backdrop-blur-xl ${error ? 'border-red-400/45' : 'border-white/10'} focus:border-emerald-400/45 focus:bg-[rgba(11,14,19,0.88)] focus:outline-none focus:shadow-[0_18px_40px_rgba(0,0,0,0.22)] ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-2 text-xs text-red-300">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
