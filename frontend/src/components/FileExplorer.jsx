import { useState } from 'react';
import {
  VscNewFile, VscNewFolder, VscTrash, VscChevronDown, VscChevronRight,
  VscFolder, VscFolderOpened, VscFile, VscRefresh
} from 'react-icons/vsc';
import FileIcon from './FileIcon';
import { useAppContext } from '../Context';

function FileExplorer({
  files = [],
  onFileSelect,
  activeFile,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onRefresh,
  spaceName,
  themeConfig,
  isOwner,
}) {
  const { user } = useAppContext();

  // creatingTarget: { type: 'file' | 'folder', parentPath: string } | null
  const [creatingTarget, setCreatingTarget] = useState(null);
  const [newEntityName, setNewEntityName] = useState('');
  const [isSectionOpen, setIsSectionOpen] = useState(true);
  const [collapsedFolders, setCollapsedFolders] = useState({});

  const ui = themeConfig?.ui || {
    sidebarBg: '#252526',
    sidebarFg: '#cccccc',
    sidebarHeaderFg: '#bbbbbb',
    sidebarHover: '#2a2d2e',
    sidebarActive: '#37373d',
    activeBorder: '#007acc',
    border: '#1e1e1e',
    tabActiveFg: '#ffffff',
  };

  const normPath = (p) => (p || '').replace(/^\/+|\/+$/g, '');

  const handleConfirmCreate = () => {
    if (!creatingTarget) return;
    const name = newEntityName.trim();
    if (name) {
      if (creatingTarget.type === 'file') {
        onCreateFile(name, creatingTarget.parentPath);
      } else {
        if (onCreateFolder) onCreateFolder(name, creatingTarget.parentPath);
      }
    }
    setCreatingTarget(null);
    setNewEntityName('');
  };

  const handleCancelCreate = () => {
    setCreatingTarget(null);
    setNewEntityName('');
  };

  const toggleFolder = (folderFullPath) => {
    setCollapsedFolders(prev => ({ ...prev, [folderFullPath]: !prev[folderFullPath] }));
  };

  const handleDelete = (e, item) => {
    e.stopPropagation();
    if (onDeleteFile) onDeleteFile(item);
  };

  const isFileActive = (file) => {
    if (!activeFile) return false;
    return activeFile.name === file.name && normPath(activeFile.path) === normPath(file.path);
  };

  // Helper to discover folders (explicit and implicit) whose immediate parent is currentPath
  const getFolderItems = (currentPath) => {
    const parent = normPath(currentPath);
    const folders = [];
    const seen = new Set();

    // 1. Explicit folder entries
    files.forEach((f) => {
      if (f.isFolder) {
        const fPath = normPath(f.path);
        if (fPath === parent && !seen.has(f.name)) {
          seen.add(f.name);
          folders.push({
            name: f.name,
            isFolder: true,
            path: fPath,
            fullPath: parent ? `${parent}/${f.name}` : f.name,
          });
        }
      }
    });

    // 2. Implicit folders discovered from nested paths
    files.forEach((f) => {
      const fPath = normPath(f.path);
      if (!fPath) return;

      let subPath = '';
      if (!parent) {
        subPath = fPath;
      } else if (fPath.startsWith(parent + '/')) {
        subPath = fPath.slice(parent.length + 1);
      }

      if (subPath) {
        const topDir = subPath.split('/')[0];
        if (topDir && !seen.has(topDir)) {
          seen.add(topDir);
          folders.push({
            name: topDir,
            isFolder: true,
            path: parent,
            fullPath: parent ? `${parent}/${topDir}` : topDir,
          });
        }
      }
    });

    return folders.sort((a, b) => a.name.localeCompare(b.name));
  };

  // Helper to get files whose immediate parent is currentPath
  const getFileItems = (currentPath) => {
    const parent = normPath(currentPath);
    return files
      .filter((f) => !f.isFolder && normPath(f.path) === parent)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  // Recursive tree renderer
  const renderTree = (currentPath = '', depth = 0) => {
    const parent = normPath(currentPath);
    const folderItems = getFolderItems(parent);
    const fileItems = getFileItems(parent);
    const isCreatingHere = creatingTarget && normPath(creatingTarget.parentPath) === parent;

    return (
      <div key={`tree-${parent || 'root'}`}>
        {/* Inline Creation Input for this level */}
        {isCreatingHere && (
          <div
            className="flex items-center py-1 my-0.5 mx-1 rounded-sm border shrink-0"
            style={{
              paddingLeft: `${depth * 14 + 10}px`,
              borderColor: ui.activeBorder,
              backgroundColor: `${ui.activeBorder}22`,
            }}
          >
            {creatingTarget.type === 'folder' ? (
              <VscFolder className="w-3.5 h-3.5 mr-1.5 shrink-0 text-amber-300" />
            ) : (
              <VscFile className="w-3.5 h-3.5 mr-1.5 shrink-0 opacity-70" />
            )}
            <input
              autoFocus
              type="text"
              value={newEntityName}
              onChange={(e) => setNewEntityName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCreate();
                if (e.key === 'Escape') handleCancelCreate();
              }}
              onBlur={handleConfirmCreate}
              placeholder={creatingTarget.type === 'folder' ? 'folder-name' : 'filename.ext'}
              className="bg-transparent text-xs w-full outline-none pr-2"
              style={{ color: ui.sidebarFg }}
            />
          </div>
        )}

        {/* Folders in current level */}
        {folderItems.map((folder) => {
          const isCollapsed = !!collapsedFolders[folder.fullPath];
          const hasChildren = getFolderItems(folder.fullPath).length > 0 || getFileItems(folder.fullPath).length > 0;
          const isCreatingInside = creatingTarget && normPath(creatingTarget.parentPath) === folder.fullPath;

          return (
            <div key={`folder-${folder.fullPath}`}>
              <div
                onClick={() => toggleFolder(folder.fullPath)}
                className="group flex items-center justify-between py-1 cursor-pointer transition-colors"
                style={{
                  color: ui.sidebarFg,
                  paddingLeft: `${depth * 14 + 10}px`,
                  paddingRight: '8px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = ui.sidebarHover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div className="flex items-center space-x-1.5 truncate min-w-0">
                  {isCollapsed ? (
                    <VscChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  ) : (
                    <VscChevronDown className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  )}
                  {isCollapsed ? (
                    <VscFolder className="w-4 h-4 shrink-0 text-amber-300" />
                  ) : (
                    <VscFolderOpened className="w-4 h-4 shrink-0 text-amber-300" />
                  )}
                  <span className="text-[13px] font-medium truncate">{folder.name}</span>
                </div>

                {/* Folder actions: New File in folder, New Subfolder, Delete */}
                <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCollapsedFolders((prev) => ({ ...prev, [folder.fullPath]: false }));
                      setCreatingTarget({ type: 'file', parentPath: folder.fullPath });
                    }}
                    title="New File inside folder"
                    className="p-0.5 rounded hover:opacity-80 cursor-pointer"
                    style={{ color: ui.sidebarFg }}
                  >
                    <VscNewFile className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCollapsedFolders((prev) => ({ ...prev, [folder.fullPath]: false }));
                      setCreatingTarget({ type: 'folder', parentPath: folder.fullPath });
                    }}
                    title="New Subfolder"
                    className="p-0.5 rounded hover:opacity-80 cursor-pointer"
                    style={{ color: ui.sidebarFg }}
                  >
                    <VscNewFolder className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, folder)}
                    className="p-0.5 rounded hover:text-red-400 cursor-pointer"
                    title="Delete Folder"
                  >
                    <VscTrash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Folder Contents */}
              {!isCollapsed && (
                <div>
                  {renderTree(folder.fullPath, depth + 1)}
                  {!hasChildren && !isCreatingInside && (
                    <div
                      className="text-[11px] opacity-40 italic py-0.5"
                      style={{ paddingLeft: `${(depth + 1) * 14 + 20}px` }}
                    >
                      (empty)
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Files in current level */}
        {fileItems.map((file) => {
          const isActive = isFileActive(file);
          const fileKey = file.path ? `${file.path}/${file.name}` : file.name;

          return (
            <div
              key={`file-${fileKey}`}
              onClick={() => onFileSelect(file)}
              className="group flex items-center justify-between py-1 cursor-pointer transition-colors"
              style={{
                backgroundColor: isActive ? ui.sidebarActive : 'transparent',
                color: isActive ? ui.tabActiveFg : ui.sidebarFg,
                borderLeft: isActive ? `2px solid ${ui.activeBorder}` : '2px solid transparent',
                paddingLeft: `${depth * 14 + (depth > 0 ? 18 : 12)}px`,
                paddingRight: '8px',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = ui.sidebarHover;
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title={fileKey}
            >
              <div className="flex items-center space-x-2 truncate min-w-0">
                <FileIcon fileName={file.name} />
                <span className="text-[13px] truncate">{file.name}</span>
              </div>
              <button
                onClick={(e) => handleDelete(e, file)}
                className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 rounded cursor-pointer"
                title="Delete File"
              >
                <VscTrash className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const isWorkspaceEmpty = files.length === 0 && !creatingTarget;

  return (
    <div
      className="flex flex-col h-full select-none text-[13px] border-r transition-colors duration-150"
      style={{ backgroundColor: ui.sidebarBg, color: ui.sidebarFg, borderColor: ui.border }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 text-[11px] font-bold tracking-wider uppercase shrink-0"
        style={{ color: ui.sidebarHeaderFg }}
      >
        <span>Explorer</span>
      </div>

      {/* Workspace row */}
      <div
        onClick={() => setIsSectionOpen(!isSectionOpen)}
        className="flex items-center justify-between px-2 py-1 cursor-pointer group transition-colors shrink-0"
        style={{ backgroundColor: `${ui.sidebarHover}55` }}
      >
        <div className="flex items-center space-x-1 font-semibold text-[11px] uppercase tracking-wide truncate">
          {isSectionOpen ? (
            <VscChevronDown className="w-3.5 h-3.5" />
          ) : (
            <VscChevronRight className="w-3.5 h-3.5" />
          )}
          <span className="truncate">{spaceName || 'workspace'}</span>
        </div>

        <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsSectionOpen(true);
              setCreatingTarget({ type: 'file', parentPath: '' });
            }}
            title="New File"
            className="p-1 rounded hover:opacity-80 cursor-pointer"
            style={{ color: ui.sidebarFg }}
          >
            <VscNewFile className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsSectionOpen(true);
              setCreatingTarget({ type: 'folder', parentPath: '' });
            }}
            title={isOwner ? 'New Folder' : 'New Folder (sign in required)'}
            className="p-1 rounded hover:opacity-80 cursor-pointer"
            style={{ color: ui.sidebarFg }}
          >
            <VscNewFolder className="w-3.5 h-3.5" />
          </button>
          {onRefresh && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              title="Refresh Workspace"
              className="p-1 rounded hover:opacity-80 cursor-pointer"
              style={{ color: ui.sidebarFg }}
            >
              <VscRefresh className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* File & Folder tree */}
      {isSectionOpen && (
        <div className="flex-1 overflow-y-auto py-1">
          {renderTree('', 0)}

          {isWorkspaceEmpty && (
            <div className="px-5 py-4 text-xs opacity-60 italic" style={{ color: ui.sidebarFg }}>
              No files in workspace
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FileExplorer;
