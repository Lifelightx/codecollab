import { useState } from 'react';
import axios from 'axios';
import { VscClose, VscAccount, VscLock, VscMail } from 'react-icons/vsc';
import { useAppContext } from '../Context';

function AuthModal({ isOpen, onClose, defaultMode = 'login', themeConfig }) {
  const { API_URL, login } = useAppContext();
  const [mode, setMode] = useState(defaultMode); // 'login' | 'register'
  const [identifier, setIdentifier] = useState(''); // email or username
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const res = await axios.post(`${API_URL}/auth/login`, {
          identifier: identifier.trim(),
          password,
        });
        login(res.data.user, res.data.token);
        onClose();
      } else {
        const res = await axios.post(`${API_URL}/auth/register`, {
          email: email.trim(),
          username: username.trim(),
          password,
        });
        login(res.data.user, res.data.token);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
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
        {/* Title Bar */}
        <div 
          className="flex items-center justify-between px-4 py-2.5 border-b"
          style={{
            backgroundColor: ui.editorBg,
            borderColor: ui.border,
          }}
        >
          <div className="flex items-center space-x-2 font-medium text-xs" style={{ color: ui.tabActiveFg }}>
            <VscAccount className="w-4 h-4" style={{ color: ui.activeBorder }} />
            <span>{mode === 'login' ? 'Sign In to CodeCollab' : 'Create a Free Account'}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors cursor-pointer hover:opacity-80"
            style={{ color: ui.sidebarFg }}
          >
            <VscClose className="w-4 h-4" />
          </button>
        </div>

        {/* Benefits Pill */}
        <div className="px-5 pt-4 pb-1">
          <div 
            className="p-2.5 rounded text-[11px] leading-relaxed border space-y-1"
            style={{
              backgroundColor: `${ui.activeBorder}15`,
              borderColor: `${ui.activeBorder}35`,
              color: ui.sidebarFg,
            }}
          >
            <div className="font-semibold text-white">✨ Signed-in Perks:</div>
            <div>• Spaces kept for <strong>60 days</strong> (vs 3 days for guests)</div>
            <div>• Create <strong>folders</strong> & organize hierarchy</div>
            <div>• Up to <strong>200 MB</strong> total file upload capacity</div>
            <div>• Share via <strong>QR Code</strong> & custom vanity URLs</div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3 font-sans">
          {mode === 'login' ? (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1 opacity-90">
                Email or Username
              </label>
              <div className="relative flex items-center">
                <VscAccount className="absolute left-2.5 w-4 h-4 opacity-60" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name or user@example.com"
                  className="w-full rounded-sm pl-8 pr-3 py-1.5 text-xs outline-none border transition-colors"
                  style={{
                    backgroundColor: ui.editorBg,
                    borderColor: ui.border,
                    color: ui.tabActiveFg,
                  }}
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1 opacity-90">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <VscMail className="absolute left-2.5 w-4 h-4 opacity-60" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full rounded-sm pl-8 pr-3 py-1.5 text-xs outline-none border transition-colors"
                    style={{
                      backgroundColor: ui.editorBg,
                      borderColor: ui.border,
                      color: ui.tabActiveFg,
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1 opacity-90">
                  Username
                </label>
                <div className="relative flex items-center">
                  <VscAccount className="absolute left-2.5 w-4 h-4 opacity-60" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="unique_username"
                    className="w-full rounded-sm pl-8 pr-3 py-1.5 text-xs outline-none border transition-colors"
                    style={{
                      backgroundColor: ui.editorBg,
                      borderColor: ui.border,
                      color: ui.tabActiveFg,
                    }}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1 opacity-90">
              Password
            </label>
            <div className="relative flex items-center">
              <VscLock className="absolute left-2.5 w-4 h-4 opacity-60" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                className="w-full rounded-sm pl-8 pr-3 py-1.5 text-xs outline-none border transition-colors"
                style={{
                  backgroundColor: ui.editorBg,
                  borderColor: ui.border,
                  color: ui.tabActiveFg,
                }}
              />
            </div>
          </div>

          {error && (
            <div className="text-[#f48771] text-xs pt-1 font-mono">
              ● {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-1.5 rounded-sm text-xs font-semibold text-white transition-opacity cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: ui.activeBorder }}
            >
              {isLoading ? 'Processing...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </div>

          <div className="text-center pt-2 text-xs opacity-75">
            {mode === 'login' ? (
              <span>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(''); }}
                  className="font-semibold underline cursor-pointer"
                  style={{ color: ui.activeBorder }}
                >
                  Create one for free
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); }}
                  className="font-semibold underline cursor-pointer"
                  style={{ color: ui.activeBorder }}
                >
                  Sign in
                </button>
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default AuthModal;

