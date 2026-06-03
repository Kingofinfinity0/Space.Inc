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
  const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-full border font-medium tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--theme-accent-soft)] focus-visible:ring-offset-0 disabled:opacity-50 disabled:pointer-events-none';

  const variantStyles = {
    primary: 'border-[color:var(--theme-accent-muted)] bg-[color:var(--theme-accent-muted)] text-white hover:border-[color:var(--theme-accent-soft)] hover:bg-[color:var(--theme-accent-soft)]',
    secondary: 'border-[color:var(--theme-accent-surface)] bg-[color:var(--theme-accent-surface)] text-[color:var(--theme-accent)] hover:border-[color:var(--theme-accent-surface)] hover:bg-[color:var(--theme-accent-surface)]',
    ghost: 'border-transparent bg-transparent text-[color:var(--text-primary)] hover:bg-[color:var(--bg-hover)] hover:text-[color:var(--text-primary)]',
    outline: 'border-[color:var(--border)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] hover:border-[color:var(--border)] hover:bg-[color:var(--bg-hover)]',
    link: 'border-transparent bg-transparent px-0 text-[color:var(--theme-accent)] hover:text-[color:var(--theme-accent-hover)]',
    danger: 'border-[#E5E5E5] bg-white text-[#B42318] hover:bg-[#FEF2F2]',
  };

  const sizeStyles = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-5 text-[15px]',
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
