import React, { useState } from 'react';
import { X, FileCode2 } from 'lucide-react';

interface NewTextFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, content: string) => Promise<void>;
}

export const NewTextFileModal: React.FC<NewTextFileModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreate(fileName.trim(), content);
      setFileName('');
      setContent('');
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-file-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
    >
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-lg w-full shadow-xl overflow-hidden p-5 animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-indigo-500" />
            <h3 id="new-file-modal-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">New Text or Code File</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="new-file-name" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              File Name (e.g. notes.txt, config.json, script.py, readme.md)
            </label>
            <input
              id="new-file-name"
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="e.g. todo.md, api.json, index.html"
              autoFocus
              className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-lg outline-none focus:border-blue-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 font-mono"
            />
          </div>

          <div>
            <label htmlFor="new-file-content" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              Initial Content (Optional)
            </label>
            <textarea
              id="new-file-content"
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter text or code here..."
              className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-lg outline-none focus:border-blue-500 text-zinc-900 dark:text-zinc-100 font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!fileName.trim() || isSubmitting}
              className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create File'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
