import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import AuthWrapper from './AuthWrapper';
import Inventory from './Inventory';
import Tenants from './Tenants';
import Team from './Team';
import MaintenancePanel from './MaintenancePanel';
import TenantPortal from './TenantPortal';
import {
  X, ShieldCheck, Building2, MapPin, LayoutDashboard, RefreshCw, Users, Plus, 
  MessageCircle, ChevronLeft, ChevronRight, Trash2, Edit3, Wallet, ArrowRight, 
  Lock, CheckCircle2, TrendingUp, AlertTriangle, IndianRupee, Home, LogOut, 
  Settings, Bell, Download, Loader2, ClipboardList, User, Wrench, Clock
} from 'lucide-react';

const ADMIN_CODE = 'A2-ADMIN';
const INP = 'w-full bg-zinc-50 border border-zinc-200 px-4 py-3.5 rounded-2xl font-medium text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all text-zinc-900';

const colorMap = {
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600', border: 'border-indigo-100', icon: 'text-indigo-500' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',   border: 'border-rose-100',   icon: 'text-rose-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', icon: 'text-emerald-500' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-100',  icon: 'text-violet-500' }
};

export default function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [notificationsSeen, setNotificationsSeen] = useState(false);

  // Data States
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [allUsersList, setAllUsersList] = useState([]);
  const [viewingAsId, setViewingAsId] = useState('GLOBAL');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [currentPeriod, setCurrentPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [stats, setStats] = useState({ earnings: 0, due: 0, advance: 0, security: 0 });

  // Modal States
  const [addPropModal, setAddPropModal] = useState(false);
  const [addRoomModal, setAddRoomModal] = useState(false);
  const [bookingModal, setBookingModal] = useState({ open: false, room: null });
  const [paymentModal, setPaymentModal] = useState({ open: false, tenant: null });
  const [editTenantModal, setEditTenantModal] = useState({ open: false, tenant: null });
  const [checkInModal, setCheckInModal] = useState({ open: false, room: null });
  const [securityModal, setSecurityModal] = useState({ open: false, type: null, id: null });
  const [financeModal, setFinanceModal] = useState({ open: false, type: '', data: [] });
  const [adminPin, setAdminPin] = useState('');
  const [adminErr, setAdminErr] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getPeriodLabel = (dateStr) => {
    const [y, m] = dateStr.split('-');
    return `${m}-${y}`;
  };

  const calculateBalanceAtPeriod = useCallback((tenant, allLedger, periodLabel) => {
    if (!tenant?.is_active) return 0;
    const rent = Number(tenant.agreed_rent || 0);
    const paid = (allLedger || [])
      .filter(l => l.tenant_id === tenant.id && l.is_verified && !l.is_rejected && 
              l.payment_type?.toUpperCase() === 'RENT' && 
              (l.payment_for_month === periodLabel || l.billing_month === periodLabel))
      .reduce((sum, l) => sum + Number(l.paid_amount || 0), 0);
    return Math.max(rent - paid, 0);
  }, []);

  const fetchData = useCallback(async () => {
    if (!session?.user?.id || !userProfile) return;
    if (userProfile.role === 'tenant') { setLoading(false); return; }

    setLoading(true);
    try {
      const targetId = userProfile.role === 'staff' ? userProfile.owner_id : (viewingAsId === 'GLOBAL' ? session.user.id : viewingAsId);
      const matchQuery = userProfile.role === 'super_admin' && viewingAsId === 'GLOBAL' ? {} : { owner_id: targetId };

      const [pRes, rRes, tRes, lRes, uRes] = await Promise.all([
        supabase.from('properties').select('*').match(matchQuery),
        supabase.from('rooms').select('*').match(matchQuery).order('room_number'),
        supabase.from('tenants').select('*').match(matchQuery).eq('is_active', true),
        supabase.from('ledger').select('*').match(matchQuery).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*')
      ]);

      const tL = tRes.data || []; const pL = pRes.data || []; const rL = rRes.data || []; const uL = uRes.data || [];
      
      const enrichedLedger = (lRes.data || []).map(l => {
        const tenant = tL.find(t => t.id === l.tenant_id);
        const room = rL.find(r => r.id === l.room_id || r.id === tenant?.room_id);
        return {
          ...l,
          tenant_name: tenant?.full_name || room?.booked_by_name || 'Guest',
          property_name: pL.find(p => p.id === l.property_id)?.name || 'NA',
          room_number: room?.room_number || 'NA',
          collected_by: uL.find(u => u.id === l.recorded_by)?.full_name || 'Staff'
        };
      });

      setProperties(pL); setRooms(rL); setTenants(tL); setLedger(enrichedLedger); setAllUsersList(uL);

      const lbl = getPeriodLabel(currentPeriod);
      const [sM, sY] = lbl.split('-').map(Number);
      const verified = enrichedLedger.filter(l => l.is_verified && !l.is_rejected);

      setStats({
        earnings: verified.filter(l => l.payment_type === 'RENT' && (l.billing_month === lbl)).reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        security: verified.filter(l => l.payment_type === 'SECURITY').reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        advance: verified.filter(l => l.payment_type === 'ADVANCE' && l.billing_month === lbl).reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        due: tL.reduce((s, t) => s + calculateBalanceAtPeriod(t, enrichedLedger, lbl), 0)
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [session, userProfile, viewingAsId, currentPeriod, calculateBalanceAtPeriod]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) {
        supabase.from('profiles').select('*').eq('id', s.user.id).single()
          .then(({ data }) => setUserProfile(data));
      }
    });
  }, []);

  useEffect(() => { if (session && userProfile) fetchData(); }, [fetchData, session, userProfile]);

  // Handlers
  const handleAddProperty = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const { data, error } = await supabase.from('properties').insert([{
      name: f.get('p_n'), address: f.get('p_a'), owner_id: viewingAsId === 'GLOBAL' ? session.user.id : viewingAsId
    }]).select().single();
    if (error) return showToast(error.message, 'error');
    const roomsToCreate = Array.from({length: Number(f.get('p_r'))}).map((_, i) => ({
      property_id: data.id, room_number: (101 + i).toString(), room_type: 'Double', owner_id: data.owner_id
    }));
    await supabase.from('rooms').insert(roomsToCreate);
    setAddPropModal(false); fetchData(); showToast('Building initialized ✓');
  };

  const handleBedAction = async (room, action, extra = null) => {
    let update = {};
    if (action === 'rename') update = { room_number: String(extra) };
    if (action === 'changeType') update = { room_type: extra };
    if (action === 'block') update = { status: 'Maintenance' };
    if (action === 'unblock') update = { status: 'Vacant' };
    if (action === 'book') {
        update = { status: 'Reserved', booked_by_name: extra.name, booked_by_phone: extra.phone, advance_amount: Number(extra.amount) };
        await supabase.from('ledger').insert([{
          property_id: room.property_id, room_id: room.id, payment_type: 'ADVANCE', 
          paid_amount: Number(extra.amount), billing_month: getPeriodLabel(currentPeriod), 
          owner_id: room.owner_id, is_verified: true, recorded_by: session.user.id
        }]);
    }
    const { error } = await supabase.from('rooms').update(update).eq('id', room.id);
    if (!error) fetchData();
  };

  const handleSecurityConfirm = async () => {
    if (adminPin !== ADMIN_CODE) { setAdminErr(true); return; }
    let table = securityModal.type === 'tenant' ? 'tenants' : securityModal.type === 'property' ? 'properties' : 'rooms';
    const { error } = await supabase.from(table).delete().eq('id', securityModal.id);
    if (!error) { showToast('Record removed'); setSecurityModal({open:false}); fetchData(); }
    setAdminPin(''); setAdminErr(false);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const { error } = await supabase.from("ledger").insert([{
      tenant_id: paymentModal.tenant.id, property_id: paymentModal.tenant.property_id,
      billing_month: f.get("billing_month"), paid_amount: Number(f.get("amount")), 
      payment_type: f.get("payment_type"), payment_mode: f.get("payment_mode"),
      owner_id: paymentModal.tenant.owner_id, recorded_by: session.user.id, is_verified: true
    }]);
    if (!error) { showToast('Payment Saved'); setPaymentModal({open:false}); fetchData(); }
  };

  if (loading && !userProfile) return <div className="h-screen flex items-center justify-center font-black text-zinc-400">SYNCING DATA...</div>;
  if (userProfile?.role === 'tenant') return <AuthWrapper><TenantPortal session={session} /></AuthWrapper>;

  const totalPending = ledger.filter(l => !l.is_verified).length;
  const dueAlerts = tenants.filter(t => calculateBalanceAtPeriod(t, ledger, getPeriodLabel(currentPeriod)) > 0);

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-white text-zinc-900 flex flex-col">
        {toast && <div className="fixed top-4 right-4 z-[9999] px-6 py-3 bg-zinc-900 text-white rounded-2xl font-black text-xs uppercase shadow-2xl">{toast}</div>}

        <header className="sticky top-0 z-[100] bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-2"><div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black">A2</div><h1 className="font-black text-sm uppercase">{userProfile?.brand_name || 'A2 Stay'}</h1></div>
          <div className="flex items-center gap-2">
            {userProfile?.role === 'super_admin' && (
              <select value={viewingAsId} onChange={e => setViewingAsId(e.target.value)} className="bg-zinc-900 text-white text-[9px] font-black px-3 py-2 rounded-xl outline-none shadow-xl">
                  <option value="GLOBAL">🌍 GLOBAL VIEW</option>
                  {allUsersList.filter(u => u.role === 'owner').map(u => <option key={u.id} value={u.id}>👤 {u.full_name}</option>)}
              </select>
            )}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-0.5 flex items-center">
              <button onClick={() => { const d = new Date(currentPeriod+'-01'); d.setMonth(d.getMonth()-1); setCurrentPeriod(d.toISOString().slice(0,7)); }} className="p-1.5"><ChevronLeft size={14}/></button>
              <span className="px-2 text-[9px] font-black text-zinc-700 min-w-[50px] text-center uppercase">{getPeriodLabel(currentPeriod)}</span>
              <button onClick={() => { const d = new Date(currentPeriod+'-01'); d.setMonth(d.getMonth()+1); setCurrentPeriod(d.toISOString().slice(0,7)); }} className="p-1.5"><ChevronRight size={14}/></button>
            </div>
            <button onClick={() => { setNotificationsSeen(true); }} className="relative p-2.5 bg-zinc-50 border rounded-xl">
              <Bell size={16}/>
              {!notificationsSeen && (totalPending + dueAlerts.length) > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[7px] font-black rounded-full flex items-center justify-center animate-bounce">{totalPending + dueAlerts.length}</span>}
            </button>
            <button onClick={fetchData} className="p-2.5 bg-zinc-50 border rounded-xl"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/></button>
          </div>
        </header>

        <main className="flex-1 p-4 pb-32 max-w-7xl mx-auto w-full">
          {view === 'dashboard' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center"><h2 className="text-2xl font-black uppercase tracking-tighter">Finance Hub</h2><button onClick={() => setAddPropModal(true)} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl active:scale-90 transition-all"><Plus/></button></div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[{ label: 'Collected', val: stats.earnings, color: 'indigo', type: 'RENT' }, { label: 'Dues', val: stats.due, color: 'rose', type: 'DUES' }, { label: 'Advance', val: stats.advance, color: 'emerald', type: 'ADVANCE' }, { label: 'Security', val: stats.security, color: 'violet', type: 'SECURITY' }].map((s, i) => (
                  <button key={i} onClick={() => {
                    const data = s.type === 'DUES' ? tenants.map(t => ({...t, balance: calculateBalanceAtPeriod(t, ledger, getPeriodLabel(currentPeriod))})).filter(t => t.balance > 0) : ledger.filter(l => l.payment_type === s.type && l.is_verified);
                    setFinanceModal({ open: true, type: s.label, data });
                  }} className={`p-6 rounded-[2rem] bg-${s.color}-50 border border-${s.color}-100 text-left active:scale-95 transition-all`}>
                    <p className="text-[10px] font-black uppercase text-zinc-400">{s.label}</p>
                    <p className={`text-2xl font-black text-${s.color}-600`}>₹{s.val.toLocaleString()}</p>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map(p => (
                  <div key={p.id} className="bg-white border-2 border-zinc-50 rounded-[3rem] p-10 shadow-sm hover:shadow-2xl transition-all relative group">
                    <Building2 size={32} className="text-indigo-600 mb-4"/>
                    <h4 className="text-2xl font-black uppercase">{p.name}</h4>
                    <p className="text-xs text-zinc-400 font-bold uppercase mt-2"><MapPin size={12} className="inline mr-1"/> {p.address}</p>
                    <button onClick={() => { setSelectedProperty(p); setView('inventory'); }} className="mt-8 w-full py-4 bg-zinc-900 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest active:scale-95 shadow-lg flex items-center justify-center gap-2">MANAGE BUILDING <ArrowRight size={14}/></button>
                    <button onClick={() => setSecurityModal({open:true, type:'property', id:p.id})} className="absolute top-10 right-10 opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-rose-500 transition-all"><Trash2/></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'inventory' && <Inventory selectedProperty={selectedProperty} rooms={rooms.filter(r => r.property_id === selectedProperty?.id)} tenants={tenants} ledger={ledger} onRenameRoom={(r, n) => handleBedAction(r, 'rename', n)} onAddRoom={() => setAddRoomModal(true)} onBedAction={handleBedAction} onSecurityAction={(id, type) => setSecurityModal({open:true, type, id})} setView={setView} setPaymentModal={setPaymentModal} setCheckInModal={setCheckInModal} setBookingModal={setBookingModal} calculateBalanceAtPeriod={calculateBalanceAtPeriod} currentPeriodLabel={getPeriodLabel(currentPeriod)} userRole={userProfile?.role} />}
          {view === 'tenants' && <Tenants tenants={tenants} rooms={rooms} ledger={ledger} properties={properties} setPaymentModal={setPaymentModal} setSecurityModal={(id) => setSecurityModal({open:true, type:'tenant', id})} onEditTenant={(t) => setEditTenantModal({open:true, tenant:t})} calculateBalanceAtPeriod={calculateBalanceAtPeriod} currentPeriodLabel={getPeriodLabel(currentPeriod)} userRole={userProfile?.role} />}
          {view === 'maintenance' && <MaintenancePanel userProfile={userProfile} properties={properties} tenants={tenants} rooms={rooms} />}
        </main>

        <nav className="fixed bottom-0 inset-x-0 bg-white border-t p-4 pb-8 z-[200] flex justify-around shadow-2xl">
          <button onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'text-indigo-600' : 'text-zinc-400'}><LayoutDashboard size={24}/></button>
          <button onClick={() => setView('tenants')} className={view === 'tenants' ? 'text-indigo-600' : 'text-zinc-400'}><Users size={24}/></button>
          <button onClick={() => setView('maintenance')} className={view === 'maintenance' ? 'text-indigo-600' : 'text-zinc-400'}><Wrench size={24}/></button>
          <button onClick={() => setView('settings')} className={view === 'settings' ? 'text-indigo-600' : 'text-zinc-400'}><Settings size={24}/></button>
        </nav>

        {/* Global Modals Container */}
        {financeModal.open && (
          <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-end p-0">
            <div className="bg-white h-full w-full max-w-md shadow-2xl flex flex-col animate-in slide-in-from-right">
              <div className="p-8 border-b flex justify-between items-center">
                <h3 className="text-xl font-black uppercase">{financeModal.type} Overview</h3>
                <button onClick={() => setFinanceModal({open:false, data:[]})} className="p-2 bg-zinc-100 rounded-xl"><X/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {financeModal.data.map((item, i) => (
                  <div key={i} className="p-5 bg-zinc-50 rounded-[1.5rem] border border-zinc-100 flex justify-between items-center">
                    <div>
                      <p className="font-black text-sm uppercase text-zinc-900">{item.tenant_name || item.full_name}</p>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase">{item.property_name} • Room {item.room_number}</p>
                      {item.created_at && <p className="text-[9px] text-zinc-300 font-bold mt-1 uppercase flex items-center gap-1"><Clock size={10}/> {new Date(item.created_at).toLocaleString('en-IN')}</p>}
                    </div>
                    <div className="text-right">
                      <p className={`font-black text-lg ${financeModal.type === 'Dues' ? 'text-rose-600' : 'text-emerald-600'}`}>₹{(item.paid_amount || item.balance || 0).toLocaleString()}</p>
                      <p className="text-[8px] font-black text-zinc-300 uppercase">By {item.collected_by || 'Staff'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {paymentModal.open && (
          <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                <div className="p-8 border-b flex justify-between items-center">
                    <div><h3 className="text-xl font-black uppercase tracking-tighter italic">Collect Payment</h3><p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">{paymentModal.tenant?.full_name}</p></div>
                    <button onClick={() => setPaymentModal({open:false, tenant:null})} className="p-2 bg-zinc-100 rounded-xl"><X size={18}/></button>
                </div>
                <form onSubmit={handleRecordPayment} className="p-8 space-y-4">
                    <input name="amount" type="number" required className={INP} placeholder="Amount (₹) *"/>
                    <div className="grid grid-cols-2 gap-3">
                        <select name="payment_type" className={INP}><option value="RENT">Rent</option><option value="SECURITY">Security</option><option value="ADVANCE">Advance</option></select>
                        <select name="payment_mode" className={INP}><option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Bank">Bank</option></select>
                    </div>
                    <input name="billing_month" defaultValue={getPeriodLabel(currentPeriod)} className={INP} placeholder="MM-YYYY"/>
                    <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Save Transaction ✓</button>
                </form>
            </div>
          </div>
        )}

        {addPropModal && (
          <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] w-full max-w-sm p-10 shadow-2xl">
                <div className="flex justify-between items-center mb-8"><h3 className="text-xl font-black uppercase tracking-tighter">New Building</h3><button onClick={()=>setAddPropModal(false)}><X/></button></div>
                <form onSubmit={handleAddProperty} className="space-y-4">
                    <input name="p_n" required className={INP} placeholder="Building Name (e.g. A2 Stay Beta)"/>
                    <input name="p_a" required className={INP} placeholder="Address"/>
                    <input name="p_r" type="number" required className={INP} placeholder="Total Rooms"/>
                    <button type="submit" className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-black uppercase text-xs">Initialize Building ✓</button>
                </form>
            </div>
          </div>
        )}

        {securityModal.open && (
          <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4 text-center">
            <div className="bg-white rounded-[2.5rem] w-full max-w-xs p-10">
              <Lock className="mx-auto text-rose-500 mb-6" size={40}/>
              <h3 className="text-xl font-black uppercase italic tracking-tighter">Verify PIN</h3>
              <input type="password" value={adminPin} onChange={e => {setAdminPin(e.target.value); setAdminErr(false);}} className={`${INP} mt-6 text-center text-2xl tracking-widest font-black border-2 ${adminErr ? 'border-rose-500 bg-rose-50' : ''}`} placeholder="****"/>
              <div className="grid grid-cols-2 gap-3 mt-8">
                <button onClick={() => {setSecurityModal({open:false}); setAdminPin('');}} className="py-4 bg-zinc-100 rounded-2xl font-black text-[10px] uppercase">Cancel</button>
                <button onClick={handleSecurityConfirm} className="py-4 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-rose-500/30">Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthWrapper>
  );
}
