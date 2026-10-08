import React from 'react';
import {
  Upload,
  FolderPlus,
  FilePlus,
  Files,
  Folder,
  FileText,
  FileImage,
  Film,
  Code2,
  Archive,
  Database,
  CheckCircle2,
  Pin,
  Tag,
  Plus,
} from 'lucide-react';
import { FileCategory, FileItem, TagItem } from '../types';
import { formatFileSize } from '../services/fileService';
import { getTagColorDef } from '../lib/tagColors';

interface SidebarProps {
  selectedCategory: FileCategory;
  onSelectCategory: (c: FileCategory) => void;
  onUploadClick: () => void;
  onNewFolderClick: () => void;
  onNewTextFileClick: () => void;
  onOpenProvidersModal: () => void;
  files: FileItem[];
  tags: TagItem[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  onOpenTagManager: () => void;
  isUploading: boolean;
  isCollapsed: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedCategory,
  onSelectCategory,
  onUploadClick,
  onNewFolderClick,
  onNewTextFileClick,
  onOpenProvidersModal,
  files,
  tags,
  selectedTagId,
  onSelectTag,
  onOpenTagManager,
  isUploading,
  isCollapsed,
}) => {
  const totalFiles = files.filter((f) => !f.isFolder).length;
  const totalFolders = files.filter((f) => f.isFolder).length;
  const totalPinned = files.filter((f) => !!f.isPinned).length;
  const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);

  const categories: { id: FileCategory; label: string; icon: React.ReactNode; count: number }[] = [
    {
      id: 'all',
      label: 'All Files',
      icon: <Files size={16} />,
      count: files.length,
    },
    {
      id: 'pinned',
      label: 'Fast Access',
      icon: <Pin size={16} className="text-amber-500 rotate-45" />,
      count: totalPinned,
    },
    {
      id: 'folders',
      label: 'Folders',
      icon: <Folder size={16} className="text-amber-500" />,
      count: totalFolders,
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: <FileText size={16} className="text-red-500" />,
      count: files.filter((f) => !f.isFolder && (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(f.extension.toLowerCase()) || f.mimeType.includes('pdf'))).length,
    },
    {
      id: 'images',
      label: 'Images',
      icon: <FileImage size={16} className="text-blue-500" />,
      count: files.filter((f) => !f.isFolder && (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(f.extension.toLowerCase()) || f.mimeType.startsWith('image/'))).length,
    },
    {
      id: 'media',
      label: 'Media',
      icon: <Film size={16} className="text-purple-500" />,
      count: files.filter((f) => !f.isFolder && (f.mimeType.startsWith('audio/') || f.mimeType.startsWith('video/') || ['mp3', 'wav', 'mp4', 'webm', 'ogg', 'm4a'].includes(f.extension.toLowerCase()))).length,
    },
    {
      id: 'code',
      label: 'Code & Data',
      icon: <Code2 size={16} className="text-indigo-500" />,
      count: files.filter((f) => !f.isFolder && (['js', 'jsx', 'ts', 'tsx', 'json', 'py', 'html', 'css', 'csv', 'sql', 'yaml', 'md'].includes(f.extension.toLowerCase()) || f.mimeType.includes('json') || f.mimeType.includes('csv'))).length,
    },
    {
      id: 'archives',
      label: 'Archives',
      icon: <Archive size={16} className="text-orange-500" />,
      count: files.filter((f) => !f.isFolder && ['zip', 'rar', '7z', 'tar', 'gz'].includes(f.extension.toLowerCase())).length,
    },
  ];

  if (isCollapsed) {
    return (
      <aside className="w-16 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 flex flex-col items-center py-5 justify-between shrink-0 select-none">
        <div className="flex flex-col items-center gap-4 w-full">
          <button
            type="button"
            onClick={onUploadClick}
            disabled={isUploading}
            title="Upload Files"
            className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-xs transition"
          >
            <Upload size={18} />
          </button>

          <button
            type="button"
            onClick={onNewFolderClick}
            title="New Folder"
            className="w-9 h-9 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition"
          >
            <FolderPlus size={17} />
          </button>

          <button
            type="button"
            onClick={onNewTextFileClick}
            title="New Document"
            className="w-9 h-9 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition"
          >
            <FilePlus size={17} />
          </button>

          <div className="w-8 h-px bg-zinc-200 dark:bg-zinc-800 my-1" />

          {/* Collapsed Category Icons */}
          <nav className="flex flex-col items-center gap-1.5 w-full px-2">
            {categories.map((c) => {
              const isActive = selectedCategory === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectCategory(c.id)}
                  title={`${c.label} (${c.count})`}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {c.icon}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Collapsed Database Status */}
        <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400" title="Firestore Persistent Database Connected">
          <Database size={15} />
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-72 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 flex flex-col justify-between shrink-0 select-none">
      <div className="p-5 space-y-6">
        {/* Primary Action Buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onUploadClick}
            disabled={isUploading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50 tracking-wide"
          >
            <Upload size={16} />
            <span>{isUploading ? 'Uploading...' : 'Upload Files'}</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onNewFolderClick}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white dark:bg-zinc-800/90 border border-zinc-200/90 dark:border-zinc-700/80 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs font-medium transition shadow-2xs"
            >
              <FolderPlus size={14} className="text-amber-500" />
              <span>New Folder</span>
            </button>
            <button
              type="button"
              onClick={onNewTextFileClick}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white dark:bg-zinc-800/90 border border-zinc-200/90 dark:border-zinc-700/80 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs font-medium transition shadow-2xs"
            >
              <FilePlus size={14} className="text-indigo-500" />
              <span>New Doc</span>
            </button>
          </div>
        </div>

        {/* Categories Section */}
        <div className="space-y-1">
          <span className="px-3 pb-2 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
            Navigation
          </span>
          <nav className="space-y-1">
            {categories.map((c) => {
              const isActive = selectedCategory === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectCategory(c.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {c.icon}
                    <span>{c.label}</span>
                  </div>
                  <span
                    className={`text-xs tabular-nums ${
                      isActive
                        ? 'text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  >
                    {c.count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tags Section */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-3 pb-1">
            <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
              Tags
            </span>
            <button
              type="button"
              onClick={onOpenTagManager}
              className="p-1 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-md hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition"
              title="Create & manage tags"
            >
              <Plus size={13} />
            </button>
          </div>

          <nav className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
            {tags.map((tag) => {
              const isSelected = selectedTagId === tag.id;
              const colorDef = getTagColorDef(tag.color);
              const tagFileCount = files.filter((f) => f.tags?.includes(tag.id)).length;

              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onSelectTag(isSelected ? null : tag.id)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className={`w-2 h-2 rounded-full ${colorDef.dotBg} shrink-0`} />
                    <span className="truncate">{tag.name}</span>
                  </div>
                  <span
                    className={`text-[11px] tabular-nums ${
                      isSelected
                        ? 'text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  >
                    {tagFileCount}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Storage & Cloud Database Status */}
      <div className="p-5 border-t border-zinc-200/80 dark:border-zinc-800/80">
        <div className="bg-white dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/60 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Cloud Storage (1 GB Free)
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 size={12} />
              <span>Synced</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
              <span>{formatFileSize(totalBytes)} of 1 GB used</span>
              <span>{totalFiles} files</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-700/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(1, (totalBytes / (1024 * 1024 * 1024)) * 100))}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5">
              <span>{formatFileSize(Math.max(0, 1024 * 1024 * 1024 - totalBytes))} free</span>
              <span className="tabular-nums font-mono">{((totalBytes / (1024 * 1024 * 1024)) * 100).toFixed(2)}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            <div className="flex items-center gap-1.5">
              <Database size={12} />
              <span>Firebase + Supabase</span>
            </div>
            <button
              type="button"
              onClick={onOpenProvidersModal}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Failover Config
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
