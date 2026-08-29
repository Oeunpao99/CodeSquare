import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { MAJORS, MAJOR_KEYS, MAJOR_STORAGE_KEY, isMajor } from '../majors';
import { useAuth } from './AuthContext';
import { authService } from '../services/api';

const MajorContext = createContext(null);

function readStored() {
  try {
    const saved = localStorage.getItem(MAJOR_STORAGE_KEY);
    if (isMajor(saved)) return saved;
  } catch {
    /* ignore */
  }
  return null; // null = not chosen yet → onboarding
}

export function MajorProvider({ children }) {
  const { user, updateUser } = useAuth();
  const [major, setMajorState] = useState(readStored);

  // Mirror to localStorage for guests / instant reloads.
  useEffect(() => {
    try {
      if (major) localStorage.setItem(MAJOR_STORAGE_KEY, major);
      else localStorage.removeItem(MAJOR_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [major]);

  // Reconcile with the server whenever the logged-in user changes.
  useEffect(() => {
    if (!user) return;
    if (isMajor(user.major)) {
      // Server is source of truth once you're signed in.
      if (user.major !== major) setMajorState(user.major);
    } else if (major) {
      // Picked before signing in (or on another device) → push it up.
      authService
        .updateMajor(major)
        .then(() => updateUser({ major }))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const persist = useCallback(
    (value) => {
      if (!user) return;
      authService
        .updateMajor(value)
        .then(() => updateUser({ major: value }))
        .catch(() => {});
    },
    [user, updateUser]
  );

  const setMajor = useCallback(
    (key) => {
      if (!isMajor(key)) return;
      setMajorState(key);
      persist(key);
    },
    [persist]
  );

  const clearMajor = useCallback(() => {
    setMajorState(null);
    persist(null);
  }, [persist]);

  const value = {
    major,
    majorData: major ? MAJORS[major] : null,
    hasMajor: !!major,
    setMajor,
    clearMajor,
    majors: MAJORS,
    majorKeys: MAJOR_KEYS,
  };

  return <MajorContext.Provider value={value}>{children}</MajorContext.Provider>;
}

export function useMajor() {
  const ctx = useContext(MajorContext);
  if (!ctx) throw new Error('useMajor must be used within a MajorProvider');
  return ctx;
}
