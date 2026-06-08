import React from 'react';
import { useParams } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { PermissionMap } from '../../types';
import { LoadingScreen, useLoadingScreenGate } from '../UI';

interface PermissionGuardProps {
    spaceId?: string;
    requiredPermission?: keyof PermissionMap;
    requiredRole?: string;
    fallback?: React.ReactNode;
    children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
    spaceId: propSpaceId,
    requiredPermission,
    requiredRole,
    fallback = <div className="p-8 text-center text-[#6E6E80]">Access Denied</div>,
    children
}) => {
    const params = useParams();
    const spaceId = propSpaceId || params.spaceId;
    const { permissions, isLoading, role } = usePermissions(spaceId);
    const loadingGate = useLoadingScreenGate(isLoading);

    if (loadingGate.isVisible) {
        return (
            <LoadingScreen
                key={loadingGate.cycleKey}
                isComplete={loadingGate.isComplete}
                onExitComplete={loadingGate.handleExitComplete}
            />
        );
    }

    if (requiredRole && role !== requiredRole) {
        return <>{fallback}</>;
    }

    if (requiredPermission && permissions && !permissions[requiredPermission]) {
        return <>{fallback}</>;
    }

    // Default to false if we expected a permission but have none (e.g. error or not found)
    if (requiredPermission && !permissions) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
};
