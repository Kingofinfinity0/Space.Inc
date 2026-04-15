import React, { useState, useRef } from 'react';
import { X, Upload, File, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface FileUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (file: File) => Promise<boolean>;
    loading: boolean;
    uploadProgress: number | null;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({ isOpen, onClose, onUpload, loading, uploadProgress }) => {
    const [file, setFile] = useState<File | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const visibleProgress = loading ? Math.max(uploadProgress ?? 0, 8) : (uploadProgress ?? 0);

    if (!isOpen) return null;

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (!file) return;
        const success = await onUpload(file);
        if (!success) return;

        await new Promise((resolve) => setTimeout(resolve, 220));
        setFile(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
                    <h3 className="text-lg font-bold text-black tracking-tight">Upload Document</h3>
                    <button
                        onClick={onClose}
                        className="p-1 bg-black text-white hover:bg-zinc-800 rounded-full transition-all shadow-md"
                    >
                        <X size={18} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        className={`
                            relative flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-xl transition-all duration-200
                            ${dragActive ? 'border-black dark:border-white bg-zinc-50 dark:bg-zinc-900' : 'border-zinc-200 dark:border-zinc-800 hover:border-black dark:hover:border-white bg-white dark:bg-black'}
                            ${file ? 'border-emerald-500/50 bg-emerald-500/5' : ''}
                        `}
                    >
                        <input
                            ref={inputRef}
                            type="file"
                            className="hidden"
                            onChange={handleChange}
                        />

                        {!file ? (
                            <>
                                <div className="p-3 bg-black text-white rounded-2xl mb-4 shadow-lg shadow-black/20">
                                    <Upload size={32} strokeWidth={2.5} />
                                </div>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center mb-1">
                                    <button
                                        onClick={() => inputRef.current?.click()}
                                        className="text-black dark:text-white font-semibold underline hover:no-underline transition-colors"
                                    >
                                        Click to upload
                                    </button> or drag and drop
                                </p>
                                <p className="text-xs text-zinc-500">PDF, DOCX, PNG, JPG (max 25MB)</p>
                            </>
                        ) : (
                            <div className="flex flex-col items-center animate-in scale-in-90">
                                <div className="p-4 bg-black text-white rounded-2xl mb-3 shadow-lg shadow-black/10">
                                    <File size={40} strokeWidth={2.5} />
                                </div>
                                <p className="text-sm font-medium text-black dark:text-white text-center truncate max-w-[200px]">
                                    {file.name}
                                </p>
                                <p className="text-xs text-zinc-500">
                                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                                </p>
                                <button
                                    onClick={() => setFile(null)}
                                    disabled={loading}
                                    className="mt-4 text-xs text-zinc-500 hover:text-zinc-700 disabled:opacity-50 transition-colors underline"
                                >
                                    Select another file
                                </button>
                            </div>
                        )}

                        {loading && (
                            <div className="mt-6 w-full max-w-xs">
                                <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                                    <span>Uploading</span>
                                    <span>{uploadProgress ?? 0}%</span>
                                </div>
                                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/80">
                                    <div
                                        className="h-full rounded-full bg-black transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                                        style={{ width: `${visibleProgress}%` }}
                                    />
                                    <div className="upload-progress-sheen absolute inset-y-0 left-0 w-16" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!file || loading}
                        className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium rounded-lg transition-all shadow-lg flex items-center gap-2"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        {loading ? `Uploading… ${uploadProgress ?? 0}%` : 'Send File'}
                    </button>
                </div>
            </div>
        </div>
    );
};
