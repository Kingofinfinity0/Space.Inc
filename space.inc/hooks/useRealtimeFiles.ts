import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { apiService } from '../services/apiService';

import { SpaceFile } from '../types';

export const useRealtimeFiles = (spaceId: string, showDeleted: boolean = false) => {
    const [files, setFiles] = useState<SpaceFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // If spaceId is not provided, we might still want to fetch all files (e.g. for GlobalFilesView)
        // However, if the user explicitly wants to wait for a spaceId, we handle that.
        // For now, let's allow it to fetch all if spaceId is null/undefined/empty string?
        // Actually, let's make it more explicit. If spaceId is 'ALL' or explicitly omitted.

        const fetchFiles = async () => {
            try {
                setLoading(true);
                let query = supabase
                    .from('files')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (spaceId) {
                    query = query.eq('space_id', spaceId);
                }

                if (showDeleted) {
                    query = query.eq('status', 'deleted').not('deleted_at', 'is', null);
                } else {
                    query = query.eq('status', 'available').is('deleted_at', null);
                }

                const { data, error: fetchError } = await query;

                if (fetchError) throw fetchError;
                setFiles(data || []);
            } catch (err: any) {
                console.error('Error fetching files:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

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
                    ...(spaceId ? { filter: `space_id=eq.${spaceId}` } : {})
                },
                (payload) => {
                    const newFile = payload.new as SpaceFile;

                    if (payload.eventType === 'INSERT') {
                        const isMatch = showDeleted ? (newFile.status === 'deleted' && newFile.deleted_at) : (newFile.status === 'available' && !newFile.deleted_at);
                        if (isMatch) {
                            setFiles(prev => [newFile, ...prev]);
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setFiles(prev => prev.filter(f => f.id !== payload.old.id));
                    } else if (payload.eventType === 'UPDATE') {
                        // Handle transitions (e.g. available -> deleted)
                        const isActiveMatch = (newFile.status === 'available' && !newFile.deleted_at);
                        const isDeletedMatch = (newFile.status === 'deleted' && newFile.deleted_at);

                        const isMatch = showDeleted ? isDeletedMatch : isActiveMatch;

                        if (!isMatch) {
                            setFiles(prev => prev.filter(f => f.id !== newFile.id));
                        } else {
                            setFiles(prev => {
                                const exists = prev.find(f => f.id === newFile.id);
                                if (exists) {
                                    return prev.map(f => f.id === newFile.id ? newFile : f);
                                } else {
                                    return [newFile, ...prev].sort((a, b) =>
                                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                                    );
                                }
                            });
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [spaceId, showDeleted]);

    return { files, loading, error };
};
