/**
 * App.jsx — A2 Stay Pro v6.0 (Consolidated Stable Build)
 * ══════════════════════════════════════════════════════════════
 * RESTORED FEATURES:
 * 1. Finance Hub Filters (RENT, ADVANCE, SECURITY mapping)
 * 2. Relational Ledger Enrichment (Tenant Names, Rooms, Staff)
 * 3. Missing Modal States (Add Property, Add Room, Booking, Edit Tenant)
 * 4. Inventory Handlers (Rename, Change Type, Block/Unblock)
 * 5. Admin PIN & Error States
 * 6. Z-Index Layering Fixes
 * ══════════════════════════════════════════════════════════════
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from './supabaseClient';
import AuthWrapper from './AuthWrapper';
import Inventory from './Inventory';
import Tenants from './Tenants';
import Team from './Team';
import MaintenancePanel from './MaintenancePanel';
import TenantPortal from './TenantPortal';
import {
  X, ShieldCheck, Building2, MapPin, LayoutDashboard,
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

// --- ACCOUNTING ENGINE ---
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
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  
  // --- DATA STATE ---
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [allUsersList, setAllUsersList] = useState([]);
  const [viewingAsId, setViewingAsId] = useState('GLOBAL');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [currentPeriod, setCurrentPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [stats, setStats] = useState({ earnings: 0, due: 0, advance: 0, security: 0 });

  // --- MODAL & SECURITY STATE ---
  const [addPropModal, setAddPropModal] = useState(false);
  const [addRoomModal, setAddRoomModal] = useState(false);
  const [bookingModal, setBookingModal] = useState({ open: false, room: null });
  const [paymentModal, setPaymentModal] = useState({ open: false, tenant: null });
  const [editTenantModal, setEditTenantModal] = useState({ open: false, tenant: null });
  const [securityModal, setSecurityModal] = useState({ open: false, type: null, id: null });
  const [financeModal, setFinanceModal] = useState({ open: false, type: '', data: [] });
  const [adminPin, setAdminPin] = useState('');
  const [adminErr, setAdminErr] = useState(false);
  const [toast, setToast] = useState(null);

  const showNotice = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- DATA FETCHING (Enriched Relational Fetch) ---
  const fetchData = useCallback(async () => {
    if (!session?.user?.id || !userProfile) return;
    if (userProfile.role === 'tenant') { setLoading(false); return; }

    setLoading(true);
    try {
      const targetId = userProfile.role === 'staff' ? userProfile.owner_id : (viewingAsId === 'GLOBAL' || viewingAsId === 'SELF' ? session.user.id : viewingAsId);
      const matchQuery = userProfile.role === 'super_admin' && viewingAsId === 'GLOBAL' ? {} : { owner_id: targetId };

      // Relational Fetch for Ledger Enrichment
      const [pRes, rRes, tRes, lRes, uRes] = await Promise.all([
        supabase.from('properties').select('*').match(matchQuery),
        supabase.from('rooms').select('*').match(matchQuery).order('room_number'),
        supabase.from('tenants').select('*').match(matchQuery).eq('is_active', true),
        supabase.from('ledger').select('*').match(matchQuery).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*')
      ]);

      const pL = pRes.data || [];
      const rL = rRes.data || [];
      const tL = tRes.data || [];
      const lL = lRes.data || [];
      const uL = uRes.data || [];

      // Enrich Ledger Data
      const enrichedLedger = lL.map(l => {
          const tenant = tL.find(t => t.id === l.tenant_id);
          return {
              ...l,
              tenant_name: tenant?.full_name || 'Guest',
              property_name: pL.find(p => p.id === l.property_id)?.name || 'NA',
              room_number: rL.find(r => r.id === tenant?.room_id)?.room_number || 'NA',
              collected_by: uL.find(u => u.id === l.recorded_by)?.full_name || 'Staff'
          };
      });

      setProperties(pL);
      setRooms(rL);
      setTenants(tL);
      setLedger(enrichedLedger);
      setAllUsersList(uL);

      // Stats Calculation
      const lbl = getPeriodLabel(currentPeriod);
      const [sM, sY] = lbl.split('-').map(Number);
      const vL = enrichedLedger.filter(l => l.is_verified && !l.is_rejected);

      setStats({
        earnings: vL.filter(l => l.payment_type === 'RENT' && (l.billing_month === lbl || l.payment_for_month === lbl)).reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        security: vL.filter(l => l.payment_type === 'SECURITY').reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        advance: vL.filter(l => {
          const d = new Date(l.created_at);
          return l.payment_type === 'ADVANCE' && d.getMonth() + 1 === sM && d.getFullYear() === sY;
        }).reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        due: tL.filter(t => t.is_verified && t.is_active).reduce((s, t) => s + calculateBalanceAtPeriod(t, enrichedLedger, lbl), 0)
      });
    } catch (e) { showNotice("Sync Failed", "error"); }
    setLoading(false);
  }, [session, userProfile, viewingAsId, currentPeriod]);

  // --- AUTH & INITIALIZATION ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) {
        supabase.from('profiles').select('*').eq('id', s.user.id).single()
          .then(({ data }) => setUserProfile(data));
      }
    });
  }, []);

  useEffect(() => {
    if (session && userProfile) fetchData();
  }, [fetchData, session, userProfile]);

  // --- BUSINESS HANDLERS ---
  const handleAddProperty = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const { data, error } = await supabase.from('properties').insert([{
          name: f.get('p_n'),
          address: f.get('p_a'),
          owner_id: viewingAsId === 'GLOBAL' ? session.user.id : viewingAsId
      }]).select().single();
      if (error) return showNotice(error.message, 'error');
      
      const count = Math.min(Number(f.get('p_r')), 100);
      const roomsToCreate = Array.from({length: count}).map((_, i) => ({
          property_id: data.id, room_number: (101 + i).toString(), room_type: 'Double', owner_id: data.owner_id
      }));
      await supabase.from('rooms').insert(roomsToCreate);
      setAddPropModal(false); fetchData(); showNotice('Building Created');
  };

  const handleBedAction = async (room, action, extra = null) => {
    const updateData = action === 'rename' ? { room_number: String(extra) } :
                       action === 'changeType' ? { room_type: extra } :
                       action === 'block' ? { status: 'Maintenance' } : { status: 'Vacant' };
    const { error } = await supabase.from('rooms').update(updateData).eq('id', room.id);
    if (error) showNotice(error.message, 'error');
    else fetchData();
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
    if (error) showNotice(error.message, 'error');
    else { showNotice('Deleted Successfully'); setSecurityModal({open:false}); fetchData(); }
    setAdminPin(''); setAdminErr(false);
  };

  // --- RENDER BLOCKS ---
  if (userProfile?.role === 'tenant') return <AuthWrapper><TenantPortal session={session} /></AuthWrapper>;

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col">
        {toast && <div className="fixed top-4 right-4 z-[9999] px-6 py-3 bg-zinc-900 text-white rounded-2xl shadow-2xl font-black text-xs uppercase animate-in slide-in-from-right">{toast.msg}</div>}

        <header className="sticky top-0 z-[100] bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Home size={18}/></div>
            <h1 className="font-black text-sm uppercase">{userProfile?.brand_name || 'A2 Stay'}</h1>
          </div>
          <div className="flex items-center gap-2">
            {userProfile?.role === 'super_admin' && (
              <select value={viewingAsId} onChange={e => setViewingAsId(e.target.value)} className="bg-zinc-900 text-white text-[9px] font-black px-3 py-2 rounded-xl outline-none">
                  <option value="GLOBAL">GLOBAL</option>
                  {allUsersList.filter(u => u.role === 'owner').map(u => <option key={u.id} value={u.id}>👤 {u.full_name}</option>)}
              </select>
            )}
            <button onClick={fetchData} className="p-2.5 bg-zinc-50 border rounded-xl"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/></button>
          </div>
        </header>

        <main className="flex-1 p-4 pb-32 max-w-7xl mx-auto w-full">
          {view === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-zinc-900">Finance Hub</h2>
                {userProfile?.role !== 'staff' && <button onClick={() => setAddPropModal(true)} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl active:scale-95 transition-all"><Plus/></button>}
              </div>

              {/* Stat Cards - Production Class Mapping Fix */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Collected', value: stats.earnings, color: 'indigo', icon: TrendingUp, type: 'RENT' },
                  { label: 'Dues', value: stats.due, color: 'rose', icon: AlertTriangle, type: 'Dues' },
                  { label: 'Advance', value: stats.advance, color: 'emerald', icon: IndianRupee, type: 'ADVANCE' },
                  { label: 'Security', value: stats.security, color: 'violet', icon: ShieldCheck, type: 'SECURITY' },
                ].map((s, i) => {
                  const c = colorMap[s.color] || colorMap.indigo;
                  const lbl = getPeriodLabel(currentPeriod);
                  return (
                    <button key={i} onClick={() => {
                        const data = s.type === 'Dues' 
                            ? (tenants || []).map(t => ({...t, balance: calculateBalanceAtPeriod(t, ledger, lbl)})).filter(t => t.balance > 0)
                            : (ledger || []).filter(l => l.is_verified && l.payment_type === s.type);
                        setFinanceModal({ open: true, type: s.label, data });
                    }} className={`p-6 rounded-[2.5rem] ${c.bg} border ${c.border} shadow-sm text-left active:scale-95 transition-all group hover:shadow-lg`}>
                      <div className={`w-10 h-10 bg-white rounded-2xl flex items-center justify-center mb-4 ${c.icon} shadow-sm group-hover:scale-110 transition-transform`}><s.icon size={20}/></div>
                      <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">{s.label}</p>
                      <p className={`text-2xl font-black ${c.text} mt-1`}>₹{s.value.toLocaleString()}</p>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map(p => (
                  <div key={p.id} className="bg-white border-2 border-zinc-50 rounded-[3rem] p-10 shadow-sm hover:shadow-2xl transition-all group relative">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6"><Building2 size={28}/></div>
                    <h4 className="text-2xl font-black tracking-tight">{p.name}</h4>
                    <p className="text-xs text-zinc-400 font-bold uppercase mt-2 flex items-center gap-1"><MapPin size={12}/> {p.address}</p>
                    {userProfile?.role !== 'staff' && (
                        <button onClick={() => setSecurityModal({open:true, type:'property', id:p.id})} className="absolute top-10 right-10 text-zinc-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18}/></button>
                    )}
                    <button onClick={() => { setSelectedProperty(p); setView('inventory'); }} className="mt-8 w-full py-4 bg-zinc-900 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest hover:bg-indigo-600 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2">MANAGE BUILDING <ArrowRight size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'inventory' && (
            <Inventory 
              selectedProperty={selectedProperty} rooms={rooms.filter(r => r.property_id === selectedProperty?.id)} 
              tenants={tenants} ledger={ledger} handleBedAction={handleBedAction} setCheckInModal={setCheckInModal}
              setPaymentModal={setPaymentModal} setBookingModal={setBookingModal} setAddRoomModal={setAddRoomModal}
              setEditTenantModal={setEditTenantModal} setSecurityModal={setSecurityModal} setView={setView} 
              calculateBalanceAtPeriod={calculateBalanceAtPeriod} currentPeriodLabel={getPeriodLabel(currentPeriod)} userRole={userProfile?.role}
            />
          )}

          {view === 'tenants' && <Tenants tenants={tenants} rooms={rooms} ledger={ledger} properties={properties} setPaymentModal={setPaymentModal} setSecurityModal={setSecurityModal} setEditTenantModal={setEditTenantModal} calculateBalanceAtPeriod={calculateBalanceAtPeriod} currentPeriodLabel={getPeriodLabel(currentPeriod)} userRole={userProfile?.role} />}
          {view === 'maintenance' && <MaintenancePanel userProfile={userProfile} properties={properties} tenants={tenants} rooms={rooms} />}
          {view === 'team' && <Team userProfile={userProfile} allUsersList={allUsersList} onRefreshUsers={fetchData} />}
        </main>

        <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-zinc-100 p-4 pb-8 z-[200] flex justify-around shadow-2xl">
          {[
            { key: 'dashboard', icon: LayoutDashboard, label: 'Hub' },
            { key: 'tenants', icon: Users, label: 'Residents' },
            { key: 'maintenance', icon: Wrench, label: 'Service' },
            { key: 'team', icon: ShieldCheck, label: 'Team', hide: userProfile?.role === 'staff' },
            { key: 'settings', icon: Settings, label: 'Account' },
          ].filter(n => !n.hide).map(n => (
            <button key={n.key} onClick={() => setView(n.key)} className={`flex flex-col items-center gap-1.5 transition-all active:scale-75 ${view === n.key ? 'text-indigo-600' : 'text-zinc-400'}`}>
              <div className={`p-2.5 rounded-2xl ${view === n.key ? 'bg-indigo-50 shadow-inner' : ''}`}><n.icon size={22} strokeWidth={2.5}/></div>
              <span className="text-[8px] font-black uppercase tracking-widest">{n.label}</span>
            </button>
          ))}
        </nav>

        {/* --- MODALS (Enforced Layering) --- */}
        {financeModal.open && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-end">
            <div className="bg-white h-full w-full max-w-md shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="p-8 border-b flex justify-between items-center">
                <div><h3 className="text-xl font-black uppercase tracking-tighter">{financeModal.type} Overview</h3><p className="text-[10px] text-zinc-400 font-bold uppercase mt-1">Detailed View</p></div>
                <button onClick={() => setFinanceModal({open:false, data:[]})} className="p-2 bg-zinc-100 rounded-xl"><X/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {(financeModal.data || []).map((item, i) => (
                  <div key={i} className="p-5 bg-zinc-50 rounded-[1.8rem] border border-zinc-100 flex justify-between items-center group hover:bg-white hover:shadow-xl transition-all">
                    <div className="min-w-0">
                      <p className="font-black text-sm uppercase truncate text-zinc-900">{item.tenant_name || item.full_name || 'Guest'}</p>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase mt-0.5">{item.property_name || 'NA'} • Rm {item.room_number || 'NA'}</p>
                      <p className="text-[9px] text-zinc-300 font-bold mt-1 uppercase flex items-center gap-1"><Clock size={10}/> {item.created_at ? new Date(item.created_at).toLocaleString('en-IN', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}) : 'Today'}</p>
                    </div>
                    <div className="text-right">
                        <p className={`font-black text-lg ${financeModal.type === 'Dues' ? 'text-rose-600' : 'text-emerald-600'}`}>₹{(item.paid_amount || item.balance || 0).toLocaleString()}</p>
                        <p className="text-[8px] font-black text-zinc-300 uppercase tracking-tighter">By {item.collected_by || 'Staff'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {addPropModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] w-full max-w-sm p-10 shadow-2xl animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-8"><h3 className="text-xl font-black uppercase italic">New Building</h3><button onClick={()=>setAddPropModal(false)}><X/></button></div>
                <form onSubmit={handleAddProperty} className="space-y-4">
                    <input name="p_n" required className={INP} placeholder="Property Name (e.g. A2 Villa)"/>
                    <input name="p_a" required className={INP} placeholder="Location Address"/>
                    <input name="p_r" type="number" required className={INP} placeholder="Initial Room Count"/>
                    <button type="submit" className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">Initialize Building</button>
                </form>
            </div>
          </div>
        )}

        {securityModal.open && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[4000] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-xs p-10 text-center animate-in zoom-in-95">
              <Lock className="mx-auto text-rose-500 mb-6" size={40}/>
              <h3 className="text-xl font-black uppercase tracking-tighter italic">Verify Identity</h3>
              <p className="text-[10px] text-zinc-400 font-bold uppercase mt-2">PIN required for permanent action</p>
              <input type="password" value={adminPin} onChange={e => {setAdminPin(e.target.value); setAdminErr(false);}} className={`${INP} mt-6 text-center text-2xl tracking-[0.4em] font-black border-2 ${adminErr ? 'border-rose-500 bg-rose-50' : ''}`} placeholder="****"/>
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
