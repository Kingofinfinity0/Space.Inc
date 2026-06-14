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
  const baseStyles = 'ui-control inline-flex items-center justify-center gap-[var(--space-gap-xs)] rounded-[var(--radius-pill)] border font-medium tracking-[var(--tracking-tight)] transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-[var(--motion-fast)] ease-out focus-visible:outline-none focus-visible:ring-[var(--border-width-focus)] focus-visible:ring-[color:var(--theme-accent-soft)] focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-[var(--opacity-disabled)]';

  const variantStyles = {
    primary: 'border-[color:var(--theme-accent-muted)] bg-[color:var(--theme-accent-muted)] text-white hover:border-[color:var(--theme-accent-soft)] hover:bg-[color:var(--theme-accent-soft)]',
    secondary: 'border-[color:var(--theme-accent-surface)] bg-[color:var(--theme-accent-surface)] text-[color:var(--theme-accent)] hover:border-[color:var(--theme-accent-surface)] hover:bg-[color:var(--theme-accent-surface)]',
    ghost: 'border-transparent bg-transparent text-[color:var(--text-primary)] hover:bg-[color:var(--bg-hover)] hover:text-[color:var(--text-primary)]',
    outline: 'border-[color:var(--border)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] hover:border-[color:var(--border)] hover:bg-[color:var(--bg-hover)]',
    link: 'border-transparent bg-transparent px-0 text-[color:var(--theme-accent)] hover:text-[color:var(--theme-accent-hover)]',
    danger: 'border-[color:var(--border)] bg-[color:var(--bg-base)] text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger-surface)]',
  };

  const sizeStyles = {
    sm: 'h-[var(--size-control-sm)] px-[var(--space-inset-control-x-sm)] text-[length:var(--font-size-xs)] leading-[var(--line-height-label)]',
    md: 'h-[var(--size-control-md)] px-[var(--space-inset-control-x-md)] text-[length:var(--font-size-body)] leading-[var(--line-height-label)]',
    lg: 'h-[var(--size-control-lg)] px-[var(--space-inset-control-x-lg)] text-[length:var(--font-size-md)] leading-[var(--line-height-label)]',
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
          className="h-[var(--size-icon-sm)] w-[var(--size-icon-sm)] animate-spin text-current"
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
