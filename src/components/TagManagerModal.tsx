import React, { useState } from 'react';
import {
  Tag,
  Plus,
  Trash2,
  Check,
  X,
  Palette,
  AlertCircle,
} from 'lucide-react';
import { FileItem, TagItem } from '../types';
import { TAG_COLORS, getTagColorDef } from '../lib/tagColors';

interface TagManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  file?: FileItem | null;
  allTags: TagItem[];
  allFiles: FileItem[];
  onCreateTag: (tag: TagItem) => Promise<void>;
  onDeleteTag: (tagId: string) => Promise<void>;
  onToggleFileTag?: (file: FileItem, tagId: string) => Promise<void>;
}

export const TagManagerModal: React.FC<TagManagerModalProps> = ({
  isOpen,
  onClose,
  file,
  allTags,
  allFiles,
  onCreateTag,
  onDeleteTag,
  onToggleFileTag,
}) => {
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('blue');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentFileTagIds = new Set(file?.tags || []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    // Check duplicate
    if (allTags.some((t) => t.name.toLowerCase() === newTagName.trim().toLowerCase())) {
      setError(`Tag "${newTagName.trim()}" already exists.`);
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      const newTag: TagItem = {
        id: 'tag_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: newTagName.trim(),
        color: newTagColor,
      };
      await onCreateTag(newTag);
      // If modal is opened for a file, automatically assign this new tag to the file
      if (file && onToggleFileTag) {
        await onToggleFileTag(file, newTag.id);
      }
      setNewTagName('');
    } catch (err: any) {
      setError(err?.message || 'Failed to create tag.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Tag size={17} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {file ? 'Assign Tags' : 'Manage Tags'}
              </h3>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate max-w-[260px]">
                {file ? file.name : `${allTags.length} tags configured`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Create New Tag Box */}
          <form onSubmit={handleCreate} className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/60 rounded-xl space-y-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
              Create New Tag
            </span>

            <div className="flex gap-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name (e.g. In Review, Client X)"
                maxLength={30}
                required
                className="flex-1 px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
              <button
                type="submit"
                disabled={isCreating || !newTagName.trim()}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition disabled:opacity-50 shrink-0"
              >
                <Plus size={14} />
                <span>Add</span>
              </button>
            </div>

            {/* Color Palette Selector */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-zinc-400 shrink-0">Color:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {Object.values(TAG_COLORS).map((c) => {
                  const isSelected = newTagColor === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNewTagColor(c.id)}
                      title={c.label}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition ${c.dotBg} ${
                        isSelected
                          ? 'ring-2 ring-offset-2 ring-zinc-900 dark:ring-white scale-110'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {isSelected && <Check size={12} className="text-white drop-shadow-xs" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </form>

          {/* Tags List */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
              {file ? 'Click to Toggle Tags on File' : 'Existing Tags'}
            </span>

            {allTags.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-4">No tags created yet.</p>
            ) : (
              <div className="space-y-1.5">
                {allTags.map((tag) => {
                  const colorDef = getTagColorDef(tag.color);
                  const isAssigned = file ? currentFileTagIds.has(tag.id) : false;
                  const usageCount = allFiles.filter((f) => f.tags?.includes(tag.id)).length;

                  return (
                    <div
                      key={tag.id}
                      onClick={() => {
                        if (file && onToggleFileTag) {
                          onToggleFileTag(file, tag.id);
                        }
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition select-none ${
                        file ? 'cursor-pointer' : ''
                      } ${
                        isAssigned
                          ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800'
                          : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {file && (
                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center transition ${
                              isAssigned
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'
                            }`}
                          >
                            {isAssigned && <Check size={11} strokeWidth={3} />}
                          </div>
                        )}
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorDef.fullBadge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${colorDef.dotBg}`} />
                          <span>{tag.name}</span>
                        </span>
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                          ({usageCount} item{usageCount === 1 ? '' : 's'})
                        </span>
                      </div>

                      {/* Delete Tag Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete tag "${tag.name}"?`)) {
                            onDeleteTag(tag.id);
                          }
                        }}
                        title="Delete tag"
                        className="p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
