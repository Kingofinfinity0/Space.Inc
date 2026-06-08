import React from 'react';
import markDark from '@/assets/brand/vero-mark-dark.png';
import markLight from '@/assets/brand/vero-mark-light.png';

type VeroMarkProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'auto' | 'dark' | 'light';
  imgClassName?: string;
};

export const VeroMark: React.FC<VeroMarkProps> = ({
  tone = 'auto',
  className = '',
  imgClassName = '',
  ...props
}) => {
  return (
    <span className={`inline-flex items-center justify-center ${className}`} {...props}>
      {tone === 'auto' ? (
        <>
          <img
            src={markDark}
            alt=""
            aria-hidden="true"
            className={`block h-full w-full object-contain dark:hidden ${imgClassName}`}
            draggable={false}
          />
          <img
            src={markLight}
            alt=""
            aria-hidden="true"
            className={`hidden h-full w-full object-contain dark:block ${imgClassName}`}
            draggable={false}
          />
        </>
      ) : (
        <img
          src={tone === 'light' ? markLight : markDark}
          alt=""
          aria-hidden="true"
          className={`block h-full w-full object-contain ${imgClassName}`}
          draggable={false}
        />
      )}
    </span>
  );
};

type VeroBrandProps = React.HTMLAttributes<HTMLDivElement> & {
  markTone?: 'auto' | 'dark' | 'light';
  markClassName?: string;
  textClassName?: string;
};

export const VeroBrand: React.FC<VeroBrandProps> = ({
  markTone = 'dark',
  markClassName = '',
  textClassName = '',
  className = '',
  ...props
}) => (
  <div className={`inline-flex items-center gap-3 ${className}`} {...props}>
    <VeroMark tone={markTone} className={markClassName} />
    <span className={textClassName}>Vero</span>
  </div>
);
