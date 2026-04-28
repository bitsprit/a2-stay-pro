import React, { useState, useMemo } from 'react';
import { Settings2, Hammer, User, X, Bed, Plus, Clock, XCircle, Trash2, Wallet, History, Calendar, Search, ChevronLeft, PhoneCall, ShieldCheck, MapPin, Edit3, MessageCircle, Phone, Briefcase } from 'lucide-react';

export default function Inventory({ selectedProperty, rooms = [], tenants = [], ledger = [], handleBedAction, setCheckInModal, setPaymentModal, setSecurityModal, setBookingModal, setAddRoomModal, setEditTenantModal, setView, calculateBalanceAtPeriod, currentPeriodLabel }) {
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [editMode, setEditMode] = useState(null); 
  const [unitSearch, setUnitSearch] = useState("");

  const filteredRooms = rooms.filter(r => r.property_id === selectedProperty?.id && (r.room_number || "").toLowerCase().includes(unitSearch.toLowerCase()));
  const getRoomTenants = (roomId) => tenants.filter(t => t.room_id === roomId);

  // Stats Calculation
  const stats = useMemo(() => {
    let total = 0, occ = 0, bk = 0, maint = 0;
    rooms.filter(r => r.property_id === selectedProperty?.id).forEach(r => {
      const cap = r.room_type === 'Single' ? 1 : r.room_type === 'Double' ? 2 : 3;
      total += cap;
      if (r.status === 'Maintenance') maint += cap;
      else {
        occ += getRoomTenants(r.id).length;
        bk += (r.booked_beds || 0);
      }
    });
    return { total, occ, bk, maint, avail: total - occ - bk - maint };
  }, [rooms, tenants, selectedProperty]);

  return (
    <div className="animate-in slide-in-from-right duration-400 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
        <div className="flex items-center gap-4">
            <button onClick={() => setView('dashboard')} className="p-3 bg-white border rounded-2xl text-slate-400 hover:text-slate-900 shadow-sm transition-all"><ChevronLeft size={20}/></button>
            <h2 className="text-4xl font-black uppercase italic text-slate-900 font-serif tracking-tighter">{selectedProperty?.name}</h2>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"/>
                <input placeholder="Search unit..." className="w-full bg-white border border-slate-100 rounded-2xl py-3 pl-12 pr-4 font-bold text-xs shadow-sm outline-none italic" value={unitSearch} onChange={(e) => setUnitSearch(e.target.value)} />
            </div>
            <button onClick={() => setAddRoomModal(true)} className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg hover:scale-105 transition-all"><Plus size={20}/></button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 text-center shadow-sm"><p className="text-[8px] font-black uppercase text-slate-300 italic mb-1">Total Beds</p><p className="text-2xl font-black text-slate-800">{stats.total}</p></div>
        <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100 text-center shadow-sm"><p className="text-[8px] font-black uppercase text-emerald-500 italic mb-1">Occupied</p><p className="text-2xl font-black text-emerald-600">{stats.occ}</p></div>
        <div className="bg-indigo-50 p-5 rounded-3xl border border-indigo-100 text-center shadow-sm"><p className="text-[8px] font-black uppercase text-indigo-500 italic mb-1">Booked</p><p className="text-2xl font-black text-indigo-600">{stats.bk}</p></div>
        <div className="bg-rose-50 p-5 rounded-3xl border border-rose-100 text-center shadow-sm"><p className="text-[8px] font-black uppercase text-rose-400 italic mb-1">Blocked</p><p className="text-2xl font-black text-rose-600">{stats.maint}</p></div>
        <div className="bg-amber-50 p-5 rounded-3xl border border-amber-100 text-center shadow-sm hidden md:block"><p className="text-[8px] font-black uppercase text-amber-500 italic mb-1">Available</p><p className="text-2xl font-black text-amber-600">{stats.avail}</p></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-8">
        {filteredRooms.map(room => {
          const max = room.room_type === 'Single' ? 1 : room.room_type === 'Double' ? 2 : 3;
          const roomResidents = getRoomTenants(room.id);
          const isMaint = room.status === 'Maintenance';
          const isEditing = editMode === room.id;
          const booked = room.booked_beds || 0;

          return (
            <div key={room.id} className={`p-8 rounded-[3rem] border flex flex-col group relative min-h-[440px] bg-white hover:shadow-2xl transition-all ${isMaint ? 'bg-slate-50 opacity-70 border-dashed border-rose-200' : 'border-slate-100 shadow-sm'}`}>
              <button onClick={() => setEditMode(isEditing ? null : room.id)} className={`absolute top-8 right-8 z-20 ${isEditing ? 'text-rose-500' : 'text-slate-200 hover:text-[#1E1E45]'}`}>{isEditing ? <X size={20}/> : <Settings2 size={20}/>}</button>
              
              {isEditing ? (
                <div className="h-full flex flex-col justify-center space-y-4 animate-in zoom-in-95">
                  <input defaultValue={room.room_number} onBlur={(e) => handleBedAction(room, 'rename', e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl font-black text-center text-xl border outline-none" />
                  <select value={room.room_type} onChange={(e) => handleBedAction(room, 'changeType', e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border transition-all shadow-inner"><option value="Single">Single</option><option value="Double">Double</option><option value="Triple">Triple</option></select>
                  <button onClick={() => { handleBedAction(room, isMaint ? 'unblock' : 'block'); setEditMode(null); }} className={`w-full py-4 rounded-xl font-black uppercase text-[10px] transition-all ${isMaint ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}><Hammer size={12} className="inline mr-2"/> {isMaint ? 'Unblock' : 'Block Room'}</button>
                  <button onClick={() => { setSecurityModal({ open: true, type: 'room', id: room.id }); setEditMode(null); }} className="w-full py-4 bg-slate-50 text-slate-300 rounded-xl font-black uppercase text-[10px] hover:bg-rose-600 hover:text-white transition-all"><Trash2 size={12} className="inline mr-2"/> Delete Unit</button>
                </div>
              ) : (
                <>
                  <h5 className="text-4xl font-black italic text-[#1E1E45] leading-none mb-1">{room.room_number}</h5>
                  <p className="text-[10px] font-black uppercase text-slate-300 mb-6 italic">{room.room_type} Unit</p>
                  <div className="flex gap-2 mb-6">
                    {[...Array(max)].map((_, i) => (
                      <div key={i} className={`h-3.5 flex-1 rounded-full ${i < roomResidents.length ? 'bg-[#1E1E45]' : i < (roomResidents.length + booked) ? 'bg-indigo-400 animate-pulse' : 'bg-slate-100 shadow-inner'}`} />
                    ))}
                  </div>
                  <div className="flex-1 space-y-2 mb-6 overflow-y-auto no-scrollbar">
                      {roomResidents.map(t => (
                        <button key={t.id} onClick={() => { setSelectedTenant(t); setShowHistory(false); }} className="w-full text-left p-4 bg-slate-50 rounded-xl hover:bg-[#1E1E45] hover:text-white transition-all shadow-sm group/btn border border-transparent hover:border-indigo-200">
                          <p className="text-[11px] font-black uppercase italic flex items-center gap-2 truncate font-bold"><User size={12}/> {t.full_name}</p>
                          <p className={`text-[9px] font-bold ${calculateBalanceAtPeriod(t, ledger, currentPeriodLabel) > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>₹{Math.abs(calculateBalanceAtPeriod(t, ledger, currentPeriodLabel)).toLocaleString()} {calculateBalanceAtPeriod(t, ledger, currentPeriodLabel) > 0 ? 'DUE' : 'ADV'}</p>
                        </button>
                      ))}
                      {booked > 0 && <div className="p-3 bg-indigo-50 rounded-xl flex justify-between items-center text-[10px] font-bold text-indigo-700 italic shadow-inner">Booking: {room.booked_by_name} <XCircle size={14} onClick={() => handleBedAction(room, 'cancel')} className="cursor-pointer hover:text-rose-500 transition-colors"/></div>}
                  </div>
                  <div className="mt-auto space-y-2 pt-4">
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setBookingModal({ open: true, room })} disabled={isMaint || (roomResidents.length + booked) >= max} className="py-4 rounded-2xl text-[10px] font-black uppercase bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm disabled:opacity-20 italic">Book</button>
                        <button onClick={() => setCheckInModal({ open: true, room: room })} disabled={isMaint || roomResidents.length >= max} className="py-4 rounded-2xl text-[10px] font-black uppercase bg-emerald-500 text-white shadow-lg hover:bg-emerald-600 italic font-bold active:scale-95 disabled:opacity-20">Register</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* UNIFIED SIDEBAR */}
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
                                    <div className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-xl border ${log.payment_type?.toUpperCase() === 'RENT' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-amber-50 text-amber-600'}`}>{log.payment_type}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="p-8 bg-[#1E1E45] rounded-[2.5rem] text-white shadow-2xl space-y-4 shadow-xl">
                                <div className="flex justify-between border-b border-white/10 pb-4"><p className="opacity-60 text-[10px] font-black uppercase tracking-widest italic">Live Balance</p><p className="text-2xl font-black italic tracking-tighter text-rose-400">₹{calculateBalanceAtPeriod(selectedTenant, ledger, currentPeriodLabel).toLocaleString()}</p></div>
                                <div className="flex justify-between pt-2 border-b border-white/10 pb-4"><p className="opacity-60 text-[10px] font-black uppercase tracking-widest italic">Monthly Rent</p><p className="text-xl font-bold italic tracking-tighter">₹{selectedTenant.agreed_rent?.toLocaleString()}</p></div>
                                <div className="flex justify-between pt-2"><p className="opacity-60 text-[10px] font-black uppercase tracking-widest italic">Security Deposit</p><p className="text-xl font-bold italic tracking-tighter">₹{selectedTenant.security_deposit?.toLocaleString()}</p></div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => window.open(`tel:${selectedTenant.phone_number}`)} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[10px] shadow-sm hover:bg-indigo-600 hover:text-white transition-all text-indigo-600 font-bold"><Phone size={14}/> Call</button>
                                <button onClick={() => window.open(`https://wa.me/91${selectedTenant.phone_number}?text=${encodeURIComponent(`Hi ${selectedTenant.full_name}, team A2 Stay here. Current due is ₹${calculateBalanceAtPeriod(selectedTenant, ledger, currentPeriodLabel).toLocaleString()}`)}`)} className="p-4 bg-emerald-50 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[10px] shadow-sm hover:bg-[#25D366] hover:text-white transition-all font-bold text-[#25D366] border border-emerald-100"><MessageCircle size={14}/> WhatsApp</button>
                            </div>

                            <div className="bg-slate-50 p-8 rounded-[2.5rem] space-y-6 border border-slate-100 shadow-inner">
                                <div className="space-y-4">
                                    <div className="flex items-start gap-4"><Calendar className="text-indigo-500 mt-1" size={18}/><div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Join Date</p><p className="font-bold text-slate-700 italic">{selectedTenant.join_date || '---'}</p></div></div>
                                    <div className="flex items-start gap-4"><ShieldCheck className="text-emerald-500 mt-1" size={18}/><div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Aadhaar Verification</p><p className="font-bold text-slate-700 tracking-widest uppercase">{selectedTenant.aadhaar_number || '---'}</p></div></div>
                                    <div className="flex items-start gap-4"><Briefcase className="text-indigo-500 mt-1" size={18}/><div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Organization / Office</p><p className="font-bold text-slate-700 italic leading-tight">{selectedTenant.organization_name || 'Individual'}</p></div></div>
                                    <div className="flex items-start gap-4"><MapPin className="text-rose-500 mt-1" size={18}/><div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Home Address</p><p className="font-bold text-sm text-slate-500 italic leading-tight">{selectedTenant.permanent_address || '---'}</p></div></div>
                                    <div className="flex items-start gap-4"><PhoneCall className="text-rose-500 mt-1" size={18}/><div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Emergency Contact</p><p className="font-bold text-slate-700">{selectedTenant.emergency_number || '---'}</p></div></div>
                                </div>
                            </div>
                            <button onClick={() => setShowHistory(true)} className="w-full p-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 italic shadow-sm hover:bg-indigo-600 hover:text-white transition-all font-bold tracking-widest shadow-xl"><History size={16}/> Payment History</button>
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