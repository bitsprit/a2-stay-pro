import React, { useState } from 'react';
import {
  Settings2, Hammer, User, X, Plus, XCircle, Trash2, Wallet, History,
  Calendar, ChevronLeft, PhoneCall, ShieldCheck, MapPin, Edit3,
  MessageCircle, Phone, Briefcase, BedDouble, CheckCircle, ShieldAlert, Search, Clock, ArrowLeft
} from 'lucide-react';

export default function Inventory({
  selectedProperty,
  rooms = [],
  tenants = [],
  ledger = [],
  handleBedAction = () => {},
  setCheckInModal = () => {},
  setPaymentModal = () => {},
  setBookingModal = () => {},
  setAddRoomModal,
  setEditTenantModal,
  setSecurityModal,
  setView,
  calculateBalanceAtPeriod = () => 0,
  currentPeriodLabel = '',
  userRole,
}) {
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showHistory,    setShowHistory]    = useState(false);
  const [editMode,       setEditMode]       = useState(null);
  const [unitSearch,     setUnitSearch]     = useState('');

  // 1. SAFETY GUARD: If somehow property is lost, go back to dashboard
  if (!selectedProperty) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
        <ShieldAlert size={48} className="mb-4 opacity-20"/>
        <p className="font-black uppercase text-xs tracking-widest">No Property Selected</p>
        <button onClick={() => setView('dashboard')} className="mt-4 text-indigo-600 font-bold text-xs uppercase">Return Home</button>
      </div>
    );
  }

  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'super_admin';

  // 2. Logic Filters
  const filteredRooms = (rooms || []).filter(r =>
    (r.room_number || '').toLowerCase().includes(unitSearch.toLowerCase())
  );
  
  const getAllRoomTenants = (roomId) => (tenants || []).filter(t => t.room_id === roomId && t.status !== 'Inactive');
  const occupiedCount = filteredRooms.filter(r => getAllRoomTenants(r.id).length > 0).length;
  const closeSidebar  = () => { setSelectedTenant(null); setShowHistory(false); };

  return (
    <div className="animate-in fade-in duration-500 pb-32">
      
      {/* 3. VIBRANT HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 bg-white p-6 rounded-[2.5rem] border border-zinc-100 shadow-sm">
        <div className="flex items-center gap-5">
          <button onClick={() => setView('dashboard')}
            className="w-12 h-12 bg-zinc-900 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-600 transition-all active:scale-90 shadow-lg shadow-zinc-200">
            <ArrowLeft size={20}/>
          </button>
          <div>
            <h2 className="text-3xl font-black tracking-tighter text-zinc-900">{selectedProperty?.name}</h2>
            <div className="flex items-center gap-2 mt-1">
               <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
               <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Live Status: {occupiedCount} / {filteredRooms.length} Units Filled</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400"/>
            <input value={unitSearch} onChange={e => setUnitSearch(e.target.value)} placeholder="Search Room Number..."
              className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-inner"/>
          </div>
          {isOwnerOrAdmin && setAddRoomModal && (
            <button onClick={() => setAddRoomModal(true)}
              className="w-14 h-14 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center">
              <Plus size={24}/>
            </button>
          )}
        </div>
      </div>

      {/* 4. ROOM GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredRooms.map(room => {
          const capacity     = room.room_type === 'Single' ? 1 : room.room_type === 'Triple' ? 3 : 2;
          const residents    = getAllRoomTenants(room.id);
          const booked       = room.booked_beds || 0;
          const isMaint      = room.status === 'Maintenance';
          const isEditing    = editMode === room.id;
          const isFull       = residents.length + booked >= capacity;

          return (
            <div key={room.id} className={`rounded-[2.5rem] border-2 transition-all duration-300 group
              ${isMaint ? 'bg-zinc-50 border-dashed border-zinc-200' : 
                isFull ? 'bg-white border-zinc-100 shadow-sm' : 'bg-white border-zinc-100 hover:border-indigo-300 shadow-sm hover:shadow-2xl'}`}>

              <div className="p-7">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h5 className="text-3xl font-black tracking-tighter text-zinc-900">{room.room_number}</h5>
                    <div className="flex items-center gap-1.5 mt-1">
                      <BedDouble size={10} className="text-zinc-400"/>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{room.room_type}</p>
                    </div>
                  </div>
                  {isOwnerOrAdmin && (
                    <button onClick={() => setEditMode(isEditing ? null : room.id)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isEditing ? 'bg-rose-50 text-rose-500' : 'bg-zinc-50 text-zinc-300 hover:text-zinc-600'}`}>
                      {isEditing ? <X size={18}/> : <Settings2 size={18}/>}
                    </button>
                  )}
                </div>

                {/* Progress Bars */}
                <div className="flex gap-2 mb-8">
                  {Array.from({length: capacity}).map((_, i) => {
                    const isOccupied = i < residents.length;
                    const isReserved = i >= residents.length && i < residents.length + booked;
                    return (
                      <div key={i} className={`h-2 flex-1 rounded-full transition-all duration-700
                        ${isOccupied ? 'bg-zinc-900 shadow-sm' : isReserved ? 'bg-indigo-400 animate-pulse' : 'bg-zinc-100'}`}/>
                    );
                  })}
                </div>

                {isEditing ? (
                  <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                    <button onClick={() => handleBedAction(room, isMaint ? 'unblock' : 'block')}
                      className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2
                        ${isMaint ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'bg-amber-50 text-amber-600 shadow-sm'}`}>
                      <Hammer size={12}/> {isMaint ? 'Re-Open Room' : 'Start Maintenance'}
                    </button>
                    {setSecurityModal && (
                      <button onClick={() => setSecurityModal({ open: true, type: 'room', id: room.id })}
                        className="w-full py-4 bg-rose-50 text-rose-500 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                        <Trash2 size={12}/> Permanently Delete
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {residents.map(t => {
                      const bal = calculateBalanceAtPeriod(t, ledger, currentPeriodLabel);
                      return (
                        <button key={t.id} onClick={() => setSelectedTenant(t)}
                          className="w-full flex items-center justify-between p-4 bg-zinc-50 rounded-2xl hover:bg-zinc-900 hover:text-white transition-all group border border-transparent hover:border-zinc-800">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-zinc-400 group-hover:bg-white/10 group-hover:text-white transition-colors shadow-sm">
                              <User size={14}/>
                            </div>
                            <p className="text-xs font-black uppercase truncate tracking-tight">{t.full_name}</p>
                          </div>
                          <div className={`px-3 py-1 rounded-lg text-[9px] font-black shadow-sm ${bal > 0 ? 'bg-rose-100 text-rose-600 group-hover:bg-rose-500 group-hover:text-white' : 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white'}`}>
                            {bal > 0 ? `₹${bal.toLocaleString()}` : 'PAID'}
                          </div>
                        </button>
                      );
                    })}

                    {booked > 0 && (
                      <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex justify-between items-center group">
                        <div className="min-w-0">
                          <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Advance Booking</p>
                          <p className="text-xs font-black text-indigo-700 truncate mt-0.5">{room.booked_by_name}</p>
                        </div>
                        <button onClick={() => handleBedAction(room, 'cancel')} className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-rose-500 shadow-sm hover:bg-rose-500 hover:text-white transition-all active:scale-90">
                          <XCircle size={16}/>
                        </button>
                      </div>
                    )}

                    {!isMaint && !isFull && (
                      <div className="pt-4 flex gap-3">
                        <button onClick={() => setBookingModal({ open: true, room })}
                          className="flex-1 py-4 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                          Reserve
                        </button>
                        <button onClick={() => setCheckInModal({ open: true, room })}
                          className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-zinc-200">
                          Check In
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. TENANT PROFILE SIDEBAR (Restore Vibrant UI) */}
      {selectedTenant && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={closeSidebar}/>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 rounded-l-[3rem]">
            
            <div className="p-10 border-b border-zinc-50 flex justify-between items-center">
              <div>
                <h3 className="text-3xl font-black tracking-tighter text-zinc-900">{selectedTenant.full_name}</h3>
                <p className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-indigo-600 rounded-full"></span> Active Resident
                </p>
              </div>
              <button onClick={closeSidebar} className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-all"><X size={24}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-8">
               {/* Financial Status */}
               <div className="bg-zinc-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
                  <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Account Balance</p>
                  <p className={`text-5xl font-black mt-4 tracking-tighter ${calculateBalanceAtPeriod(selectedTenant, ledger, currentPeriodLabel) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    ₹{Math.abs(calculateBalanceAtPeriod(selectedTenant, ledger, currentPeriodLabel)).toLocaleString()}
                  </p>
                  <div className="mt-10 grid grid-cols-2 gap-6 border-t border-white/10 pt-8">
                     <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Rent Rate</p>
                        <p className="text-xl font-black mt-1">₹{selectedTenant.agreed_rent?.toLocaleString()}</p>
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Security</p>
                        <p className="text-xl font-black mt-1">₹{selectedTenant.security_deposit?.toLocaleString() || '0'}</p>
                     </div>
                  </div>
               </div>

               {/* Profile Info */}
               <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => window.open(`tel:${selectedTenant.phone_number}`)} className="py-5 bg-zinc-50 rounded-2xl flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                    <Phone size={16}/> Call Now
                  </button>
                  <button onClick={() => window.open(`https://wa.me/91${selectedTenant.phone_number}`)} className="py-5 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
                    <MessageCircle size={18}/> WhatsApp
                  </button>
               </div>

               <div className="bg-zinc-50 rounded-[2.5rem] p-8 space-y-6 border border-zinc-100">
                  <div className="flex gap-5">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-500 shadow-sm border border-zinc-100"><Calendar size={20}/></div>
                    <div>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Check-In Date</p>
                      <p className="text-base font-black text-zinc-900 mt-1">{selectedTenant.join_date}</p>
                    </div>
                  </div>
                  <div className="flex gap-5">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-rose-500 shadow-sm border border-zinc-100"><MapPin size={20}/></div>
                    <div>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Permanent Address</p>
                      <p className="text-sm font-black text-zinc-900 mt-1 leading-snug">{selectedTenant.permanent_address || 'Not Provided'}</p>
                    </div>
                  </div>
               </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-10 border-t border-zinc-100 space-y-4 bg-white">
                <button onClick={() => setPaymentModal({ open: true, tenant: selectedTenant })}
                  className="w-full bg-emerald-500 text-white py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] shadow-xl shadow-emerald-500/30 active:scale-95 transition-all">
                  Collect Payment
                </button>
                {isOwnerOrAdmin && (
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => { setEditTenantModal({ open: true, tenant: selectedTenant }); closeSidebar(); }}
                      className="py-5 bg-zinc-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg">
                      Edit Profile
                    </button>
                    <button onClick={() => { setSecurityModal({ open: true, type: 'tenant', id: selectedTenant.id }); closeSidebar(); }}
                      className="py-5 bg-rose-50 text-rose-500 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all">
                      Check Out
                    </button>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
