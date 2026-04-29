import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import AuthWrapper from './AuthWrapper';
import Inventory   from './Inventory';
import Tenants     from './Tenants';
import Team        from './Team';
import MaintenancePanel from './MaintenancePanel';
import TenantPortal     from './TenantPortal';
import {
  X, ShieldCheck, Building2, MapPin, LayoutDashboard,
  RefreshCw, Users, Plus, ChevronLeft, ChevronRight,
  Trash2, Lock, TrendingUp, AlertTriangle, IndianRupee, 
  Home, LogOut, Settings, Bell, Download, Loader2, ClipboardList, Wrench
} from 'lucide-react';

const ADMIN_CODE = 'A2-ADMIN';

// --- HELPER LOGIC ---
function calculateBalanceAtPeriod(tenant, ledger, periodLabel) {
  if (!tenant?.join_date || !tenant?.agreed_rent || !tenant.is_active) return 0;
  const rent = Number(tenant.agreed_rent);
  const paid = (ledger || [])
    .filter(l => l.tenant_id === tenant.id && l.is_verified && !l.is_rejected && 
            l.payment_type?.toUpperCase() === 'RENT' && 
            (l.payment_for_month === periodLabel || l.billing_month === periodLabel))
    .reduce((sum, l) => sum + Number(l.paid_amount || 0), 0);
  return Math.max(rent - paid, 0);
}

const getPeriodLabel = (dateStr) => {
  const [y, m] = dateStr.split('-');
  return `${m}-${y}`;
};

export default function App() {
  // --- CORE STATE ---
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [allUsersList, setAllUsersList] = useState([]);
  const [viewingAsId, setViewingAsId] = useState('GLOBAL');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [currentPeriod, setCurrentPeriod] = useState(new Date().toISOString().slice(0, 7));

  // --- MODAL STATE ---
  const [paymentModal, setPaymentModal] = useState({ open: false, tenant: null });
  const [checkInModal, setCheckInModal] = useState({ open: false, room: null });
  const [bookingModal, setBookingModal] = useState({ open: false, room: null });
  const [securityModal, setSecurityModal] = useState({ open: false, type: null, id: null });
  const [addPropModal, setAddPropModal] = useState(false);
  const [addRoomModal, setAddRoomModal] = useState(false);
  const [editTenantModal, setEditTenantModal] = useState({ open: false, tenant: null });

  // --- HANDLERS (The "Glue" that makes buttons work) ---
  const fetchData = useCallback(async (userId, profile) => {
    if (!userId || !profile || profile.role === 'tenant') {
        setLoading(false);
        return;
    }
    setLoading(true);
    try {
      let targetId = profile.role === 'staff' ? profile.owner_id : (viewingAsId === 'GLOBAL' ? userId : viewingAsId);
      const matchQuery = profile.role === 'super_admin' && viewingAsId === 'GLOBAL' ? {} : { owner_id: targetId };

      const [pRes, rRes, tRes, lRes, uRes] = await Promise.all([
        supabase.from('properties').select('*').match(matchQuery),
        supabase.from('rooms').select('*').match(matchQuery).order('room_number'),
        supabase.from('tenants').select('*').match(matchQuery),
        supabase.from('ledger').select('*').match(matchQuery).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*')
      ]);

      setProperties(pRes.data || []);
      setRooms(rRes.data || []);
      setTenants(tRes.data || []);
      setLedger(lRes.data || []);
      setAllUsersList(uRes.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [viewingAsId]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) {
        supabase.from('profiles').select('*').eq('id', s.user.id).single()
          .then(({ data: profile }) => {
            setUserProfile(profile);
            fetchData(s.user.id, profile);
          });
      }
    });
  }, [fetchData]);

  const handleBedAction = async (room, action, extra = null) => {
    // Buttons in Inventory depend on this
    const { error } = await supabase.from('rooms').update(
      action === 'rename' ? { room_number: String(extra) } :
      action === 'changeType' ? { room_type: extra } :
      action === 'block' ? { status: 'Maintenance' } : { status: 'Vacant' }
    ).eq('id', room.id);
    if (!error) fetchData(session.user.id, userProfile);
  };

  // --- RENDER LOGIC ---
  if (userProfile?.role === 'tenant') return <AuthWrapper><TenantPortal session={session} /></AuthWrapper>;
  if (loading) return <div className="h-screen flex items-center justify-center font-black text-zinc-400 animate-pulse">A2 STAY PRO SYNCING...</div>;

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-white text-zinc-900 flex flex-col">
        <header className="sticky top-0 z-40 bg-white border-b px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white"><Home size={16}/></div>
            <h1 className="font-black text-sm uppercase">{userProfile?.brand_name || 'A2 Stay'}</h1>
          </div>
          <button onClick={() => fetchData(session.user.id, userProfile)} className="p-2 bg-zinc-100 rounded-lg"><RefreshCw size={16}/></button>
        </header>

        <main className="flex-1 p-4 pb-32 max-w-7xl mx-auto w-full">
          {view === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map(p => (
                <div key={p.id} className="bg-white border rounded-[2rem] p-6 shadow-sm hover:shadow-lg transition-all">
                  <h4 className="text-xl font-black">{p.name}</h4>
                  <button onClick={() => { setSelectedProperty(p); setView('inventory'); }} className="mt-4 w-full py-4 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">Manage Building</button>
                </div>
              ))}
            </div>
          )}

          {view === 'inventory' && (
            <Inventory 
              selectedProperty={selectedProperty} rooms={rooms} tenants={tenants} ledger={ledger}
              handleBedAction={handleBedAction} setCheckInModal={setCheckInModal} setPaymentModal={setPaymentModal}
              setBookingModal={setBookingModal} setAddRoomModal={setAddRoomModal} setEditTenantModal={setEditTenantModal}
              setSecurityModal={setSecurityModal} setView={setView} calculateBalanceAtPeriod={calculateBalanceAtPeriod}
              currentPeriodLabel={getPeriodLabel(currentPeriod)} userRole={userProfile?.role}
            />
          )}

          {view === 'tenants' && (
            <Tenants 
              tenants={tenants} rooms={rooms} ledger={ledger} properties={properties} 
              setPaymentModal={setPaymentModal} setSecurityModal={setSecurityModal} 
              setEditTenantModal={setEditTenantModal} calculateBalanceAtPeriod={calculateBalanceAtPeriod} 
              currentPeriodLabel={getPeriodLabel(currentPeriod)} userRole={userProfile?.role}
            />
          )}

          {view === 'maintenance' && <MaintenancePanel userProfile={userProfile} properties={properties} rooms={rooms} tenants={tenants} />}
          {view === 'team' && <Team userProfile={userProfile} allUsersList={allUsersList} onRefreshUsers={() => fetchData(session.user.id, userProfile)} />}
        </main>

        <nav className="fixed bottom-0 inset-x-0 bg-white border-t p-4 flex justify-around shadow-2xl z-50">
          <button onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'text-indigo-600' : 'text-zinc-400'}><LayoutDashboard/></button>
          <button onClick={() => setView('tenants')} className={view === 'tenants' ? 'text-indigo-600' : 'text-zinc-400'}><Users/></button>
          <button onClick={() => setView('maintenance')} className={view === 'maintenance' ? 'text-indigo-600' : 'text-zinc-400'}><Wrench/></button>
          {userProfile?.role !== 'staff' && <button onClick={() => setView('team')} className={view === 'team' ? 'text-indigo-600' : 'text-zinc-400'}><ShieldCheck/></button>}
          <button onClick={() => setView('settings')} className={view === 'settings' ? 'text-indigo-600' : 'text-zinc-400'}><Settings/></button>
        </nav>
      </div>
    </AuthWrapper>
  );
}
