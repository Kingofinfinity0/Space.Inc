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
        <label className={`flex items-center gap-3 cursor-pointer group ${className}`}>
            <div
                onClick={() => onChange(!checked)}
                className={`w-5 h-5 rounded border transition-all duration-200 flex items-center justify-center
                    ${checked
                        ? 'bg-[#10A37F] border-[#10A37F]'
                        : 'bg-white border-[#D1D5DB] hover:border-[#10A37F]'}
                `}
            >
                {checked && <Check size={14} className="text-white" strokeWidth={3} />}
            </div>
            {label && <span className="text-sm font-medium text-[#1D1D1D]">{label}</span>}
        </label>
    );
};
