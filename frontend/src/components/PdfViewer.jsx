import React, { useState } from 'react';
import { 
  VscFilePdf, 
  VscCloudDownload, 
  VscLinkExternal, 
  VscScreenFull 
} from 'react-icons/vsc';
import { useAppContext } from '../Context';

function fmtBytes(b) {
  if (!b) return '';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function PdfViewer({ file, themeConfig }) {
  const { SOCKET_URL } = useAppContext();
  const [zoomMode, setZoomMode] = useState('FitH'); // 'FitH' | 'Fit' | 'FitV'

  const ui = themeConfig?.ui || {
    editorBg: '#1e1e1e',
    sidebarBg: '#252526',
    sidebarFg: '#cccccc',
    border: '#333333',
    activeBorder: '#007acc',
  };

  const backendOrigin = SOCKET_URL && SOCKET_URL !== '/' ? SOCKET_URL : '';
  const fileUrl = `${backendOrigin}/s/${file._id}`;
  // Add PDF parameters for clean edge-to-edge viewing
  const pdfFrameUrl = `${fileUrl}#view=${zoomMode}&toolbar=1&navpanes=1`;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = file.originalName || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenNewTab = () => {
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div 
      className="flex flex-col w-full h-full overflow-hidden select-none"
      style={{ backgroundColor: ui.editorBg, color: ui.sidebarFg }}
    >
      {/* Top Workspace Toolbar (VS Code Theme) */}
      <div 
        className="flex items-center justify-between px-3 py-1.5 border-b text-xs shrink-0 select-none z-10"
        style={{ borderColor: ui.border, backgroundColor: ui.sidebarBg }}
      >
        {/* Left: Document Info */}
        <div className="flex items-center space-x-2 truncate">
          <VscFilePdf className="w-4 h-4 text-red-400 shrink-0" />
          <span className="font-semibold text-white truncate max-w-[280px] sm:max-w-[450px]">
            {file.originalName}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-mono shrink-0">
            PDF
          </span>
          {file.size && (
            <span className="text-[11px] opacity-40 shrink-0 hidden sm:inline">
              ({fmtBytes(file.size)})
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <button
            onClick={() => setZoomMode(prev => prev === 'FitH' ? 'Fit' : 'FitH')}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] transition-colors cursor-pointer"
            title="Toggle Fit Width / Fit Page"
          >
            <VscScreenFull className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{zoomMode === 'FitH' ? 'Fit Page' : 'Fit Width'}</span>
          </button>

          <button
            onClick={handleOpenNewTab}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] transition-colors cursor-pointer"
            title="Open PDF in New Browser Tab"
          >
            <VscLinkExternal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Tab</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] transition-colors cursor-pointer"
            title="Download PDF"
          >
            <VscCloudDownload className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Edge-to-Edge Embedded PDF Engine (100% Workspace Fit) */}
      <div className="flex-1 w-full h-full relative overflow-hidden bg-[#2a2a2e]">
        <iframe
          key={`${file._id}-${zoomMode}`}
          src={pdfFrameUrl}
          title={file.originalName}
          className="w-full h-full border-0 absolute inset-0"
        />
      </div>
    </div>
  );
}
