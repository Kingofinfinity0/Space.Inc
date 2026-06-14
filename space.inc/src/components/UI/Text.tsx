import React from 'react';

interface TextProps {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'muted' | 'accent';
    size?: 'xs' | 'sm' | 'base' | 'lg';
    className?: string;
}

export const Text: React.FC<TextProps> = ({ children, variant = 'primary', size = 'base', className = '' }) => {
    const colorStyles = {
        primary: "text-[color:var(--text-primary)]",
        secondary: "text-[color:var(--text-muted)]",
        muted: "text-[color:var(--text-muted)]",
        accent: "text-[color:var(--theme-accent)]"
    };

    const weightStyles = {
        primary: "font-normal",
        secondary: "font-extralight",
        muted: "font-extralight",
        accent: "font-normal"
    };

    const sizeStyles = {
        xs: "text-[length:var(--font-size-xs)] leading-[var(--line-height-snug)]",
        sm: "text-[length:var(--font-size-sm)] leading-[var(--line-height-body)]",
        base: "text-[length:var(--font-size-body)] leading-[var(--line-height-body)]",
        lg: "text-[length:var(--font-size-lg)] leading-[var(--line-height-relaxed)]"
    };

    return (
        <p className={`${colorStyles[variant]} ${weightStyles[variant]} ${sizeStyles[size]} ${className}`}>
            {children}
        </p>
    );
};
