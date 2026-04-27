import React, { useMemo, useState } from 'react';
import { Briefcase, Download, Eye, FileText, History, Trash2, Upload, ArrowLeft, LayoutGrid, List, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import { friendlyError } from '../../utils/errors';
import { GlassCard, Button, Heading, Text, Input, Modal } from '../UI/index';
import { FileViewerModal } from '../FileViewerModal';
import { FileUploadModal } from '../FileUploadModal';
import { FileVersionsModal } from '../FileVersionsModal';
import { ClientSpace, SpaceFile } from '../../types';
import { useRealtimeFiles } from '../../hooks/useRealtimeFiles';

type FilesViewMode = 'board' | 'list';

const GlobalFilesView = ({ clients, profile }: { clients: ClientSpace[]; profile: any }) => {
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isInternalUploadModalOpen, setIsInternalUploadModalOpen] = useState(false);
    const [selectedSpaceForUpload, setSelectedSpaceForUpload] = useState<string>(clients[0]?.id || '');
    const [uploading, setUploading] = useState(false);
    const [viewingFile, setViewingFile] = useState<SpaceFile | null>(null);
    const [versioningFile, setVersioningFile] = useState<SpaceFile | null>(null);
    const [showTrash, setShowTrash] = useState(false);
    const [viewMode, setViewMode] = useState<FilesViewMode>('board');
    const [searchQuery, setSearchQuery] = useState('');
    const { organizationId } = useAuth();
    const { files: realtimeFiles, loading: filesLoading } = useRealtimeFiles('', organizationId || '', showTrash);
    const { showToast } = useToast();

    const groupedFiles = useMemo(() => clients.map((client) => ({
        client,
        files: realtimeFiles.filter((file) => file.space_id === client.id)
    })), [clients, realtimeFiles]);

    const filteredGroupedFiles = useMemo(() => groupedFiles.map((group) => ({
        ...group,
        files: group.files.filter((file) => {
            const q = searchQuery.trim().toLowerCase();
            if (!q) return true;
            return [file.name, group.client.name, file.mime_type].some((value) => String(value || '').toLowerCase().includes(q));
        })
    })), [groupedFiles, searchQuery]);

    const flatFiles = useMemo(() => filteredGroupedFiles.flatMap(({ client, files }) => files.map((file) => ({ file, client }))), [filteredGroupedFiles]);

    const totalFiles = realtimeFiles.length;
    const totalSpaces = clients.length;
    const totalTrash = realtimeFiles.filter((file) => file.deleted_at).length;

    return (
        <div className="space-y-6 page-enter">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                    <div className="surface-chip px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em]">
                        <Briefcase size={12} />
                        Business docs
                    </div>
                    <Heading level={1}>Files</Heading>
                    <Text variant="secondary" className="max-w-2xl">
                        Central repository for all documents, with a calmer database-style view and cleaner ownership context.
                    </Text>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="surface-chip px-3 py-1.5 text-[11px] font-medium">
                        <FileText size={12} />
                        {totalFiles} files
                    </div>
                    <div className="surface-chip px-3 py-1.5 text-[11px] font-medium">
                        <Briefcase size={12} />
                        {totalSpaces} spaces
                    </div>
                    <div className="surface-chip px-3 py-1.5 text-[11px] font-medium">
                        <Trash2 size={12} />
                        {totalTrash} trash
                    </div>
                </div>
            </header>

            <GlassCard className="sheet-panel p-4 md:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setViewMode('board')} className={`surface-chip px-3 py-2 text-xs font-medium ${viewMode === 'board' ? 'surface-chip-active' : ''}`}>
                            <LayoutGrid size={14} /> Board
                        </button>
                        <button onClick={() => setViewMode('list')} className={`surface-chip px-3 py-2 text-xs font-medium ${viewMode === 'list' ? 'surface-chip-active' : ''}`}>
                            <List size={14} /> List
                        </button>
                        <button onClick={() => setShowTrash(!showTrash)} className={`surface-chip px-3 py-2 text-xs font-medium ${showTrash ? 'surface-chip-active' : ''}`}>
                            <Trash2 size={14} /> {showTrash ? 'Exit Trash' : 'Trash'}
                        </button>
                    </div>
                    <div className="flex flex-col gap-3 md:flex-row">
                        <div className="relative min-w-[240px]">
                            <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6E6E80]" />
                            <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search files, spaces, or mime types" className="rounded-[8px] pl-10 pr-4" />
                        </div>
                        <Button onClick={() => setIsUploadOpen(true)}>
                            <Upload size={18} className="mr-2" /> Upload Doc
                        </Button>
                    </div>
                </div>
            </GlassCard>

            {viewMode === 'board' ? (
                <div className="space-y-6">
                    {filteredGroupedFiles.map(({ client, files }) => (
                        <GlassCard key={client.id} className="sheet-panel p-5">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-semibold tracking-[-0.03em] text-[#0D0D0D]">{client.name}</h3>
                                    <p className="text-sm text-[#6E6E80]">{files.length} documents in this space</p>
                                </div>
                                <span className="surface-chip px-3 py-1.5 text-[11px] font-medium">
                                    <FileText size={12} />
                                    {client.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {files.length > 0 ? files.map((file) => (
                                    <button key={file.id} onClick={() => setViewingFile(file as any)} className="database-row group flex items-start justify-between gap-4 p-4 text-left">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] text-[#0D0D0D]">
                                                <FileText size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-[#0D0D0D]">{file.name}</p>
                                                <p className="mt-1 text-xs text-[#6E6E80]">
                                                    {file.is_global ? 'Global asset' : (file.file_size ? `${(file.file_size / (1024 * 1024)).toFixed(2)} MB · ` : '') + new Date(file.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                                            <span className="surface-chip px-2.5 py-1 text-[10px] font-medium">Open</span>
                                        </div>
                                    </button>
                                )) : (
                                    <div className="rounded-[8px] border border-dashed border-[#E5E5E5] bg-white p-8 text-center text-sm text-[#6E6E80]">
                                        No files in this space.
                                    </div>
                                )}
                            </div>
                        </GlassCard>
                    ))}
                </div>
            ) : (
                <GlassCard className="sheet-panel overflow-hidden rounded-[8px]">
                    <div className="border-b border-[#E5E5E5] bg-[#F7F7F8] px-4 py-3">
                        <div className="grid grid-cols-[minmax(0,1.6fr)_140px_120px_160px_120px] gap-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">
                            <span>Name</span>
                            <span>Space</span>
                            <span>Type</span>
                            <span>Updated</span>
                            <span>Actions</span>
                        </div>
                    </div>
                    <div className="divide-y divide-[#E5E5E5]">
                        {flatFiles.map(({ file, client }) => (
                            <div key={file.id} className="grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[minmax(0,1.6fr)_140px_120px_160px_120px] md:items-center">
                                <button onClick={() => setViewingFile(file as any)} className="flex min-w-0 items-center gap-3 text-left">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] text-[#0D0D0D]">
                                        <FileText size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-[#0D0D0D]">{file.name}</p>
                                        <p className="text-xs text-[#6E6E80]">{file.is_global ? 'Global asset' : 'Space file'}</p>
                                    </div>
                                </button>
                                <div className="text-sm text-[#6E6E80]">{client.name}</div>
                                <div className="text-sm text-[#6E6E80]">{file.mime_type || 'Document'}</div>
                                <div className="text-sm text-[#6E6E80]">{new Date(file.created_at).toLocaleDateString()}</div>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" className="h-8 w-8 p-0 text-[#6E6E80] hover:text-[#0D0D0D]" onClick={() => setViewingFile(file as any)}><Eye size={16} /></Button>
                                    <Button variant="ghost" className="h-8 w-8 p-0 text-[#6E6E80] hover:text-[#0D0D0D]" onClick={async () => {
                                        const { data } = await apiService.getSignedUrl(file.id, organizationId || '');
                                        if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                    }}><Download size={16} /></Button>
                                    <Button variant="ghost" className="h-8 w-8 p-0 text-[#6E6E80] hover:text-[#0D0D0D]" onClick={() => setVersioningFile(file as any)}><History size={16} /></Button>
                                </div>
                            </div>
                        ))}
                        {flatFiles.length === 0 && (
                            <div className="p-10 text-center text-sm text-[#6E6E80]">
                                No files match the current filters.
                            </div>
                        )}
                    </div>
                </GlassCard>
            )}

            <Modal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} title="Select Destination Space">
                <div className="space-y-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-[#0D0D0D]">Upload To</label>
                        <select
                            title="Select Destination Space"
                            className="w-full rounded-[8px] border border-[#DADADA] bg-white px-5 py-3 text-sm text-[#0D0D0D] focus:outline-none"
                            value={selectedSpaceForUpload}
                            onChange={(e) => setSelectedSpaceForUpload(e.target.value)}
                        >
                            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                uploadProgress={null}
                onUpload={async (file) => {
                    if (!selectedSpaceForUpload || !organizationId) return false;
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
                        showToast('File uploaded successfully.', 'success');
                        return true;
                    } catch (err: any) {
                        console.error('Upload error:', err);
                        showToast(friendlyError(err?.message), 'error');
                        return false;
                    } finally {
                        setUploading(false);
                    }
                }}
            />

            {viewingFile && (
                <FileViewerModal
                    fileId={viewingFile.id}
                    filename={viewingFile.name}
                    mimeType={viewingFile.mime_type || 'application/pdf'}
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
