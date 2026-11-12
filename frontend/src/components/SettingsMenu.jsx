import { useEffect, useRef, useState } from 'react';
import { VscCheck, VscColorMode, VscLock, VscUnlock, VscClose } from 'react-icons/vsc';
import { THEME_OPTIONS } from './Editor';

function SettingsMenu({
  isOpen,
  onClose,
  currentTheme,
  onThemeChange,
  isPublic,
  onTogglePrivacy,
  spaceName,
  themeConfig,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  const ui = themeConfig?.ui || {
    sidebarBg: '#252526',
    sidebarFg: '#cccccc',
    sidebarActive: '#37373d',
    sidebarHover: '#2a2d2e',
    activeBorder: '#007acc',
    border: '#454545',
  };

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredThemes = THEME_OPTIONS.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/40 backdrop-blur-xs select-none">
      {/* VS Code Command Palette / QuickPick Dropdown Box */}
      <div
        ref={menuRef}
        className="w-[520px] rounded-md shadow-2xl overflow-hidden text-[13px] border animate-in fade-in zoom-in-95 duration-100"
        style={{
          backgroundColor: ui.sidebarBg,
          borderColor: ui.border,
          color: ui.sidebarFg,
        }}
      >
        {/* Header / Input Box */}
        <div 
          className="p-2 border-b flex items-center space-x-2"
          style={{ borderColor: ui.border, backgroundColor: ui.sidebarBg }}
        >
          <div 
            className="flex-1 flex items-center px-2.5 py-1.5 rounded border"
            style={{
              borderColor: ui.activeBorder,
              backgroundColor: `${ui.sidebarHover}`,
            }}
          >
            <VscColorMode className="w-4 h-4 mr-2" style={{ color: ui.activeBorder }} />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Preferences: Color Theme (type to filter...)"
              className="bg-transparent w-full outline-none text-xs text-white placeholder-gray-400"
            />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:opacity-80 cursor-pointer"
            style={{ color: ui.sidebarFg }}
            title="Close"
          >
            <VscClose className="w-4 h-4" />
          </button>
        </div>

        {/* Action Group: Space Privacy */}
        <div className="px-2 pt-2 pb-1 border-b" style={{ borderColor: ui.border }}>
          <div className="px-2 py-1 text-[11px] uppercase tracking-wider font-semibold opacity-60">
            Workspace Security
          </div>
          <div
            onClick={() => {
              onTogglePrivacy();
              onClose();
            }}
            className="flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-colors"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = ui.sidebarHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div className="flex items-center space-x-2.5">
              {isPublic ? (
                <VscUnlock className="w-4 h-4 text-[#89d185]" />
              ) : (
                <VscLock className="w-4 h-4 text-[#f48771]" />
              )}
              <div>
                <div className="font-medium">
                  {isPublic ? 'Lock Codespace (Set Passcode)' : 'Unlock Codespace (Make Public)'}
                </div>
                <div className="text-[11px] opacity-60">
                  {isPublic ? 'Currently public to anyone with link' : 'Currently password-protected'}
                </div>
              </div>
            </div>
            <span 
              className="text-xs px-2 py-0.5 rounded text-[11px]"
              style={{
                backgroundColor: isPublic ? '#89d18522' : '#f4877122',
                color: isPublic ? '#89d185' : '#f48771',
              }}
            >
              {isPublic ? 'Public' : 'Protected'}
            </span>
          </div>
        </div>

        {/* Theme List / QuickPick Items */}
        <div className="max-h-[260px] overflow-y-auto p-1">
          <div className="px-3 py-1.5 text-[11px] uppercase tracking-wider font-semibold opacity-60">
            Color Themes
          </div>
          {filteredThemes.map((theme) => {
            const isSelected = currentTheme === theme.id;
            return (
              <div
                key={theme.id}
                onClick={() => {
                  onThemeChange(theme.id);
                  onClose();
                }}
                className="group flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-colors select-none"
                style={{
                  backgroundColor: isSelected ? ui.activeBorder : 'transparent',
                  color: isSelected ? '#ffffff' : ui.sidebarFg,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = ui.sidebarHover;
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div className="flex items-center space-x-2.5">
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                    style={{ backgroundColor: theme.ui.editorBg }}
                  />
                  <span className="font-medium text-xs">{theme.name}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[10px] opacity-70 font-mono">
                    {theme.id}
                  </span>
                  {isSelected && <VscCheck className="w-4 h-4" />}
                </div>
              </div>
            );
          })}

          {filteredThemes.length === 0 && (
            <div className="px-4 py-6 text-center text-xs opacity-50">
              No matching themes found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsMenu;
