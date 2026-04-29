import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';
import AuthWrapper from './AuthWrapper';
import Inventory from './Inventory';
import Tenants from './Tenants';
import Team from './Team';
import MaintenancePanel from './MaintenancePanel';
import TenantPortal from './TenantPortal';
import {
  X, ShieldCheck, Building2, MapPin, LayoutDashboard, RefreshCw, Users, Plus, 
  Trash2, Wallet, Lock, TrendingUp, AlertTriangle, IndianRupee, Home, LogOut, 
  Settings, Bell, Download, Loader2, Wrench, Clock, ChevronLeft, ChevronRight, ArrowRight
} from 'lucide-react';

const ADMIN_CODE = 'A2-ADMIN';

export default function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Initialize all states as empty arrays to prevent "cannot map of undefined" crashes
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [currentPeriod, setCurrentPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [stats, setStats] = useState({ earnings: 0, due: 0, advance: 0, security: 0 });

  // Modals
  const [addPropModal, setAddPropModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState({ open: false, tenant: null });
  const [securityModal, setSecurityModal] = useState({ open: false, type: null, id: null });
  const [financeModal, setFinanceModal] = useState({ open: false, type: '', data: [] });
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const getPeriodLabel = (dateStr) => { const [y, m] = dateStr.split('-'); return `${m}-${y}`; };

  // Safe Balance Calculation
  const calculateBalanceAtPeriod = useCallback((tenant, allLedger, periodLabel) => {
    if (!tenant || !tenant.is_active) return 0;
    const rent = Number(tenant.agreed_rent || 0);
    const paid = (allLedger || []).filter(l => 
      l?.tenant_id === tenant?.id && 
      l?.is_verified && 
      l?.payment_type === 'RENT' && 
      (l?.billing_month === periodLabel || l?.payment_for_month === periodLabel)
    ).reduce((sum, l) => sum + Number(l?.paid_amount || 0), 0);
    return Math.max(rent - paid, 0);
  }, []);

  const fetchData = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      // 1. Get Profile Safely
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setUserProfile(profile);

      if (profile) {
        const targetId = profile.role === 'staff' ? profile.owner_id : profile.id;
        
        // 2. Parallel Fetch with fallback to empty arrays
        const [pRes, rRes, tRes, lRes] = await Promise.all([
          supabase.from('properties').select('*').eq('owner_id', targetId),
          supabase.from('rooms').select('*').eq('owner_id', targetId).order('room_number'),
          supabase.from('tenants').select('*').eq('owner_id', targetId).eq('is_active', true),
          supabase.from('ledger').select('*').eq('owner_id', targetId).order('created_at', { ascending: false })
        ]);

        const pL = pRes.data || [];
        const rL = rRes.data || [];
        const tL = tRes.data || [];
        const lL = lRes.data || [];

        setProperties(pL);
        setRooms(rL);
        setTenants(tL);
        setLedger(lL);

        // Calculate Stats Safely
        const lbl = getPeriodLabel(currentPeriod);
        setStats({
          earnings: lL.filter(l => l.is_verified && l.payment_type === 'RENT' && l.billing_month === lbl).reduce((s, c) => s + Number(c.paid_amount || 0), 0),
          due: tL.reduce((s, t) => s + calculateBalanceAtPeriod(t, lL, lbl), 0),
          advance: lL.filter(l => l.payment_type === 'ADVANCE' && l.billing_month === lbl).reduce((s, c) => s + Number(c.paid_amount || 0), 0),
          security: lL.filter(l => l.payment_type === 'SECURITY').reduce((s, c) => s + Number(c.paid_amount || 0), 0)
        });
      }
    } catch (e) {
      console.error("Database Connection Failed:", e.message);
      showToast("Sync Error: Check Connection");
    } finally {
      setLoading(false);
    }
  }, [session, currentPeriod, calculateBalanceAtPeriod]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
    });
  }, []);

  useEffect(() => {
    if (session) fetchData();
  }, [session, fetchData]);

  if (loading && !userProfile) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-indigo-600 text-white">
        <Loader2 className="animate-spin mb-4" size={40} />
        <h2 className="font-black uppercase tracking-widest text-sm">Connecting A2 Stay Pro...</h2>
        <button onClick={() => window.location.reload()} className="mt-8 bg-white/10 px-6 py-2 rounded-xl text-xs font-bold uppercase">Retry Connection</button>
      </div>
    );
  }

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-white text-zinc-900 flex flex-col">
        {toast && <div className="fixed top-4 right-4 z-[9999] px-6 py-3 bg-rose-600 text-white rounded-2xl shadow-2xl font-black text-xs uppercase">{toast}</div>}
        
        <header className="sticky top-0 z-[100] bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black italic">A2</div>
            <h1 className="font-black text-sm uppercase">{userProfile?.brand_name || 'A2 Stay'}</h1>
          </div>
          <button onClick={fetchData} className="p-2.5 bg-zinc-50 border rounded-xl"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/></button>
        </header>

        <main className="flex-1 p-4 pb-32 max-w-7xl mx-auto w-full">
          {view === 'dashboard' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-black uppercase">Finance Hub</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[{ label: 'Collected', val: stats.earnings, color: 'indigo' }, { label: 'Dues', val: stats.due, color: 'rose' }, { label: 'Advance', val: stats.advance, color: 'emerald' }, { label: 'Security', val: stats.security, color: 'violet' }].map((s, i) => (
                  <div key={i} className="p-6 rounded-[2rem] bg-zinc-50 border shadow-sm">
                    <p className="text-[10px] font-black uppercase text-zinc-400">{s.label}</p>
                    <p className="text-2xl font-black">₹{s.val?.toLocaleString() || 0}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {properties.map(p => (
                  <div key={p.id} className="bg-white border rounded-[2rem] p-8 shadow-sm">
                    <h4 className="text-xl font-black uppercase">{p.name}</h4>
                    <button onClick={() => { setSelectedProperty(p); setView('inventory'); }} className="mt-6 w-full py-4 bg-zinc-900 text-white rounded-2xl font-black text-[10px] uppercase">Open Building</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'inventory' && (
            <Inventory 
              selectedProperty={selectedProperty} 
              rooms={rooms} 
              tenants={tenants} 
              setView={setView} 
              userRole={userProfile?.role}
              calculateBalanceAtPeriod={calculateBalanceAtPeriod}
              currentPeriodLabel={getPeriodLabel(currentPeriod)}
            />
          )}

          {view === 'tenants' && (
            <Tenants 
              tenants={tenants} 
              rooms={rooms} 
              calculateBalanceAtPeriod={calculateBalanceAtPeriod}
              currentPeriodLabel={getPeriodLabel(currentPeriod)}
            />
          )}
        </main>

        <nav className="fixed bottom-0 inset-x-0 bg-white border-t p-4 flex justify-around shadow-2xl z-[200]">
          <button onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'text-indigo-600' : 'text-zinc-300'}><LayoutDashboard/></button>
          <button onClick={() => setView('tenants')} className={view === 'tenants' ? 'text-indigo-600' : 'text-zinc-300'}><Users/></button>
          <button onClick={() => setView('settings')} className={view === 'settings' ? 'text-indigo-600' : 'text-zinc-300'}><Settings/></button>
        </nav>
      </div>
    </AuthWrapper>
  );
}
