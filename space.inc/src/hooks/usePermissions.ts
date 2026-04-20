import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { PermissionMap } from '../types';

// Simple session-based cache
const permissionCache: Record<string, PermissionMap> = {};

export function usePermissions(spaceId?: string) {
    const navigate = useNavigate();
    const [permissions, setPermissions] = useState<PermissionMap | null>(
        spaceId ? (permissionCache[spaceId] || null) : null
    );
    const [isLoading, setIsLoading] = useState(!!spaceId && !permissionCache[spaceId]);
    const [error, setError] = useState<any>(null);

    useEffect(() => {
        if (!spaceId) {
            setPermissions(null);
            setIsLoading(false);
            return;
        }

        if (permissionCache[spaceId]) {
            setPermissions(permissionCache[spaceId]);
            setIsLoading(false);
            return;
        }

        async function fetchPermissions() {
            setIsLoading(true);
            try {
                const { data, error } = await apiService.getMyPermissions(spaceId!);

                // Handle RPC returning { error: 'no_membership' }
                if (data && (data as any).error === 'no_membership') {
                    console.error('[usePermissions] No membership for space:', spaceId);
                    setError('no_membership');
                    setPermissions(null);
                    // Redirect to unauthorized/not-found as per SPA-95
                    navigate('/dashboard', { replace: true });
                    return;
                }

                if (error) {
                    setError(error);
                    setPermissions(null);
                } else {
                    permissionCache[spaceId!] = data;
                    setPermissions(data);
                }
            } catch (err) {
                console.error('[usePermissions] Fetch error:', err);
                setError(err);
            } finally {
                setIsLoading(false);
            }
        }

        fetchPermissions();
    }, [spaceId, navigate]);

    return {
        permissions,
        role: permissions?._role,
        isLoading,
        error
    };
}
