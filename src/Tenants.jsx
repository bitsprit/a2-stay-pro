import React, { useState } from 'react';
import {
  Search, User, Trash2, MessageCircle, Wallet, ShieldCheck, MapPin, Briefcase,
  X, PhoneCall, ChevronLeft, History, Edit3, Phone, Calendar, CheckCircle, ShieldAlert, Clock
} from 'lucide-react';

export default function Tenants({
  tenants = [],
  rooms = [],
  ledger = [],
  properties = [],
  setSecurityModal,
  setPaymentModal,
  setEditTenantModal,
  calculateBalanceAtPeriod,
  currentPeriodLabel,
  userRole,
}) {
  const [search,          setSearch]          = useState('');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showHistory,    setShowHistory]    = useState(false);
  const [filter,         setFilter]          = useState('all');

  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'super_admin';
  const closeSidebar   = () => { setSelectedTenant(null); setShowHistory(false); };

  // Helper to safely display Aadhaar (Privacy Redaction)
  const maskAadhaar = (val) => {
    if (!val) return '—';
    return 'XXXX-XXXX-XXXX'; 
  };

  const filtered = tenants.filter(t => {
    const matchSearch =
      (t?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (t?.phone_number || '').includes(search);
    
    if (!matchSearch) return false;
    
    // Default to only showing active tenants unless specifically looking for history
    if (filter === 'history') return !t.is_active;
    if (!t.is_active && filter !== 'all') return false;

    if (filter === 'pending') return !t.is_verified;
    if (filter === 'due')     { const b = calculateBalanceAtPeriod(t, ledger, currentPeriodLabel); return t.is_verified && b > 0; }
    if (filter === 'settled') { const b = calculateBalanceAtPeriod(t, ledger, currentPeriodLabel); return t.is_verified && b <= 0; }
    
    return true;
  });

  const verifiedTenants = tenants.filter(t => t.is_verified && t.is_active);
  const totalDue        = verifiedTenants.reduce((s, t) => { 
    const b = calculateBalanceAtPeriod(t, ledger, currentPeriodLabel); 
    return b > 0 ? s + b : s; 
  }, 0);
  const pendingCount    = tenants.filter(t => !t.is_verified).length;

  return (
    <div className="animate-in fade-in pb-28">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-zinc-900">Residents</h2>
          <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-1">
            {verifiedTenants.length} Active · {tenants.length - verifiedTenants.length} Inactive/Pending
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {totalDue > 0 && isOwnerOrAdmin && (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl px-4 py-2 flex items-center gap-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"/>
              <span className="text-xs font-black text-rose-600">₹{totalDue.toLocaleString()} Due</span>
            </div>
          )}
          {pendingCount > 0 && isOwnerOrAdmin && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-2 flex items-center gap-2 shadow-sm">
              <ShieldAlert size={14} className="text-amber-500"/>
              <span className="text-xs font-black text-amber-700">{pendingCount} Pending Approval</span>
            </div>
          )}
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300"/>
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            type="text" 
            placeholder="Search by name or phone..."
            className="w-full bg-white border border-zinc-200 rounded-[1.25rem] py-3.5 pl-12 pr-4 text-sm font-bold shadow-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all"
          />
        </div>
        <div className="flex gap-1 bg-white border border-zinc-200 rounded-[1.25rem] p-1.5 shadow-sm overflow-x-auto no-scrollbar">
          {[['all','All'],['due','Due'],['settled','Settled'],['pending','Approve'],['history','History']].map(([k, lbl]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap
                ${filter === k ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-600'}`}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Resident Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center py-24 text-zinc-300 bg-white border border-dashed rounded-[2rem]">
            <User size={48} className="mb-4 opacity-20"/>
            <p className="font-black uppercase text-xs tracking-widest">No matching residents found</p>
          </div>
        )}
        {filtered.map(t => {
          const room = rooms.find(r => r.id === t.room_id);
          const prop = properties.find(p => p.id === t.property_id);
          const bal  = calculateBalanceAtPeriod(t, ledger, currentPeriodLabel);
          const isPending = !t.is_verified;
          const isInactive = !t.is_active;

          return (
            <div key={t.id} className={`bg-white border rounded-[1.5rem] flex items-center justify-between p-4 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden
              ${isPending ? 'border-amber-200 bg-amber-50/30' : isInactive ? 'border-zinc-100 opacity-60' : 'border-zinc-100'}`}>
              
              <button onClick={() => { setSelectedTenant(t); setShowHistory(false); }}
                className="flex items-center gap-4 flex-1 min-w-0 text-left">
                <div className={`flex-shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-white text-center transition-all shadow-lg
                  ${isInactive ? 'bg-zinc-400' : isPending ? 'bg-amber-500' : 'bg-zinc-900 group-hover:bg-indigo-600'}`}>
                  <p className="text-[7px] font-black opacity-80 uppercase truncate px-1">{prop?.name || 'NA'}</p>
                  <p className="text-sm font-black tracking-tighter">{room?.room_number || '—'}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-base uppercase tracking-tight text-zinc-900 truncate">{t.full_name}</h4>
                    {isInactive && <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-500 text-[7px] font-black rounded uppercase">Exit</span>}
                  </div>
                  <p className="text-[10px] font-bold text-zinc-400 mt-0.5 tracking-wide">{t.phone_number}</p>
                </div>
              </button>

              <div className="flex items-center gap-3 pr-2">
                {!isPending && !isInactive && (
                  <div className="hidden sm:block text-right">
                    <p className={`text-sm font-black ${bal > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>₹{Math.abs(bal).toLocaleString()}</p>
                    <p className={`text-[8px] font-black uppercase tracking-widest ${bal > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{bal > 0 ? 'Due' : 'Advance'}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setPaymentModal({ open: true, tenant: t })}
                    className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm">
                    <Wallet size={16}/>
                  </button>
                  <button onClick={() => window.open(`https://wa.me/91${t.phone_number}`)}
                    className="p-3 bg-zinc-50 text-zinc-400 rounded-xl hover:bg-[#25D366] hover:text-white transition-all shadow-sm">
                    <MessageCircle size={16}/>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sidebar Profile */}
      {selectedTenant && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={closeSidebar}/>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 rounded-l-[2.5rem]">

            <div className="flex justify-between items-center p-8 border-b border-zinc-50 flex-shrink-0">
              <div>
                <h3 className="text-2xl font-black tracking-tighter text-zinc-900 uppercase">{selectedTenant.full_name}</h3>
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">
                  {selectedTenant.is_active ? 'Verified Resident' : 'Inactive Profile'}
                </p>
              </div>
              <button onClick={closeSidebar} className="p-3 bg-zinc-100 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all"><X size={20}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {showHistory ? (
                <div className="space-y-4">
                  <button onClick={() => setShowHistory(false)} className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-2 mb-6">
                    <ChevronLeft size={14}/> Back to Profile
                  </button>
                  {ledger.filter(l => l.tenant_id === selectedTenant.id).map(log => (
                    <div key={log.id} className={`p-5 rounded-2xl flex justify-between items-center border ${!log.is_verified ? 'bg-amber-50 border-amber-100' : 'bg-zinc-50 border-zinc-100'}`}>
                      <div>
                        <p className="font-black text-lg">₹{Number(log.paid_amount).toLocaleString()}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[9px] font-bold text-zinc-400 uppercase">{log.payment_type} · {log.billing_month}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {!log.is_verified ? (
                          <span className="text-[8px] bg-amber-200 text-amber-700 px-2 py-1 rounded-full font-black uppercase tracking-widest">Awaiting Verification</span>
                        ) : (
                          <CheckCircle size={16} className="text-emerald-500 ml-auto"/>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* Balance Display */}
                  <div className="bg-zinc-900 rounded-[2rem] p-8 text-white shadow-2xl">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Financial Summary</p>
                    {(() => {
                      const bal = calculateBalanceAtPeriod(selectedTenant, ledger, currentPeriodLabel);
                      return (
                        <>
                          <p className={`text-4xl font-black mt-3 tracking-tighter ${bal > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            ₹{Math.abs(bal).toLocaleString()}
                          </p>
                          <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${bal > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {bal > 0 ? 'Current Dues' : 'Advance / Settled'}
                          </p>
                        </>
                      );
                    })()}
                  </div>

                  {/* Personal Records */}
                  <div className="bg-zinc-50 rounded-[2rem] p-6 space-y-5 border border-zinc-100 shadow-inner">
                    {[
                      { icon: Calendar,  color: 'text-indigo-500',  label: 'Agreement Start', value: selectedTenant.join_date },
                      { icon: ShieldCheck, color: 'text-emerald-500', label: 'Identity (Aadhaar)', value: maskAadhaar(selectedTenant.aadhaar_number) },
                      { icon: Briefcase,   color: 'text-indigo-500',  label: 'Affiliation',      value: selectedTenant.organization_name || 'Individual' },
                      { icon: MapPin,      color: 'text-rose-500',    label: 'Native Address',   value: selectedTenant.permanent_address },
                      { icon: PhoneCall,   color: 'text-rose-500',    label: 'Emergency No.',    value: selectedTenant.emergency_number },
                    ].map((item, idx) => (
                      <div key={idx} className="flex gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-zinc-400 shadow-sm border border-zinc-100">
                          <item.icon size={16} className={item.color}/>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{item.label}</p>
                          <p className="text-sm font-black text-zinc-700 leading-tight mt-0.5">{item.value || 'Not provided'}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button onClick={() => setShowHistory(true)}
                    className="w-full py-5 bg-white border-2 border-zinc-100 text-zinc-500 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-3 tracking-[0.2em] hover:bg-zinc-900 hover:text-white transition-all shadow-sm active:scale-95">
                    <History size={16}/> Transaction History
                  </button>
                </>
              )}
            </div>

            <div className="p-8 border-t border-zinc-100 space-y-3 bg-white rounded-b-[2.5rem]">
              {!showHistory && (
                <>
                  <button onClick={() => setPaymentModal({ open: true, tenant: selectedTenant })}
                    className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-500/30 active:scale-95 transition-all">
                    Collect Payment
                  </button>
                  {isOwnerOrAdmin && (
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => { setEditTenantModal({ open: true, tenant: selectedTenant }); closeSidebar(); }}
                        className="py-4 bg-zinc-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">
                        Edit
                      </button>
                      <button onClick={() => { setSecurityModal({ open: true, type: 'tenant', id: selectedTenant.id }); closeSidebar(); }}
                        className="py-4 bg-rose-50 text-rose-500 rounded-2xl font-black text-[10px] uppercase tracking-widest">
                        Check Out
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
