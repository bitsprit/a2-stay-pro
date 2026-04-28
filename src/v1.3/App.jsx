import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { 
  X, ShieldCheck, Building2, MapPin, LayoutDashboard, RefreshCw, Users, Plus, MessageCircle,
  ChevronLeft, ChevronRight, Trash2, Edit3, Calendar, Wallet, User, Clock, ArrowRight, Hammer, Search, Zap, Phone
} from 'lucide-react';

import Inventory from './Inventory';
import Tenants from './Tenants';

export default function App() {
  const [view, setView] = useState('dashboard'); 
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [currentPeriod, setCurrentPeriod] = useState(new Date().toISOString().slice(0, 7)); 
  const [stats, setStats] = useState({ earnings: 0, due: 0, advance: 0, security: 0 });

  // ✅ Unified Tenant Modals
  const [checkInModal, setCheckInModal] = useState({ open: false, room: null });
  const [bookingModal, setBookingModal] = useState({ open: false, room: null });
  const [securityModal, setSecurityModal] = useState({ open: false, type: null, id: null });
  const [paymentModal, setPaymentModal] = useState({ open: false, tenant: null });
  const [editTenantModal, setEditTenantModal] = useState({ open: false, tenant: null });
  const [addPropModal, setAddPropModal] = useState(false);
  const [addRoomModal, setAddRoomModal] = useState(false);
  const [financeDetail, setFinanceDetail] = useState({ open: false, type: null, data: [] });

  const ADMIN_CODE = "A2-ADMIN"; 

  const getPeriodLabel = (dateStr) => {
    const [y, m] = dateStr.split('-');
    return `${m}-${y}`; 
  };

  const calculateBalanceAtPeriod = (tenant, allLedger, targetPeriodLabel) => {
    if (!tenant?.id || !tenant?.join_date) return 0;
    try {
      const [tM, tY] = targetPeriodLabel.split('-').map(Number);
      const targetDate = new Date(tY, tM - 1, 1);
      const joinDate = new Date(tenant.join_date);
      const joinMonthStart = new Date(joinDate.getFullYear(), joinDate.getMonth(), 1);
      if (targetDate < joinMonthStart) return 0;

      let monthsToInvoice = [];
      let temp = new Date(joinMonthStart);
      while (temp <= targetDate) {
        monthsToInvoice.push(`${String(temp.getMonth() + 1).padStart(2, '0')}-${temp.getFullYear()}`);
        temp.setMonth(temp.getMonth() + 1);
      }

      const paidMonths = new Set((allLedger || []).filter(l => l.tenant_id === tenant.id && l.is_verified && l.payment_type?.toUpperCase() === 'RENT').map(l => l.billing_month));
      let totalDue = 0;
      const today = new Date();
      monthsToInvoice.forEach(m => {
        if (!paidMonths.has(m)) {
          const [mM, mY] = m.split('-').map(Number);
          if (mM === today.getMonth() + 1 && mY === today.getFullYear() && today.getDate() <= 5) return;
          totalDue += Number(tenant.agreed_rent || 0);
        }
      });
      return totalDue;
    } catch (e) { return 0; }
  };

  useEffect(() => { fetchData(); }, [currentPeriod]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: p } = await supabase.from('properties').select('*');
      const { data: r } = await supabase.from('rooms').select('*').order('room_number', { ascending: true });
      const { data: t } = await supabase.from('tenants').select('*');
      const { data: l } = await supabase.from('ledger').select('*').order('created_at', { ascending: false });
      
      setProperties(p || []); setRooms(r || []); setTenants(t || []); setLedger(l || []);

      const label = getPeriodLabel(currentPeriod);
      const monthLedger = (l || []).filter(log => log.billing_month === label && log.is_verified);
      let tDue = 0;
      (t || []).forEach(ten => { tDue += calculateBalanceAtPeriod(ten, l, label); });
      setStats({
        earnings: monthLedger.filter(log => log.payment_type?.toUpperCase() === 'RENT').reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        security: monthLedger.filter(log => log.payment_type?.toUpperCase() === 'SECURITY').reduce((s, c) => s + Number(c.paid_amount || 0), 0),
        advance: 0, due: tDue
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const handleBedAction = async (room, action, extra = null) => {
    let up = {};
    if (action === 'block') up = { status: 'Maintenance' };
    else if (action === 'unblock') up = { status: 'Vacant' };
    else if (action === 'rename') up = { room_number: extra };
    else if (action === 'changeType') up = { room_type: extra };
    else if (action === 'book') up = { booked_beds: 1, booked_by_name: extra.name, booked_by_phone: extra.phone, advance_amount: Number(extra.amount), booking_date: extra.date };
    else if (action === 'cancel') up = { booked_beds: 0, booked_by_name: null, booked_by_phone: null, advance_amount: 0, booking_date: null };
    await supabase.from('rooms').update(up).eq('id', room.id);
    fetchData();
  };

  const handleFinalCheckIn = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const joinDateRaw = f.get('t_join_date');
    const joinLabel = `${String(new Date(joinDateRaw).getMonth() + 1).padStart(2, '0')}-${new Date(joinDateRaw).getFullYear()}`;

    const { data: nt } = await supabase.from('tenants').insert([{ 
      full_name: f.get('t_name'), phone_number: f.get('t_phone'), aadhaar_number: f.get('t_aadhaar'),
      emergency_number: f.get('t_emergency'), organization_name: f.get('t_org_name'), permanent_address: f.get('t_p_address'),
      property_id: selectedProperty.id, room_id: checkInModal.room.id, agreed_rent: Number(f.get('t_rent')), 
      security_deposit: Number(f.get('t_security')), join_date: joinDateRaw 
    }]).select().single();

    if (nt) {
        await supabase.from('ledger').insert([
          { tenant_id: nt.id, property_id: selectedProperty.id, billing_month: joinLabel, paid_amount: Number(f.get('t_rent')), is_verified: true, payment_type: 'RENT', payment_mode: 'CASH' },
          { tenant_id: nt.id, property_id: selectedProperty.id, billing_month: joinLabel, paid_amount: Number(f.get('t_security')), is_verified: true, payment_type: 'SECURITY', payment_mode: 'CASH' }
        ]);
        setCheckInModal({ open: false, room: null }); fetchData();
    }
  };

  const handleUpdateTenant = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    await supabase.from('tenants').update({
        full_name: f.get('e_name'), phone_number: f.get('e_phone'), aadhaar_number: f.get('e_aadhaar'),
        emergency_number: f.get('e_emergency'), organization_name: f.get('e_org'), permanent_address: f.get('e_address'),
        agreed_rent: Number(f.get('e_rent')), security_deposit: Number(f.get('e_security'))
    }).eq('id', editTenantModal.tenant.id);
    setEditTenantModal({ open: false, tenant: null }); fetchData();
  };

  const executeSecureDelete = async (pin) => {
    if (pin !== ADMIN_CODE) return alert("Wrong Pin");
    const { type, id } = securityModal;
    if (type === 'tenant') await supabase.from('tenants').delete().eq('id', id);
    else if (type === 'property') await supabase.from('properties').delete().eq('id', id);
    else if (type === 'room') await supabase.from('rooms').delete().eq('id', id);
    setSecurityModal({ open: false, type: null, id: null }); fetchData();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans text-slate-800">
      <aside className="w-full md:w-64 bg-[#1E1E45] text-white p-6 flex flex-col z-50 shadow-2xl">
        <div className="flex items-center gap-3 mb-10"><ShieldCheck className="text-emerald-400" size={28}/><h1 className="text-lg font-bold uppercase italic tracking-tighter">A2 STAY PRO</h1></div>
        <nav className="flex-1 space-y-2">
          <button onClick={() => setView('dashboard')} className={`w-full text-left px-4 py-4 rounded-2xl font-bold text-xs transition-all ${view === 'dashboard' ? 'bg-white/10 shadow-inner' : 'opacity-40 hover:opacity-100'}`}><LayoutDashboard size={18} className="inline mr-4"/> Dashboard</button>
          <button onClick={() => setView('tenants')} className={`w-full text-left px-4 py-4 rounded-2xl font-bold text-xs transition-all ${view === 'tenants' ? 'bg-white/10 shadow-inner' : 'opacity-40 hover:opacity-100'}`}><Users size={18} className="inline mr-4"/> Tenants</button>
        </nav>
        <button onClick={fetchData} className="mt-auto text-xs text-emerald-400 flex items-center gap-2 font-black uppercase opacity-50 hover:opacity-100 transition-all"><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> SYNC HUB</button>
      </aside>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto no-scrollbar">
        {view === 'dashboard' && (
          <div className="animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-10">
                <h2 className="text-4xl font-black uppercase italic text-slate-900 tracking-tighter">Finance Hub</h2>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border shadow-sm">
                        <button onClick={() => { const d = new Date(currentPeriod + "-01"); d.setMonth(d.getMonth() - 1); setCurrentPeriod(d.toISOString().slice(0, 7)); }} className="p-2 hover:bg-slate-50 rounded-xl transition-all"><ChevronLeft size={18}/></button>
                        <p className="px-4 font-black uppercase text-[11px] min-w-[120px] text-center">{new Date(currentPeriod + "-01").toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                        <button onClick={() => { const d = new Date(currentPeriod + "-01"); d.setMonth(d.getMonth() + 1); setCurrentPeriod(d.toISOString().slice(0, 7)); }} className="p-2 hover:bg-slate-50 rounded-xl transition-all"><ChevronRight size={18}/></button>
                    </div>
                    <button onClick={() => setAddPropModal(true)} className="bg-slate-900 text-white p-3 rounded-xl shadow-lg hover:scale-105 transition-all"><Plus size={18}/></button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
              <button onClick={() => setFinanceDetail({ open: true, type: 'Earnings', data: ledger.filter(l => l.billing_month === getPeriodLabel(currentPeriod) && l.payment_type?.toUpperCase() === 'RENT') })} className="bg-[#1E1E45] text-white p-8 rounded-[2.5rem] text-left relative shadow-xl border-b-8 border-emerald-500 active:scale-95 transition-all"><p className="text-[10px] font-black uppercase opacity-40 mb-1 italic">Earnings</p><h2 className="text-4xl font-black italic">₹{stats.earnings.toLocaleString()}</h2></button>
              <button onClick={() => setFinanceDetail({ open: true, type: 'Security', data: ledger.filter(l => l.billing_month === getPeriodLabel(currentPeriod) && l.payment_type?.toUpperCase() === 'SECURITY') })} className="bg-white border-2 p-8 rounded-[2.5rem] text-left shadow-sm active:scale-95 transition-all"><p className="text-[10px] font-black text-slate-400 uppercase mb-1 italic">Security</p><h2 className="text-3xl font-black italic tracking-tighter">₹{stats.security.toLocaleString()}</h2></button>
              <div className="bg-emerald-50 border-2 border-emerald-100 p-8 rounded-[2.5rem] text-left text-emerald-600 shadow-sm"><p className="text-[10px] font-black uppercase mb-1 italic">Advance</p><h2 className="text-3xl font-black italic">₹{stats.advance.toLocaleString()}</h2></div>
              <button onClick={() => setFinanceDetail({ open: true, type: 'Arrears', data: tenants.map(t => ({...t, balance: calculateBalanceAtPeriod(t, ledger, getPeriodLabel(currentPeriod))})).filter(t => t.balance > 0) })} className={`p-8 rounded-[2.5rem] border-2 text-left shadow-sm transition-all active:scale-95 ${stats.due > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white'}`}><p className="text-[10px] font-black uppercase mb-1 italic text-rose-500">Total Arrears</p><h2 className="text-3xl font-black italic text-rose-600 tracking-tighter">₹{stats.due.toLocaleString()}</h2></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {properties.map(p => (
                <div key={p.id} className="bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-sm relative group border-b-8 border-slate-900 transition-all hover:shadow-2xl">
                  <button onClick={(e) => { e.stopPropagation(); setSecurityModal({ open: true, type: 'property', id: p.id }); }} className="absolute top-8 right-8 p-3 text-rose-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-50 rounded-full"><Trash2 size={20}/></button>
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-8"><Building2 size={40}/></div>
                  <h4 className="text-3xl font-black italic uppercase tracking-tighter mb-2 italic">{p.name}</h4>
                  <p className="text-sm text-slate-400 mb-10 font-bold uppercase italic"><MapPin size={16} className="inline mr-1"/> {p.address}</p>
                  <button onClick={() => { setSelectedProperty(p); setView('inventory'); }} className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Inventory</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'inventory' && <Inventory selectedProperty={selectedProperty} rooms={rooms} tenants={tenants} ledger={ledger} properties={properties} handleBedAction={handleBedAction} setCheckInModal={setCheckInModal} setPaymentModal={setPaymentModal} setSecurityModal={setSecurityModal} setBookingModal={setBookingModal} setAddRoomModal={setAddRoomModal} setEditTenantModal={setEditTenantModal} setView={setView} calculateBalanceAtPeriod={calculateBalanceAtPeriod} currentPeriodLabel={getPeriodLabel(currentPeriod)} />}
        {view === 'tenants' && <Tenants tenants={tenants} rooms={rooms} ledger={ledger} properties={properties} setSecurityModal={setSecurityModal} setPaymentModal={setPaymentModal} setEditTenantModal={setEditTenantModal} calculateBalanceAtPeriod={calculateBalanceAtPeriod} currentPeriodLabel={getPeriodLabel(currentPeriod)} />}
      </main>

      {/* NEW PROPERTY MODAL */}
      {addPropModal && (
        <div className="fixed inset-0 bg-[#1E1E45]/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black uppercase italic mb-6">Setup Building</h3>
            <form onSubmit={async (e) => { 
                e.preventDefault(); const f = new FormData(e.target); 
                const { data } = await supabase.from('properties').insert([{ name: f.get('p_name'), address: f.get('p_address') }]).select().single();
                if (data) {
                    const count = Number(f.get('p_rooms'));
                    const payload = Array.from({ length: count }).map((_, i) => ({ property_id: data.id, room_number: (101 + i).toString(), room_type: 'Double', status: 'Vacant' }));
                    await supabase.from('rooms').insert(payload);
                }
                setAddPropModal(false); fetchData(); 
            }} className="space-y-4">
              <input name="p_name" placeholder="Building Name" required className="w-full bg-slate-50 p-5 rounded-2xl font-bold border shadow-inner" />
              <input name="p_address" placeholder="Address" required className="w-full bg-slate-50 p-5 rounded-2xl font-bold border shadow-inner" />
              <input name="p_rooms" type="number" placeholder="No. of Rooms" required className="w-full bg-slate-50 p-5 rounded-2xl font-bold border shadow-inner" />
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase shadow-xl transition-all hover:bg-black italic">Generate</button>
              <button onClick={() => setAddPropModal(false)} type="button" className="w-full text-slate-400 font-bold uppercase text-[10px] mt-2 block text-center hover:text-slate-600">Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* REGISTRATION MODAL */}
      {checkInModal.open && (
        <div className="fixed inset-0 bg-[#1E1E45]/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-4xl shadow-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-10"><h3 className="text-3xl font-black italic uppercase text-[#1E1E45]">Register Tenant</h3><button onClick={() => setCheckInModal({ open: false, room: null })}><X size={24}/></button></div>
                <form onSubmit={handleFinalCheckIn} className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <input name="t_name" required className="w-full bg-slate-50 p-5 rounded-2xl font-black text-lg italic border border-transparent focus:border-indigo-500 outline-none shadow-inner" placeholder="Full Name" />
                        <div className="grid grid-cols-2 gap-4"><input name="t_phone" required className="w-full bg-slate-50 p-5 rounded-2xl font-black outline-none shadow-inner border" placeholder="Mobile" /><input name="t_aadhaar" required className="w-full bg-slate-50 p-5 rounded-bold shadow-inner" placeholder="Aadhaar" /></div>
                        <div className="grid grid-cols-2 gap-4"><input name="t_emergency" className="w-full bg-slate-50 p-5 rounded-2xl font-black outline-none shadow-inner border" placeholder="Emergency No" /><input name="t_org_name" className="w-full bg-slate-50 p-5 rounded-2xl font-black outline-none shadow-inner border" placeholder="College / Co" /></div>
                        <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-2 italic font-bold">Joining Date</label><input name="t_join_date" type="date" required className="w-full bg-slate-50 p-5 rounded-2xl font-black outline-none shadow-inner border" /></div>
                        <textarea name="t_p_address" required className="w-full bg-slate-50 p-5 rounded-2xl font-black outline-none h-24 italic shadow-inner border" placeholder="Permanent Home Address"></textarea>
                    </div>
                    <div className="space-y-6 pt-12">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-2 italic font-bold text-rose-500">Monthly Rent</label><input name="t_rent" type="number" required className="w-full bg-rose-50 p-5 rounded-2xl font-black text-xl outline-none shadow-sm" /></div>
                            <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-2 italic font-bold text-indigo-500">Security Deposit</label><input name="t_security" type="number" required className="w-full bg-indigo-50 p-5 rounded-2xl font-black text-xl outline-none shadow-sm" /></div>
                        </div>
                        <button type="submit" className="w-full bg-emerald-500 text-white py-6 rounded-[2rem] font-black uppercase shadow-2xl mt-4 active:scale-95 transition-all italic font-bold tracking-widest hover:bg-emerald-600">Confirm Registration</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editTenantModal.open && (
        <div className="fixed inset-0 bg-[#1E1E45]/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] p-12 w-full max-w-4xl shadow-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-10"><h3 className="text-3xl font-black uppercase italic">Edit Profile</h3><button onClick={() => setEditTenantModal({ open: false, tenant: null })}><X size={24}/></button></div>
            <form onSubmit={handleUpdateTenant} className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <input name="e_name" defaultValue={editTenantModal.tenant?.full_name} placeholder="Full Name" required className="w-full bg-slate-50 p-5 rounded-2xl font-bold border shadow-inner" />
                <input name="e_phone" defaultValue={editTenantModal.tenant?.phone_number} placeholder="Mobile" required className="w-full bg-slate-50 p-5 rounded-2xl font-bold border shadow-inner" />
                <input name="e_aadhaar" defaultValue={editTenantModal.tenant?.aadhaar_number} placeholder="Aadhaar No" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border shadow-inner" />
                <input name="e_emergency" defaultValue={editTenantModal.tenant?.emergency_number} placeholder="Emergency Phone" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border shadow-inner" />
              </div>
              <div className="space-y-4">
                <input name="e_org" defaultValue={editTenantModal.tenant?.organization_name} placeholder="Office/College" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border shadow-inner" />
                <div className="grid grid-cols-2 gap-4">
                  <input name="e_rent" type="number" defaultValue={editTenantModal.tenant?.agreed_rent} placeholder="Rent" required className="bg-slate-50 p-5 rounded-2xl font-bold border shadow-inner" />
                  <input name="e_security" type="number" defaultValue={editTenantModal.tenant?.security_deposit} placeholder="Deposit" required className="bg-slate-50 p-5 rounded-2xl font-bold border shadow-inner" />
                </div>
                <textarea name="e_address" defaultValue={editTenantModal.tenant?.permanent_address} placeholder="Home Address" className="w-full bg-slate-50 p-5 rounded-2xl font-bold h-28 shadow-inner border" />
              </div>
              <button type="submit" className="md:col-span-2 py-5 bg-slate-900 text-white rounded-2xl font-black uppercase shadow-xl hover:bg-black transition-all italic">Save Changes</button>
            </form>
          </div>
        </div>
      )}

      {/* ADD ROOM MODAL */}
      {addRoomModal && (
        <div className="fixed inset-0 bg-[#1E1E45]/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black uppercase italic mb-6">Add Room</h3>
            <form onSubmit={async (e) => { 
                e.preventDefault(); const f = new FormData(e.target); 
                await supabase.from('rooms').insert([{ property_id: selectedProperty.id, room_number: f.get('r_num'), room_type: f.get('r_type'), status: 'Vacant' }]);
                setAddRoomModal(false); fetchData(); 
            }} className="space-y-4">
              <input name="r_num" placeholder="Room Number" required className="w-full bg-slate-50 p-5 rounded-2xl font-bold border shadow-inner" />
              <select name="r_type" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border shadow-inner"><option value="Single">Single Bed</option><option value="Double">Double Bed</option><option value="Triple">Triple Bed</option></select>
              <button type="submit" className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black uppercase shadow-xl italic transition-all">Confirm Unit</button>
              <button onClick={() => setAddRoomModal(false)} type="button" className="w-full text-slate-400 font-bold uppercase text-[10px] mt-2 block text-center">Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* PIN VERIFICATION */}
      {securityModal.open && (
        <div className="fixed inset-0 bg-[#1E1E45]/95 z-[1500] flex items-center justify-center p-4 backdrop-blur-xl">
          <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-md shadow-2xl text-center animate-in zoom-in-95">
            <h3 className="text-2xl font-black uppercase italic mb-8 tracking-tighter">Admin Authorization</h3>
            <input type="password" id="admin_pin_input" className="w-full bg-slate-50 p-6 rounded-3xl font-black text-center text-2xl tracking-[0.4em] outline-none border-4 border-transparent focus:border-rose-100 mb-8 shadow-inner" placeholder="••••" autoFocus />
            <div className="flex gap-4"><button onClick={() => setSecurityModal({ open: false, type: null, id: null })} className="flex-1 py-5 rounded-2xl font-black uppercase text-slate-400 bg-slate-100 transition-all hover:bg-slate-200">Cancel</button><button onClick={() => executeSecureDelete(document.getElementById('admin_pin_input').value)} className="flex-1 py-5 rounded-2xl font-black uppercase bg-rose-600 text-white shadow-xl transition-all hover:bg-rose-700">Delete</button></div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL (High Z-Index Fix) */}
      {paymentModal.open && (
        <div className="fixed inset-0 bg-[#1E1E45]/95 backdrop-blur-sm z-[1100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black uppercase mb-6 italic text-[#1E1E45] text-center">Record Receipt</h3>
            <p className="text-slate-400 text-xs font-bold uppercase mb-8 italic text-center">Tenant: {paymentModal.tenant?.full_name}</p>
            <form onSubmit={async (e) => { 
                e.preventDefault(); const f = new FormData(e.target); 
                await supabase.from('ledger').insert([{ tenant_id: paymentModal.tenant.id, property_id: paymentModal.tenant.property_id, billing_month: getPeriodLabel(currentPeriod), paid_amount: Number(f.get('p_amount')), payment_mode: f.get('p_mode'), payment_type: 'RENT', is_verified: true }]);
                setPaymentModal({ open: false, tenant: null }); await fetchData();
            }} className="space-y-6">
              <input name="p_amount" type="number" required className="w-full bg-slate-50 p-5 rounded-2xl font-black text-2xl outline-none border shadow-inner" placeholder="Amount ₹" autoFocus />
              <select name="p_mode" className="w-full bg-slate-50 p-5 rounded-2xl font-bold outline-none border transition-all"><option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Bank Transfer">Bank Transfer</option></select>
              <button type="submit" className="w-full py-6 bg-emerald-500 text-white rounded-[2rem] font-black uppercase shadow-xl tracking-widest italic active:scale-95 transition-all">Confirm Payment</button>
              <button type="button" onClick={() => setPaymentModal({ open: false, tenant: null })} className="w-full text-slate-300 font-bold uppercase text-[10px] mt-4 block w-full text-center hover:text-slate-500 transition-all">Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* ADVANCE BOOKING MODAL */}
      {bookingModal.open && (
        <div className="fixed inset-0 bg-[#1E1E45]/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black uppercase italic mb-6">Advance Booking</h3>
            <form onSubmit={async (e) => { 
                e.preventDefault(); const f = new FormData(e.target); 
                await handleBedAction(bookingModal.room, 'book', { name: f.get('b_name'), phone: f.get('b_phone'), date: f.get('b_date'), amount: f.get('b_amount') }); 
                setBookingModal({ open: false, room: null }); 
            }} className="space-y-4">
              <input name="b_name" placeholder="Guest Name" required className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none border" />
              <input name="b_phone" placeholder="Phone Number" required className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none border" />
              <div className="grid grid-cols-2 gap-4"><input name="b_date" type="date" required className="w-full bg-slate-50 p-4 rounded-2xl font-bold border text-xs" /><input name="b_amount" type="number" placeholder="Advance ₹" required className="w-full bg-slate-50 p-4 rounded-2xl font-bold border" /></div>
              <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase shadow-xl tracking-widest italic active:scale-95 transition-all">Reserve Slot</button>
              <button type="button" onClick={() => setBookingModal({ open: false, room: null })} className="w-full text-slate-300 font-bold uppercase text-[10px] mt-2 block w-full text-center">Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}