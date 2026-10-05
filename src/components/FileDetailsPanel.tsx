import React from 'react';
import {
  X,
  Download,
  Eye,
  Edit2,
  CornerDownRight,
  Trash2,
  HardDrive,
  Calendar,
  FileType,
  Layers,
  Folder,
  Database,
} from 'lucide-react';
import { FileItem } from '../types';
import { formatFileSize } from '../services/fileService';
import { FileIcon } from './FileIcon';

interface FileDetailsPanelProps {
  file: FileItem | null;
  onClose: () => void;
  onPreview: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onMove: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
}

export const FileDetailsPanel: React.FC<FileDetailsPanelProps> = ({
  file,
  onClose,
  onPreview,
  onDownload,
  onRename,
  onMove,
  onDelete,
}) => {
  if (!file) return null;

  const formatDate = (date: any) => {
    if (!date) return '-';
    try {
      const d = date instanceof Date ? date : new Date(date);
      return d.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return '-';
    }
  };

  const isImg =
    !file.isFolder &&
    (file.mimeType.startsWith('image/') ||
      ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(file.extension.toLowerCase()));

  return (
    <aside className="w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 flex flex-col justify-between shrink-0 select-none overflow-y-auto animate-in slide-in-from-right duration-150">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            File Details
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Close details panel"
          >
            <X size={16} />
          </button>
        </div>

        {/* Thumbnail Preview Area */}
        <div className="p-6 flex flex-col items-center justify-center border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30">
          <div className="w-36 h-36 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/60 shadow-xs flex items-center justify-center overflow-hidden mb-3">
            {isImg && (file.dataUrl || file.textContent) ? (
              <img
                src={
                  file.dataUrl ||
                  (file.extension.toLowerCase() === 'svg'
                    ? `data:image/svg+xml;utf8,${encodeURIComponent(file.textContent || '')}`
                    : '')
                }
                alt={file.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <FileIcon
                isFolder={file.isFolder}
                mimeType={file.mimeType}
                extension={file.extension}
                size={52}
              />
            )}
          </div>
          <h3
            title={file.name}
            className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 text-center max-w-[240px] truncate"
          >
            {file.name}
          </h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
            {file.isFolder ? 'Folder' : `${formatFileSize(file.size)}`}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-2">
          {!file.isFolder && (
            <button
              type="button"
              onClick={() => onPreview(file)}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-2xs transition"
            >
              <Eye size={14} />
              <span>Preview</span>
            </button>
          )}
          {!file.isFolder ? (
            <button
              type="button"
              onClick={() => onDownload(file)}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-medium transition"
            >
              <Download size={14} />
              <span>Download</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onRename(file)}
              className="col-span-2 flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-medium transition"
            >
              <Edit2 size={14} />
              <span>Rename Folder</span>
            </button>
          )}
        </div>

        {/* Metadata Properties List */}
        <div className="p-5 space-y-4 text-xs">
          <div>
            <span className="text-zinc-400 dark:text-zinc-500 block mb-1">Type</span>
            <div className="flex items-center gap-2 font-medium text-zinc-800 dark:text-zinc-200">
              <FileType size={14} className="text-zinc-400" />
              <span className="truncate">{file.isFolder ? 'Folder' : file.mimeType}</span>
            </div>
          </div>

          <div>
            <span className="text-zinc-400 dark:text-zinc-500 block mb-1">File Extension</span>
            <div className="font-mono text-zinc-800 dark:text-zinc-200 uppercase">
              {file.extension ? `.${file.extension}` : '-'}
            </div>
          </div>

          <div>
            <span className="text-zinc-400 dark:text-zinc-500 block mb-1">Size</span>
            <div className="flex items-center gap-2 font-medium text-zinc-800 dark:text-zinc-200">
              <HardDrive size={14} className="text-zinc-400" />
              <span>{file.isFolder ? '-' : `${formatFileSize(file.size)} (${file.size.toLocaleString()} bytes)`}</span>
            </div>
          </div>

          <div>
            <span className="text-zinc-400 dark:text-zinc-500 block mb-1">Storage Provider</span>
            <div className="flex items-center gap-2 font-medium text-zinc-800 dark:text-zinc-200">
              <Database size={14} className={file.provider === 'supabase' ? 'text-emerald-500' : 'text-blue-500'} />
              <span>{file.provider === 'supabase' ? 'Supabase Database (Failover)' : 'Firebase Firestore (Primary)'}</span>
            </div>
          </div>

          <div>
            <span className="text-zinc-400 dark:text-zinc-500 block mb-1">Storage Mode</span>
            <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <Layers size={14} className="text-zinc-400" />
              <span>{file.isChunked ? `Multi-part (${file.totalChunks} chunks)` : 'Single Document'}</span>
            </div>
          </div>

          <div>
            <span className="text-zinc-400 dark:text-zinc-500 block mb-1">Last Modified</span>
            <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <Calendar size={14} className="text-zinc-400" />
              <span>{formatDate(file.updatedAt)}</span>
            </div>
          </div>

          <div>
            <span className="text-zinc-400 dark:text-zinc-500 block mb-1">Created</span>
            <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <Calendar size={14} className="text-zinc-400" />
              <span>{formatDate(file.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Secondary Actions */}
      <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onMove(file)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
        >
          <CornerDownRight size={13} />
          <span>Move</span>
        </button>
        <button
          type="button"
          onClick={() => onRename(file)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
        >
          <Edit2 size={13} />
          <span>Rename</span>
        </button>
        <button
          type="button"
          onClick={() => onDelete(file)}
          className="p-1.5 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition"
          title="Delete"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </aside>
  );
};
