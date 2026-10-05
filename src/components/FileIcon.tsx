import React from 'react';
import {
  Folder,
  FileImage,
  FileAudio,
  FileVideo,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  FileText,
  File as GenericFile,
} from 'lucide-react';

interface FileIconProps {
  isFolder: boolean;
  mimeType?: string;
  extension?: string;
  className?: string;
  size?: number;
}

export const FileIcon: React.FC<FileIconProps> = ({
  isFolder,
  mimeType = '',
  extension = '',
  className = '',
  size = 24,
}) => {
  const ext = extension.toLowerCase();

  if (isFolder) {
    return <Folder size={size} className={`text-amber-500 fill-amber-500/20 ${className}`} />;
  }

  // Images
  if (
    mimeType.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff'].includes(ext)
  ) {
    return <FileImage size={size} className={`text-blue-500 ${className}`} />;
  }

  // Audio
  if (
    mimeType.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma'].includes(ext)
  ) {
    return <FileAudio size={size} className={`text-purple-500 ${className}`} />;
  }

  // Video
  if (
    mimeType.startsWith('video/') ||
    ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv'].includes(ext)
  ) {
    return <FileVideo size={size} className={`text-rose-500 ${className}`} />;
  }

  // Spreadsheets / Data
  if (
    ['csv', 'tsv', 'xls', 'xlsx', 'ods'].includes(ext) ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('csv')
  ) {
    return <FileSpreadsheet size={size} className={`text-emerald-500 ${className}`} />;
  }

  // Code
  if (
    [
      'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'scss', 'py', 'json', 'xml',
      'yaml', 'yml', 'sql', 'sh', 'bash', 'java', 'c', 'cpp', 'cs', 'go',
      'rs', 'php', 'rb', 'dockerfile',
    ].includes(ext) ||
    mimeType.includes('json') ||
    mimeType.includes('javascript')
  ) {
    return <FileCode size={size} className={`text-indigo-500 ${className}`} />;
  }

  // Archives
  if (
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext) ||
    mimeType.includes('zip') ||
    mimeType.includes('compressed') ||
    mimeType.includes('tar')
  ) {
    return <FileArchive size={size} className={`text-orange-500 ${className}`} />;
  }

  // Documents / Text / PDF
  if (ext === 'pdf' || mimeType.includes('pdf')) {
    return <FileText size={size} className={`text-red-500 ${className}`} />;
  }

  if (
    mimeType.startsWith('text/') ||
    ['txt', 'md', 'markdown', 'doc', 'docx', 'rtf', 'log', 'env'].includes(ext)
  ) {
    return <FileText size={size} className={`text-slate-500 ${className}`} />;
  }

  return <GenericFile size={size} className={`text-slate-400 ${className}`} />;
};
