import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { VscClose, VscCopy, VscCheck, VscGlobe, VscFile, VscLinkExternal } from 'react-icons/vsc';

export function FileShareModal({ isOpen, onClose, upload, spaceName, themeConfig }) {
  const [tab, setTab] = useState('direct'); // 'direct' | 'codespace'
  const [copied, setCopied] = useState(false);

  const ui = themeConfig?.ui || {
    sidebarBg: '#252526',
    sidebarFg: '#cccccc',
    sidebarHover: '#2a2d2e',
    activeBorder: '#007acc',
    border: '#454545',
    editorBg: '#1e1e1e',
    tabActiveFg: '#ffffff',
  };

  if (!isOpen || !upload) return null;

  const origin = window.location.origin;

  // Direct download / streaming link (/s/:id)
  const directUrl = `${origin}/s/${upload._id}`;

  // Via codespace link (loads space with uploads tab & this file opened, no signup needed)
  const codespaceUrl = `${origin}/${spaceName || 'public'}?tab=uploads&fileId=${upload._id}`;

  const currentUrl = tab === 'direct' ? directUrl : codespaceUrl;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none p-4">
      <div
        className="w-[460px] max-w-full rounded-xl shadow-2xl border overflow-hidden text-[13px] animate-in fade-in zoom-in-95 duration-150"
        style={{
          backgroundColor: ui.sidebarBg,
          borderColor: ui.border,
          color: ui.sidebarFg,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ backgroundColor: ui.editorBg, borderColor: ui.border }}
        >
          <div className="flex items-center space-x-2 font-medium text-xs" style={{ color: ui.tabActiveFg }}>
            <VscFile className="w-4 h-4" style={{ color: ui.activeBorder }} />
            <span className="truncate max-w-[300px]">Share: {upload.originalName}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:opacity-80 transition-opacity cursor-pointer"
            style={{ color: ui.sidebarFg }}
            title="Close"
          >
            <VscClose className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Method Selection Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-black/30 border" style={{ borderColor: ui.border }}>
            <button
              onClick={() => { setTab('direct'); setCopied(false); }}
              className="flex items-center justify-center space-x-2 py-2 px-3 rounded-md text-xs font-medium transition-all cursor-pointer"
              style={{
                backgroundColor: tab === 'direct' ? ui.activeBorder : 'transparent',
                color: tab === 'direct' ? '#ffffff' : ui.sidebarFg,
              }}
            >
              <VscLinkExternal className="w-3.5 h-3.5" />
              <span>Direct Link</span>
            </button>
            <button
              onClick={() => { setTab('codespace'); setCopied(false); }}
              className="flex items-center justify-center space-x-2 py-2 px-3 rounded-md text-xs font-medium transition-all cursor-pointer"
              style={{
                backgroundColor: tab === 'codespace' ? ui.activeBorder : 'transparent',
                color: tab === 'codespace' ? '#ffffff' : ui.sidebarFg,
              }}
            >
              <VscGlobe className="w-3.5 h-3.5" />
              <span>Via Codespace</span>
            </button>
          </div>

          {/* Description */}
          <p className="text-xs opacity-75 leading-relaxed">
            {tab === 'direct'
              ? 'Anyone with this link can view or download the raw file directly in their browser.'
              : 'Opens the file inside the interactive Codespace with all workspace tools. No sign-up required to view.'}
          </p>

          {/* QR Code */}
          <div className="flex flex-col items-center justify-center p-3.5 bg-white rounded-lg shadow-inner mx-auto w-fit">
            <QRCodeSVG value={currentUrl} size={150} level="M" />
            <span className="text-[10px] text-gray-500 font-mono mt-2">
              Scan to open on mobile
            </span>
          </div>

          {/* Share Link & Copy Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] opacity-75">
              <span>{tab === 'direct' ? 'Direct File URL' : 'Interactive Codespace URL'}</span>
              <a
                href={currentUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:underline flex items-center space-x-1"
                style={{ color: ui.activeBorder }}
              >
                <span>Preview</span>
                <VscLinkExternal className="w-3 h-3" />
              </a>
            </div>
            <div
              className="flex items-center px-3 py-2 rounded-lg border bg-black/40 text-xs"
              style={{ borderColor: ui.border }}
            >
              <span className="flex-1 truncate font-mono text-[11px] pr-2 text-white/90">
                {currentUrl}
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer shrink-0"
                style={{
                  backgroundColor: copied ? '#166534' : ui.activeBorder,
                  color: '#ffffff',
                }}
              >
                {copied ? <VscCheck className="w-3.5 h-3.5" /> : <VscCopy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FileShareModal;
