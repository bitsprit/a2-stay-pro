import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import {
  X, ShieldCheck, Building2, MapPin, LayoutDashboard, RefreshCw, Users, Plus,
  MessageCircle, ChevronLeft, ChevronRight, Trash2, Edit3, Calendar, Wallet,
  Clock, ArrowRight, Hammer, Search, Phone, XCircle, Lock, CheckCircle2,
  TrendingUp, AlertTriangle, IndianRupee, Home, Settings
} from 'lucide-react';

import Inventory from './Inventory';
import Tenants from './Tenants';

const ADMIN_CODE = "A2-ADMIN";

export default function App() {
  const [view, setView] = useState('dashboard');
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [stats, setStats] = useState({ earnings: 0, due: 0, advance: 0, security: 0 });

  const [checkInModal, setCheckInModal] = useState({ open: false, room: null });
  const [bookingModal, setBookingModal] = useState({ open: false, room: null });
  const [securityModal, setSecurityModal] = useState({ open: false, type: null, id: null });
  const [paymentModal, setPaymentModal] = useState({ open: false, tenant: null });
  const [editTenantModal, setEditTenantModal] = useState({ open: false, tenant: null });
  const [addPropModal, setAddPropModal] = useState(false);
  const [addRoomModal, setAddRoomModal] = useState(false);
  const [financeDetail, setFinanceDetail] = useState({ open: false, type: null, data: [] });
  const [adminInput, setAdminInput] = useState('');
  const [adminError, setAdminError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getPeriodLabel = (dateStr) => {
    const [y, m] = dateStr.split('-');
    return `${m}-${y}`;
  };

  // THE CARRY-FORWARD ENGINE
  const calculateBalanceAtPeriod = (tenant, allLedger, targetPeriodLabel) => {
    if (!tenant?.id || !tenant?.join_date || !tenant?.agreed_rent) return 0;
    try {
      const [tM, tY] = targetPeriodLabel.split('-').map(Number);
      const targetDate = new Date(tY, tM - 1, 1);
      const joinDate = new Date(tenant.join_date);
      const joinMonthStart = new Date(joinDate.getFullYear(), joinDate.getMonth(), 1);

      if (targetDate < joinMonthStart) return 0;

      const monthsElapsed = ((tY - joinDate.getFullYear()) * 12) + (tM - (joinDate.getMonth() + 1)) + 1;
      const totalAmountOwed = Math.max(0, monthsElapsed) * Number(tenant.agreed_rent);

      const totalRentPaid = (allLedger || [])
        .filter(l => l.tenant_id === tenant.id && l.is_verified && l.payment_type?.toUpperCase() === 'RENT')
        .reduce((sum, curr) => sum + (Number(curr.paid_amount) || 0), 0);

      let balance = totalAmountOwed - totalRentPaid;

      const today = new Date();
      const isCurrentMonth = (tM === today.getMonth() + 1 && tY === today.getFullYear());
      if (isCurrentMonth && today.getDate() <= 5) {
        if (balance <= Number(tenant.agreed_rent) && balance > 0) return 0;
      }

      return balance;
    } catch (e) { return 0; }
  };

  useEffect(() => { fetchData(); }, [currentPeriod]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: p } = await supabase.from('properties').select('*');
      const { data: r } = await supabase.from('rooms').select('*').order('room_number');
      const { data: t } = await supabase.from('tenants').select('*');
      const { data: l } = await supabase.from('ledger').select('*').order('created_at', { ascending: false });

      setProperties(p || []); setRooms(r || []); setTenants(t || []); setLedger(l || []);

      const label = getPeriodLabel(currentPeriod);
      const [selM, selY] = label.split('-').map(Number);

      const filteredLedger = (l || []).filter(log => {
        if (!log.is_verified) return false;
        if (log.payment_type === 'ADVANCE') {
          const d = new Date(log.created_at);
          return (d.getMonth() + 1 === selM && d.getFullYear() === selY);
        }
        return log.billing_month === label;
      });

      let tDue = 0;
      (t || []).forEach(ten => {
        const bal = calculateBalanceAtPeriod(ten, l, label);
        if (bal > 0) tDue += bal;
      });

      setStats({
        earnings: filteredLedger.filter(l => l.payment_type === 'RENT').reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        security: filteredLedger.filter(l => l.payment_type === 'SECURITY').reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        advance: filteredLedger.filter(l => l.payment_type === 'ADVANCE').reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        due: tDue
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const handleOpenDues = () => {
    const label = getPeriodLabel(currentPeriod);
    const duesData = tenants
      .map(t => ({ ...t, balance: calculateBalanceAtPeriod(t, ledger, label) }))
      .filter(t => t.balance > 0);
    setFinanceDetail({ open: true, type: 'Dues', data: duesData });
  };

  const handleBedAction = async (room, action, extra = null) => {
    if (action === 'book') {
      await supabase.from('rooms').update({
        booked_beds: 1, booked_by_name: extra.name, booked_by_phone: extra.phone,
        advance_amount: Number(extra.amount), booking_date: extra.date
      }).eq('id', room.id);
      await supabase.from('ledger').insert([{
        property_id: room.property_id,
        billing_month: getPeriodLabel(extra.date),
        paid_amount: Number(extra.amount),
        payment_type: 'ADVANCE',
        payment_mode: 'Cash',
        is_verified: true
      }]);
    } else if (action === 'cancel') {
      await supabase.from('rooms').update({ booked_beds: 0, booked_by_name: null, booked_by_phone: null, advance_amount: 0, booking_date: null }).eq('id', room.id);
    } else {
      let up = {};
      if (action === 'block') up = { status: 'Maintenance' };
      else if (action === 'unblock') up = { status: 'Vacant' };
      else if (action === 'rename') up = { room_number: extra };
      else if (action === 'changeType') up = { room_type: extra };
      await supabase.from('rooms').update(up).eq('id', room.id);
    }
    fetchData();
  };

  const handleFinalCheckIn = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const bookedRoom = checkInModal.room;
    const rent = Number(f.get('t_rent'));
    const security = Number(f.get('t_security'));
    const joinDateRaw = f.get('t_join_date');

    const { data: nt } = await supabase.from('tenants').insert([{
      full_name: f.get('t_name'), phone_number: f.get('t_phone'), aadhaar_number: f.get('t_aadhaar'),
      emergency_number: f.get('t_emergency'), organization_name: f.get('t_org_name'), permanent_address: f.get('t_p_address'),
      property_id: selectedProperty.id, room_id: bookedRoom.id, agreed_rent: rent, security_deposit: security, join_date: joinDateRaw
    }]).select().single();

    if (nt) {
      await supabase.from('ledger').insert([
        { tenant_id: nt.id, property_id: selectedProperty.id, billing_month: getPeriodLabel(joinDateRaw), paid_amount: rent, is_verified: true, payment_type: 'RENT', payment_mode: 'CASH' },
        { tenant_id: nt.id, property_id: selectedProperty.id, billing_month: getPeriodLabel(joinDateRaw), paid_amount: security, is_verified: true, payment_type: 'SECURITY', payment_mode: 'CASH' }
      ]);
      await supabase.from('rooms').update({ booked_beds: 0, booked_by_name: null, booked_by_phone: null, advance_amount: 0, booking_date: null }).eq('id', bookedRoom.id);
      setCheckInModal({ open: false, room: null });
      fetchData();
    }
  };

  const handleSecurityConfirm = async () => {
    if (adminInput !== ADMIN_CODE) { setAdminError(true); return; }
    const { type, id } = securityModal;
    if (type === 'tenant') {
      await supabase.from('tenants').delete().eq('id', id);
    } else if (type === 'room') {
      await supabase.from('rooms').delete().eq('id', id);
    } else if (type === 'property') {
      await supabase.from('properties').delete().eq('id', id);
    }
    setSecurityModal({ open: false, type: null, id: null });
    setAdminInput('');
    setAdminError(false);
    fetchData();
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const tenant = paymentModal.tenant;
    await supabase.from('ledger').insert([{
      tenant_id: tenant.id,
      property_id: tenant.property_id,
      billing_month: f.get('billing_month'),
      paid_amount: Number(f.get('amount')),
      payment_type: f.get('payment_type'),
      payment_mode: f.get('payment_mode'),
      is_verified: true,
    }]);
    setPaymentModal({ open: false, tenant: null });
    fetchData();
  };

  const handleEditTenant = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const tenant = editTenantModal.tenant;
    await supabase.from('tenants').update({
      full_name: f.get('t_name'),
      phone_number: f.get('t_phone'),
      agreed_rent: Number(f.get('t_rent')),
      organization_name: f.get('t_org'),
      emergency_number: f.get('t_emergency'),
      permanent_address: f.get('t_address'),
    }).eq('id', tenant.id);
    setEditTenantModal({ open: false, tenant: null });
    fetchData();
  };

  const inputCls = "w-full bg-zinc-50 border border-zinc-200 p-4 rounded-2xl font-medium text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all placeholder:text-zinc-400";

  return (
    <div className="min-h-screen bg-zinc-50 flex font-sans text-zinc-900">

      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* SIDEBAR */}
      <aside className={`fixed md:static inset-y-0 left-0 w-64 bg-[#0F0F23] text-white flex flex-col z-50 shadow-2xl transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Home size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight leading-none">A2 STAY</h1>
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">PRO MANAGEMENT</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
            { label: 'Residents', icon: Users, key: 'tenants' },
          ].map(({ label, icon: Icon, key }) => (
            <button key={key} onClick={() => { setView(key); setSidebarOpen(false); }}
              className={`w-full text-left px-4 py-3.5 rounded-xl font-semibold text-xs flex items-center gap-3 transition-all ${view === key || (key === 'inventory' && view === 'inventory') ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button onClick={fetchData}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:text-emerald-400 hover:bg-white/5 transition-all text-xs font-semibold">
            <RefreshCw size={14} className={loading ? 'animate-spin text-emerald-400' : ''} />
            {loading ? 'Syncing...' : 'Sync Data'}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto min-h-screen">
        {/* Top bar mobile */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-zinc-100 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl bg-zinc-100">
            <Settings size={18} />
          </button>
          <span className="font-black text-sm">A2 STAY PRO</span>
          <div className="w-9" />
        </div>

        <div className="p-6 md:p-10">

          {/* DASHBOARD */}
          {view === 'dashboard' && (
            <div className="animate-in fade-in duration-500">

              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-zinc-900">Finance Hub</h2>
                  <p className="text-sm text-zinc-400 font-medium mt-1">Real-time portfolio overview</p>
                </div>
                <div className="flex items-center gap-2 bg-white border border-zinc-200 p-1.5 rounded-2xl shadow-sm">
                  <button onClick={() => { const d = new Date(currentPeriod + '-01'); d.setMonth(d.getMonth() - 1); setCurrentPeriod(d.toISOString().slice(0, 7)); }}
                    className="p-2 hover:bg-zinc-50 rounded-lg transition-all text-zinc-500">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-4 font-black text-xs min-w-[130px] text-center uppercase tracking-wide">
                    {new Date(currentPeriod + '-02').toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>
                  <button onClick={() => { const d = new Date(currentPeriod + '-01'); d.setMonth(d.getMonth() + 1); setCurrentPeriod(d.toISOString().slice(0, 7)); }}
                    className="p-2 hover:bg-zinc-50 rounded-lg transition-all text-zinc-500">
                    <ChevronRight size={16} />
                  </button>
                  <button onClick={() => setAddPropModal(true)}
                    className="ml-1 bg-indigo-500 text-white p-2.5 rounded-xl shadow-md shadow-indigo-500/20 hover:bg-indigo-600 transition-all">
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                {[
                  {
                    label: 'Earnings', value: stats.earnings, color: 'indigo', icon: TrendingUp,
                    onClick: () => setFinanceDetail({ open: true, type: 'Earnings', data: ledger.filter(l => l.billing_month === getPeriodLabel(currentPeriod) && l.payment_type?.toUpperCase() === 'RENT') })
                  },
                  {
                    label: 'Security', value: stats.security, color: 'violet', icon: ShieldCheck,
                    onClick: () => setFinanceDetail({ open: true, type: 'Security', data: ledger.filter(l => l.billing_month === getPeriodLabel(currentPeriod) && l.payment_type?.toUpperCase() === 'SECURITY') })
                  },
                  {
                    label: 'Advance', value: stats.advance, color: 'emerald', icon: IndianRupee,
                    onClick: () => setFinanceDetail({ open: true, type: 'Advance Receipts', data: ledger.filter(l => { const d = new Date(l.created_at); return `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}` === getPeriodLabel(currentPeriod) && l.payment_type === 'ADVANCE'; }) })
                  },
                  { label: 'Total Dues', value: stats.due, color: 'rose', icon: AlertTriangle, onClick: handleOpenDues },
                ].map(({ label, value, color, icon: Icon, onClick }) => {
                  const colorMap = {
                    indigo: 'bg-indigo-500 shadow-indigo-500/20',
                    violet: 'bg-violet-500 shadow-violet-500/20',
                    emerald: 'bg-emerald-500 shadow-emerald-500/20',
                    rose: 'bg-rose-500 shadow-rose-500/20',
                  };
                  const textMap = { indigo: 'text-indigo-600', violet: 'text-violet-600', emerald: 'text-emerald-600', rose: 'text-rose-600' };
                  const bgMap = { indigo: 'bg-indigo-50', violet: 'bg-violet-50', emerald: 'bg-emerald-50', rose: 'bg-rose-50' };
                  return (
                    <button key={label} onClick={onClick}
                      className="bg-white border border-zinc-100 rounded-3xl p-6 text-left hover:shadow-lg transition-all group active:scale-98 shadow-sm">
                      <div className={`w-10 h-10 ${bgMap[color]} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                        <Icon size={18} className={textMap[color]} />
                      </div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{label}</p>
                      <p className={`text-2xl font-black tracking-tight ${textMap[color]}`}>₹{value.toLocaleString()}</p>
                    </button>
                  );
                })}
              </div>

              {/* Properties */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black tracking-tight">Properties</h3>
                <span className="text-xs text-zinc-400 font-semibold">{properties.length} Buildings</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {properties.map(p => {
                  const propRooms = rooms.filter(r => r.property_id === p.id);
                  const propTenants = tenants.filter(t => t.property_id === p.id);
                  const occupancy = propRooms.length > 0 ? Math.round((propTenants.length / propRooms.length) * 100) : 0;
                  return (
                    <div key={p.id} className="bg-white rounded-3xl p-7 border border-zinc-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-t-3xl" />
                      <button onClick={(e) => { e.stopPropagation(); setSecurityModal({ open: true, type: 'property', id: p.id }); }}
                        className="absolute top-6 right-6 p-2 text-zinc-300 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                        <Trash2 size={16} />
                      </button>
                      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5">
                        <Building2 size={24} className="text-indigo-500" />
                      </div>
                      <h4 className="text-xl font-black tracking-tight mb-1">{p.name}</h4>
                      <p className="text-xs text-zinc-400 font-medium flex items-center gap-1 mb-5">
                        <MapPin size={12} /> {p.address}
                      </p>
                      <div className="flex items-center gap-4 mb-5 text-xs">
                        <div><p className="text-zinc-400 font-medium">Rooms</p><p className="font-black text-lg">{propRooms.length}</p></div>
                        <div><p className="text-zinc-400 font-medium">Tenants</p><p className="font-black text-lg">{propTenants.length}</p></div>
                        <div className="ml-auto">
                          <p className="text-zinc-400 font-medium text-right">Occupancy</p>
                          <p className={`font-black text-lg text-right ${occupancy > 70 ? 'text-emerald-500' : 'text-amber-500'}`}>{occupancy}%</p>
                        </div>
                      </div>
                      <div className="w-full bg-zinc-100 rounded-full h-1.5 mb-5">
                        <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${occupancy}%` }} />
                      </div>
                      <button onClick={() => { setSelectedProperty(p); setView('inventory'); }}
                        className="w-full py-3.5 bg-zinc-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-2">
                        Manage Building <ArrowRight size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'inventory' && (
            <Inventory
              selectedProperty={selectedProperty}
              rooms={rooms.filter(r => r.property_id === selectedProperty?.id)}
              tenants={tenants}
              ledger={ledger}
              handleBedAction={handleBedAction}
              setCheckInModal={setCheckInModal}
              setPaymentModal={setPaymentModal}
              setSecurityModal={setSecurityModal}
              setBookingModal={setBookingModal}
              setAddRoomModal={setAddRoomModal}
              setEditTenantModal={setEditTenantModal}
              setView={setView}
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
              setSecurityModal={setSecurityModal}
              setPaymentModal={setPaymentModal}
              setEditTenantModal={setEditTenantModal}
              calculateBalanceAtPeriod={calculateBalanceAtPeriod}
              currentPeriodLabel={getPeriodLabel(currentPeriod)}
            />
          )}
        </div>
      </main>

      {/* ─── FINANCE DETAIL MODAL ─── */}
      {financeDetail.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-end">
          <div className="bg-white h-full w-full max-w-xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex justify-between items-center p-8 border-b border-zinc-100">
              <div>
                <h3 className="text-xl font-black tracking-tight">{financeDetail.type}</h3>
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-widest mt-0.5">Detailed Breakdown</p>
              </div>
              <button onClick={() => setFinanceDetail({ open: false })} className="p-2.5 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-all"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {financeDetail.data.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-zinc-300">
                  <CheckCircle2 size={40} className="mb-3" />
                  <p className="font-bold text-sm">Nothing here</p>
                </div>
              )}
              {financeDetail.data.map((item, idx) => {
                const t = tenants.find(ten => ten.id === item.tenant_id) || item;
                const prop = properties.find(p => p.id === t.property_id);
                const room = rooms.find(rm => rm.id === t.room_id) || item;
                return (
                  <div key={idx} className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100 flex justify-between items-center hover:bg-white hover:shadow-sm transition-all">
                    <div className="flex items-center gap-4">
                      <div className="min-w-[60px] h-12 bg-white rounded-xl flex flex-col items-center justify-center shadow-sm border border-zinc-100">
                        <p className="text-[8px] leading-tight text-zinc-400 uppercase font-bold truncate w-full text-center px-1">{prop?.name || '—'}</p>
                        <p className="text-sm font-black text-zinc-900">{room?.room_number || 'NA'}</p>
                      </div>
                      <div>
                        <p className="font-black text-sm uppercase tracking-tight">{t.full_name || item.booked_by_name}</p>
                        <p className="text-[9px] font-semibold text-zinc-400 uppercase flex items-center gap-1 mt-0.5">
                          <Clock size={9} />
                          {item.join_date ? `Since ${item.join_date}` : new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className={`text-lg font-black ${financeDetail.type === 'Dues' ? 'text-rose-500' : 'text-emerald-600'}`}>
                        ₹{(item.paid_amount || item.balance || item.advance_amount || 0).toLocaleString()}
                      </p>
                      {financeDetail.type === 'Dues' && (
                        <button onClick={() => window.open(`https://wa.me/91${t.phone_number}?text=Reminder: Rent due ₹${item.balance}`)}
                          className="p-2.5 bg-emerald-50 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all">
                          <MessageCircle size={16} />
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

      {/* ─── CHECK-IN MODAL ─── */}
      {checkInModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1500] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-y-auto max-h-[95vh] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-8 border-b border-zinc-100">
              <div>
                <h3 className="text-xl font-black tracking-tight">Register Tenant</h3>
                <p className="text-xs text-zinc-400 font-medium mt-0.5">Room {checkInModal.room?.room_number}</p>
              </div>
              <button onClick={() => setCheckInModal({ open: false, room: null })} className="p-2.5 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-all"><X size={18} /></button>
            </div>
            <form onSubmit={handleFinalCheckIn} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <input name="t_name" defaultValue={checkInModal.room?.booked_by_name || ""} required className={inputCls} placeholder="Full Name *" />
                <div className="grid grid-cols-2 gap-3">
                  <input name="t_phone" defaultValue={checkInModal.room?.booked_by_phone || ""} required className={inputCls} placeholder="Mobile *" />
                  <input name="t_aadhaar" required className={inputCls} placeholder="Aadhaar *" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input name="t_emergency" className={inputCls} placeholder="Emergency No." />
                  <input name="t_org_name" className={inputCls} placeholder="College / Company" />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1 block">Joining Date *</label>
                  <input name="t_join_date" type="date" defaultValue={checkInModal.room?.booking_date || ""} required className={inputCls} />
                </div>
                <textarea name="t_p_address" required className={`${inputCls} h-24 resize-none`} placeholder="Permanent Address *" />
              </div>
              <div className="space-y-4">
                {(checkInModal.room?.advance_amount > 0) && (
                  <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl">
                    <p className="text-[9px] font-black uppercase text-indigo-400 tracking-widest mb-1">Advance Received (Will be adjusted)</p>
                    <p className="text-2xl font-black text-indigo-600">₹{checkInModal.room.advance_amount.toLocaleString()}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black uppercase text-rose-400 tracking-widest mb-1 block">Monthly Rent *</label>
                    <input name="t_rent" type="number" required className={`${inputCls} border-rose-200 bg-rose-50`} placeholder="₹ 0" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-indigo-400 tracking-widest mb-1 block">Security Deposit *</label>
                    <input name="t_security" type="number" required className={`${inputCls} border-indigo-200 bg-indigo-50`} placeholder="₹ 0" />
                  </div>
                </div>
                <div className="pt-4">
                  <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">
                    Complete Check-in ✓
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── BOOKING MODAL ─── */}
      {bookingModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1500] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-7 border-b border-zinc-100">
              <div>
                <h3 className="text-lg font-black">Reserve Room</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Room {bookingModal.room?.room_number}</p>
              </div>
              <button onClick={() => setBookingModal({ open: false, room: null })} className="p-2.5 bg-zinc-100 rounded-xl"><X size={18} /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.target);
              await handleBedAction(bookingModal.room, 'book', { name: f.get('b_name'), phone: f.get('b_phone'), amount: f.get('b_amount'), date: f.get('b_date') });
              setBookingModal({ open: false, room: null });
            }} className="p-7 space-y-4">
              <input name="b_name" required className={inputCls} placeholder="Guest Name *" />
              <input name="b_phone" required className={inputCls} placeholder="Mobile *" />
              <input name="b_amount" type="number" required className={inputCls} placeholder="Advance Amount (₹) *" />
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1 block">Booking Date</label>
                <input name="b_date" type="date" required className={inputCls} />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all mt-2">
                Confirm Booking
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── PAYMENT MODAL ─── */}
      {paymentModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1500] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-7 border-b border-zinc-100">
              <div>
                <h3 className="text-lg font-black">Record Payment</h3>
                <p className="text-xs text-zinc-400 mt-0.5">{paymentModal.tenant?.full_name}</p>
              </div>
              <button onClick={() => setPaymentModal({ open: false, tenant: null })} className="p-2.5 bg-zinc-100 rounded-xl"><X size={18} /></button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-7 space-y-4">
              <input name="amount" type="number" required className={inputCls} placeholder="Amount (₹) *" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1 block">Type</label>
                  <select name="payment_type" className={inputCls}>
                    <option value="RENT">Rent</option>
                    <option value="SECURITY">Security</option>
                    <option value="ADVANCE">Advance</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1 block">Mode</label>
                  <select name="payment_mode" className={inputCls}>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1 block">Billing Month (MM-YYYY)</label>
                <input name="billing_month" defaultValue={getPeriodLabel(currentPeriod)} className={inputCls} placeholder="04-2025" />
              </div>
              <button type="submit" className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20">
                Record Payment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT TENANT MODAL ─── */}
      {editTenantModal.open && editTenantModal.tenant && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1500] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-7 border-b border-zinc-100">
              <div>
                <h3 className="text-lg font-black">Edit Tenant</h3>
                <p className="text-xs text-zinc-400 mt-0.5">{editTenantModal.tenant.full_name}</p>
              </div>
              <button onClick={() => setEditTenantModal({ open: false, tenant: null })} className="p-2.5 bg-zinc-100 rounded-xl"><X size={18} /></button>
            </div>
            <form onSubmit={handleEditTenant} className="p-7 space-y-4">
              <input name="t_name" defaultValue={editTenantModal.tenant.full_name} required className={inputCls} placeholder="Full Name" />
              <input name="t_phone" defaultValue={editTenantModal.tenant.phone_number} required className={inputCls} placeholder="Mobile" />
              <input name="t_rent" type="number" defaultValue={editTenantModal.tenant.agreed_rent} required className={inputCls} placeholder="Monthly Rent" />
              <input name="t_org" defaultValue={editTenantModal.tenant.organization_name} className={inputCls} placeholder="Organization" />
              <input name="t_emergency" defaultValue={editTenantModal.tenant.emergency_number} className={inputCls} placeholder="Emergency Number" />
              <textarea name="t_address" defaultValue={editTenantModal.tenant.permanent_address} className={`${inputCls} h-20 resize-none`} placeholder="Address" />
              <button type="submit" className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-600 transition-all">
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── ADD ROOM MODAL ─── */}
      {addRoomModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1500] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-7 border-b border-zinc-100">
              <h3 className="text-lg font-black">Add Room</h3>
              <button onClick={() => setAddRoomModal(false)} className="p-2.5 bg-zinc-100 rounded-xl"><X size={18} /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.target);
              await supabase.from('rooms').insert([{
                property_id: selectedProperty?.id,
                room_number: f.get('r_number'),
                room_type: f.get('r_type'),
                status: 'Vacant'
              }]);
              setAddRoomModal(false);
              fetchData();
            }} className="p-7 space-y-4">
              <input name="r_number" required className={inputCls} placeholder="Room Number (e.g. 101)" />
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1 block">Room Type</label>
                <select name="r_type" className={inputCls}>
                  <option value="Single">Single</option>
                  <option value="Double">Double</option>
                  <option value="Triple">Triple</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-600 transition-all">
                Add Room
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── ADD PROPERTY MODAL ─── */}
      {addPropModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1500] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-7 border-b border-zinc-100">
              <h3 className="text-lg font-black">Setup Building</h3>
              <button onClick={() => setAddPropModal(false)} className="p-2.5 bg-zinc-100 rounded-xl"><X size={18} /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.target);
              const { data } = await supabase.from('properties').insert([{ name: f.get('p_name'), address: f.get('p_address') }]).select().single();
              if (data) {
                const count = Number(f.get('p_rooms'));
                const payload = Array.from({ length: count }).map((_, i) => ({
                  property_id: data.id, room_number: (101 + i).toString(), room_type: 'Double', status: 'Vacant'
                }));
                await supabase.from('rooms').insert(payload);
              }
              setAddPropModal(false);
              fetchData();
            }} className="p-7 space-y-4">
              <input name="p_name" required className={inputCls} placeholder="Building Name (e.g. B-91)" />
              <input name="p_address" required className={inputCls} placeholder="Full Address" />
              <input name="p_rooms" type="number" min="1" max="100" required className={inputCls} placeholder="Number of Rooms to Generate" />
              <button type="submit" className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-600 transition-all">
                Generate Property
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── SECURITY/DELETE MODAL ─── */}
      {securityModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 p-8">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock size={24} className="text-rose-500" />
              </div>
              <h3 className="text-lg font-black">Admin Verification</h3>
              <p className="text-xs text-zinc-400 mt-1">This action is irreversible. Enter admin code to continue.</p>
            </div>
            <input
              type="password"
              value={adminInput}
              onChange={(e) => { setAdminInput(e.target.value); setAdminError(false); }}
              className={`${inputCls} text-center tracking-widest font-black text-lg mb-1 ${adminError ? 'border-rose-400 bg-rose-50' : ''}`}
              placeholder="Admin Code"
              autoFocus
            />
            {adminError && <p className="text-rose-500 text-[10px] font-bold text-center mb-4">Invalid code. Try again.</p>}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button onClick={() => { setSecurityModal({ open: false, type: null, id: null }); setAdminInput(''); setAdminError(false); }}
                className="py-3 bg-zinc-100 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-zinc-200 transition-all">
                Cancel
              </button>
              <button onClick={handleSecurityConfirm}
                className="py-3 bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20">
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}