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
          <label className="block text-sm font-medium text-[#1D1D1D] mb-1.5 px-0.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-4 py-2 bg-white border ${error ? 'border-red-500' : 'border-[#D1D5DB]'
            } rounded-md text-[#1D1D1D] text-sm shadow-none focus:outline-none focus:ring-1 focus:ring-[#10A37F] focus:border-[#10A37F] transition-all duration-200 placeholder:text-[#8E8EA0] ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
