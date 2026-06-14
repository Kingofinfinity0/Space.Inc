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
          <label className="ui-field-label mb-[var(--space-stack-tight)] block px-[var(--space-0-5)]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`ui-input px-[var(--space-inset-control-x-md)] py-[var(--space-inset-control-y-lg)] placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--color-focus)] focus:outline-none ${error ? 'border-[color:var(--color-danger)]' : ''} ${className}`}
          {...props}
        />
        {error && (
          <p className="ui-field-error mt-[var(--space-stack-tight)]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
