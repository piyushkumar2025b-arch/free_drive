import React, { useState } from 'react';
import {
  Pin,
  Lock,
  ChevronDown,
  ChevronUp,
  Folder,
  Eye,
  X,
  ExternalLink,
} from 'lucide-react';
import { FileItem, TagItem } from '../types';
import { FileIcon } from './FileIcon';
import { getTagColorDef } from '../lib/tagColors';
import { formatFileSize } from '../services/fileService';

interface FastAccessBarProps {
  pinnedFiles: FileItem[];
  allTags: TagItem[];
  onOpenFile: (file: FileItem) => void;
  onPreviewFile: (file: FileItem) => void;
  onUnpinFile: (file: FileItem) => void;
}

export const FastAccessBar: React.FC<FastAccessBarProps> = ({
  pinnedFiles,
  allTags,
  onOpenFile,
  onPreviewFile,
  onUnpinFile,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (pinnedFiles.length === 0) return null;

  return (
    <div className="border-b border-zinc-200/80 dark:border-zinc-800 bg-gradient-to-r from-amber-500/5 via-blue-500/5 to-transparent px-6 sm:px-8 py-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-amber-500 text-white flex items-center justify-center shadow-2xs">
            <Pin size={12} className="rotate-45" />
          </div>
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Fast Access
          </span>
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
            ({pinnedFiles.length} pinned)
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
        >
          <span>{isExpanded ? 'Hide' : 'Show'}</span>
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {isExpanded && (
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
          {pinnedFiles.map((file) => {
            const fileTags = allTags.filter((t) => file.tags?.includes(t.id));

            return (
              <div
                key={file.id}
                onClick={() => onOpenFile(file)}
                className="group relative flex items-center gap-2.5 px-3 py-2 bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 hover:border-blue-400 dark:hover:border-blue-500 rounded-xl shadow-2xs hover:shadow-xs transition cursor-pointer shrink-0 max-w-[210px]"
                title={`Open ${file.name}`}
              >
                {/* File / Folder Icon */}
                <div className="relative shrink-0">
                  <FileIcon
                    isFolder={file.isFolder}
                    mimeType={file.mimeType}
                    extension={file.extension}
                    size={22}
                  />
                  {file.isPasswordProtected && (
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-2xs">
                      <Lock size={8} />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      {file.isFolder ? 'Folder' : formatFileSize(file.size)}
                    </span>

                    {/* Tag Dots */}
                    {fileTags.length > 0 && (
                      <div className="flex items-center gap-1">
                        {fileTags.slice(0, 3).map((t) => (
                          <span
                            key={t.id}
                            className={`w-1.5 h-1.5 rounded-full ${getTagColorDef(t.color).dotBg}`}
                            title={t.name}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Unpin button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnpinFile(file);
                  }}
                  title="Unpin from Fast Access"
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-amber-600 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition shrink-0"
                >
                  <Pin size={12} className="rotate-45 fill-amber-500 text-amber-500" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
