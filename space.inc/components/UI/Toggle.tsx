import React from 'react';

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label }) => {
    return (
        <label className="flex items-center gap-3 cursor-pointer group whitespace-nowrap">
            <div
                onClick={() => onChange(!checked)}
                className={`relative w-10 h-6 transition-colors duration-200 rounded-full
                    ${checked ? 'bg-[#10A37F]' : 'bg-[#D1D5DB]'}
                `}
            >
                <div
                    className={`absolute top-1 left-1 w-4 h-4 transition-transform duration-200 bg-white rounded-full shadow-sm
                        ${checked ? 'translate-x-4' : 'translate-x-0'}
                    `}
                />
            </div>
            {label && <span className="text-sm font-medium text-[#1D1D1D]">{label}</span>}
        </label>
    );
};
