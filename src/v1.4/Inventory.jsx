import React, { useState } from 'react';
import {
  Settings2, Hammer, User, X, Plus, XCircle, Trash2, Wallet, History,
  Calendar, Search, ChevronLeft, PhoneCall, ShieldCheck, MapPin, Edit3,
  MessageCircle, Phone, Briefcase, BedDouble, AlertCircle, CheckCircle
} from 'lucide-react';

export default function Inventory({
  selectedProperty, rooms = [], tenants = [], ledger = [], handleBedAction,
  setCheckInModal, setPaymentModal, setSecurityModal, setBookingModal,
  setAddRoomModal, setEditTenantModal, setView,
  calculateBalanceAtPeriod, currentPeriodLabel
}) {
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [editMode, setEditMode] = useState(null);
  const [unitSearch, setUnitSearch] = useState("");

  const filteredRooms = (rooms || []).filter(r =>
    r.property_id === selectedProperty?.id &&
    (r.room_number || "").toLowerCase().includes(unitSearch.toLowerCase())
  );
  const getRoomTenants = (roomId) => (tenants || []).filter(t => t.room_id === roomId);

  const totalRooms = filteredRooms.length;
  const occupiedRooms = filteredRooms.filter(r => getRoomTenants(r.id).length > 0).length;

  return (
    <div className="animate-in fade-in duration-300 pb-24">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('dashboard')}
            className="p-2.5 bg-white border border-zinc-200 rounded-xl text-zinc-400 hover:text-zinc-900 hover:border-zinc-300 shadow-sm transition-all">
            <ChevronLeft size={18} />
          </button>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-zinc-900">{selectedProperty?.name}</h2>
            <p className="text-xs text-zinc-400 font-medium mt-0.5">{occupiedRooms}/{totalRooms} rooms occupied</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-300" />
            <input
              placeholder="Search unit..."
              className="w-full bg-white border border-zinc-200 rounded-xl py-2.5 pl-10 pr-4 font-semibold text-xs shadow-sm outline-none focus:border-indigo-400 transition-all"
              value={unitSearch}
              onChange={(e) => setUnitSearch(e.target.value)}
            />
          </div>
          <button onClick={() => setAddRoomModal(true)}
            className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex-shrink-0">
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mb-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-zinc-900 inline-block" /> Occupied</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse inline-block" /> Reserved</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-zinc-200 inline-block" /> Vacant</span>
      </div>

      {/* Room Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredRooms.map(room => {
          const max = room.room_type === 'Single' ? 1 : room.room_type === 'Double' ? 2 : 3;
          const roomResidents = getRoomTenants(room.id);
          const isMaint = room.status === 'Maintenance';
          const isEditing = editMode === room.id;
          const booked = room.booked_beds || 0;
          const isFull = (roomResidents.length + booked) >= max;

          return (
            <div key={room.id}
              className={`rounded-3xl border flex flex-col relative overflow-hidden transition-all hover:shadow-lg
                ${isMaint ? 'bg-zinc-50 border-dashed border-zinc-200 opacity-70' : 'bg-white border-zinc-100 shadow-sm'}
              `}>

              {/* Room header */}
              <div className={`p-5 border-b ${isMaint ? 'border-zinc-100' : 'border-zinc-50'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-2xl font-black tracking-tight text-zinc-900">{room.room_number}</h5>
                      {isMaint && <span className="text-[8px] font-black bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full uppercase tracking-widest">Maintenance</span>}
                    </div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">{room.room_type}</p>
                  </div>
                  <button onClick={() => setEditMode(isEditing ? null : room.id)}
                    className={`p-2 rounded-xl transition-all ${isEditing ? 'bg-rose-50 text-rose-400' : 'text-zinc-300 hover:text-zinc-600 hover:bg-zinc-50'}`}>
                    {isEditing ? <X size={16} /> : <Settings2 size={16} />}
                  </button>
                </div>

                {/* Bed bars */}
                <div className="flex gap-1.5 mt-4">
                  {[...Array(max)].map((_, i) => (
                    <div key={i}
                      className={`h-2 flex-1 rounded-full transition-all
                        ${i < roomResidents.length ? 'bg-zinc-900' :
                          i < (roomResidents.length + booked) ? 'bg-indigo-400 animate-pulse' :
                          'bg-zinc-100'}
                      `}
                    />
                  ))}
                </div>
              </div>

              {/* Edit mode */}
              {isEditing ? (
                <div className="flex-1 p-5 space-y-3 animate-in fade-in duration-200">
                  <input
                    defaultValue={room.room_number}
                    onBlur={(e) => { if (e.target.value !== room.room_number) handleBedAction(room, 'rename', e.target.value); }}
                    className="w-full bg-zinc-50 border border-zinc-200 p-3 rounded-xl font-black text-center text-lg outline-none focus:border-indigo-400"
                    placeholder="Room number"
                  />
                  <select
                    value={room.room_type}
                    onChange={(e) => handleBedAction(room, 'changeType', e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 p-3 rounded-xl font-semibold text-sm outline-none">
                    <option value="Single">Single (1 Bed)</option>
                    <option value="Double">Double (2 Beds)</option>
                    <option value="Triple">Triple (3 Beds)</option>
                  </select>
                  <button onClick={() => { handleBedAction(room, isMaint ? 'unblock' : 'block'); setEditMode(null); }}
                    className={`w-full py-3 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all flex items-center justify-center gap-2
                      ${isMaint ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white' : 'bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white'}`}>
                    <Hammer size={11} /> {isMaint ? 'Mark as Open' : 'Mark for Maintenance'}
                  </button>
                  <button onClick={() => { setSecurityModal({ open: true, type: 'room', id: room.id }); setEditMode(null); }}
                    className="w-full py-3 bg-zinc-100 text-zinc-400 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-2">
                    <Trash2 size={11} /> Delete Room
                  </button>
                </div>
              ) : (
                <>
                  {/* Tenants list */}
                  <div className="flex-1 p-5 space-y-2 overflow-y-auto">
                    {roomResidents.map(t => {
                      const bal = calculateBalanceAtPeriod(t, ledger, currentPeriodLabel);
                      return (
                        <button key={t.id} onClick={() => { setSelectedTenant(t); setShowHistory(false); }}
                          className="w-full text-left p-3 bg-zinc-50 rounded-2xl hover:bg-zinc-900 hover:text-white transition-all group border border-transparent hover:border-zinc-800">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[10px] font-black uppercase leading-tight truncate flex items-center gap-1.5">
                              <User size={10} className="flex-shrink-0" /> {t.full_name}
                            </p>
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-lg flex-shrink-0
                              ${bal > 0 ? 'bg-rose-100 text-rose-600 group-hover:bg-rose-500 group-hover:text-white' :
                                          'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white'}`}>
                              {bal > 0 ? `₹${Math.abs(bal).toLocaleString()} DUE` : `₹${Math.abs(bal).toLocaleString()} ADV`}
                            </span>
                          </div>
                        </button>
                      );
                    })}

                    {booked > 0 && (
                      <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100 flex justify-between items-center">
                        <div>
                          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Reserved</p>
                          <p className="text-xs font-black text-indigo-700">{room.booked_by_name}</p>
                        </div>
                        <button onClick={() => handleBedAction(room, 'cancel')}
                          className="p-1.5 hover:bg-rose-100 hover:text-rose-500 rounded-lg transition-all text-indigo-300">
                          <XCircle size={14} />
                        </button>
                      </div>
                    )}

                    {roomResidents.length === 0 && booked === 0 && !isMaint && (
                      <div className="flex flex-col items-center justify-center py-6 text-zinc-200">
                        <BedDouble size={28} className="mb-2" />
                        <p className="text-[9px] font-bold uppercase tracking-widest">Vacant</p>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  {!isMaint && (
                    <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setBookingModal({ open: true, room })}
                        disabled={isFull}
                        className="py-3 rounded-2xl text-[9px] font-black uppercase bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-20 disabled:pointer-events-none tracking-widest">
                        Reserve
                      </button>
                      <button
                        onClick={() => setCheckInModal({ open: true, room })}
                        disabled={roomResidents.length >= max}
                        className="py-3 rounded-2xl text-[9px] font-black uppercase bg-zinc-900 text-white hover:bg-indigo-600 transition-all disabled:opacity-20 disabled:pointer-events-none tracking-widest">
                        Check In
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── TENANT DETAIL SIDEBAR ─── */}
      {selectedTenant && (
        <div className="fixed inset-0 z-[1000] flex justify-end">
          <div className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm" onClick={() => { setSelectedTenant(null); setShowHistory(false); }} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

            {/* Sidebar header */}
            <div className="flex justify-between items-start p-7 border-b border-zinc-100">
              <div>
                <h3 className="text-xl font-black tracking-tight text-zinc-900 leading-tight">{selectedTenant.full_name}</h3>
                <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mt-1">Tenant Profile</p>
              </div>
              <button onClick={() => { setSelectedTenant(null); setShowHistory(false); }}
                className="p-2.5 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-all">
                <X size={18} />
              </button>
            </div>

            {/* Sidebar content */}
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
                    <div className="flex justify-between items-start mb-4 pb-4 border-b border-white/10">
                      <div>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Live Balance</p>
                        <p className={`text-3xl font-black mt-1 ${calculateBalanceAtPeriod(selectedTenant, ledger, currentPeriodLabel) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          ₹{Math.abs(calculateBalanceAtPeriod(selectedTenant, ledger, currentPeriodLabel)).toLocaleString()}
                        </p>
                        <p className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${calculateBalanceAtPeriod(selectedTenant, ledger, currentPeriodLabel) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {calculateBalanceAtPeriod(selectedTenant, ledger, currentPeriodLabel) > 0 ? 'Outstanding Due' : 'In Advance'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Monthly Rent</p>
                        <p className="font-black">₹{selectedTenant.agreed_rent?.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Security Held</p>
                        <p className="font-black">₹{selectedTenant.security_deposit?.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => window.open(`tel:${selectedTenant.phone_number}`)}
                      className="p-3 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all">
                      <Phone size={13} /> Call
                    </button>
                    <button onClick={() => window.open(`https://wa.me/91${selectedTenant.phone_number}?text=${encodeURIComponent(`Hi ${selectedTenant.full_name}, team A2 Stay here. Current due: ₹${calculateBalanceAtPeriod(selectedTenant, ledger, currentPeriodLabel).toLocaleString()}`)}`)}
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

            {/* Sidebar footer actions */}
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
