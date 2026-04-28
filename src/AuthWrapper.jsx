import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { Home, Eye, EyeOff, Loader2, Building2 } from 'lucide-react';

export default function AuthWrapper({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [mode,    setMode]    = useState('login');
  const [busy,    setBusy]    = useState(false);
  const [showPw,  setShowPw]  = useState(false);
  const [err,     setErr]     = useState('');
  const [msg,     setMsg]     = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s ?? null));
    return () => subscription.unsubscribe();
  }, []);

  // ── Loading splash ────────────────────────────────────────────────────────
  if (session === undefined) return (
    <div className="min-h-screen bg-[#080816] flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/50">
            <Building2 size={30} className="text-white" />
          </div>
          <div className="absolute inset-0 bg-indigo-600 rounded-2xl animate-ping opacity-20" />
        </div>
        <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em]">A2 Stay Pro</p>
      </div>
    </div>
  );

  if (session) return children;

  // ── Auth form ─────────────────────────────────────────────────────────────
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(''); setMsg('');
    const f = new FormData(e.target);
    const email = f.get('email'), pw = f.get('password');
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) setErr(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password: pw });
      if (error) setErr(error.message);
      else { setMsg('Account created! Check your email to confirm, then sign in.'); setMode('login'); }
    }
    setBusy(false);
  };

  const i = "w-full bg-white/[0.06] border border-white/10 text-white placeholder:text-zinc-600 px-4 py-3.5 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:bg-white/10 transition-all";

  return (
    <div className="min-h-screen bg-[#080816] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-700/15 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-violet-700/10 blur-[100px] rounded-full" />
      </div>

      <div className="relative w-full max-w-[380px]">
        {/* Logo block */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl shadow-2xl shadow-indigo-500/40 mb-4">
            <Building2 size={26} className="text-white" />
          </div>
          <h1 className="text-[22px] font-black text-white tracking-tight leading-none">A2 STAY PRO</h1>
          <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-[0.25em] mt-2">Property Management Platform</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden backdrop-blur-2xl shadow-2xl">
          {/* Mode tabs */}
          <div className="flex border-b border-white/[0.07]">
            {[['login','Sign In'], ['signup','Create Account']].map(([m, lbl]) => (
              <button key={m} type="button" onClick={() => { setMode(m); setErr(''); setMsg(''); }}
                className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest transition-all
                  ${mode === m ? 'text-white border-b-2 border-indigo-500' : 'text-zinc-600 hover:text-zinc-400'}`}>
                {lbl}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="p-6 space-y-3">
            <input name="email" type="email" required className={i} placeholder="Email address" autoComplete="email" />

            <div className="relative">
              <input name="password" type={showPw ? 'text' : 'password'} required className={`${i} pr-11`}
                placeholder="Password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-all">
                {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>

            {err && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
                <p className="text-rose-400 text-xs font-medium">{err}</p>
              </div>
            )}
            {msg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                <p className="text-emerald-400 text-xs font-medium">{msg}</p>
              </div>
            )}

            <button type="submit" disabled={busy}
              className="w-full mt-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
              {busy && <Loader2 size={14} className="animate-spin"/>}
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-zinc-700 text-[9px] font-semibold uppercase tracking-[0.2em] mt-6">
          Secure · Role-Based · Multi-Property
        </p>
      </div>
    </div>
  );
}