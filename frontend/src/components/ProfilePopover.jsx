import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { VscAccount, VscSignOut, VscClose, VscTrash, VscWarning } from 'react-icons/vsc';
import { useAppContext } from '../Context';

export function ProfilePopover({ isOpen, onClose, themeConfig, onClearedAll }) {
  const { user, openAuthModal, logout, API_URL, updateUserStorage } = useAppContext();
  const popoverRef = useRef(null);

  // Clear all state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState('');

  const ui = themeConfig?.ui || {
    sidebarBg: '#252526',
    sidebarFg: '#cccccc',
    sidebarHover: '#2a2d2e',
    activeBorder: '#007acc',
    border: '#454545',
  };

  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    }
    if (isOpen) {
      setShowClearConfirm(false);
      setConfirmText('');
      setClearError('');
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalQuotaBytes = 200 * 1024 * 1024;
  const usedBytes = user?.storageUsedBytes || 0;
  const pct = Math.min(100, (usedBytes / totalQuotaBytes) * 100);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  // Color logic: green till 50%, yellow till 80%, red after 90%
  let barColor = '#22c55e'; // green-500
  if (pct > 90) {
    barColor = '#ef4444'; // red-500
  } else if (pct > 50) {
    barColor = '#eab308'; // yellow-500
  }

  const handleClearAll = async () => {
    if (confirmText.trim() !== 'clear all') return;
    setClearing(true);
    setClearError('');
    try {
      const res = await axios.delete(`${API_URL}/uploads/clear-all`);
      updateUserStorage(0);
      if (onClearedAll) onClearedAll();
      setShowClearConfirm(false);
      setConfirmText('');
    } catch (err) {
      setClearError(err.response?.data?.message || 'Failed to clear uploads.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs select-none">
      <div
        ref={popoverRef}
        className="w-[420px] max-w-[92vw] rounded-xl shadow-2xl border p-6 text-[13px] animate-in fade-in zoom-in-95 duration-150"
        style={{
          backgroundColor: ui.sidebarBg,
          borderColor: ui.border,
          color: ui.sidebarFg,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b mb-5" style={{ borderColor: ui.border }}>
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${ui.activeBorder}33` }}>
              <VscAccount className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-white truncate text-base">
                {user ? user.username : 'Guest User'}
              </div>
              <div className="text-xs opacity-60 truncate">
                {user ? user.email : 'Not signed in'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:opacity-80 transition-opacity cursor-pointer"
            style={{ color: ui.sidebarFg }}
            title="Close"
          >
            <VscClose className="w-5 h-5" />
          </button>
        </div>

        {user ? (
          <div className="space-y-5">
            {/* Storage Quota Section */}
            <div className="space-y-2 p-3.5 rounded-lg bg-black/20 border border-white/5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-white/90">Storage Quota</span>
                <span className="font-semibold text-white text-sm">{pct.toFixed(1)}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(pct > 0 ? 3 : 0, pct)}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs opacity-60 pt-0.5">
                <span>{formatBytes(usedBytes)} used</span>
                <span>200 MB quota</span>
              </div>
            </div>

            {/* Clear All Confirmation Section */}
            {showClearConfirm ? (
              <div className="p-3.5 rounded-lg border border-red-500/30 bg-red-500/10 space-y-3">
                <div className="flex items-start space-x-2 text-red-400">
                  <VscWarning className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    This will permanently delete <strong>all your uploaded files</strong> and reset your storage.
                    To confirm, type <strong className="text-red-300">clear all</strong> below:
                  </div>
                </div>

                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder='Type "clear all"'
                  autoFocus
                  className="w-full px-3 py-1.5 text-xs rounded border bg-black/40 text-white placeholder-white/30 focus:outline-hidden focus:ring-1 focus:ring-red-500"
                  style={{ borderColor: ui.border }}
                />

                {clearError && (
                  <div className="text-xs text-red-400">{clearError}</div>
                )}

                <div className="flex items-center space-x-2 pt-1">
                  <button
                    disabled={confirmText.trim() !== 'clear all' || clearing}
                    onClick={handleClearAll}
                    className="flex-1 py-1.5 px-3 rounded text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    {clearing ? 'Clearing...' : 'Confirm Clear All'}
                  </button>
                  <button
                    onClick={() => {
                      setShowClearConfirm(false);
                      setConfirmText('');
                      setClearError('');
                    }}
                    className="py-1.5 px-3 rounded text-xs hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-medium text-amber-400 hover:bg-amber-500/15 border border-amber-500/25 transition-colors cursor-pointer"
              >
                <VscTrash className="w-4 h-4" />
                <span>Clear All Uploads</span>
              </button>
            )}

            {/* Sign Out Button */}
            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/15 border border-red-500/25 transition-colors cursor-pointer"
            >
              <VscSignOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs opacity-75 leading-relaxed">
              Sign in to unlock persistent spaces, custom slugs, file uploads, and a 200 MB cloud storage quota.
            </p>
            <button
              onClick={() => {
                openAuthModal('login');
                onClose();
              }}
              className="w-full py-2.5 px-4 rounded-lg text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: ui.activeBorder }}
            >
              Sign In / Register
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfilePopover;
