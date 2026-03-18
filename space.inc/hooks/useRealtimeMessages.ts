import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { apiService } from '../services/apiService';

import { Message } from '../types';

export function useRealtimeMessages(spaceId: string | null, orgId?: string) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom helper
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (!spaceId) {
            setMessages([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        // 1. Fetch initial messages
        const fetchMessages = async () => {
            try {
                const { data, error: fetchError } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('space_id', spaceId)
                    .order('created_at', { ascending: true });

                if (fetchError) {
                    throw fetchError;
                } else {
                    setMessages(data || []);
                }
            } catch (err: any) {
                console.error('Failed to fetch messages:', err);
                setError(err.message || 'Failed to load messages');
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();

        // 2. Subscribe to realtime inserts
        const channel = supabase
            .channel(`space-chat:${spaceId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `space_id=eq.${spaceId}`
                },
                (payload) => {
                    const newMessage = payload.new as Message;
                    setMessages(prev => {
                        // Avoid duplicates (in case we already have it from optimistic update)
                        if (prev.find(m => m.id === newMessage.id)) return prev;
                        return [...prev, newMessage];
                    });
                }
            )
            .subscribe();

        // Cleanup
        return () => {
            supabase.removeChannel(channel);
        };
    }, [spaceId]);

    // Auto-scroll when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);


    // Send message function
    const sendMessage = async (content: string, channel: 'general' | 'internal' = 'general'): Promise<boolean> => {
        if (!spaceId || !content.trim()) return false;

        try {
            const { data, error: sendError } = await apiService.sendMessage(spaceId, content, 'chat', {}, channel, orgId || '');
            if (sendError) throw sendError;
            // Realtime subscription delivers the full row automatically — no optimistic update needed
            return true;
        } catch (err: any) {
            console.error('Failed to send message:', err);
            setError(err.message || 'Failed to send message');
            return false;
        }
    };

    // Send file function
    const sendFile = async (currentOrgId: string, file: File): Promise<boolean> => {
        const effectiveOrgId = currentOrgId || orgId;
        if (!spaceId || !effectiveOrgId || !file) return false;

        try {
            setLoading(true);
            const fileData = await apiService.uploadFile(spaceId, effectiveOrgId, file);

            // Now send a chat message pointing to this file
            const { data, error: sendError } = await apiService.sendMessage(
                spaceId,
                `Shared a file: ${file.name}`,
                'file',
                { file_id: fileData.id, file_name: file.name, mime_type: file.type },
                'general',
                effectiveOrgId
            );

            if (sendError) throw sendError;

            if (data) {
                setMessages(prev => [...prev, data]);
            }
            return true;
        } catch (err: any) {
            console.error('Failed to upload file:', err);
            setError(err.message || 'Failed to upload file');
            return false;
        } finally {
            setLoading(false);
        }
    };


    return {
        messages,
        loading,
        error,
        sendMessage,
        sendFile,
        messagesEndRef // For attaching to scroll container
    };
}
