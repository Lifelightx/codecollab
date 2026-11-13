import React, { useState, useEffect, useRef } from 'react';
import { renderAsync } from 'docx-preview';
import mammoth from 'mammoth';
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx';
import axios from 'axios';
import { 
  VscSave, 
  VscCloudDownload, 
  VscLoading, 
  VscCheck, 
  VscFileCode,
  VscEdit,
  VscEye
} from 'react-icons/vsc';
import { useAppContext } from '../Context';

export default function DocumentEditor({ file, themeConfig }) {
  const { API_URL, SOCKET_URL } = useAppContext();
  const previewRef = useRef(null);
  const editorRef = useRef(null);

  const [mode, setMode] = useState('view'); // 'view' (docx-preview high-fidelity) | 'edit' (rich editor)
  const [arrayBufferData, setArrayBufferData] = useState(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  const backendOrigin = SOCKET_URL && SOCKET_URL !== '/' ? SOCKET_URL : '';
  const fileUrl = `${backendOrigin}/s/${file._id}`;

  const ui = themeConfig?.ui || {
    editorBg: '#1e1e1e',
    sidebarBg: '#252526',
    sidebarFg: '#cccccc',
    border: '#333333',
    activeBorder: '#007acc',
  };

  // ── Fetch .docx file on mount ──
  useEffect(() => {
    let isMounted = true;
    const loadDocx = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const buffer = res.data;
        if (!isMounted) return;

        setArrayBufferData(buffer);

        // Also prepare HTML for edit mode via mammoth
        try {
          const mammothResult = await mammoth.convertToHtml({ arrayBuffer: buffer });
          if (isMounted) {
            setHtmlContent(mammothResult.value || '<p>Document loaded.</p>');
          }
        } catch {
          if (isMounted) setHtmlContent('<p>Document ready for editing.</p>');
        }
      } catch (err) {
        console.error('Failed to load Word document:', err);
        if (isMounted) setError('Could not load Word document.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDocx();
    return () => { isMounted = false; };
  }, [file._id]);

  // ── Render High-Fidelity DOCX Preview when in 'view' mode ──
  useEffect(() => {
    if (mode === 'view' && arrayBufferData && previewRef.current && !loading) {
      previewRef.current.innerHTML = '';
      renderAsync(arrayBufferData, previewRef.current, null, {
        className: 'docx-preview-content',
        inWrapper: false,
        ignoreWidth: false,
        ignoreHeight: false,
        breakPages: true,
        useBase64URL: true,
      }).catch(err => {
        console.warn('docx-preview fallback:', err);
        if (previewRef.current) {
          previewRef.current.innerHTML = htmlContent || '<p class="p-6 text-gray-700">Preview not available.</p>';
        }
      });
    }
  }, [mode, arrayBufferData, loading]);

  // ── Sync HTML to Editor Ref when switching to 'edit' mode ──
  useEffect(() => {
    if (mode === 'edit' && editorRef.current) {
      if (!editorRef.current.innerHTML && htmlContent) {
        editorRef.current.innerHTML = htmlContent;
      }
    }
  }, [mode, htmlContent]);

  // ── Formatting Commands ──
  const format = (command, value = null) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      setHtmlContent(editorRef.current.innerHTML);
    }
  };

  // ── Build .docx Blob from Edit Mode ──
  const buildDocxBlob = async () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = editorRef.current ? editorRef.current.innerHTML : htmlContent;

    const docChildren = [];
    const childNodes = Array.from(tempDiv.childNodes);

    if (childNodes.length === 0) {
      docChildren.push(new Paragraph({ text: '' }));
    } else {
      childNodes.forEach(node => {
        const text = node.textContent || '';
        const tag = (node.tagName || '').toLowerCase();

        if (tag === 'h1') {
          docChildren.push(new Paragraph({
            text,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200, before: 200 },
          }));
        } else if (tag === 'h2') {
          docChildren.push(new Paragraph({
            text,
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 160, before: 160 },
          }));
        } else if (tag === 'ul' || tag === 'ol') {
          Array.from(node.querySelectorAll('li')).forEach(li => {
            docChildren.push(new Paragraph({
              text: li.textContent || '',
              bullet: { level: 0 },
              spacing: { after: 80 },
            }));
          });
        } else {
          docChildren.push(new Paragraph({
            children: [new TextRun(text)],
            spacing: { after: 120, line: 320 },
          }));
        }
      });
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: docChildren,
      }],
    });

    return await Packer.toBlob(doc);
  };

  // ── Save to Backend ──
  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      let blobToSave;
      if (mode === 'edit') {
        blobToSave = await buildDocxBlob();
      } else if (arrayBufferData) {
        blobToSave = new Blob([arrayBufferData], { 
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        });
      }

      if (!blobToSave) return;

      const formData = new FormData();
      formData.append('file', blobToSave, file.originalName || 'document.docx');

      await axios.put(`${API_URL}/uploads/${file._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save docx:', err);
      setError(err.response?.data?.message || 'Failed to save document.');
    } finally {
      setSaving(false);
    }
  };

  // ── Download .docx ──
  const handleDownload = async () => {
    try {
      let blob;
      if (mode === 'edit') {
        blob = await buildDocxBlob();
      } else if (arrayBufferData) {
        blob = new Blob([arrayBufferData], { 
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        });
      }
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalName || 'document.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  return (
    <div 
      className="flex flex-col w-full h-full overflow-hidden select-none"
      style={{ backgroundColor: ui.editorBg, color: ui.sidebarFg }}
    >
      {/* Top Workspace Toolbar (VS Code Theme) */}
      <div 
        className="flex items-center justify-between px-3 py-1.5 border-b text-xs shrink-0 select-none z-10 gap-2 flex-wrap"
        style={{ borderColor: ui.border, backgroundColor: ui.sidebarBg }}
      >
        {/* Left: File Info */}
        <div className="flex items-center space-x-2 truncate">
          <VscFileCode className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="font-semibold text-white truncate max-w-[200px] sm:max-w-[350px]">
            {file.originalName}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono shrink-0">
            DOCX
          </span>
        </div>

        {/* Center: Formatting Toolbar (Visible in Edit Mode) */}
        {mode === 'edit' && (
          <div className="flex items-center space-x-1 bg-black/20 px-2 py-0.5 rounded border border-white/5">
            <button
              onClick={() => format('bold')}
              className="w-6 h-5 flex items-center justify-center rounded font-bold hover:bg-white/10 text-xs transition-colors cursor-pointer"
              title="Bold"
            >
              B
            </button>
            <button
              onClick={() => format('italic')}
              className="w-6 h-5 flex items-center justify-center rounded italic hover:bg-white/10 text-xs transition-colors cursor-pointer"
              title="Italic"
            >
              I
            </button>
            <button
              onClick={() => format('underline')}
              className="w-6 h-5 flex items-center justify-center rounded underline hover:bg-white/10 text-xs transition-colors cursor-pointer"
              title="Underline"
            >
              U
            </button>

            <div className="w-[1px] h-3.5 bg-white/10 mx-1" />

            <button
              onClick={() => format('formatBlock', '<h1>')}
              className="px-1.5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-[10px] font-semibold transition-colors cursor-pointer"
              title="Heading 1"
            >
              H1
            </button>
            <button
              onClick={() => format('formatBlock', '<h2>')}
              className="px-1.5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-[10px] font-semibold transition-colors cursor-pointer"
              title="Heading 2"
            >
              H2
            </button>
            <button
              onClick={() => format('formatBlock', '<p>')}
              className="px-1.5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-[10px] transition-colors cursor-pointer"
              title="Paragraph"
            >
              P
            </button>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center space-x-1.5 shrink-0">
          {/* Mode Switcher */}
          <button
            onClick={() => setMode(prev => prev === 'view' ? 'edit' : 'view')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] transition-colors cursor-pointer ${
              mode === 'edit' ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' : 'bg-white/5 hover:bg-white/10'
            }`}
            title={mode === 'view' ? 'Switch to Edit Mode' : 'Switch to High-Fidelity View Mode'}
          >
            {mode === 'view' ? <VscEdit className="w-3.5 h-3.5" /> : <VscEye className="w-3.5 h-3.5" />}
            <span>{mode === 'view' ? 'Edit Mode' : 'View Mode'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] transition-colors cursor-pointer"
            title="Download Word Document"
          >
            <VscCloudDownload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </button>

          {mode === 'edit' && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-1.5 px-3 py-1 rounded font-medium text-[11px] text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer disabled:opacity-50"
              title="Save changes to Codespace"
            >
              {saving ? (
                <>
                  <VscLoading className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <VscCheck className="w-3.5 h-3.5 text-green-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <VscSave className="w-3.5 h-3.5" />
                  <span>Save</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs px-3 py-1">
          {error}
        </div>
      )}

      {/* Workspace Body Area */}
      <div className="flex-1 w-full h-full overflow-auto p-4 sm:p-8 flex justify-center bg-[#252528] relative">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#252528]/80 z-20 gap-3">
            <VscLoading className="w-7 h-7 animate-spin text-blue-500" />
            <span className="text-xs text-gray-300">Rendering Word Document...</span>
          </div>
        )}

        {/* View Mode: Native High-Fidelity DOCX Rendering */}
        <div 
          ref={previewRef}
          className={`docx-wrapper w-full max-w-[850px] transition-opacity ${
            mode === 'view' ? 'block' : 'hidden'
          }`}
          style={{ minHeight: '800px' }}
        />

        {/* Edit Mode: In-Place Rich Text Editor */}
        <div 
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => {
            if (editorRef.current) setHtmlContent(editorRef.current.innerHTML);
          }}
          className={`w-full max-w-[850px] min-h-[900px] bg-white text-gray-900 shadow-2xl p-10 sm:p-14 rounded-xs border border-gray-200 outline-none font-serif text-[15px] leading-relaxed selection:bg-blue-500/30 ${
            mode === 'edit' ? 'block' : 'hidden'
          }`}
        />
      </div>
    </div>
  );
}
