import { useAppContext } from '../Context';
import AuthModal from '../components/AuthModal';

function SignInPage() {
  const { authModalOpen, openAuthModal, closeAuthModal } = useAppContext();
  // Ensure modal is open in login mode
  if (!authModalOpen) openAuthModal('login');
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      {/* The modal will appear automatically */}
      <AuthModal isOpen={true} onClose={closeAuthModal} defaultMode="login" />
    </div>
  );
}

export default SignInPage;
