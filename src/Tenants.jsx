import React, { useState } from 'react';
import {
  Search, User, Trash2, MessageCircle, Wallet, ShieldCheck, MapPin, Briefcase,
  X, PhoneCall, ChevronLeft, History, Edit3, Phone, Calendar, CheckCircle, ShieldAlert
} from 'lucide-react';

export default function Tenants({
  tenants = [],
  rooms = [],
  ledger = [],
  properties = [],
  setSecurityModal,     // may be undefined for staff
  setPaymentModal,
  setEditTenantModal,   // may be undefined for staff
  calculateBalanceAtPeriod,
  currentPeriodLabel,
  userRole,
}) {
  const [search,         setSearch]         = useState('');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showHistory,    setShowHistory]    = useState(false);
  const [filter,         setFilter]         = useState('all');

  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'super_admin';
  const closeSidebar   = () => { setSelectedTenant(null); setShowHistory(false); };

  const filtered = tenants.filter(t => {
    const matchSearch =
      (t?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (t?.phone_number || '').includes(search);
    if (!matchSearch) return false;
    if (filter === 'pending') return !t.is_verified;
    if (filter === 'due')     { const b = calculateBalanceAtPeriod(t, ledger, currentPeriodLabel); return t.is_verified && b > 0; }
    if (filter === 'settled') { const b = calculateBalanceAtPeriod(t, ledger, currentPeriodLabel); return t.is_verified && b <= 0; }
    return true;
  });

  const verifiedTenants = tenants.filter(t => t.is_verified);
  const totalDue        = verifiedTenants.reduce((s, t) => { const b = calculateBalanceAtPeriod(t, ledger, currentPeriodLabel); return b > 0 ? s + b : s; }, 0);
  const pendingCount    = tenants.filter(t => !t.is_verified).length;

  return (
    <div className="animate-in fade-in pb-28">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Residents</h2>
          <p className="text-xs text-zinc-400 font-medium mt-0.5">{tenants.length} total · {verifiedTenants.length} active</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {totalDue > 0 && isOwnerOrAdmin && (
            <div className="bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"/>
              <span className="text-xs font-black text-rose-600">₹{totalDue.toLocaleString()} due</span>
            </div>
          )}
          {pendingCount > 0 && isOwnerOrAdmin && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 flex items-center gap-2">
              <ShieldAlert size={12} className="text-amber-500"/>
              <span className="text-xs font-black text-amber-700">{pendingCount} pending</span>
            </div>
          )}
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-300"/>
          <input value={search} onChange={e => setSearch(e.target.value)} type="text" placeholder="Search by name or phone…"
            className="w-full bg-white border border-zinc-200 rounded-xl py-3 pl-10 pr-4 text-sm font-semibold shadow-sm outline-none focus:border-indigo-400 transition-all placeholder:text-zinc-400"/>
        </div>
        <div className="flex gap-1 bg-white border border-zinc-200 rounded-xl p-1 shadow-sm flex-shrink-0">
          {[['all','All'],['due','Due'],['settled','Settled'],['pending','Pend']].map(([k, lbl]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
                ${filter === k ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-700'}`}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Tenant list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-20 text-zinc-300">
            <User size={36} className="mb-3"/><p className="font-bold text-sm">No residents found</p>
          </div>
        )}
        {filtered.map(t => {
          const room = rooms.find(r => r.id === t.room_id);
          const prop = properties.find(p => p.id === t.property_id);
          const bal  = calculateBalanceAtPeriod(t, ledger, currentPeriodLabel);
          const isPending = !t.is_verified;

          return (
            <div key={t.id} className={`bg-white border rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all group overflow-hidden
              ${isPending ? 'border-amber-100' : 'border-zinc-100'}`}>

              <button onClick={() => { setSelectedTenant(t); setShowHistory(false); }}
                className="flex items-center gap-3 p-3.5 flex-1 min-w-0 text-left active:bg-zinc-50 transition-all">
                <div className={`flex-shrink-0 w-12 h-11 rounded-xl flex flex-col items-center justify-center text-white text-center transition-all
                  ${isPending ? 'bg-amber-400' : 'bg-zinc-900 group-hover:bg-indigo-600'}`}>
                  <p className="text-[6px] font-bold opacity-70 leading-none truncate w-full text-center px-1 uppercase">{prop?.name || '—'}</p>
                  <p className="text-xs font-black leading-tight">{room?.room_number || '—'}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-black text-sm uppercase tracking-tight text-zinc-900 truncate">{t.full_name}</h4>
                    {isPending && <ShieldAlert size={11} className="text-amber-500 flex-shrink-0"/>}
                  </div>
                  <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest mt-0.5">{t.phone_number}</p>
                </div>
              </button>

              <div className="flex items-center gap-2 pr-3 flex-shrink-0">
                {!isPending && (
                  <div className="hidden sm:block text-right">
                    <p className={`text-xs font-black ${bal > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>₹{Math.abs(bal).toLocaleString()}</p>
                    <p className={`text-[8px] font-bold uppercase tracking-widest ${bal > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{bal > 0 ? 'Due' : 'Settled'}</p>
                  </div>
                )}
                <div className="flex gap-1.5">
                  <button onClick={() => setPaymentModal({ open: true, tenant: t })}
                    className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white active:scale-90 transition-all">
                    <Wallet size={14}/>
                  </button>
                  <button onClick={() => window.open(`https://wa.me/91${t.phone_number}`)}
                    className="p-2.5 bg-zinc-50 text-zinc-400 rounded-xl hover:bg-[#25D366] hover:text-white active:scale-90 transition-all">
                    <MessageCircle size={14}/>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tenant sidebar */}
      {selectedTenant && (
        <div className="fixed inset-0 z-[1000] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeSidebar}/>
          <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-250">

            <div className="flex justify-between items-start px-5 py-4 border-b border-zinc-100 flex-shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black tracking-tight">{selectedTenant.full_name}</h3>
                  {!selectedTenant.is_verified && <span className="text-[7px] bg-amber-100 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full font-black uppercase">Pending</span>}
                </div>
                <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">Tenant Profile</p>
              </div>
              <button onClick={closeSidebar} className="p-2 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-all"><X size={16}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {showHistory ? (
                <div className="space-y-2">
                  <button onClick={() => setShowHistory(false)} className="flex items-center gap-1.5 text-[9px] font-black uppercase text-indigo-500 tracking-widest mb-3">
                    <ChevronLeft size={11}/> Back
                  </button>
                  {ledger.filter(l => l.tenant_id === selectedTenant.id).length === 0 && (
                    <div className="flex flex-col items-center py-10 text-zinc-300"><CheckCircle size={28} className="mb-2"/><p className="text-xs font-bold">No transactions</p></div>
                  )}
                  {ledger.filter(l => l.tenant_id === selectedTenant.id).map(log => (
                    <div key={log.id} className={`p-3 rounded-xl flex justify-between items-center border ${!log.is_verified ? 'bg-amber-50 border-amber-100' : 'bg-zinc-50 border-zinc-100'}`}>
                      <div>
                        <p className="font-black text-sm">₹{Number(log.paid_amount).toLocaleString()}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-[9px] font-bold text-zinc-400">{log.billing_month}</p>
                          {!log.is_verified && <span className="text-[7px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-black uppercase">Pending</span>}
                        </div>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg border
                        ${log.payment_type?.toUpperCase() === 'RENT' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                          log.payment_type?.toUpperCase() === 'SECURITY' ? 'bg-violet-50 text-violet-600 border-violet-100' :
                          'bg-amber-50 text-amber-600 border-amber-100'}`}>
                        {log.payment_type}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {(() => {
                    const bal = calculateBalanceAtPeriod(selectedTenant, ledger, currentPeriodLabel);
                    return (
                      <div className="bg-zinc-900 rounded-2xl p-4 text-white">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">This Month</p>
                        <p className={`text-2xl font-black mt-1 ${bal > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>₹{Math.abs(bal).toLocaleString()}</p>
                        <p className={`text-[9px] font-bold uppercase mt-0.5 ${bal > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{bal > 0 ? 'Due' : 'Settled'}</p>
                        <div className="grid grid-cols-2 gap-2 border-t border-white/10 mt-3 pt-3">
                          <div><p className="text-[9px] text-zinc-500 uppercase font-bold">Rent</p><p className="font-black text-sm">₹{selectedTenant.agreed_rent?.toLocaleString()}</p></div>
                          <div><p className="text-[9px] text-zinc-500 uppercase font-bold">Security</p><p className="font-black text-sm">₹{selectedTenant.security_deposit?.toLocaleString() || '—'}</p></div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => window.open(`tel:${selectedTenant.phone_number}`)}
                      className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-center gap-1.5 text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white hover:border-indigo-600 active:scale-95 transition-all">
                      <Phone size={12}/> Call
                    </button>
                    <button onClick={() => window.open(`https://wa.me/91${selectedTenant.phone_number}`)}
                      className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center gap-1.5 text-[9px] font-black uppercase text-emerald-600 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 active:scale-95 transition-all">
                      <MessageCircle size={12}/> WhatsApp
                    </button>
                  </div>

                  <div className="bg-zinc-50 rounded-xl p-4 space-y-3 border border-zinc-100">
                    {[
                      { icon: Calendar,    color: 'text-indigo-500',  label: 'Joined',    value: selectedTenant.join_date || '—' },
                      { icon: ShieldCheck, color: 'text-emerald-500', label: 'Aadhaar',   value: selectedTenant.aadhaar_number || '—' },
                      { icon: Briefcase,   color: 'text-indigo-500',  label: 'Work',      value: selectedTenant.organization_name || 'Individual' },
                      { icon: MapPin,      color: 'text-rose-500',    label: 'Address',   value: selectedTenant.permanent_address || '—' },
                      { icon: PhoneCall,   color: 'text-rose-500',    label: 'Emergency', value: selectedTenant.emergency_number || '—' },
                    ].map(({ icon: Icon, color, label, value }) => (
                      <div key={label} className="flex items-start gap-2.5">
                        <Icon size={13} className={`${color} mt-0.5 flex-shrink-0`}/>
                        <div>
                          <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">{label}</p>
                          <p className="text-xs font-semibold text-zinc-700 leading-tight mt-0.5">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button onClick={() => setShowHistory(true)}
                    className="w-full p-3 bg-white border border-zinc-200 text-zinc-500 rounded-xl font-black text-[9px] uppercase flex items-center justify-center gap-1.5 tracking-widest hover:bg-indigo-600 hover:text-white hover:border-indigo-600 active:scale-95 transition-all">
                    <History size={13}/> Payment History
                  </button>
                </>
              )}
            </div>

            {!showHistory && (
              <div className="p-4 border-t border-zinc-100 space-y-2 flex-shrink-0">
                <button onClick={() => setPaymentModal({ open: true, tenant: selectedTenant })}
                  className="w-full bg-emerald-500 text-white py-3.5 rounded-xl font-black uppercase text-[9px] flex items-center justify-center gap-1.5 tracking-widest hover:bg-emerald-600 active:scale-95 transition-all shadow-lg shadow-emerald-500/20">
                  <Wallet size={13}/> Record Payment
                </button>
                {isOwnerOrAdmin && (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { if (setEditTenantModal) { setEditTenantModal({ open: true, tenant: selectedTenant }); closeSidebar(); } }}
                      className="py-3 bg-zinc-900 text-white rounded-xl font-black uppercase text-[9px] flex items-center justify-center gap-1.5 tracking-widest hover:bg-indigo-600 active:scale-95 transition-all">
                      <Edit3 size={11}/> Edit
                    </button>
                    <button onClick={() => { if (setSecurityModal) { setSecurityModal({ open: true, type: 'tenant', id: selectedTenant.id }); closeSidebar(); } }}
                      className="py-3 bg-rose-50 text-rose-500 rounded-xl font-black uppercase text-[9px] flex items-center justify-center gap-1.5 tracking-widest hover:bg-rose-500 hover:text-white active:scale-95 transition-all">
                      <Trash2 size={11}/> Remove
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
