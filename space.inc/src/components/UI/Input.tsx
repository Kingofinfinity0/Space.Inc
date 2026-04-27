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
          <label className="mb-2 block px-0.5 text-xs font-medium uppercase tracking-[0.18em] text-[#6E6E80]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full rounded-[8px] border border-[#DADADA] bg-white px-4 py-3 text-sm text-[#0D0D0D] placeholder:text-[#6E6E80] focus:border-black focus:outline-none ${error ? 'border-[#B42318]' : ''} ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-2 text-xs text-[#B42318]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
