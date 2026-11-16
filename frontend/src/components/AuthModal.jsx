import { useState, useRef, useEffect } from 'react';
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

function ArrowLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="m9 12 2 2 4-4"/>
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

  // OTP Verification Step State
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [simulatedOtp, setSimulatedOtp] = useState(null);
  const otpInputRefs = useRef([]);

  // Timer countdown for OTP resend
  useEffect(() => {
    let timer;
    if (isOtpStep && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOtpStep, resendCooldown]);

  if (!isOpen) return null;

  const switchMode = (m) => { 
    setMode(m); 
    setIsOtpStep(false);
    setError(''); 
    setOtpValues(['', '', '', '', '', '']);
  };

  // 1. Submit Registration Details -> Request 6-digit OTP
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/send-otp`, {
        email: email.trim(),
        username: username.trim(),
        password,
      });

      setIsOtpStep(true);
      setResendCooldown(60);
      setOtpValues(['', '', '', '', '', '']);
      if (res.data?.simulated && res.data?.otpPreview) {
        setSimulatedOtp(res.data.otpPreview);
      } else {
        setSimulatedOtp(null);
      }
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Submit 6-digit OTP -> Complete Registration
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    const fullOtp = otpValues.join('');
    if (fullOtp.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/verify-otp`, {
        email: email.trim(),
        otp: fullOtp,
      });

      login(res.data.user, res.data.token);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/auth/resend-otp`, {
        email: email.trim(),
      });
      setResendCooldown(60);
      if (res.data?.simulated && res.data?.otpPreview) {
        setSimulatedOtp(res.data.otpPreview);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  // 4. Handle OTP box changes and navigation
  const handleOtpChange = (index, value) => {
    const cleaned = value.replace(/\D/g, '');
    const newOtp = [...otpValues];

    if (cleaned.length > 1) {
      // User pasted or typed multiple digits
      const digits = cleaned.slice(0, 6).split('');
      digits.forEach((d, i) => {
        if (i < 6) newOtp[i] = d;
      });
      setOtpValues(newOtp);
      const nextFocus = Math.min(digits.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    newOtp[index] = cleaned;
    setOtpValues(newOtp);

    // Advance to next input
    if (cleaned && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      const newOtp = [...otpValues];
      pasted.split('').forEach((d, i) => {
        newOtp[i] = d;
      });
      setOtpValues(newOtp);
      const nextIndex = Math.min(pasted.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
    }
  };

  // 5. Handle Login Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/login`, {
        identifier: identifier.trim(),
        password,
      });
      login(res.data.user, res.data.token);
      onClose();
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

        {/* ── STAGE A: OTP VERIFICATION SCREEN ── */}
        {isOtpStep ? (
          <div>
            <button
              type="button"
              onClick={() => { setIsOtpStep(false); setError(''); }}
              className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors mb-4 cursor-pointer"
            >
              <ArrowLeftIcon />
              <span>Back / Change details</span>
            </button>

            <div className="flex items-center justify-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                <ShieldCheckIcon />
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-2 tracking-tight">
              Verify your email
            </h2>
            <p className="text-xs sm:text-sm text-white/60 text-center mb-6 leading-relaxed">
              We sent a 6-digit verification code to<br />
              <span className="text-white font-medium">{email}</span>
            </p>

            <form onSubmit={handleVerifyOtp} className="space-y-5">
              {/* 6 Digit Inputs */}
              <div className="flex justify-center gap-2 sm:gap-2.5" onPaste={handleOtpPaste}>
                {otpValues.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-10 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold rounded-xl bg-white/[0.05] border border-white/[0.15] hover:border-white/[0.3] focus:border-blue-500 focus:bg-white/[0.08] focus:shadow-[0_0_15px_rgba(59,130,246,0.5)] outline-none text-white transition-all"
                  />
                ))}
              </div>

              {/* Dev Simulation Hint */}
              {simulatedOtp && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs text-center">
                  Simulation mode: Code is <strong className="font-mono tracking-widest text-amber-200">{simulatedOtp}</strong>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || otpValues.join('').length !== 6}
                className="w-full py-3.5 rounded-full text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-[0_0_24px_rgba(37,99,235,0.4)] hover:shadow-[0_0_32px_rgba(37,99,235,0.6)] transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Verifying…' : 'Verify & Complete Registration'}
              </button>

              {/* Resend Link */}
              <div className="text-center pt-2">
                {resendCooldown > 0 ? (
                  <span className="text-xs text-white/40">
                    Resend code in <strong className="text-white/70">{resendCooldown}s</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resending}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {resending ? 'Sending…' : "Didn't receive the code? Resend OTP"}
                  </button>
                )}
              </div>
            </form>
          </div>
        ) : (
          /* ── STAGE B: LOGIN OR REGISTER FORM ── */
          <div>
            {/* Heading */}
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-7 tracking-tight">
              {mode === 'login' ? 'Log in' : 'Sign up'}
            </h1>

            <form onSubmit={mode === 'login' ? handleLoginSubmit : handleRegisterSubmit} className="space-y-4">
              {mode === 'login' ? (
                /* ── LOGIN: email/username field ── */
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Email address or Username
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
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3.5 text-white/40 hover:text-white/80 transition-colors cursor-pointer"
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              {/* Remember me (login only) */}
              {mode === 'login' && (
                <label 
                  onClick={() => setRemember((r) => !r)}
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
                  : mode === 'login' ? 'Sign In' : 'Continue with Email'}
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
        )}
      </div>
    </div>
  );
}

export default AuthModal;
