import { useState } from 'react';
import { VscNewFile, VscTrash, VscChevronDown, VscChevronRight } from 'react-icons/vsc';
import FileIcon from './FileIcon';

function FileExplorer({ files, onFileSelect, activeFile, onCreateFile, onDeleteFile, spaceName, themeConfig }) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [isSectionOpen, setIsSectionOpen] = useState(true);

  const ui = themeConfig?.ui || {
    sidebarBg: '#252526',
    sidebarFg: '#cccccc',
    sidebarHeaderFg: '#bbbbbb',
    sidebarHover: '#2a2d2e',
    sidebarActive: '#37373d',
    activeBorder: '#007acc',
    border: '#1e1e1e',
  };

  const handleCreate = () => {
    if (newFileName.trim()) {
      onCreateFile(newFileName.trim());
      setNewFileName('');
      setIsCreating(false);
    } else {
      setIsCreating(false);
    }
  };

  const handleDelete = (e, fileName) => {
    e.stopPropagation();
    if (onDeleteFile) {
      onDeleteFile(fileName);
    }
  };

  return (
    <div 
      className="flex flex-col h-full select-none text-[13px] border-r transition-colors duration-150"
      style={{
        backgroundColor: ui.sidebarBg,
        color: ui.sidebarFg,
        borderColor: ui.border,
      }}
    >
      {/* Sidebar Section Title */}
      <div 
        className="flex items-center justify-between px-4 py-2.5 text-[11px] font-bold tracking-wider uppercase"
        style={{ color: ui.sidebarHeaderFg }}
      >
        <span>Explorer</span>
      </div>

      {/* Workspace Fold / Collapse Item */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div 
          onClick={() => setIsSectionOpen(!isSectionOpen)}
          className="flex items-center justify-between px-2 py-1 cursor-pointer group transition-colors"
          style={{
            backgroundColor: `${ui.sidebarHover}55`,
          }}
        >
          <div className="flex items-center space-x-1 font-semibold text-[11px] uppercase tracking-wide truncate">
            {isSectionOpen ? (
              <VscChevronDown className="w-3.5 h-3.5" style={{ color: ui.sidebarFg }} />
            ) : (
              <VscChevronRight className="w-3.5 h-3.5" style={{ color: ui.sidebarFg }} />
            )}
            <span className="truncate">{spaceName || 'workspace'}</span>
          </div>

          {/* Quick Action Icons */}
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsSectionOpen(true);
                setIsCreating(true);
              }}
              title="New File"
              className="p-1 rounded hover:opacity-80"
              style={{ color: ui.sidebarFg }}
            >
              <VscNewFile className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* File List */}
        {isSectionOpen && (
          <div className="flex-1 overflow-y-auto py-1">
            {/* Inline New File Input */}
            {isCreating && (
              <div 
                className="flex items-center px-4 py-1 my-0.5 mx-1 rounded-sm border"
                style={{
                  borderColor: ui.activeBorder,
                  backgroundColor: `${ui.activeBorder}22`,
                }}
              >
                <input
                  type="text"
                  autoFocus
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') {
                      setIsCreating(false);
                      setNewFileName('');
                    }
                  }}
                  onBlur={handleCreate}
                  placeholder="filename.ext"
                  className="bg-transparent text-xs w-full outline-none"
                  style={{ color: ui.sidebarFg }}
                />
              </div>
            )}

            {files.map((file) => {
              const isActive = activeFile?.name === file.name;
              return (
                <div
                  key={file.name}
                  onClick={() => onFileSelect(file)}
                  className="group flex items-center justify-between px-4 py-1 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: isActive ? ui.sidebarActive : 'transparent',
                    color: isActive ? ui.tabActiveFg : ui.sidebarFg,
                    borderLeft: isActive ? `2px solid ${ui.activeBorder}` : '2px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = ui.sidebarHover;
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div className="flex items-center space-x-2 truncate min-w-0">
                    <FileIcon fileName={file.name} />
                    <span className="text-[13px] truncate">{file.name}</span>
                  </div>

                  <button
                    onClick={(e) => handleDelete(e, file.name)}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 rounded transition-opacity"
                    title="Delete File"
                  >
                    <VscTrash className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            {files.length === 0 && !isCreating && (
              <div className="px-5 py-4 text-xs opacity-60 italic" style={{ color: ui.sidebarFg }}>
                No files in workspace
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default FileExplorer;
