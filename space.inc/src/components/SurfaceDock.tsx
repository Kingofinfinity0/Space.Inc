import React from 'react';

export type SurfaceDockItem = {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  isActive?: boolean;
  badge?: string | number;
};

type Props = {
  items: SurfaceDockItem[];
  className?: string;
};

export function SurfaceDock({ items, className = '' }: Props) {
  return (
    <nav className={`fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 md:bottom-8 ${className}`}>
      <div className="dock-shell dock-enter flex max-w-[calc(100vw-2rem)] items-center gap-2 overflow-x-auto rounded-[999px] px-2 py-2">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              aria-label={item.label}
              onClick={item.onClick}
              style={{ animationDelay: `${index * 20}ms` }}
              className={`group relative flex h-10 shrink-0 items-center overflow-hidden border transition-[width,background-color,border-color,color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.98] ${
                item.isActive
                  ? 'dock-morph-enter w-[108px] justify-start rounded-[999px] border-[#DADADA] bg-[#F7F7F8] px-3.5 text-[#0D0D0D]'
                  : 'w-10 justify-center rounded-full border-transparent bg-transparent px-0 text-[#6E6E80] hover:border-[#DADADA] hover:bg-[#F7F7F8] hover:text-[#0D0D0D]'
              }`}
            >
              <Icon size={16} className="shrink-0" />
              <span className={`dock-tab-label ml-1.5 whitespace-nowrap text-[11px] font-medium ${item.isActive ? 'opacity-100' : 'w-0 overflow-hidden opacity-0'}`}>
                {item.label}
              </span>
              {item.badge ? (
                <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-1.5 py-0.5 text-[10px] font-semibold text-[#6E6E80]">
                  {item.badge}
                </span>
              ) : null}
              <span className="tooltip-enter pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full border border-[#DADADA] bg-white px-2.5 py-1 text-[11px] font-medium text-[#0D0D0D] shadow-[0_1px_3px_rgba(0,0,0,0.06)] group-hover:block">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
