import React, { useState, useMemo } from 'react';
import { Settings2, Hammer, User, X, Bed, Plus, Clock, XCircle, Trash2, Wallet, History, Calendar, Search, ChevronLeft, PhoneCall, ShieldCheck, MapPin, Edit3, MessageCircle, Phone } from 'lucide-react';

export default function Inventory({ selectedProperty, rooms = [], tenants = [], ledger = [], properties = [], handleBedAction, setCheckInModal, setPaymentModal, setSecurityModal, setBookingModal, setAddRoomModal, setEditResidentModal, setView, calculateBalanceAtPeriod, currentPeriodLabel }) {
  const [selectedResident, setSelectedResident] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [editMode, setEditMode] = useState(null);
  const [unitSearch, setUnitSearch] = useState("");

  const allBeds = useMemo(() => {
    return rooms
      .filter(r => r.property_id === selectedProperty?.id)
      .flatMap(room => {
        const capacity = room.room_type === 'Single' ? 1 : room.room_type === 'Double' ? 2 : 3;
        const roomResidents = (tenants || []).filter(t => t.room_id === room.id);
        const bookedCount = room.booked_beds || 0;
        
        const beds = [];
        for (let i = 0; i < capacity; i++) {
            let status = 'Vacant';
            let resident = null;
            
            if (room.status === 'Maintenance') {
                status = 'Maintenance';
            } else if (roomResidents[i]) {
                status = 'Occupied';
                resident = roomResidents[i];
            } else if (i < roomResidents.length + bookedCount) {
                status = 'Booked';
            }

            beds.push({ ...room, bedIndex: i, bedLabel: String.fromCharCode(65 + i), status, resident });
        }
        return beds;
      });
  }, [rooms, tenants, selectedProperty]);

  const filteredBeds = allBeds.filter(b => (b.room_number || "").includes(unitSearch));

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
                <input placeholder="Search room..." className="w-full bg-white border border-slate-100 rounded-2xl py-3 pl-12 pr-4 font-bold text-xs shadow-sm outline-none" value={unitSearch} onChange={(e) => setUnitSearch(e.target.value)} />
            </div>
            <button onClick={() => setAddRoomModal(true)} className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg hover:scale-105 transition-all"><Plus size={20}/></button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-10">
        <div className="bg-white p-4 rounded-3xl border border-slate-100 text-center shadow-sm"><p className="text-[8px] font-black uppercase text-slate-300 italic">Total Beds</p><p className="text-xl font-black">{allBeds.length}</p></div>
        <div className="bg-emerald-50 p-4 rounded-3xl border border-emerald-100 text-center shadow-sm"><p className="text-[8px] font-black uppercase text-emerald-500 italic">Occupied</p><p className="text-xl font-black text-emerald-600">{allBeds.filter(b => b.status === 'Occupied').length}</p></div>
        <div className="bg-indigo-50 p-4 rounded-3xl border border-indigo-100 text-center shadow-sm"><p className="text-[8px] font-black uppercase text-indigo-500 italic">Booked</p><p className="text-xl font-black text-indigo-600">{allBeds.filter(b => b.status === 'Booked').length}</p></div>
        <div className="bg-rose-50 p-4 rounded-3xl border border-rose-100 text-center shadow-sm"><p className="text-[8px] font-black uppercase text-rose-400 italic">Maint.</p><p className="text-xl font-black text-rose-600">{allBeds.filter(b => b.status === 'Maintenance').length}</p></div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {filteredBeds.map((bed) => (
          <div key={`${bed.id}-${bed.bedIndex}`} className={`p-6 rounded-[2rem] border flex flex-col items-center justify-center text-center relative transition-all min-h-[160px] group bg-white shadow-sm hover:shadow-xl ${bed.status === 'Maintenance' ? 'bg-slate-50 opacity-60 border-dashed border-rose-200' : 'border-slate-100'}`}>
            <h5 className="text-2xl font-black italic text-[#1E1E45] leading-none mb-1">{bed.room_number}{bed.bedLabel}</h5>
            
            {bed.status === 'Occupied' ? (
                <div onClick={() => { setSelectedResident(bed.resident); setShowHistory(false); }} className="cursor-pointer space-y-2 w-full">
                    <p className="text-[10px] font-black uppercase text-emerald-500 leading-tight truncate px-2 italic">{bed.resident.full_name}</p>
                    <div className="bg-emerald-50 py-1 px-3 rounded-full inline-block text-[7px] font-black text-emerald-600 uppercase">Resident</div>
                </div>
            ) : bed.status === 'Booked' ? (
                <div className="space-y-2 w-full">
                    <p className="text-[9px] font-black uppercase text-indigo-400 italic">Reserved</p>
                    <button onClick={(e) => { e.stopPropagation(); handleBedAction(bed, 'cancel'); }} className="p-2 bg-indigo-50 text-indigo-400 rounded-full hover:bg-rose-50 hover:text-rose-500 transition-all"><X size={10}/></button>
                </div>
            ) : bed.status === 'Maintenance' ? (
                <div className="flex flex-col items-center gap-1">
                    <Hammer className="text-rose-400" size={24}/>
                    <p className="text-[7px] font-bold text-rose-400 uppercase">Blocked</p>
                </div>
            ) : (
                <div className="space-y-3 pt-2">
                    <div className="bg-slate-50 py-1 px-3 rounded-full inline-block text-[7px] font-black text-slate-300 uppercase italic">Empty</div>
                    <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => setBookingModal({ open: true, room: bed })} className="p-2 bg-indigo-50 text-indigo-500 rounded-lg hover:bg-indigo-500 hover:text-white transition-all"><Clock size={12}/></button>
                        <button onClick={() => setCheckInModal({ open: true, room: bed })} className="p-2 bg-emerald-50 text-emerald-500 rounded-lg hover:bg-emerald-500 hover:text-white transition-all"><User size={12}/></button>
                    </div>
                </div>
            )}
            
            <button onClick={() => setEditMode(editMode === bed.id ? null : bed.id)} className="absolute top-4 right-4 text-slate-100 hover:text-slate-900 transition-colors opacity-0 group-hover:opacity-100"><Settings2 size={12}/></button>
            {editMode === bed.id && (
                <div className="absolute inset-0 bg-white/95 rounded-[2rem] z-20 flex flex-col items-center justify-center p-4 space-y-2 animate-in zoom-in-95">
                    <button 
                        onClick={() => { handleBedAction(bed, bed.status === 'Maintenance' ? 'unblock' : 'block'); setEditMode(null); }} 
                        className={`w-full py-2 text-[8px] font-black uppercase rounded-lg transition-all ${bed.status === 'Maintenance' ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white' : 'bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white'}`}
                    >
                        {bed.status === 'Maintenance' ? 'Unblock' : 'Block Unit'}
                    </button>
                    <button onClick={() => { setSecurityModal({ open: true, type: 'room', id: bed.id }); setEditMode(null); }} className="w-full py-2 bg-slate-100 text-slate-500 text-[8px] font-black uppercase rounded-lg hover:bg-rose-600 hover:text-white">Delete</button>
                    <button onClick={() => setEditMode(null)} className="text-[8px] font-black text-slate-300 uppercase mt-2">Close</button>
                </div>
            )}
          </div>
        ))}
      </div>

      {/* DETAIL SIDEBAR (Shared logic for Inventory) */}
      {selectedResident && (
          <div className="fixed inset-0 z-[1000] flex justify-end">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setSelectedResident(null)} />
              <div className="relative w-full max-w-md bg-white h-full shadow-2xl p-10 flex flex-col animate-in slide-in-from-right duration-300">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-3xl font-black italic uppercase text-[#1E1E45] font-serif leading-tight">{selectedResident.full_name}</h3>
                      <p className="text-indigo-500 font-bold uppercase text-[10px] italic tracking-widest mt-1">Room {(rooms.find(r => r.id === selectedResident.room_id)?.room_number) || 'NA'}</p>
                    </div>
                    <button onClick={() => { setSelectedResident(null); setShowHistory(false); }} className="p-3 bg-slate-50 rounded-full hover:bg-rose-50 shadow-sm transition-all"><X size={24}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
                    {showHistory ? (
                        <div className="space-y-4">
                            <button onClick={() => setShowHistory(false)} className="text-[10px] font-black uppercase text-indigo-500 mb-4 flex items-center gap-2 font-bold"><ChevronLeft size={14}/> Back to Profile</button>
                            {(ledger || []).filter(l => l.tenant_id === selectedResident.id).map(log => (
                                <div key={log.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center border shadow-sm">
                                    <div><p className="font-black italic text-lg mb-1 leading-none">₹{log.paid_amount.toLocaleString()}</p><p className="text-[9px] font-bold text-slate-400 uppercase">{log.billing_month}</p></div>
                                    <div className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-xl border ${log.payment_type?.toUpperCase() === 'RENT' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>{log.payment_type}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="p-8 bg-[#1E1E45] rounded-[2.5rem] text-white shadow-2xl space-y-4 shadow-xl">
                                <div className="flex justify-between border-b border-white/10 pb-4"><p className="opacity-60 text-[10px] font-black uppercase tracking-widest italic">Live Balance</p><p className="text-2xl font-black italic tracking-tighter text-rose-400">₹{calculateBalanceAtPeriod(selectedResident, ledger, currentPeriodLabel).toLocaleString()}</p></div>
                                <div className="flex justify-between pt-2"><p className="opacity-60 text-[10px] font-black uppercase tracking-widest italic">Agreement Rent</p><p className="text-xl font-bold italic tracking-tighter">₹{selectedResident.agreed_rent?.toLocaleString()}</p></div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => window.open(`tel:${selectedResident.phone_number}`)} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[10px] shadow-sm hover:bg-indigo-600 hover:text-white transition-all"><Phone size={14}/> Call</button>
                                <button onClick={() => window.open(`https://wa.me/91${selectedResident.phone_number}`)} className="p-4 bg-emerald-50 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[10px] shadow-sm hover:bg-[#25D366] hover:text-white transition-all text-[#25D366] border border-emerald-100"><MessageCircle size={14}/> WhatsApp</button>
                            </div>

                            <div className="bg-slate-50 p-8 rounded-[2.5rem] space-y-6 border border-slate-100 shadow-inner">
                                <div className="space-y-4">
                                    <div className="flex items-start gap-4"><Calendar className="text-indigo-500 mt-1" size={20}/><div><p className="text-[8px] font-black text-slate-400 uppercase">Joined Date</p><p className="font-bold text-slate-700 italic">{selectedResident.join_date || '---'}</p></div></div>
                                    <div className="flex items-start gap-4"><ShieldCheck className="text-emerald-500 mt-1" size={20}/><div><p className="text-[8px] font-black text-slate-400 uppercase">Aadhaar Verification</p><p className="font-bold text-slate-700 tracking-widest uppercase">{selectedResident.aadhaar_number || '---'}</p></div></div>
                                    <div className="flex items-start gap-4"><Briefcase className="text-indigo-500 mt-1" size={20}/><div><p className="text-[8px] font-black text-slate-400 uppercase">Office / College</p><p className="font-bold text-slate-700 italic leading-tight">{selectedResident.organization_name || 'Individual'}</p></div></div>
                                    <div className="flex items-start gap-4"><MapPin className="text-rose-500 mt-1" size={20}/><div><p className="text-[8px] font-black text-slate-400 tracking-widest">Home Address</p><p className="font-bold text-slate-700 italic text-xs leading-relaxed">{selectedResident.permanent_address || '---'}</p></div></div>
                                    <div className="flex items-start gap-4"><PhoneCall className="text-rose-500 mt-1" size={20}/><div><p className="text-[8px] font-black text-slate-400 tracking-widest">Emergency No</p><p className="font-bold text-slate-700">{selectedResident.emergency_number || '---'}</p></div></div>
                                </div>
                            </div>
                            <button onClick={() => setShowHistory(true)} className="w-full p-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 italic shadow-sm hover:bg-indigo-600 hover:text-white transition-all font-bold tracking-widest"><History size={16}/> Payment Log Timeline</button>
                        </>
                    )}
                  </div>
                  {!showHistory && (
                    <div className="mt-8 space-y-2 pt-6 border-t animate-in fade-in">
                        <button onClick={() => setPaymentModal({ open: true, tenant: selectedResident })} className="w-full bg-emerald-500 text-white py-5 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 shadow-xl shadow-emerald-50 tracking-widest italic font-bold hover:bg-emerald-600 shadow-lg"><Wallet size={16}/> Record Payment</button>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => { setEditResidentModal({ open: true, tenant: selectedResident }); setSelectedResident(null); }} className="py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 font-bold tracking-widest italic hover:bg-black transition-all shadow-lg"><Edit3 size={14}/> Edit Profile</button>
                            <button onClick={() => { setSecurityModal({ open: true, type: 'tenant', id: selectedResident.id }); setSelectedResident(null); }} className="py-4 bg-rose-50 text-rose-500 rounded-2xl font-black uppercase text-[10px] italic shadow-sm hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center gap-2 font-bold tracking-widest"><Trash2 size={14}/> Terminate</button>
                        </div>
                    </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
}