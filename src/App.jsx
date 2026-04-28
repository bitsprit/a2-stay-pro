/**
 * App.jsx — A2 Stay Pro v3.1
 * ══════════════════════════════════════════════════════════════
 * FIXES THIS VERSION:
 * 1. ALL inserts (tenants, ledger, room bookings) now save
 *    `recorded_by: session.user.id` so we know WHICH staff member
 *    performed every action
 * 2. Approval Queue now shows:
 *    - Staff member name who collected/registered (via recorded_by)
 *    - Property name + Room number
 *    - Full financial context
 * 3. Team.jsx now receives `allUsersList` + `onRefreshUsers` so
 *    Super Admin sees all users & Owner sees all their staff
 * 4. isFetching guard replaced with timestamp debounce (no more
 *    permanent freeze if an error occurs)
 * 5. stats.earnings = RENT only (was incorrectly summing all types)
 * 6. Settings page no longer crashes (uses session.user.email)
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
  Bell, Download, Loader2, ClipboardList, User
} from 'lucide-react';

const ADMIN_CODE = 'A2-ADMIN';
const INP = 'w-full bg-zinc-50 border border-zinc-200 px-4 py-3.5 rounded-2xl font-medium text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all placeholder:text-zinc-400';

// ── Accounting Engine (month-specific) ───────────────────────────────────────
function calculateBalanceAtPeriod(tenant, allLedger, periodLabel) {
  if (!tenant?.join_date || !tenant?.agreed_rent) return 0;
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
  { key: 'team',      label: 'Team',     icon: ShieldCheck      },
  { key: 'settings',  label: 'Account',  icon: Settings         },
];

// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [session,      setSession]      = useState(null);
  const [userProfile,  setUserProfile]  = useState(null);
  const [allUsersList, setAllUsersList] = useState([]); // all profiles — for dropdown + Team
  const [viewingAsId,  setViewingAsId]  = useState('GLOBAL');

  const [view, setView] = useState('dashboard');
  const [selectedProperty, _setSelProp] = useState(null);
  const selectedPropertyRef = useRef(null);
  const setSelectedProperty = useCallback((p) => {
    selectedPropertyRef.current = p;
    _setSelProp(p);
  }, []);

  const [properties, setProperties] = useState([]);
  const [rooms,      setRooms]      = useState([]);
  const [tenants,    setTenants]    = useState([]);
  const [ledger,     setLedger]     = useState([]);
  const [loading,    setLoading]    = useState(false);
  const fetchTs = useRef(0); // debounce

  const [currentPeriod, setCurrentPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [stats, setStats] = useState({ earnings: 0, due: 0, advance: 0, security: 0 });

  const [pendingTenants, setPendingTenants] = useState([]);
  const [pendingLedger,  setPendingLedger]  = useState([]);

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

  // ── Fetch all profiles (for SA dropdown + Team) ───────────────────────────
  const fetchAllUsers = useCallback(async () => {
    const { data: allUsers } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, owner_id, brand_name')
      .order('role');
    if (allUsers) {
      const admins = allUsers.filter(u => u.role === 'super_admin');
      const owners = allUsers.filter(u => u.role === 'owner');
      const staff  = allUsers.filter(u => u.role === 'staff');
      const hierarchy = [
        ...admins,
        ...owners.flatMap(o => [o, ...staff.filter(s => s.owner_id === o.id)]),
        ...staff.filter(s => !owners.some(o => o.id === s.owner_id)),
      ];
      setAllUsersList(hierarchy);
    }
  }, []);

  // ── Fetch property/tenant/ledger data ─────────────────────────────────────
  const fetchData = useCallback(async () => {
    const now = Date.now();
    if (now - fetchTs.current < 400) return; // debounce 400ms
    fetchTs.current = now;
    if (!session?.user?.id || !userProfile) return;

    setLoading(true);
    try {
      let targetId  = session.user.id;
      let isGlobal  = false;

      if (userProfile.role === 'super_admin') {
        if (viewingAsId === 'GLOBAL') {
          isGlobal = true;
        } else if (!viewingAsId || viewingAsId === 'SELF') {
          targetId = session.user.id;
        } else {
          const target = allUsersRef.current.find(u => u.id === viewingAsId);
          if (!target) { setLoading(false); return; }
          targetId = target.role === 'staff' ? (target.owner_id || null) : target.id;
          if (!targetId) { setLoading(false); return; }
        }
      } else if (userProfile.role === 'staff') {
        targetId = userProfile.owner_id;
        if (!targetId) { setLoading(false); return; }
      }

      let pQ = supabase.from('properties').select('*');
      let rQ = supabase.from('rooms').select('*').order('room_number');
      let tQ = supabase.from('tenants').select('*');
      let lQ = supabase.from('ledger').select('*').order('created_at', { ascending: false });

      if (!isGlobal) {
        pQ = pQ.eq('owner_id', targetId);
        rQ = rQ.eq('owner_id', targetId);
        tQ = tQ.eq('owner_id', targetId);
        lQ = lQ.eq('owner_id', targetId);
      }

      const [{ data: pD }, { data: rD }, { data: tD }, { data: lD }] = await Promise.all([pQ, rQ, tQ, lQ]);
      const pL = pD||[], rL = rD||[], tL = tD||[], lL = lD||[];

      setProperties(pL); setRooms(rL); setTenants(tL); setLedger(lL);
      setPendingTenants(tL.filter(t => !t.is_verified));
      setPendingLedger(lL.filter(l => !l.is_verified));

      // Stats
      const lbl = getPeriodLabel(currentPeriod);
      const [sM, sY] = lbl.split('-').map(Number);

      // FIX: earnings = RENT only
      const rentLedger = lL.filter(l => l.is_verified && l.payment_type?.toUpperCase() === 'RENT' && (l.billing_month === lbl || l.payment_for_month === lbl));
      const secLedger  = lL.filter(l => l.is_verified && l.payment_type?.toUpperCase() === 'SECURITY' && l.billing_month === lbl);
      const advLedger  = lL.filter(l => {
        if (!l.is_verified || l.payment_type?.toUpperCase() !== 'ADVANCE') return false;
        const d = new Date(l.created_at);
        return d.getMonth() + 1 === sM && d.getFullYear() === sY;
      });
      const totalDue = tL.filter(t => t.is_verified).reduce((s, t) => s + calculateBalanceAtPeriod(t, lL, lbl), 0);

      setStats({
        earnings: rentLedger.reduce((s, c) => s + Number(c.paid_amount||0), 0),
        security: secLedger.reduce((s, c) => s + Number(c.paid_amount||0), 0),
        advance:  advLedger.reduce((s, c) => s + Number(c.paid_amount||0), 0),
        due:      totalDue,
      });
    } catch (e) { console.error('fetchData:', e.message); }
    setLoading(false);
  }, [session, userProfile, viewingAsId, currentPeriod]);

  const fetchProfile = useCallback(async (uid) => {
    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', uid).single();
      if (profile) setUserProfile(profile);
    } catch (e) { console.error('fetchProfile:', e.message); }
  }, []);

  // Auth bootstrap
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s ?? null);
      if (s) { fetchProfile(s.user.id); fetchAllUsers(); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s ?? null);
      if (s) { fetchProfile(s.user.id); fetchAllUsers(); }
      else { setUserProfile(null); setAllUsersList([]); }
    });
    return () => subscription.unsubscribe();
  }, [fetchProfile, fetchAllUsers]);

  useEffect(() => { if (session && userProfile) fetchData(); }, [session, userProfile, viewingAsId, currentPeriod, fetchData]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleVerify = async (type, id) => {
    await supabase.from(type === 'tenant' ? 'tenants' : 'ledger').update({ is_verified: true }).eq('id', id);
    showNotice(type === 'tenant' ? 'Resident approved ✓' : 'Payment verified ✓');
    fetchData();
  };

  const handleBedAction = async (room, action, extra = null) => {
    if (action === 'book') {
      await supabase.from('rooms').update({
        booked_beds: 1, booked_by_name: extra.name, booked_by_phone: extra.phone,
        advance_amount: Number(extra.amount), booking_date: extra.date,
      }).eq('id', room.id);
      // FIX 1: save recorded_by
      await supabase.from('ledger').insert([{
        property_id: room.property_id,
        billing_month: getPeriodLabel(extra.date),
        paid_amount: Number(extra.amount),
        payment_type: 'ADVANCE',
        payment_mode: extra.mode || 'Cash',
        is_verified: true,
        owner_id: room.owner_id,
        recorded_by: session.user.id,
        notes: `Advance for ${extra.name}`,
      }]);
      showNotice('Room reserved');
    } else if (action === 'cancel') {
      await supabase.from('rooms').update({ booked_beds: 0, booked_by_name: null, booked_by_phone: null, advance_amount: 0, booking_date: null }).eq('id', room.id);
      showNotice('Reservation cancelled', 'error');
    } else if (action === 'block') {
      await supabase.from('rooms').update({ status: 'Maintenance' }).eq('id', room.id);
      showNotice('Room marked for maintenance');
    } else if (action === 'unblock') {
      await supabase.from('rooms').update({ status: 'Vacant' }).eq('id', room.id);
      showNotice('Room reopened');
    } else if (action === 'rename' && extra) {
      await supabase.from('rooms').update({ room_number: String(extra) }).eq('id', room.id);
    } else if (action === 'changeType' && extra) {
      await supabase.from('rooms').update({ room_type: extra }).eq('id', room.id);
    }
    fetchData();
  };

  const handleCheckIn = async (e) => {
    e.preventDefault();
    const f       = new FormData(e.target);
    const room    = checkInModal.room;
    const isStaff = userProfile?.role === 'staff';
    const rent    = Number(f.get('t_rent'));
    const sec     = Number(f.get('t_security') || 0);
    const joinDate = f.get('t_join_date');

    const { data: nt, error } = await supabase.from('tenants').insert([{
      full_name:         f.get('t_name'),
      phone_number:      f.get('t_phone'),
      aadhaar_number:    f.get('t_aadhaar'),
      organization_name: f.get('t_org'),
      emergency_number:  f.get('t_emergency'),
      permanent_address: f.get('t_address'),
      property_id:       room.property_id,
      room_id:           room.id,
      agreed_rent:       rent,
      security_deposit:  sec,
      join_date:         joinDate,
      owner_id:          room.owner_id,
      is_verified:       !isStaff,
      recorded_by:       session.user.id,  // FIX 1
    }]).select().single();

    if (error) { showNotice('Error: ' + error.message, 'error'); return; }

    if (nt) {
      const lbl = getPeriodLabel(joinDate);
      const entries = [{
        tenant_id: nt.id, property_id: nt.property_id,
        billing_month: lbl, payment_for_month: lbl,
        paid_amount: rent, is_verified: !isStaff,
        payment_type: 'RENT', payment_mode: f.get('t_pay_mode') || 'Cash',
        owner_id: nt.owner_id,
        recorded_by: session.user.id,  // FIX 1
      }];
      if (sec > 0) entries.push({
        tenant_id: nt.id, property_id: nt.property_id,
        billing_month: lbl, paid_amount: sec,
        is_verified: true, payment_type: 'SECURITY',
        payment_mode: f.get('t_pay_mode') || 'Cash',
        owner_id: nt.owner_id,
        recorded_by: session.user.id,  // FIX 1
      });
      if (room.advance_amount > 0) entries.push({
        tenant_id: nt.id, property_id: nt.property_id,
        billing_month: lbl, payment_for_month: lbl,
        paid_amount: room.advance_amount, is_verified: true,
        payment_type: 'RENT', payment_mode: 'Advance Adjusted',
        owner_id: nt.owner_id,
        recorded_by: session.user.id,
        notes: `Token ₹${room.advance_amount} applied at check-in`,
      });
      await supabase.from('ledger').insert(entries);
      await supabase.from('rooms').update({ booked_beds: 0, booked_by_name: null, booked_by_phone: null, advance_amount: 0, booking_date: null }).eq('id', room.id);
      showNotice(isStaff ? 'Check-in submitted for approval' : 'Resident registered ✓');
      setCheckInModal({ open: false, room: null });
      fetchData();
    }
  };

  const handleEditTenant = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    await supabase.from('tenants').update({
      full_name:         f.get('t_name'),
      phone_number:      f.get('t_phone'),
      agreed_rent:       Number(f.get('t_rent')),
      organization_name: f.get('t_org'),
      emergency_number:  f.get('t_emergency'),
      permanent_address: f.get('t_address'),
    }).eq('id', editTenantModal.tenant.id);
    showNotice('Tenant updated');
    setEditTenantModal({ open: false, tenant: null });
    fetchData();
  };

  const handleSecurityConfirm = async () => {
    if (adminPin !== ADMIN_CODE) { setAdminErr(true); return; }
    const { type, id } = securityModal;
    const table = type === 'tenant' ? 'tenants' : type === 'room' ? 'rooms' : 'properties';
    await supabase.from(table).delete().eq('id', id);
    showNotice(`${type} deleted`, 'error');
    setSecurityModal({ open: false, type: null, id: null });
    setAdminPin(''); setAdminErr(false);
    fetchData();
  };

  const exportCSV = () => {
    const lbl  = getPeriodLabel(currentPeriod);
    const rows = [['Name','Phone','Property','Room','Rent','Balance','Status','Aadhaar']];
    tenants.forEach(t => {
      const room = rooms.find(r => r.id === t.room_id);
      const prop = properties.find(p => p.id === t.property_id);
      const bal  = calculateBalanceAtPeriod(t, ledger, lbl);
      rows.push([t.full_name, t.phone_number, prop?.name||'', room?.room_number||'', t.agreed_rent, bal, bal>0?'DUE':'SETTLED', t.aadhaar_number||'']);
    });
    const a = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(new Blob([rows.map(r=>r.join(',')).join('\n')], {type:'text/csv'})),
      download: `A2Stay_${lbl}.csv`,
    });
    a.click();
    showNotice('CSV exported');
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const isOwnerAdmin = userProfile?.role === 'owner' || userProfile?.role === 'super_admin';
  const lbl          = getPeriodLabel(currentPeriod);
  const totalPending = pendingTenants.length + pendingLedger.length;
  const dueAlerts    = tenants.filter(t => t.is_verified && calculateBalanceAtPeriod(t, ledger, lbl) > 0);

  // Helper: get display name for a user id from allUsersList
  const getUserName = (uid) => {
    if (!uid) return null;
    const u = allUsersList.find(u => u.id === uid);
    return u ? (u.full_name || u.email) : null;
  };

  // ── Approval Queue render (FIX 2: shows staff name) ──────────────────────
  const renderApprovalQueue = () => {
    if (!isOwnerAdmin || totalPending === 0) return null;
    return (
      <div className="mb-6 bg-slate-900 text-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-amber-400"/>
            <h3 className="text-sm font-black uppercase tracking-widest text-amber-400">Needs Approval</h3>
          </div>
          <span className="bg-amber-400/20 text-amber-300 text-[9px] font-black px-3 py-1 rounded-full border border-amber-400/30">
            {totalPending} pending
          </span>
        </div>

        {/* Entries */}
        <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
          {/* Pending tenant registrations */}
          {pendingTenants.map(t => {
            const prop         = properties.find(p => p.id === t.property_id);
            const room         = rooms.find(r => r.id === t.room_id);
            const staffName    = getUserName(t.recorded_by); // FIX 2
            return (
              <div key={t.id} className="bg-white/[0.07] border border-white/10 rounded-xl p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Type badge */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[8px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 rounded-full">New Resident</span>
                      {/* FIX 2: Staff attribution */}
                      {staffName && (
                        <span className="text-[8px] font-bold text-zinc-400 flex items-center gap-1">
                          <User size={8}/> by {staffName}
                        </span>
                      )}
                    </div>
                    {/* Tenant name */}
                    <p className="font-black text-base leading-tight truncate">{t.full_name}</p>
                    {/* Context */}
                    <div className="mt-1 space-y-0.5">
                      <p className="text-[10px] text-zinc-300 font-medium">
                        📍 {prop?.name || '—'} · Room {room?.room_number || '—'}
                      </p>
                      <p className="text-[10px] text-zinc-300 font-medium">
                        💰 Rent ₹{Number(t.agreed_rent).toLocaleString()} · Security ₹{Number(t.security_deposit||0).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-zinc-400">📅 Joined {t.join_date} · {t.phone_number}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button onClick={() => handleVerify('tenant', t.id)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all whitespace-nowrap">
                      Approve ✓
                    </button>
                    <button onClick={() => { setSecurityModal({ open: true, type: 'tenant', id: t.id }); }}
                      className="bg-white/10 hover:bg-rose-500/30 text-zinc-400 hover:text-rose-300 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all whitespace-nowrap">
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pending payments */}
          {pendingLedger.map(l => {
            const tenant    = tenants.find(t => t.id === l.tenant_id);
            const prop      = properties.find(p => p.id === l.property_id);
            const room      = tenant ? rooms.find(r => r.id === tenant.room_id) : null;
            const staffName = getUserName(l.recorded_by); // FIX 2
            return (
              <div key={l.id} className="bg-white/[0.07] border border-white/10 rounded-xl p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Type badge + staff attribution */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border
                        ${l.payment_type?.toUpperCase()==='RENT'     ? 'text-indigo-300 bg-indigo-500/20 border-indigo-500/30' :
                          l.payment_type?.toUpperCase()==='SECURITY' ? 'text-violet-300 bg-violet-500/20 border-violet-500/30' :
                          'text-amber-300 bg-amber-500/20 border-amber-500/30'}`}>
                        {l.payment_type}
                      </span>
                      {/* FIX 2: Staff attribution */}
                      {staffName && (
                        <span className="text-[8px] font-bold text-zinc-400 flex items-center gap-1">
                          <User size={8}/> collected by {staffName}
                        </span>
                      )}
                    </div>
                    {/* Amount */}
                    <p className="font-black text-xl text-emerald-400 leading-tight">
                      ₹{Number(l.paid_amount).toLocaleString()}
                    </p>
                    {/* Context */}
                    <div className="mt-1 space-y-0.5">
                      <p className="text-[10px] text-zinc-300 font-medium">
                        👤 {tenant?.full_name || 'Guest'} · 📍 {prop?.name || '—'}{room ? ` Rm ${room.room_number}` : ''}
                      </p>
                      <p className="text-[10px] text-zinc-300 font-medium">
                        💳 {l.payment_mode} · 📅 {l.billing_month}
                      </p>
                      {l.notes && <p className="text-[9px] text-zinc-500 italic">{l.notes}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button onClick={() => handleVerify('ledger', l.id)}
                      className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all whitespace-nowrap">
                      Verify ✓
                    </button>
                    <button onClick={async () => { await supabase.from('ledger').delete().eq('id', l.id); showNotice('Payment rejected', 'error'); fetchData(); }}
                      className="bg-white/10 hover:bg-rose-500/30 text-zinc-400 hover:text-rose-300 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all whitespace-nowrap">
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AuthWrapper>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-14 right-4 z-[5000] px-5 py-3 rounded-2xl shadow-2xl font-black text-[10px] uppercase tracking-widest border-l-4 animate-in slide-in-from-right duration-200
          ${toast.type === 'error' ? 'bg-rose-600 text-white border-white' : 'bg-zinc-900 text-white border-emerald-400'}`}>
          {toast.msg}
        </div>
      )}

      <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 flex flex-col">

        {/* TOP HEADER */}
        <header className="sticky top-0 z-40 bg-white border-b border-zinc-100 shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 max-w-7xl mx-auto gap-3">

            {/* Brand */}
            <div className="flex items-center gap-2.5 min-w-0 flex-shrink-0">
              <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0">
                <Home size={15}/>
              </div>
              <div className="hidden sm:block min-w-0">
                <p className="text-xs font-black uppercase tracking-tight leading-none truncate">{userProfile?.brand_name || 'A2 Stay Pro'}</p>
                <p className="text-[8px] text-zinc-400 font-bold uppercase capitalize leading-none mt-0.5">{userProfile?.role}</p>
              </div>
            </div>

            {/* SA Impersonation dropdown — desktop */}
            {userProfile?.role === 'super_admin' && (
              <select value={viewingAsId} onChange={e => setViewingAsId(e.target.value)}
                className="hidden md:block bg-zinc-900 text-white text-[9px] font-black py-2 px-3 rounded-xl outline-none cursor-pointer min-w-[200px] max-w-xs flex-shrink-0">
                <option value="GLOBAL">🌍 GLOBAL — All Data</option>
                <option value="SELF">🛡️ MY ADMIN Account</option>
                {allUsersList.filter(u => u.id !== session?.user?.id && u.role !== 'super_admin').length > 0 && (
                  <>
                    <option disabled>──────────</option>
                    {allUsersList.filter(u => u.id !== session?.user?.id && u.role !== 'super_admin').map(u => (
                      <option key={u.id} value={u.id}>
                        {u.role === 'owner'
                          ? `👤 [OWNER] ${u.full_name || u.email}${u.brand_name ? ' — ' + u.brand_name : ''}`
                          : `   ↳ [STAFF] ${u.full_name || u.email}`}
                      </option>
                    ))}
                  </>
                )}
              </select>
            )}

            {/* Right cluster */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Mobile SA dropdown */}
              {userProfile?.role === 'super_admin' && (
                <select value={viewingAsId} onChange={e => setViewingAsId(e.target.value)}
                  className="md:hidden bg-zinc-900 text-white text-[8px] font-black py-1.5 px-2 rounded-lg outline-none cursor-pointer max-w-[120px]">
                  <option value="GLOBAL">🌍 Global</option>
                  <option value="SELF">🛡️ Self</option>
                  {allUsersList.filter(u => u.id !== session?.user?.id && u.role !== 'super_admin').map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              )}

              {/* Period navigator */}
              <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-xl p-0.5">
                <button onClick={() => { const d = new Date(currentPeriod+'-01'); d.setMonth(d.getMonth()-1); setCurrentPeriod(d.toISOString().slice(0,7)); }} className="p-1.5 text-zinc-400 hover:text-zinc-800 transition-all"><ChevronLeft size={13}/></button>
                <span className="px-1.5 text-[9px] font-black uppercase tracking-wide text-zinc-700 min-w-[54px] text-center">{lbl}</span>
                <button onClick={() => { const d = new Date(currentPeriod+'-01'); d.setMonth(d.getMonth()+1); setCurrentPeriod(d.toISOString().slice(0,7)); }} className="p-1.5 text-zinc-400 hover:text-zinc-800 transition-all"><ChevronRight size={13}/></button>
              </div>

              {/* Bell */}
              <button onClick={() => setAlertsOpen(true)} className="relative p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                <Bell size={15} className="text-zinc-500"/>
                {(totalPending + dueAlerts.length) > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[7px] font-black rounded-full flex items-center justify-center">{Math.min(totalPending + dueAlerts.length, 99)}</span>
                )}
              </button>

              {/* Refresh */}
              <button onClick={fetchData} className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                <RefreshCw size={15} className={loading ? 'animate-spin text-indigo-500' : 'text-zinc-500'}/>
              </button>
            </div>
          </div>
        </header>

        {/* MAIN */}
        <main className="flex-1 overflow-y-auto pb-24">
          <div className="max-w-7xl mx-auto px-4 py-5">

            {/* DASHBOARD */}
            {view === 'dashboard' && (
              <div className="animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-5">
                  <div>
                    <h2 className="text-xl font-black tracking-tight">Finance Hub</h2>
                    <p className="text-sm text-zinc-400 font-medium">{new Date(currentPeriod+'-02').toLocaleString('default',{month:'long',year:'numeric'})}</p>
                  </div>
                  <div className="flex gap-2">
                    {isOwnerAdmin && <button onClick={() => setAddPropModal(true)} className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20 hover:bg-indigo-700 active:scale-90 transition-all"><Plus size={17}/></button>}
                    <button onClick={exportCSV} className="p-2.5 bg-white border border-zinc-200 text-zinc-500 rounded-xl hover:bg-zinc-50 active:scale-90 transition-all shadow-sm"><Download size={17}/></button>
                  </div>
                </div>

                {/* FIX 2: Approval queue with staff names */}
                {renderApprovalQueue()}

                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  {[
                    { label:'Collected', sub:'Rent this period', value:stats.earnings, color:'indigo', icon:TrendingUp,
                      onClick: () => setFinanceModal({ open:true, type:'Earnings', data: ledger.filter(l=>l.is_verified&&l.payment_type?.toUpperCase()==='RENT'&&(l.billing_month===lbl||l.payment_for_month===lbl)) }) },
                    { label:'Security',  sub:'Deposits held',   value:stats.security, color:'violet', icon:ShieldCheck,
                      onClick: () => setFinanceModal({ open:true, type:'Security',  data: ledger.filter(l=>l.is_verified&&l.payment_type?.toUpperCase()==='SECURITY'&&l.billing_month===lbl) }) },
                    { label:'Advance',   sub:'Token receipts',  value:stats.advance,  color:'emerald',icon:IndianRupee,
                      onClick: () => { const [sM,sY]=lbl.split('-').map(Number); setFinanceModal({ open:true, type:'Advance', data: ledger.filter(l=>{ const d=new Date(l.created_at); return l.is_verified&&l.payment_type?.toUpperCase()==='ADVANCE'&&d.getMonth()+1===sM&&d.getFullYear()===sY; }) }); } },
                    { label:'Due',       sub:'This period',     value:stats.due,      color:'rose',   icon:AlertTriangle,
                      onClick: () => setFinanceModal({ open:true, type:'Dues', data: tenants.filter(t=>t.is_verified).map(t=>({...t,balance:calculateBalanceAtPeriod(t,ledger,lbl)})).filter(t=>t.balance>0).sort((a,b)=>b.balance-a.balance) }) },
                  ].map(({label,sub,value,color,icon:Icon,onClick}) => {
                    const cc = {
                      indigo:  ['bg-indigo-50',  'text-indigo-500',  'text-indigo-700'],
                      violet:  ['bg-violet-50',  'text-violet-500',  'text-violet-700'],
                      emerald: ['bg-emerald-50', 'text-emerald-500', 'text-emerald-700'],
                      rose:    ['bg-rose-50',    'text-rose-500',    'text-rose-700'],
                    }[color];
                    return (
                      <button key={label} onClick={onClick}
                        className="bg-white border border-zinc-100 rounded-2xl p-4 text-left hover:shadow-lg active:scale-[0.98] transition-all group shadow-sm">
                        <div className={`w-9 h-9 ${cc[0]} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                          <Icon size={15} className={cc[1]}/>
                        </div>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{label}</p>
                        <p className="text-[8px] text-zinc-300 font-semibold">{sub}</p>
                        <p className={`text-xl font-black tracking-tight mt-1 ${cc[2]}`}>₹{value.toLocaleString()}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Properties */}
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-base font-black">Buildings</h3>
                  <span className="text-xs text-zinc-400 font-semibold">{properties.length} total</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {properties.map(p => {
                    const pR  = rooms.filter(r => r.property_id === p.id);
                    const pT  = tenants.filter(t => t.property_id === p.id && t.is_verified);
                    const occ = pR.length > 0 ? Math.round((pT.length / pR.length) * 100) : 0;
                    const pDue= pT.reduce((s,t)=>{ const b=calculateBalanceAtPeriod(t,ledger,lbl); return b>0?s+b:s; },0);
                    return (
                      <div key={p.id} className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-t-2xl"/>
                        {isOwnerAdmin && (
                          <button onClick={e => { e.stopPropagation(); setSecurityModal({ open:true, type:'property', id:p.id }); }}
                            className="absolute top-4 right-4 p-1.5 text-zinc-200 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                            <Trash2 size={14}/>
                          </button>
                        )}
                        <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4"><Building2 size={20} className="text-indigo-500"/></div>
                        <h4 className="text-base font-black tracking-tight">{p.name}</h4>
                        <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5 mb-4 truncate font-medium"><MapPin size={10}/> {p.address}</p>
                        <div className="flex justify-between items-end mb-2">
                          <div className="flex gap-4 text-xs">
                            <div><p className="text-zinc-400 text-[10px]">Rooms</p><p className="font-black text-lg">{pR.length}</p></div>
                            <div><p className="text-zinc-400 text-[10px]">Tenants</p><p className="font-black text-lg">{pT.length}</p></div>
                          </div>
                          <div className="text-right">
                            <p className="text-zinc-400 text-[10px]">Fill</p>
                            <p className={`font-black text-xl ${occ>=80?'text-emerald-500':occ>=50?'text-amber-500':'text-rose-500'}`}>{occ}%</p>
                          </div>
                        </div>
                        <div className="w-full bg-zinc-100 rounded-full h-1 mb-3">
                          <div className={`h-1 rounded-full ${occ>=80?'bg-emerald-400':occ>=50?'bg-amber-400':'bg-rose-400'}`} style={{width:`${occ}%`}}/>
                        </div>
                        {pDue > 0 && (
                          <div className="bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 mb-3 flex items-center gap-1.5">
                            <AlertTriangle size={10} className="text-rose-400 flex-shrink-0"/>
                            <p className="text-[9px] font-black text-rose-600">₹{pDue.toLocaleString()} dues this period</p>
                          </div>
                        )}
                        <button onClick={() => { setSelectedProperty(p); setView('inventory'); }}
                          className="w-full py-3 bg-zinc-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 active:scale-95 transition-all flex items-center justify-center gap-2">
                          Manage <ArrowRight size={13}/>
                        </button>
                      </div>
                    );
                  })}
                  {isOwnerAdmin && (
                    <button onClick={() => setAddPropModal(true)}
                      className="bg-white rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center gap-2 text-zinc-300 hover:border-indigo-300 hover:text-indigo-400 active:scale-[0.98] transition-all min-h-[180px]">
                      <Plus size={24}/><p className="text-[9px] font-black uppercase tracking-widest">Add Building</p>
                    </button>
                  )}
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
              />
            )}

            {/* TEAM — FIX 3: pass allUsersList + onRefreshUsers */}
            {view === 'team' && userProfile?.role !== 'staff' && (
              <Team
                userProfile={userProfile}
                allUsersList={allUsersList}
                onRefreshUsers={fetchAllUsers}
              />
            )}

            {/* SETTINGS */}
            {view === 'settings' && (
              <div className="animate-in fade-in duration-300 space-y-5">
                {!userProfile ? (
                  <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-indigo-400"/></div>
                ) : (
                  <>
                    <h2 className="text-xl font-black tracking-tight">Account</h2>
                    <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center font-black text-white text-xl shadow-lg flex-shrink-0">
                          {(userProfile.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-base truncate">{userProfile.full_name || '—'}</p>
                          {/* FIX: use session.user.email — profiles table may not store email */}
                          <p className="text-xs text-zinc-400 font-medium truncate">{session?.user?.email || '—'}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[8px] font-black uppercase bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100 capitalize">{userProfile.role}</span>
                            {userProfile.brand_name && <span className="text-[8px] font-black uppercase bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">{userProfile.brand_name}</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Platform stats for SA */}
                    {userProfile.role === 'super_admin' && (
                      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-3">Platform Overview</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { label: 'Total Owners', value: allUsersList.filter(u=>u.role==='owner').length },
                            { label: 'Total Staff',  value: allUsersList.filter(u=>u.role==='staff').length },
                            { label: 'Properties',   value: properties.length },
                            { label: 'Residents',    value: tenants.filter(t=>t.is_verified).length },
                          ].map(({label, value}) => (
                            <div key={label} className="bg-white/10 rounded-xl p-3 text-center">
                              <p className="text-xl font-black text-white">{value}</p>
                              <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">{label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick stats for Owner */}
                    {userProfile.role === 'owner' && (
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Properties', value: properties.length },
                          { label: 'Residents',  value: tenants.filter(t=>t.is_verified).length },
                          { label: 'Pending',    value: totalPending },
                        ].map(({label, value}) => (
                          <div key={label} className="bg-white border border-zinc-100 rounded-2xl p-4 text-center shadow-sm">
                            <p className="text-xl font-black">{value}</p>
                            <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">{label}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <button onClick={exportCSV} className="w-full bg-white border border-zinc-100 rounded-2xl p-4 flex items-center gap-3 text-sm font-semibold shadow-sm hover:bg-zinc-50 active:scale-[0.99] transition-all">
                        <Download size={17} className="text-indigo-500"/> Export Tenant Data (CSV)
                      </button>
                      <button onClick={() => supabase.auth.signOut()}
                        className="w-full bg-white border border-zinc-100 rounded-2xl p-4 flex items-center gap-3 text-sm font-semibold text-rose-500 shadow-sm hover:bg-rose-50 hover:border-rose-100 active:scale-[0.99] transition-all">
                        <LogOut size={17}/> Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </main>

        {/* PWA BOTTOM NAV */}
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-zinc-100 shadow-2xl" style={{paddingBottom:'env(safe-area-inset-bottom)'}}>
          <div className="flex items-center justify-around px-2 pt-1.5 pb-2 max-w-md mx-auto">
            {NAV.filter(n => !(n.key === 'team' && userProfile?.role === 'staff')).map(n => {
              const active = view === n.key || (n.key === 'dashboard' && view === 'inventory');
              return (
                <button key={n.key} onClick={() => setView(n.key)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 transition-all active:scale-90 ${active ? 'text-indigo-600' : 'text-zinc-400'}`}>
                  <div className={`relative p-2 rounded-xl ${active ? 'bg-indigo-50' : ''}`}>
                    <n.icon size={20} strokeWidth={active ? 2.5 : 1.8}/>
                    {n.key === 'team' && totalPending > 0 && isOwnerAdmin && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-white text-[7px] font-black rounded-full flex items-center justify-center">{Math.min(totalPending, 9)}</span>
                    )}
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-widest leading-none ${active ? 'text-indigo-600' : 'text-zinc-400'}`}>{n.label}</span>
                </button>
              );
            })}
            <button onClick={() => supabase.auth.signOut()} className="flex-1 flex flex-col items-center gap-0.5 py-1.5 text-rose-400 active:scale-90 transition-all">
              <div className="p-2 rounded-xl"><LogOut size={20} strokeWidth={1.8}/></div>
              <span className="text-[8px] font-black uppercase tracking-widest leading-none">Exit</span>
            </button>
          </div>
        </nav>

        {/* ══ MODALS ══ */}

        {/* Finance Detail */}
        {financeModal.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-end">
            <div className="bg-white h-full w-full max-w-sm shadow-2xl flex flex-col animate-in slide-in-from-right duration-250">
              <div className="flex justify-between items-center px-5 py-4 border-b border-zinc-100 flex-shrink-0">
                <div>
                  <h3 className="text-base font-black">{financeModal.type}</h3>
                  <p className="text-[9px] text-zinc-400 font-semibold uppercase tracking-widest mt-0.5">
                    {financeModal.data.length} entries · ₹{financeModal.data.reduce((s,i)=>s+Number(i.paid_amount||i.balance||0),0).toLocaleString()}
                  </p>
                </div>
                <button onClick={() => setFinanceModal({ open:false, type:'', data:[] })} className="p-2 bg-zinc-100 rounded-xl"><X size={17}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {financeModal.data.length === 0 && <div className="flex flex-col items-center py-14 text-zinc-300"><CheckCircle2 size={32} className="mb-2"/><p className="font-bold text-sm">All clear</p></div>}
                {financeModal.data.map((item, i) => {
                  const t    = tenants.find(t => t.id === item.tenant_id) || item;
                  const prop = properties.find(p => p.id === (t.property_id || item.property_id));
                  const room = rooms.find(r => r.id === t.room_id);
                  const amt  = item.paid_amount || item.balance || 0;
                  const isDue = financeModal.type === 'Dues';
                  return (
                    <div key={i} className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-100 flex justify-between items-center">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="min-w-[44px] h-10 bg-white rounded-xl flex flex-col items-center justify-center shadow-sm border border-zinc-100 px-1 flex-shrink-0">
                          <p className="text-[6px] text-zinc-400 uppercase font-bold truncate w-full text-center">{prop?.name||'—'}</p>
                          <p className="text-xs font-black">{room?.room_number||'—'}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-sm uppercase tracking-tight truncate">{t.full_name || 'Advance'}</p>
                          <p className="text-[8px] text-zinc-400 font-semibold">{item.billing_month || new Date(item.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className={`font-black text-base ${isDue ? 'text-rose-500' : 'text-emerald-600'}`}>₹{Number(amt).toLocaleString()}</p>
                        {isDue && t.phone_number && (
                          <button onClick={() => window.open(`https://wa.me/91${t.phone_number}?text=${encodeURIComponent(`Hi ${t.full_name}, rent due ₹${Number(amt).toLocaleString()} for ${lbl}. - A2 Stay`)}`)}
                            className="p-2 bg-emerald-50 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white active:scale-90 transition-all">
                            <MessageCircle size={13}/>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Check-In Modal */}
        {checkInModal.open && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1500] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[95vh] animate-in zoom-in-95 duration-200">
              <div className="sticky top-0 bg-white flex justify-between items-center px-6 py-4 border-b border-zinc-100 z-10">
                <div><h3 className="text-base font-black">Register Resident</h3><p className="text-xs text-zinc-400 mt-0.5">Room {checkInModal.room?.room_number}</p></div>
                <button onClick={() => setCheckInModal({ open:false, room:null })} className="p-2 bg-zinc-100 rounded-xl active:scale-90"><X size={17}/></button>
              </div>
              <form onSubmit={handleCheckIn} className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Personal Details</p>
                  <input name="t_name" required className={INP} placeholder="Full Name *" defaultValue={checkInModal.room?.booked_by_name||''}/>
                  <div className="grid grid-cols-2 gap-3">
                    <input name="t_phone" required className={INP} placeholder="Mobile *" defaultValue={checkInModal.room?.booked_by_phone||''}/>
                    <input name="t_aadhaar" className={INP} placeholder="Aadhaar"/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input name="t_org" className={INP} placeholder="Company/College"/>
                    <input name="t_emergency" className={INP} placeholder="Emergency No."/>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1 block">Join Date *</label>
                    <input name="t_join_date" type="date" required className={INP} defaultValue={checkInModal.room?.booking_date || new Date().toISOString().split('T')[0]}/>
                  </div>
                  <textarea name="t_address" className={`${INP} h-20 resize-none`} placeholder="Permanent Home Address"/>
                </div>
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Financial Setup</p>
                  {checkInModal.room?.advance_amount > 0 && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Advance Token (auto-adjusted)</p>
                      <p className="text-xl font-black text-indigo-600">₹{checkInModal.room.advance_amount.toLocaleString()}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black uppercase text-rose-400 tracking-widest mb-1 block">Monthly Rent *</label>
                      <input name="t_rent" type="number" required className={`${INP} bg-rose-50 border-rose-200`} placeholder="₹ 0"/>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-violet-400 tracking-widest mb-1 block">Security Deposit</label>
                      <input name="t_security" type="number" defaultValue="0" className={`${INP} bg-violet-50 border-violet-200`} placeholder="₹ 0"/>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1 block">Payment Mode</label>
                    <select name="t_pay_mode" className={INP}><option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Bank Transfer">Bank Transfer</option></select>
                  </div>
                  {userProfile?.role === 'staff' && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2">
                      <ShieldAlert size={12} className="text-amber-500 mt-0.5 flex-shrink-0"/>
                      <p className="text-[9px] text-amber-700 font-medium">Entry pending until Owner approves</p>
                    </div>
                  )}
                  <button type="submit" className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-500/20">
                    Complete Registration ✓
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Booking Modal */}
        {bookingModal.open && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1500] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center px-5 py-4 border-b border-zinc-100">
                <div><h3 className="text-base font-black">Reserve Room</h3><p className="text-xs text-zinc-400 mt-0.5">Room {bookingModal.room?.room_number}</p></div>
                <button onClick={() => setBookingModal({ open:false, room:null })} className="p-2 bg-zinc-100 rounded-xl"><X size={17}/></button>
              </div>
              <form onSubmit={async e => {
                e.preventDefault();
                const f = new FormData(e.target);
                await handleBedAction(bookingModal.room, 'book', { name:f.get('b_n'), phone:f.get('b_p'), amount:f.get('b_a'), date:f.get('b_d'), mode:f.get('b_m') });
                setBookingModal({ open:false, room:null });
              }} className="p-5 space-y-3">
                <input name="b_n" required className={INP} placeholder="Guest Name *"/>
                <input name="b_p" required className={INP} placeholder="Mobile *"/>
                <div className="grid grid-cols-2 gap-3">
                  <input name="b_a" type="number" required className={INP} placeholder="Token ₹ *"/>
                  <select name="b_m" className={INP}><option value="Cash">Cash</option><option value="UPI">UPI</option></select>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1 block">Expected Move-in</label>
                  <input name="b_d" type="date" required className={INP} defaultValue={new Date().toISOString().split('T')[0]}/>
                </div>
                <button type="submit" className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 active:scale-95 transition-all shadow-lg">Confirm Reservation</button>
              </form>
            </div>
          </div>
        )}

        {/* Record Payment Modal */}
        {paymentModal.open && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1500] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center px-5 py-4 border-b border-zinc-100">
                <div><h3 className="text-base font-black">Record Payment</h3><p className="text-xs text-zinc-400 mt-0.5">{paymentModal.tenant?.full_name}</p></div>
                <button onClick={() => setPaymentModal({ open:false, tenant:null })} className="p-2 bg-zinc-100 rounded-xl"><X size={17}/></button>
              </div>
              <form onSubmit={async e => {
                e.preventDefault();
                const f = new FormData(e.target);
                const isStaff = userProfile?.role === 'staff';
                const { error } = await supabase.from('ledger').insert([{
                  tenant_id:       paymentModal.tenant.id,
                  property_id:     paymentModal.tenant.property_id,
                  billing_month:   f.get('billing_month'),
                  payment_for_month: f.get('billing_month'),
                  paid_amount:     Number(f.get('amount')),
                  payment_type:    f.get('payment_type'),
                  payment_mode:    f.get('payment_mode'),
                  notes:           f.get('notes') || null,
                  is_verified:     !isStaff,
                  owner_id:        paymentModal.tenant.owner_id,
                  recorded_by:     session.user.id,  // FIX 1
                }]);
                if (error) { showNotice('Error: '+error.message, 'error'); return; }
                showNotice(isStaff ? 'Submitted for approval' : 'Payment recorded ✓');
                setPaymentModal({ open:false, tenant:null });
                fetchData();
              }} className="p-5 space-y-3">
                {(() => { const b = calculateBalanceAtPeriod(paymentModal.tenant, ledger, lbl); return b > 0 ? (
                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
                    <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">This Month's Due</p>
                    <p className="text-xl font-black text-rose-600">₹{b.toLocaleString()}</p>
                  </div>
                ) : null; })()}
                <input name="amount" type="number" required className={INP} placeholder="Amount Received (₹) *"/>
                <div className="grid grid-cols-2 gap-3">
                  <select name="payment_type" className={INP}><option value="RENT">Rent</option><option value="SECURITY">Security</option><option value="ADVANCE">Advance</option></select>
                  <select name="payment_mode" className={INP}><option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Bank Transfer">Bank Transfer</option></select>
                </div>
                <input name="billing_month" defaultValue={lbl} className={INP} placeholder="MM-YYYY"/>
                <input name="notes" className={INP} placeholder="Notes (optional)"/>
                {userProfile?.role === 'staff' && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-2">
                    <ShieldAlert size={12} className="text-amber-500 flex-shrink-0"/>
                    <p className="text-[9px] text-amber-700 font-medium">Pending owner approval</p>
                  </div>
                )}
                <button type="submit" className="w-full py-3.5 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 active:scale-95 transition-all shadow-lg shadow-emerald-500/20">
                  {userProfile?.role === 'staff' ? 'Submit for Approval' : 'Save Transaction'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Edit Tenant Modal */}
        {editTenantModal.open && editTenantModal.tenant && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1500] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center px-5 py-4 border-b border-zinc-100">
                <h3 className="text-base font-black">Edit Tenant</h3>
                <button onClick={() => setEditTenantModal({ open:false, tenant:null })} className="p-2 bg-zinc-100 rounded-xl"><X size={17}/></button>
              </div>
              <form onSubmit={handleEditTenant} className="p-5 space-y-3">
                <input name="t_name" defaultValue={editTenantModal.tenant.full_name} required className={INP} placeholder="Full Name *"/>
                <input name="t_phone" defaultValue={editTenantModal.tenant.phone_number} required className={INP} placeholder="Mobile *"/>
                <input name="t_rent" type="number" defaultValue={editTenantModal.tenant.agreed_rent} required className={INP} placeholder="Monthly Rent *"/>
                <input name="t_org" defaultValue={editTenantModal.tenant.organization_name} className={INP} placeholder="Organization"/>
                <input name="t_emergency" defaultValue={editTenantModal.tenant.emergency_number} className={INP} placeholder="Emergency No."/>
                <textarea name="t_address" defaultValue={editTenantModal.tenant.permanent_address} className={`${INP} h-20 resize-none`} placeholder="Address"/>
                <button type="submit" className="w-full bg-zinc-900 text-white py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 active:scale-95 transition-all">Save Changes</button>
              </form>
            </div>
          </div>
        )}

        {/* Add Room Modal */}
        {addRoomModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1500] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center px-5 py-4 border-b border-zinc-100">
                <h3 className="text-base font-black">Add Room</h3>
                <button onClick={() => setAddRoomModal(false)} className="p-2 bg-zinc-100 rounded-xl"><X size={17}/></button>
              </div>
              <form onSubmit={async e => {
                e.preventDefault();
                const f = new FormData(e.target);
                await supabase.from('rooms').insert([{ property_id:selectedPropertyRef.current?.id, room_number:f.get('r_num'), room_type:f.get('r_type'), status:'Vacant', owner_id:selectedPropertyRef.current?.owner_id }]);
                showNotice('Room added');
                setAddRoomModal(false); fetchData();
              }} className="p-5 space-y-3">
                <input name="r_num" required className={INP} placeholder="Room Number (e.g. 201)"/>
                <select name="r_type" className={INP}><option value="Single">Single (1 bed)</option><option value="Double">Double (2 beds)</option><option value="Triple">Triple (3 beds)</option></select>
                <button type="submit" className="w-full bg-zinc-900 text-white py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 active:scale-95 transition-all">Add Room</button>
              </form>
            </div>
          </div>
        )}

        {/* Add Property Modal */}
        {addPropModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1500] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center px-5 py-4 border-b border-zinc-100">
                <h3 className="text-base font-black">Setup Building</h3>
                <button onClick={() => setAddPropModal(false)} className="p-2 bg-zinc-100 rounded-xl"><X size={17}/></button>
              </div>
              <form onSubmit={async e => {
                e.preventDefault();
                const f = new FormData(e.target);
                const ownerId = (viewingAsId && viewingAsId !== 'GLOBAL' && viewingAsId !== 'SELF') ? viewingAsId : session.user.id;
                const { data } = await supabase.from('properties').insert([{ name:f.get('p_n'), address:f.get('p_a'), owner_id:ownerId }]).select().single();
                if (data) {
                  const count = Math.min(Number(f.get('p_r')), 100);
                  await supabase.from('rooms').insert(Array.from({length:count}).map((_,i) => ({ property_id:data.id, room_number:(101+i).toString(), room_type:'Double', status:'Vacant', owner_id:ownerId })));
                }
                showNotice('Building created ✓');
                setAddPropModal(false); fetchData();
              }} className="p-5 space-y-3">
                <input name="p_n" required className={INP} placeholder="Building Name (e.g. B-91)"/>
                <input name="p_a" required className={INP} placeholder="Full Address"/>
                <input name="p_r" type="number" min="1" max="100" required className={INP} placeholder="Number of rooms to generate"/>
                <button type="submit" className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 active:scale-95 transition-all shadow-lg">Initialize Building</button>
              </form>
            </div>
          </div>
        )}

        {/* Security / Delete PIN Modal */}
        {securityModal.open && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl animate-in zoom-in-95 duration-200 p-6">
              <div className="text-center mb-5">
                <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center mx-auto mb-3"><Lock size={22} className="text-rose-500"/></div>
                <h3 className="text-base font-black">Admin Verification</h3>
                <p className="text-[9px] text-zinc-400 mt-1 uppercase font-bold">Irreversible — enter code to confirm</p>
              </div>
              <input type="password" value={adminPin} autoFocus
                onChange={e => { setAdminPin(e.target.value); setAdminErr(false); }}
                onKeyDown={e => e.key === 'Enter' && handleSecurityConfirm()}
                className={`${INP} text-center tracking-widest font-black text-base mb-1 ${adminErr ? 'border-rose-400 bg-rose-50' : ''}`}
                placeholder="Admin Code"/>
              {adminErr && <p className="text-rose-500 text-[9px] font-bold text-center uppercase mb-2">Invalid code</p>}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button onClick={() => { setSecurityModal({ open:false, type:null, id:null }); setAdminPin(''); setAdminErr(false); }}
                  className="py-3 bg-zinc-100 rounded-2xl font-black text-[10px] uppercase hover:bg-zinc-200 active:scale-95 transition-all">Cancel</button>
                <button onClick={handleSecurityConfirm}
                  className="py-3 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase hover:bg-rose-600 active:scale-95 transition-all shadow-lg">Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Alerts Panel */}
        {alertsOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1500] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
              <div className="flex justify-between items-center px-5 py-4 border-b border-zinc-100 flex-shrink-0">
                <h3 className="text-base font-black">Alerts & Notices</h3>
                <button onClick={() => setAlertsOpen(false)} className="p-2 bg-zinc-100 rounded-xl"><X size={17}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {totalPending > 0 && isOwnerAdmin && (
                  <button onClick={() => { setAlertsOpen(false); setView('dashboard'); }}
                    className="w-full flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl text-left hover:bg-amber-100 active:scale-[0.99] transition-all">
                    <ShieldAlert size={16} className="text-amber-500 flex-shrink-0"/>
                    <div>
                      <p className="font-black text-sm text-amber-800">{totalPending} action{totalPending!==1?'s':''} need approval</p>
                      <p className="text-[9px] text-amber-600 font-semibold">Tap to review on Dashboard</p>
                    </div>
                  </button>
                )}
                {dueAlerts.slice(0, 15).map((t, i) => (
                  <div key={i} className="flex items-center gap-3 p-3.5 bg-rose-50 border border-rose-100 rounded-xl">
                    <AlertTriangle size={13} className="text-rose-500 flex-shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm truncate">{t.full_name}</p>
                      <p className="text-[9px] text-rose-600 font-semibold">₹{calculateBalanceAtPeriod(t,ledger,lbl).toLocaleString()} due · {lbl}</p>
                    </div>
                    <button onClick={() => window.open(`https://wa.me/91${t.phone_number}?text=${encodeURIComponent(`Hi ${t.full_name}, rent due ₹${calculateBalanceAtPeriod(t,ledger,lbl).toLocaleString()} for ${lbl}. Please pay. - A2 Stay`)}`)}
                      className="p-2 bg-white text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white active:scale-90 transition-all flex-shrink-0">
                      <MessageCircle size={13}/>
                    </button>
                  </div>
                ))}
                {totalPending === 0 && dueAlerts.length === 0 && (
                  <div className="flex flex-col items-center py-12 text-zinc-300"><CheckCircle2 size={32} className="mb-2"/><p className="font-bold text-sm">All clear!</p></div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </AuthWrapper>
  );
}