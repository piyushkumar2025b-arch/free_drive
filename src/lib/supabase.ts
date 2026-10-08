import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { FileItem } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let client: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project')) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.warn('Could not initialize live Supabase client:', err);
  }
}

export const supabase = client;

export function isSupabaseConfigured(): boolean {
  return !!supabase;
}

// Local persistent IndexedDB / localStorage fallback for Supabase provider when env vars not yet deployed
const LOCAL_SUPABASE_KEY = 'cloudfile_supabase_storage_v1';

export function getLocalSupabaseFiles(): FileItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_SUPABASE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalSupabaseFiles(files: FileItem[]): void {
  try {
    localStorage.setItem(LOCAL_SUPABASE_KEY, JSON.stringify(files));
  } catch (e) {
    console.warn('Local Supabase storage quota reached', e);
  }
}

// Supabase CRUD handlers
export async function uploadToSupabase(
  item: Omit<FileItem, 'provider'>
): Promise<FileItem> {
  const newItem: FileItem = {
    ...item,
    provider: 'supabase',
    updatedAt: new Date(),
    createdAt: item.createdAt || new Date(),
  };

  if (supabase) {
    try {
      // Attempt to save to Supabase "files" table
      const { data, error } = await supabase
        .from('files')
        .upsert({
          id: newItem.id,
          name: newItem.name,
          is_folder: newItem.isFolder,
          parent_id: newItem.parentId,
          size: newItem.size,
          mime_type: newItem.mimeType,
          extension: newItem.extension,
          user_id: newItem.userId,
          data_url: newItem.dataUrl || null,
          text_content: newItem.textContent || null,
          is_chunked: !!newItem.isChunked,
          total_chunks: newItem.totalChunks || 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.warn('Supabase DB error, using local fallback persistence:', error.message);
      } else if (data) {
        return {
          id: data.id,
          name: data.name,
          isFolder: data.is_folder,
          parentId: data.parent_id,
          size: data.size,
          mimeType: data.mime_type,
          extension: data.extension,
          userId: data.user_id,
          dataUrl: data.data_url,
          textContent: data.text_content,
          isChunked: data.is_chunked,
          totalChunks: data.total_chunks,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
          provider: 'supabase',
          isPinned: !!data.is_pinned,
          tags: Array.isArray(data.tags) ? data.tags : [],
          isPasswordProtected: !!data.is_password_protected,
          passwordHash: data.password_hash || undefined,
          passwordHint: data.password_hint || undefined,
        };
      }
    } catch (e) {
      console.warn('Supabase connection attempt fallback:', e);
    }
  }

  // Persistent storage fallback
  const existing = getLocalSupabaseFiles();
  const filtered = existing.filter((f) => f.id !== newItem.id);
  filtered.push(newItem);
  saveLocalSupabaseFiles(filtered);
  return newItem;
}

export async function fetchSupabaseFiles(userId: string): Promise<FileItem[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', userId);

      if (!error && data && data.length > 0) {
        return data.map((d) => ({
          id: d.id,
          name: d.name,
          isFolder: d.is_folder,
          parentId: d.parent_id,
          size: Number(d.size || 0),
          mimeType: d.mime_type,
          extension: d.extension,
          userId: d.user_id,
          dataUrl: d.data_url,
          textContent: d.text_content,
          isChunked: d.is_chunked,
          totalChunks: d.total_chunks,
          createdAt: new Date(d.created_at),
          updatedAt: new Date(d.updated_at),
          provider: 'supabase',
          isPinned: !!d.is_pinned,
          tags: Array.isArray(d.tags) ? d.tags : [],
          isPasswordProtected: !!d.is_password_protected,
          passwordHash: d.password_hash || undefined,
          passwordHint: d.password_hint || undefined,
        }));
      }
    } catch (e) {
      console.warn('Supabase fetch error, using local fallback:', e);
    }
  }

  return getLocalSupabaseFiles().filter((f) => f.userId === userId);
}

export async function deleteFromSupabase(fileId: string): Promise<void> {
  if (supabase) {
    try {
      await supabase.from('files').delete().eq('id', fileId);
    } catch (e) {
      console.warn('Supabase delete error:', e);
    }
  }
  const existing = getLocalSupabaseFiles();
  saveLocalSupabaseFiles(existing.filter((f) => f.id !== fileId));
}

export async function renameInSupabase(fileId: string, newName: string): Promise<void> {
  if (supabase) {
    try {
      await supabase.from('files').update({ name: newName, updated_at: new Date().toISOString() }).eq('id', fileId);
    } catch (e) {
      console.warn('Supabase rename error:', e);
    }
  }
  const existing = getLocalSupabaseFiles();
  const updated = existing.map((f) => (f.id === fileId ? { ...f, name: newName, updatedAt: new Date() } : f));
  saveLocalSupabaseFiles(updated);
}

export async function moveInSupabase(fileId: string, newParentId: string | null): Promise<void> {
  if (supabase) {
    try {
      await supabase.from('files').update({ parent_id: newParentId, updated_at: new Date().toISOString() }).eq('id', fileId);
    } catch (e) {
      console.warn('Supabase move error:', e);
    }
  }
  const existing = getLocalSupabaseFiles();
  const updated = existing.map((f) => (f.id === fileId ? { ...f, parentId: newParentId, updatedAt: new Date() } : f));
  saveLocalSupabaseFiles(updated);
}

export async function updateContentInSupabase(fileId: string, newContent: string): Promise<void> {
  const newSize = new Blob([newContent]).size;
  if (supabase) {
    try {
      await supabase.from('files').update({ text_content: newContent, size: newSize, updated_at: new Date().toISOString() }).eq('id', fileId);
    } catch (e) {
      console.warn('Supabase update content error:', e);
    }
  }
  const existing = getLocalSupabaseFiles();
  const updated = existing.map((f) =>
    f.id === fileId ? { ...f, textContent: newContent, size: newSize, updatedAt: new Date() } : f
  );
  saveLocalSupabaseFiles(updated);
}

export async function updateMetadataInSupabase(
  fileId: string,
  partial: Partial<FileItem>
): Promise<void> {
  const existing = getLocalSupabaseFiles();
  const updated = existing.map((f) =>
    f.id === fileId ? { ...f, ...partial, updatedAt: new Date() } : f
  );
  saveLocalSupabaseFiles(updated);
}
