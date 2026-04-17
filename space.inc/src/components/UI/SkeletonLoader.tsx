import React from 'react';

interface SkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
    type?: string;
}

export const SkeletonLoader: React.FC<SkeletonProps> = ({
    className = '',
    width,
    height,
    borderRadius
}) => {
    return (
        <img
            src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
            alt=""
            width={width}
            height={height}
            className={`skeleton-shimmer bg-[#F7F7F8] relative overflow-hidden border border-[#E5E5E5] block rounded-md ${className}`}
        />
    );
};

export const SkeletonText: React.FC<SkeletonProps & { lines?: number }> = ({
    lines = 1,
    className,
    ...props
}) => {
    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
                <SkeletonLoader
                    key={i}
                    height="1em"
                    width={i === lines - 1 && lines > 1 ? '80%' : '100%'}
                    borderRadius="4px"
                    {...props}
                />
            ))}
        </div>
    );
};

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => {
    return (
        <div className={`p-4 border border-[#E5E5E5] rounded-[8px] shadow-none bg-white ${className}`}>
            <SkeletonLoader height="120px" className="mb-4 rounded-md" />
            <SkeletonText lines={2} />
        </div>
    );
};

export const SkeletonImage: React.FC<SkeletonProps> = (props) => {
    return (
        <SkeletonLoader className="rounded-md" {...props} />
    );
}

export const SkeletonButton: React.FC<{ width?: string }> = ({ width = '100px' }) => {
    return <SkeletonLoader width={width} height="36px" borderRadius="6px" />;
}

export default SkeletonLoader;
