import React from 'react';

interface HeadingProps {
    children: React.ReactNode;
    level?: 1 | 2 | 3 | 4 | 5 | 6;
    className?: string;
}

export const Heading: React.FC<HeadingProps> = ({ children, level = 2, className = '' }) => {
    const Tag = `h${level}` as any;

    const weightStyle = level === 1 ? "font-normal" : level === 2 ? "font-bold" : "font-medium";
    const baseStyles = `${weightStyle} tracking-tight text-[color:var(--text-primary)]`;
    const sizeStyles = {
        1: "section-heading text-[35px] leading-[0.95] tracking-[-0.03em]",
        2: "text-2xl md:text-3xl",
        3: "text-xl md:text-2xl",
        4: "text-lg md:text-xl",
        5: "text-base md:text-lg",
        6: "text-sm md:text-base",
    };

    return (
        <Tag className={`font-sans ${baseStyles} ${sizeStyles[level]} ${className}`}>
            {children}
        </Tag>
    );
};
