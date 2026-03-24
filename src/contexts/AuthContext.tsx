
import React, { createContext, useContext, useState } from 'react';
import { UserRecord } from '../types';

interface AuthContextType {
  currentUser: UserRecord | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser] = useState<UserRecord | null>({
    id: 'local-admin',
    name: 'Admin User',
    email: 'admin@demo.com',
    role: 'admin',
    isApproved: true,
    isVIP: true,
    status: 'active',
    subscriptionType: 'none',
    freeAttempts: 9999,
    coins: 9999,
    subscriptionExpiry: new Date(2099, 1, 1),
    createdAt: new Date(),
    lastLogin: new Date()
  });
  const [loading] = useState(false);

  const login = async () => {};
  const signup = async () => {};
  const logout = async () => {};

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
