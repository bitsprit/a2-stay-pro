import React, { useState } from 'react';
import {
  Settings2, Hammer, User, X, Plus, XCircle, Trash2, Wallet, History,
  Calendar, ChevronLeft, PhoneCall, ShieldCheck, MapPin, Edit3,
  MessageCircle, Phone, Briefcase, BedDouble, CheckCircle, ShieldAlert, Search
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
  setAddRoomModal,      // undefined for staff — always null-check before calling
  setEditTenantModal,   // undefined for staff
  setSecurityModal,     // undefined for staff
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
  const getAllRoomTenants = (roomId) => tenants.filter(t => t.room_id === roomId);
  const occupiedCount = filteredRooms.filter(r => getAllRoomTenants(r.id).length > 0).length;
  const closeSidebar  = () => { setSelectedTenant(null); setShowHistory(false); };

  return (
    <div className="animate-in fade-in pb-28">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('dashboard')}
            className="p-2.5 bg-white border border-zinc-200 rounded-xl text-zinc-500 hover:text-zinc-900 shadow-sm active:scale-90 transition-all">
            <ChevronLeft size={17}/>
          </button>
          <div>
            <h2 className="text-xl font-black tracking-tight leading-tight">{selectedProperty?.name}</h2>
            <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-widest mt-0.5">{occupiedCount}/{filteredRooms.length} occupied</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300"/>
            <input value={unitSearch} onChange={e => setUnitSearch(e.target.value)} placeholder="Search room…"
              className="w-full bg-white border border-zinc-200 rounded-xl py-2.5 pl-9 pr-3 text-xs font-semibold shadow-sm outline-none focus:border-indigo-400 transition-all"/>
          </div>
          {isOwnerOrAdmin && setAddRoomModal && (
            <button onClick={() => setAddRoomModal(true)}
              className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20 hover:bg-indigo-700 active:scale-90 transition-all flex-shrink-0">
              <Plus size={17}/>
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        {[['bg-zinc-900','Occupied'],['bg-indigo-400 animate-pulse','Reserved'],['bg-zinc-200','Vacant'],['bg-amber-400','Pending']].map(([cls, lbl]) => (
          <span key={lbl} className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
            <span className={`w-2 h-2 rounded-full ${cls} inline-block`}/> {lbl}
          </span>
        ))}
      </div>

      {/* Room grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredRooms.map(room => {
          const capacity     = room.room_type === 'Single' ? 1 : room.room_type === 'Triple' ? 3 : 2;
          const allResidents = getAllRoomTenants(room.id);
          const booked       = room.booked_beds || 0;
          const isMaint      = room.status === 'Maintenance';
          const isEditing    = editMode === room.id;
          const isFull       = allResidents.length + booked >= capacity;

          return (
            <div key={room.id} className={`rounded-2xl border flex flex-col overflow-hidden transition-all hover:shadow-md
              ${isMaint ? 'bg-zinc-50 border-dashed border-zinc-200 opacity-75' : 'bg-white border-zinc-100 shadow-sm'}`}>

              {/* Room header */}
              <div className={`px-4 py-3 border-b ${isMaint ? 'border-zinc-100' : 'border-zinc-50'}`}>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <h5 className="text-xl font-black tracking-tight">{room.room_number}</h5>
                    {isMaint && <span className="text-[7px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full uppercase">Maint</span>}
                  </div>
                  {isOwnerOrAdmin && (
                    <button onClick={() => setEditMode(isEditing ? null : room.id)}
                      className={`p-1.5 rounded-lg transition-all ${isEditing ? 'bg-rose-100 text-rose-500' : 'text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100'}`}>
                      {isEditing ? <X size={14}/> : <Settings2 size={14}/>}
                    </button>
                  )}
                </div>
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-2">{room.room_type} · {capacity} bed{capacity > 1 ? 's' : ''}</p>
                {/* Bed bars */}
                <div className="flex gap-1">
                  {Array.from({length: capacity}).map((_, i) => {
                    const pendingCount = allResidents.filter(t => !t.is_verified).length;
                    const verifiedCount = allResidents.filter(t => t.is_verified).length;
                    return (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-all
                        ${i < pendingCount ? 'bg-amber-400' :
                          i < allResidents.length ? 'bg-zinc-900' :
                          i < allResidents.length + booked ? 'bg-indigo-400 animate-pulse' :
                          'bg-zinc-100'}`}/>
                    );
                  })}
                </div>
              </div>

              {/* Edit panel */}
              {isEditing ? (
                <div className="p-3 space-y-2 animate-in fade-in duration-150">
                  <input defaultValue={room.room_number}
                    onBlur={e => { if (e.target.value !== room.room_number) handleBedAction(room, 'rename', e.target.value); }}
                    className="w-full bg-zinc-50 border border-zinc-200 p-2 rounded-lg font-black text-center text-sm outline-none focus:border-indigo-400"/>
                  <select value={room.room_type} onChange={e => handleBedAction(room, 'changeType', e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 p-2 rounded-lg text-xs font-semibold outline-none">
                    <option value="Single">Single (1 bed)</option>
                    <option value="Double">Double (2 beds)</option>
                    <option value="Triple">Triple (3 beds)</option>
                  </select>
                  <button onClick={() => { handleBedAction(room, isMaint ? 'unblock' : 'block'); setEditMode(null); }}
                    className={`w-full py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1
                      ${isMaint ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white' : 'bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white'}`}>
                    <Hammer size={10}/> {isMaint ? 'Mark Open' : 'Maintenance'}
                  </button>
                  {setSecurityModal && (
                    <button onClick={() => { setSecurityModal({ open: true, type: 'room', id: room.id }); setEditMode(null); }}
                      className="w-full py-2 bg-zinc-100 text-zinc-400 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-1">
                      <Trash2 size={10}/> Delete Room
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Resident chips */}
                  <div className="flex-1 p-3 space-y-1.5 min-h-[60px]">
                    {allResidents.map(t => {
                      const bal     = calculateBalanceAtPeriod(t, ledger, currentPeriodLabel);
                      const pending = !t.is_verified;
                      return (
                        <button key={t.id} onClick={() => { setSelectedTenant(t); setShowHistory(false); }}
                          className={`w-full text-left p-2 rounded-xl transition-all group border
                            ${pending ? 'bg-amber-50 border-amber-100 hover:bg-amber-100' :
                              'bg-zinc-50 border-transparent hover:bg-zinc-900 hover:text-white hover:border-zinc-800'}`}>
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <User size={9} className="flex-shrink-0 opacity-60"/>
                              <p className="text-[10px] font-black uppercase truncate">{t.full_name}</p>
                              {pending && <ShieldAlert size={9} className="text-amber-500 flex-shrink-0"/>}
                            </div>
                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0 whitespace-nowrap
                              ${pending ? 'bg-amber-200 text-amber-700' :
                                bal > 0 ? 'bg-rose-100 text-rose-600 group-hover:bg-rose-500 group-hover:text-white' :
                                'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white'}`}>
                              {pending ? 'PENDING' : bal > 0 ? `₹${bal.toLocaleString()} DUE` : `₹${Math.abs(bal).toLocaleString()} ADV`}
                            </span>
                          </div>
                        </button>
                      );
                    })}

                    {booked > 0 && (
                      <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100 flex justify-between items-center">
                        <div>
                          <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Reserved</p>
                          <p className="text-[10px] font-black text-indigo-700 truncate">{room.booked_by_name}</p>
                        </div>
                        <button onClick={() => handleBedAction(room, 'cancel')} className="p-1 text-indigo-300 hover:text-rose-500 rounded-lg transition-all">
                          <XCircle size={13}/>
                        </button>
                      </div>
                    )}

                    {allResidents.length === 0 && booked === 0 && !isMaint && (
                      <div className="flex flex-col items-center justify-center py-4 text-zinc-200">
                        <BedDouble size={22} className="mb-1"/><p className="text-[8px] font-bold uppercase tracking-widest">Vacant</p>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  {!isMaint && (
                    <div className="p-2.5 grid grid-cols-2 gap-2">
                      <button onClick={() => setBookingModal({ open: true, room })} disabled={isFull}
                        className="py-2.5 rounded-xl text-[9px] font-black uppercase bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white active:scale-95 transition-all disabled:opacity-20 disabled:pointer-events-none tracking-widest">
                        Reserve
                      </button>
                      <button onClick={() => setCheckInModal({ open: true, room })} disabled={allResidents.length >= capacity}
                        className="py-2.5 rounded-xl text-[9px] font-black uppercase bg-zinc-900 text-white hover:bg-indigo-600 active:scale-95 transition-all disabled:opacity-20 disabled:pointer-events-none tracking-widest">
                        Check In
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {filteredRooms.length === 0 && (
          <div className="col-span-full flex flex-col items-center py-20 text-zinc-200">
            <BedDouble size={36} className="mb-3"/><p className="font-bold text-sm">No rooms found</p>
          </div>
        )}
      </div>

      {/* Tenant detail sidebar */}
      {selectedTenant && (
        <div className="fixed inset-0 z-[1000] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeSidebar}/>
          <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-250">

            {/* Sidebar header */}
            <div className="flex justify-between items-start px-5 py-4 border-b border-zinc-100 flex-shrink-0">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-black tracking-tight">{selectedTenant.full_name}</h3>
                  {!selectedTenant.is_verified && (
                    <span className="text-[7px] bg-amber-100 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full font-black uppercase">Pending</span>
                  )}
                </div>
                <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">Tenant Profile</p>
              </div>
              <button onClick={closeSidebar} className="p-2 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-all flex-shrink-0"><X size={16}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {showHistory ? (
                <div className="space-y-2">
                  <button onClick={() => setShowHistory(false)} className="flex items-center gap-1.5 text-[9px] font-black uppercase text-indigo-500 tracking-widest mb-3">
                    <ChevronLeft size={11}/> Back
                  </button>
                  {ledger.filter(l => l.tenant_id === selectedTenant.id).length === 0 && (
                    <div className="flex flex-col items-center py-10 text-zinc-300"><CheckCircle size={28} className="mb-2"/><p className="text-xs font-bold">No transactions yet</p></div>
                  )}
                  {ledger.filter(l => l.tenant_id === selectedTenant.id).map(log => (
                    <div key={log.id} className={`p-3 rounded-xl flex justify-between items-center border ${!log.is_verified ? 'bg-amber-50 border-amber-100' : 'bg-zinc-50 border-zinc-100'}`}>
                      <div>
                        <p className="font-black text-sm">₹{Number(log.paid_amount).toLocaleString()}</p>
                        <div className="flex items-center gap-2 mt-0.5">
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
                  {/* Balance card */}
                  {(() => {
                    const bal = calculateBalanceAtPeriod(selectedTenant, ledger, currentPeriodLabel);
                    return (
                      <div className="bg-zinc-900 rounded-2xl p-4 text-white">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">This Month's Balance</p>
                        <p className={`text-2xl font-black mt-1 ${bal > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>₹{Math.abs(bal).toLocaleString()}</p>
                        <p className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${bal > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{bal > 0 ? 'Due' : 'Advance / Settled'}</p>
                        <div className="grid grid-cols-2 gap-2 border-t border-white/10 mt-3 pt-3 text-xs">
                          <div><p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Rent</p><p className="font-black">₹{selectedTenant.agreed_rent?.toLocaleString()}</p></div>
                          <div><p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Security</p><p className="font-black">₹{selectedTenant.security_deposit?.toLocaleString() || '—'}</p></div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Contact */}
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

                  {/* Details */}
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

            {/* Footer actions */}
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