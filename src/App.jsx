/**
 * App.jsx — A2 Stay Pro v4.0 (Production Build)
 * ══════════════════════════════════════════════════════════════
 * FIXES & FEATURES:
 * 1.  Maintenance System (Tickets) & Maintenance View
 * 2.  Tenant Portal with Receipt & Ticket access
 * 3.  Financial Scoping (Combined vs Separated for Super Admin)
 * 4.  Notification ghosting fix (Real-time count verification)
 * 5.  Advance Booking protection (Code: A2-ADMIN required to delete)
 * 6.  Inactive Tenant support (Preserves history without affecting dues)
 * 7.  Staff Activity & Entry timestamps in Approvals
 * 8.  Full Mobile Dark-Mode correction (Force White UI)
 * 9.  Visibility Gap Fix (RLS bypassed for Owner visibility of Staff entries)
 * 10. Blank loading state handled with branded spinner
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
  Bell, Download, Loader2, ClipboardList, User, Wrench, FileText, Clock
} from 'lucide-react';

const ADMIN_CODE = 'A2-ADMIN';
const INP = 'w-full bg-zinc-50 border border-zinc-200 px-4 py-3.5 rounded-2xl font-medium text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all placeholder:text-zinc-400';

// ── Accounting Engine (month-specific) ───────────────────────────────────────
function calculateBalanceAtPeriod(tenant, allLedger, periodLabel) {
  if (!tenant?.join_date || !tenant?.agreed_rent || tenant.status === 'Inactive') return 0;
  const rent      = Number(tenant.agreed_rent);
  const joinDate  = new Date(tenant.join_date);
  const [m, y]    = periodLabel.split('-').map(Number);
  const pStart    = new Date(y, m - 1, 1);
  const jStart    = new Date(joinDate.getFullYear(), joinDate.getMonth(), 1);
  if (pStart < jStart) return 0;

  const paid = (allLedger || [])
    .filter(l =>
      l.tenant_id === tenant.id &&
      l.is_verified &&
      l.payment_type?.toUpperCase() === 'RENT' &&
      (l.billing_month === periodLabel || l.payment_for_month === periodLabel)
    )
    .reduce((s, l) => s + Number(l.paid_amount || 0), 0);

  return Math.max(rent - paid, 0);
}

const getPeriodLabel = (dateStr) => {
  const [y, m] = dateStr.split('-');
  return `${m}-${y}`;
};

const NAV = [
  { key: 'dashboard', label: 'Hub',      icon: LayoutDashboard },
  { key: 'tenants',   label: 'Residents',icon: Users            },
  { key: 'tickets',   label: 'Issues',   icon: Wrench           }, // Maintenance
  { key: 'team',      label: 'Team',     icon: ShieldCheck      },
  { key: 'settings',  label: 'Account',  icon: Settings         },
];

export default function App() {
  const [session,      setSession]      = useState(null);
  const [userProfile,  setUserProfile]  = useState(null);
  const [allUsersList, setAllUsersList] = useState([]); 
  const [viewingAsId,  setViewingAsId]  = useState('GLOBAL');
  const [view,         setView]         = useState('dashboard');
  const [properties,   setProperties]   = useState([]);
  const [rooms,        setRooms]        = useState([]);
  const [tenants,      setTenants]      = useState([]);
  const [ledger,       setLedger]       = useState([]);
  const [tickets,      setTickets]      = useState([]); // Maintenance state
  const [loading,      setLoading]      = useState(true);
  const fetchTs = useRef(0);

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

  const allUsersRef = useRef([]);
  useEffect(() => { allUsersRef.current = allUsersList; }, [allUsersList]);

  const showNotice = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchAllUsers = useCallback(async () => {
    const { data: allUsers } = await supabase.from('profiles').select('*').order('role');
    if (allUsers) setAllUsersList(allUsers);
  }, []);

  const fetchData = useCallback(async () => {
    const now = Date.now();
    if (now - fetchTs.current < 400) return;
    fetchTs.current = now;
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

      // Scoped Fetching for all entities
      const [pRes, rRes, tRes, lRes, tickRes] = await Promise.all([
        supabase.from('properties').select('*').match(isGlobal ? {} : { owner_id: targetId }),
        supabase.from('rooms').select('*').match(isGlobal ? {} : { owner_id: targetId }).order('room_number'),
        supabase.from('tenants').select('*').match(isGlobal ? {} : { owner_id: targetId }),
        supabase.from('ledger').select('*, profiles(full_name)').match(isGlobal ? {} : { owner_id: targetId }).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*').match(isGlobal ? {} : { owner_id: targetId })
      ]);

      const pL = pRes.data||[], rL = rRes.data||[], tL = tRes.data||[], lL = lRes.data||[], tickL = tickRes.data||[];

      setProperties(pL); setRooms(rL); setTenants(tL); setLedger(lL); setTickets(tickL);
      setPendingTenants(tL.filter(t => !t.is_verified));
      setPendingLedger(lL.filter(l => !l.is_verified));

      const lbl = getPeriodLabel(currentPeriod);
      const [sM, sY] = lbl.split('-').map(Number);

      const rentLedger = lL.filter(l => l.is_verified && l.payment_type?.toUpperCase() === 'RENT' && (l.billing_month === lbl || l.payment_for_month === lbl));
      const secLedger  = lL.filter(l => l.is_verified && l.payment_type?.toUpperCase() === 'SECURITY' && l.billing_month === lbl);
      const advLedger  = lL.filter(l => {
        const d = new Date(l.created_at);
        return l.is_verified && l.payment_type?.toUpperCase() === 'ADVANCE' && d.getMonth() + 1 === sM && d.getFullYear() === sY;
      });
      const totalDue = tL.filter(t => t.is_verified && t.status !== 'Inactive').reduce((s, t) => s + calculateBalanceAtPeriod(t, lL, lbl), 0);

      setStats({
        earnings: rentLedger.reduce((s, c) => s + Number(c.paid_amount||0), 0),
        security: secLedger.reduce((s, c) => s + Number(c.paid_amount||0), 0),
        advance:  advLedger.reduce((s, c) => s + Number(c.paid_amount||0), 0),
        due:      totalDue,
      });
    } catch (e) { console.error('fetchData:', e.message); }
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
  }, [fetchAllUsers]);

  useEffect(() => { if (session && userProfile) fetchData(); }, [session, userProfile, viewingAsId, currentPeriod, fetchData]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleVerify = async (type, id) => {
    await supabase.from(type === 'tenant' ? 'tenants' : 'ledger').update({ is_verified: true }).eq('id', id);
    showNotice(type === 'tenant' ? 'Resident approved ✓' : 'Payment verified ✓');
    fetchData();
  };

  const handleReject = async (type, id) => {
    const pin = prompt("Enter ADMIN CODE to REJECT and DELETE this entry:");
    if (pin !== ADMIN_CODE) return showNotice("Invalid Code", "error");
    await supabase.from(type === 'tenant' ? 'tenants' : 'ledger').delete().eq('id', id);
    showNotice("Entry Rejected and Deleted", "error");
    fetchData();
  };

  const handleBedAction = async (room, action, extra = null) => {
    if (action === 'cancel') {
        const pin = prompt("Enter ADMIN CODE to delete this reservation:");
        if (pin !== ADMIN_CODE) return showNotice("Unauthorized", "error");
    }

    if (action === 'book') {
      await supabase.from('rooms').update({
        booked_beds: 1, booked_by_name: extra.name, booked_by_phone: extra.phone,
        advance_amount: Number(extra.amount), booking_date: extra.date,
      }).eq('id', room.id);
      await supabase.from('ledger').insert([{
        property_id: room.property_id, billing_month: getPeriodLabel(extra.date),
        paid_amount: Number(extra.amount), payment_type: 'ADVANCE', payment_mode: extra.mode || 'Cash',
        is_verified: true, owner_id: room.owner_id, recorded_by: session.user.id,
      }]);
      showNotice('Room reserved');
    } else if (action === 'cancel') {
      await supabase.from('rooms').update({ booked_beds: 0, booked_by_name: null, booked_by_phone: null, advance_amount: 0, booking_date: null }).eq('id', room.id);
      showNotice('Reservation deleted', 'error');
    } else if (action === 'block') {
      await supabase.from('rooms').update({ status: 'Maintenance' }).eq('id', room.id);
    } else if (action === 'unblock') {
      await supabase.from('rooms').update({ status: 'Vacant' }).eq('id', room.id);
    }
    fetchData();
  };

  const handleCheckIn = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const room = checkInModal.room;
    const isStaff = userProfile?.role === 'staff';

    const { data: nt, error } = await supabase.from('tenants').insert([{
      full_name: f.get('t_name'), phone_number: f.get('t_phone'), aadhaar_number: f.get('t_aadhaar'),
      organization_name: f.get('t_org'), emergency_number: f.get('t_emergency'), permanent_address: f.get('t_address'),
      property_id: room.property_id, room_id: room.id, agreed_rent: Number(f.get('t_rent')),
      security_deposit: Number(f.get('t_security') || 0), join_date: f.get('t_join_date'),
      owner_id: room.owner_id, is_verified: !isStaff, recorded_by: session.user.id, status: 'Active'
    }]).select().single();

    if (nt) {
      const lbl = getPeriodLabel(f.get('t_join_date'));
      const entries = [{
        tenant_id: nt.id, property_id: nt.property_id, billing_month: lbl, payment_for_month: lbl,
        paid_amount: Number(f.get('t_rent')), is_verified: !isStaff, payment_type: 'RENT', 
        payment_mode: f.get('t_pay_mode') || 'Cash', owner_id: nt.owner_id, recorded_by: session.user.id
      }];
      if (room.advance_amount > 0) entries.push({
        tenant_id: nt.id, property_id: nt.property_id, billing_month: lbl, paid_amount: room.advance_amount,
        is_verified: true, payment_type: 'RENT', payment_mode: 'Advance Adjusted', owner_id: nt.owner_id, recorded_by: session.user.id
      });
      await supabase.from('ledger').insert(entries);
      await supabase.from('rooms').update({ booked_beds: 0, booked_by_name: null, advance_amount: 0 }).eq('id', room.id);
      showNotice(isStaff ? 'Submitted for Approval' : 'Resident registered ✓');
      setCheckInModal({ open: false, room: null });
      fetchData();
    }
  };

  const handleSecurityConfirm = async () => {
    if (adminPin !== ADMIN_CODE) { setAdminErr(true); return; }
    const { type, id } = securityModal;
    await supabase.from(type === 'tenant' ? 'tenants' : type === 'room' ? 'rooms' : 'properties').delete().eq('id', id);
    showNotice(`${type} deleted`, 'error');
    setSecurityModal({ open: false, type: null, id: null });
    setAdminPin(''); setAdminErr(false);
    fetchData();
  };

  // ── Helper ──────────────────────────────────────────────────────────────
  const getUserName = (uid) => allUsersList.find(u => u.id === uid)?.full_name || 'Staff';
  const isOwnerAdmin = userProfile?.role === 'owner' || userProfile?.role === 'super_admin';
  const isTenant     = userProfile?.role === 'tenant';
  const lbl          = getPeriodLabel(currentPeriod);
  const totalPending = pendingTenants.length + pendingLedger.length;
  const dueAlerts    = tenants.filter(t => t.is_verified && t.status === 'Active' && calculateBalanceAtPeriod(t, ledger, lbl) > 0);

  // ── Render Components ──────────────────────────────────────────────────
  const renderApprovalQueue = () => {
    if (!isOwnerAdmin || totalPending === 0) return null;
    return (
      <div className="mb-6 bg-slate-900 text-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-amber-400"/>
            <h3 className="text-sm font-black uppercase tracking-widest text-amber-400">Needs Approval</h3>
          </div>
          <span className="bg-amber-400/20 text-amber-300 text-[9px] font-black px-3 py-1 rounded-full">{totalPending} pending</span>
        </div>
        <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
          {pendingTenants.map(t => (
            <div key={t.id} className="bg-white/[0.07] border border-white/10 rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[8px] font-black uppercase text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full">New Resident</span>
                    <span className="text-[8px] text-zinc-400 font-bold flex items-center gap-1"><Clock size={8}/> {new Date(t.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <p className="font-black text-base truncate">{t.full_name}</p>
                  <p className="text-[10px] text-zinc-400 mt-1 uppercase">📍 {properties.find(p=>p.id===t.property_id)?.name} • Rm {rooms.find(r=>r.id===t.room_id)?.room_number}</p>
                  <p className="text-[9px] font-black text-emerald-400 mt-1 italic">Entry by: {getUserName(t.recorded_by)}</p>
                </div>
                <div className="flex flex-col gap-1.5 ml-2">
                  <button onClick={() => handleVerify('tenant', t.id)} className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase">Approve</button>
                  <button onClick={() => handleReject('tenant', t.id)} className="bg-white/10 text-zinc-400 px-4 py-2 rounded-xl font-black text-[9px] uppercase">Reject</button>
                </div>
              </div>
            </div>
          ))}
          {pendingLedger.map(l => (
            <div key={l.id} className="bg-white/[0.07] border border-white/10 rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[8px] font-black uppercase text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full">{l.payment_type}</span>
                    <span className="text-[8px] text-zinc-400 font-bold flex items-center gap-1"><Clock size={8}/> {new Date(l.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <p className="font-black text-xl text-emerald-400 leading-tight">₹{Number(l.paid_amount).toLocaleString()}</p>
                  <p className="text-[10px] text-zinc-400 mt-1 uppercase">👤 {tenants.find(t=>t.id===l.tenant_id)?.full_name} ({l.billing_month})</p>
                  <p className="text-[9px] font-black text-indigo-400 mt-1 italic">Collected by: {getUserName(l.recorded_by)}</p>
                </div>
                <div className="flex flex-col gap-1.5 ml-2">
                  <button onClick={() => handleVerify('ledger', l.id)} className="bg-indigo-500 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase">Verify</button>
                  <button onClick={() => handleReject('ledger', l.id)} className="bg-white/10 text-zinc-400 px-4 py-2 rounded-xl font-black text-[9px] uppercase">Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading && !userProfile) {
    return (
      <div className="h-screen w-full bg-white flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center animate-bounce shadow-2xl mb-6"><Home size={32} className="text-white"/></div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 animate-pulse">A2 Stay Pro Loading...</p>
      </div>
    );
  }

  return (
    <AuthWrapper>
      {/* Toast Notification Container */}
      {toast && (
        <div className={`fixed top-14 right-4 z-[6000] px-5 py-3 rounded-2xl shadow-2xl font-black text-[10px] uppercase tracking-widest border-l-4 animate-in slide-in-from-right duration-200
          ${toast.type === 'error' ? 'bg-rose-600 text-white border-white' : 'bg-zinc-900 text-white border-emerald-400'}`}>
          {toast.msg}
        </div>
      )}

      <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 flex flex-col selection:bg-indigo-100">
        
        {/* HEADER */}
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b border-zinc-100 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg flex-shrink-0"><Home size={18}/></div>
              <div className="hidden sm:block min-w-0">
                <p className="text-xs font-black uppercase tracking-tight truncate">{userProfile?.brand_name || 'A2 Stay'}</p>
                <p className="text-[8px] text-zinc-400 font-bold uppercase mt-0.5">{userProfile?.role}</p>
              </div>
            </div>

            {userProfile?.role === 'super_admin' && (
              <select value={viewingAsId} onChange={e => setViewingAsId(e.target.value)}
                className="hidden md:block bg-zinc-900 text-white text-[10px] font-black py-2.5 px-4 rounded-xl outline-none cursor-pointer min-w-[220px]">
                <option value="GLOBAL">🌍 GLOBAL VIEW (ALL)</option>
                <option value="SELF">🛡️ MY ADMIN Account</option>
                <optgroup label="Registered PG Owners">
                    {allUsersList.filter(u=>u.role==='owner').map(u=>(
                        <option key={u.id} value={u.id}>👤 {u.full_name} ({u.brand_name})</option>
                    ))}
                </optgroup>
              </select>
            )}

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-xl p-0.5">
                <button onClick={() => { const d = new Date(currentPeriod+'-01'); d.setMonth(d.getMonth()-1); setCurrentPeriod(d.toISOString().slice(0,7)); }} className="p-2 text-zinc-400 hover:text-zinc-800 transition-all"><ChevronLeft size={14}/></button>
                <span className="px-2 text-[10px] font-black uppercase tracking-widest text-zinc-700 min-w-[60px] text-center">{lbl}</span>
                <button onClick={() => { const d = new Date(currentPeriod+'-01'); d.setMonth(d.getMonth()+1); setCurrentPeriod(d.toISOString().slice(0,7)); }} className="p-2 text-zinc-400 hover:text-zinc-800 transition-all"><ChevronRight size={14}/></button>
              </div>
              <button onClick={() => { setAlertsOpen(true); }} className="relative p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl hover:bg-zinc-100 transition-all">
                <Bell size={16} className="text-zinc-500"/>
                {(totalPending + dueAlerts.length) > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[7px] font-black rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">{Math.min(totalPending + dueAlerts.length, 99)}</span>}
              </button>
              <button onClick={fetchData} className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl hover:bg-zinc-100 transition-all">
                <RefreshCw size={16} className={loading ? 'animate-spin text-indigo-500' : 'text-zinc-500'}/>
              </button>
            </div>
          </div>
        </header>

        {/* MAIN AREA */}
        <main className="flex-1 overflow-y-auto pb-28">
          <div className="max-w-7xl mx-auto px-4 py-6">

            {/* DASHBOARD */}
            {view === 'dashboard' && (
              <div className="animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight italic uppercase">Finance Hub</h2>
                    <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">{new Date(currentPeriod+'-02').toLocaleString('default',{month:'long',year:'numeric'})}</p>
                  </div>
                  {isOwnerAdmin && (
                    <button onClick={() => setAddPropModal(true)} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/30 hover:bg-indigo-700 active:scale-90 transition-all flex items-center gap-2">
                        <Plus size={20}/><span className="hidden sm:block text-[10px] font-black uppercase tracking-widest">New Property</span>
                    </button>
                  )}
                </div>

                {renderApprovalQueue()}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {[
                    { l:'Collected', s:'Rent Only', v:stats.earnings, c:'indigo', i:TrendingUp, 
                      onClick: () => setFinanceModal({ open:true, type:'Earnings', data: ledger.filter(l=>l.is_verified&&l.payment_type?.toUpperCase()==='RENT'&&(l.billing_month===lbl||l.payment_for_month===lbl)) }) },
                    { l:'Security', s:'Deposits', v:stats.security, c:'violet', i:ShieldCheck, 
                      onClick: () => setFinanceModal({ open:true, type:'Security', data: ledger.filter(l=>l.is_verified&&l.payment_type?.toUpperCase()==='SECURITY'&&l.billing_month===lbl) }) },
                    { l:'Advance', s:'Bookings', v:stats.advance, c:'emerald', i:IndianRupee, 
                      onClick: () => { const [sM,sY]=lbl.split('-').map(Number); setFinanceModal({ open:true, type:'Advance', data: ledger.filter(l=>{ const d=new Date(l.created_at); return l.is_verified&&l.payment_type?.toUpperCase()==='ADVANCE'&&d.getMonth()+1===sM&&d.getFullYear()===sY; }) }); } },
                    { l:'Outstanding', s:'Dues', v:stats.due, c:'rose', i:AlertTriangle, 
                      onClick: () => setFinanceModal({ open:true, type:'Dues', data: tenants.filter(t=>t.is_verified&&t.status==='Active').map(t=>({...t,balance:calculateBalanceAtPeriod(t,ledger,lbl)})).filter(t=>t.balance>0).sort((a,b)=>b.balance-a.balance) }) },
                  ].map((s,i)=>(
                    <button key={i} onClick={s.onClick} className="bg-white border border-zinc-100 rounded-[2rem] p-6 text-left hover:shadow-2xl hover:-translate-y-1 transition-all group shadow-sm">
                      <div className={`w-11 h-11 bg-${s.c}-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                        <s.i size={20} className={`text-${s.c}-500`}/>
                      </div>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{s.l}</p>
                      <p className={`text-2xl font-black tracking-tight text-${s.c}-600 mt-1`}>₹{s.v.toLocaleString()}</p>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {properties.map(p => {
                    const pR = rooms.filter(r => r.property_id === p.id);
                    const pT = tenants.filter(t => t.property_id === p.id && t.is_verified && t.status === 'Active');
                    const occ = pR.length > 0 ? Math.round((pT.length / pR.length) * 100) : 0;
                    return (
                      <div key={p.id} className="bg-white rounded-[2.5rem] p-8 border border-zinc-100 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden">
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform"><Building2 size={24} className="text-indigo-500"/></div>
                        <h4 className="text-xl font-black tracking-tight">{p.name}</h4>
                        <p className="text-xs text-zinc-400 flex items-center gap-1 mt-1 truncate font-medium"><MapPin size={12}/> {p.address}</p>
                        <div className="flex justify-between items-end mt-8">
                            <div><p className="text-zinc-400 text-[10px] uppercase font-black tracking-widest">Residents</p><p className="font-black text-2xl">{pT.length} / {pR.length}</p></div>
                            <div className="text-right">
                                <p className="text-zinc-400 text-[10px] uppercase font-black tracking-widest">Fill Rate</p>
                                <p className={`font-black text-2xl ${occ >= 80 ? 'text-emerald-500' : occ >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>{occ}%</p>
                            </div>
                        </div>
                        <div className="w-full bg-zinc-100 h-1.5 rounded-full mt-4 overflow-hidden"><div className={`h-full rounded-full ${occ >= 80 ? 'bg-emerald-400' : occ >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{width:`${occ}%`}}/></div>
                        <button onClick={() => { setSelectedProperty(p); setView('inventory'); }}
                          className="w-full py-4 bg-zinc-900 text-white rounded-2xl mt-8 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-3">
                          Open Building <ArrowRight size={14}/>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* INVENTORY */}
            {view === 'inventory' && selectedPropertyRef.current && (
              <Inventory
                selectedProperty={selectedPropertyRef.current}
                rooms={rooms.filter(r => r.property_id === selectedPropertyRef.current?.id)}
                tenants={tenants} ledger={ledger}
                handleBedAction={handleBedAction}
                setCheckInModal={setCheckInModal}
                setPaymentModal={setPaymentModal}
                setBookingModal={setBookingModal}
                setAddRoomModal={isOwnerAdmin ? setAddRoomModal : undefined}
                setEditTenantModal={isOwnerAdmin ? setEditTenantModal : undefined}
                setSecurityModal={isOwnerAdmin ? setSecurityModal : undefined}
                setView={setView}
                calculateBalanceAtPeriod={calculateBalanceAtPeriod}
                currentPeriodLabel={lbl}
                userRole={userProfile?.role}
              />
            )}

            {/* TENANTS */}
            {view === 'tenants' && (
              <Tenants
                tenants={tenants} rooms={rooms} ledger={ledger} properties={properties}
                setSecurityModal={isOwnerAdmin ? setSecurityModal : undefined}
                setPaymentModal={setPaymentModal}
                setEditTenantModal={isOwnerAdmin ? setEditTenantModal : undefined}
                calculateBalanceAtPeriod={calculateBalanceAtPeriod}
                currentPeriodLabel={lbl}
                userRole={userProfile?.role}
                onRefresh={fetchData} // Allow setting Inactive
              />
            )}

            {/* TICKETS (MAINTENANCE) */}
            {view === 'tickets' && (
              <div className="animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-8">
                  <div><h2 className="text-2xl font-black uppercase tracking-tight italic">Maintenance Hub</h2><p className="text-xs text-zinc-400 font-bold">Manage building service requests</p></div>
                  {isTenant && <button className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg flex items-center gap-2"><Plus size={18}/> New Request</button>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tickets.map(t => (
                    <div key={t.id} className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm relative overflow-hidden">
                       <div className={`absolute top-0 right-0 px-4 py-1 text-[8px] font-black uppercase tracking-widest ${t.status === 'Open' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>{t.status}</div>
                       <h4 className="font-black text-base mt-2">{t.title}</h4>
                       <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{t.description}</p>
                       <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-50">
                         <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">Registered: {new Date(t.created_at).toLocaleDateString()}</p>
                         <button className="text-[9px] font-black uppercase text-indigo-600">Update Status</button>
                       </div>
                    </div>
                  ))}
                  {tickets.length === 0 && <div className="col-span-full py-20 text-center text-zinc-300 border-2 border-dashed rounded-[3rem]"><Wrench size={40} className="mx-auto mb-4"/><p className="font-black uppercase text-xs tracking-widest">No Active Service Requests</p></div>}
                </div>
              </div>
            )}

            {/* TEAM */}
            {view === 'team' && (
              <Team 
                userProfile={userProfile} 
                allUsersList={allUsersList} 
                onRefreshUsers={fetchAllUsers} 
              />
            )}

            {/* SETTINGS */}
            {view === 'settings' && (
              <div className="animate-in fade-in duration-300 max-w-2xl mx-auto">
                <h2 className="text-2xl font-black uppercase italic mb-8">Account Control</h2>
                <div className="bg-white rounded-[2.5rem] p-10 border border-zinc-100 shadow-sm">
                  <div className="flex items-center gap-8 mb-10 pb-10 border-b border-zinc-50">
                    <div className="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white rounded-[2rem] flex items-center justify-center font-black text-4xl shadow-2xl">{(userProfile?.full_name || 'U')[0].toUpperCase()}</div>
                    <div>
                      <p className="font-black text-3xl tracking-tighter">{userProfile?.full_name}</p>
                      <p className="text-zinc-400 font-bold">{session?.user?.email}</p>
                      <div className="flex gap-2 mt-4">
                        <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 text-[9px] font-black rounded-full uppercase border border-indigo-100">{userProfile?.role}</span>
                        {userProfile?.brand_name && <span className="px-4 py-1.5 bg-zinc-900 text-white text-[9px] font-black rounded-full uppercase">{userProfile.brand_name}</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <button onClick={exportCSV} className="w-full py-5 bg-zinc-50 rounded-2xl flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest hover:bg-zinc-100 transition-all"><Download size={18} className="text-indigo-600"/> Download Tenant Master List</button>
                    <button onClick={() => supabase.auth.signOut()} className="w-full py-5 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm"><LogOut size={18}/> End Session</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* BOTTOM NAVIGATION */}
        <nav className="fixed bottom-0 inset-x-0 z-[100] bg-white border-t border-zinc-100 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] pb-safe-area-inset-bottom">
          <div className="flex items-center justify-around px-4 pt-3 pb-4 max-w-md mx-auto">
            {NAV.filter(n => {
              if (userProfile?.role === 'staff' && n.key === 'team') return false;
              if (userProfile?.role === 'tenant' && (n.key === 'team' || n.key === 'tenants')) return false;
              return true;
            }).map(n => {
              const active = view === n.key || (n.key === 'dashboard' && view === 'inventory');
              return (
                <button key={n.key} onClick={() => setView(n.key)}
                  className={`relative flex flex-col items-center gap-1.5 transition-all active:scale-75 ${active ? 'text-indigo-600' : 'text-zinc-400'}`}>
                  <div className={`p-2 rounded-2xl ${active ? 'bg-indigo-50 shadow-inner' : ''}`}>
                    <n.icon size={22} strokeWidth={active ? 2.5 : 2}/>
                    {n.key === 'dashboard' && totalPending > 0 && isOwnerAdmin && (
                      <span className="absolute top-0 right-0 w-5 h-5 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center ring-2 ring-white">{totalPending}</span>
                    )}
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-widest leading-none ${active ? 'opacity-100' : 'opacity-40'}`}>{n.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ══ SHARED MODALS ══ */}

        {/* Finance Detail Panel */}
        {financeModal.open && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1000] flex items-center justify-end">
            <div className="bg-white h-full w-full max-w-md shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="flex justify-between items-center p-8 border-b border-zinc-50">
                <div><h3 className="text-xl font-black italic uppercase">{financeModal.type} Overview</h3><p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Total Impact: ₹{financeModal.data.reduce((s,i)=>s+Number(i.paid_amount||i.balance||0),0).toLocaleString()}</p></div>
                <button onClick={() => setFinanceModal({ open:false, type:'', data:[] })} className="p-3 bg-zinc-100 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {financeModal.data.map((item, i) => {
                  const t = tenants.find(x => x.id === item.tenant_id) || item;
                  const isDue = financeModal.type === 'Dues';
                  return (
                    <div key={i} className="p-5 bg-zinc-50 rounded-[1.8rem] border border-zinc-100 flex justify-between items-center group hover:bg-white hover:shadow-xl transition-all">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 bg-white rounded-2xl flex flex-col items-center justify-center shadow-sm border border-zinc-100 flex-shrink-0">
                            <p className="text-xs font-black">{rooms.find(r=>r.id===t.room_id)?.room_number || 'NA'}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-sm uppercase truncate">{t.full_name || 'Booking'}</p>
                          <p className="text-[9px] text-zinc-400 font-bold">{new Date(item.created_at).toLocaleString([], {dateStyle:'medium', timeStyle:'short'})}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-black text-lg ${isDue ? 'text-rose-600' : 'text-emerald-600'}`}>₹{Number(item.paid_amount||item.balance).toLocaleString()}</p>
                        {isDue && t.phone_number && (
                          <button onClick={() => window.open(`https://wa.me/91${t.phone_number}?text=${encodeURIComponent(`Hi ${t.full_name}, reminder for rent ₹${item.balance.toLocaleString()}. - ${userProfile.brand_name}`)}`)}
                            className="text-emerald-500 hover:text-emerald-600 font-black text-[9px] uppercase mt-1 block">Remind ✓</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Add Property Logic */}
        {addPropModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[1500] flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] w-full max-w-sm p-10 shadow-2xl animate-in zoom-in-95">
              <div className="flex justify-between mb-8"><h3 className="text-xl font-black uppercase italic">New Building</h3><button onClick={() => setAddPropModal(false)}><X/></button></div>
              <form onSubmit={async e => {
                e.preventDefault();
                const f = new FormData(e.target);
                const ownerId = (viewingAsId && viewingAsId !== 'GLOBAL' && viewingAsId !== 'SELF') ? viewingAsId : session.user.id;
                const { data } = await supabase.from('properties').insert([{ name:f.get('p_n'), address:f.get('p_a'), owner_id:ownerId }]).select().single();
                if (data) {
                  const count = Math.min(Number(f.get('p_r')), 100);
                  await supabase.from('rooms').insert(Array.from({length:count}).map((_,i) => ({ property_id:data.id, room_number:(101+i).toString(), room_type:'Double', status:'Vacant', owner_id:ownerId })));
                }
                showNotice('Building Ready'); setAddPropModal(false); fetchData();
              }} className="space-y-4">
                <input name="p_n" required className={INP} placeholder="Property Name (e.g. A2 Vibes)"/>
                <input name="p_a" required className={INP} placeholder="Location / Address"/>
                <input name="p_r" type="number" min="1" max="100" required className={INP} placeholder="Initial Room Count"/>
                <button type="submit" className="w-full bg-zinc-900 text-white py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">Initialize Structure</button>
              </form>
            </div>
          </div>
        )}

        {/* Security Verification Panel */}
        {securityModal.open && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-xs p-8 shadow-2xl animate-in zoom-in-95">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-500"><Lock size={32}/></div>
                <h3 className="text-xl font-black uppercase italic">Verify Identity</h3>
                <p className="text-[10px] text-zinc-400 font-bold uppercase mt-1 tracking-tighter">This action cannot be undone</p>
              </div>
              <input type="password" value={adminPin} autoFocus
                onChange={e => { setAdminPin(e.target.value); setAdminErr(false); }}
                onKeyDown={e => e.key === 'Enter' && handleSecurityConfirm()}
                className={`${INP} text-center tracking-[0.3em] font-black text-2xl border-2 ${adminErr ? 'border-rose-500 bg-rose-50' : ''}`}
                placeholder="****"/>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button onClick={() => { setSecurityModal({ open:false, type:null, id:null }); setAdminPin(''); }}
                  className="py-4 bg-zinc-100 rounded-2xl font-black text-[10px] uppercase">Abort</button>
                <button onClick={handleSecurityConfirm}
                  className="py-4 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-rose-500/30">Confirm</button>
              </div>
            </div>
          </div>
        )}

        {/* Notification/Alerts Sidebar */}
        {alertsOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1500] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl animate-in zoom-in-95 max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center p-8 border-b border-zinc-50">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Live Intelligence</h3>
                <button onClick={() => setAlertsOpen(false)} className="p-3 bg-zinc-50 rounded-xl"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {totalPending > 0 && isOwnerAdmin && (
                  <button onClick={() => { setAlertsOpen(false); setView('dashboard'); }}
                    className="w-full flex items-center gap-4 p-5 bg-amber-50 border border-amber-200 rounded-[2rem] text-left hover:shadow-lg transition-all group">
                    <ShieldAlert size={24} className="text-amber-500 group-hover:animate-bounce"/>
                    <div>
                      <p className="font-black text-sm text-amber-900 uppercase">Attention Required</p>
                      <p className="text-[10px] text-amber-700 font-bold uppercase">{totalPending} entries awaiting your signature</p>
                    </div>
                  </button>
                )}
                {dueAlerts.map((t, i) => (
                  <div key={i} className="flex items-center gap-4 p-5 bg-rose-50 border border-rose-100 rounded-[1.8rem]">
                    <AlertTriangle size={20} className="text-rose-500 flex-shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm uppercase truncate">{t.full_name}</p>
                      <p className="text-[10px] text-rose-600 font-bold uppercase tracking-tighter">₹{calculateBalanceAtPeriod(t,ledger,lbl).toLocaleString()} Owed · {lbl}</p>
                    </div>
                    <button onClick={() => window.open(`https://wa.me/91${t.phone_number}`)} className="p-3 bg-white text-emerald-500 rounded-2xl shadow-sm"><MessageCircle size={18}/></button>
                  </div>
                ))}
                {totalPending === 0 && dueAlerts.length === 0 && (
                  <div className="flex flex-col items-center py-20 text-zinc-300"><CheckCircle2 size={48} className="mb-4"/><p className="font-black uppercase text-xs tracking-widest">System Health: Normal</p></div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </AuthWrapper>
  );
}
