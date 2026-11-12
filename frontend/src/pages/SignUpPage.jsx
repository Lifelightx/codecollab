import { useAppContext } from '../Context';
import AuthModal from '../components/AuthModal';

function SignUpPage() {
  const { authModalOpen, openAuthModal, closeAuthModal } = useAppContext();
  // Ensure modal is open in register mode
  if (!authModalOpen) openAuthModal('register');
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      {/* The modal will appear automatically */}
      <AuthModal isOpen={true} onClose={closeAuthModal} defaultMode="register" />
    </div>
  );
}

export default SignUpPage;
