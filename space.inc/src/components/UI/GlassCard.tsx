import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', onClick, style }) => {
  return (
    <div
      onClick={onClick}
      style={style}
      className={[
        'glass-surface rounded-[28px] text-[color:var(--text-primary)] interactive-surface',
        onClick ? 'cursor-pointer' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
};
