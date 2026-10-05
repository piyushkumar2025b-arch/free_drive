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
}

export type FileCategory =
  | 'all'
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
