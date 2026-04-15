import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'link' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  disabled,
  icon,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-full border text-sm font-medium tracking-[-0.01em] transition-all duration-[260ms] [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.95] active:translate-y-[1px]';

  const variantStyles = {
    primary: 'border-emerald-400/30 bg-emerald-400 text-slate-950 shadow-[0_18px_40px_rgba(16,185,129,0.28)] hover:bg-emerald-300 hover:shadow-[0_28px_60px_rgba(16,185,129,0.18)]',
    secondary: 'border-white/8 bg-white/[0.08] text-slate-100 hover:bg-white/[0.14] hover:border-white/14',
    ghost: 'border-transparent bg-transparent text-slate-300 hover:bg-white/[0.08] hover:text-white',
    outline: 'border-white/10 bg-slate-950/30 text-slate-100 hover:bg-white/[0.08] hover:border-white/18',
    link: 'border-transparent bg-transparent px-0 text-slate-200 hover:text-white',
    danger: 'border-red-400/20 bg-red-500/80 text-white shadow-[0_18px_36px_rgba(239,68,68,0.22)] hover:bg-red-400',
  };

  const sizeStyles = {
    sm: 'h-9 px-3.5 text-xs',
    md: 'h-11 px-4.5 text-sm',
    lg: 'h-12 px-6 text-[15px]',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="h-4 w-4 animate-spin text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-80"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Loading...
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
};
