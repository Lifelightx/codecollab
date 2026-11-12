import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAppContext } from '../Context';
import Navbar from '../components/Navbar';

function HomePage() {
  const {API_URL, verified, setVerified} = useAppContext();
  const navigate = useNavigate();

  // State variables to manage the entire joining flow
  const [spaceName, setSpaceName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);

  /**
   * Step 1: Called when the user clicks "Get Started".
   * This function checks if the codespace exists and if it's public or private.
   */
  const handleJoinAttempt = async (e) => {
    e.preventDefault();
    if (!spaceName.trim()) return;

    setIsLoading(true);
    setError(''); // Clear previous errors

    try {
      // Use the "get or create" endpoint to check the space's status.
      const sanitizedName = spaceName.trim().toLowerCase();
      const res = await axios.post(`${API_URL}/codespaces`, { name: sanitizedName });
  
        // setVerified(true)
        // If the space is public (or was just created), navigate directly.
        navigate(`/${res.data.name}`);
      
    } catch (err) {
      console.error(err);
      setError('Could not connect to the server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Step 2: Called by the JoinPrivateModal when the user submits a passcode.
   * This function verifies the passcode with the backend.
   */
  // const handleVerifyPasscode = async (passcode) => {
  //   setIsLoading(true);
  //   setError(''); // Clear previous errors (like "Incorrect passcode")
    
  //   try {
  //     const sanitizedName = spaceName.trim().toLowerCase();
  //     await axios.post(`${API_URL}/api/codespaces/${sanitizedName}/verify`, { passcode });
      
  //     // If the request is successful (status 200), the passcode is correct.
  //     setVerified(true);
  //     setShowPasscodeModal(false);
  //     navigate(`/${sanitizedName}`);
  //   } catch (err) {
  //     // The backend sends a 401 status for an incorrect passcode.
  //     if (err.response && err.response.status === 401) {
  //       setError(err.response.data.message || 'Incorrect passcode.');
  //     } else {
  //       setError('An unexpected error occurred.');
  //     }
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  return (
    <>
      <Navbar/>

      {/* The modal is conditionally rendered based on state */}
      {/* {showPasscodeModal && (
        <JoinPrivateModal
          spaceName={spaceName}
          onVerify={handleVerifyPasscode}
          onCancel={() => setShowPasscodeModal(false)}
          error={error}
          isLoading={isLoading}
        />
      )} */}

      {/* Main Page UI */}
      <div className="min-h-screen bg-black text-white overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-linear-to-br from-blue-900/20 via-black to-purple-900/20"></div>
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-size-[64px_64px]"></div>
        
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
          {/* Logo/Badge */}
          <div className="mb-8 px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full text-sm text-gray-300">
            ✨ Real-time collaboration reimagined
          </div>

          {/* Main heading */}
          <h1 className="text-6xl md:text-8xl font-bold text-center mb-6 bg-linear-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent">
            CodeCollab
          </h1>

          {/* Tagline */}
          <p className="text-base md:text-lg text-gray-500 text-center mb-12 max-w-xl">
            The fastest way to collaborate on code in real-time. No setup, no barriers, just pure productivity.
          </p>

          {/* Input form */}
          <div className="w-full max-w-md">
            <div className="flex flex-col sm:flex-row gap-3 backdrop-blur-sm bg-white/5 p-2 rounded-xl border border-white/10 shadow-2xl">
              <input
                type="text"
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinAttempt(e)}
                placeholder="Enter your space name..."
                className="flex-1 bg-transparent border-none px-4 py-3 focus:outline-none text-white placeholder-gray-500"
              />
              <button
                onClick={handleJoinAttempt}
                disabled={isLoading}
                className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-lg px-8 py-3 transition-all duration-200 transform hover:scale-105 shadow-lg disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Checking...' : 'Get Started →'}
              </button>
            </div>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3 mt-12 justify-center max-w-2xl">
            <div className="px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full text-sm text-gray-300">Instant setup</div>
            <div className="px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full text-sm text-gray-300">Real-time sync</div>
            <div className="px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full text-sm text-gray-300">Secure spaces</div>
            <div className="px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full text-sm text-gray-300">Share anywhere</div>
          </div>

          {/* Bottom text */}
          <p className="mt-16 text-sm text-gray-600">
            No sign up required. Start collaborating in seconds.
          </p>
        </div>
      </div>
    </>
  );
}

export default HomePage;