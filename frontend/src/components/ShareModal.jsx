import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import { VscClose, VscCopy, VscCheck, VscGlobe } from 'react-icons/vsc';
import { useAppContext } from '../Context';

function ShareModal({ isOpen, onClose, spaceName, currentSlug, onSlugUpdated, themeConfig }) {
  const { API_URL, user } = useAppContext();
  const [copied, setCopied] = useState(false);
  const [customSlug, setCustomSlug] = useState(currentSlug || '');
  const [slugError, setSlugError] = useState('');
  const [slugSuccess, setSlugSuccess] = useState('');
  const [isSavingSlug, setIsSavingSlug] = useState(false);

  const ui = themeConfig?.ui || {
    sidebarBg: '#252526',
    sidebarFg: '#cccccc',
    sidebarHover: '#2a2d2e',
    activeBorder: '#007acc',
    border: '#454545',
    editorBg: '#1e1e1e',
    tabActiveFg: '#ffffff',
  };

  if (!isOpen) return null;

  const currentOrigin = window.location.origin;
  const shareUrl = customSlug
    ? `${currentOrigin}/${customSlug}`
    : `${currentOrigin}/${spaceName}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveSlug = async (e) => {
    e.preventDefault();
    setSlugError('');
    setSlugSuccess('');
    setIsSavingSlug(true);

    try {
      const res = await axios.post(`${API_URL}/codespaces/${spaceName}/custom-slug`, {
        slug: customSlug.trim(),
      });
      setSlugSuccess('Custom URL saved!');
      if (onSlugUpdated) onSlugUpdated(res.data.customSlug);
    } catch (err) {
      setSlugError(err.response?.data?.message || 'Failed to update custom URL');
    } finally {
      setIsSavingSlug(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
      <div 
        className="w-[440px] rounded-md shadow-2xl overflow-hidden text-[13px] border animate-in fade-in zoom-in-95 duration-100"
        style={{
          backgroundColor: ui.sidebarBg,
          borderColor: ui.border,
          color: ui.sidebarFg,
        }}
      >
        {/* Title Bar */}
        <div 
          className="flex items-center justify-between px-4 py-2.5 border-b"
          style={{
            backgroundColor: ui.editorBg,
            borderColor: ui.border,
          }}
        >
          <div className="flex items-center space-x-2 font-medium text-xs" style={{ color: ui.tabActiveFg }}>
            <VscGlobe className="w-4 h-4" style={{ color: ui.activeBorder }} />
            <span>Share Codespace: {spaceName}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors cursor-pointer hover:opacity-80"
            style={{ color: ui.sidebarFg }}
          >
            <VscClose className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 font-sans">
          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-3 rounded bg-white w-fit mx-auto shadow-inner">
            <QRCodeSVG 
              value={shareUrl} 
              size={140}
              level="M"
              includeMargin={false}
            />
          </div>
          <div className="text-center text-[11px] opacity-70">
            Scan with your mobile camera or share link below
          </div>

          {/* Copy Share Link */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1 opacity-90">
              Shareable Link
            </label>
            <div className="flex items-center space-x-1.5">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 rounded-sm px-2.5 py-1.5 text-xs outline-none border font-mono select-all"
                style={{
                  backgroundColor: ui.editorBg,
                  borderColor: ui.border,
                  color: ui.tabActiveFg,
                }}
              />
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-sm text-xs font-semibold text-white transition-opacity cursor-pointer hover:opacity-90"
                style={{ backgroundColor: ui.activeBorder }}
              >
                {copied ? (
                  <>
                    <VscCheck className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <VscCopy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Custom Vanity Slug - Signed in users only */}
          <div className="pt-2 border-t" style={{ borderColor: ui.border }}>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1 opacity-90">
              Custom Vanity URL (Signed-in feature)
            </label>
            {user ? (
              <form onSubmit={handleSaveSlug} className="space-y-2">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs opacity-60 font-mono">{currentOrigin}/</span>
                  <input
                    type="text"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    placeholder="my-custom-url"
                    className="flex-1 rounded-sm px-2.5 py-1 text-xs outline-none border font-mono"
                    style={{
                      backgroundColor: ui.editorBg,
                      borderColor: ui.border,
                      color: ui.tabActiveFg,
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isSavingSlug || !customSlug.trim()}
                    className="px-3 py-1 rounded-sm text-xs font-semibold text-white transition-opacity cursor-pointer hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: ui.activeBorder }}
                  >
                    {isSavingSlug ? 'Saving...' : 'Set'}
                  </button>
                </div>
                {slugError && <div className="text-[#f48771] text-xs font-mono">● {slugError}</div>}
                {slugSuccess && <div className="text-[#89d185] text-xs font-mono">● {slugSuccess}</div>}
              </form>
            ) : (
              <div 
                className="p-2.5 rounded text-xs leading-relaxed border"
                style={{
                  backgroundColor: `${ui.sidebarHover}55`,
                  borderColor: ui.border,
                }}
              >
                Sign in to customize your share URL to something clean like <span className="font-mono text-white">/{spaceName}-live</span>.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShareModal;

