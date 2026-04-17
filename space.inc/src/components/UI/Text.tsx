import React from 'react';

interface TextProps {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'muted' | 'accent';
    size?: 'xs' | 'sm' | 'base' | 'lg';
    className?: string;
}

export const Text: React.FC<TextProps> = ({ children, variant = 'primary', size = 'base', className = '' }) => {
    const colorStyles = {
        primary: "text-[#0D0D0D]",
        secondary: "text-[#6E6E80]",
        muted: "text-[#6E6E80]",
        accent: "text-[#0D0D0D]"
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
