import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login from './Login.jsx';
import LiftLog from './LiftLog.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
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

  return user ? <LiftLog user={user} /> : <Login />;
}
