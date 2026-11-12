import { useState, useEffect } from 'react';
import { VscWarning, VscClose, VscAccount } from 'react-icons/vsc';

const REMINDER_KEY = 'codecollab_guest_reminder_dismissed_at';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function GuestReminderBanner({ user, onOpenAuth, themeConfig }) {
  const [isVisible, setIsVisible] = useState(false);

  const ui = themeConfig?.ui || {
    activeBorder: '#007acc',
    editorBg: '#1e1e1e',
    tabActiveFg: '#ffffff',
  };

  useEffect(() => {
    // If user is already signed in, never show reminder
    if (user) {
      setIsVisible(false);
      return;
    }

    const lastDismissed = localStorage.getItem(REMINDER_KEY);
    if (!lastDismissed) {
      setIsVisible(true);
      return;
    }

    const timePassed = Date.now() - parseInt(lastDismissed, 10);
    if (timePassed > TWENTY_FOUR_HOURS_MS) {
      setIsVisible(true);
    }
  }, [user]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(REMINDER_KEY, Date.now().toString());
  };

  if (!isVisible) return null;

  return (
    <div 
      className="flex items-center justify-between px-3 py-1.5 text-xs select-none border-b z-30 transition-all font-sans"
      style={{
        backgroundColor: '#f59e0b1a',
        borderColor: '#f59e0b40',
        color: '#fbbf24',
      }}
    >
      <div className="flex items-center space-x-2 truncate min-w-0">
        <VscWarning className="w-4 h-4 shrink-0 text-amber-400" />
        <span className="truncate">
          <strong>Guest Session:</strong> This space will auto-expire in <strong>3 days</strong> (max 2MB).
        </span>
        <button
          onClick={() => onOpenAuth('register')}
          className="underline font-semibold hover:text-white cursor-pointer ml-1 inline-flex items-center space-x-1"
        >
          <span>Sign in free for 60 days, folders & 200MB</span>
        </button>
      </div>

      <div className="flex items-center space-x-2 shrink-0 ml-3">
        <button
          onClick={() => onOpenAuth('login')}
          className="px-2 py-0.5 rounded text-[11px] font-semibold text-white cursor-pointer hover:opacity-90"
          style={{ backgroundColor: ui.activeBorder }}
        >
          Sign In
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 hover:opacity-100 opacity-70 cursor-pointer"
          title="Dismiss (Remind me tomorrow)"
        >
          <VscClose className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default GuestReminderBanner;

