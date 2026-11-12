import { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

// Send cookies with every axios request
axios.defaults.withCredentials = true;

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "/";
  const API_URL = import.meta.env.VITE_API_URL || "/api";

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState("login"); // "login" | "register"
  const [verified, setVerified] = useState(false);

  // Check current session on initial mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = localStorage.getItem("codecollab_token");
        if (token) {
          axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        }
        const res = await axios.get(`${API_URL}/auth/me`);
        if (res.data?.user) {
          setUser(res.data.user);
        }
      } catch (err) {
        setUser(null);
        delete axios.defaults.headers.common["Authorization"];
      } finally {
        setAuthLoading(false);
      }
    };

    checkSession();
  }, [API_URL]);

  const login = (userData, token) => {
    setUser(userData);
    if (token) {
      localStorage.setItem("codecollab_token", token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`);
    } catch (e) {
      // ignore
    }
    setUser(null);
    localStorage.removeItem("codecollab_token");
    delete axios.defaults.headers.common["Authorization"];
  };

  const openAuthModal = (mode = "login") => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  const updateUserStorage = useCallback((bytes) => {
    setUser((prev) => (prev ? { ...prev, storageUsedBytes: bytes } : prev));
  }, []);

  const value = {
    SOCKET_URL,
    API_URL,
    user,
    setUser,
    updateUserStorage,
    authLoading,
    authModalOpen,
    authModalMode,
    openAuthModal,
    closeAuthModal,
    login,
    logout,
    verified,
    setVerified,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useAppContext must be used inside AppProvider");
  }

  return context;
};
