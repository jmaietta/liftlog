import { useEffect, useState } from 'react';
import { getRedirectResult, onAuthStateChanged } from 'firebase/auth';
import { auth, firebaseConfigError } from './firebase';
import Login from './Login.jsx';
import LiftLog from './LiftLog.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (firebaseConfigError || !auth) {
      setAuthLoading(false);
      return undefined;
    }

    getRedirectResult(auth).catch((err) => {
      const message = err?.message || 'Google sign-in failed.';
      setAuthError(err?.code ? `${message} (${err.code})` : message);
    });

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black text-stone-600 flex items-center justify-center">
        <div className="lift-display text-2xl">LOADING...</div>
      </div>
    );
  }

  return user ? <LiftLog user={user} /> : <Login configError={firebaseConfigError || authError} />;
}
