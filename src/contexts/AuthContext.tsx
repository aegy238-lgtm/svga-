
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserRecord } from '../types';

// Helper to get or generate device ID
const getDeviceId = () => {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('deviceId', id);
  }
  return id;
};

// Helper to get client IP
const getClientIp = async () => {
  try {
    const res = await fetch('/api/ip');
    const data = await res.json();
    return data.ip;
  } catch (e) {
    console.warn("Could not fetch IP:", e);
    return 'unknown';
  }
};

interface AuthContextType {
  currentUser: UserRecord | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Always provide a Guest Admin user to unlock all features without login
  const [currentUser] = useState<UserRecord>({
    id: 'guest_admin',
    email: 'guest@quantum.com',
    name: 'Guest Admin',
    role: 'admin',
    isApproved: true,
    isVIP: true,
    status: 'active',
    subscriptionType: 'premium',
    freeAttempts: 999999,
    coins: 999999,
    subscriptionExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10), // 10 years
    createdAt: new Date(),
    lastLogin: new Date(),
    deviceId: 'guest_device',
    lastIp: '0.0.0.0',
    hasSvgaExAccess: true,
    allowedExportFormat: ['SVGA 2.0', 'SVGA 2.0 EX', 'VAP (MP4)', 'VAP 1.0.5', 'AE Project', 'Image Sequence', 'GIF (Animation)', 'APNG (Animation)', 'WebM (Video)', 'WebP (Animated)']
  });

  const login = async () => {};
  const signup = async () => {};
  const logout = async () => {};
  const refreshUser = async () => {};

  return (
    <AuthContext.Provider value={{ currentUser, loading: false, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
