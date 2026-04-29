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

function calculateBalanceAtPeriod(tenant, ledger, periodLabel) {
  if (!tenant?.join_date || !tenant?.agreed_rent || !tenant.is_active) return 0;
  const rent = Number(tenant.agreed_rent);
  const joinDate = new Date(tenant.join_date);
  const [m, y] = periodLabel.split('-').map(Number);
  const periodStart = new Date(y, m - 1, 1);
  if (periodStart < new Date(joinDate.getFullYear(), joinDate.getMonth(), 1)) return 0;

  const paid = (ledger || [])
    .filter(l => l.tenant_id === tenant.id && l.is_verified && !l.is_rejected && l.payment_type?.toUpperCase() === 'RENT' && (l.payment_for_month === periodLabel || l.billing_month === periodLabel))
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
  const [allUsersList, setAllUsersList] = useState([]);
  const [viewingAsId, setViewingAsId] = useState('GLOBAL');
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [notificationsSeen, setNotificationsSeen] = useState(false);

  // Data States
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const selectedPropertyRef = useRef(null);
  
  const [currentPeriod, setCurrentPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [stats, setStats] = useState({ earnings: 0, due: 0, advance: 0, security: 0 });
  const [pendingTenants, setPendingTenants] = useState([]);
  const [pendingLedger, setPendingLedger] = useState([]);

  // Modals
  const [checkInModal, setCheckInModal] = useState({ open: false, room: null });
  const [bookingModal, setBookingModal] = useState({ open: false, room: null });
  const [paymentModal, setPaymentModal] = useState({ open: false, tenant: null });
  const [editTenantModal, setEditTenantModal] = useState({ open: false, tenant: null });
  const [securityModal, setSecurityModal] = useState({ open: false, type: null, id: null });
  const [addPropModal, setAddPropModal] = useState(false);
  const [addRoomModal, setAddRoomModal] = useState(false);
  const [financeModal, setFinanceModal] = useState({ open: false, type: '', data: [] });
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [adminErr, setAdminErr] = useState(false);
  const [toast, setToast] = useState(null);

  const showNotice = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const exportCSV = () => {
    try {
      const rows = tenants.map(t => ({
        Name: t.full_name, Phone: t.phone_number, Rent: t.agreed_rent,
        Property: properties.find(p => p.id === t.property_id)?.name || 'NA'
      }));
      if (!rows.length) return showNotice("No data", "error");
      const csv = [Object.keys(rows[0]).join(','), ...rows.map(r => Object.values(r).join(','))].join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = `Residents_${getPeriodLabel(currentPeriod)}.csv`;
      a.click();
    } catch (e) { showNotice("Export failed", "error"); }
  };

  const fetchData = useCallback(async () => {
    if (!session?.user?.id || !userProfile) return;
    if (userProfile.role === 'tenant') { setLoading(false); return; }

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
        supabase.from('tenants').select('*').match(matchQuery).eq('is_active', true),
        supabase.from('ledger').select('*').match(matchQuery).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*')
      ]);

      setProperties(pRes.data || []);
      setRooms(rRes.data || []);
      setTenants(tRes.data || []);
      setLedger(lRes.data || []);
      setAllUsersList(uRes.data || []);
      setPendingTenants((tRes.data || []).filter(t => !t.is_verified));
      setPendingLedger((lRes.data || []).filter(l => !l.is_verified && !l.is_rejected));

      const lbl = getPeriodLabel(currentPeriod);
      const [sM, sY] = lbl.split('-').map(Number);
      const vL = (lRes.data || []).filter(l => l.is_verified && !l.is_rejected);

      setStats({
        earnings: vL.filter(l => l.payment_type === 'RENT' && (l.billing_month === lbl || l.payment_for_month === lbl)).reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        security: vL.filter(l => l.payment_type === 'SECURITY').reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        advance: vL.filter(l => {
          const d = new Date(l.created_at);
          return l.payment_type === 'ADVANCE' && d.getMonth() + 1 === sM && d.getFullYear() === sY;
        }).reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        due: (tRes.data || []).filter(t => t.is_verified && t.is_active).reduce((s, t) => s + calculateBalanceAtPeriod(t, lRes.data, lbl), 0)
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [session, userProfile, viewingAsId, currentPeriod]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) {
        supabase.from('profiles').select('*').eq('id', s.user.id).single()
          .then(({ data }) => setUserProfile(data));
      }
    });
  }, []);

  useEffect(() => { if (userProfile) fetchData(); }, [userProfile, viewingAsId, fetchData]);

  const handleBedAction = async (room, action, extra = null) => {
    const { error } = await supabase.from('rooms').update(
      action === 'rename' ? { room_number: String(extra) } :
      action === 'changeType' ? { room_type: extra } :
      action === 'block' ? { status: 'Maintenance' } : { status: 'Vacant' }
    ).eq('id', room.id);
    if (error) showNotice(error.message, 'error');
    else fetchData();
  };

  const handleVerify = async (type, id) => {
    await supabase.from(type === 'tenant' ? 'tenants' : 'ledger').update({ is_verified: true }).eq('id', id);
    fetchData(); showNotice("Verified ✓");
  };

  // FORK: If user is a tenant, show TenantPortal only
  if (userProfile?.role === 'tenant') {
    return (
      <AuthWrapper>
        <TenantPortal session={session} />
      </AuthWrapper>
    );
  }

  if (loading && !userProfile) return (
    <div className="h-screen w-full bg-white flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
      <p className="font-black uppercase text-[10px] tracking-widest text-zinc-400">A2 STAY PRO LOADING...</p>
    </div>
  );

  const isOwnerAdmin = userProfile?.role === 'owner' || userProfile?.role === 'super_admin';
  const totalPending = pendingTenants.length + pendingLedger.length;
  const dueAlerts = tenants.filter(t => t.is_verified && calculateBalanceAtPeriod(t, ledger, getPeriodLabel(currentPeriod)) > 0);

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col">
        {toast && <div className={`fixed top-14 right-4 z-[5000] px-5 py-3 rounded-2xl shadow-2xl font-black text-[10px] uppercase tracking-widest border-l-4 animate-in slide-in-from-right duration-200 ${toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-zinc-900 text-white border-emerald-400'}`}>{toast.msg}</div>}

        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-zinc-100 px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Home size={18}/></div>
            <h1 className="text-xs font-black uppercase tracking-tight">{userProfile?.brand_name || 'A2 Stay'}</h1>
          </div>
          <div className="flex items-center gap-2">
            {userProfile?.role === 'super_admin' && (
              <select value={viewingAsId} onChange={e => setViewingAsId(e.target.value)} className="bg-zinc-900 text-white text-[9px] font-black px-3 py-2 rounded-xl outline-none"><option value="GLOBAL">GLOBAL VIEW</option>{allUsersList.filter(u => u.role === 'owner').map(u => <option key={u.id} value={u.id}>👤 {u.full_name}</option>)}</select>
            )}
            <button onClick={() => { setAlertsOpen(true); setNotificationsSeen(true); }} className="relative p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl">
              <Bell size={16} className="text-zinc-500"/>
              {!notificationsSeen && (totalPending + dueAlerts.length) > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[7px] font-black rounded-full flex items-center justify-center">{totalPending + dueAlerts.length}</span>}
            </button>
            <button onClick={fetchData} className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/></button>
          </div>
        </header>

        <main className="flex-1 p-4 pb-32 max-w-7xl mx-auto w-full">
          {view === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black italic uppercase italic">Finance Hub</h2>
                {isOwnerAdmin && <button onClick={() => setAddPropModal(true)} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/30 active:scale-90 transition-all"><Plus/></button>}
              </div>

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

              {isOwnerAdmin && totalPending > 0 && (
                <div className="bg-zinc-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                  <div className="flex items-center gap-3 mb-6"><ClipboardList className="text-amber-400" size={20}/><h3 className="text-sm font-black uppercase tracking-widest text-amber-400">Needs Approval</h3></div>
                  <div className="space-y-4 max-h-60 overflow-y-auto">
                    {pendingTenants.map(t => (
                      <div key={t.id} className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                        <div><p className="font-black text-sm">{t.full_name}</p><p className="text-[9px] text-zinc-400 uppercase mt-1">Staff Entry • {new Date(t.created_at).toLocaleTimeString()}</p></div>
                        <button onClick={() => handleVerify('tenant', t.id)} className="bg-emerald-500 px-4 py-2 rounded-xl text-[9px] font-black">APPROVE</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
          {view === 'maintenance' && <MaintenancePanel userProfile={userProfile} properties={properties} rooms={rooms} tenants={tenants} />}
          {view === 'team' && <Team userProfile={userProfile} allUsersList={allUsersList} onRefreshUsers={fetchData} />}
          
          {view === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in">
              <h2 className="text-3xl font-black italic uppercase">Account</h2>
              <div className="bg-white p-10 rounded-[3rem] border-2 border-zinc-50 shadow-sm">
                <div className="flex items-center gap-6 mb-10 border-b border-zinc-50 pb-10">
                  <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-4xl font-black shadow-2xl">{(userProfile?.full_name || 'U')[0]}</div>
                  <div><p className="text-3xl font-black tracking-tight">{userProfile?.full_name}</p><p className="text-zinc-400 font-bold">{session?.user?.email}</p></div>
                </div>
                <div className="space-y-3">
                  <button onClick={exportCSV} className="w-full py-5 bg-zinc-50 rounded-2xl font-black uppercase text-[11px] flex items-center justify-center gap-3"><Download size={18}/> EXPORT DATA (CSV)</button>
                  <button onClick={() => supabase.auth.signOut()} className="w-full py-5 bg-rose-50 text-rose-600 rounded-2xl font-black uppercase text-[11px] flex items-center justify-center gap-3"><LogOut size={18}/> SIGN OUT</button>
                </div>
              </div>
            </div>
          )}
        </main>

        <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-zinc-100 p-4 pb-8 z-50 flex justify-around shadow-2xl">
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
      </div>
    </AuthWrapper>
  );
}
