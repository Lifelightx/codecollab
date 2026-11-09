import { useState, useEffect, useRef } from 'react';
import { VscClose, VscLock, VscKey, VscEye, VscEyeClosed } from 'react-icons/vsc';

function PasscodeModal({ onSetPasscode, onCancel, themeConfig }) {
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const ui = themeConfig?.ui || {
    sidebarBg: '#252526',
    sidebarFg: '#cccccc',
    sidebarHover: '#2a2d2e',
    activeBorder: '#007acc',
    border: '#454545',
    editorBg: '#1e1e1e',
    tabActiveFg: '#ffffff',
  };

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleSave = () => {
    const trimmed = passcode.trim();
    if (trimmed.length < 4) {
      setError('Passcode must be at least 4 characters long.');
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(trimmed)) {
      setError('Only letters and numbers are permitted.');
      return;
    }
    onSetPasscode(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
      <div 
        className="w-[420px] rounded-md shadow-2xl overflow-hidden text-[13px] border animate-in fade-in zoom-in-95 duration-100"
        style={{
          backgroundColor: ui.sidebarBg,
          borderColor: ui.border,
          color: ui.sidebarFg,
        }}
      >
        {/* Modal Title Bar */}
        <div 
          className="flex items-center justify-between px-4 py-2.5 border-b"
          style={{
            backgroundColor: ui.editorBg,
            borderColor: ui.border,
          }}
        >
          <div className="flex items-center space-x-2 font-medium text-xs" style={{ color: ui.tabActiveFg }}>
            <VscLock className="w-4 h-4" style={{ color: ui.activeBorder }} />
            <span>Set Codespace Passcode</span>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded transition-colors cursor-pointer hover:opacity-80"
            style={{ color: ui.sidebarFg }}
            title="Close (Esc)"
          >
            <VscClose className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5">
          <p className="text-xs leading-relaxed mb-4 opacity-80 font-sans">
            Protect this workspace from unauthorized collaborators. Anyone opening the link will be required to authenticate.
          </p>

          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 opacity-90 font-sans">
            Passcode
          </label>
          <div className="relative flex items-center">
            <VscKey className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-60 pointer-events-none" />
            <input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              placeholder="Minimum 4 characters (e.g. dev2026)"
              maxLength={24}
              className="w-full rounded-sm pl-8 pr-9 py-1.5 text-xs outline-none font-sans transition-colors border"
              style={{
                backgroundColor: ui.editorBg,
                borderColor: error ? '#f48771' : ui.border,
                color: ui.tabActiveFg,
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
              style={{ color: ui.sidebarFg }}
              title={showPassword ? 'Hide passcode' : 'Show passcode'}
            >
              {showPassword ? <VscEyeClosed className="w-4 h-4" /> : <VscEye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <div className="flex items-center space-x-1.5 text-[#f48771] text-xs mt-2 font-sans">
              <span>●</span>
              <span>{error}</span>
            </div>
          )}

          <div className="text-[11px] opacity-60 mt-2 font-sans">
            Allowed: A-Z, a-z, 0-9
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div 
          className="flex items-center justify-end space-x-2 px-5 py-3 border-t font-sans"
          style={{
            backgroundColor: `${ui.editorBg}`,
            borderColor: ui.border,
          }}
        >
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-sm text-xs transition-colors cursor-pointer hover:opacity-80"
            style={{
              backgroundColor: ui.sidebarHover,
              color: ui.sidebarFg,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3.5 py-1.5 rounded-sm text-xs font-medium transition-colors cursor-pointer hover:opacity-90 shadow-xs"
            style={{
              backgroundColor: ui.activeBorder,
              color: '#ffffff',
            }}
          >
            Set Passcode
          </button>
        </div>
      </div>
    </div>
  );
}

export default PasscodeModal;
