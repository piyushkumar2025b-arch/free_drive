import React from 'react';
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  ChevronRight,
  ArrowUpDown,
  HardDrive,
  LogIn,
  LogOut,
  Folder,
  Maximize2,
  Minimize,
  PanelLeftClose,
  PanelLeftOpen,
  Info,
  X,
  RefreshCw,
  Database,
} from 'lucide-react';
import { BreadcrumbItem, ProviderConfig, SortField, SortOrder, ViewMode } from '../types';
import { User } from 'firebase/auth';

interface HeaderProps {
  breadcrumbs: BreadcrumbItem[];
  onNavigateBreadcrumb: (folderId: string | null) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;
  currentUser: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  isOnline: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  isDetailsOpen: boolean;
  onToggleDetails: () => void;
  selectedFileCount: number;
  providerConfig: ProviderConfig;
  onOpenProviders: () => void;
  onSyncNow: () => void;
  isSyncing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  breadcrumbs,
  onNavigateBreadcrumb,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortField,
  sortOrder,
  onSortChange,
  currentUser,
  onSignIn,
  onSignOut,
  isFullscreen,
  onToggleFullscreen,
  isSidebarCollapsed,
  onToggleSidebar,
  isDetailsOpen,
  onToggleDetails,
  selectedFileCount,
  providerConfig,
  onOpenProviders,
  onSyncNow,
  isSyncing,
}) => {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-30 select-none">
      {/* Primary Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 gap-6">
        {/* Left Section: Sidebar Toggle + Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
            title={isSidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center shadow-xs">
              <HardDrive size={16} />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 block">
                CloudFile
              </span>
            </div>
          </div>
        </div>

        {/* Center: Search Field */}
        <div className="flex-1 max-w-xl mx-auto">
          <div className="relative flex items-center">
            <Search
              size={15}
              className="absolute left-3.5 text-zinc-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search files by name, extension or content... (Press /)"
              className="w-full pl-10 pr-9 py-2 text-xs bg-zinc-100/80 dark:bg-zinc-800/60 border border-transparent focus:border-zinc-300 dark:focus:border-zinc-600 focus:bg-white dark:focus:bg-zinc-900 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none transition shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-3 p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Right Utility Group */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Fullscreen Mode Button */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              isFullscreen
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
            title={isFullscreen ? 'Exit Full Screen Mode' : 'Enter Full Screen Mode'}
          >
            {isFullscreen ? <Minimize size={15} /> : <Maximize2 size={15} />}
            <span className="hidden sm:inline">
              {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            </span>
          </button>

          {/* Details / Inspector Toggle */}
          <button
            type="button"
            onClick={onToggleDetails}
            className={`p-1.5 rounded-lg transition relative ${
              isDetailsOpen
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title="Toggle File Details Inspector"
          >
            <Info size={17} />
            {selectedFileCount > 0 && !isDetailsOpen && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </button>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

          {/* User Sign In / Profile */}
          {currentUser && !currentUser.isAnonymous ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt=""
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-[10px] font-bold">
                    {currentUser.email ? currentUser.email[0].toUpperCase() : 'U'}
                  </div>
                )}
                <span className="max-w-[130px] truncate text-zinc-700 dark:text-zinc-300 text-xs font-medium">
                  {currentUser.displayName || currentUser.email}
                </span>
                <button
                  type="button"
                  onClick={onSignOut}
                  title="Sign Out"
                  className="p-1 hover:text-rose-500 text-zinc-400 rounded-full transition ml-0.5"
                >
                  <LogOut size={13} />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs"
            >
              <LogIn size={13} />
              <span>Sign In with Google</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Header: Breadcrumbs + View & Sort Controls */}
      <div className="flex items-center justify-between px-6 py-2 bg-zinc-50/70 dark:bg-zinc-900/60 border-t border-zinc-100 dark:border-zinc-800 text-xs">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 overflow-x-auto py-0.5 text-zinc-600 dark:text-zinc-400">
          {breadcrumbs.map((item, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={item.id ?? 'root'}>
                {idx > 0 && <ChevronRight size={13} className="text-zinc-300 dark:text-zinc-600 shrink-0" />}
                <button
                  type="button"
                  onClick={() => onNavigateBreadcrumb(item.id)}
                  className={`flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition truncate max-w-[180px] ${
                    isLast
                      ? 'font-semibold text-zinc-900 dark:text-zinc-100'
                      : 'hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {idx === 0 && <Folder size={14} className="text-amber-500 shrink-0" />}
                  <span className="truncate">{item.name}</span>
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* View Mode & Sort Segmented Controls */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
            <ArrowUpDown size={13} />
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [f, o] = e.target.value.split('-') as [SortField, SortOrder];
                onSortChange(f, o);
              }}
              className="bg-transparent text-xs text-zinc-700 dark:text-zinc-300 font-medium outline-none cursor-pointer hover:text-zinc-900 dark:hover:text-white transition"
            >
              <option value="name-asc" className="dark:bg-zinc-800">Name (A-Z)</option>
              <option value="name-desc" className="dark:bg-zinc-800">Name (Z-A)</option>
              <option value="updatedAt-desc" className="dark:bg-zinc-800">Date (Newest)</option>
              <option value="updatedAt-asc" className="dark:bg-zinc-800">Date (Oldest)</option>
              <option value="size-desc" className="dark:bg-zinc-800">Size (Largest)</option>
              <option value="size-asc" className="dark:bg-zinc-800">Size (Smallest)</option>
            </select>
          </div>

          <div className="h-3.5 w-px bg-zinc-200 dark:bg-zinc-800" />

          {/* Segmented View Mode Toggle */}
          <div className="flex items-center bg-zinc-200/70 dark:bg-zinc-800 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded-md transition ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
              title="Grid View"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              className={`p-1.5 rounded-md transition ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
              title="List View"
            >
              <ListIcon size={14} />
            </button>
          </div>

          <div className="h-3.5 w-px bg-zinc-200 dark:bg-zinc-800" />

          {/* Clean Sync Action */}
          <button
            type="button"
            onClick={onSyncNow}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-2 py-1 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 rounded-lg transition disabled:opacity-50"
            title="Synchronize Files with Cloud Databases"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin text-blue-500' : ''} />
            <span className="hidden sm:inline font-medium">Sync</span>
          </button>
        </div>
      </div>
    </header>
  );
};
