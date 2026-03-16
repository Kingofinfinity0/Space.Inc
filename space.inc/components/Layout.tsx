import React from 'react';

export const NavItem = ({ icon, label, active, onClick, badge }: { icon: any; label: string; active?: boolean; onClick?: () => void; badge?: number }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-all group ${active ? 'bg-white text-[#1D1D1D] shadow-sm font-semibold' : 'text-[#565869] hover:bg-[#D1D5DB]/30 hover:text-[#1D1D1D]'}`}
    >
        <div className="flex items-center gap-3">
            <div className={`transition-colors ${active ? 'text-[#10A37F]' : 'text-[#8E8EA0] group-hover:text-[#1D1D1D]'}`}>
                {icon}
            </div>
            <span className="text-xs">{label}</span>
        </div>
        {badge !== undefined && badge > 0 && (
            <span className="bg-[#10A37F] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{badge}</span>
        )}
    </button>
);

export const AppLayout: React.FC<{ children: React.ReactNode; sidebar: React.ReactNode }> = ({ children, sidebar }) => (
    <div className="flex h-screen bg-[#F7F7F8] font-sans text-[#1D1D1D]">
        {sidebar}
        <main className="flex-1 flex flex-col relative overflow-hidden">
            {children}
        </main>
    </div>
);

export const ClientLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-screen bg-zinc-50 font-sans">
        {children}
    </div>
);
