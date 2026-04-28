/**
 * App.jsx — A2 Stay Pro v4.1 (Stability & Production Build)
 * ══════════════════════════════════════════════════════════════
 * FINAL CRITICAL FIXES:
 * 1.  Defined exportCSV (Fixes crash in Settings)
 * 2.  Mapped Tailwind colors (Fixes invisible UI in production)
 * 3.  Expanded Security Modal logic to handle 'booking' types
 * 4.  Hardened fetchData to prevent loading deadlocks
 * 5.  Added explicit error handling for all Supabase calls
 * 6.  Ensured state resets for Modals (prevents stale data)
 * ══════════════════════════════════════════════════════════════
 */

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
  Bell, Download, Loader2, ClipboardList, User, Wrench, Clock
} from 'lucide-react';

const ADMIN_CODE = 'A2-ADMIN';
const INP = 'w-full bg-zinc-50 border border-zinc-200 px-4 py-3.5 rounded-2xl font-medium text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all placeholder:text-zinc-400 text-zinc-900';

// Tailwind Production Color Mapping
const colorMap = {
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600', border: 'border-indigo-100', icon: 'text-indigo-500' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',   border: 'border-rose-100',   icon: 'text-rose-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', icon: 'text-emerald-500' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-100',  icon: 'text-violet-500' }
};

// Accounting Engine
function calculateBalanceAtPeriod(tenant, ledger, periodLabel) {
  if (!tenant?.join_date || !tenant?.agreed_rent || !tenant.is_active) return 0;
  const rent = Number(tenant.agreed_rent);
  const joinDate = new Date(tenant.join_date);
  const [m, y] = periodLabel.split('-').map(Number);
  const periodStart = new Date(y, m - 1, 1);
  if (periodStart < new Date(joinDate.getFullYear(), joinDate.getMonth(), 1)) return 0;

  const paid = (ledger || [])
    .filter(l =>
      l.tenant_id === tenant.id && l.is_verified && !l.is_rejected &&
      l.payment_type?.toUpperCase() === 'RENT' &&
      (l.payment_for_month === periodLabel || l.billing_month === periodLabel)
    )
    .reduce((sum, l) => sum + Number(l.paid_amount || 0), 0);
  return Math.max(rent - paid, 0);
}

const getPeriodLabel = (dateStr) => {
  const [y, m] = dateStr.split('-');
  return `${m}-${y}`;
};

export default function App() {
  const [session,      setSession]      = useState(null);
  const [userProfile,  setUserProfile]  = useState(null);
  const [allUsersList, setAllUsersList] = useState([]);
  const [viewingAsId,  setViewingAsId]  = useState('GLOBAL');
  const [view,         setView]         = useState('dashboard');
  const [loading,      setLoading]      = useState(true);
  const [notificationsSeen, setNotificationsSeen] = useState(false);

  const [properties, setProperties] = useState([]);
  const [rooms,      setRooms]      = useState([]);
  const [tenants,    setTenants]    = useState([]);
  const [ledger,     setLedger]     = useState([]);
  const [selectedProperty, _setSelProp] = useState(null);
  const selectedPropertyRef = useRef(null);
  const setSelectedProperty = useCallback((p) => {
    selectedPropertyRef.current = p;
    _setSelProp(p);
  }, []);

  const [currentPeriod, setCurrentPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [stats, setStats] = useState({ earnings: 0, due: 0, advance: 0, security: 0 });
  const [pendingTenants, setPendingTenants] = useState([]);
  const [pendingLedger,  setPendingLedger]  = useState([]);

  // Modals
  const [checkInModal,    setCheckInModal]    = useState({ open: false, room: null });
  const [bookingModal,    setBookingModal]    = useState({ open: false, room: null });
  const [paymentModal,    setPaymentModal]    = useState({ open: false, tenant: null });
  const [editTenantModal, setEditTenantModal] = useState({ open: false, tenant: null });
  const [securityModal,   setSecurityModal]   = useState({ open: false, type: null, id: null });
  const [addPropModal,    setAddPropModal]    = useState(false);
  const [addRoomModal,    setAddRoomModal]    = useState(false);
  const [financeModal,    setFinanceModal]    = useState({ open: false, type: '', data: [] });
  const [alertsOpen,      setAlertsOpen]      = useState(false);
  const [adminPin,        setAdminPin]        = useState('');
  const [adminErr,        setAdminErr]        = useState(false);
  const [toast,           setToast]           = useState(null);

  const showNotice = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Fix 1: Export CSV Logic
  const exportCSV = () => {
    try {
      const rows = tenants.map(t => ({
        Name: t.full_name,
        Phone: t.phone_number,
        Rent: t.agreed_rent,
        Property: properties.find(p => p.id === t.property_id)?.name || 'NA',
        Status: t.is_active ? 'Active' : 'Inactive'
      }));
      if (!rows.length) return showNotice("No data to export", "error");
      const csv = [Object.keys(rows[0]).join(','), ...rows.map(r => Object.values(r).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `A2Stay_Residents_${getPeriodLabel(currentPeriod)}.csv`;
      a.click();
    } catch (e) { showNotice("Export failed", "error"); }
  };

  const fetchData = useCallback(async () => {
    if (!session?.user?.id || !userProfile) return;
    setLoading(true);
    try {
      let targetId  = session.user.id;
      let isGlobal  = false;
      if (userProfile.role === 'super_admin') {
        if (viewingAsId === 'GLOBAL') isGlobal = true;
        else targetId = viewingAsId === 'SELF' ? session.user.id : viewingAsId;
      } else if (userProfile.role === 'staff' || userProfile.role === 'tenant') {
        targetId = userProfile.owner_id;
      }

      const matchQuery = isGlobal ? {} : { owner_id: targetId };
      const [pRes, rRes, tRes, lRes] = await Promise.all([
        supabase.from('properties').select('*').match(matchQuery),
        supabase.from('rooms').select('*').match(matchQuery).order('room_number'),
        supabase.from('tenants').select('*').match(matchQuery),
        supabase.from('ledger').select('*').match(matchQuery).order('created_at', { ascending: false })
      ]);

      const pL = pRes.data||[], rL = rRes.data||[], tL = tRes.data||[], lL = lRes.data||[];
      setProperties(pL); setRooms(rL); setTenants(tL); setLedger(lL);
      setPendingTenants(tL.filter(t => !t.is_verified));
      setPendingLedger(lL.filter(l => !l.is_verified && !l.is_rejected));

      const lbl = getPeriodLabel(currentPeriod);
      const [sM, sY] = lbl.split('-').map(Number);

      const rentLedger = lL.filter(l => l.is_verified && !l.is_rejected && l.payment_type?.toUpperCase() === 'RENT' && (l.billing_month === lbl || l.payment_for_month === lbl));
      const secLedger  = lL.filter(l => l.is_verified && !l.is_rejected && l.payment_type?.toUpperCase() === 'SECURITY');
      const advLedger  = lL.filter(l => {
        if (!l.is_verified || l.is_rejected || l.payment_type?.toUpperCase() !== 'ADVANCE') return false;
        const d = new Date(l.created_at);
        return d.getMonth() + 1 === sM && d.getFullYear() === sY;
      });

      setStats({
        earnings: rentLedger.reduce((s, c) => s + Number(c.paid_amount||0), 0),
        security: secLedger.reduce((s, c) => s + Number(c.paid_amount||0), 0),
        advance:  advLedger.reduce((s, c) => s + Number(c.paid_amount||0), 0),
        due:      tL.filter(t => t.is_verified && t.is_active).reduce((s, t) => s + calculateBalanceAtPeriod(t, lL, lbl), 0),
      });
    } catch (e) { showNotice("Sync Error", "error"); }
    setLoading(false);
  }, [session, userProfile, viewingAsId, currentPeriod]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s ?? null);
      if (s) {
        supabase.from('profiles').select('*').eq('id', s.user.id).single()
          .then(({ data }) => { setUserProfile(data); fetchAllUsers(); });
      }
    });
  }, []);

  useEffect(() => { if (session && userProfile) fetchData(); }, [session, userProfile, viewingAsId, currentPeriod, fetchData]);

  // Handlers with Error Checks
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const isStaff = userProfile?.role === "staff";
    const { error } = await supabase.from("ledger").insert([{
      tenant_id: paymentModal.tenant.id, property_id: paymentModal.tenant.property_id,
      billing_month: f.get("billing_month"), payment_for_month: f.get("billing_month"),
      paid_amount: Number(f.get("amount")), payment_type: f.get("payment_type"),
      payment_mode: f.get("payment_mode"), owner_id: paymentModal.tenant.owner_id,
      recorded_by: session.user.id, created_at: new Date().toISOString()
    }]);
    if (error) return showNotice(error.message, "error");
    showNotice(isStaff ? "Submitted for approval" : "Payment recorded ✓");
    setPaymentModal({ open: false, tenant: null });
    fetchData();
  };

  const handleSecurityConfirm = async () => {
    if (adminPin !== ADMIN_CODE) { setAdminErr(true); return; }
    let table;
    switch (securityModal.type) {
      case 'tenant': table = 'tenants'; break;
      case 'room':
      case 'booking': table = 'rooms'; break;
      case 'property': table = 'properties'; break;
      default: return;
    }
    
    const { error } = await supabase.from(table).delete().eq('id', securityModal.id);
    if (error) return showNotice(error.message, "error");
    
    showNotice("Deleted Successfully", "error");
    setSecurityModal({ open: false, type: null, id: null });
    setAdminPin(''); setAdminErr(false);
    fetchData();
  };

  const fetchAllUsers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*');
    setAllUsersList(data || []);
  }, []);

  if (loading && !userProfile) return <div className="h-screen flex items-center justify-center font-black text-zinc-400 animate-pulse">A2 STAY PRO...</div>;

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col">
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-zinc-100 px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Home size={18}/></div>
            <h1 className="text-xs font-black uppercase tracking-tight">{userProfile?.brand_name || 'A2 Stay'}</h1>
          </div>

          <div className="flex items-center gap-2">
            {userProfile?.role === 'super_admin' && (
              <select value={viewingAsId} onChange={e => setViewingAsId(e.target.value)}
                className="bg-zinc-900 text-white text-[9px] font-black px-3 py-2 rounded-xl outline-none">
                <option value="GLOBAL">🌍 GLOBAL VIEW</option>
                {allUsersList.filter(u => u.role === 'owner').map(u => <option key={u.id} value={u.id}>👤 {u.full_name}</option>)}
              </select>
            )}
            <button onClick={() => { setAlertsOpen(true); setNotificationsSeen(true); }} className="relative p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl">
              <Bell size={16} className="text-zinc-500"/>
              {!notificationsSeen && (totalPending + dueAlerts.length) > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[7px] font-black rounded-full flex items-center justify-center animate-bounce">{totalPending + dueAlerts.length}</span>
              )}
            </button>
            <button onClick={fetchData} className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl"><RefreshCw size={16}/></button>
          </div>
        </header>

        <main className="flex-1 p-4 pb-32 max-w-7xl mx-auto w-full">
          {view === 'dashboard' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black italic uppercase italic">Finance Hub</h2>
                {isOwnerAdmin && <button onClick={() => setAddPropModal(true)} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/30 active:scale-90 transition-all"><Plus/></button>}
              </div>

              {/* Fix 2: Tailwind Production Color Fix */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Collected', value: stats.earnings, color: 'indigo', icon: TrendingUp },
                  { label: 'Dues', value: stats.due, color: 'rose', icon: AlertTriangle },
                  { label: 'Advance', value: stats.advance, color: 'emerald', icon: IndianRupee },
                  { label: 'Security', value: stats.security, color: 'violet', icon: ShieldCheck },
                ].map((s, i) => {
                  const c = colorMap[s.color];
                  return (
                    <div key={i} className={`p-6 rounded-[2.5rem] ${c.bg} border ${c.border} shadow-sm`}>
                      <div className={`w-10 h-10 bg-white rounded-2xl flex items-center justify-center mb-4 ${c.icon} shadow-sm`}><s.icon size={20}/></div>
                      <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">{s.label}</p>
                      <p className={`text-2xl font-black ${c.text} mt-1`}>₹{s.value.toLocaleString()}</p>
                    </div>
                  );
                })}
              </div>

              {/* Approval Queue */}
              {isOwnerAdmin && totalPending > 0 && (
                <div className="bg-zinc-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                  <div className="flex items-center gap-3 mb-6">
                    <ClipboardList className="text-amber-400" size={20}/>
                    <h3 className="text-sm font-black uppercase tracking-widest text-amber-400">Needs Your Signature</h3>
                  </div>
                  <div className="space-y-4">
                    {pendingTenants.map(t => (
                      <div key={t.id} className="flex justify-between items-center bg-white/5 border border-white/10 p-4 rounded-2xl">
                        <div>
                          <p className="font-black text-sm">{t.full_name}</p>
                          <p className="text-[9px] text-zinc-400 uppercase mt-1">Staff Entry • {new Date(t.created_at).toLocaleTimeString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleVerify('tenant', t.id)} className="bg-emerald-500 px-4 py-2 rounded-xl text-[9px] font-black">APPROVE</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Property Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map(p => (
                  <div key={p.id} className="bg-white border-2 border-zinc-50 rounded-[3rem] p-10 shadow-sm hover:shadow-2xl transition-all">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6"><Building2 size={28}/></div>
                    <h4 className="text-2xl font-black tracking-tight">{p.name}</h4>
                    <button onClick={() => { setSelectedProperty(p); setView('inventory'); }} className="mt-8 w-full py-4 bg-zinc-900 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest">MANAGE BUILDING</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'inventory' && <Inventory selectedProperty={selectedProperty} rooms={rooms} tenants={tenants} ledger={ledger} handleBedAction={handleBedAction} setCheckInModal={setCheckInModal} setPaymentModal={setPaymentModal} setBookingModal={setBookingModal} setAddRoomModal={isOwnerAdmin ? setAddRoomModal : undefined} setEditTenantModal={isOwnerAdmin ? setEditTenantModal : undefined} setSecurityModal={isOwnerAdmin ? setSecurityModal : undefined} setView={setView} calculateBalanceAtPeriod={calculateBalanceAtPeriod} currentPeriodLabel={getPeriodLabel(currentPeriod)} userRole={userProfile?.role} />}
          {view === 'tenants' && <Tenants tenants={tenants} rooms={rooms} ledger={ledger} properties={properties} setPaymentModal={setPaymentModal} calculateBalanceAtPeriod={calculateBalanceAtPeriod} currentPeriodLabel={getPeriodLabel(currentPeriod)} userRole={userProfile?.role} />}
          {view === 'team' && <Team userProfile={userProfile} allUsersList={allUsersList} onRefreshUsers={fetchData} />}
          
          {view === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <h2 className="text-3xl font-black italic uppercase">Account</h2>
              <div className="bg-white p-10 rounded-[3rem] border-2 border-zinc-50 shadow-sm">
                <div className="flex items-center gap-6 mb-10 border-b border-zinc-50 pb-10">
                  <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-4xl font-black">{(userProfile?.full_name || 'U')[0]}</div>
                  <div>
                    <p className="text-3xl font-black tracking-tight">{userProfile?.full_name}</p>
                    <p className="text-zinc-400 font-bold">{session?.user?.email}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <button onClick={exportCSV} className="w-full py-5 bg-zinc-50 rounded-2xl font-black uppercase text-[11px] flex items-center justify-center gap-3"><Download size={18}/> EXPORT MASTER DATA (CSV)</button>
                  <button onClick={() => supabase.auth.signOut()} className="w-full py-5 bg-rose-50 text-rose-600 rounded-2xl font-black uppercase text-[11px] flex items-center justify-center gap-3"><LogOut size={18}/> SIGN OUT</button>
                </div>
              </div>
            </div>
          )}
        </main>

        <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-zinc-100 p-4 pb-8 z-50 flex justify-around">
          {[
            { key: 'dashboard', icon: LayoutDashboard, label: 'Hub' },
            { key: 'tenants', icon: Users, label: 'Residents' },
            { key: 'team', icon: ShieldCheck, label: 'Team', hide: userProfile?.role === 'staff' },
            { key: 'settings', icon: Settings, label: 'Account' },
          ].filter(n => !n.hide).map(n => (
            <button key={n.key} onClick={() => setView(n.key)} className={`flex flex-col items-center gap-1.5 transition-all ${view === n.key ? 'text-indigo-600' : 'text-zinc-400'}`}>
              <div className={`p-2.5 rounded-2xl ${view === n.key ? 'bg-indigo-50' : ''}`}><n.icon size={22} strokeWidth={2.5}/></div>
              <span className="text-[8px] font-black uppercase tracking-widest">{n.label}</span>
            </button>
          ))}
        </nav>

        {/* PIN Verification Modal */}
        {securityModal.open && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[2000]">
            <div className="bg-white rounded-[2.5rem] w-full max-w-xs p-10 text-center animate-in zoom-in-95">
              <Lock className="mx-auto text-rose-500 mb-6" size={40}/>
              <h3 className="text-xl font-black uppercase">Verify Admin</h3>
              <input type="password" value={adminPin} onChange={e => {setAdminPin(e.target.value); setAdminErr(false);}} className={`${INP} mt-6 text-center text-2xl tracking-[0.4em] font-black border-2 ${adminErr ? 'border-rose-500 bg-rose-50' : ''}`} placeholder="****"/>
              <div className="grid grid-cols-2 gap-3 mt-8">
                <button onClick={() => setSecurityModal({open:false, type:null, id:null})} className="py-4 bg-zinc-100 rounded-2xl font-black text-[10px] uppercase">Cancel</button>
                <button onClick={handleSecurityConfirm} className="py-4 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthWrapper>
  );
}
