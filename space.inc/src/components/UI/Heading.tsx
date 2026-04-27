import React from 'react';

interface HeadingProps {
    children: React.ReactNode;
    level?: 1 | 2 | 3 | 4 | 5 | 6;
    className?: string;
}

export const Heading: React.FC<HeadingProps> = ({ children, level = 2, className = '' }) => {
    const Tag = `h${level}` as any;

    const baseStyles = "font-semibold tracking-tight text-[#0D0D0D]";
    const sizeStyles = {
        1: "text-3xl md:text-4xl",
        2: "text-2xl md:text-3xl",
        3: "text-xl md:text-2xl",
        4: "text-lg md:text-xl",
        5: "text-base md:text-lg",
        6: "text-sm md:text-base",
    };

    return (
        <Tag className={`font-serif ${baseStyles} ${sizeStyles[level]} ${className}`}>
            {children}
        </Tag>
    );
};
