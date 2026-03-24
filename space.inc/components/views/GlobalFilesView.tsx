import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import { friendlyError } from '../../utils/errors';
import {
    LayoutDashboard, Users, MessageSquare, Calendar, FileText, Settings, Plus, Search,
    Briefcase, ChevronRight, LogOut, Video, Download, Upload, Clock, UserPlus, ArrowRight,
    Link as LinkIcon, Copy, ListTodo, MoreVertical, Flag, Trash2, User, ArrowLeft,
    GripVertical, Activity, Shield, Lock, FileUp, Key, FilePlus as FilePlus2,
    File as DocIcon, Rocket, LayoutGrid, Inbox, UserCheck, CheckSquare, FolderClosed,
    Bell, Eye, Play, X, FileVideo, ChevronLeft, History
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
    GlassCard, Button, Heading, Text, Input, Modal, Checkbox, Toggle,
    SkeletonLoader, SkeletonCard, SkeletonText, SkeletonImage
} from '../UI/index';
import { FileViewerModal } from '../FileViewerModal';
import { FileUploadModal } from '../FileUploadModal';
import { FileVersionsModal } from '../FileVersionsModal';
import { ClientSpace, ViewState, Meeting, Message, StaffMember, Task, SpaceFile, ChartData, ClientLifecycle } from '../../types';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useRealtimeFiles } from '../../hooks/useRealtimeFiles';


// 6. Files View
const GlobalFilesView = ({ clients, profile }: { clients: ClientSpace[], profile: any }) => {
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isInternalUploadModalOpen, setIsInternalUploadModalOpen] = useState(false);
    const [selectedSpaceForUpload, setSelectedSpaceForUpload] = useState<string>(clients[0]?.id || '');
    const [uploading, setUploading] = useState(false);
    const [viewingFile, setViewingFile] = useState<SpaceFile | null>(null);
    const [versioningFile, setVersioningFile] = useState<SpaceFile | null>(null);
    const [showTrash, setShowTrash] = useState(false);
    const { files: realtimeFiles, loading: filesLoading } = useRealtimeFiles('', showTrash);
    const { showToast } = useToast();
    const { organizationId } = useAuth();

    // Group files by client
    const groupedFiles = clients.map(client => ({
        client,
        files: realtimeFiles.filter(f => f.space_id === client.id)
    }));

    return (
        <div>
            <header className="flex justify-between items-center mb-8">
                <div>
                    <Heading level={1}>Files</Heading>
                    <Text variant="secondary" className="mt-1">Central repository for all documents.</Text>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setShowTrash(!showTrash)} className={showTrash ? 'text-rose-500 bg-rose-50' : ''}>
                        <Trash2 size={18} className="mr-2" /> {showTrash ? 'Exit Trash' : 'Trash'}
                    </Button>
                    <Button onClick={() => setIsUploadOpen(true)}>
                        <Upload size={18} className="mr-2" /> Upload Doc
                    </Button>
                </div>
            </header>

            <div className="space-y-8">
                {groupedFiles.map(({ client, files }) => (
                    <div key={client.id}>
                        <h3 className="text-lg font-medium text-[#1D1D1D] mb-4 flex items-center gap-2">
                            <Briefcase size={18} className="text-zinc-400" /> {client.name}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {files.length > 0 ? files.map(file => (
                                <GlassCard key={file.id} className="p-4 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-zinc-100 p-2 rounded-lg text-zinc-600">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-[#1D1D1D] truncate max-w-[150px]">{file.name}</p>
                                            <p className="text-xs text-zinc-500">
                                                {file.is_global ? 'Global Asset' : (file.file_size ? `${(file.file_size / (1024 * 1024)).toFixed(2)} MB • ` : '') + new Date(file.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {!showTrash ? (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 text-zinc-400 hover:text-[#1D1D1D]"
                                                    onClick={() => setViewingFile(file as any)}
                                                >
                                                    <Eye size={16} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0"
                                                    onClick={async () => {
                                                        const { data } = await apiService.getSignedUrl(file.id, organizationId || '');
                                                        if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                                    }}
                                                    title="Download"
                                                >
                                                    <Download size={16} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 text-zinc-400 hover:text-indigo-500"
                                                    onClick={() => setVersioningFile(file as any)}
                                                    title="Version History"
                                                >
                                                    <History size={16} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    onClick={async () => {
                                                        if (confirm('Are you sure you want to move this file to trash?')) {
                                                            try {
                                                                await apiService.deleteFile(file.id);
                                                                showToast('File moved to trash.', "success");
                                                            } catch (err: any) {
                                                                showToast(friendlyError(err?.message), "error");
                                                            }
                                                        }
                                                    }}
                                                    className="h-8 w-8 p-0 text-zinc-500 hover:text-rose-500"
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    onClick={async () => {
                                                        try {
                                                            await apiService.restoreFile(file.id);
                                                            showToast('File restored.', "success");
                                                        } catch (err: any) {
                                                            showToast(friendlyError(err?.message), "error");
                                                        }
                                                    }}
                                                    className="h-8 w-8 p-0 text-zinc-400 hover:text-emerald-500"
                                                    title="Restore File"
                                                >
                                                    <ArrowLeft size={16} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    onClick={async () => {
                                                        if (confirm('PERMANENT DELETE: Are you sure? This cannot be undone.')) {
                                                            try {
                                                                await apiService.hardDeleteFile(file.id);
                                                                showToast('File permanently deleted.', "success");
                                                            } catch (err: any) {
                                                            showToast(friendlyError(err?.message), "error");
                                                            }
                                                        }
                                                    }}
                                                    className="h-8 w-8 p-0 text-zinc-400 hover:text-rose-600"
                                                    title="Delete Permanently"
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </GlassCard>
                            )) : (
                                <div className="col-span-3 text-center py-8 border border-dashed border-[#D1D5DB] rounded-lg text-[#8E8EA0] text-sm">
                                    No files in this space.
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <Modal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} title="Select Destination Space">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Upload To</label>
                        <select
                            title="Select Destination Space"
                            className="w-full bg-white/40 border border-zinc-200 rounded-lg px-5 py-3 text-zinc-800 text-sm focus:outline-none"
                            value={selectedSpaceForUpload}
                            onChange={(e) => setSelectedSpaceForUpload(e.target.value)}
                        >
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <Button
                        className="w-full mt-4"
                        onClick={() => {
                            setIsUploadOpen(false);
                            setIsInternalUploadModalOpen(true);
                        }}
                    >
                        Continue to Upload
                    </Button>
                </div>
            </Modal>

            <FileUploadModal
                isOpen={isInternalUploadModalOpen}
                onClose={() => setIsInternalUploadModalOpen(false)}
                loading={uploading}
                onUpload={async (file) => {
                    if (!selectedSpaceForUpload || !organizationId) return;
                    setUploading(true);
                    try {
                        const fileData = await apiService.uploadFile(selectedSpaceForUpload, organizationId, file);
                        await apiService.sendMessage(
                            selectedSpaceForUpload,
                            `Shared a file: ${file.name}`,
                            'file',
                            { file_id: fileData.id, file_name: file.name, mime_type: file.type },
                            'general',
                            organizationId
                        );
                        setIsInternalUploadModalOpen(false);
                        showToast("File uploaded successfully.", "success");
                    } catch (err: any) {
                        console.error("Upload error:", err);
                        showToast(friendlyError(err?.message), "error");
                    } finally {
                        setUploading(false);
                    }
                }}
            />

            {viewingFile && (
                <FileViewerModal
                    fileId={viewingFile.id}
                    filename={viewingFile.name}
                    mimeType={viewingFile.mime_type || 'application/pdf'} // Default to PDF if unknown, or handle strictly
                    onClose={() => setViewingFile(null)}
                />
            )}

            <FileVersionsModal
                isOpen={!!versioningFile}
                onClose={() => setVersioningFile(null)}
                file={versioningFile}
            />
        </div>
    );
};
export default GlobalFilesView;
