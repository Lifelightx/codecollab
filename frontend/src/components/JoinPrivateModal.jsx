import { useState, useEffect, useRef } from 'react';
import { VscLock, VscKey, VscClose, VscEye, VscEyeClosed } from 'react-icons/vsc';

function JoinPrivateModal({ spaceName, onVerify, onCancel, error, isLoading, themeConfig }) {
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
  }, []);

  const handleVerifyClick = () => {
    if (passcode.trim()) {
      onVerify(passcode.trim());
    }
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
            <span>Workspace Authentication</span>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-1 rounded transition-colors cursor-pointer hover:opacity-80"
              style={{ color: ui.sidebarFg }}
              title="Close"
            >
              <VscClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal Content */}
        <div className="p-5">
          <p className="text-xs leading-relaxed mb-4 opacity-80 font-sans">
            Codespace <span className="font-sans font-semibold px-1.5 py-0.5 rounded border" style={{ backgroundColor: ui.editorBg, borderColor: ui.border, color: ui.tabActiveFg }}>{spaceName}</span> is protected with a passcode.
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
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleVerifyClick();
              }}
              placeholder="Enter passcode"
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
        </div>

        {/* Modal Footer Actions */}
        <div 
          className="flex items-center justify-end space-x-2 px-5 py-3 border-t font-sans"
          style={{
            backgroundColor: `${ui.editorBg}`,
            borderColor: ui.border,
          }}
        >
          {onCancel && (
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
          )}
          <button
            onClick={handleVerifyClick}
            disabled={isLoading || !passcode.trim()}
            className="px-4 py-1.5 rounded-sm text-xs font-medium transition-colors cursor-pointer hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
            style={{
              backgroundColor: ui.activeBorder,
              color: '#ffffff',
            }}
          >
            {isLoading ? 'Verifying...' : 'Unlock Codespace'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default JoinPrivateModal;
