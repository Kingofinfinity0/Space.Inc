import React from 'react';

type EmptyStateSize = 'compact' | 'default';

type EmptyStateProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  illustrationSrc?: string;
  illustrationAlt?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  mediaClassName?: string;
  size?: EmptyStateSize;
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  illustrationSrc,
  illustrationAlt = '',
  icon,
  action,
  children,
  className = '',
  mediaClassName = '',
  size = 'default',
}) => {
  const isCompact = size === 'compact';
  const hasMedia = Boolean(illustrationSrc || icon);

  return (
    <div
      className={`flex min-h-full w-full flex-col items-center justify-center text-center ${
        isCompact ? 'px-3 py-4' : 'px-6 py-10'
      } ${className}`}
    >
      {hasMedia ? (
        <div
          className={`mb-3 flex shrink-0 items-center justify-center overflow-hidden ${
            isCompact ? 'h-20 w-24' : 'h-28 w-36'
          } ${mediaClassName}`}
        >
          {illustrationSrc ? (
            <img
              src={illustrationSrc}
              alt={illustrationAlt}
              className="h-full w-full object-contain"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] text-[#6E6E80]">
              {icon}
            </span>
          )}
        </div>
      ) : null}

      <div className={isCompact ? 'max-w-[220px]' : 'max-w-sm'}>
        <p
          className={`font-medium leading-[var(--line-height-snug)] ${
            isCompact
              ? 'text-[length:var(--font-size-xs)] text-[#6E6E80]'
              : 'text-[length:var(--font-size-sm)] text-[#0D0D0D]'
          }`}
        >
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-[length:var(--font-size-xs)] leading-[var(--line-height-snug)] text-[#8F8F9A]">
            {description}
          </p>
        ) : null}
      </div>

      {action || children ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
          {children}
        </div>
      ) : null}
    </div>
  );
};
