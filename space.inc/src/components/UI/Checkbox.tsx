import React from 'react';
import { Check } from 'lucide-react';

interface CheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    className?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange, label, className = '' }) => {
    return (
        <label className={`group flex cursor-pointer items-center gap-[var(--space-gap-sm)] ${className}`}>
            <div
                onClick={() => onChange(!checked)}
                className={`flex h-[var(--size-icon-md)] w-[var(--size-icon-md)] items-center justify-center rounded-[var(--radius-xs)] border transition-all duration-200
                    ${checked
                        ? 'border-[color:var(--color-focus)] bg-[color:var(--color-focus)]'
                        : 'border-[color:var(--border)] bg-[color:var(--bg-base)] hover:border-[color:var(--color-focus)]'}
                `}
            >
                {checked && <Check size={14} className="text-white" strokeWidth={3} />}
            </div>
            {label && <span className="text-[length:var(--font-size-sm)] font-medium text-[color:var(--text-primary)]">{label}</span>}
        </label>
    );
};
