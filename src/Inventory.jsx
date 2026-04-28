import React, { useState } from 'react';
import {
  Settings2, Hammer, User, X, Plus, XCircle, Trash2, Wallet, History,
  Calendar, ChevronLeft, PhoneCall, ShieldCheck, MapPin, Edit3,
  MessageCircle, Phone, Briefcase, BedDouble, CheckCircle, ShieldAlert, Search, Clock
} from 'lucide-react';

export default function Inventory({
  selectedProperty,
  rooms = [],
  tenants = [],
  ledger = [],
  handleBedAction,
  setCheckInModal,
  setPaymentModal,
  setBookingModal,
  setAddRoomModal,
  setEditTenantModal,
  setSecurityModal,
  setView,
  calculateBalanceAtPeriod,
  currentPeriodLabel,
  userRole,
}) {
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showHistory,    setShowHistory]    = useState(false);
  const [editMode,       setEditMode]       = useState(null);
  const [unitSearch,     setUnitSearch]     = useState('');

  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'super_admin';

  const filteredRooms = rooms.filter(r =>
    (r.room_number || '').toLowerCase().includes(unitSearch.toLowerCase())
  );
  
  const getAllRoomTenants = (roomId) => tenants.filter(t => t.room_id === roomId && t.status !== 'Inactive');
  const occupiedCount = filteredRooms.filter(r => getAllRoomTenants(r.id).length > 0).length;
  const closeSidebar  = () => { setSelectedTenant(null); setShowHistory(false); };

  // Helper to safely display Aadhaar (ISSUE #17 - Privacy)
  const maskAadhaar = (val) => {
    if (!val) return '—';
    return 'XXXX-XXXX-XXXX'; // Redacted for security protocols
  };

  return (
    <div className="animate-in fade-in pb-28 bg-white">
      {/* Header */}
      <div className="flex flex-col sm:row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('dashboard')}
            className="p-3 bg-zinc-100 rounded-2xl text-zinc-600 hover:bg-zinc-200 transition-all active:scale-90">
            <ChevronLeft size={20}/>
          </button>
          <div>
            <h2 className="text-2xl font-black tracking-tight">{selectedProperty?.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-black rounded-md uppercase tracking-widest border border-indigo-100">
                {occupiedCount} / {filteredRooms.length} Units Active
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"/>
            <input value={unitSearch} onChange={e => setUnitSearch(e.target.value)} placeholder="Search room number..."
              className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3 pl-11 pr-4 text-xs font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all"/>
          </div>
          {isOwnerOrAdmin && setAddRoomModal && (
            <button onClick={() => setAddRoomModal(true)}
              className="p-3.5 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 transition-all">
              <Plus size={20}/>
            </button>
          )}
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredRooms.map(room => {
          const capacity     = room.room_type === 'Single' ? 1 : room.room_type === 'Triple' ? 3 : 2;
          const allResidents = getAllRoomTenants(room.id);
          const booked       = room.booked_beds || 0;
          const isMaint      = room.status === 'Maintenance';
          const isEditing    = editMode === room.id;
          const isFull       = allResidents.length + booked >= capacity;

          return (
            <div key={room.id} className={`rounded-[2rem] border-2 transition-all duration-300 group
              ${isMaint ? 'bg-zinc-50 border-dashed border-zinc-200 opacity-60' : 
                isFull ? 'bg-white border-zinc-100 shadow-sm' : 'bg-white border-zinc-100 hover:border-indigo-200 shadow-sm'}`}>

              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h5 className="text-2xl font-black tracking-tighter">{room.room_number}</h5>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-0.5">{room.room_type} Room</p>
                  </div>
                  {isOwnerOrAdmin && (
                    <button onClick={() => setEditMode(isEditing ? null : room.id)}
                      className={`p-2.5 rounded-xl transition-all ${isEditing ? 'bg-rose-50 text-rose-500' : 'bg-zinc-50 text-zinc-300 hover:text-zinc-600'}`}>
                      {isEditing ? <X size={16}/> : <Settings2 size={16}/>}
                    </button>
                  )}
                </div>

                {/* Visual Occupancy Bar */}
                <div className="flex gap-1.5 mb-6">
                  {Array.from({length: capacity}).map((_, i) => {
                    const isOccupied = i < allResidents.length;
                    const isReserved = i >= allResidents.length && i < allResidents.length + booked;
                    return (
                      <div key={i} className={`h-2 flex-1 rounded-full transition-all duration-500
                        ${isOccupied ? 'bg-zinc-900' : isReserved ? 'bg-indigo-400 animate-pulse' : 'bg-zinc-100'}`}/>
                    );
                  })}
                </div>

                {isEditing ? (
                  <div className="space-y-2 animate-in slide-in-from-top-2">
                    <button onClick={() => handleBedAction(room, isMaint ? 'unblock' : 'block')}
                      className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2
                        ${isMaint ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      <Hammer size={12}/> {isMaint ? 'End Maintenance' : 'Set Maintenance'}
                    </button>
                    {setSecurityModal && (
                      <button onClick={() => setSecurityModal({ open: true, type: 'room', id: room.id })}
                        className="w-full py-3 bg-rose-50 text-rose-500 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                        <Trash2 size={12}/> Remove Unit
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allResidents.map(t => {
                      const bal = calculateBalanceAtPeriod(t, ledger, currentPeriodLabel);
                      return (
                        <button key={t.id} onClick={() => setSelectedTenant(t)}
                          className="w-full flex items-center justify-between p-3 bg-zinc-50 rounded-2xl hover:bg-zinc-900 hover:text-white transition-all group">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-zinc-400 group-hover:bg-white/10 group-hover:text-white transition-colors">
                              <User size={12}/>
                            </div>
                            <p className="text-[11px] font-black uppercase truncate">{t.full_name}</p>
                          </div>
                          <div className={`px-2 py-0.5 rounded-lg text-[8px] font-black ${bal > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {bal > 0 ? `₹${bal.toLocaleString()}` : 'PAID'}
                          </div>
                        </button>
                      );
                    })}

                    {booked > 0 && (
                      <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex justify-between items-center animate-pulse">
                        <div className="min-w-0">
                          <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Reserved</p>
                          <p className="text-[11px] font-black text-indigo-700 truncate">{room.booked_by_name}</p>
                        </div>
                        <button onClick={() => handleBedAction(room, 'cancel')} className="p-1.5 bg-white rounded-lg text-rose-500 shadow-sm">
                          <XCircle size={14}/>
                        </button>
                      </div>
                    )}

                    {!isMaint && !isFull && (
                      <div className="pt-2 grid grid-cols-2 gap-2">
                        <button onClick={() => setBookingModal({ open: true, room })}
                          className="py-3 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">
                          Reserve
                        </button>
                        <button onClick={() => setCheckInModal({ open: true, room })}
                          className="py-3 bg-zinc-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all">
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

      {/* Tenant Sidebar */}
      {selectedTenant && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeSidebar}/>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-8 border-b flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black tracking-tighter">{selectedTenant.full_name}</h3>
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mt-1">Resident Profile</p>
              </div>
              <button onClick={closeSidebar} className="p-3 bg-zinc-100 rounded-2xl"><X size={20}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {showHistory ? (
                <div className="space-y-4">
                  <button onClick={() => setShowHistory(false)} className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-2 mb-4">
                    <ChevronLeft size={14}/> View Profile
                  </button>
                  {ledger.filter(l => l.tenant_id === selectedTenant.id).map(log => (
                    <div key={log.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex justify-between items-center">
                      <div>
                        <p className="font-black text-lg">₹{Number(log.paid_amount).toLocaleString()}</p>
                        <p className="text-[10px] text-zinc-400 font-bold mt-1 uppercase">{log.payment_type} · {log.billing_month}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black bg-white px-2 py-1 rounded-lg border border-zinc-100 uppercase">{log.payment_mode}</p>
                        {!log.is_verified && <p className="text-[7px] font-black text-amber-500 mt-1 uppercase tracking-widest">Pending Approval</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="bg-zinc-900 rounded-[2rem] p-8 text-white shadow-2xl">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Current Balance</p>
                    <p className={`text-4xl font-black mt-2 ${calculateBalanceAtPeriod(selectedTenant, ledger, currentPeriodLabel) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      ₹{Math.abs(calculateBalanceAtPeriod(selectedTenant, ledger, currentPeriodLabel)).toLocaleString()}
                    </p>
                    <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-6">
                      <div><p className="text-[9px] font-black text-zinc-500 uppercase">Monthly Rent</p><p className="text-lg font-black italic">₹{selectedTenant.agreed_rent?.toLocaleString()}</p></div>
                      <div><p className="text-[9px] font-black text-zinc-500 uppercase">Security Held</p><p className="text-lg font-black italic">₹{selectedTenant.security_deposit?.toLocaleString()}</p></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => window.open(`tel:${selectedTenant.phone_number}`)} className="flex-1 py-4 bg-zinc-100 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest">
                      <Phone size={14}/> Call
                    </button>
                    <button onClick={() => window.open(`https://wa.me/91${selectedTenant.phone_number}`)} className="flex-1 py-4 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest">
                      <MessageCircle size={14}/> WhatsApp
                    </button>
                  </div>

                  <div className="bg-zinc-50 rounded-[2rem] p-6 space-y-4 border border-zinc-100">
                    {[
                      { icon: Calendar, label: 'Checked In', value: selectedTenant.join_date },
                      { icon: ShieldCheck, label: 'Identity (Aadhaar)', value: maskAadhaar(selectedTenant.aadhaar_number) },
                      { icon: Briefcase, label: 'Affiliation', value: selectedTenant.organization_name || 'Individual' },
                      { icon: MapPin, label: 'Native Address', value: selectedTenant.permanent_address },
                    ].map((item, idx) => (
                      <div key={idx} className="flex gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-500 shadow-sm border border-zinc-100"><item.icon size={16}/></div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{item.label}</p>
                          <p className="text-sm font-black text-zinc-700 leading-tight mt-0.5 truncate">{item.value || 'Not provided'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <button onClick={() => setShowHistory(true)} className="w-full py-5 bg-white border-2 border-zinc-100 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-900 hover:text-white transition-all">
                    <History size={16}/> View Transaction Log
                  </button>
                </>
              )}
            </div>

            {!showHistory && (
              <div className="p-8 border-t border-zinc-100 space-y-3">
                <button onClick={() => setPaymentModal({ open: true, tenant: selectedTenant })}
                  className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">
                  Collect Payment
                </button>
                {isOwnerOrAdmin && (
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => { setEditTenantModal({ open: true, tenant: selectedTenant }); closeSidebar(); }}
                      className="py-4 bg-zinc-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">
                      Edit Info
                    </button>
                    <button onClick={() => { setSecurityModal({ open: true, type: 'tenant', id: selectedTenant.id }); closeSidebar(); }}
                      className="py-4 bg-rose-50 text-rose-500 rounded-2xl font-black text-[10px] uppercase tracking-widest">
                      Check Out
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
