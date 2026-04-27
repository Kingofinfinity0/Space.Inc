import React from 'react';

export const NavItem = ({ icon, label, active, onClick, badge }: { icon: any; label: string; active?: boolean; onClick?: () => void; badge?: number }) => (
  <button
    onClick={onClick}
    className={`group interactive-surface flex w-full items-center justify-between rounded-[8px] border px-3 py-2.5 text-left ${
      active
        ? 'border-[#E5E5E5] bg-white text-[#0D0D0D]'
        : 'border-transparent bg-transparent text-[#6E6E80] hover:border-[#E5E5E5] hover:bg-[#F7F7F8] hover:text-[#0D0D0D]'
    }`}
  >
    <div className="flex items-center gap-3">
      <div className={`${active ? 'text-[#0D0D0D]' : 'text-[#6E6E80] group-hover:text-[#0D0D0D]'}`}>
        {icon}
      </div>
      <span className="text-sm font-medium tracking-[-0.01em]">{label}</span>
    </div>
    {badge !== undefined && badge > 0 && (
      <span className="min-w-[20px] rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-1.5 py-0.5 text-center text-[10px] font-semibold text-[#6E6E80]">
        {badge}
      </span>
    )}
  </button>
);

export const AppLayout: React.FC<{ children: React.ReactNode; sidebar: React.ReactNode }> = ({ children, sidebar }) => (
  <div className="relative flex min-h-[100svh] overflow-x-hidden bg-[#FFFFFF] font-sans text-[#0D0D0D]">
    {sidebar}
    <main className="relative flex min-h-[100svh] flex-1 overflow-visible">
      {children}
    </main>
  </div>
);

export const ClientLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-[100svh] bg-[#FFFFFF] font-sans text-[#0D0D0D]">
    {children}
  </div>
);
