export interface TagItem {
  id: string;
  name: string;
  color: string; // e.g., 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan' | 'indigo' | 'orange'
  userId?: string;
}

export interface FileItem {
  id: string;
  name: string;
  isFolder: boolean;
  parentId: string | null;
  size: number;
  mimeType: string;
  extension: string;
  userId: string;
  dataUrl?: string;
  textContent?: string;
  isChunked?: boolean;
  totalChunks?: number;
  createdAt: any;
  updatedAt: any;
  provider?: 'firebase' | 'supabase';
  isPinned?: boolean;
  tags?: string[];
  isPasswordProtected?: boolean;
  passwordHash?: string;
  passwordHint?: string;
}

export type FileCategory =
  | 'all'
  | 'pinned'
  | 'folders'
  | 'documents'
  | 'images'
  | 'media'
  | 'code'
  | 'archives';

export type SortField = 'name' | 'updatedAt' | 'size';
export type SortOrder = 'asc' | 'desc';

export type ViewMode = 'grid' | 'list';

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export interface ProviderConfig {
  firebaseEnabled: boolean;
  supabaseEnabled: boolean;
}

export interface StorageProviderStatus {
  primary: 'firebase';
  secondary: 'supabase';
  firebaseUsedBytes: number;
  firebaseMaxBytes: number;
  isFirebaseFull: boolean;
  activeProvider: 'firebase' | 'supabase';
  supabaseConfigured: boolean;
  firebaseEnabled: boolean;
  supabaseEnabled: boolean;
}
