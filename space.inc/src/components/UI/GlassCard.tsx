import React from 'react';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', onClick }) => {
    return (
        <div
            onClick={onClick}
            className={`bg-white border border-[#D1D5DB] rounded-lg shadow-none transition-all duration-200 ${onClick ? 'cursor-pointer hover:bg-[#F7F7F8] active:scale-[0.99]' : ''} ${className}`}
        >
            {children}
        </div>
    );
};
