import { useNavigate } from 'react-router-dom';
import AuthModal from '../components/AuthModal';
import { useAppContext } from '../Context';

function SignInPage() {
  const { closeAuthModal } = useAppContext();
  const navigate = useNavigate();
  return (
    <AuthModal
      isOpen={true}
      onClose={() => {
        closeAuthModal();
        navigate('/');
      }}
      defaultMode="login"
      isStandalone={true}
    />
  );
}

export default SignInPage;
