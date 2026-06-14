import React from 'react';

interface HeadingProps {
    children: React.ReactNode;
    level?: 1 | 2 | 3 | 4 | 5 | 6;
    className?: string;
}

export const Heading: React.FC<HeadingProps> = ({ children, level = 2, className = '' }) => {
    const Tag = `h${level}` as any;

    const weightStyle = level === 1 ? "font-normal" : level === 2 ? "font-bold" : "font-medium";
    const baseStyles = `${weightStyle} tracking-[var(--tracking-tight)] text-[color:var(--text-primary)]`;
    const sizeStyles = {
        1: "section-heading text-[length:var(--font-size-section)] leading-[var(--line-height-section)] tracking-[var(--tracking-section)]",
        2: "text-[length:var(--font-size-title-lg)] leading-[var(--line-height-tight)] md:text-[length:var(--font-size-display)]",
        3: "text-[length:var(--font-size-title)] leading-[var(--line-height-tight)] md:text-[length:var(--font-size-title-lg)]",
        4: "text-[length:var(--font-size-xl)] leading-[var(--line-height-snug)] md:text-[length:var(--font-size-title)]",
        5: "text-[length:var(--font-size-lg)] leading-[var(--line-height-snug)] md:text-[length:var(--font-size-xl)]",
        6: "text-[length:var(--font-size-body)] leading-[var(--line-height-snug)] md:text-[length:var(--font-size-lg)]",
    };

    return (
        <Tag className={`font-sans ${baseStyles} ${sizeStyles[level]} ${className}`}>
            {children}
        </Tag>
    );
};
