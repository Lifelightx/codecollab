import { FiX, FiLock, FiUnlock } from 'react-icons/fi';
import { VscGlobe } from 'react-icons/vsc';
import FileIcon from './FileIcon';

function TabBar({ 
    openFiles, 
    activeFile, 
    onTabClick, 
    onTabClose, 
    isPublic, 
    onTogglePrivacy,
    onOpenShare,
    themeConfig
}) {
  const ui = themeConfig?.ui || {
    tabBarBg: '#252526',
    tabInactiveBg: '#2d2d2d',
    tabActiveBg: '#1e1e1e',
    tabActiveFg: '#ffffff',
    tabInactiveFg: '#969696',
    activeBorder: '#007acc',
    border: '#1e1e1e',
  };

  return (
    <div 
      className="flex items-center justify-between h-[35px] text-[13px] select-none border-b transition-colors duration-150"
      style={{
        backgroundColor: ui.tabBarBg,
        borderColor: ui.border,
      }}
    >
      {/* Open File Tabs */}
      <div className="flex h-full overflow-x-auto scrollbar-none">
        {openFiles.map((file) => {
          const isActive = activeFile?.name === file.name;
          return (
            <div
              key={file.name}
              onClick={() => onTabClick(file)}
              className="group flex items-center h-full px-3 space-x-2 border-r cursor-pointer transition-colors relative"
              style={{
                backgroundColor: isActive ? ui.tabActiveBg : ui.tabInactiveBg,
                color: isActive ? ui.tabActiveFg : ui.tabInactiveFg,
                borderColor: ui.border,
                borderTop: isActive ? `2px solid ${ui.activeBorder}` : '2px solid transparent',
              }}
            >
              <FileIcon fileName={file.name} />
              <span className="truncate max-w-[140px] text-[12px]">{file.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(file.name);
                }}
                className={`p-0.5 rounded cursor-pointer opacity-0 group-hover:opacity-100 hover:opacity-80 transition-opacity ${
                  isActive ? '!opacity-100' : ''
                }`}
                title="Close"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Action Controls on the right */}
      <div className="flex items-center space-x-2 px-3">
        {/* Share Button (QR & Link) */}
        <button
          onClick={onOpenShare}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs transition-colors hover:opacity-80 cursor-pointer"
          style={{
            backgroundColor: `${ui.activeBorder}22`,
            color: ui.activeBorder,
          }}
          title="Share with QR Code or Link"
        >
          <VscGlobe className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium hidden sm:inline">Share</span>
        </button>

        {/* Privacy Lock Toggle */}
        <button
          onClick={onTogglePrivacy}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs transition-colors hover:opacity-80 cursor-pointer"
          style={{
            color: isPublic ? '#89d185' : '#f48771',
            backgroundColor: `${isPublic ? '#89d185' : '#f48771'}18`,
          }}
          title={isPublic ? 'Public Space (Click to Lock)' : 'Private Space (Click to Unlock)'}
        >
          {isPublic ? (
            <>
              <FiUnlock className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium hidden sm:inline">Public</span>
            </>
          ) : (
            <>
              <FiLock className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium hidden sm:inline">Private</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default TabBar;
