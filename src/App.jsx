/**
 * App.jsx — A2 Stay Pro v5.5 (Final Consolidated Build)
 * ══════════════════════════════════════════════════════════════
 * FIXES:
 * 1. Restores all Modal Handlers (Payment, Check-in, Verify, Delete)
 * 2. Restores Financial Hub click logic
 * 3. Restores Tenant Portal & Maintenance Routing
 * 4. Fixes "Blank Screen" with robust loading guards
 * 5. Handles Tailwind Production classes via Color Map
 * ══════════════════════════════════════════════════════════════
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import AuthWrapper from './AuthWrapper';
import Inventory   from './Inventory';
import Tenants     from './Tenants';
import Team        from './Team';
import MaintenancePanel from './MaintenancePanel';
import TenantPortal     from './TenantPortal';
import {
  X, ShieldAlert, ShieldCheck, Building2, MapPin, LayoutDashboard,
  RefreshCw, Users, Plus, MessageCircle, ChevronLeft, ChevronRight,
  Trash2, Edit3, Wallet, ArrowRight, Lock, CheckCircle2,
  TrendingUp, AlertTriangle, IndianRupee, Home, LogOut, Settings,
  Bell, Download, Loader2, ClipboardList, User, Wrench, Clock
} from 'lucide-react';

const ADMIN_CODE = 'A2-ADMIN';
const INP = 'w-full bg-zinc-50 border border-zinc-200 px-4 py-3.5 rounded-2xl font-medium text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all placeholder:text-zinc-400 text-zinc-900';

const colorMap = {
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600', border: 'border-indigo-100', icon: 'text-indigo-500' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',   border: 'border-rose-100',   icon: 'text-rose-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', icon: 'text-emerald-500' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-100',  icon: 'text-violet-500' }
};

// --- CORE ACCOUNTING ENGINE ---
function calculateBalanceAtPeriod(tenant, ledger, periodLabel) {
  if (!tenant?.join_date || !tenant?.agreed_rent || !tenant.is_active) return 0;
  const rent = Number(tenant.agreed_rent);
  const joinDate = new Date(tenant.join_date);
  const [m, y] = periodLabel.split('-').map(Number);
  const periodStart = new Date(y, m - 1, 1);
  if (periodStart < new Date(joinDate.getFullYear(), joinDate.getMonth(), 1)) return 0;

  const paid = (ledger || [])
    .filter(l => l.tenant_id === tenant.id && l.is_verified && !l.is_rejected && 
            l.payment_type?.toUpperCase() === 'RENT' && 
            (l.payment_for_month === periodLabel || l.billing_month === periodLabel))
    .reduce((sum, l) => sum + Number(l.paid_amount || 0), 0);
  return Math.max(rent - paid, 0);
}

const getPeriodLabel = (dateStr) => {
  const [y, m] = dateStr.split('-');
  return `${m}-${y}`;
};

export default function App() {
  // --- CORE STATE ---
  const [session,      setSession]      = useState(null);
  const [userProfile,  setUserProfile]  = useState(null);
  const [allUsersList, setAllUsersList] = useState([]);
  const [viewingAsId,  setViewingAsId]  = useState('GLOBAL');
  const [view,         setView]         = useState('dashboard');
  const [loading,      setLoading]      = useState(true);
  const [notificationsSeen, setNotificationsSeen] = useState(false);

  const [properties,   setProperties]   = useState([]);
  const [rooms,        setRooms]        = useState([]);
  const [tenants,      setTenants]      = useState([]);
  const [ledger,       setLedger]       = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [currentPeriod, setCurrentPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [stats, setStats] = useState({ earnings: 0, due: 0, advance: 0, security: 0 });
  const [pendingTenants, setPendingTenants] = useState([]);
  const [pendingLedger,  setPendingLedger]  = useState([]);

  // --- MODAL STATE ---
  const [paymentModal,    setPaymentModal]    = useState({ open: false, tenant: null });
  const [checkInModal,    setCheckInModal]    = useState({ open: false, room: null });
  const [bookingModal,    setBookingModal]    = useState({ open: false, room: null });
  const [securityModal,   setSecurityModal]   = useState({ open: false, type: null, id: null });
  const [addPropModal,    setAddPropModal]    = useState(false);
  const [addRoomModal,    setAddRoomModal]    = useState(false);
  const [editTenantModal, setEditTenantModal] = useState({ open: false, tenant: null });
  const [financeModal,    setFinanceModal]    = useState({ open: false, type: '', data: [] });
  const [alertsOpen,      setAlertsOpen]      = useState(false);
  const [adminPin,        setAdminPin]        = useState('');
  const [adminErr,        setAdminErr]        = useState(false);
  const [toast,           setToast]           = useState(null);

  const showNotice = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // --- DATA FETCHING ---
  const fetchData = useCallback(async (userId, profile) => {
    if (!userId || !profile || profile.role === 'tenant') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let targetId = profile.role === 'staff' ? profile.owner_id : (viewingAsId === 'GLOBAL' || viewingAsId === 'SELF' ? userId : viewingAsId);
      const matchQuery = profile.role === 'super_admin' && viewingAsId === 'GLOBAL' ? {} : { owner_id: targetId };

      const [pRes, rRes, tRes, lRes, uRes] = await Promise.all([
        supabase.from('properties').select('*').match(matchQuery),
        supabase.from('rooms').select('*').match(matchQuery).order('room_number'),
        supabase.from('tenants').select('*').match(matchQuery).eq('is_active', true),
        supabase.from('ledger').select('*').match(matchQuery).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*')
      ]);

      const pL = pRes.data || []; const rL = rRes.data || []; const tL = tRes.data || []; const lL = lRes.data || [];
      
      setProperties(pL); setRooms(rL); setTenants(tL); setLedger(lL); setAllUsersList(uRes.data || []);
      setPendingTenants(tL.filter(t => !t.is_verified));
      setPendingLedger(lL.filter(l => !l.is_verified && !l.is_rejected));

      const lbl = getPeriodLabel(currentPeriod);
      const [sM, sY] = lbl.split('-').map(Number);
      const verifiedLedger = lL.filter(l => l.is_verified && !l.is_rejected);

      setStats({
        earnings: verifiedLedger.filter(l => l.payment_type === 'RENT' && (l.billing_month === lbl || l.payment_for_month === lbl)).reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        security: verifiedLedger.filter(l => l.payment_type === 'SECURITY').reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        advance: verifiedLedger.filter(l => {
          const d = new Date(l.created_at);
          return l.payment_type === 'ADVANCE' && d.getMonth() + 1 === sM && d.getFullYear() === sY;
        }).reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        due: tL.filter(t => t.is_verified && t.is_active).reduce((s, t) => s + calculateBalanceAtPeriod(t, lL, lbl), 0)
      });
    } catch (e) { console.error("Fetch Error:", e); }
    setLoading(false);
  }, [viewingAsId, currentPeriod]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) {
        supabase.from('profiles').select('*').eq('id', s.user.id).single()
          .then(({ data: profile }) => {
            setUserProfile(profile);
            fetchData(s.user.id, profile);
          });
      }
    });
  }, [fetchData]);

  // --- HANDLERS ---
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
    fetchData(session.user.id, userProfile);
  };

  const handleCheckIn = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const room = checkInModal.room;
    const isStaff = userProfile?.role === 'staff';

    const { data: nt, error } = await supabase.from('tenants').insert([{
      full_name: f.get('t_name'), phone_number: f.get('t_phone'), aadhaar_number: f.get('t_aadhaar'),
      property_id: room.property_id, room_id: room.id, agreed_rent: Number(f.get('t_rent')),
      security_deposit: Number(f.get('t_security') || 0), join_date: f.get('t_join_date'),
      owner_id: room.owner_id, is_verified: !isStaff, recorded_by: session.user.id, is_active: true
    }]).select().single();

    if (nt) {
      const lbl = getPeriodLabel(f.get('t_join_date'));
      const entries = [{
        tenant_id: nt.id, property_id: nt.property_id, billing_month: lbl, payment_for_month: lbl,
        paid_amount: Number(f.get('t_rent')), is_verified: !isStaff, payment_type: 'RENT', 
        payment_mode: f.get('t_pay_mode') || 'Cash', owner_id: nt.owner_id, recorded_by: session.user.id
      }];
      await supabase.from('ledger').insert(entries);
      await supabase.from('rooms').update({ booked_beds: 0, booked_by_name: null }).eq('id', room.id);
      showNotice(isStaff ? 'Sent for Approval' : 'Check-in Complete');
      setCheckInModal({ open: false, room: null });
      fetchData(session.user.id, userProfile);
    } else if (error) showNotice(error.message, "error");
  };

  const handleBedAction = async (room, action, extra = null) => {
    const { error } = await supabase.from('rooms').update(
      action === 'rename' ? { room_number: String(extra) } :
      action === 'changeType' ? { room_type: extra } :
      action === 'block' ? { status: 'Maintenance' } : { status: 'Vacant' }
    ).eq('id', room.id);
    if (!error) fetchData(session.user.id, userProfile);
  };

  const handleVerify = async (type, id) => {
    await supabase.from(type === 'tenant' ? 'tenants' : 'ledger').update({ is_verified: true }).eq('id', id);
    showNotice("Verified ✓");
    fetchData(session.user.id, userProfile);
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
    fetchData(session.user.id, userProfile);
  };

  const exportCSV = () => {
    try {
      const rows = tenants.map(t => ({ Name: t.full_name, Phone: t.phone_number, Rent: t.agreed_rent }));
      if (!rows.length) return showNotice("No data", "error");
      const csv = [Object.keys(rows[0]).join(','), ...rows.map(r => Object.values(r).join(','))].join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = `A2Stay_Data.csv`; a.click();
    } catch (e) { showNotice("Export failed", "error"); }
  };

  // --- RENDER LOGIC ---
  if (userProfile?.role === 'tenant') return <AuthWrapper><TenantPortal session={session} /></AuthWrapper>;
  if (loading && !userProfile) return <div className="h-screen flex items-center justify-center font-black text-zinc-400 animate-pulse">A2 STAY PRO SYNCING...</div>;

  const isOwnerAdmin = userProfile?.role === 'owner' || userProfile?.role === 'super_admin';
  const totalPending = pendingTenants.length + pendingLedger.length;
  const dueAlerts = tenants.filter(t => t.is_verified && calculateBalanceAtPeriod(t, ledger, getPeriodLabel(currentPeriod)) > 0);

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-white text-zinc-900 flex flex-col">
        {toast && <div className={`fixed top-14 right-4 z-[5000] px-5 py-3 rounded-2xl shadow-2xl font-black text-[10px] uppercase tracking-widest border-l-4 animate-in slide-in-from-right ${toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-zinc-900 text-white border-emerald-400'}`}>{toast.msg}</div>}

        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-100 px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white"><Home size={16}/></div>
            <h1 className="font-black text-sm uppercase">{userProfile?.brand_name || 'A2 Stay'}</h1>
          </div>
          <div className="flex items-center gap-2">
            {userProfile?.role === 'super_admin' && (
              <select value={viewingAsId} onChange={e => setViewingAsId(e.target.value)} className="bg-zinc-900 text-white text-[9px] font-black px-3 py-2 rounded-xl outline-none"><option value="GLOBAL">GLOBAL</option>{allUsersList.filter(u => u.role === 'owner').map(u => <option key={u.id} value={u.id}>👤 {u.full_name}</option>)}</select>
            )}
            <button onClick={() => { setAlertsOpen(true); setNotificationsSeen(true); }} className="relative p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl">
              <Bell size={16} className="text-zinc-500"/>
              {!notificationsSeen && (totalPending + dueAlerts.length) > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[7px] font-black rounded-full flex items-center justify-center">{totalPending + dueAlerts.length}</span>}
            </button>
            <button onClick={() => fetchData(session.user.id, userProfile)} className="p-2 bg-zinc-50 border border-zinc-200 rounded-xl"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/></button>
          </div>
        </header>

        <main className="flex-1 p-4 pb-32 max-w-7xl mx-auto w-full">
          {view === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black italic uppercase">Finance Hub</h2>
                {isOwnerAdmin && <button onClick={() => setAddPropModal(true)} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/30 active:scale-90 transition-all"><Plus/></button>}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Collected', value: stats.earnings, color: 'indigo', icon: TrendingUp, type: 'Earnings' },
                  { label: 'Dues', value: stats.due, color: 'rose', icon: AlertTriangle, type: 'Dues' },
                  { label: 'Advance', value: stats.advance, color: 'emerald', icon: IndianRupee, type: 'Advance' },
                  { label: 'Security', value: stats.security, color: 'violet', icon: ShieldCheck, type: 'Security' },
                ].map((s, i) => {
                  const c = colorMap[s.color];
                  const lbl = getPeriodLabel(currentPeriod);
                  return (
                    <button key={i} onClick={() => {
                        const data = s.type === 'Dues' 
                            ? tenants.filter(t => t.is_verified && t.is_active).map(t => ({...t, balance: calculateBalanceAtPeriod(t, ledger, lbl)})).filter(t => t.balance > 0)
                            : ledger.filter(l => l.is_verified && l.payment_type === s.type.toUpperCase());
                        setFinanceModal({ open: true, type: s.label, data });
                    }} className={`p-6 rounded-[2.5rem] ${c.bg} border ${c.border} shadow-sm text-left active:scale-95 transition-all`}>
                      <div className={`w-10 h-10 bg-white rounded-2xl flex items-center justify-center mb-4 ${c.icon} shadow-sm`}><s.icon size={20}/></div>
                      <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">{s.label}</p>
                      <p className={`text-2xl font-black ${c.text} mt-1`}>₹{s.value.toLocaleString()}</p>
                    </button>
                  );
                })}
              </div>

              {isOwnerAdmin && totalPending > 0 && (
                <div className="bg-zinc-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                  <div className="flex items-center gap-3 mb-6"><ClipboardList className="text-amber-400" size={20}/><h3 className="text-sm font-black uppercase tracking-widest text-amber-400">Needs Approval</h3></div>
                  <div className="space-y-4 max-h-60 overflow-y-auto">
                    {pendingTenants.map(t => (
                      <div key={t.id} className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                        <div><p className="font-black text-sm">{t.full_name}</p><p className="text-[9px] text-zinc-400 uppercase mt-1">Check-in • {new Date(t.created_at).toLocaleTimeString()}</p></div>
                        <button onClick={() => handleVerify('tenant', t.id)} className="bg-emerald-500 px-4 py-2 rounded-xl text-[9px] font-black">APPROVE</button>
                      </div>
                    ))}
                    {pendingLedger.map(l => (
                      <div key={l.id} className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                        <div><p className="font-black text-sm text-emerald-400">₹{l.paid_amount}</p><p className="text-[9px] text-zinc-400 uppercase mt-1">{l.payment_type} Verification</p></div>
                        <button onClick={() => handleVerify('ledger', l.id)} className="bg-indigo-500 px-4 py-2 rounded-xl text-[9px] font-black">VERIFY</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map(p => (
                  <div key={p.id} className="bg-white border-2 border-zinc-50 rounded-[3rem] p-10 shadow-sm hover:shadow-lg transition-all">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6"><Building2 size={28}/></div>
                    <h4 className="text-2xl font-black tracking-tight">{p.name}</h4>
                    <button onClick={() => { setSelectedProperty(p); setView('inventory'); }} className="mt-8 w-full py-4 bg-zinc-900 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest active:scale-95">MANAGE BUILDING</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'inventory' && <Inventory selectedProperty={selectedProperty} rooms={rooms} tenants={tenants} ledger={ledger} handleBedAction={handleBedAction} setCheckInModal={setCheckInModal} setPaymentModal={setPaymentModal} setBookingModal={setBookingModal} setAddRoomModal={isOwnerAdmin ? setAddRoomModal : undefined} setEditTenantModal={isOwnerAdmin ? setEditTenantModal : undefined} setSecurityModal={isOwnerAdmin ? setSecurityModal : undefined} setView={setView} calculateBalanceAtPeriod={calculateBalanceAtPeriod} currentPeriodLabel={getPeriodLabel(currentPeriod)} userRole={userProfile?.role} />}
          {view === 'tenants' && <Tenants tenants={tenants} rooms={rooms} ledger={ledger} properties={properties} setPaymentModal={setPaymentModal} setSecurityModal={setSecurityModal} setEditTenantModal={setEditTenantModal} calculateBalanceAtPeriod={calculateBalanceAtPeriod} currentPeriodLabel={getPeriodLabel(currentPeriod)} userRole={userProfile?.role} />}
          {view === 'maintenance' && <MaintenancePanel userProfile={userProfile} properties={properties} rooms={rooms} tenants={tenants} />}
          {view === 'team' && <Team userProfile={userProfile} allUsersList={allUsersList} onRefreshUsers={() => fetchData(session.user.id, userProfile)} />}
          
          {view === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in">
              <h2 className="text-3xl font-black italic uppercase">Account</h2>
              <div className="bg-white p-10 rounded-[3rem] border shadow-sm">
                <div className="flex items-center gap-6 mb-10 border-b pb-10">
                  <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-3xl font-black">{(userProfile?.full_name || 'U')[0]}</div>
                  <div><p className="text-2xl font-black">{userProfile?.full_name}</p><p className="text-zinc-400">{session?.user?.email}</p></div>
                </div>
                <button onClick={exportCSV} className="w-full py-5 bg-zinc-50 rounded-2xl font-black uppercase text-[11px] flex items-center justify-center gap-3"><Download size={18}/> EXPORT DATA (CSV)</button>
                <button onClick={() => supabase.auth.signOut()} className="w-full py-5 mt-4 bg-rose-50 text-rose-600 rounded-2xl font-black uppercase text-[11px] flex items-center justify-center gap-3"><LogOut size={18}/> SIGN OUT</button>
              </div>
            </div>
          )}
        </main>

        <nav className="fixed bottom-0 inset-x-0 bg-white border-t p-4 pb-8 z-50 flex justify-around shadow-2xl">
          {[
            { key: 'dashboard', icon: LayoutDashboard, label: 'Hub' },
            { key: 'tenants', icon: Users, label: 'Residents' },
            { key: 'maintenance', icon: Wrench, label: 'Service' },
            { key: 'team', icon: ShieldCheck, label: 'Team', hide: userProfile?.role === 'staff' },
            { key: 'settings', icon: Settings, label: 'Account' },
          ].filter(n => !n.hide).map(n => (
            <button key={n.key} onClick={() => setView(n.key)} className={`flex flex-col items-center gap-1.5 transition-all active:scale-75 ${view === n.key ? 'text-indigo-600' : 'text-zinc-400'}`}>
              <div className={`p-2.5 rounded-2xl ${view === n.key ? 'bg-indigo-50' : ''}`}><n.icon size={22} strokeWidth={2.5}/></div>
              <span className="text-[8px] font-black uppercase tracking-widest">{n.label}</span>
            </button>
          ))}
        </nav>

        {/* MODAL COMPONENTS (RESTORED) */}
        {paymentModal.open && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl animate-in zoom-in-95">
              <div className="p-8 border-b flex justify-between items-center">
                <h3 className="text-xl font-black uppercase">Collect Rent</h3>
                <button onClick={() => setPaymentModal({open:false, tenant:null})} className="p-2 bg-zinc-100 rounded-xl"><X size={18}/></button>
              </div>
              <form onSubmit={handleRecordPayment} className="p-8 space-y-4">
                <input name="amount" type="number" required className={INP} placeholder="Payment Amount (₹) *"/>
                <div className="grid grid-cols-2 gap-3">
                  <select name="payment_type" className={INP}><option value="RENT">Rent</option><option value="SECURITY">Security</option><option value="ADVANCE">Advance</option></select>
                  <select name="payment_mode" className={INP}><option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Bank">Bank</option></select>
                </div>
                <input name="billing_month" defaultValue={getPeriodLabel(currentPeriod)} className={INP} placeholder="MM-YYYY"/>
                <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Save Transaction</button>
              </form>
            </div>
          </div>
        )}

        {checkInModal.open && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
              <div className="p-8 border-b flex justify-between items-center sticky top-0 bg-white">
                <h3 className="text-xl font-black uppercase">Resident Check-In</h3>
                <button onClick={() => setCheckInModal({open:false, room:null})} className="p-2 bg-zinc-100 rounded-xl"><X size={18}/></button>
              </div>
              <form onSubmit={handleCheckIn} className="p-8 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input name="t_name" required className={INP} placeholder="Full Name *"/>
                    <input name="t_phone" required className={INP} placeholder="Mobile *"/>
                    <input name="t_aadhaar" className={INP} placeholder="Aadhaar No."/>
                    <input name="t_rent" type="number" required className={INP} placeholder="Agreed Rent *"/>
                    <input name="t_security" type="number" className={INP} placeholder="Security Deposit"/>
                    <input name="t_join_date" type="date" required className={INP} defaultValue={new Date().toISOString().split('T')[0]}/>
                </div>
                <button type="submit" className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Complete Registration</button>
              </form>
            </div>
          </div>
        )}

        {financeModal.open && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-end">
            <div className="bg-white h-full w-full max-w-md shadow-2xl flex flex-col animate-in slide-in-from-right">
              <div className="p-8 border-b flex justify-between items-center">
                <h3 className="text-xl font-black uppercase">{financeModal.type} Overview</h3>
                <button onClick={() => setFinanceModal({open:false, data:[]})} className="p-2 bg-zinc-100 rounded-xl"><X size={18}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {financeModal.data.map((item, i) => (
                  <div key={i} className="p-4 bg-zinc-50 rounded-2xl border flex justify-between items-center">
                    <div>
                        <p className="font-black text-sm uppercase">{item.full_name || 'Payment'}</p>
                        <p className="text-[10px] text-zinc-400 font-bold">{item.billing_month || item.payment_type}</p>
                    </div>
                    <p className="font-black text-emerald-600">₹{item.paid_amount || item.balance}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {securityModal.open && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-xs p-10 text-center animate-in zoom-in-95">
              <Lock className="mx-auto text-rose-500 mb-6" size={40}/>
              <h3 className="text-xl font-black uppercase">Verify Admin PIN</h3>
              <input type="password" value={adminPin} onChange={e => {setAdminPin(e.target.value); setAdminErr(false);}} className={`${INP} mt-6 text-center text-2xl tracking-[0.4em] font-black border-2 ${adminErr ? 'border-rose-500 bg-rose-50' : ''}`} placeholder="****"/>
              <div className="grid grid-cols-2 gap-3 mt-8">
                <button onClick={() => setSecurityModal({open:false, type:null, id:null})} className="py-4 bg-zinc-100 rounded-2xl font-black text-[10px] uppercase">Cancel</button>
                <button onClick={handleSecurityConfirm} className="py-4 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">Confirm Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthWrapper>
  );
}
