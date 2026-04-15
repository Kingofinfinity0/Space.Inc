import React from 'react';

export const NavItem = ({ icon, label, active, onClick, badge }: { icon: any; label: string; active?: boolean; onClick?: () => void; badge?: number }) => (
  <button
    onClick={onClick}
    className={`interactive-surface flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-left ${
      active
        ? 'border-white/10 bg-white/[0.1] text-white shadow-[0_20px_40px_rgba(0,0,0,0.18)]'
        : 'border-transparent bg-transparent text-slate-400 hover:border-white/8 hover:bg-white/[0.06] hover:text-white'
    }`}
  >
    <div className="flex items-center gap-3">
      <div className={active ? 'text-emerald-300' : 'text-slate-500 group-hover:text-slate-100'}>
        {icon}
      </div>
      <span className="text-sm font-medium tracking-[-0.01em]">{label}</span>
    </div>
    {badge !== undefined && badge > 0 && (
      <span className="min-w-[20px] rounded-full border border-emerald-400/25 bg-emerald-400/20 px-1.5 py-0.5 text-center text-[10px] font-semibold text-emerald-200">
        {badge}
      </span>
    )}
  </button>
);

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative flex min-h-screen bg-white dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,0,0,0.02),_transparent_34%),radial-gradient(circle_at_bottom,_rgba(52,211,153,0.04),_transparent_24%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.05),_transparent_34%)]" />
    <main className="relative flex min-h-screen flex-1 overflow-hidden">
      {children}
    </main>
  </div>
);

export const ClientLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-white dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100">
    {children}
  </div>
);
