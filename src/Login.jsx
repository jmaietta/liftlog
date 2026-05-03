import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithRedirect,
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { Dumbbell } from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState('signin'); // signin | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function prettyError(msg) {
    return msg
      .replace('Firebase: ', '')
      .replace(/\(auth\/[^)]+\)/, '')
      .trim();
  }

  async function handleEmail(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(prettyError(err.message));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setBusy(true);
    try {
      // Redirect to Google's sign-in page (avoids COOP popup issues)
      await signInWithRedirect(auth, googleProvider);
    } catch (err) {
      setError(prettyError(err.message));
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-stone-100 flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <Dumbbell size={48} className="mx-auto text-orange-500 mb-4" strokeWidth={1.5} />
          <h1 className="lift-display text-5xl">
            LIFT<span className="text-orange-500">LOG</span>
          </h1>
        </div>

        <form onSubmit={handleEmail} className="space-y-4">
          <div>
            <label className="text-xs text-stone-500 uppercase tracking-widest font-bold mb-2 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-stone-900 border border-stone-800 text-stone-100 px-4 py-4 text-base focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-stone-500 uppercase tracking-widest font-bold mb-2 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className="w-full bg-stone-900 border border-stone-800 text-stone-100 px-4 py-4 text-base focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {error && (
            <div className="text-red-500 text-xs lift-mono">{error}</div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-orange-500 text-black py-5 font-bold tracking-widest text-sm hover:bg-orange-400 active:bg-orange-600 disabled:bg-stone-900 disabled:text-stone-700 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? '...' : (mode === 'signup' ? 'CREATE ACCOUNT' : 'SIGN IN')}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-stone-800" />
          <span className="text-xs text-stone-600 lift-mono">OR</span>
          <div className="flex-1 h-px bg-stone-800" />
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full bg-stone-100 text-black py-5 font-bold tracking-widest text-sm hover:bg-white active:bg-stone-300 disabled:bg-stone-900 disabled:text-stone-700 disabled:cursor-not-allowed transition-colors"
        >
          CONTINUE WITH GOOGLE
        </button>

        <button
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
          className="w-full mt-6 text-xs text-stone-500 hover:text-orange-500 lift-mono tracking-widest font-bold py-2"
        >
          {mode === 'signin' ? 'NEW HERE? CREATE ACCOUNT' : 'HAVE AN ACCOUNT? SIGN IN'}
        </button>
      </div>
    </div>
  );
}
