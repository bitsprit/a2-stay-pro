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
  Bell, Download, Loader2, ClipboardList, User, Wrench
} from 'lucide-react';

const ADMIN_CODE = 'A2-ADMIN';
const INP = 'w-full bg-zinc-50 border border-zinc-200 px-4 py-3.5 rounded-2xl font-medium text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all placeholder:text-zinc-400';

// Accounting Engine
function calculateBalanceAtPeriod(tenant, allLedger, periodLabel) {
  if (!tenant?.join_date || !tenant?.agreed_rent || tenant.status === 'Inactive') return 0;
  const rent = Number(tenant.agreed_rent);
  const paid = (allLedger || [])
    .filter(l => l.tenant_id === tenant.id && l.is_verified && l.payment_type?.toUpperCase() === 'RENT' && (l.billing_month === periodLabel || l.payment_for_month === periodLabel))
    .reduce((s, l) => s + Number(l.paid_amount || 0), 0);
  return Math.max(rent - paid, 0);
}

const getPeriodLabel = (dateStr) => {
  const [y, m] = dateStr.split('-');
  return `${m}-${y}`;
};

export default function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [allUsersList, setAllUsersList] = useState([]);
  const [viewingAsId, setViewingAsId] = useState('GLOBAL');
  const [view, setView] = useState('dashboard');
  
  // DATA STATES
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedProperty, setSelectedProperty] = useState(null);
  const [currentPeriod, setCurrentPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [stats, setStats] = useState({ earnings: 0, due: 0, advance: 0, security: 0 });
  const [pendingTenants, setPendingTenants] = useState([]);
  const [pendingLedger, setPendingLedger] = useState([]);

  // MODAL STATES
  const [checkInModal, setCheckInModal] = useState({ open: false, room: null });
  const [bookingModal, setBookingModal] = useState({ open: false, room: null });
  const [paymentModal, setPaymentModal] = useState({ open: false, tenant: null });
  const [editTenantModal, setEditTenantModal] = useState({ open: false, tenant: null });
  const [securityModal, setSecurityModal] = useState({ open: false, type: null, id: null });
  const [addPropModal, setAddPropModal] = useState(false);
  const [addRoomModal, setAddRoomModal] = useState(false);
  const [financeModal, setFinanceModal] = useState({ open: false, type: '', data: [] });
  const [toast, setToast] = useState(null);

  const showNotice = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchData = useCallback(async () => {
    if (!session?.user?.id || !userProfile) return;
    setLoading(true);

    try {
      let targetId = session.user.id;
      let isGlobal = false;

      if (userProfile.role === 'super_admin') {
        if (viewingAsId === 'GLOBAL') isGlobal = true;
        else targetId = viewingAsId;
      } else if (userProfile.role === 'staff') {
        targetId = userProfile.owner_id;
      }

      const matchQuery = isGlobal ? {} : { owner_id: targetId };

      const [pRes, rRes, tRes, lRes, uRes] = await Promise.all([
        supabase.from('properties').select('*').match(matchQuery),
        supabase.from('rooms').select('*').match(matchQuery).order('room_number'),
        supabase.from('tenants').select('*').match(matchQuery),
        supabase.from('ledger').select('*').match(matchQuery).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*')
      ]);

      setProperties(pRes.data || []);
      setRooms(rRes.data || []);
      setTenants(tRes.data || []);
      setLedger(lRes.data || []);
      setAllUsersList(uRes.data || []);

      setPendingTenants((tRes.data || []).filter(t => !t.is_verified));
      setPendingLedger((lRes.data || []).filter(l => !l.is_verified));

      const lbl = getPeriodLabel(currentPeriod);
      const filteredLedger = (lRes.data || []).filter(l => l.is_verified);
      
      setStats({
        earnings: filteredLedger.filter(l => l.payment_type === 'RENT' && l.billing_month === lbl).reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        security: filteredLedger.filter(l => l.payment_type === 'SECURITY').reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        advance: filteredLedger.filter(l => l.payment_type === 'ADVANCE').reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        due: (tRes.data || []).filter(t => t.is_verified && t.status !== 'Inactive').reduce((s, t) => s + calculateBalanceAtPeriod(t, lRes.data, lbl), 0)
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [session, userProfile, viewingAsId, currentPeriod]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
          .then(({ data }) => setUserProfile(data));
      }
    });
  }, []);

  useEffect(() => { if (userProfile) fetchData(); }, [userProfile, viewingAsId, fetchData]);

  // ACTION HANDLERS (Fixes Room Rename & Bed Actions)
  const handleBedAction = async (room, action, extra = null) => {
    if (action === 'rename') {
      await supabase.from('rooms').update({ room_number: String(extra) }).eq('id', room.id);
    } else if (action === 'changeType') {
      await supabase.from('rooms').update({ room_type: extra }).eq('id', room.id);
    } else if (action === 'block') {
      await supabase.from('rooms').update({ status: 'Maintenance' }).eq('id', room.id);
    } else if (action === 'unblock') {
      await supabase.from('rooms').update({ status: 'Vacant' }).eq('id', room.id);
    } else if (action === 'cancel') {
        const pin = prompt("Enter ADMIN CODE to delete reservation:");
        if (pin !== ADMIN_CODE) return;
        await supabase.from('rooms').update({ booked_beds: 0, booked_by_name: null, advance_amount: 0 }).eq('id', room.id);
    }
    fetchData();
    showNotice("Room Updated");
  };

  const handleVerify = async (type, id) => {
    await supabase.from(type === 'tenant' ? 'tenants' : 'ledger').update({ is_verified: true }).eq('id', id);
    fetchData();
    showNotice("Verified ✓");
  };

  const handleSecurityConfirm = async () => {
    if (adminPin !== ADMIN_CODE) return;
    await supabase.from(securityModal.type === 'tenant' ? 'tenants' : securityModal.type === 'room' ? 'rooms' : 'properties').delete().eq('id', securityModal.id);
    setSecurityModal({ open: false, type: null, id: null });
    setAdminPin('');
    fetchData();
    showNotice("Deleted", "error");
  };

  if (loading && !userProfile) return <div className="h-screen flex items-center justify-center font-black uppercase tracking-widest text-zinc-400 animate-pulse">A2 Stay Pro...</div>;

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-white flex flex-col">
        {/* HEADER */}
        <header className="sticky top-0 z-40 bg-white border-b px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white"><Home size={16}/></div>
            <h1 className="font-black text-sm uppercase">{userProfile?.brand_name || 'A2 Stay'}</h1>
          </div>
          <div className="flex items-center gap-2">
            {userProfile?.role === 'super_admin' && (
               <select value={viewingAsId} onChange={e => setViewingAsId(e.target.value)} className="bg-zinc-900 text-white text-[10px] font-black p-2 rounded-lg">
                  <option value="GLOBAL">GLOBAL</option>
                  {allUsersList.filter(u => u.role === 'owner').map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
               </select>
            )}
            <button onClick={fetchData} className="p-2 bg-zinc-100 rounded-lg"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/></button>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1 p-4 pb-32 max-w-7xl mx-auto w-full">
          {view === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Stats cards here */}
                <button onClick={() => setFinanceModal({open:true, type:'Earnings', data: ledger})} className="p-6 bg-indigo-50 rounded-3xl text-left">
                  <p className="text-[10px] font-black uppercase text-indigo-400">Collected</p>
                  <p className="text-2xl font-black text-indigo-600">₹{stats.earnings.toLocaleString()}</p>
                </button>
                <button onClick={() => setFinanceModal({open:true, type:'Dues', data: tenants})} className="p-6 bg-rose-50 rounded-3xl text-left">
                  <p className="text-[10px] font-black uppercase text-rose-400">Dues</p>
                  <p className="text-2xl font-black text-rose-600">₹{stats.due.toLocaleString()}</p>
                </button>
              </div>

              {/* Approval Queue */}
              {isOwnerAdmin && (pendingTenants.length > 0 || pendingLedger.length > 0) && (
                <div className="bg-zinc-900 text-white p-6 rounded-3xl space-y-4">
                  <h3 className="text-xs font-black uppercase text-amber-400">Needs Approval ({pendingTenants.length + pendingLedger.length})</h3>
                  {pendingTenants.map(t => (
                    <div key={t.id} className="flex justify-between items-center border-b border-white/10 pb-4">
                      <p className="text-sm font-bold">{t.full_name} (New Resident)</p>
                      <button onClick={() => handleVerify('tenant', t.id)} className="bg-emerald-500 px-4 py-2 rounded-xl text-[10px] font-black">APPROVE</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Property List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map(p => (
                  <div key={p.id} className="bg-white border rounded-[2rem] p-6 shadow-sm">
                    <h4 className="text-xl font-black">{p.name}</h4>
                    <button onClick={() => { setSelectedProperty(p); setView('inventory'); }} className="mt-4 w-full py-4 bg-zinc-900 text-white rounded-2xl text-[10px] font-black">MANAGE BUILDING</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'inventory' && (
            <Inventory 
              selectedProperty={selectedProperty} rooms={rooms} tenants={tenants} ledger={ledger}
              handleBedAction={handleBedAction} setCheckInModal={setCheckInModal} setPaymentModal={setPaymentModal}
              setBookingModal={setBookingModal} setAddRoomModal={setAddRoomModal} setEditTenantModal={setEditTenantModal}
              setSecurityModal={setSecurityModal} setView={setView} calculateBalanceAtPeriod={calculateBalanceAtPeriod}
              currentPeriodLabel={getPeriodLabel(currentPeriod)} userRole={userProfile?.role}
            />
          )}

          {view === 'tenants' && <Tenants tenants={tenants} rooms={rooms} ledger={ledger} properties={properties} setPaymentModal={setPaymentModal} calculateBalanceAtPeriod={calculateBalanceAtPeriod} currentPeriodLabel={getPeriodLabel(currentPeriod)} />}
          {view === 'team' && <Team userProfile={userProfile} allUsersList={allUsersList} onRefreshUsers={fetchData} />}
          
          {view === 'settings' && (
            <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-6">
              <h2 className="text-3xl font-black italic uppercase">Account</h2>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black">{(userProfile?.full_name || 'U')[0]}</div>
                <div>
                  <p className="text-xl font-black">{userProfile?.full_name}</p>
                  <p className="text-zinc-400 font-bold">{session?.user?.email}</p>
                </div>
              </div>
              <button onClick={() => supabase.auth.signOut()} className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl font-black uppercase text-xs">Sign Out</button>
            </div>
          )}
        </main>

        {/* BOTTOM NAV */}
        <nav className="fixed bottom-0 inset-x-0 bg-white border-t p-4 flex justify-around">
          <button onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'text-indigo-600' : 'text-zinc-400'}><LayoutDashboard/></button>
          <button onClick={() => setView('tenants')} className={view === 'tenants' ? 'text-indigo-600' : 'text-zinc-400'}><Users/></button>
          <button onClick={() => setView('team')} className={view === 'team' ? 'text-indigo-600' : 'text-zinc-400'}><ShieldCheck/></button>
          <button onClick={() => setView('settings')} className={view === 'settings' ? 'text-indigo-600' : 'text-zinc-400'}><Settings/></button>
        </nav>

        {/* SECURITY MODAL */}
        {securityModal.open && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[2000]">
            <div className="bg-white p-8 rounded-[2rem] w-full max-w-xs text-center space-y-4">
              <Lock className="mx-auto text-rose-500" size={32}/>
              <h3 className="font-black uppercase">Verify Admin</h3>
              <input type="password" value={adminPin} onChange={e => setAdminPin(e.target.value)} className={INP} placeholder="****"/>
              <button onClick={handleSecurityConfirm} className="w-full py-4 bg-rose-500 text-white rounded-2xl font-black">DELETE</button>
              <button onClick={() => setSecurityModal({open:false})} className="text-xs font-bold text-zinc-400">CANCEL</button>
            </div>
          </div>
        )}
      </div>
    </AuthWrapper>
  );
}
