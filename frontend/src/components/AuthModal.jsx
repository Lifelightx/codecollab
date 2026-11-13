import { useState } from 'react';
import axios from 'axios';
import { useAppContext } from '../Context';

// Icons inline
function EyeIcon({ open }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function MailIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function AuthModal({ isOpen, onClose, defaultMode = 'login', isStandalone = false }) {
  const { API_URL, login } = useAppContext();
  const [mode, setMode] = useState(defaultMode);
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const switchMode = (m) => { 
    setMode(m); 
    setError(''); 
  };

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

  // Shared glassmorphic input styling
  const inputCls =
    'w-full bg-white/[0.04] border border-white/[0.1] hover:border-white/[0.2] focus:border-blue-500/70 focus:bg-white/[0.07] rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/30 outline-none backdrop-blur-md transition-all duration-200';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#08080c]/80 backdrop-blur-xl select-none overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget && !isStandalone) onClose(); }}
    >
      {/* Dynamic Glowing Ambient Blobs for Glassmorphism depth */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/25 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 bg-purple-600/20 rounded-full blur-[130px]" />
        <div className="absolute -bottom-32 left-1/3 w-80 h-80 bg-cyan-500/15 rounded-full blur-[110px]" />
      </div>

      {/* Glassmorphic Container Card */}
      <div className="relative w-full max-w-sm sm:max-w-md my-auto px-7 py-9 sm:px-9 sm:py-10 rounded-3xl bg-white/[0.035] border border-white/[0.12] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
        
        {/* Top subtle highlight reflection */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none rounded-t-3xl" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-white/50 hover:text-white bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] transition-colors cursor-pointer"
          title="Close"
        >
          <CloseIcon />
        </button>

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-7 tracking-tight">
          {mode === 'login' ? 'Log in' : 'Sign up'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">

          {mode === 'login' ? (
            /* ── LOGIN: email/username field ── */
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Email address
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-white/40">
                  <MailIcon />
                </span>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name or user@example.com"
                  className={inputCls + ' pl-11'}
                />
              </div>
            </div>
          ) : (
            /* ── REGISTER: email + username fields ── */
            <>
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Email address
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-white/40">
                    <MailIcon />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className={inputCls + ' pl-11'}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Username
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-white/40">
                    <UserIcon />
                  </span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="unique_username"
                    className={inputCls + ' pl-11'}
                  />
                </div>
              </div>
            </>
          )}

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Password
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-white/40">
                <LockIcon />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••••"
                minLength={6}
                className={inputCls + ' pl-11 pr-11'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3.5 text-white/40 hover:text-white/80 transition-colors cursor-pointer"
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {/* Remember me (login only) */}
          {mode === 'login' && (
            <label 
              onClick={() => setRemember(r => !r)}
              className="flex items-center gap-2.5 cursor-pointer select-none pt-1 group"
            >
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                  remember 
                    ? 'border-blue-500 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' 
                    : 'border-white/30 bg-white/[0.05] group-hover:border-white/50'
                }`}
              >
                {remember && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
                Remember password
              </span>
            </label>
          )}

          {/* Error */}
          {error && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-full text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-[0_0_24px_rgba(37,99,235,0.4)] hover:shadow-[0_0_32px_rgba(37,99,235,0.6)] transition-all duration-200 cursor-pointer disabled:opacity-50 mt-3"
          >
            {isLoading
              ? 'Please wait…'
              : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Switch mode */}
        <p className="mt-6 text-center text-sm text-white/60">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="text-blue-400 hover:text-blue-300 font-medium cursor-pointer transition-colors"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-blue-400 hover:text-blue-300 font-medium cursor-pointer transition-colors"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export default AuthModal;
