import { createContext, useContext, useState } from "react";

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  // Same-origin URLs (Nginx reverse proxy)
  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "/";
const API_URL = import.meta.env.VITE_API_URL || "/api";

  const [verified, setVerified] = useState(false);

  const value = {
    SOCKET_URL,
    API_URL,
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
