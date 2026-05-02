import React, { createContext, useContext, useEffect, useState } from "react";
import { useGetMe, getGetMeQueryKey, User } from "@workspace/api-client-react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const saved = localStorage.getItem("lotus_token");
    if (saved) {
      setAuthTokenGetter(() => saved);
    }
    return saved;
  });

  const { data: user, isLoading, error } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: !!token,
      retry: false
    }
  });

  const login = (newToken: string) => {
    localStorage.setItem("lotus_token", newToken);
    setAuthTokenGetter(() => newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem("lotus_token");
    setToken(null);
    setAuthTokenGetter(() => null);
    window.location.href = "/login";
  };

  useEffect(() => {
    if (error) {
      logout();
    }
  }, [error]);

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
