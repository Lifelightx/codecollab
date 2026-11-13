import { useNavigate } from 'react-router-dom';
import AuthModal from '../components/AuthModal';
import { useAppContext } from '../Context';

function SignUpPage() {
  const { closeAuthModal } = useAppContext();
  const navigate = useNavigate();
  return (
    <AuthModal
      isOpen={true}
      onClose={() => {
        closeAuthModal();
        navigate('/');
      }}
      defaultMode="register"
      isStandalone={true}
    />
  );
}

export default SignUpPage;
