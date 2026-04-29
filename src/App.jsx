/**
 * App.jsx — A2 Stay Pro v5.6 (Total Stability Build)
 * ══════════════════════════════════════════════════════════════
 * FIXES INTEGRATED:
 * 1. Protected session/user access (Prevents null reading crashes)
 * 2. Unified Loading Guard (Profile must be ready before fetch)
 * 3. Safe Modal Mappings (Fallback to empty arrays)
 * 4. Defensive Component Rendering (Internal failure protection)
 * 5. Stabilized Async Fetch Pattern (Prevents infinite loops)
 * 6. Explicit Handler Error Protection (Try-Catch blocks)
 * ══════════════════════════════════════════════════════════════
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import AuthWrapper from './AuthWrapper';
import Inventory from './Inventory';
import Tenants from './Tenants';
import Team from './Team';
import MaintenancePanel from './MaintenancePanel';
import TenantPortal from './TenantPortal';
import {
  X, ShieldCheck, Building2, MapPin, LayoutDashboard,
  RefreshCw, Users, Plus, ChevronLeft, ChevronRight,
  Trash2, Lock, TrendingUp, AlertTriangle, IndianRupee,
  Home, LogOut, Settings, Bell, Download, Loader2, ClipboardList, Wrench, Clock
} from 'lucide-react';

const ADMIN_CODE = 'A2-ADMIN';
const INP = 'w-full bg-zinc-50 border border-zinc-200 px-4 py-3.5 rounded-2xl font-medium text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all placeholder:text-zinc-400 text-zinc-900';

const colorMap = {
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600', border: 'border-indigo-100', icon: 'text-indigo-500' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',   border: 'border-rose-100',   icon: 'text-rose-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', icon: 'text-emerald-500' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-100',  icon: 'text-violet-500' }
};

export default function App() {
  // --- CORE STATE ---
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

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

  // --- UI STATE ---
  const [paymentModal, setPaymentModal] = useState({ open: false, tenant: null });
  const [checkInModal, setCheckInModal] = useState({ open: false, room: null });
  const [securityModal, setSecurityModal] = useState({ open: false, type: null, id: null });
  const [financeModal, setFinanceModal] = useState({ open: false, type: '', data: [] });
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- UTILITIES ---
  const getPeriodLabel = (dateStr) => {
    const [y, m] = dateStr.split('-');
    return `${m}-${y}`;
  };

  const calculateBalanceAtPeriod = (tenant, allLedger, periodLabel) => {
    if (!tenant?.join_date || !tenant?.agreed_rent || !tenant.is_active) return 0;
    const rent = Number(tenant.agreed_rent);
    const paid = (allLedger || [])
      .filter(l => l.tenant_id === tenant.id && l.is_verified && !l.is_rejected && 
              l.payment_type?.toUpperCase() === 'RENT' && 
              (l.payment_for_month === periodLabel || l.billing_month === periodLabel))
      .reduce((sum, l) => sum + Number(l.paid_amount || 0), 0);
    return Math.max(rent - paid, 0);
  };

  // --- DATA ENGINE ---
  const fetchData = useCallback(async () => {
    // #1 Guard: Session must exist
    if (!session?.user?.id || !userProfile) return;
    
    // Bypass for tenants (TenantPortal handles its own fetch)
    if (userProfile.role === 'tenant') {
        setLoading(false);
        return;
    }

    setLoading(true);
    try {
      const targetId = userProfile.role === 'staff' ? userProfile.owner_id : (viewingAsId === 'GLOBAL' || viewingAsId === 'SELF' ? session.user.id : viewingAsId);
      const matchQuery = userProfile.role === 'super_admin' && viewingAsId === 'GLOBAL' ? {} : { owner_id: targetId };

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

      setProperties(pL);
      setRooms(rL);
      setTenants(tL);
      setLedger(lL);
      setAllUsersList(uRes.data || []);

      const lbl = getPeriodLabel(currentPeriod);
      const [sM, sY] = lbl.split('-').map(Number);
      const vL = lL.filter(l => l.is_verified && !l.is_rejected);

      setStats({
        earnings: vL.filter(l => l.payment_type === 'RENT' && (l.billing_month === lbl || l.payment_for_month === lbl)).reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        security: vL.filter(l => l.payment_type === 'SECURITY').reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        advance: vL.filter(l => {
          const d = new Date(l.created_at);
          return l.payment_type === 'ADVANCE' && d.getMonth() + 1 === sM && d.getFullYear() === sY;
        }).reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        due: tL.filter(t => t.is_verified && t.is_active).reduce((s, t) => s + calculateBalanceAtPeriod(t, lL, lbl), 0)
      });
    } catch (e) {
      console.error("Fetch Error:", e);
      showToast("Data sync failed", "error");
    } finally {
      setLoading(false);
    }
  }, [session, userProfile, viewingAsId, currentPeriod]);

  // --- AUTH BOOTSTRAP ---
  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!isMounted) return;
      setSession(s);
      if (s) {
        supabase.from('profiles').select('*').eq('id', s.user.id).single()
          .then(({ data }) => {
            if (isMounted) {
                setUserProfile(data);
                setAuthLoading(false);
            }
          });
      } else {
        setAuthLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (isMounted) setSession(s);
    });

    return () => {
        isMounted = false;
        subscription.unsubscribe();
    };
  }, []);

  // Fetch data only after auth and profile are resolved
  useEffect(() => {
    if (session && userProfile) fetchData();
  }, [session, userProfile, viewingAsId, currentPeriod, fetchData]);

  // --- HANDLERS ---
  const handleCheckIn = async (e) => {
    e.preventDefault();
    try {
      if (!checkInModal.room) throw new Error("No room selected");
      const form = new FormData(e.target);
      const isStaff = userProfile?.role === 'staff';

      const payload = {
        full_name: form.get('t_name'),
        phone_number: form.get('t_phone'),
        aadhaar_number: form.get('t_aadhaar'),
        agreed_rent: Number(form.get('t_rent')),
        security_deposit: Number(form.get('t_security') || 0),
        join_date: form.get('t_join_date'),
        property_id: checkInModal.room.property_id,
        room_id: checkInModal.room.id,
        owner_id: checkInModal.room.owner_id,
        is_active: true,
        is_verified: !isStaff,
        recorded_by: session?.user?.id
      };

      const { data: nt, error } = await supabase.from('tenants').insert([payload]).select().single();
      if (error) throw error;

      if (nt) {
          const lbl = getPeriodLabel(payload.join_date);
          const ledgerEntries = [{
            tenant_id: nt.id, property_id: nt.property_id, billing_month: lbl, payment_for_month: lbl,
            paid_amount: payload.agreed_rent, is_verified: !isStaff, payment_type: 'RENT', 
            payment_mode: form.get('t_pay_mode') || 'Cash', owner_id: nt.owner_id, recorded_by: session?.user?.id
          }];
          await supabase.from('ledger').insert(ledgerEntries);
          await supabase.from('rooms').update({ booked_beds: 0, booked_by_name: null }).eq('id', checkInModal.room.id);
          
          showToast(isStaff ? 'Sent for Approval' : 'Check-in Complete');
          setCheckInModal({ open: false, room: null });
          fetchData();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const exportCSV = () => {
    try {
      if (!tenants?.length) {
        showToast('No tenant data', 'error');
        return;
      }
      const rows = tenants.map((t) => ({
        Name: t?.full_name,
        Phone: t?.phone_number,
        Rent: t?.agreed_rent,
        Property: properties.find(p => p.id === t.property_id)?.name || 'NA'
      }));

      const csv = [
        Object.keys(rows[0]).join(','),
        ...rows.map((r) => Object.values(r).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `A2Stay_Residents_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (err) {
      showToast('CSV export failed', 'error');
    }
  };

  // --- RENDER BLOCKS ---
  if (authLoading || (loading && !userProfile)) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-indigo-600" size={40} />
            <div className="text-zinc-500 font-black tracking-widest text-[10px] uppercase animate-pulse">
                A2 STAY PRO SYNCING...
            </div>
        </div>
      </div>
    );
  }

  if (userProfile?.role === 'tenant') {
    return (
      <AuthWrapper>
        <TenantPortal session={session} />
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white border-b px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Home size={18}/></div>
            <h1 className="font-black text-sm uppercase">{userProfile?.brand_name || 'A2 Stay'}</h1>
          </div>
          <div className="flex items-center gap-2">
            {userProfile?.role === 'super_admin' && (
              <select 
                value={viewingAsId} 
                onChange={e => setViewingAsId(e.target.value)} 
                className="bg-zinc-900 text-white text-[9px] font-black px-3 py-2 rounded-xl outline-none"
              >
                <option value="GLOBAL">GLOBAL</option>
                {(allUsersList || []).filter(u => u.role === 'owner').map(u => (
                    <option key={u.id} value={u.id}>👤 {u.full_name}</option>
                ))}
              </select>
            )}
            <button onClick={fetchData} className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl hover:bg-zinc-100 active:scale-90 transition-all">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 pb-32 max-w-7xl mx-auto w-full">
          {view === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter">Finance Hub</h2>
                <div className="flex gap-2">
                    <button onClick={() => setView('maintenance')} className="p-3 bg-zinc-100 rounded-2xl text-zinc-600"><Wrench size={20}/></button>
                    {userProfile?.role !== 'staff' && <button onClick={exportCSV} className="p-3 bg-zinc-100 rounded-2xl text-zinc-600"><Download size={20}/></button>}
                </div>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Collected', value: stats.earnings, color: 'indigo', icon: TrendingUp, type: 'Earnings' },
                  { label: 'Dues', value: stats.due, color: 'rose', icon: AlertTriangle, type: 'Dues' },
                  { label: 'Advance', value: stats.advance, color: 'emerald', icon: IndianRupee, type: 'Advance' },
                  { label: 'Security', value: stats.security, color: 'violet', icon: ShieldCheck, type: 'Security' },
                ].map((s, i) => {
                  const c = colorMap[s.color] || colorMap.indigo;
                  const lbl = getPeriodLabel(currentPeriod);
                  return (
                    <button 
                      key={i} 
                      onClick={() => {
                        const data = s.type === 'Dues' 
                            ? (tenants || []).filter(t => t.is_verified && t.is_active).map(t => ({...t, balance: calculateBalanceAtPeriod(t, ledger, lbl)})).filter(t => t.balance > 0)
                            : (ledger || []).filter(l => l.is_verified && l.payment_type === s.type.toUpperCase());
                        setFinanceModal({ open: true, type: s.label, data });
                      }} 
                      className={`p-6 rounded-[2.5rem] ${c.bg} border ${c.border} shadow-sm text-left active:scale-95 transition-all`}
                    >
                      <div className={`w-10 h-10 bg-white rounded-2xl flex items-center justify-center mb-4 ${c.icon} shadow-sm`}><s.icon size={20}/></div>
                      <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">{s.label}</p>
                      <p className={`text-2xl font-black ${c.text} mt-1`}>₹{s.value.toLocaleString()}</p>
                    </button>
                  );
                })}
              </div>

              {/* Property Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(properties || []).map(p => (
                  <div key={p.id} className="bg-white border-2 border-zinc-50 rounded-[3rem] p-10 shadow-sm hover:shadow-2xl transition-all">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:rotate-12 transition-transform"><Building2 size={28}/></div>
                    <h4 className="text-2xl font-black tracking-tight text-zinc-900">{p.name}</h4>
                    <p className="text-xs text-zinc-400 font-bold uppercase mt-2 flex items-center gap-1"><MapPin size={12}/> {p.address}</p>
                    <button 
                        onClick={() => { setSelectedProperty(p); setView('inventory'); }} 
                        className="mt-8 w-full py-4 bg-zinc-900 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest hover:bg-indigo-600 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                        MANAGE BUILDING <ArrowRight size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'inventory' && (
            <Inventory 
              selectedProperty={selectedProperty} 
              rooms={rooms} 
              tenants={tenants} 
              ledger={ledger} 
              setView={setView} 
              userRole={userProfile?.role} 
              setPaymentModal={setPaymentModal} 
              setCheckInModal={setCheckInModal}
              calculateBalanceAtPeriod={calculateBalanceAtPeriod}
              currentPeriodLabel={getPeriodLabel(currentPeriod)}
            />
          )}

          {view === 'tenants' && (
            <Tenants 
              tenants={tenants} 
              rooms={rooms} 
              ledger={ledger}
              properties={properties}
              setPaymentModal={setPaymentModal} 
              calculateBalanceAtPeriod={calculateBalanceAtPeriod}
              currentPeriodLabel={getPeriodLabel(currentPeriod)}
              userRole={userProfile?.role}
            />
          )}

          {view === 'maintenance' && (
            <MaintenancePanel 
              userProfile={userProfile} 
              properties={properties} 
              rooms={rooms} 
              tenants={tenants} 
            />
          )}

          {view === 'team' && (
            <Team 
              userProfile={userProfile} 
              allUsersList={allUsersList} 
              onRefreshUsers={fetchData} 
            />
          )}

          {view === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter">My Account</h2>
              <div className="bg-white p-10 rounded-[3rem] border-2 border-zinc-50 shadow-sm">
                <div className="flex items-center gap-6 mb-10 border-b border-zinc-50 pb-10">
                  <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-indigo-400 rounded-3xl flex items-center justify-center text-white text-4xl font-black shadow-2xl">{(userProfile?.full_name || 'U')[0]}</div>
                  <div>
                    <p className="text-3xl font-black tracking-tight">{userProfile?.full_name}</p>
                    <p className="text-zinc-400 font-bold">{session?.user?.email}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <button onClick={() => supabase.auth.signOut()} className="w-full py-5 bg-rose-50 text-rose-600 rounded-2xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 hover:bg-rose-600 hover:text-white transition-all shadow-sm"><LogOut size={18}/> SIGN OUT</button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-zinc-100 p-4 pb-8 z-50 flex justify-around shadow-2xl">
          {[
            { key: 'dashboard', icon: LayoutDashboard, label: 'Hub' },
            { key: 'tenants', icon: Users, label: 'Residents' },
            { key: 'maintenance', icon: Wrench, label: 'Service' },
            { key: 'team', icon: ShieldCheck, label: 'Team', hide: userProfile?.role === 'staff' },
            { key: 'settings', icon: Settings, label: 'Account' },
          ].filter(n => !n.hide).map(n => (
            <button key={n.key} onClick={() => setView(n.key)} 
                className={`flex flex-col items-center gap-1.5 transition-all active:scale-75 ${view === n.key ? 'text-indigo-600' : 'text-zinc-400'}`}>
              <div className={`p-2.5 rounded-2xl ${view === n.key ? 'bg-indigo-50' : ''}`}><n.icon size={22} strokeWidth={2.5}/></div>
              <span className="text-[8px] font-black uppercase tracking-widest">{n.label}</span>
            </button>
          ))}
        </nav>

        {/* --- MODALS --- */}
        {financeModal.open && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-end">
            <div className="bg-white h-full w-full max-w-md shadow-2xl flex flex-col animate-in slide-in-from-right">
              <div className="p-8 border-b flex justify-between items-center">
                <h3 className="text-xl font-black uppercase tracking-tighter">{financeModal.type} Overview</h3>
                <button onClick={() => setFinanceModal({open:false, data:[]})} className="p-2 bg-zinc-100 rounded-xl"><X size={18}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {(financeModal.data || []).map((item, i) => (
                  <div key={i} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex justify-between items-center">
                    <div>
                        <p className="font-black text-sm uppercase">{item?.full_name || item?.name || 'Payment'}</p>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase">{item?.billing_month || item?.payment_type || 'Record'}</p>
                        {item?.created_at && <p className="text-[8px] text-zinc-300 font-bold mt-0.5">{new Date(item.created_at).toLocaleDateString()}</p>}
                    </div>
                    <p className="font-black text-emerald-600">₹{(item?.paid_amount || item?.balance || 0).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {checkInModal.open && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
              <div className="p-8 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Resident Check-In</h3>
                <button onClick={() => setCheckInModal({open:false, room:null})} className="p-2 bg-zinc-100 rounded-xl"><X size={18}/></button>
              </div>
              <form onSubmit={handleCheckIn} className="p-8 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-1 block">Full Name *</label><input name="t_name" required className={INP} /></div>
                    <div><label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-1 block">Mobile *</label><input name="t_phone" required className={INP} /></div>
                    <div><label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-1 block">Aadhaar No.</label><input name="t_aadhaar" className={INP} /></div>
                    <div><label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-1 block">Monthly Rent *</label><input name="t_rent" type="number" required className={INP} /></div>
                    <div><label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-1 block">Security Deposit</label><input name="t_security" type="number" defaultValue={0} className={INP} /></div>
                    <div><label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-1 block">Joining Date *</label><input name="t_join_date" type="date" required className={INP} defaultValue={new Date().toISOString().split('T')[0]}/></div>
                </div>
                <div className="pt-4 border-t border-zinc-50 flex gap-3">
                   <button type="button" onClick={() => setCheckInModal({open:false, room:null})} className="flex-1 py-4 bg-zinc-100 text-zinc-500 rounded-2xl font-black uppercase text-xs">Cancel</button>
                   <button type="submit" className="flex-2 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-500/30">Activate Residency</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Security / Verify Modal */}
        {securityModal.open && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-xs p-10 text-center animate-in zoom-in-95">
              <Lock className="mx-auto text-rose-500 mb-6" size={40}/>
              <h3 className="text-xl font-black uppercase italic tracking-tighter">Verify Admin PIN</h3>
              <p className="text-[10px] text-zinc-400 font-bold uppercase mt-2">PIN required for permanent deletion</p>
              <input type="password" value={adminPin} onChange={e => {setAdminPin(e.target.value); setAdminErr(false);}} className={`${INP} mt-6 text-center text-2xl tracking-[0.4em] font-black border-2 ${adminErr ? 'border-rose-500 bg-rose-50' : ''}`} placeholder="****"/>
              <div className="grid grid-cols-2 gap-3 mt-8">
                <button onClick={() => {setSecurityModal({open:false, type:null, id:null}); setAdminPin('');}} className="py-4 bg-zinc-100 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancel</button>
                <button onClick={async () => {
                    if (adminPin !== ADMIN_CODE) { setAdminErr(true); return; }
                    const table = securityModal.type === 'tenant' ? 'tenants' : securityModal.type === 'room' ? 'rooms' : 'properties';
                    const { error } = await supabase.from(table).delete().eq('id', securityModal.id);
                    if (error) { showToast(error.message, 'error'); }
                    else { showToast('Deleted Successfully'); setSecurityModal({open:false}); fetchData(); }
                    setAdminPin('');
                }} className="py-4 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-rose-500/30 tracking-widest">Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthWrapper>
  );
}
