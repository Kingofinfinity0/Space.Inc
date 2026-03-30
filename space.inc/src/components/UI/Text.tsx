import React from 'react';

interface TextProps {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'muted' | 'accent';
    size?: 'xs' | 'sm' | 'base' | 'lg';
    className?: string;
}

export const Text: React.FC<TextProps> = ({ children, variant = 'primary', size = 'base', className = '' }) => {
    const colorStyles = {
        primary: "text-black dark:text-white",
        secondary: "text-zinc-600 dark:text-zinc-400",
        muted: "text-zinc-400 dark:text-zinc-500",
        accent: "text-black dark:text-white"
    };

    const sizeStyles = {
        xs: "text-xs",
        sm: "text-sm",
        base: "text-base",
        lg: "text-lg"
    };

    return (
        <p className={`${colorStyles[variant]} ${sizeStyles[size]} ${className}`}>
            {children}
        </p>
    );
};
