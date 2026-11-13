import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  VscChevronDown, VscChevronRight, VscTrash, VscCloudUpload, VscFile,
  VscShare, VscCopy, VscCheck, VscLoading
} from 'react-icons/vsc';
import { useAppContext } from '../Context';
import FileShareModal from './FileShareModal';
import SpreadsheetEditor from './SpreadsheetEditor';
import DocumentEditor from './DocumentEditor';
import PdfViewer from './PdfViewer';

// ── Helpers ─────────────────────────────────────────────────────
function getFileType(mimeOrName) {
  const s = mimeOrName.toLowerCase();
  if (s.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/.test(s)) return 'image';
  if (s.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/.test(s)) return 'video';
  if (s.startsWith('audio/') || /\.(mp3|wav|ogg|flac)$/.test(s)) return 'audio';
  if (s === 'application/pdf' || s.endsWith('.pdf')) return 'pdf';
  if (/\.(xlsx|xls|csv)$/.test(s) || s.includes('spreadsheetml') || s.includes('ms-excel')) return 'spreadsheet';
  if (/\.(docx|doc)$/.test(s) || s.includes('wordprocessingml') || s.includes('msword')) return 'document';
  if (/\.(txt|md|json|xml|log)$/.test(s)) return 'text';
  return 'other';
}

function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── UPLOAD PANEL (sidebar list) ─────────────────────────────────
export function UploadPanel({ selectedUpload, onSelect, themeConfig, spaceName, defaultFileId }) {
  const { API_URL, updateUserStorage, user, openAuthModal } = useAppContext();
  const uploadRef = useRef(null);
  const [copied, setCopied]         = useState(false);
  const [uploads, setUploads]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [error, setError]           = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const ui = themeConfig?.ui || {
    sidebarBg: '#252526', sidebarFg: '#cccccc', sidebarHeaderFg: '#bbbbbb',
    sidebarHover: '#2a2d2e', sidebarActive: '#37373d', activeBorder: '#007acc',
    border: '#1e1e1e',
  };

  // ── Fetch uploads for this codespace ──
  const fetchUploads = useCallback(async () => {
    if (!spaceName) return;
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/uploads`, { params: { spaceName } });
      setUploads(res.data.uploads || []);
      if (typeof res.data.storageUsedBytes === 'number') {
        updateUserStorage(res.data.storageUsedBytes);
      }
    } catch (e) {
      setError('Failed to load uploads.');
    } finally {
      setLoading(false);
    }
  }, [API_URL, spaceName]);

  useEffect(() => { fetchUploads(); }, [fetchUploads]);

  // Auto-select file from deep-link URL param
  useEffect(() => {
    if (defaultFileId && uploads.length > 0 && !selectedUpload) {
      const match = uploads.find(u => u._id === defaultFileId);
      if (match) onSelect(match);
    }
  }, [defaultFileId, uploads, selectedUpload, onSelect]);

  // ── Upload files to this codespace (signed-in users only) ──
  const handleInputChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';

    if (!user) {
      setError('You must be signed in to upload files.');
      return;
    }

    setUploading(true);
    setError('');
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    formData.append('spaceName', spaceName);

    try {
      const res = await axios.post(`${API_URL}/uploads`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (typeof res.data?.storageUsedBytes === 'number') {
        updateUserStorage(res.data.storageUsedBytes);
      }
      await fetchUploads();
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  // ── Delete a file (only uploader can delete) ──
  const handleDelete = async (e, upload) => {
    e.stopPropagation();
    try {
      const res = await axios.delete(`${API_URL}/uploads/${upload._id}`);
      if (typeof res.data?.storageUsedBytes === 'number') {
        updateUserStorage(res.data.storageUsedBytes);
      }
      setUploads(prev => prev.filter(u => u._id !== upload._id));
      if (selectedUpload?._id === upload._id) onSelect(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete.');
    }
  };

  // In dev, if SOCKET_URL or API_URL points to localhost:5000, call backend directly
  const backendBase = import.meta.env.VITE_SOCKET_URL || '';
  const shareUrl = selectedUpload
    ? `${backendBase ? backendBase : window.location.origin}/s/${selectedUpload._id}`
    : null;

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="flex flex-col h-full text-[13px] select-none border-r"
      style={{ backgroundColor: ui.sidebarBg, color: ui.sidebarFg, borderColor: ui.border }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 text-[11px] font-bold tracking-wider uppercase shrink-0"
        style={{ color: ui.sidebarHeaderFg }}
      >
        <span>Uploads</span>
        <button
          onClick={() => {
            if (!user) {
              openAuthModal('login');
            } else {
              uploadRef.current?.click();
            }
          }}
          title={user ? 'Upload Files' : 'Sign in to upload'}
          disabled={uploading}
          className="p-1 rounded hover:opacity-80 cursor-pointer disabled:opacity-40 transition-opacity"
          style={{ color: ui.sidebarFg }}
        >
          {uploading
            ? <VscLoading className="w-4 h-4 animate-spin" />
            : <VscCloudUpload className="w-4 h-4" />
          }
        </button>
        <input ref={uploadRef} type="file" multiple className="hidden" onChange={handleInputChange} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-2 mb-1 px-2 py-1 rounded text-[11px] text-red-400 bg-red-500/10">
          {error}
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 opacity-40">
            <VscLoading className="w-5 h-5 animate-spin" />
          </div>
        ) : uploads.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-3 py-12 opacity-60 transition-opacity cursor-pointer hover:opacity-90"
            onClick={() => {
              if (user) {
                uploadRef.current?.click();
              } else {
                openAuthModal('login');
              }
            }}
          >
            <VscCloudUpload className="w-8 h-8 opacity-60" />
            <span className="text-xs text-center px-4 leading-relaxed">
              {user ? (
                <>Click to upload files<br /><span className="text-[10px] opacity-70">Images, video, audio, PDF…</span></>
              ) : (
                <>No files uploaded yet<br /><span className="text-[11px] text-blue-400 font-medium hover:underline">Sign in to upload</span></>
              )}
            </span>
          </div>
        ) : (
          uploads.map((upload) => {
            const isSelected = selectedUpload?._id === upload._id;
            return (
              <div
                key={upload._id}
                onClick={() => onSelect(upload)}
                className="group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors"
                style={{
                  backgroundColor: isSelected ? ui.sidebarActive : 'transparent',
                  borderLeft: isSelected ? `2px solid ${ui.activeBorder}` : '2px solid transparent',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = ui.sidebarHover; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <VscFile className="w-3.5 h-3.5 opacity-60 shrink-0" />
                <span className="text-[12px] truncate flex-1" style={{ color: ui.sidebarFg }}>
                  {upload.originalName}
                </span>
                <span className="text-[10px] opacity-40 shrink-0">{fmtBytes(upload.size)}</span>
                {user && user.id === upload.ownerId?.toString() && (
                <button
                  onClick={e => handleDelete(e, upload)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 shrink-0 transition-opacity"
                  title="Delete"
                >
                  <VscTrash className="w-3 h-3" />
                </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Share bar – only when file selected */}
      {selectedUpload && (
        <div
          className="shrink-0 px-3 py-2 border-t text-[11px]"
          style={{ borderColor: ui.border }}
        >
          <button
            onClick={() => setShareModalOpen(true)}
            className="flex items-center gap-1.5 mb-1.5 hover:opacity-100 opacity-80 cursor-pointer transition-opacity"
            title="Open Share Options"
          >
            <VscShare className="w-3.5 h-3.5" style={{ color: ui.activeBorder }} />
            <span className="uppercase tracking-wide text-[10px] font-semibold" style={{ color: ui.activeBorder }}>
              Share Options & QR
            </span>
          </button>

          <div
            onClick={() => setShareModalOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded cursor-pointer transition-colors"
            style={{ backgroundColor: `${ui.activeBorder}18`, border: `1px solid ${ui.activeBorder}44` }}
            title="Click to view full share modal & QR"
          >
            <span className="flex-1 truncate opacity-70 text-[10px]">/s/{selectedUpload._id}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className="shrink-0 cursor-pointer hover:opacity-80 p-0.5"
              title="Copy Direct URL"
            >
              {copied
                ? <VscCheck className="w-3.5 h-3.5 text-green-400" />
                : <VscCopy className="w-3.5 h-3.5" />
              }
            </button>
          </div>
        </div>
      )}

      {/* Share File Modal */}
      {shareModalOpen && selectedUpload && (
        <FileShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          upload={selectedUpload}
          spaceName={spaceName}
          themeConfig={themeConfig}
        />
      )}

      {/* Storage Quota Footer (for signed-in users) */}
      {user && (
        <div 
          className="shrink-0 px-3 py-2 border-t text-[11px] select-none"
          style={{ borderColor: ui.border, backgroundColor: ui.sidebarBg }}
        >
          <div className="flex items-center justify-between text-[10px] opacity-70 mb-1">
            <span>Storage Usage</span>
            <span>{fmtBytes(user.storageUsedBytes || 0)} / 200 MB</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.max(1, Math.min(100, ((user.storageUsedBytes || 0) / (200 * 1024 * 1024)) * 100))}%`,
                backgroundColor: ((user.storageUsedBytes || 0) / (200 * 1024 * 1024)) > 0.9 
                  ? '#ef4444' 
                  : ((user.storageUsedBytes || 0) / (200 * 1024 * 1024)) > 0.7 
                    ? '#eab308' 
                    : '#3b82f6'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── UPLOAD PREVIEW (main window) ────────────────────────────────
export function UploadPreview({ file, themeConfig }) {
  const { API_URL, SOCKET_URL } = useAppContext();
  const ui   = themeConfig?.ui || { editorBg: '#1e1e1e', sidebarFg: '#cccccc' };
  const type = getFileType(file.mimeType || file.originalName);

  // Directly embed full workspace editors for Spreadsheet and Word docs
  if (type === 'spreadsheet') {
    return <SpreadsheetEditor file={file} themeConfig={themeConfig} />;
  }

  if (type === 'document') {
    return <DocumentEditor file={file} themeConfig={themeConfig} />;
  }

  if (type === 'pdf') {
    return <PdfViewer file={file} themeConfig={themeConfig} />;
  }
  
  // In dev, prefix with backend origin if configured (e.g. http://localhost:5000), otherwise relative /s/:id
  const backendOrigin = SOCKET_URL && SOCKET_URL !== '/' ? SOCKET_URL : '';
  const src  = `${backendOrigin}/s/${file._id}`;

  return (
    <div
      className="flex flex-col flex-1 items-center justify-center h-full overflow-auto p-6 gap-4"
      style={{ backgroundColor: ui.editorBg, color: ui.sidebarFg }}
    >
      <span className="text-xs opacity-50 uppercase tracking-wider">{file.originalName}</span>

      {type === 'image' && (
        <img src={src} alt={file.originalName} className="max-w-full max-h-[70vh] object-contain rounded shadow-lg" />
      )}
      {type === 'video' && (
        <video src={src} controls className="max-w-full max-h-[70vh] rounded shadow-lg" />
      )}
      {type === 'audio' && (
        <div className="flex flex-col items-center gap-4">
          <VscFile className="w-16 h-16 opacity-30" />
          <audio src={src} controls className="w-72" />
        </div>
      )}
      {type === 'pdf' && (
        <iframe src={src} title={file.originalName} className="w-full h-[75vh] rounded shadow-lg border-0" />
      )}
      {type === 'text' && (
        <iframe src={src} title={file.originalName} className="w-full h-[70vh] rounded shadow-lg border-0 bg-white" />
      )}
      {type === 'other' && (
        <div className="flex flex-col items-center gap-3 opacity-50">
          <VscFile className="w-16 h-16" />
          <span className="text-sm">No preview available for this file type.</span>
          <a href={src} download={file.originalName} className="text-xs underline opacity-80">
            Download {file.originalName}
          </a>
        </div>
      )}

      <span className="text-[11px] opacity-40">{fmtBytes(file.size)}</span>
    </div>
  );
}
