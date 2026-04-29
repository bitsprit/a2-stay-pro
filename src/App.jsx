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
const INP = 'w-full bg-zinc-50 border border-zinc-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-indigo-500';

export default function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [allUsersList, setAllUsersList] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [currentPeriod, setCurrentPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [stats, setStats] = useState({ earnings: 0, due: 0, advance: 0, security: 0 });

  // Modals
  const [addPropModal, setAddPropModal] = useState(false);
  const [addRoomModal, setAddRoomModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState({ open: false, tenant: null });
  const [checkInModal, setCheckInModal] = useState({ open: false, room: null });
  const [bookingModal, setBookingModal] = useState({ open: false, room: null });
  const [securityModal, setSecurityModal] = useState({ open: false, type: null, id: null });
  const [financeModal, setFinanceModal] = useState({ open: false, type: '', data: [] });
  const [adminPin, setAdminPin] = useState('');
  const [adminErr, setAdminErr] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const getPeriodLabel = (dateStr) => { const [y, m] = dateStr.split('-'); return `${m}-${y}`; };

  const calculateBalanceAtPeriod = useCallback((tenant, allLedger, periodLabel) => {
    if (!tenant?.is_active) return 0;
    const rent = Number(tenant.agreed_rent || 0);
    const paid = (allLedger || []).filter(l => l.tenant_id === tenant.id && l.is_verified && l.payment_type === 'RENT' && (l.billing_month === periodLabel || l.payment_for_month === periodLabel))
      .reduce((sum, l) => sum + Number(l.paid_amount || 0), 0);
    return Math.max(rent - paid, 0);
  }, []);

  const fetchData = useCallback(async () => {
    if (!session?.user?.id || !userProfile) return;
    setLoading(true);
    try {
      const targetId = userProfile.role === 'staff' ? userProfile.owner_id : session.user.id;
      const [pRes, rRes, tRes, lRes, uRes] = await Promise.all([
        supabase.from('properties').select('*').eq('owner_id', targetId),
        supabase.from('rooms').select('*').eq('owner_id', targetId).order('room_number'),
        supabase.from('tenants').select('*').eq('owner_id', targetId).eq('is_active', true),
        supabase.from('ledger').select('*').eq('owner_id', targetId).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*')
      ]);

      const tL = tRes.data || []; const pL = pRes.data || []; const rL = rRes.data || []; const uL = uRes.data || [];
      const enrichedLedger = (lRes.data || []).map(l => ({
        ...l,
        tenant_name: tL.find(t => t.id === l.tenant_id)?.full_name || 'Guest',
        property_name: pL.find(p => p.id === l.property_id)?.name || 'NA',
        room_number: rL.find(r => r.id === (tL.find(t => t.id === l.tenant_id)?.room_id || l.room_id))?.room_number || 'NA',
        collected_by: uL.find(u => u.id === l.recorded_by)?.full_name || 'Staff'
      }));

      setProperties(pL); setRooms(rL); setTenants(tL); setLedger(enrichedLedger); setAllUsersList(uL);
      const lbl = getPeriodLabel(currentPeriod);
      setStats({
        earnings: enrichedLedger.filter(l => l.is_verified && l.payment_type === 'RENT' && (l.billing_month === lbl)).reduce((s, c) => s + Number(c.paid_amount), 0),
        due: tL.reduce((s, t) => s + calculateBalanceAtPeriod(t, enrichedLedger, lbl), 0),
        advance: enrichedLedger.filter(l => l.payment_type === 'ADVANCE' && l.billing_month === lbl).reduce((s, c) => s + Number(c.paid_amount), 0),
        security: enrichedLedger.filter(l => l.payment_type === 'SECURITY').reduce((s, c) => s + Number(c.paid_amount), 0)
      });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [session, userProfile, currentPeriod, calculateBalanceAtPeriod]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) supabase.from('profiles').select('*').eq('id', s.user.id).single().then(({ data }) => setUserProfile(data));
    });
  }, []);

  useEffect(() => { if (session && userProfile) fetchData(); }, [fetchData, session, userProfile]);

  if (loading && !userProfile) return <div className="h-screen flex items-center justify-center font-black text-zinc-400 animate-pulse">A2 STAY PRO...</div>;
  if (userProfile?.role === 'tenant') return <AuthWrapper><TenantPortal session={session} /></AuthWrapper>;

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-white text-zinc-900 flex flex-col">
        {toast && <div className="fixed top-4 right-4 z-[9999] px-6 py-3 bg-zinc-900 text-white rounded-2xl shadow-2xl font-black text-xs uppercase">{toast}</div>}
        
        <header className="sticky top-0 z-[100] bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-2"><div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black italic">A2</div><h1 className="font-black text-sm uppercase">{userProfile?.brand_name || 'A2 Stay'}</h1></div>
          <div className="flex items-center gap-2">
            <div className="bg-zinc-50 border rounded-xl p-0.5 flex items-center">
              <button onClick={() => { const d = new Date(currentPeriod+'-01'); d.setMonth(d.getMonth()-1); setCurrentPeriod(d.toISOString().slice(0,7)); }} className="p-1.5"><ChevronLeft size={14}/></button>
              <span className="px-2 text-[10px] font-black">{getPeriodLabel(currentPeriod)}</span>
              <button onClick={() => { const d = new Date(currentPeriod+'-01'); d.setMonth(d.getMonth()+1); setCurrentPeriod(d.toISOString().slice(0,7)); }} className="p-1.5"><ChevronRight size={14}/></button>
            </div>
            <button onClick={fetchData} className="p-2.5 bg-zinc-50 border rounded-xl"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/></button>
          </div>
        </header>

        <main className="flex-1 p-4 pb-32 max-w-7xl mx-auto w-full">
          {view === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in">
              <div className="flex justify-between items-center"><h2 className="text-2xl font-black uppercase">Finance Hub</h2><button onClick={() => setAddPropModal(true)} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl"><Plus/></button></div>
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
                  <div key={p.id} className="bg-white border-2 border-zinc-50 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all relative group">
                    <Building2 size={32} className="text-indigo-600 mb-4"/>
                    <h4 className="text-xl font-black uppercase">{p.name}</h4>
                    <button onClick={() => { setSelectedProperty(p); setView('inventory'); }} className="mt-6 w-full py-4 bg-zinc-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">Manage Building</button>
                    <button onClick={() => setSecurityModal({open:true, type:'property', id:p.id})} className="absolute top-8 right-8 opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-rose-500"><Trash2 size={18}/></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'inventory' && <Inventory selectedProperty={selectedProperty} rooms={rooms} tenants={tenants} ledger={ledger} setView={setView} setPaymentModal={setPaymentModal} setCheckInModal={setCheckInModal} setBookingModal={setBookingModal} onAddRoom={() => setAddRoomModal(true)} onSecurityAction={(id, type) => setSecurityModal({open:true, id, type})} currentPeriodLabel={getPeriodLabel(currentPeriod)} calculateBalanceAtPeriod={calculateBalanceAtPeriod} userRole={userProfile?.role} />}
          {view === 'tenants' && <Tenants tenants={tenants} rooms={rooms} ledger={ledger} properties={properties} setPaymentModal={setPaymentModal} setSecurityModal={(id) => setSecurityModal({open:true, type:'tenant', id})} calculateBalanceAtPeriod={calculateBalanceAtPeriod} currentPeriodLabel={getPeriodLabel(currentPeriod)} userRole={userProfile?.role} />}
          {view === 'maintenance' && <MaintenancePanel userProfile={userProfile} properties={properties} tenants={tenants} rooms={rooms} />}
        </main>

        <nav className="fixed bottom-0 inset-x-0 bg-white border-t p-4 pb-8 z-[100] flex justify-around shadow-2xl">
          <button onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'text-indigo-600' : 'text-zinc-400'}><LayoutDashboard/></button>
          <button onClick={() => setView('tenants')} className={view === 'tenants' ? 'text-indigo-600' : 'text-zinc-400'}><Users/></button>
          <button onClick={() => setView('maintenance')} className={view === 'maintenance' ? 'text-indigo-600' : 'text-zinc-400'}><Wrench/></button>
          <button onClick={() => setView('settings')} className={view === 'settings' ? 'text-indigo-600' : 'text-zinc-400'}><Settings/></button>
        </nav>

        {/* Modals Mapping */}
        {financeModal.open && (
          <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-end p-0">
            <div className="bg-white h-full w-full max-w-md shadow-2xl flex flex-col animate-in slide-in-from-right">
              <div className="p-8 border-b flex justify-between items-center">
                <h3 className="text-xl font-black uppercase">{financeModal.type} Detail</h3>
                <button onClick={() => setFinanceModal({open:false, data:[]})} className="p-2 bg-zinc-100 rounded-xl"><X/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {financeModal.data.map((item, i) => (
                  <div key={i} className="p-5 bg-zinc-50 rounded-2xl border flex justify-between items-center">
                    <div>
                      <p className="font-black text-sm uppercase text-zinc-900">{item.tenant_name || item.full_name}</p>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase">{item.property_name} • Room {item.room_number}</p>
                      {item.created_at && <p className="text-[9px] text-zinc-300 font-bold uppercase flex items-center gap-1 mt-1"><Clock size={10}/> {new Date(item.created_at).toLocaleString()}</p>}
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

        {securityModal.open && (
          <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] w-full max-w-xs p-10 text-center">
              <Lock className="mx-auto text-rose-500 mb-6" size={40}/>
              <h3 className="text-xl font-black uppercase">Verify Admin</h3>
              <input type="password" value={adminPin} onChange={e => {setAdminPin(e.target.value); setAdminErr(false);}} className={`${INP} mt-6 text-center text-2xl tracking-widest font-black ${adminErr ? 'border-rose-500' : ''}`} placeholder="****"/>
              <div className="grid grid-cols-2 gap-3 mt-8">
                <button onClick={() => setSecurityModal({open:false})} className="py-4 bg-zinc-100 rounded-2xl font-black text-[10px] uppercase">Cancel</button>
                <button onClick={async () => {
                  if (adminPin !== ADMIN_CODE) { setAdminErr(true); return; }
                  const table = securityModal.type === 'tenant' ? 'tenants' : securityModal.type === 'property' ? 'properties' : 'rooms';
                  await supabase.from(table).delete().eq('id', securityModal.id);
                  showToast('Action Complete'); setSecurityModal({open:false}); fetchData();
                }} className="py-4 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthWrapper>
  );
}
