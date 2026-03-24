import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, File as FileIcon, Loader2, Download, ExternalLink, History } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { supabase } from '../lib/supabase';
import { SpaceFile } from '../types';
import { Button, Text, GlassCard } from './UI';
import { useToast } from '../contexts/ToastContext';
import { friendlyError } from '../utils/errors';

interface FileVersionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    file: SpaceFile | null;
    onVersionUploaded?: () => void;
}

export const FileVersionsModal: React.FC<FileVersionsModalProps> = ({ isOpen, onClose, file, onVersionUploaded }) => {
    const [versions, setVersions] = useState<SpaceFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const { organizationId } = useAuth();
    const { showToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchVersions = async () => {
        if (!file) return;
        setLoading(true);
        try {
            // Task 2C: RPC-based version history (safer than parent_id table queries)
            const { data, error } = await supabase.rpc('get_file_versions', {
                p_file_id: file.id
            });
            if (error) throw error;

            // Expected shape: array of versions including
            // version_number, uploaded_by(_name), file_size, created_at, storage_path
            setVersions((data || []) as SpaceFile[]);
        } catch (err: any) {
            console.error("Failed to fetch versions", err);
            showToast(friendlyError(err?.message), "error");
            setVersions([file as any]); // fallback: show current file
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchVersions();
        } else {
            setVersions([]);
        }
    }, [isOpen, file]);

    const handleUploadVersion = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newFile = e.target.files?.[0];
        if (!newFile || !file || !organizationId) return;

        setUploading(true);
        try {
            await apiService.uploadFileVersion(file.id, organizationId, newFile);
            showToast("New version uploaded successfully", "success");
            await fetchVersions();
            if (onVersionUploaded) onVersionUploaded();
        } catch (err: any) {
            console.error("Upload error:", err);
            showToast(friendlyError(err?.message), "error");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDownload = async (v: SpaceFile) => {
        try {
            // Task 2C download pattern: createSignedUrl from storage_path directly.
            if (!v.storage_path) throw new Error('MISSING_STORAGE_PATH');
            const { data, error } = await supabase.storage
                .from('space-files')
                .createSignedUrl(v.storage_path, 900);

            if (error) throw error;
            if (data?.signedUrl) window.open(data.signedUrl, '_blank');
        } catch (err: any) {
            showToast(friendlyError(err?.message), "error");
        }
    };

    if (!isOpen || !file) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-200/50 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400">
                            <History size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Version History</h3>
                            <p className="text-xs text-zinc-500 font-medium truncate max-w-[300px]">{file.name}</p>
                        </div>
                    </div>
                    <button
                        title="Close History"
                        onClick={onClose}
                        className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-zinc-400">
                            <Loader2 className="animate-spin mr-2" size={20} /> Loading history...
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {versions.map((v, index) => (
                                <GlassCard key={v.id} className={`p-4 flex items-center justify-between ${index === 0 ? 'border-indigo-500/30 shadow-indigo-500/5' : ''}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`flex flex-col items-center justify-center h-10 w-10 shrink-0 rounded-lg font-bold text-sm ${index === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-100 text-zinc-500'}`}>
                                            v{v.version_number || 1}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                {v.name}
                                                {index === 0 && <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full uppercase font-bold tracking-wider">Latest</span>}
                                            </p>
                                            <p className="text-xs text-zinc-500 mt-0.5">
                                                {v.file_size ? `${(v.file_size / (1024 * 1024)).toFixed(2)} MB • ` : ''} 
                                                Uploaded by {v.uploaded_by_name || v.uploaded_by} • {new Date(v.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => handleDownload(v)} title="Download this version">
                                            <Download size={16} />
                                        </Button>
                                    </div>
                                </GlassCard>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer / Upload New Version */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800">
                    <input 
                        type="file" 
                        title="Upload new version"
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleUploadVersion} 
                    />
                    <Button 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={uploading} 
                        className="w-full flex justify-center items-center py-2.5"
                    >
                        {uploading ? (
                            <><Loader2 size={16} className="animate-spin mr-2" /> Uploading...</>
                        ) : (
                            <><Upload size={16} className="mr-2" /> Upload New Version</>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};
