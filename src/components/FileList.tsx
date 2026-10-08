import React, { useState } from 'react';
import {
  Eye,
  Download,
  MoreVertical,
  Edit2,
  CornerDownRight,
  Trash2,
  Folder,
  UploadCloud,
  FilePlus,
  FolderPlus,
  Clock,
  HardDrive,
  Check,
} from 'lucide-react';
import { FileItem, ViewMode } from '../types';
import { formatFileSize } from '../services/fileService';
import { FileIcon } from './FileIcon';

interface FileListProps {
  files: FileItem[];
  viewMode: ViewMode;
  selectedFileId: string | null;
  onSelectFile: (file: FileItem) => void;
  onOpenFile: (file: FileItem) => void;
  onPreviewFile: (file: FileItem) => void;
  onDownloadFile: (file: FileItem) => void;
  onRenameFile: (file: FileItem) => void;
  onMoveFile: (file: FileItem) => void;
  onDeleteFile: (file: FileItem) => void;
  onUploadClick: () => void;
  onNewFolderClick: () => void;
  onDropFiles: (files: FileList) => void;
  isDraggingOver: boolean;
  setIsDraggingOver: (val: boolean) => void;
  recentlyEditedIds?: Set<string>;
}

export const FileList: React.FC<FileListProps> = ({
  files,
  viewMode,
  selectedFileId,
  onSelectFile,
  onOpenFile,
  onPreviewFile,
  onDownloadFile,
  onRenameFile,
  onMoveFile,
  onDeleteFile,
  onUploadClick,
  onNewFolderClick,
  onDropFiles,
  isDraggingOver,
  setIsDraggingOver,
  recentlyEditedIds,
}) => {
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      onDropFiles(e.dataTransfer.files);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '-';
    try {
      const d = date instanceof Date ? date : new Date(date);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '-';
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex-1 overflow-auto p-6 sm:p-8 transition-colors ${
        isDraggingOver ? 'bg-blue-50/40 dark:bg-blue-950/20 ring-2 ring-blue-500 ring-inset' : ''
      }`}
    >
      {/* Full-window Drag & Drop Target */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/90 dark:bg-zinc-950/90 backdrop-blur-2xs border-2 border-dashed border-blue-500 rounded-2xl m-6 pointer-events-none">
          <UploadCloud className="w-20 h-20 text-blue-500 animate-bounce" />
          <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Drop files to upload instantly
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Universal multi-format storage & chunking enabled
          </p>
        </div>
      )}

      {/* Empty State */}
      {files.length === 0 ? (
        <div className="h-full min-h-[460px] flex flex-col items-center justify-center text-center p-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/30 dark:bg-zinc-900/10">
          <div className="w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 flex items-center justify-center text-zinc-400 mb-5 shadow-2xs">
            <UploadCloud size={32} />
          </div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            This folder is empty
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-sm leading-relaxed">
            Drag and drop files here, or use the action buttons below to upload any documents, code, images, or media files.
          </p>
          <div className="flex items-center gap-3 mt-6">
            <button
              type="button"
              onClick={onUploadClick}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
            >
              <UploadCloud size={15} />
              <span>Upload Files</span>
            </button>
            <button
              type="button"
              onClick={onNewFolderClick}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 rounded-xl transition shadow-2xs"
            >
              <FolderPlus size={15} className="text-amber-500" />
              <span>New Folder</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* SPACIOUS GRID VIEW */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 sm:gap-6">
          {files.map((file) => {
            const isImg =
              !file.isFolder &&
              (file.mimeType.startsWith('image/') ||
                ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(file.extension.toLowerCase()));
            const isSelected = selectedFileId === file.id;

            return (
              <div
                key={file.id}
                onClick={() => onSelectFile(file)}
                onDoubleClick={() => onOpenFile(file)}
                className={`group relative flex flex-col justify-between bg-white dark:bg-zinc-900/90 rounded-2xl p-4 transition-all cursor-pointer select-none border ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md bg-blue-50/20 dark:bg-blue-950/20'
                    : 'border-zinc-200/90 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md'
                }`}
              >
                {/* Spacious Thumbnail Preview Container */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenFile(file);
                  }}
                  className="relative w-full h-36 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 overflow-hidden flex items-center justify-center border border-zinc-100 dark:border-zinc-800/80 mb-3.5 cursor-pointer hover:opacity-95"
                >
                  {isImg && (file.dataUrl || file.textContent) ? (
                    <img
                      src={
                        file.dataUrl ||
                        (file.extension.toLowerCase() === 'svg'
                          ? `data:image/svg+xml;utf8,${encodeURIComponent(file.textContent || '')}`
                          : '')
                      }
                      alt={file.name}
                      className="w-full h-full object-cover transition group-hover:scale-105 duration-200"
                    />
                  ) : (
                    <FileIcon
                      isFolder={file.isFolder}
                      mimeType={file.mimeType}
                      extension={file.extension}
                      size={46}
                    />
                  )}

                  {/* Hover Quick Action Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-2xs">
                    {!file.isFolder && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreviewFile(file);
                        }}
                        className="p-2 bg-white/95 text-zinc-800 hover:bg-white rounded-lg shadow-sm transition"
                        title="Preview"
                      >
                        <Eye size={16} />
                      </button>
                    )}
                    {!file.isFolder && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownloadFile(file);
                        }}
                        className="p-2 bg-white/95 text-zinc-800 hover:bg-white rounded-lg shadow-sm transition"
                        title="Download"
                      >
                        <Download size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* File Information & Secondary Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h4
                        title={file.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFile(file);
                        }}
                        className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-snug hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                      >
                        {file.name}
                      </h4>
                      {recentlyEditedIds?.has(file.id) && (
                        <span className="text-[9px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1 py-0.2 rounded border border-amber-200 dark:border-amber-900/60 shrink-0">
                          Edited
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
                      <span>{file.isFolder ? 'Folder' : formatFileSize(file.size)}</span>
                      <span>·</span>
                      <span>{recentlyEditedIds?.has(file.id) ? 'Just now' : formatDate(file.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Context Menu Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuFileId(activeMenuFileId === file.id ? null : file.id);
                      }}
                      className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    >
                      <MoreVertical size={15} />
                    </button>

                    {activeMenuFileId === file.id && (
                      <>
                        <div
                          className="fixed inset-0 z-30"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuFileId(null);
                          }}
                        />
                        <div className="absolute right-0 top-7 z-40 w-40 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl py-1 text-xs text-zinc-700 dark:text-zinc-200 animate-in fade-in duration-100">
                          {!file.isFolder && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuFileId(null);
                                onPreviewFile(file);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition"
                            >
                              <Eye size={14} />
                              <span>Preview</span>
                            </button>
                          )}
                          {!file.isFolder && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuFileId(null);
                                onDownloadFile(file);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition"
                            >
                              <Download size={14} />
                              <span>Download</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuFileId(null);
                              onRenameFile(file);
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition"
                          >
                            <Edit2 size={14} />
                            <span>Rename</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuFileId(null);
                              onMoveFile(file);
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition"
                          >
                            <CornerDownRight size={14} />
                            <span>Move to...</span>
                          </button>
                          <div className="my-1 border-t border-zinc-100 dark:border-zinc-700" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuFileId(null);
                              onDeleteFile(file);
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition"
                          >
                            <Trash2 size={14} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* SPACIOUS LIST VIEW TABLE */
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40 text-zinc-500 font-semibold select-none">
                <th className="py-3.5 px-6">Name</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Size</th>
                <th className="py-3.5 px-4">Provider</th>
                <th className="py-3.5 px-4">Last Modified</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {files.map((file) => {
                const isSelected = selectedFileId === file.id;
                return (
                  <tr
                    key={file.id}
                    onClick={() => onSelectFile(file)}
                    onDoubleClick={() => onOpenFile(file)}
                    className={`transition-colors cursor-pointer group ${
                      isSelected
                        ? 'bg-blue-50/60 dark:bg-blue-950/40'
                        : 'hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30'
                    }`}
                  >
                    <td className="py-3.5 px-6">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFile(file);
                        }}
                        className="flex items-center gap-3.5 min-w-0 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                        title={file.isFolder ? 'Open folder' : 'Preview file'}
                      >
                        <FileIcon
                          isFolder={file.isFolder}
                          mimeType={file.mimeType}
                          extension={file.extension}
                          size={20}
                        />
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-sm sm:max-w-md">
                          {file.name}
                        </span>
                        {recentlyEditedIds?.has(file.id) && (
                          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/60 shrink-0">
                            Edited
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-500 dark:text-zinc-400">
                      <span className="uppercase text-[11px] font-mono">
                        {file.isFolder ? 'Folder' : file.extension || 'file'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                      {file.isFolder ? '-' : formatFileSize(file.size)}
                    </td>

                    <td className="py-3.5 px-4 text-xs">
                      <span className={file.provider === 'supabase' ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-blue-600 dark:text-blue-400 font-medium'}>
                        {file.provider === 'supabase' ? 'Supabase' : 'Firebase'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-500 dark:text-zinc-400">
                      {recentlyEditedIds?.has(file.id) ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">Just now (Edited)</span>
                      ) : (
                        formatDate(file.updatedAt)
                      )}
                    </td>

                    <td className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        {!file.isFolder && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPreviewFile(file);
                            }}
                            className="p-1.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                            title="Preview"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        {!file.isFolder && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadFile(file);
                            }}
                            className="p-1.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                            title="Download"
                          >
                            <Download size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRenameFile(file);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                          title="Rename"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveFile(file);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                          title="Move"
                        >
                          <CornerDownRight size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteFile(file);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
