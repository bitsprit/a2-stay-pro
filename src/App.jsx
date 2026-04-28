/**

 * App.jsx — A2 Stay Pro v4.0 (Enhanced Production Build)

 * ══════════════════════════════════════════════════════════════

 * FIXES & UPGRADES:

 * 1.  Fixed Accounting Engine (March Tenant & Advance Logic)

 * 2.  Staff Activity Logging System

 * 3.  Booking Security (Locked with Admin Code)

 * 4.  Notification Badge Sync (Clears on click)

 * 5.  Mobile Dark-Mode Override (Force White UI)

 * 6.  Inactive Tenant System (Preserve records)

 * 7.  Super Admin Multi-Owner Financial View

 * 8.  Maintenance Request Architecture

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

  Bell, Download, Loader2, ClipboardList, User, Wrench, Clock

} from 'lucide-react';



const ADMIN_CODE = 'A2-ADMIN';

const INP = 'w-full bg-zinc-50 border border-zinc-200 px-4 py-3.5 rounded-2xl font-medium text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all placeholder:text-zinc-400 text-zinc-900';



// 🔥 FIX 1: UPGRADED ACCOUNTING ENGINE

function calculateBalanceAtPeriod(tenant, ledger, periodLabel) {

  if (!tenant?.join_date || !tenant?.agreed_rent || !tenant.is_active) return 0;



  const rent = Number(tenant.agreed_rent);

  const joinDate = new Date(tenant.join_date);

  const [m, y] = periodLabel.split('-').map(Number);

  const periodStart = new Date(y, m - 1, 1);



  // Don't show dues for months before the tenant joined

  if (periodStart < new Date(joinDate.getFullYear(), joinDate.getMonth(), 1)) return 0;



  const paid = (ledger || [])

    .filter(l =>

      l.tenant_id === tenant.id &&

      l.is_verified &&

      !l.is_rejected &&

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
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Data States - Always initialized as empty arrays to prevent crashes
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [session,      setSession]      = useState(null);

  const [userProfile,  setUserProfile]  = useState(null);

const [allUsersList, setAllUsersList] = useState([]);

  // Fetch Logic
  const [viewingAsId,  setViewingAsId]  = useState('GLOBAL');

  const [view,         setView]         = useState('dashboard');

  const [loading,      setLoading]      = useState(true);

  const [notificationsSeen, setNotificationsSeen] = useState(false);



  // DATA STATES

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



  // MODAL STATES

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



  // Staff Action Logger

  const logActivity = async (action, metadata = {}) => {

    await supabase.from('activity_logs').insert([{

      user_id: session?.user?.id,

      action,

      metadata,

      created_at: new Date().toISOString()

    }]);

  };



  const fetchAllUsers = useCallback(async () => {

    const { data } = await supabase.from('profiles').select('*').order('role');

    setAllUsersList(data || []);

  }, []);



const fetchData = useCallback(async () => {
    if (!session?.user?.id) return;

    if (!session?.user?.id || !userProfile || loading) return;

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

      let targetId  = session.user.id;

      let isGlobal  = false;



      if (userProfile.role === 'super_admin') {

        if (viewingAsId === 'GLOBAL') isGlobal = true;

        else targetId = viewingAsId === 'SELF' ? session.user.id : viewingAsId;

      } else if (userProfile.role === 'staff' || userProfile.role === 'tenant') {

        targetId = userProfile.owner_id;

}
    } catch (e) {
      console.error("Critical Fetch Error:", e);
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

      setPendingLedger(lL.filter(l => !l.is_verified && !l.is_rejected));



      const lbl = getPeriodLabel(currentPeriod);

      const [sM, sY] = lbl.split('-').map(Number);



      const rentLedger = lL.filter(l => l.is_verified && !l.is_rejected && l.payment_type?.toUpperCase() === 'RENT' && (l.billing_month === lbl || l.payment_for_month === lbl));

      const secLedger  = lL.filter(l => l.is_verified && !l.is_rejected && l.payment_type?.toUpperCase() === 'SECURITY' && l.billing_month === lbl);

      

      // 🔥 FIX 2: ADVANCE CASHFLOW (Show in month collected)

      const advLedger  = lL.filter(l => {

        if (!l.is_verified || l.is_rejected || l.payment_type?.toUpperCase() !== 'ADVANCE') return false;

        const d = new Date(l.created_at);

        return d.getMonth() + 1 === sM && d.getFullYear() === sY;

      });



      const totalDue = tL.filter(t => t.is_verified && t.is_active).reduce((s, t) => s + calculateBalanceAtPeriod(t, lL, lbl), 0);



      setStats({

        earnings: rentLedger.reduce((s, c) => s + Number(c.paid_amount||0), 0),

        security: secLedger.reduce((s, c) => s + Number(c.paid_amount||0), 0),

        advance:  advLedger.reduce((s, c) => s + Number(c.paid_amount||0), 0),

        due:      totalDue,

      });

    } catch (e) { console.error('fetchData:', e.message); }

setLoading(false);
  }, [session]);

  }, [session, userProfile, viewingAsId, currentPeriod]);



  // Auth Handlers

useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchData();

    supabase.auth.getSession().then(({ data: { session: s } }) => {

      setSession(s ?? null);

      if (s) {

        supabase.from('profiles').select('*').eq('id', s.user.id).single()

          .then(({ data }) => { setUserProfile(data); fetchAllUsers(); });

      }

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
  }, [fetchAllUsers]);

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
  useEffect(() => { if (session && userProfile) fetchData(); }, [session, userProfile, viewingAsId, currentPeriod, fetchData]);



  // 🔥 HANDLER REWRITES

  const handleRecordPayment = async (e) => {

    e.preventDefault();

    try {

      const f = new FormData(e.target);

      const isStaff = userProfile?.role === "staff";

      const payload = {

        tenant_id: paymentModal.tenant.id,

        property_id: paymentModal.tenant.property_id,

        billing_month: f.get("billing_month"),

        payment_for_month: f.get("billing_month"),

        paid_amount: Number(f.get("amount")),

        payment_type: f.get("payment_type"),

        payment_mode: f.get("payment_mode"),

        notes: f.get("notes") || null,

        is_verified: !isStaff,

        owner_id: paymentModal.tenant.owner_id,

        recorded_by: session.user.id,

        created_at: new Date().toISOString()

      };

      const { error } = await supabase.from("ledger").insert([payload]);

      if (error) throw error;

      await logActivity('PAYMENT_COLLECTED', { amount: f.get("amount"), tenant: paymentModal.tenant.full_name });

      showNotice(isStaff ? "Submitted for approval" : "Payment recorded ✓");

      setPaymentModal({ open: false, tenant: null });

      fetchData();

    } catch (err) { showNotice(err.message, "error"); }

  };



  const handleAddRoom = async (e) => {

    e.preventDefault();

    try {

      const f = new FormData(e.target);

      const payload = {

        property_id: selectedPropertyRef.current.id,

        room_number: f.get("r_num"),

        room_type: f.get("r_type"),

        status: "Vacant",

        owner_id: selectedPropertyRef.current.owner_id,

      };

      const { error } = await supabase.from("rooms").insert([payload]);

      if (error) throw error;

      showNotice("Room added");

      setAddRoomModal(false);

      fetchData();

    } catch (err) { showNotice(err.message, "error"); }

  };



  const handleAddProperty = async (e) => {

    e.preventDefault();

    try {

      const f = new FormData(e.target);

      const ownerId = (viewingAsId && viewingAsId !== "GLOBAL" && viewingAsId !== "SELF") ? viewingAsId : session.user.id;

      const { data, error } = await supabase.from("properties").insert([{ name: f.get("p_n"), address: f.get("p_a"), owner_id: ownerId }]).select().single();

      if (error) throw error;

      if (data) {

        const count = Math.min(Number(f.get("p_r")), 100);

        const roomsToCreate = Array.from({ length: count }).map((_, i) => ({

          property_id: data.id, room_number: (101 + i).toString(), room_type: "Double", status: "Vacant", owner_id: ownerId,

        }));

        await supabase.from("rooms").insert(roomsToCreate);

      }

      showNotice("Building created ✓");

      setAddPropModal(false);

      fetchData();

    } catch (err) { showNotice(err.message, "error"); }

  };



  const handleBedAction = async (room, action, extra = null) => {

    // 🔥 FIX 3: BOOKING SECURITY

    if (action === 'cancel' && room.booking_locked) {

      setSecurityModal({ open: true, type: 'booking', id: room.id });

      return;

    }



    if (action === 'book') {

      await supabase.from('rooms').update({

        booked_beds: 1, booked_by_name: extra.name, booked_by_phone: extra.phone,

        advance_amount: Number(extra.amount), booking_date: extra.date, booking_locked: true

      }).eq('id', room.id);

      await supabase.from('ledger').insert([{

        property_id: room.property_id, billing_month: getPeriodLabel(extra.date),

        paid_amount: Number(extra.amount), payment_type: 'ADVANCE', payment_mode: extra.mode || 'Cash',

        is_verified: true, owner_id: room.owner_id, recorded_by: session.user.id, created_at: new Date().toISOString()

      }]);

      showNotice('Room Reserved ✓');

    } else if (action === 'rename' && extra) {

      await supabase.from('rooms').update({ room_number: String(extra) }).eq('id', room.id);

    } else if (action === 'changeType' && extra) {

      await supabase.from('rooms').update({ room_type: extra }).eq('id', room.id);

    } else if (action === 'block' || action === 'unblock') {

      await supabase.from('rooms').update({ status: action === 'block' ? 'Maintenance' : 'Vacant' }).eq('id', room.id);

    }

    fetchData();

  };



  const handleVerify = async (type, id) => {

    await supabase.from(type === 'tenant' ? 'tenants' : 'ledger').update({ is_verified: true }).eq('id', id);

    showNotice("Verified ✓");

    fetchData();

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

        payment_mode: f.get('t_pay_mode') || 'Cash', owner_id: nt.owner_id, recorded_by: session.user.id,

        created_at: new Date().toISOString()

      }];

      if (room.advance_amount > 0) entries.push({

        tenant_id: nt.id, property_id: nt.property_id, billing_month: lbl, payment_for_month: lbl,

        paid_amount: room.advance_amount, is_verified: true, payment_type: 'RENT', 

        payment_mode: 'Advance Adjusted', owner_id: nt.owner_id, recorded_by: session.user.id,

        created_at: new Date().toISOString(), notes: `Booking Advance ₹${room.advance_amount} adjusted`

      });

      await supabase.from('ledger').insert(entries);

      await supabase.from('rooms').update({ booked_beds: 0, booked_by_name: null, advance_amount: 0, booking_locked: false }).eq('id', room.id);

      await logActivity('TENANT_CHECKIN', { name: nt.full_name, room: room.room_number });

      showNotice(isStaff ? 'Check-in sent for Approval' : 'Resident Active ✓');

      setCheckInModal({ open: false, room: null });

      fetchData();

    }

  };



  if (loading && !userProfile) {

    return (

      <div className="h-screen w-full bg-white flex flex-col items-center justify-center">

        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>

        <p className="mt-4 font-black uppercase text-[10px] tracking-widest text-zinc-400 animate-pulse">A2 Stay Pro Loading...</p>

      </div>

    );

  }



  // 🔥 Derived Info

  const isOwnerAdmin = userProfile?.role === 'owner' || userProfile?.role === 'super_admin';

  const totalPending = pendingTenants.length + pendingLedger.length;

  const dueAlerts = tenants.filter(t => t.is_verified && t.is_active && calculateBalanceAtPeriod(t, ledger, getPeriodLabel(currentPeriod)) > 0);



  return (

    <AuthWrapper>

      {/* 🔥 FIX 11: FORCE LIGHT THEME OVER MOBILE DARK THEME */}

      <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-indigo-100 flex flex-col">

        

        {/* TOP HEADER */}

        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-zinc-100 px-4 py-3">

          <div className="max-w-7xl mx-auto flex justify-between items-center">

            <div className="flex items-center gap-2.5">

              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Home size={18}/></div>

              <div>

                <h1 className="text-xs font-black uppercase tracking-tight leading-none">{userProfile?.brand_name || 'A2 Stay'}</h1>

                <p className="text-[8px] text-zinc-400 font-bold uppercase mt-1 flex items-center gap-1"><ShieldCheck size={8}/> {userProfile?.role}</p>

              </div>

            </div>



            <div className="flex items-center gap-2">

              {userProfile?.role === 'super_admin' && (

                <select value={viewingAsId} onChange={e => setViewingAsId(e.target.value)}

                  className="bg-zinc-900 text-white text-[9px] font-black px-3 py-2 rounded-xl outline-none">

                  <option value="GLOBAL">🌍 GLOBAL VIEW</option>

                  <option value="SELF">🛡️ MY ADMIN</option>

                  {allUsersList.filter(u => u.role === 'owner').map(u => <option key={u.id} value={u.id}>👤 {u.full_name}</option>)}

                </select>

              )}

              

              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-0.5 flex items-center">

                <button onClick={() => { const d = new Date(currentPeriod+'-01'); d.setMonth(d.getMonth()-1); setCurrentPeriod(d.toISOString().slice(0,7)); }} className="p-1.5 text-zinc-400"><ChevronLeft size={14}/></button>

                <span className="px-2 text-[9px] font-black text-zinc-700 min-w-[50px] text-center uppercase">{getPeriodLabel(currentPeriod)}</span>

                <button onClick={() => { const d = new Date(currentPeriod+'-01'); d.setMonth(d.getMonth()+1); setCurrentPeriod(d.toISOString().slice(0,7)); }} className="p-1.5 text-zinc-400"><ChevronRight size={14}/></button>

              </div>



              <button onClick={() => { setAlertsOpen(true); setNotificationsSeen(true); }} className="relative p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl">

                <Bell size={16} className="text-zinc-500"/>

                {!notificationsSeen && (totalPending + dueAlerts.length) > 0 && (

                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[7px] font-black rounded-full flex items-center justify-center animate-bounce">{totalPending + dueAlerts.length}</span>

                )}

              </button>

            </div>

          </div>

        </header>



        <main className="flex-1 p-4 pb-32 max-w-7xl mx-auto w-full">

          {view === 'dashboard' && (

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

              <div className="flex justify-between items-center mb-6">

                <h2 className="text-2xl font-black italic uppercase tracking-tighter">Finance Hub</h2>

                {isOwnerAdmin && <button onClick={() => setAddPropModal(true)} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/30 active:scale-90 transition-all"><Plus/></button>}

              </div>



              {/* Stat Cards */}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

                {[

                  { label: 'Collected', value: stats.earnings, color: 'indigo', icon: TrendingUp },

                  { label: 'Dues', value: stats.due, color: 'rose', icon: AlertTriangle },

                  { label: 'Advance', value: stats.advance, color: 'emerald', icon: IndianRupee },

                  { label: 'Security', value: stats.security, color: 'violet', icon: ShieldCheck },

                ].map((s, i) => (

                  <div key={i} className={`p-6 rounded-[2.5rem] bg-${s.color}-50 border border-${s.color}-100 shadow-sm`}>

                    <div className={`w-10 h-10 bg-white rounded-2xl flex items-center justify-center mb-4 text-${s.color}-500 shadow-sm`}><s.icon size={20}/></div>

                    <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">{s.label}</p>

                    <p className={`text-2xl font-black text-${s.color}-600 mt-1`}>₹{s.value.toLocaleString()}</p>

                  </div>

                ))}

              </div>



              {/* Approval Queue */}

              {isOwnerAdmin && totalPending > 0 && (

                <div className="mb-8 bg-zinc-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">

                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>

                  <div className="flex items-center gap-3 mb-6">

                    <ClipboardList className="text-amber-400" size={20}/>

                    <h3 className="text-sm font-black uppercase tracking-widest text-amber-400">Needs Your Signature</h3>

                  </div>

                  <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">

                    {pendingTenants.map(t => (

                      <div key={t.id} className="flex justify-between items-center bg-white/5 border border-white/10 p-4 rounded-2xl">

                        <div>

                          <p className="font-black text-sm">{t.full_name}</p>

                          <p className="text-[9px] text-zinc-400 uppercase mt-1">Staff Entry • {new Date(t.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>

                        </div>

                        <div className="flex gap-2">

                          <button onClick={() => handleVerify('tenant', t.id)} className="bg-emerald-500 px-4 py-2 rounded-xl text-[9px] font-black">APPROVE</button>

                          <button onClick={() => { supabase.from('tenants').delete().eq('id', t.id).then(fetchData); }} className="bg-white/10 px-4 py-2 rounded-xl text-[9px] font-black">REJECT</button>

                        </div>

                      </div>

                    ))}

                    {pendingLedger.map(l => (

                      <div key={l.id} className="flex justify-between items-center bg-white/5 border border-white/10 p-4 rounded-2xl">

                        <div>

                          <p className="font-black text-sm text-emerald-400">₹{Number(l.paid_amount).toLocaleString()}</p>

                          <p className="text-[9px] text-zinc-400 uppercase mt-1">{l.payment_type} • Collect by {allUsersList.find(u=>u.id===l.recorded_by)?.full_name || 'Staff'}</p>

                        </div>

                        <div className="flex gap-2">

                          <button onClick={() => handleVerify('ledger', l.id)} className="bg-indigo-500 px-4 py-2 rounded-xl text-[9px] font-black">VERIFY</button>

                          <button onClick={() => { supabase.from('ledger').update({is_rejected: true}).eq('id', l.id).then(fetchData); }} className="bg-white/10 px-4 py-2 rounded-xl text-[9px] font-black text-rose-400">REJECT</button>

                        </div>

                      </div>

                    ))}

                  </div>

                </div>

              )}



              {/* Buildings */}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {properties.map(p => (

                  <div key={p.id} className="bg-white border-2 border-zinc-50 rounded-[3rem] p-10 shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all group relative">

                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:rotate-12 transition-transform"><Building2 size={28}/></div>

                    <h4 className="text-2xl font-black tracking-tight text-zinc-900">{p.name}</h4>

                    <p className="text-xs text-zinc-400 font-bold uppercase mt-2 flex items-center gap-1"><MapPin size={12}/> {p.address}</p>

                    <button onClick={() => { setSelectedProperty(p); setView('inventory'); }} className="mt-8 w-full py-4 bg-zinc-900 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest hover:bg-indigo-600 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2">MANAGE <ArrowRight size={14}/></button>

                  </div>

                ))}

              </div>

            </div>

          )}



          {view === 'inventory' && (

            <Inventory 

              selectedProperty={selectedProperty} rooms={rooms} tenants={tenants} ledger={ledger}

              handleBedAction={handleBedAction} setCheckInModal={setCheckInModal} setPaymentModal={setPaymentModal}

              setBookingModal={setBookingModal} setAddRoomModal={isOwnerAdmin ? setAddRoomModal : undefined}

              setEditTenantModal={isOwnerAdmin ? setEditTenantModal : undefined}

              setSecurityModal={isOwnerAdmin ? setSecurityModal : undefined} setView={setView} 

              calculateBalanceAtPeriod={calculateBalanceAtPeriod} currentPeriodLabel={getPeriodLabel(currentPeriod)} 

              userRole={userProfile?.role}

            />

          )}



          {view === 'tenants' && (

            <Tenants 

              tenants={tenants} rooms={rooms} ledger={ledger} properties={properties} 

              setPaymentModal={setPaymentModal} calculateBalanceAtPeriod={calculateBalanceAtPeriod} 

              currentPeriodLabel={getPeriodLabel(currentPeriod)}

              userRole={userProfile?.role}

            />

          )}



          {view === 'team' && <Team userProfile={userProfile} allUsersList={allUsersList} onRefreshUsers={fetchData} />}

          

          {view === 'settings' && (

            <div className="animate-in fade-in duration-500 max-w-2xl mx-auto space-y-6">

              <h2 className="text-3xl font-black italic uppercase tracking-tighter">My Account</h2>

              <div className="bg-white p-10 rounded-[3rem] border-2 border-zinc-50 shadow-sm">

                <div className="flex items-center gap-6 mb-10 border-b border-zinc-50 pb-10">

                  <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-indigo-400 rounded-3xl flex items-center justify-center text-white text-4xl font-black shadow-2xl">{(userProfile?.full_name || 'U')[0]}</div>

                  <div>

                    <p className="text-3xl font-black tracking-tight">{userProfile?.full_name}</p>

                    <p className="text-zinc-400 font-bold">{session?.user?.email}</p>

                    <div className="flex gap-2 mt-4">

                      <span className="px-4 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase">{userProfile?.role}</span>

                      {userProfile?.brand_name && <span className="px-4 py-1 bg-zinc-900 text-white rounded-full text-[9px] font-black uppercase">{userProfile.brand_name}</span>}

                    </div>

                  </div>

                </div>

                <div className="space-y-3">

                  <button onClick={exportCSV} className="w-full py-5 bg-zinc-50 rounded-2xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 hover:bg-zinc-100 transition-all"><Download size={18} className="text-indigo-600"/> EXPORT MASTER DATA (CSV)</button>

                  <button onClick={() => supabase.auth.signOut()} className="w-full py-5 bg-rose-50 text-rose-600 rounded-2xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 hover:bg-rose-600 hover:text-white transition-all shadow-sm"><LogOut size={18}/> SIGN OUT</button>

                </div>

              </div>

            </div>

          )}

        </main>



        {/* BOTTOM NAV */}

        <nav className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-xl border-t border-zinc-100 p-4 pb-8 z-50 flex justify-around">

          {[

            { key: 'dashboard', icon: LayoutDashboard, label: 'Hub' },

            { key: 'tenants', icon: Users, label: 'Residents' },

            { key: 'team', icon: ShieldCheck, label: 'Team', hide: userProfile?.role === 'staff' },

            { key: 'settings', icon: Settings, label: 'Account' },

          ].filter(n => !n.hide).map(n => (

            <button key={n.key} onClick={() => setView(n.key)} 

              className={`flex flex-col items-center gap-1.5 transition-all active:scale-75 ${view === n.key ? 'text-indigo-600' : 'text-zinc-400'}`}>

              <div className={`p-2.5 rounded-2xl ${view === n.key ? 'bg-indigo-50' : ''}`}><n.icon size={22} strokeWidth={view === n.key ? 2.5 : 2}/></div>

              <span className={`text-[8px] font-black uppercase tracking-widest ${view === n.key ? 'opacity-100' : 'opacity-40'}`}>{n.label}</span>

            </button>

          ))}

        </nav>



        {/* ══ MODALS (JSX UPDATED) ══ */}

        {/* Record Payment */}

        {paymentModal.open && (

          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">

            <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">

              <div className="p-8 border-b flex justify-between items-center">

                <div><h3 className="text-xl font-black italic uppercase">Collect Rent</h3><p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">{paymentModal.tenant?.full_name}</p></div>

                <button onClick={() => setPaymentModal({open:false})} className="p-3 bg-zinc-100 rounded-2xl"><X/></button>

              </div>

              <form onSubmit={handleRecordPayment} className="p-8 space-y-4">

                <input name="amount" type="number" required className={INP} placeholder="Payment Amount (₹) *"/>

                <div className="grid grid-cols-2 gap-3">

                  <select name="payment_type" className={INP}><option value="RENT">Rent</option><option value="SECURITY">Security</option><option value="ADVANCE">Advance</option></select>

                  <select name="payment_mode" className={INP}><option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Bank">Bank</option></select>

                </div>

                <input name="billing_month" defaultValue={getPeriodLabel(currentPeriod)} className={INP} placeholder="MM-YYYY"/>

                <input name="notes" className={INP} placeholder="Optional Notes..."/>

                <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-500/30">Save Transaction ✓</button>

              </form>

            </div>

          </div>

        )}



        {/* Add Property */}

        {addPropModal && (

          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[1000] flex items-center justify-center p-4">

            <div className="bg-white rounded-[3rem] w-full max-w-sm p-10 shadow-2xl animate-in zoom-in-95">

               <div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-black italic uppercase tracking-tighter">New Building</h3><button onClick={()=>setAddPropModal(false)}><X/></button></div>

               <form onSubmit={handleAddProperty} className="space-y-4">

                 <input name="p_n" required className={INP} placeholder="Property Name (e.g. A2 Vibes)"/>

                 <input name="p_a" required className={INP} placeholder="Property Address"/>

                 <input name="p_r" type="number" required className={INP} placeholder="Number of Rooms"/>

                 <button type="submit" className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl">Create Building ✓</button>

               </form>

            </div>

          </div>

        )}



        {/* Security / PIN Verification */}

        {securityModal.open && (

          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">

            <div className="bg-white rounded-[2.5rem] w-full max-w-xs p-10 text-center animate-in zoom-in-95">

              <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-rose-500 shadow-inner"><Lock size={40}/></div>

              <h3 className="text-xl font-black italic uppercase">Verify Admin</h3>

              <p className="text-[10px] text-zinc-400 font-bold uppercase mt-2">PIN required for permanent deletion</p>

              <input type="password" value={adminPin} onChange={e => {setAdminPin(e.target.value); setAdminErr(false);}} className={`${INP} mt-6 text-center text-2xl tracking-[0.4em] font-black border-2 ${adminErr ? 'border-rose-500 bg-rose-50' : ''}`} placeholder="****"/>

              <div className="grid grid-cols-2 gap-3 mt-8">

                <button onClick={() => setSecurityModal({open:false})} className="py-4 bg-zinc-100 rounded-2xl font-black text-[10px] uppercase">Cancel</button>

                <button onClick={async () => {

                  if(adminPin !== ADMIN_CODE) {setAdminErr(true); return;}

                  const table = securityModal.type === 'tenant' ? 'tenants' : securityModal.type === 'room' ? 'rooms' : 'properties';

                  await supabase.from(table).delete().eq('id', securityModal.id);

                  setSecurityModal({open:false}); fetchData(); showNotice("Entry Deleted", "error");

                }} className="py-4 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-rose-500/30">Delete</button>

              </div>

            </div>

          </div>

        )}



      </div>

    </AuthWrapper>

  );

}
