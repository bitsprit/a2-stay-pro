import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import AuthWrapper from './AuthWrapper';
import Inventory   from './Inventory';
import Tenants     from './Tenants';
import Team        from './Team';
import {
  X, ShieldAlert, ShieldCheck, Building2, MapPin, LayoutDashboard,
  RefreshCw, Users, Plus, MessageCircle, ChevronLeft, ChevronRight,
  Trash2, Edit3, Wallet, ArrowRight, Lock, CheckCircle2,
  TrendingUp, AlertTriangle, IndianRupee, Home, LogOut, Settings,
  Bell, Download, Loader2, ClipboardList, User
} from 'lucide-react';

export default function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Data States - Always initialized as empty arrays to prevent crashes
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [allUsersList, setAllUsersList] = useState([]);

  // Fetch Logic
  const fetchData = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      // 1. Get Profile First
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setUserProfile(profile);

      if (profile) {
        // 2. Parallel Fetch with fallback to empty arrays
        const [pRes, rRes, tRes, lRes] = await Promise.all([
          supabase.from('properties').select('*').eq('owner_id', profile.role === 'staff' ? profile.owner_id : profile.id),
          supabase.from('rooms').select('*').eq('owner_id', profile.role === 'staff' ? profile.owner_id : profile.id),
          supabase.from('tenants').select('*').eq('owner_id', profile.role === 'staff' ? profile.owner_id : profile.id),
          supabase.from('ledger').select('*').eq('owner_id', profile.role === 'staff' ? profile.owner_id : profile.id)
        ]);

        setProperties(pRes.data || []);
        setRooms(rRes.data || []);
        setTenants(tRes.data || []);
        setLedger(lRes.data || []);
      }
    } catch (e) {
      console.error("Critical Fetch Error:", e);
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchData();
    });
  }, [fetchData]);

  // EMERGENCY RENDER: If loading or no profile, show a basic emergency UI
  if (loading && !userProfile) {
    return (
      <div className="h-screen w-full bg-indigo-600 flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-black uppercase">Syncing A2 Stay Pro...</h2>
        <p className="text-sm opacity-70 mt-2 font-bold">If this takes more than 10 seconds, please refresh.</p>
        <button onClick={() => supabase.auth.signOut()} className="mt-8 bg-white/10 px-6 py-2 rounded-xl text-xs font-black uppercase">Sign Out & Reset</button>
      </div>
    );
  }

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-white">
        <header className="p-4 border-b flex justify-between items-center bg-white sticky top-0 z-50">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white"><Home size={16}/></div>
             <h1 className="font-black text-sm uppercase tracking-tighter">{userProfile?.brand_name || 'A2 Stay'}</h1>
          </div>
          <button onClick={fetchData} className="p-2 bg-zinc-100 rounded-lg"><RefreshCw size={16}/></button>
        </header>

        <main className="p-4 pb-32">
          {view === 'dashboard' && (
            <div className="space-y-6">
               <h2 className="text-2xl font-black italic uppercase">Dashboard</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {properties.length > 0 ? properties.map(p => (
                   <div key={p.id} className="p-6 border rounded-[2rem] bg-zinc-50">
                     <p className="font-black text-xl">{p.name}</p>
                     <p className="text-xs text-zinc-400 mt-1">{p.address}</p>
                   </div>
                 )) : (
                   <div className="col-span-full py-20 text-center border-2 border-dashed rounded-[2rem] text-zinc-300">
                     <Building2 size={48} className="mx-auto mb-4 opacity-20"/>
                     <p className="font-black uppercase text-xs">No Buildings Found</p>
                   </div>
                 )}
               </div>
            </div>
          )}
          {/* Other views (Tenants, Team, Settings) should be added back one by one */}
        </main>

        <nav className="fixed bottom-0 inset-x-0 bg-white border-t p-4 flex justify-around shadow-2xl">
          <button onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'text-indigo-600' : 'text-zinc-300'}><LayoutDashboard/></button>
          <button onClick={() => setView('tenants')} className={view === 'tenants' ? 'text-indigo-600' : 'text-zinc-300'}><Users/></button>
          <button onClick={() => setView('settings')} className={view === 'settings' ? 'text-indigo-600' : 'text-zinc-300'}><Settings/></button>
        </nav>
      </div>
    </AuthWrapper>
  );
}
