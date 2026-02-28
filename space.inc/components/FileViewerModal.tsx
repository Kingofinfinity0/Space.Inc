import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { apiService } from '../services/apiService';
import { Button } from './UI';

interface FileViewerModalProps {
    fileId: string;
    filename: string;
    mimeType: string;
    onClose: () => void;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({ fileId, filename, mimeType, onClose }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUrl = async () => {
            setLoading(true);
            try {
                const { data, error } = await apiService.getSignedFileUrl(fileId);
                if (error) throw error;
                if (data?.signedUrl) {
                    setUrl(data.signedUrl);
                } else {
                    throw new Error("No signed URL returned");
                }
            } catch (err: any) {
                console.error("Error fetching signed URL:", err);
                setError(err.message || "Failed to load file");
            } finally {
                setLoading(false);
            }
        };

        fetchUrl();
    }, [fileId]);

    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';
    const isWord = mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || filename.endsWith('.doc') || filename.endsWith('.docx');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-zinc-100 rounded-lg flex items-center justify-center font-bold text-zinc-600">
                            {filename.split('.').pop()?.toUpperCase()}
                        </div>
                        <div>
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[300px]">{filename}</h3>
                            <p className="text-xs text-zinc-500">Read-only view</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {url && (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors">
                                <ExternalLink size={20} />
                            </a>
                        )}
                        <button onClick={onClose} className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-950 relative overflow-hidden flex items-center justify-center">
                    {loading && (
                        <div className="flex flex-col items-center gap-3 text-zinc-500">
                            <Loader2 className="animate-spin" size={32} />
                            <p className="text-sm font-medium">Securely loading document...</p>
                        </div>
                    )}

                    {error && (
                        <div className="flex flex-col items-center gap-3 text-red-500 p-8 text-center max-w-md">
                            <div className="h-12 w-12 bg-red-50 rounded-full flex items-center justify-center mb-2">
                                <AlertCircle size={24} />
                            </div>
                            <h4 className="font-semibold">Unable to Load File</h4>
                            <p className="text-sm text-zinc-600">{error}</p>
                            <Button onClick={onClose} variant="outline" className="mt-4">Close Viewer</Button>
                        </div>
                    )}

                    {!loading && !error && url && (
                        <>
                            {isImage && (
                                <img src={url} alt={filename} className="max-w-full max-h-full object-contain p-4 shadow-lg rounded-md" />
                            )}
                            {isPdf && (
                                <iframe src={url} className="w-full h-full" title={filename} />
                            )}
                            {isWord && (
                                <iframe
                                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`}
                                    className="w-full h-full"
                                    title={filename}
                                />
                            )}
                            {!isImage && !isPdf && !isWord && (
                                <div className="text-center p-8">
                                    <div className="h-16 w-16 bg-zinc-200 rounded-xl flex items-center justify-center mx-auto mb-4 text-zinc-400">
                                        <ExternalLink size={32} />
                                    </div>
                                    <h4 className="text-lg font-semibold mb-2">Preview Not Available</h4>
                                    <p className="text-zinc-500 mb-6 max-w-sm">This file type cannot be previewed directly in the browser yet.</p>
                                    <Button onClick={() => window.open(url, '_blank')} variant="primary">
                                        Download to View
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
