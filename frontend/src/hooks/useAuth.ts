import { useCallback, useEffect, useState } from 'react';
import { User } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleClientId, setGoogleClientId] = useState<string>('');

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json() as { user: User | null };
        setUser(data.user);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuthConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/config');
      if (response.ok) {
        const data = await response.json() as { clientId: string };
        setGoogleClientId(data.clientId || '');
      }
    } catch (error) {
      console.error('Error fetching auth config:', error);
    }
  }, []);

  useEffect(() => {
    void fetchCurrentUser();
    void fetchAuthConfig();
  }, [fetchCurrentUser, fetchAuthConfig]);

  const loginWithGoogle = async (credential: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Google login failed');
      }
      const data = await response.json() as { user: User };
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  };

  return {
    user,
    loading,
    googleClientId,
    loginWithGoogle,
    logout,
  };
}
