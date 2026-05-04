import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, X, Dumbbell, History, TrendingUp, Check, ChevronDown, ChevronRight, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import {
  collection, query, where, onSnapshot,
  addDoc, deleteDoc, doc, writeBatch, Timestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';

const EXERCISES = [
  'Squats',
  'Single-arm Back Rows',
  'Single-arm Tricep Extensions',
  'Chest Presses',
  'Chest Flyes',
  'Deltoid Extensions',
  'Bicep Curls',
  'Tricep Curls',
  'Shoulder Shrugs'
];

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

// Generate ~14 weeks of realistic demo data
function generateDemoData(userId) {
  const sets = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const splits = {
    1: ['Chest Presses', 'Chest Flyes', 'Bicep Curls', 'Tricep Curls'],
    3: ['Squats', 'Single-arm Back Rows', 'Deltoid Extensions'],
    5: ['Chest Presses', 'Single-arm Tricep Extensions', 'Bicep Curls', 'Shoulder Shrugs'],
    6: ['Squats', 'Single-arm Back Rows', 'Deltoid Extensions', 'Shoulder Shrugs'],
  };

  const program = {
    'Squats':                       { start: 25, gain: 1.0, reps: [10, 14] },
    'Single-arm Back Rows':         { start: 25, gain: 1.0, reps: [10, 14] },
    'Single-arm Tricep Extensions': { start: 12, gain: 0.5, reps: [10, 14] },
    'Chest Presses':                { start: 25, gain: 1.0, reps: [8, 12] },
    'Chest Flyes':                  { start: 15, gain: 0.5, reps: [10, 14] },
    'Deltoid Extensions':           { start: 8,  gain: 0.5, reps: [12, 15] },
    'Bicep Curls':                  { start: 15, gain: 0.5, reps: [10, 14] },
    'Tricep Curls':                 { start: 12, gain: 0.5, reps: [10, 14] },
    'Shoulder Shrugs':              { start: 30, gain: 1.0, reps: [12, 15] },
  };

  const startDaysAgo = 100;

  for (let daysAgo = startDaysAgo; daysAgo >= 1; daysAgo--) {
    const sessionDate = new Date(today);
    sessionDate.setDate(sessionDate.getDate() - daysAgo);

    const exerciseList = splits[sessionDate.getDay()];
    if (!exerciseList) continue;
    if (Math.random() < 0.12) continue;

    const weeksIn = Math.floor((startDaysAgo - daysAgo) / 7);

    for (const exName of exerciseList) {
      const cfg = program[exName];
      if (!cfg) continue;

      const isDeload = weeksIn > 0 && weeksIn % 5 === 0;
      let weight = cfg.start + weeksIn * cfg.gain;
      if (isDeload) weight *= 0.9;
      weight = Math.round(weight * 2) / 2;

      const numSets = Math.random() < 0.4 ? 4 : 3;
      const [minReps, maxReps] = cfg.reps;

      for (let setNum = 1; setNum <= numSets; setNum++) {
        const t = new Date(sessionDate);
        t.setHours(18, Math.floor((setNum - 1) * 8 + Math.random() * 5), 0, 0);

        const baseReps = minReps + Math.floor(Math.random() * (maxReps - minReps + 1));
        const reps = Math.max(minReps - 2, baseReps - (setNum - 1));

        sets.push({
          userId,
          loggedAt: Timestamp.fromDate(t),
          exercise: exName,
          setNumber: setNum,
          weight,
          reps,
        });
      }
    }
  }

  return sets;
}

export default function LiftLog({ user }) {
  const [view, setView] = useState('log');
  const [setLogs, setSetLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [selectedExercise, setSelectedExercise] = useState(EXERCISES[0]);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  const [progressExercise, setProgressExercise] = useState(EXERCISES[0]);

  const [expandedDays, setExpandedDays] = useState(new Set());
  const [historyLimit, setHistoryLimit] = useState(30);

  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);

  // ---- Subscribe to this user's sets, real-time ----
  useEffect(() => {
    const q = query(
      collection(db, 'setLogs'),
      where('userId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const sets = snap.docs.map(d => {
        const data = d.data();
        const ts = data.loggedAt;
        return {
          id: d.id,
          loggedAt: ts instanceof Timestamp ? ts.toDate().toISOString() : ts,
          exercise: data.exercise,
          setNumber: data.setNumber,
          weight: data.weight,
          reps: data.reps,
        };
      }).sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt));
      setSetLogs(sets);
      setLoaded(true);
    }, (err) => {
      console.error('Firestore subscription error', err);
      setLoaded(true);
    });
    return unsub;
  }, [user.uid]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  }

  // ---- Logging ----
  async function logSet() {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (!w || w <= 0 || !r || r <= 0 || busy) return;

    setBusy(true);
    try {
      const now = new Date();
      const todayCount = setLogs.filter(s =>
        s.exercise === selectedExercise && sameDay(s.loggedAt, now.toISOString())
      ).length;

      await addDoc(collection(db, 'setLogs'), {
        userId: user.uid,
        loggedAt: Timestamp.fromDate(now),
        exercise: selectedExercise,
        setNumber: todayCount + 1,
        weight: w,
        reps: r,
      });

      setWeight('');
      setReps('');
      showToast(`SET ${String(todayCount + 1).padStart(2, '0')} LOGGED`);
    } catch (e) {
      console.error('logSet failed', e);
      showToast('LOG FAILED');
    } finally {
      setBusy(false);
    }
  }

  async function deleteSet(id) {
    const target = setLogs.find(s => s.id === id);
    if (!target) return;

    try {
      await deleteDoc(doc(db, 'setLogs', id));

      // Renumber peers (same exercise, same day)
      const peers = setLogs
        .filter(s => s.id !== id && s.exercise === target.exercise && sameDay(s.loggedAt, target.loggedAt))
        .sort((a, b) => new Date(a.loggedAt) - new Date(b.loggedAt));

      const batch = writeBatch(db);
      peers.forEach((s, idx) => {
        if (s.setNumber !== idx + 1) {
          batch.update(doc(db, 'setLogs', s.id), { setNumber: idx + 1 });
        }
      });
      await batch.commit();
    } catch (e) {
      console.error('deleteSet failed', e);
      showToast('DELETE FAILED');
    }
  }

  async function deleteDay(dayKey) {
    if (!confirm('Delete all sets from this day?')) return;
    try {
      const toDelete = setLogs.filter(s => new Date(s.loggedAt).toDateString() === dayKey);
      const batch = writeBatch(db);
      toDelete.forEach(s => batch.delete(doc(db, 'setLogs', s.id)));
      await batch.commit();
      setExpandedDays(prev => {
        const next = new Set(prev);
        next.delete(dayKey);
        return next;
      });
    } catch (e) {
      console.error('deleteDay failed', e);
      showToast('DELETE FAILED');
    }
  }

  function toggleDay(dayKey) {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayKey)) next.delete(dayKey);
      else next.add(dayKey);
      return next;
    });
  }

  async function loadDemoData() {
    if (setLogs.length > 0) {
      if (!confirm('This will replace your current data with ~14 weeks of sample workouts. Continue?')) return;
    }
    setBusy(true);
    try {
      // Wipe existing
      if (setLogs.length > 0) {
        for (let i = 0; i < setLogs.length; i += 400) {
          const batch = writeBatch(db);
          setLogs.slice(i, i + 400).forEach(s => batch.delete(doc(db, 'setLogs', s.id)));
          await batch.commit();
        }
      }
      // Insert demo (Firestore batch limit is 500 per commit)
      const demo = generateDemoData(user.uid);
      for (let i = 0; i < demo.length; i += 400) {
        const batch = writeBatch(db);
        demo.slice(i, i + 400).forEach(s => {
          const ref = doc(collection(db, 'setLogs'));
          batch.set(ref, s);
        });
        await batch.commit();
      }
      showToast(`LOADED ${demo.length} DEMO SETS`);
    } catch (e) {
      console.error('loadDemoData failed', e);
      showToast('LOAD FAILED');
    } finally {
      setBusy(false);
    }
  }

  async function clearAllData() {
    if (!confirm('Delete ALL workout data? This cannot be undone.')) return;
    setBusy(true);
    try {
      for (let i = 0; i < setLogs.length; i += 400) {
        const batch = writeBatch(db);
        setLogs.slice(i, i + 400).forEach(s => batch.delete(doc(db, 'setLogs', s.id)));
        await batch.commit();
      }
      setExpandedDays(new Set());
      showToast('ALL DATA CLEARED');
    } catch (e) {
      console.error('clearAllData failed', e);
      showToast('CLEAR FAILED');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut(auth);
  }

  // ---- Derived data ----
  const todayKey = new Date().toDateString();
  const todaysSets = setLogs
    .filter(s => new Date(s.loggedAt).toDateString() === todayKey)
    .sort((a, b) => new Date(a.loggedAt) - new Date(b.loggedAt));

  const todayGrouped = todaysSets.reduce((acc, s) => {
    if (!acc[s.exercise]) acc[s.exercise] = [];
    acc[s.exercise].push(s);
    return acc;
  }, {});

  const nextSetNumber = (todayGrouped[selectedExercise]?.length || 0) + 1;

  const historyByDay = setLogs.reduce((acc, s) => {
    const k = new Date(s.loggedAt).toDateString();
    if (!acc[k]) acc[k] = [];
    acc[k].push(s);
    return acc;
  }, {});
  const historyDays = Object.entries(historyByDay)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]));

  function progressDataFor(exercise) {
    const byDay = {};
    setLogs.filter(s => s.exercise === exercise).forEach(s => {
      const k = new Date(s.loggedAt).toDateString();
      if (!byDay[k]) byDay[k] = [];
      byDay[k].push(s);
    });
    return Object.entries(byDay)
      .map(([k, sets]) => ({
        date: new Date(k).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: k,
        maxWeight: Math.max(...sets.map(s => s.weight)),
        totalVolume: sets.reduce((acc, s) => acc + s.weight * s.reps, 0),
        totalSets: sets.length
      }))
      .sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate));
  }
  const progressData = progressDataFor(progressExercise);

  if (!loaded) {
    return (
      <div className="min-h-screen bg-black text-stone-600 flex items-center justify-center">
        <div className="lift-display text-2xl">LOADING...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-stone-100">
      {/* Header */}
      <div className="border-b border-stone-800 px-5 py-4 sticky top-0 bg-black z-10">
        <div className="flex items-center justify-between">
          <h1 className="lift-display text-3xl">
            LIFT<span className="text-orange-500">LOG</span>
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-500 lift-mono uppercase tracking-wider hidden sm:inline">
              {user.email || user.displayName}
            </span>
            <button
              onClick={handleSignOut}
              className="text-stone-500 hover:text-orange-500 p-2 -mr-2 transition-colors"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 border-b border-stone-800 sticky top-[57px] bg-black z-10">
        {[
          { id: 'log', label: 'LOG', icon: Dumbbell },
          { id: 'history', label: 'HISTORY', icon: History },
          { id: 'progress', label: 'PROGRESS', icon: TrendingUp }
        ].map(tab => {
          const active = view === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`py-4 flex items-center justify-center gap-2 text-xs font-bold tracking-widest transition-colors ${
                active ? 'text-orange-500 border-b-2 border-orange-500 -mb-px' : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              <Icon size={14} strokeWidth={2.5} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="px-5 pb-32">
        {view === 'log' && (
          <div className="pt-6 space-y-5">
            <div>
              <label className="text-xs text-stone-500 uppercase tracking-widest font-bold mb-2 block">Exercise</label>
              <select
                value={selectedExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
                className="lift-select w-full bg-stone-900 border border-stone-800 text-stone-100 px-4 py-4 text-base font-medium focus:outline-none focus:border-orange-500 transition-colors"
              >
                {EXERCISES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
              </select>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label className="text-xs text-stone-500 uppercase tracking-widest font-bold">Logging</label>
                <span className="text-xs text-orange-500 lift-mono font-bold tracking-widest">
                  → SET {String(nextSetNumber).padStart(2, '0')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="number" inputMode="decimal" step="0.5"
                    value={weight} onChange={(e) => setWeight(e.target.value)}
                    placeholder="WEIGHT"
                    className="lift-mono w-full bg-stone-900 border border-stone-800 text-stone-100 px-4 py-4 text-2xl font-bold focus:outline-none focus:border-orange-500 transition-colors placeholder:text-stone-700 placeholder:text-base"
                  />
                  <div className="text-[10px] text-stone-600 lift-mono uppercase tracking-widest mt-1">lbs</div>
                </div>
                <div>
                  <input
                    type="number" inputMode="numeric"
                    value={reps} onChange={(e) => setReps(e.target.value)}
                    placeholder="REPS"
                    className="lift-mono w-full bg-stone-900 border border-stone-800 text-stone-100 px-4 py-4 text-2xl font-bold focus:outline-none focus:border-orange-500 transition-colors placeholder:text-stone-700 placeholder:text-base"
                  />
                  <div className="text-[10px] text-stone-600 lift-mono uppercase tracking-widest mt-1">reps</div>
                </div>
              </div>
            </div>

            <button
              onClick={logSet}
              disabled={!weight || !reps || busy}
              className="w-full bg-orange-500 text-black py-5 font-bold tracking-widest text-sm hover:bg-orange-400 active:bg-orange-600 disabled:bg-stone-900 disabled:text-stone-700 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={18} strokeWidth={3} />
              LOG SET
            </button>

            {todaysSets.length > 0 ? (
              <div className="pt-4">
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="lift-display text-2xl">TODAY</h2>
                  <span className="text-xs text-stone-500 lift-mono">
                    {todaysSets.length} {todaysSets.length === 1 ? 'SET' : 'SETS'}
                  </span>
                </div>
                <div className="space-y-3">
                  {Object.entries(todayGrouped).map(([exercise, sets]) => (
                    <div key={exercise} className="bg-stone-900 border border-stone-800 p-4">
                      <h3 className="text-sm font-bold mb-3 text-stone-200">{exercise}</h3>
                      <div>
                        {sets.map((s) => (
                          <div key={s.id} className="flex items-center justify-between py-2 border-b border-stone-800 last:border-0">
                            <span className="text-orange-500 text-xs lift-mono font-bold w-14 tracking-wider">
                              SET {String(s.setNumber).padStart(2, '0')}
                            </span>
                            <span className="flex-1 lift-mono text-base">
                              <span className="text-stone-100 font-bold">{s.weight}</span>
                              <span className="text-stone-600"> lbs · </span>
                              <span className="text-stone-100 font-bold">{s.reps}</span>
                              <span className="text-stone-600"> reps</span>
                            </span>
                            <button onClick={() => deleteSet(s.id)} className="text-stone-600 hover:text-red-500 p-2 -mr-2">
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-stone-700">
                <Dumbbell size={48} className="mx-auto mb-4 opacity-40" strokeWidth={1.5} />
                <p className="text-sm">No sets yet today. Log your first one above.</p>
              </div>
            )}
          </div>
        )}

        {view === 'history' && (
          <div className="pt-6">
            {historyDays.length === 0 ? (
              <div className="text-center py-16 text-stone-700">
                <History size={48} className="mx-auto mb-4 opacity-40" strokeWidth={1.5} />
                <p className="text-sm">No workouts logged yet.</p>
                <button
                  onClick={loadDemoData}
                  disabled={busy}
                  className="mt-6 px-5 py-2 border border-stone-800 text-stone-500 hover:text-orange-500 hover:border-orange-500/30 transition-colors text-xs font-bold tracking-widest disabled:opacity-50"
                >
                  LOAD DEMO DATA →
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="lift-display text-2xl">HISTORY</h2>
                  <span className="text-xs text-stone-500 lift-mono">
                    {historyDays.length} {historyDays.length === 1 ? 'DAY' : 'DAYS'}
                  </span>
                </div>
                <div className="space-y-3">
                  {historyDays.slice(0, historyLimit).map(([dayKey, sets]) => {
                    const isExpanded = expandedDays.has(dayKey);
                    const grouped = sets.reduce((acc, s) => {
                      if (!acc[s.exercise]) acc[s.exercise] = [];
                      acc[s.exercise].push(s);
                      return acc;
                    }, {});
                    const totalVolume = sets.reduce((acc, s) => acc + s.weight * s.reps, 0);
                    return (
                      <div key={dayKey} className="bg-stone-900 border border-stone-800">
                        <button
                          onClick={() => toggleDay(dayKey)}
                          className="w-full flex items-center justify-between p-4 hover:bg-stone-800/50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {isExpanded
                              ? <ChevronDown size={18} className="text-orange-500 flex-shrink-0" strokeWidth={2.5} />
                              : <ChevronRight size={18} className="text-stone-600 flex-shrink-0" strokeWidth={2.5} />
                            }
                            <span className="lift-display text-xl truncate">
                              {new Date(dayKey).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 lift-mono text-xs">
                            <span>
                              <span className="text-stone-100 font-bold">{sets.length}</span>
                              <span className="text-stone-600"> sets</span>
                            </span>
                            <span className="text-stone-700">·</span>
                            <span>
                              <span className="text-stone-100 font-bold">{totalVolume.toLocaleString()}</span>
                              <span className="text-stone-600"> vol</span>
                            </span>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-3 border-t border-stone-800">
                            <div className="space-y-3">
                              {Object.entries(grouped).map(([ex, exSets]) => {
                                const sorted = [...exSets].sort((a, b) => a.setNumber - b.setNumber);
                                return (
                                  <div key={ex}>
                                    <div className="text-xs text-stone-400 font-bold mb-1.5">{ex}</div>
                                    <div className="space-y-1">
                                      {sorted.map((s) => (
                                        <div key={s.id} className="flex items-center gap-3 text-sm lift-mono">
                                          <span className="text-orange-500 text-xs font-bold w-12 tracking-wider">
                                            SET {String(s.setNumber).padStart(2, '0')}
                                          </span>
                                          <span className="text-stone-300">
                                            <span className="text-stone-100 font-bold">{s.weight}</span>
                                            <span className="text-stone-600"> lbs · </span>
                                            <span className="text-stone-100 font-bold">{s.reps}</span>
                                            <span className="text-stone-600"> reps</span>
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                              <button
                                onClick={() => deleteDay(dayKey)}
                                className="w-full mt-3 py-2 border border-stone-800 text-stone-600 hover:text-red-500 hover:border-red-500/30 transition-colors text-xs lift-mono tracking-widest font-bold flex items-center justify-center gap-2"
                              >
                                <X size={12} strokeWidth={3} />
                                DELETE DAY
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {historyDays.length > historyLimit && (
                  <button
                    onClick={() => setHistoryLimit(historyLimit + 30)}
                    className="w-full mt-4 py-4 border border-stone-800 text-stone-400 hover:text-orange-500 hover:border-orange-500/30 transition-colors text-xs font-bold tracking-widest"
                  >
                    LOAD OLDER · {historyDays.length - historyLimit} MORE DAYS
                  </button>
                )}
                <div className="mt-8 pt-6 border-t border-stone-900 space-y-1">
                  <button
                    onClick={loadDemoData}
                    disabled={busy}
                    className="w-full py-3 text-stone-500 hover:text-orange-500 transition-colors text-xs lift-mono tracking-widest font-bold disabled:opacity-50"
                  >
                    LOAD DEMO DATA
                  </button>
                  <button
                    onClick={clearAllData}
                    disabled={busy}
                    className="w-full py-3 text-stone-700 hover:text-red-500 transition-colors text-xs lift-mono tracking-widest font-bold disabled:opacity-50"
                  >
                    CLEAR ALL DATA
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {view === 'progress' && (
          <div className="pt-6 space-y-5">
            <div>
              <label className="text-xs text-stone-500 uppercase tracking-widest font-bold mb-2 block">Exercise</label>
              <select
                value={progressExercise}
                onChange={(e) => setProgressExercise(e.target.value)}
                className="lift-select w-full bg-stone-900 border border-stone-800 text-stone-100 px-4 py-4 text-base font-medium focus:outline-none focus:border-orange-500 transition-colors"
              >
                {EXERCISES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
              </select>
            </div>

            {progressData.length === 0 ? (
              <div className="text-center py-16 text-stone-700">
                <TrendingUp size={48} className="mx-auto mb-4 opacity-40" strokeWidth={1.5} />
                <p className="text-sm">No data for this exercise yet.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-stone-900 border border-stone-800 p-3">
                    <div className="text-[10px] text-stone-500 uppercase tracking-widest font-bold mb-1">Sessions</div>
                    <div className="lift-mono text-2xl font-bold text-stone-100">{progressData.length}</div>
                  </div>
                  <div className="bg-stone-900 border border-stone-800 p-3">
                    <div className="text-[10px] text-stone-500 uppercase tracking-widest font-bold mb-1">Best</div>
                    <div className="lift-mono text-2xl font-bold text-orange-500">
                      {Math.max(...progressData.map(d => d.maxWeight))}
                    </div>
                  </div>
                  <div className="bg-stone-900 border border-stone-800 p-3">
                    <div className="text-[10px] text-stone-500 uppercase tracking-widest font-bold mb-1">Latest</div>
                    <div className="lift-mono text-2xl font-bold text-stone-100">
                      {progressData[progressData.length - 1].maxWeight}
                    </div>
                  </div>
                </div>

                <div className="bg-stone-900 border border-stone-800 p-4">
                  <div className="text-xs text-stone-500 uppercase tracking-widest font-bold mb-4">Top Weight per Session (lbs)</div>
                  <div style={{ width: '100%', height: 240 }}>
                    <ResponsiveContainer>
                      <LineChart data={progressData} margin={{ top: 5, right: 15, left: -15, bottom: 5 }}>
                        <CartesianGrid stroke="#292524" strokeDasharray="3 3" />
                        <XAxis dataKey="date" stroke="#78716c" tick={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
                        <YAxis stroke="#78716c" tick={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0c0a09', border: '1px solid #44403c', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', borderRadius: 0 }}
                          labelStyle={{ color: '#a8a29e' }}
                          itemStyle={{ color: '#f97316' }}
                        />
                        <Line type="monotone" dataKey="maxWeight" stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316', r: 5, strokeWidth: 0 }} activeDot={{ r: 7, fill: '#fb923c' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-stone-900 border border-stone-800 p-4">
                  <div className="text-xs text-stone-500 uppercase tracking-widest font-bold mb-3">Session Detail</div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {[...progressData].reverse().map((d, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-stone-800 last:border-0 lift-mono text-sm">
                        <span className="text-stone-400">{d.date}</span>
                        <span>
                          <span className="text-orange-500 font-bold">{d.maxWeight}</span>
                          <span className="text-stone-600"> top · </span>
                          <span className="text-stone-300">{d.totalSets}</span>
                          <span className="text-stone-600"> sets · </span>
                          <span className="text-stone-300">{d.totalVolume.toLocaleString()}</span>
                          <span className="text-stone-600"> vol</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-orange-500 text-black px-6 py-3 font-bold tracking-widest text-sm flex items-center gap-2 shadow-2xl">
          <Check size={16} strokeWidth={3} />
          {toast}
        </div>
      )}
    </div>
  );
}
