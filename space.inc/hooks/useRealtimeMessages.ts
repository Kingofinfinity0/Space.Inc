import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { apiService } from '../services/apiService';
import { friendlyError } from '../utils/errors';
import { Message } from '../types';
import { useAuth } from '../contexts/AuthContext';

export function useRealtimeMessages(spaceId: string | null, orgId?: string) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        if (!spaceId) {
            setMessages([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const fetchMessages = async () => {
            try {
                const { data, error: fetchError } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('space_id', spaceId)
                    .order('created_at', { ascending: true });

                if (fetchError) throw fetchError;
                setMessages(data || []);
            } catch (err: any) {
                setError(friendlyError(err?.message));
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();

        const channel = supabase
            .channel(`space-chat:${spaceId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'messages',
                    filter: `space_id=eq.${spaceId}`
                },
                (payload: any) => {
                    if (payload.eventType === 'INSERT') {
                        const newMessage = payload.new as Message;
                        setMessages(prev => {
                            const existingIdx = prev.findIndex(m =>
                                (m.id === newMessage.id) ||
                                (newMessage.idempotency_key && m.idempotency_key === newMessage.idempotency_key)
                            );

                            if (existingIdx !== -1) {
                                const next = [...prev];
                                next[existingIdx] = newMessage;
                                return next;
                            }
                            return [...prev, newMessage];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updated = payload.new as Message;
                        setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
                    } else if (payload.eventType === 'DELETE') {
                        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [spaceId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    const sendMessage = async (content: string, channel: 'general' | 'internal' = 'general'): Promise<boolean> => {
        if (!spaceId || !content.trim() || !user) return false;

        const idempotencyKey = crypto.randomUUID();

        const optimisticMsg: any = {
            id: `temp-${idempotencyKey}`,
            space_id: spaceId,
            content: content,
            channel: channel,
            sender_id: user.id,
            idempotency_key: idempotencyKey,
            created_at: new Date().toISOString(),
            status: 'sending' as any
        };

        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const { error: sendError } = await apiService.sendMessage(spaceId, content, 'chat', {}, channel, orgId || '');
            if (sendError) throw sendError;
            return true;
        } catch (err: any) {
            setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
            setError(friendlyError(err?.message));
            return false;
        }
    };

    const sendFile = async (currentOrgId: string, file: File): Promise<boolean> => {
        const effectiveOrgId = currentOrgId || orgId;
        if (!spaceId || !effectiveOrgId || !file) return false;

        try {
            setLoading(true);
            const fileData = await apiService.uploadFile(spaceId, effectiveOrgId, file);
            const { error: sendError } = await apiService.sendMessage(
                spaceId,
                `Shared a file: ${file.name}`,
                'file',
                { file_id: fileData.id, file_name: file.name, mime_type: file.type },
                'general',
                effectiveOrgId
            );
            if (sendError) throw sendError;
            return true;
        } catch (err: any) {
            setError(friendlyError(err?.message));
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { messages, loading, error, sendMessage, sendFile, messagesEndRef };
}
