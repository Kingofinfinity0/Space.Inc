import React from 'react';

interface HeadingProps {
    children: React.ReactNode;
    level?: 1 | 2 | 3 | 4 | 5 | 6;
    className?: string;
}

export const Heading: React.FC<HeadingProps> = ({ children, level = 2, className = '' }) => {
    const Tag = `h${level}` as any;

    const baseStyles = "font-bold tracking-tight text-black dark:text-white";
    const sizeStyles = {
        1: "text-4xl md:text-5xl",
        2: "text-3xl md:text-4xl",
        3: "text-2xl md:text-3xl",
        4: "text-xl md:text-2xl",
        5: "text-lg md:text-xl",
        6: "text-base md:text-lg",
    };

    return (
        <Tag className={`${baseStyles} ${sizeStyles[level]} ${className}`}>
            {children}
        </Tag>
    );
};
