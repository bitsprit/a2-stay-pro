import React, { useState } from 'react';
import { Search, User, Trash2, MessageCircle, Wallet, ShieldCheck, MapPin, Briefcase, X, Clock, PhoneCall, ChevronLeft, History, Edit3, Phone, Calendar } from 'lucide-react';

export default function Tenants({ tenants = [], rooms = [], ledger = [], properties = [], setSecurityModal, setPaymentModal, setEditTenantModal, calculateBalanceAtPeriod, currentPeriodLabel }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const filtered = tenants.filter(t => 
    (t?.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (t?.phone_number || "").includes(searchTerm)
  );

  return (
    <div className="animate-in fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
        <h2 className="text-4xl font-black uppercase italic text-slate-900 font-serif tracking-tighter">Residents Portfolio</h2>
        <div className="relative w-full md:w-96"><Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} /><input type="text" placeholder="Search portfolio..." className="w-full bg-white border-2 border-slate-100 rounded-[1.5rem] py-5 pl-16 pr-6 font-bold outline-none italic shadow-sm shadow-indigo-50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
      </div>

      <div className="space-y-3">
        {filtered.map(t => {
          const room = rooms.find(r => r.id === t.room_id);
          const property = properties.find(p => p.id === t.property_id);
          const bal = calculateBalanceAtPeriod(t, ledger, currentPeriodLabel);
          return (
            <div key={t.id} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 flex items-center justify-between group hover:shadow-xl transition-all shadow-sm">
                <div onClick={() => { setSelectedTenant(t); setShowHistory(false); }} className="flex items-center gap-5 cursor-pointer">
                  <div className="min-w-[130px] h-14 bg-slate-50 rounded-2xl flex flex-col items-center justify-center text-[#1E1E45] shadow-inner group-hover:bg-[#1E1E45] group-hover:text-white transition-all px-3 overflow-hidden">
                    <p className="text-[9px] font-black uppercase opacity-40 leading-none truncate w-full text-center font-bold">{property?.name || '---'}</p>
                    <p className="text-[17px] font-black italic leading-tight">{room?.room_number || 'NA'}</p>
                  </div>
                  <div className="truncate">
                    <h4 className="text-xl font-black uppercase italic leading-tight">{t.full_name}</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">{t.phone_number}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block"><p className={`text-sm font-black italic ${bal > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>₹{Math.abs(bal).toLocaleString()} {bal > 0 ? 'DUE' : 'ADV'}</p></div>
                    <div className="flex gap-2">
                        <button onClick={() => setPaymentModal({ open: true, tenant: t })} className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm"><Wallet size={20}/></button>
                        <button onClick={() => window.open(`https://wa.me/91${t.phone_number}`)} className="p-4 bg-[#25D366]/10 text-[#25D366] rounded-2xl hover:bg-[#25D366] hover:text-white transition-all shadow-sm"><MessageCircle size={20}/></button>
                    </div>
                </div>
            </div>
          );
        })}
      </div>

      {/* RENDER SHARED SIDEBAR HERE (SAME CODE AS INVENTORY) */}
      {selectedTenant && (
          <div className="fixed inset-0 z-[1000] flex justify-end">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setSelectedTenant(null)} />
              <div className="relative w-full max-w-md bg-white h-full shadow-2xl p-10 flex flex-col animate-in slide-in-from-right duration-300">
                <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-3xl font-black italic uppercase text-[#1E1E45] font-serif leading-tight">{selectedTenant.full_name}</h3>
                      <p className="text-indigo-500 font-bold uppercase text-[10px] italic tracking-widest mt-1">Tenant Profile</p>
                    </div>
                    <button onClick={() => { setSelectedTenant(null); setShowHistory(false); }} className="p-3 bg-slate-50 rounded-full hover:bg-rose-50 shadow-sm transition-all"><X size={24}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
                    {showHistory ? (
                        <div className="space-y-4">
                            <button onClick={() => setShowHistory(false)} className="text-[10px] font-black uppercase text-indigo-500 mb-4 flex items-center gap-2 font-bold"><ChevronLeft size={14}/> Back to Profile</button>
                            {(ledger || []).filter(l => l.tenant_id === selectedTenant.id).map(log => (
                                <div key={log.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center border shadow-sm">
                                    <div><p className="font-black italic text-lg mb-1 leading-none">₹{log.paid_amount.toLocaleString()}</p><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{log.billing_month}</p></div>
                                    <div className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-xl border ${log.payment_type?.toUpperCase() === 'RENT' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>{log.payment_type}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="p-8 bg-[#1E1E45] rounded-[2.5rem] text-white shadow-2xl space-y-4 shadow-xl">
                                <div className="flex justify-between border-b border-white/10 pb-4"><p className="opacity-60 text-[10px] font-black uppercase tracking-widest italic">Live Balance</p><p className="text-2xl font-black italic tracking-tighter text-rose-400">₹{calculateBalanceAtPeriod(selectedTenant, ledger, currentPeriodLabel).toLocaleString()}</p></div>
                                <div className="flex justify-between pt-2 border-b border-white/10 pb-4"><p className="opacity-60 text-[10px] font-black uppercase tracking-widest italic">Rent Rate</p><p className="text-xl font-bold italic tracking-tighter">₹{selectedTenant.agreed_rent?.toLocaleString()}</p></div>
                                <div className="flex justify-between pt-2"><p className="opacity-60 text-[10px] font-black uppercase tracking-widest italic">Security Deposit</p><p className="text-xl font-bold italic tracking-tighter">₹{selectedTenant.security_deposit?.toLocaleString()}</p></div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => window.open(`tel:${selectedTenant.phone_number}`)} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[10px] shadow-sm hover:bg-indigo-600 hover:text-white transition-all text-indigo-600 font-bold"><Phone size={14}/> Call</button>
                                <button onClick={() => window.open(`https://wa.me/91${selectedTenant.phone_number}?text=${encodeURIComponent(`Hi ${selectedTenant.full_name}, team A2 Stay here. Current due is ₹${calculateBalanceAtPeriod(selectedTenant, ledger, currentPeriodLabel).toLocaleString()}`)}`)} className="p-4 bg-emerald-50 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[10px] shadow-sm hover:bg-[#25D366] hover:text-white transition-all text-[#25D366] border border-emerald-100 font-bold"><MessageCircle size={14}/> WhatsApp</button>
                            </div>
                            <div className="bg-slate-50 p-8 rounded-[2.5rem] space-y-6 border border-slate-100 shadow-inner">
                                <div className="space-y-4">
                                    <div className="flex items-start gap-4"><Calendar className="text-indigo-500 mt-1" size={18}/><div><p className="text-[8px] font-black text-slate-400 uppercase">Join Date</p><p className="font-bold text-slate-700 italic">{selectedTenant.join_date || '---'}</p></div></div>
                                    <div className="flex items-start gap-4"><ShieldCheck className="text-emerald-500 mt-1" size={18}/><div><p className="text-[8px] font-black text-slate-400 uppercase">Aadhaar</p><p className="font-bold text-slate-700 tracking-widest uppercase">{selectedTenant.aadhaar_number || '---'}</p></div></div>
                                    <div className="flex items-start gap-4"><Briefcase className="text-indigo-500 mt-1" size={18}/><div><p className="text-[8px] font-black text-slate-400 uppercase">Work / College</p><p className="font-bold text-slate-700 italic leading-tight">{selectedTenant.organization_name || 'Individual'}</p></div></div>
                                    <div className="flex items-start gap-4"><MapPin className="text-rose-500 mt-1" size={18}/><div><p className="text-[8px] font-black text-slate-400 uppercase">Permanent Address</p><p className="font-bold text-sm text-slate-500 italic leading-tight">{selectedTenant.permanent_address || '---'}</p></div></div>
                                    <div className="flex items-start gap-4"><PhoneCall className="text-rose-500 mt-1" size={18}/><div><p className="text-[8px] font-black text-slate-400 uppercase">Emergency Mobile</p><p className="font-bold text-slate-700">{selectedTenant.emergency_number || '---'}</p></div></div>
                                </div>
                            </div>
                            <button onClick={() => setShowHistory(true)} className="w-full p-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 italic shadow-sm hover:bg-indigo-600 hover:text-white transition-all font-bold tracking-widest"><History size={16}/> Payment Log History</button>
                        </>
                    )}
                  </div>
                  {!showHistory && (
                    <div className="mt-8 space-y-2 pt-6 border-t animate-in fade-in">
                        <button onClick={() => setPaymentModal({ open: true, tenant: selectedTenant })} className="w-full bg-emerald-500 text-white py-5 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 shadow-xl shadow-emerald-50 tracking-widest italic font-bold hover:bg-emerald-600 shadow-lg"><Wallet size={16}/> Record Payment</button>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => { setEditTenantModal({ open: true, tenant: selectedTenant }); setSelectedTenant(null); }} className="py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 font-bold tracking-widest italic hover:bg-black transition-all shadow-lg"><Edit3 size={14}/> Edit Profile</button>
                            <button onClick={() => { setSecurityModal({ open: true, type: 'tenant', id: selectedTenant.id }); setSelectedTenant(null); }} className="py-4 bg-rose-50 text-rose-500 rounded-2xl font-black uppercase text-[10px] italic shadow-sm hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center gap-2 font-bold tracking-widest"><Trash2 size={14}/> Terminate</button>
                        </div>
                    </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
}