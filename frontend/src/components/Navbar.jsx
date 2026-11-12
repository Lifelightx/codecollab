import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { VscCode, VscMenu, VscClose, VscAccount, VscSignOut, VscSettings } from 'react-icons/vsc';
import { useAppContext } from '../Context';
import AuthModal from './AuthModal';

function Navbar() {
  const { user, logout, openAuthModal, authModalOpen, closeAuthModal, authModalMode } = useAppContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Render navbar only on the home page ('/') and features ('/features')
  if (location.pathname !== '/' && location.pathname !== '/features') {
    return null;
  }

  const isHome = location.pathname === '/';
  const isFeatures = location.pathname === '/features';

  return (
    <>
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-black/40 border-b border-white/5 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
              <VscCode className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-linear-to-r group-hover:from-white group-hover:to-blue-200 transition-all">
              CodeCollab
            </span>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center space-x-1 p-1 rounded-full bg-white/5 border border-white/5 backdrop-blur-md">
            <Link
              to="/"
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                isHome ? 'bg-white/10 text-white shadow-xs' : 'text-gray-400 hover:text-white'
              }`}
            >
              Home
            </Link>
            <Link
              to="/features"
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                isFeatures ? 'bg-white/10 text-white shadow-xs' : 'text-gray-400 hover:text-white'
              }`}
            >
              Features
            </Link>
          </nav>

          {/* Right side actions */}
          <div className="hidden md:flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-200">
                  <VscAccount className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-medium">{user.username}</span>
                </div>
                <button
                  onClick={logout}
                  className="p-2 rounded-full hover:bg-white/5 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <VscSignOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openAuthModal('login')}
                  className="px-4 py-1.5 text-xs font-medium text-gray-300 hover:text-white rounded-full hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={() => openAuthModal('register')}
                  className="px-4 py-1.5 text-xs font-medium text-white rounded-full bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 transition-all shadow-md shadow-blue-500/20 hover:scale-[1.02] cursor-pointer"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-400 hover:text-white focus:outline-none"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <VscClose className="w-5 h-5" /> : <VscMenu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-white/10 bg-black/90 px-4 pt-2 pb-6 space-y-2 backdrop-blur-xl">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5"
            >
              Home
            </Link>
            <Link
              to="/features"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5"
            >
              Features
            </Link>
            <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
              {user ? (
                <div className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg">
                  <span className="text-sm text-gray-300">{user.username}</span>
                  <button
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      openAuthModal('login');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-center px-4 py-2 rounded-lg border border-white/20 text-xs text-white hover:bg-white/10"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      openAuthModal('register');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-center px-4 py-2 rounded-lg bg-linear-to-r from-blue-600 to-purple-600 text-xs font-medium text-white shadow-md hover:from-blue-500 hover:to-purple-500"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>
      {/* Auth modal */}
      <AuthModal isOpen={authModalOpen} onClose={closeAuthModal} defaultMode={authModalMode} />
    </>
  );
}

export default Navbar;
