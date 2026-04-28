import React, { useState } from 'react';
import {
  Search, User, Trash2, MessageCircle, Wallet, ShieldCheck, MapPin, Briefcase,
  X, PhoneCall, ChevronLeft, History, Edit3, Phone, Calendar, CheckCircle
} from 'lucide-react';

export default function Tenants({
  tenants = [], rooms = [], ledger = [], properties = [],
  setSecurityModal, setPaymentModal, setEditTenantModal,
  calculateBalanceAtPeriod, currentPeriodLabel
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [filter, setFilter] = useState('all'); // all | due | advance

  const filtered = tenants.filter(t => {
    const matchesSearch =
      (t?.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t?.phone_number || "").includes(searchTerm);
    if (!matchesSearch) return false;
    if (filter === 'all') return true;
    const bal = calculateBalanceAtPeriod(t, ledger, currentPeriodLabel);
    if (filter === 'due') return bal > 0;
    if (filter === 'advance') return bal <= 0;
    return true;
  });

  const totalDue = tenants.reduce((sum, t) => {
    const bal = calculateBalanceAtPeriod(t, ledger, currentPeriodLabel);
    return bal > 0 ? sum + bal : sum;
  }, 0);

  return (
    <div className="animate-in fade-in duration-300 pb-24">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-zinc-900">Tenant Portfolio</h2>
          <p className="text-xs text-zinc-400 font-medium mt-1">{tenants.length} residents across all properties</p>
        </div>
        {totalDue > 0 && (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl px-4 py-2.5 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            <span className="text-xs font-black text-rose-600">₹{totalDue.toLocaleString()} total outstanding</span>
          </div>
        )}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            className="w-full bg-white border border-zinc-200 rounded-2xl py-3 pl-11 pr-4 font-semibold text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all shadow-sm placeholder:text-zinc-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 bg-white border border-zinc-200 rounded-2xl p-1 shadow-sm">
          {[
            { key: 'all', label: 'All' },
            { key: 'due', label: 'Due' },
            { key: 'advance', label: 'Advance' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all
                ${filter === key ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-700'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tenant List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-300">
            <User size={40} className="mb-3" />
            <p className="font-bold text-sm">No tenants found</p>
          </div>
        )}

        {filtered.map(t => {
          const room = rooms.find(r => r.id === t.room_id);
          const property = properties.find(p => p.id === t.property_id);
          const bal = calculateBalanceAtPeriod(t, ledger, currentPeriodLabel);

          return (
            <div key={t.id}
              className="bg-white border border-zinc-100 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all group overflow-hidden">

              {/* Left: property tag + tenant info */}
              <button
                onClick={() => { setSelectedTenant(t); setShowHistory(false); }}
                className="flex items-center gap-4 p-4 flex-1 min-w-0 text-left">
                <div className="flex-shrink-0 w-14 h-12 bg-zinc-900 group-hover:bg-indigo-600 rounded-xl flex flex-col items-center justify-center text-white transition-all">
                  <p className="text-[7px] font-bold opacity-60 leading-none truncate w-full text-center px-1 uppercase">{property?.name || '—'}</p>
                  <p className="text-sm font-black leading-tight">{room?.room_number || 'N/A'}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-black text-sm uppercase tracking-tight text-zinc-900 truncate">{t.full_name}</h4>
                  <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest mt-0.5">{t.phone_number}</p>
                </div>
              </button>

              {/* Right: balance + actions */}
              <div className="flex items-center gap-3 pr-4">
                <div className="hidden sm:block text-right">
                  <p className={`text-xs font-black ${bal > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    ₹{Math.abs(bal).toLocaleString()}
                  </p>
                  <p className={`text-[8px] font-bold uppercase tracking-widest ${bal > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {bal > 0 ? 'Due' : 'Advance'}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setPaymentModal({ open: true, tenant: t })}
                    className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all">
                    <Wallet size={15} />
                  </button>
                  <button
                    onClick={() => window.open(`https://wa.me/91${t.phone_number}`)}
                    className="p-2.5 bg-zinc-50 text-zinc-400 rounded-xl hover:bg-[#25D366] hover:text-white transition-all">
                    <MessageCircle size={15} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── TENANT DETAIL SIDEBAR ─── */}
      {selectedTenant && (
        <div className="fixed inset-0 z-[1000] flex justify-end">
          <div className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm" onClick={() => { setSelectedTenant(null); setShowHistory(false); }} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

            {/* Header */}
            <div className="flex justify-between items-start p-7 border-b border-zinc-100">
              <div>
                <h3 className="text-xl font-black tracking-tight leading-tight">{selectedTenant.full_name}</h3>
                <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mt-1">Tenant Profile</p>
              </div>
              <button onClick={() => { setSelectedTenant(null); setShowHistory(false); }}
                className="p-2.5 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-all">
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {showHistory ? (
                <div className="space-y-3">
                  <button onClick={() => setShowHistory(false)}
                    className="flex items-center gap-2 text-[9px] font-black uppercase text-indigo-500 tracking-widest mb-2">
                    <ChevronLeft size={12} /> Back to Profile
                  </button>
                  {(ledger || []).filter(l => l.tenant_id === selectedTenant.id).length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 text-zinc-300">
                      <CheckCircle size={32} className="mb-2" />
                      <p className="text-xs font-bold">No transactions yet</p>
                    </div>
                  )}
                  {(ledger || []).filter(l => l.tenant_id === selectedTenant.id).map(log => (
                    <div key={log.id} className="p-4 bg-zinc-50 rounded-2xl flex justify-between items-center border border-zinc-100">
                      <div>
                        <p className="font-black text-base">₹{Number(log.paid_amount).toLocaleString()}</p>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">{log.billing_month}</p>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-xl border
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
                  {/* Balance card */}
                  <div className="bg-zinc-900 rounded-3xl p-6 text-white">
                    <div className="pb-4 mb-4 border-b border-white/10">
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Live Balance</p>
                      {(() => {
                        const bal = calculateBalanceAtPeriod(selectedTenant, ledger, currentPeriodLabel);
                        return (
                          <>
                            <p className={`text-3xl font-black mt-1 ${bal > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              ₹{Math.abs(bal).toLocaleString()}
                            </p>
                            <p className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${bal > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {bal > 0 ? 'Outstanding Due' : 'In Advance'}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                    <div>
                      <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Monthly Rent</p>
                      <p className="font-black text-lg">₹{selectedTenant.agreed_rent?.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Contact buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => window.open(`tel:${selectedTenant.phone_number}`)}
                      className="p-3 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all">
                      <Phone size={13} /> Call
                    </button>
                    <button onClick={() => window.open(`https://wa.me/91${selectedTenant.phone_number}`)}
                      className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all">
                      <MessageCircle size={13} /> WhatsApp
                    </button>
                  </div>

                  {/* Details */}
                  <div className="bg-zinc-50 rounded-3xl p-6 space-y-4 border border-zinc-100">
                    {[
                      { icon: Calendar, color: 'text-indigo-500', label: 'Join Date', value: selectedTenant.join_date || '—' },
                      { icon: ShieldCheck, color: 'text-emerald-500', label: 'Aadhaar', value: selectedTenant.aadhaar_number || '—' },
                      { icon: Briefcase, color: 'text-indigo-500', label: 'Organization', value: selectedTenant.organization_name || 'Individual' },
                      { icon: MapPin, color: 'text-rose-500', label: 'Home Address', value: selectedTenant.permanent_address || '—' },
                      { icon: PhoneCall, color: 'text-rose-500', label: 'Emergency', value: selectedTenant.emergency_number || '—' },
                    ].map(({ icon: Icon, color, label, value }) => (
                      <div key={label} className="flex items-start gap-3">
                        <Icon size={15} className={`${color} mt-0.5 flex-shrink-0`} />
                        <div>
                          <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">{label}</p>
                          <p className="text-xs font-semibold text-zinc-700 leading-tight mt-0.5">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button onClick={() => setShowHistory(true)}
                    className="w-full p-3.5 bg-white border border-zinc-200 text-zinc-600 rounded-2xl font-black text-[9px] uppercase flex items-center justify-center gap-2 tracking-widest hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all">
                    <History size={14} /> Payment History
                  </button>
                </>
              )}
            </div>

            {/* Footer actions */}
            {!showHistory && (
              <div className="p-6 border-t border-zinc-100 space-y-2">
                <button onClick={() => setPaymentModal({ open: true, tenant: selectedTenant })}
                  className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase text-[9px] flex items-center justify-center gap-2 tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20">
                  <Wallet size={14} /> Record Payment
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { setEditTenantModal({ open: true, tenant: selectedTenant }); setSelectedTenant(null); }}
                    className="py-3.5 bg-zinc-900 text-white rounded-2xl font-black uppercase text-[9px] flex items-center justify-center gap-2 tracking-widest hover:bg-indigo-600 transition-all">
                    <Edit3 size={12} /> Edit
                  </button>
                  <button onClick={() => { setSecurityModal({ open: true, type: 'tenant', id: selectedTenant.id }); setSelectedTenant(null); }}
                    className="py-3.5 bg-rose-50 text-rose-500 rounded-2xl font-black uppercase text-[9px] flex items-center justify-center gap-2 tracking-widest hover:bg-rose-500 hover:text-white transition-all">
                    <Trash2 size={12} /> Terminate
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
