/**
 * TenantPortal.jsx — A2 Stay Pro
 * Self-service portal for tenants:
 * • View own payment history & receipts
 * • See current dues/advance
 * • Raise & track maintenance tickets
 * • Download payment receipt (text-based)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import {
  Home, Wallet, Wrench, FileText, Plus, X, ChevronDown, ChevronUp,
  Clock, CheckCircle2, AlertTriangle, Loader2, LogOut, Bell,
  IndianRupee, Calendar, Phone, MapPin, Download, RefreshCw,
  ArrowRight, Info
} from 'lucide-react';

const INP = 'w-full bg-zinc-50 border border-zinc-200 px-4 py-3.5 rounded-2xl font-medium text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all placeholder:text-zinc-400';

const CATEGORY_ICONS = {
  Plumbing:    '🔧',
  Electrical:  '⚡',
  Furniture:   '🪑',
  AC:          '❄️',
  Cleanliness: '🧹',
  Security:    '🔒',
  Other:       '📋',
};

const PRIORITY_COLORS = {
  Low:    'bg-zinc-100 text-zinc-500',
  Medium: 'bg-amber-50 text-amber-600',
  High:   'bg-orange-50 text-orange-600',
  Urgent: 'bg-rose-50 text-rose-600',
};

const STATUS_META = {
  Open:        { color: 'bg-rose-50 text-rose-600 border-rose-100',       label: 'Open'        },
  'In Progress':{ color: 'bg-amber-50 text-amber-600 border-amber-100',   label: 'In Progress' },
  Resolved:    { color: 'bg-emerald-50 text-emerald-600 border-emerald-100', label: 'Resolved' },
};

export default function TenantPortal({ session }) {
  const [tenantProfile, setTenantProfile] = useState(null);
  const [tenantData,    setTenantData]    = useState(null); // row from tenants table
  const [roomData,      setRoomData]      = useState(null);
  const [propData,      setPropData]      = useState(null);
  const [ledger,        setLedger]        = useState([]);
  const [tickets,       setTickets]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [tab,           setTab]           = useState('overview'); // overview | payments | maintenance
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [toast,         setToast]         = useState(null);
  const [expandedTicket,setExpandedTicket]= useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getPeriodLabel = (dateStr) => {
    const d = new Date(dateStr + '-01');
    return `${String(d.getMonth() + 1).padStart(2,'0')}-${d.getFullYear()}`;
  };

  const currentPeriodLabel = (() => {
    const n = new Date();
    return `${String(n.getMonth()+1).padStart(2,'0')}-${n.getFullYear()}`;
  })();

  // ── Load tenant data ────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      // Get profile
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (!profile) { setLoading(false); return; }
      setTenantProfile(profile);

      // Find tenant row by tenant_id stored in profile, or by phone/email match
      let tenantRow = null;
      if (profile.tenant_id) {
        const { data: t } = await supabase.from('tenants').select('*').eq('id', profile.tenant_id).single();
        tenantRow = t;
      } else {
        // fallback: match by phone
        const { data: t } = await supabase.from('tenants').select('*').eq('phone_number', profile.phone).eq('is_active', true).single();
        tenantRow = t;
      }
      setTenantData(tenantRow);
      if (!tenantRow) { setLoading(false); return; }

      // Load room, property, ledger, tickets in parallel
      const [{ data: room }, { data: prop }, { data: ledg }, { data: tick }] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', tenantRow.room_id).single(),
        supabase.from('properties').select('*').eq('id', tenantRow.property_id).single(),
        supabase.from('ledger').select('*').eq('tenant_id', tenantRow.id).order('created_at', { ascending: false }),
        supabase.from('maintenance_tickets').select('*').eq('tenant_id', tenantRow.id).order('created_at', { ascending: false }),
      ]);
      setRoomData(room);
      setPropData(prop);
      setLedger(ledg || []);
      setTickets(tick || []);
    } catch (e) { console.error('TenantPortal load:', e.message); }
    setLoading(false);
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Accounting ─────────────────────────────────────────────────────────
  const getMonthBalance = (periodLabel) => {
    if (!tenantData?.agreed_rent) return 0;
    const rent = Number(tenantData.agreed_rent);
    const paid = ledger
      .filter(l => l.is_verified && l.payment_type?.toUpperCase() === 'RENT' && (l.billing_month === periodLabel || l.payment_for_month === periodLabel))
      .reduce((s, l) => s + Number(l.paid_amount || 0), 0);
    return Math.max(rent - paid, 0);
  };

  const currentDue = getMonthBalance(currentPeriodLabel);
  const totalPaid  = ledger.filter(l => l.is_verified && l.payment_type?.toUpperCase() === 'RENT').reduce((s, l) => s + Number(l.paid_amount || 0), 0);

  // ── Submit maintenance ticket ───────────────────────────────────────────
  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const f = new FormData(e.target);
    const { error } = await supabase.from('maintenance_tickets').insert([{
      tenant_id:   tenantData.id,
      property_id: tenantData.property_id,
      room_id:     tenantData.room_id,
      owner_id:    tenantData.owner_id,
      title:       f.get('title'),
      description: f.get('description'),
      category:    f.get('category'),
      priority:    f.get('priority'),
      status:      'Open',
    }]);
    if (error) { showToast('Failed to submit: ' + error.message, 'error'); }
    else { showToast('Ticket raised successfully'); setNewTicketOpen(false); e.target.reset(); loadData(); }
    setSubmitting(false);
  };

  // ── Download receipt ────────────────────────────────────────────────────
  const downloadReceipt = (log) => {
    const lines = [
      '═══════════════════════════════════',
      '         A2 STAY PRO',
      '      PAYMENT RECEIPT',
      '═══════════════════════════════════',
      `Tenant   : ${tenantData?.full_name}`,
      `Property : ${propData?.name}`,
      `Room     : ${roomData?.room_number}`,
      `─────────────────────────────────`,
      `Type     : ${log.payment_type}`,
      `Amount   : ₹${Number(log.paid_amount).toLocaleString()}`,
      `Mode     : ${log.payment_mode || '—'}`,
      `Period   : ${log.billing_month}`,
      `Date     : ${new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      `Status   : ${log.is_verified ? 'VERIFIED' : 'PENDING'}`,
      `─────────────────────────────────`,
      `Receipt ID: ${log.id.slice(0,8).toUpperCase()}`,
      '═══════════════════════════════════',
      'Thank you for your payment!',
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const a = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(blob),
      download: `Receipt_${log.billing_month}_${log.id.slice(0,6)}.txt`,
    });
    a.click();
    showToast('Receipt downloaded');
  };

  if (loading) return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
          <Home size={24} className="text-white"/>
        </div>
        <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Loading your portal…</p>
      </div>
    </div>
  );

  if (!tenantData) return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-xl border border-zinc-100">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Info size={26} className="text-amber-500"/>
        </div>
        <h2 className="text-lg font-black mb-2">Profile Not Linked</h2>
        <p className="text-sm text-zinc-500 mb-6">Your tenant profile hasn't been linked yet. Please contact your property manager.</p>
        <button onClick={() => supabase.auth.signOut()} className="w-full py-3.5 bg-zinc-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-500 active:scale-95 transition-all">
          <LogOut size={14} className="inline mr-2"/> Sign Out
        </button>
      </div>
    </div>
  );

  const openTickets     = tickets.filter(t => t.status !== 'Resolved').length;
  const resolvedTickets = tickets.filter(t => t.status === 'Resolved').length;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 flex flex-col">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[5000] px-5 py-3 rounded-2xl shadow-2xl font-black text-[10px] uppercase tracking-widest border-l-4 animate-in slide-in-from-right duration-200
          ${toast.type === 'error' ? 'bg-rose-600 text-white border-white' : 'bg-zinc-900 text-white border-emerald-400'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-zinc-100 shadow-sm sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
              <Home size={15}/>
            </div>
            <div>
              <p className="text-xs font-black leading-none">{propData?.name || 'A2 Stay'}</p>
              <p className="text-[8px] text-zinc-400 font-bold uppercase">Tenant Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadData} className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl"><RefreshCw size={14} className="text-zinc-400"/></button>
            <button onClick={() => supabase.auth.signOut()} className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl"><LogOut size={14} className="text-rose-500"/></button>
          </div>
        </div>
      </header>

      {/* Greeting banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-5">
        <div className="max-w-2xl mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Welcome back</p>
          <h1 className="text-xl font-black tracking-tight mt-0.5">{tenantData.full_name}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="flex items-center gap-1 text-[10px] font-semibold opacity-80">
              <MapPin size={11}/> Room {roomData?.room_number} · {propData?.name}
            </span>
            {currentDue > 0 && (
              <span className="bg-rose-400/30 text-white border border-rose-300/30 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                <AlertTriangle size={9}/> ₹{currentDue.toLocaleString()} Due
              </span>
            )}
            {currentDue === 0 && (
              <span className="bg-emerald-400/20 text-white border border-emerald-300/30 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                <CheckCircle2 size={9}/> Rent Clear
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-zinc-100 sticky top-[57px] z-30">
        <div className="flex max-w-2xl mx-auto px-4">
          {[
            { key: 'overview',     label: 'Overview',   icon: Home    },
            { key: 'payments',     label: 'Payments',   icon: Wallet  },
            { key: 'maintenance',  label: 'Maintenance',icon: Wrench  },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all
                ${tab === key ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}>
              <Icon size={13}/> {label}
              {key === 'maintenance' && openTickets > 0 && (
                <span className="w-4 h-4 bg-rose-500 text-white text-[7px] font-black rounded-full flex items-center justify-center">{openTickets}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-10">
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

          {/* ── OVERVIEW ─────────────────────────────────────────────── */}
          {tab === 'overview' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Balance card */}
              <div className="bg-zinc-900 text-white rounded-3xl p-6">
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">This Month's Status</p>
                {currentDue > 0 ? (
                  <>
                    <p className="text-3xl font-black text-rose-400 mt-1">₹{currentDue.toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-rose-400 uppercase tracking-widest mt-0.5">Rent Due</p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-black text-emerald-400 mt-1">All Clear ✓</p>
                    <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-0.5">Rent Settled</p>
                  </>
                )}
                <div className="grid grid-cols-3 gap-3 border-t border-white/10 mt-4 pt-4 text-xs">
                  <div><p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Monthly Rent</p><p className="font-black">₹{Number(tenantData.agreed_rent).toLocaleString()}</p></div>
                  <div><p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Total Paid</p><p className="font-black">₹{totalPaid.toLocaleString()}</p></div>
                  <div><p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Security</p><p className="font-black">₹{Number(tenantData.security_deposit || 0).toLocaleString()}</p></div>
                </div>
              </div>

              {/* Quick stat cards */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setTab('payments')} className="bg-white border border-zinc-100 rounded-2xl p-5 text-left shadow-sm hover:shadow-lg active:scale-[0.98] transition-all group">
                  <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <FileText size={16} className="text-indigo-500"/>
                  </div>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Payment History</p>
                  <p className="text-xl font-black text-indigo-700 mt-1">{ledger.filter(l=>l.is_verified).length}</p>
                  <p className="text-[9px] text-zinc-300 font-semibold">verified transactions</p>
                </button>
                <button onClick={() => setTab('maintenance')} className="bg-white border border-zinc-100 rounded-2xl p-5 text-left shadow-sm hover:shadow-lg active:scale-[0.98] transition-all group">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${openTickets > 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                    <Wrench size={16} className={openTickets > 0 ? 'text-rose-500' : 'text-emerald-500'}/>
                  </div>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Maintenance</p>
                  <p className={`text-xl font-black mt-1 ${openTickets > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{openTickets}</p>
                  <p className="text-[9px] text-zinc-300 font-semibold">open ticket{openTickets !== 1 ? 's' : ''}</p>
                </button>
              </div>

              {/* Room & property details */}
              <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-4">Your Stay Details</p>
                <div className="space-y-3.5">
                  {[
                    { icon: MapPin,    color: 'text-indigo-500',  label: 'Property',   value: propData?.name },
                    { icon: Home,      color: 'text-indigo-500',  label: 'Room',       value: `${roomData?.room_number} (${roomData?.room_type})` },
                    { icon: Calendar,  color: 'text-emerald-500', label: 'Since',      value: tenantData.join_date },
                    { icon: Phone,     color: 'text-rose-500',    label: 'Emergency',  value: tenantData.emergency_number || '—' },
                  ].map(({ icon: Icon, color, label, value }) => (
                    <div key={label} className="flex items-center gap-3">
                      <Icon size={14} className={`${color} flex-shrink-0`}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">{label}</p>
                        <p className="text-xs font-semibold text-zinc-700 truncate">{value || '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick raise ticket */}
              <button onClick={() => { setTab('maintenance'); setNewTicketOpen(true); }}
                className="w-full flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4 hover:bg-amber-100 active:scale-[0.99] transition-all">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Wrench size={18} className="text-amber-600"/>
                </div>
                <div className="flex-1 text-left">
                  <p className="font-black text-sm text-amber-800">Raise Maintenance Request</p>
                  <p className="text-[9px] text-amber-600 font-semibold">Report an issue with your room or facilities</p>
                </div>
                <ArrowRight size={16} className="text-amber-400 flex-shrink-0"/>
              </button>
            </div>
          )}

          {/* ── PAYMENTS ─────────────────────────────────────────────── */}
          {tab === 'payments' && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black">Payment History</h2>
                <span className="text-xs text-zinc-400 font-semibold">{ledger.length} records</span>
              </div>

              {ledger.length === 0 && (
                <div className="flex flex-col items-center py-16 text-zinc-300">
                  <Wallet size={36} className="mb-3"/><p className="font-bold text-sm">No payment records yet</p>
                </div>
              )}

              {/* Group by month */}
              {(() => {
                const groups = {};
                ledger.forEach(l => {
                  const key = l.billing_month || new Date(l.created_at).toLocaleDateString('en-IN', {month:'short',year:'numeric'});
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(l);
                });
                return Object.entries(groups).map(([month, entries]) => (
                  <div key={month} className="bg-white border border-zinc-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100 flex justify-between items-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{month}</p>
                      <p className="text-xs font-black text-zinc-700">
                        ₹{entries.filter(e=>e.is_verified).reduce((s,e)=>s+Number(e.paid_amount||0),0).toLocaleString()}
                      </p>
                    </div>
                    <div className="divide-y divide-zinc-50">
                      {entries.map(log => (
                        <div key={log.id} className="px-4 py-3.5 flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm
                            ${log.payment_type?.toUpperCase()==='RENT' ? 'bg-indigo-50' :
                              log.payment_type?.toUpperCase()==='SECURITY' ? 'bg-violet-50' : 'bg-amber-50'}`}>
                            {log.payment_type?.toUpperCase()==='RENT' ? '🏠' : log.payment_type?.toUpperCase()==='SECURITY' ? '🔒' : '💰'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-black text-sm">₹{Number(log.paid_amount).toLocaleString()}</p>
                              {!log.is_verified && (
                                <span className="text-[7px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-black uppercase">Pending</span>
                              )}
                            </div>
                            <p className="text-[9px] text-zinc-400 font-semibold">
                              {log.payment_type} · {log.payment_mode || '—'} · {new Date(log.created_at).toLocaleDateString('en-IN', {day:'2-digit',month:'short'})}
                            </p>
                          </div>
                          {log.is_verified && (
                            <button onClick={() => downloadReceipt(log)}
                              className="p-2 bg-zinc-50 border border-zinc-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 active:scale-90 transition-all flex-shrink-0">
                              <Download size={13} className="text-zinc-400"/>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

          {/* ── MAINTENANCE ──────────────────────────────────────────── */}
          {tab === 'maintenance' && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-black">Maintenance</h2>
                  <p className="text-xs text-zinc-400 font-medium mt-0.5">{openTickets} open · {resolvedTickets} resolved</p>
                </div>
                <button onClick={() => setNewTicketOpen(true)}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-500/20">
                  <Plus size={13}/> Raise Ticket
                </button>
              </div>

              {tickets.length === 0 && (
                <div className="flex flex-col items-center py-16 text-zinc-300">
                  <Wrench size={36} className="mb-3"/><p className="font-bold text-sm">No maintenance tickets</p>
                  <p className="text-xs mt-1">Tap "Raise Ticket" to report an issue</p>
                </div>
              )}

              {tickets.map(ticket => {
                const meta   = STATUS_META[ticket.status] || STATUS_META.Open;
                const isOpen = expandedTicket === ticket.id;
                return (
                  <div key={ticket.id} className="bg-white border border-zinc-100 rounded-2xl overflow-hidden shadow-sm">
                    <button onClick={() => setExpandedTicket(isOpen ? null : ticket.id)}
                      className="w-full p-4 text-left">
                      <div className="flex items-start gap-3">
                        <div className="text-xl flex-shrink-0 mt-0.5">
                          {CATEGORY_ICONS[ticket.category] || '📋'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-black text-sm leading-tight">{ticket.title}</p>
                            {isOpen ? <ChevronUp size={15} className="text-zinc-400 flex-shrink-0"/> : <ChevronDown size={15} className="text-zinc-400 flex-shrink-0"/>}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${meta.color}`}>{meta.label}</span>
                            <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span>
                            <span className="text-[8px] text-zinc-400 font-semibold">{ticket.category}</span>
                          </div>
                          <p className="text-[9px] text-zinc-400 font-medium mt-1">
                            <Clock size={9} className="inline mr-1"/>
                            {new Date(ticket.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
                          </p>
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-zinc-50 pt-3 space-y-2 animate-in fade-in duration-150">
                        {ticket.description && (
                          <p className="text-xs text-zinc-600 leading-relaxed">{ticket.description}</p>
                        )}
                        {ticket.status === 'Resolved' && (
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">
                              <CheckCircle2 size={10} className="inline mr-1"/>Resolved
                              {ticket.resolved_at && ` on ${new Date(ticket.resolved_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}`}
                            </p>
                            {ticket.resolve_notes && <p className="text-xs text-emerald-700 font-medium">{ticket.resolve_notes}</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* New ticket modal */}
      {newTicketOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1500] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-250 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center px-6 py-5 border-b border-zinc-100 sticky top-0 bg-white z-10">
              <h3 className="text-base font-black">Raise Maintenance Request</h3>
              <button onClick={() => setNewTicketOpen(false)} className="p-2 bg-zinc-100 rounded-xl"><X size={17}/></button>
            </div>
            <form onSubmit={handleSubmitTicket} className="p-6 space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1.5 block">Issue Title *</label>
                <input name="title" required className={INP} placeholder="e.g. Water leaking from bathroom tap"/>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1.5 block">Description</label>
                <textarea name="description" className={`${INP} h-24 resize-none`} placeholder="Describe the issue in detail…"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1.5 block">Category</label>
                  <select name="category" className={INP}>
                    {Object.keys(CATEGORY_ICONS).map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1.5 block">Priority</label>
                  <select name="priority" className={INP}>
                    <option value="Low">🟢 Low</option>
                    <option value="Medium" selected>🟡 Medium</option>
                    <option value="High">🟠 High</option>
                    <option value="Urgent">🔴 Urgent</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 active:scale-95 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting && <Loader2 size={14} className="animate-spin"/>}
                Submit Request
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
