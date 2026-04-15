import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { apiService } from '../services/apiService';

import { SpaceFile } from '../types';

export const useRealtimeFiles = (spaceId: string, organizationId: string, showDeleted: boolean = false) => {
    const [files, setFiles] = useState<SpaceFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const upsertFile = useCallback((incomingFile: SpaceFile) => {
        setFiles((prev) => {
            const withoutDuplicate = prev.filter((file) => file.id !== incomingFile.id);
            return [incomingFile, ...withoutDuplicate].sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
        });
    }, []);

    const removeFile = useCallback((fileId: string) => {
        setFiles((prev) => prev.filter((file) => file.id !== fileId));
    }, []);

    const fetchFiles = useCallback(async () => {
        if (!organizationId) {
            setFiles([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            if (showDeleted) {
                const { data, error: fetchError } = await apiService.getTrashFiles(spaceId || undefined);

                if (fetchError) throw fetchError;
                setFiles(data || []);
            } else {
                let query = supabase
                    .from('files')
                    .select('*')
                    .eq('organization_id', organizationId)
                    .order('created_at', { ascending: false });

                if (spaceId) {
                    query = query.eq('space_id', spaceId);
                }

                query = query.is('deleted_at', null).neq('status', 'deleted');
                const { data, error: fetchError } = await query;

                if (fetchError) throw fetchError;
                setFiles(data || []);
            }
        } catch (err: any) {
            console.error('Error fetching files:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [organizationId, showDeleted, spaceId]);

    useEffect(() => {
        if (!organizationId) {
            console.warn('[useRealtimeFiles] Missing organizationId, skipping fetch');
            setFiles([]);
            setLoading(false);
            return;
        }

        setFiles([]);
        setError(null);

        fetchFiles();

        // Subscribe to changes
        const channel = supabase
            .channel(`files-all-changes`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'files',
                    filter: spaceId ? `space_id=eq.${spaceId}` : `organization_id=eq.${organizationId}`
                },
                (payload) => {
                    const newFile = payload.new as SpaceFile;
                    if (newFile.organization_id !== organizationId) return; // Defense-in-depth

                    if (payload.eventType === 'INSERT') {
                        const isMatch = showDeleted
                            ? (newFile.status === 'deleted')
                            : (!newFile.deleted_at && newFile.status !== 'deleted');
                        if (isMatch) {
                            upsertFile(newFile);
                        }
                    } else if (payload.eventType === 'DELETE') {
                        removeFile(payload.old.id);
                    } else if (payload.eventType === 'UPDATE') {
                        // Handle transitions (e.g. available -> deleted)
                        const isActiveMatch = (!newFile.deleted_at && newFile.status !== 'deleted');
                        const isDeletedMatch = (newFile.status === 'deleted');

                        const isMatch = showDeleted ? isDeletedMatch : isActiveMatch;

                        if (!isMatch) {
                            removeFile(newFile.id);
                        } else {
                            upsertFile(newFile);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchFiles, organizationId, removeFile, showDeleted, spaceId, upsertFile]);

    return { files, loading, error, refreshFiles: fetchFiles, upsertFile, removeFile };
};
