import React, { useState, useEffect, useMemo, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  signInWithGoogle,
  signInAnonymouslyUser,
  signOutUser,
  testConnection,
} from './lib/firebase';
import {
  FileItem,
  FileCategory,
  SortField,
  SortOrder,
  ViewMode,
  BreadcrumbItem,
  ProviderConfig,
} from './types';
import {
  subscribeToUserFiles,
  uploadFile,
  createFolder,
  createTextFile,
  renameFileItem,
  moveFileItem,
  deleteFileItem,
  formatFileSize,
  getStoredProviderConfig,
  saveStoredProviderConfig,
  syncDatabases,
  replicateFileToOtherProvider,
  extractZipToFolder,
} from './services/fileService';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { FileList } from './components/FileList';
import { FileDetailsPanel } from './components/FileDetailsPanel';
import { FilePreviewModal } from './components/FilePreviewModal';
import { NewFolderModal } from './components/NewFolderModal';
import { NewTextFileModal } from './components/NewTextFileModal';
import { RenameModal } from './components/RenameModal';
import { MoveModal } from './components/MoveModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { ProviderModal } from './components/ProviderModal';
import { UploadProgressWidget, UploadProgressData } from './components/UploadProgressWidget';
import {
  setForceSupabaseMode,
  getForceSupabaseMode,
  FIREBASE_MAX_STORAGE_BYTES,
} from './services/fileService';
import {
  AlertCircle,
  Database,
  LogIn,
  Sparkles,
  CheckCircle2,
  Maximize2,
  ShieldCheck,
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Navigation, Selection & Filtering
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // Layout & Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);

  // UI feedback
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [uploadToast, setUploadToast] = useState<string | null>(null);

  // Modals state
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState<boolean>(false);
  const [isNewTextFileOpen, setIsNewTextFileOpen] = useState<boolean>(false);
  const [fileToRename, setFileToRename] = useState<FileItem | null>(null);
  const [fileToMove, setFileToMove] = useState<FileItem | null>(null);
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);
  const [isProviderModalOpen, setIsProviderModalOpen] = useState<boolean>(false);
  const [forceSupabase, setForceSupabase] = useState<boolean>(getForceSupabaseMode());
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>(getStoredProviderConfig());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(new Date());
  const [recentlyEditedIds, setRecentlyEditedIds] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<UploadProgressData>({
    isOpen: false,
    totalFiles: 0,
    currentFileIndex: 0,
    currentFileName: '',
    currentFilePercent: 0,
    overallPercent: 0,
    statusText: '',
    isComplete: false,
    error: null,
  });

  const markFileAsEdited = (fileId: string) => {
    setRecentlyEditedIds((prev) => {
      const next = new Set(prev);
      next.add(fileId);
      return next;
    });
  };

  const handleUpdateProviderConfig = (newConfig: ProviderConfig) => {
    setProviderConfig(newConfig);
    saveStoredProviderConfig(newConfig);
  };

  const firebaseBytes = useMemo(() => {
    return files
      .filter((f) => f.provider !== 'supabase')
      .reduce((acc, f) => acc + (f.size || 0), 0);
  }, [files]);

  const supabaseFileCount = useMemo(() => {
    return files.filter((f) => f.provider === 'supabase').length;
  }, [files]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Listen for fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Error attempting to enable fullscreen:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn('Error attempting to exit fullscreen:', err);
        });
      }
    }
  };

  // Check auth and test connection
  useEffect(() => {
    testConnection();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          await signInAnonymouslyUser();
          return;
        } catch {
          // fallback
        }
      }
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to user files
  useEffect(() => {
    if (!currentUser) {
      setFiles([]);
      return;
    }

    const unsubscribe = subscribeToUserFiles(
      currentUser.uid,
      providerConfig,
      (userFiles) => {
        setFiles(userFiles);
        setErrorMsg(null);
      },
      (err) => {
        console.warn('Subscription sync notice:', err);
        // Only notify if not a temporary connection hiccup
        if (currentUser && !currentUser.isAnonymous && err.message?.includes('permission')) {
          setErrorMsg('Sign in to access your saved files.');
        }
      }
    );

    return () => unsubscribe();
  }, [currentUser, providerConfig]);

  // Selected file item
  const selectedFile = useMemo(() => {
    if (!selectedFileId) return null;
    return files.find((f) => f.id === selectedFileId) || null;
  }, [selectedFileId, files]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        searchInput?.focus();
      } else if (e.key === 'Escape') {
        setSelectedFileId(null);
        setIsDetailsOpen(false);
      } else if (e.key === ' ' && selectedFile && !selectedFile.isFolder) {
        e.preventDefault();
        setPreviewFile(selectedFile);
      } else if (e.key === 'Delete' && selectedFile) {
        setFileToDelete(selectedFile);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFile]);

  // Breadcrumbs calculation
  const breadcrumbs: BreadcrumbItem[] = useMemo(() => {
    const list: BreadcrumbItem[] = [{ id: null, name: 'Home' }];
    if (!currentFolderId) return list;

    const path: BreadcrumbItem[] = [];
    let curId: string | null = currentFolderId;

    while (curId) {
      const found = files.find((f) => f.id === curId);
      if (found) {
        path.unshift({ id: found.id, name: found.name });
        curId = found.parentId;
      } else {
        break;
      }
    }

    return [...list, ...path];
  }, [currentFolderId, files]);

  // Filtered and Sorted Files
  const displayedFiles = useMemo(() => {
    let result = files;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.extension.toLowerCase().includes(q) ||
          (f.textContent && f.textContent.toLowerCase().includes(q))
      );
      return result;
    }

    // Category filter
    if (selectedCategory === 'folders') {
      result = result.filter((f) => f.isFolder);
    } else if (selectedCategory === 'documents') {
      result = result.filter(
        (f) =>
          !f.isFolder &&
          (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(f.extension.toLowerCase()) ||
            f.mimeType.includes('pdf'))
      );
    } else if (selectedCategory === 'images') {
      result = result.filter(
        (f) =>
          !f.isFolder &&
          (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(f.extension.toLowerCase()) ||
            f.mimeType.startsWith('image/'))
      );
    } else if (selectedCategory === 'media') {
      result = result.filter(
        (f) =>
          !f.isFolder &&
          (f.mimeType.startsWith('audio/') ||
            f.mimeType.startsWith('video/') ||
            ['mp3', 'wav', 'mp4', 'webm', 'ogg', 'm4a'].includes(f.extension.toLowerCase()))
      );
    } else if (selectedCategory === 'code') {
      result = result.filter(
        (f) =>
          !f.isFolder &&
          (['js', 'jsx', 'ts', 'tsx', 'json', 'py', 'html', 'css', 'csv', 'sql', 'yaml', 'md'].includes(
            f.extension.toLowerCase()
          ) ||
            f.mimeType.includes('json') ||
            f.mimeType.includes('csv'))
      );
    } else if (selectedCategory === 'archives') {
      result = result.filter(
        (f) =>
          !f.isFolder && ['zip', 'rar', '7z', 'tar', 'gz'].includes(f.extension.toLowerCase())
      );
    } else {
      result = result.filter((f) => f.parentId === currentFolderId);
    }

    // Folders on top, then sorted
    return [...result].sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;

      let comp = 0;
      if (sortField === 'name') {
        comp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      } else if (sortField === 'size') {
        comp = a.size - b.size;
      } else if (sortField === 'updatedAt') {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        comp = timeA - timeB;
      }
      return sortOrder === 'asc' ? comp : -comp;
    });
  }, [files, currentFolderId, selectedCategory, searchQuery, sortField, sortOrder]);

  const allFolders = useMemo(() => files.filter((f) => f.isFolder), [files]);

  // File Upload Handlers
  const handleFileUpload = async (fileList: FileList) => {
    if (!currentUser) {
      try {
        await signInWithGoogle();
      } catch {
        setErrorMsg('Please sign in to upload files to your persistent cloud drive.');
        return;
      }
    }

    if (!auth.currentUser) return;

    setIsUploading(true);
    setUploadProgress({
      isOpen: true,
      totalFiles: fileList.length,
      currentFileIndex: 1,
      currentFileName: fileList[0]?.name || '',
      currentFilePercent: 0,
      overallPercent: 0,
      statusText: 'Preparing upload...',
      isComplete: false,
      error: null,
    });

    try {
      let anyFailover = false;
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        setUploadProgress((prev) => ({
          ...prev,
          currentFileIndex: i + 1,
          currentFileName: f.name,
          statusText: `Uploading ${f.name}...`,
        }));

        const res = await uploadFile(
          f,
          auth.currentUser.uid,
          currentFolderId,
          providerConfig,
          (percent, status) => {
            setUploadProgress((prev) => {
              const fileContribution = percent / 100;
              const overall = Math.round(((i + fileContribution) / fileList.length) * 100);
              return {
                ...prev,
                currentFilePercent: percent,
                overallPercent: Math.min(100, Math.max(prev.overallPercent, overall)),
                statusText: status,
              };
            });
          }
        );

        if (res.didFailover) anyFailover = true;
      }

      setUploadProgress((prev) => ({
        ...prev,
        isComplete: true,
        currentFilePercent: 100,
        overallPercent: 100,
        statusText: anyFailover
          ? 'Upload complete (Supabase failover active)'
          : `All ${fileList.length} file(s) saved securely`,
      }));

      setUploadToast(
        anyFailover
          ? `Firebase limit reached · Successfully saved to Supabase failover!`
          : `Successfully uploaded ${fileList.length} file(s).`
      );
      setTimeout(() => setUploadToast(null), 3500);

      // Auto dismiss progress widget after 3.5 seconds
      setTimeout(() => {
        setUploadProgress((prev) => ({ ...prev, isOpen: false }));
      }, 3500);
    } catch (e: any) {
      console.error('Upload failed', e);
      setErrorMsg('Upload failed. ' + (e.message || ''));
      setUploadProgress((prev) => ({
        ...prev,
        error: e.message || 'Upload failed',
        statusText: 'Failed to complete upload',
      }));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Sync databases now handler
  const handleSyncNow = async () => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      const res = await syncDatabases(currentUser.uid, providerConfig);
      setLastSynced(res.timestamp);
      setUploadToast(`Databases synchronized (${res.totalCount} items verified).`);
      setTimeout(() => setUploadToast(null), 3000);
    } catch (e: any) {
      console.error(e);
      setErrorMsg('Sync failed: ' + (e.message || ''));
    } finally {
      setIsSyncing(false);
    }
  };

  // Cross-cloud replication handler
  const handleReplicateAll = async (targetProvider: 'firebase' | 'supabase') => {
    if (!currentUser) return;
    const sourceFiles = files.filter((f) =>
      targetProvider === 'supabase' ? f.provider !== 'supabase' : f.provider === 'supabase'
    );
    for (const f of sourceFiles) {
      await replicateFileToOtherProvider(f, targetProvider, currentUser.uid);
    }
    await handleSyncNow();
  };

  // Seeder for starter files
  const handleSeedStarterFiles = async () => {
    if (!currentUser) {
      await signInWithGoogle();
    }
    if (!auth.currentUser) return;

    setIsUploading(true);
    setUploadToast('Adding starter files...');

    try {
      const uid = auth.currentUser.uid;

      // 1. Work Folder
      const folderId = await createFolder('Enterprise Assets', uid, null, providerConfig);

      // 2. Markdown Project Plan
      await createTextFile(
        'Architecture_Spec.md',
        `# Enterprise File Manager Architecture\n\n## Core Principles\n- **Zero-Trust Persistence**: Real-time cloud synchronization backed by strict attribute access.\n- **Universal Preview Engine**: In-browser rendering of high-resolution images, rich media, tabular datasets, source code, and structured binary.\n- **Direct Code Editing**: Modify documents in-place with instant cloud updates.\n\n### Formats Supported\n- **Documents**: PDF, Markdown, Plain Text, RTF\n- **Tabular Data**: CSV, TSV (Interactive Data Tables)\n- **Code**: TypeScript, Python, JSON, SQL, HTML, CSS, YAML\n- **Media**: MP4, WebM, MP3, WAV, FLAC\n- **Images**: SVG, PNG, WebP, JPG, GIF`,
        uid,
        folderId,
        providerConfig
      );

      // 3. Tabular CSV
      await createTextFile(
        'Global_Metrics_2026.csv',
        `Region,Active_Clusters,Throughput_MBps,Latency_ms,Availability\nUS-East,128,4850,1.2,99.999%\nEU-West,94,3620,1.4,99.998%\nAP-South,140,5120,1.6,99.995%\nSA-East,42,1240,2.1,99.990%`,
        uid,
        folderId,
        providerConfig
      );

      // 4. JSON Config
      await createTextFile(
        'system_config.json',
        `{\n  "service": "CloudFile Manager",\n  "edition": "Enterprise",\n  "version": "2.4.0",\n  "storage": "Persistent Firestore DB",\n  "security": "Enforced ABAC Rules",\n  "features": {\n    "fullscreen": true,\n    "universalPreview": true,\n    "inlineEditor": true,\n    "chunking": true\n  }\n}`,
        uid,
        null,
        providerConfig
      );

      // 5. SVG Asset
      await createTextFile(
        'datacenter_diagram.svg',
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" width="100%" height="100%">
  <rect width="600" height="300" rx="16" fill="#09090b" />
  <circle cx="300" cy="120" r="48" fill="#2563eb" fill-opacity="0.15" stroke="#3b82f6" stroke-width="2" />
  <path d="M260 120h80M300 80v80" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" />
  <text x="300" y="210" font-family="system-ui, sans-serif" font-size="20" font-weight="600" fill="#f4f4f5" text-anchor="middle">Universal Cloud Storage</text>
  <text x="300" y="235" font-family="system-ui, sans-serif" font-size="12" fill="#71717a" text-anchor="middle">Secure · Multi-Tenant · Real-time Persistent</text>
</svg>`,
        uid,
        null,
        providerConfig
      );

      setUploadToast('Starter files added!');
      setTimeout(() => setUploadToast(null), 3000);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Failed to seed sample files.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenFile = (file: FileItem) => {
    if (file.isFolder) {
      setCurrentFolderId(file.id);
      setSelectedCategory('all');
      setSelectedFileId(null);
    } else {
      setPreviewFile(file);
    }
  };

  const handleSelectFile = (file: FileItem) => {
    setSelectedFileId(file.id);
    setIsDetailsOpen(true);
  };

  const handleDownloadFile = (file: FileItem) => {
    const link = document.createElement('a');
    link.download = file.name;
    if (file.dataUrl) {
      link.href = file.dataUrl;
    } else if (file.textContent !== undefined) {
      const blob = new Blob([file.textContent], { type: file.mimeType || 'text/plain' });
      link.href = URL.createObjectURL(blob);
    } else {
      setPreviewFile(file);
      return;
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans">
      {/* Hidden Native File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files);
          }
        }}
        multiple
        className="hidden"
      />

      {/* Main Top Header */}
      <Header
        breadcrumbs={breadcrumbs}
        onNavigateBreadcrumb={(fId) => {
          setCurrentFolderId(fId);
          setSelectedCategory('all');
          setSelectedFileId(null);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortField={sortField}
        sortOrder={sortOrder}
        onSortChange={(f, o) => {
          setSortField(f);
          setSortOrder(o);
        }}
        currentUser={currentUser}
        onSignIn={signInWithGoogle}
        onSignOut={signOutUser}
        isOnline={true}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isDetailsOpen={isDetailsOpen}
        onToggleDetails={() => setIsDetailsOpen(!isDetailsOpen)}
        selectedFileCount={selectedFile ? 1 : 0}
        providerConfig={providerConfig}
        onOpenProviders={() => setIsProviderModalOpen(true)}
        onSyncNow={handleSyncNow}
        isSyncing={isSyncing}
      />

      {/* User-Friendly Notification Banner */}
      {errorMsg && (
        <div className="bg-amber-50 dark:bg-amber-950/80 border-b border-amber-200 dark:border-amber-900 px-6 py-2.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              {errorMsg.includes('{') || errorMsg.includes('Missing or insufficient')
                ? 'Sign in to access your persistent cloud storage across all sessions and devices.'
                : errorMsg}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {(!currentUser || currentUser.isAnonymous) && (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition"
              >
                Sign In
              </button>
            )}
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-amber-600 dark:text-amber-400 hover:text-amber-800 font-bold px-1"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {uploadToast && (
        <div className="fixed bottom-10 right-8 z-50 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-3 rounded-2xl shadow-2xl text-xs font-medium flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-150">
          {isUploading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <CheckCircle2 size={16} className="text-emerald-400 dark:text-emerald-600" />
          )}
          <span>{uploadToast}</span>
        </div>
      )}

      {/* Main Workspace Frame */}
      <div className="flex flex-1 overflow-hidden">
        {/* Collapsible Sidebar */}
        <Sidebar
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => {
            setSelectedCategory(cat);
            if (cat !== 'all') {
              setCurrentFolderId(null);
            }
          }}
          onUploadClick={() => fileInputRef.current?.click()}
          onNewFolderClick={() => setIsNewFolderOpen(true)}
          onNewTextFileClick={() => setIsNewTextFileOpen(true)}
          onOpenProvidersModal={() => setIsProviderModalOpen(true)}
          files={files}
          isUploading={isUploading}
          isCollapsed={isSidebarCollapsed}
        />

        {/* Central File Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-900/60 overflow-hidden relative">
          {/* File Grid / List Canvas */}
          <FileList
            files={displayedFiles}
            viewMode={viewMode}
            selectedFileId={selectedFileId}
            onSelectFile={handleSelectFile}
            onOpenFile={handleOpenFile}
            onPreviewFile={(f) => setPreviewFile(f)}
            onDownloadFile={handleDownloadFile}
            onRenameFile={(f) => setFileToRename(f)}
            onMoveFile={(f) => setFileToMove(f)}
            onDeleteFile={(f) => setFileToDelete(f)}
            onUploadClick={() => fileInputRef.current?.click()}
            onNewFolderClick={() => setIsNewFolderOpen(true)}
            onDropFiles={handleFileUpload}
            isDraggingOver={isDraggingOver}
            setIsDraggingOver={setIsDraggingOver}
            recentlyEditedIds={recentlyEditedIds}
          />

          {/* Bottom Status Bar */}
          <footer className="border-t border-zinc-200/90 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 px-6 py-2 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 select-none">
            <div className="flex items-center gap-3">
              <span>{displayedFiles.length} item{displayedFiles.length === 1 ? '' : 's'}</span>
              {selectedFile && (
                <>
                  <span>·</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                    1 selected ({selectedFile.name})
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-4 hidden sm:flex text-zinc-400">
              <span>Press <kbd className="px-1 py-0.5 bg-zinc-200 dark:bg-zinc-800 rounded font-mono text-[10px]">Space</kbd> to preview · <kbd className="px-1 py-0.5 bg-zinc-200 dark:bg-zinc-800 rounded font-mono text-[10px]">/</kbd> to search</span>
            </div>
          </footer>
        </main>

        {/* Right Details / Inspector Panel */}
        {isDetailsOpen && selectedFile && (
          <FileDetailsPanel
            file={selectedFile}
            onClose={() => setIsDetailsOpen(false)}
            onPreview={(f) => setPreviewFile(f)}
            onDownload={handleDownloadFile}
            onRename={(f) => setFileToRename(f)}
            onMove={(f) => setFileToMove(f)}
            onDelete={(f) => setFileToDelete(f)}
          />
        )}
      </div>

      {/* Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          siblingFiles={displayedFiles.filter((f) => !f.isFolder)}
          onClose={() => setPreviewFile(null)}
          onNavigateFile={(f) => setPreviewFile(f)}
          onDelete={(f) => setFileToDelete(f)}
          onRename={(f) => setFileToRename(f)}
          onFileUpdated={(fileId) => {
            markFileAsEdited(fileId);
            setUploadToast('File updated and saved.');
            setTimeout(() => setUploadToast(null), 3000);
          }}
          onExtractZip={async (file, dataUrl) => {
            if (!currentUser) {
              await signInWithGoogle();
            }
            if (!auth.currentUser) return;

            setPreviewFile(null);
            setIsUploading(true);
            setUploadProgress({
              isOpen: true,
              totalFiles: 1,
              currentFileIndex: 1,
              currentFileName: file.name,
              currentFilePercent: 0,
              overallPercent: 0,
              statusText: 'Unzipping archive...',
              isComplete: false,
              error: null,
            });

            try {
              const count = await extractZipToFolder(
                dataUrl,
                file.name,
                auth.currentUser.uid,
                currentFolderId,
                providerConfig,
                (percent, msg) => {
                  setUploadProgress((prev) => ({
                    ...prev,
                    currentFilePercent: percent,
                    overallPercent: percent,
                    statusText: msg,
                  }));
                }
              );

              setUploadProgress((prev) => ({
                ...prev,
                isComplete: true,
                overallPercent: 100,
                statusText: `Extracted ${count} file(s) into folder!`,
              }));
              setUploadToast(`Unzipped ${count} file(s) into your drive.`);
              setTimeout(() => {
                setUploadProgress((prev) => ({ ...prev, isOpen: false }));
                setUploadToast(null);
              }, 4000);
            } catch (err: any) {
              console.error('Unzip error:', err);
              setErrorMsg('Unzip failed: ' + (err.message || ''));
              setUploadProgress((prev) => ({
                ...prev,
                error: err.message || 'Unzip failed',
                statusText: 'Failed to extract archive',
              }));
            } finally {
              setIsUploading(false);
            }
          }}
        />
      )}

      {/* Dialog Modals */}
      <NewFolderModal
        isOpen={isNewFolderOpen}
        onClose={() => setIsNewFolderOpen(false)}
        onCreate={async (name) => {
          if (!currentUser) await signInWithGoogle();
          if (auth.currentUser) {
            const folderId = await createFolder(name, auth.currentUser.uid, currentFolderId, providerConfig);
            if (folderId) markFileAsEdited(folderId);
            setUploadToast(`Created folder "${name}".`);
            setTimeout(() => setUploadToast(null), 3000);
          }
        }}
      />

      <NewTextFileModal
        isOpen={isNewTextFileOpen}
        onClose={() => setIsNewTextFileOpen(false)}
        onCreate={async (name, content) => {
          if (!currentUser) await signInWithGoogle();
          if (auth.currentUser) {
            const fileId = await createTextFile(name, content, auth.currentUser.uid, currentFolderId, providerConfig);
            if (fileId) markFileAsEdited(fileId);
            setUploadToast(`Created file "${name}".`);
            setTimeout(() => setUploadToast(null), 3000);
          }
        }}
      />

      <RenameModal
        file={fileToRename}
        onClose={() => setFileToRename(null)}
        onRename={async (fileId, newName) => {
          await renameFileItem(fileId, newName);
          markFileAsEdited(fileId);
          setUploadToast(`Renamed to "${newName}".`);
          setTimeout(() => setUploadToast(null), 3000);
          if (previewFile && previewFile.id === fileId) {
            setPreviewFile((prev) => (prev ? { ...prev, name: newName } : null));
          }
        }}
      />

      <MoveModal
        file={fileToMove}
        folders={allFolders}
        onClose={() => setFileToMove(null)}
        onMove={async (fileId, newParentId) => {
          await moveFileItem(fileId, newParentId);
          markFileAsEdited(fileId);
          setUploadToast('File moved successfully.');
          setTimeout(() => setUploadToast(null), 3000);
        }}
      />

      <DeleteConfirmModal
        file={fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={async (file) => {
          await deleteFileItem(file, files);
          setUploadToast(`Deleted "${file.name}".`);
          setTimeout(() => setUploadToast(null), 3000);
          if (previewFile?.id === file.id) {
            setPreviewFile(null);
          }
          if (selectedFileId === file.id) {
            setSelectedFileId(null);
            setIsDetailsOpen(false);
          }
        }}
      />

      <ProviderModal
        isOpen={isProviderModalOpen}
        onClose={() => setIsProviderModalOpen(false)}
        firebaseBytes={firebaseBytes}
        supabaseFileCount={supabaseFileCount}
        firebaseFileCount={files.filter((f) => f.provider !== 'supabase').length}
        forceSupabase={forceSupabase}
        onToggleForceSupabase={(val) => {
          setForceSupabase(val);
          setForceSupabaseMode(val);
        }}
        providerConfig={providerConfig}
        onUpdateProviderConfig={handleUpdateProviderConfig}
        onSyncNow={handleSyncNow}
        onReplicateAll={handleReplicateAll}
        isSyncing={isSyncing}
        lastSynced={lastSynced}
      />

      {/* Live Upload Progress Widget */}
      <UploadProgressWidget
        progress={uploadProgress}
        onClose={() => setUploadProgress((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
