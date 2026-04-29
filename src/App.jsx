import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';
import AuthWrapper from './AuthWrapper';
import Inventory from './Inventory';
import Tenants from './Tenants';

import {
  LayoutDashboard,
  Users,
  RefreshCw,
  Home,
  Settings,
  Loader2,
  TrendingUp,
  AlertTriangle,
  IndianRupee,
  ShieldCheck,
  Building2,
} from 'lucide-react';

export default function App() {

  /* ─────────────────────────────────────────────
     CORE STATE
  ───────────────────────────────────────────── */

  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [view, setView] = useState('dashboard');

  /* ─────────────────────────────────────────────
     DATA STATE
  ───────────────────────────────────────────── */

  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [ledger, setLedger] = useState([]);

  const [selectedProperty, setSelectedProperty] = useState(null);

  const [currentPeriod] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const [stats, setStats] = useState({
    earnings: 0,
    due: 0,
    advance: 0,
    security: 0,
  });

  /* ─────────────────────────────────────────────
     UTILITIES
  ───────────────────────────────────────────── */

  const getPeriodLabel = (dateStr) => {
    try {
      const [year, month] = dateStr.split('-');
      return `${month}-${year}`;
    } catch {
      return '';
    }
  };

  const calculateBalanceAtPeriod = useCallback(
    (tenant, allLedger, periodLabel) => {

      if (!tenant?.is_active) return 0;

      const rent = Number(tenant?.agreed_rent || 0);

      const paid = (allLedger || [])
        .filter(
          (l) =>
            l?.tenant_id === tenant?.id &&
            l?.is_verified &&
            !l?.is_rejected &&
            l?.payment_type === 'RENT' &&
            (
              l?.billing_month === periodLabel ||
              l?.payment_for_month === periodLabel
            )
        )
        .reduce(
          (sum, l) => sum + Number(l?.paid_amount || 0),
          0
        );

      return Math.max(rent - paid, 0);
    },
    []
  );

  /* ─────────────────────────────────────────────
     AUTH BOOTSTRAP
  ───────────────────────────────────────────── */

  useEffect(() => {

    let mounted = true;

    const init = async () => {

      try {

        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(currentSession);

      } catch (err) {
        console.error('Session Error:', err);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };

  }, []);

  /* ─────────────────────────────────────────────
     DATA FETCH ENGINE
  ───────────────────────────────────────────── */

  const fetchData = useCallback(async () => {

    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    try {

      setRefreshing(true);

      /* PROFILE */

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        console.error(profileError);
        return;
      }

      setUserProfile(profile);

      const ownerId =
        profile?.role === 'staff'
          ? profile?.owner_id
          : session?.user?.id;

      /* PARALLEL FETCH */

      const [
        propertyRes,
        roomRes,
        tenantRes,
        ledgerRes,
        userRes,
      ] = await Promise.all([

        supabase
          .from('properties')
          .select('*')
          .eq('owner_id', ownerId)
          .order('created_at', { ascending: false }),

        supabase
          .from('rooms')
          .select('*')
          .eq('owner_id', ownerId)
          .order('room_number'),

        supabase
          .from('tenants')
          .select('*')
          .eq('owner_id', ownerId),

        supabase
          .from('ledger')
          .select('*')
          .eq('owner_id', ownerId)
          .order('created_at', { ascending: false }),

        supabase
          .from('profiles')
          .select('id, full_name'),
      ]);

      const propertiesData = propertyRes?.data || [];
      const roomsData = roomRes?.data || [];
      const tenantsData = tenantRes?.data || [];
      const ledgerData = ledgerRes?.data || [];
      const usersData = userRes?.data || [];

      /* ─────────────────────────────────────────────
         ENRICH LEDGER
      ───────────────────────────────────────────── */

      const enrichedLedger = ledgerData.map((entry) => {

        const tenant = tenantsData.find(
          (t) => t.id === entry.tenant_id
        );

        const room = roomsData.find(
          (r) =>
            r.id === entry.room_id ||
            r.id === tenant?.room_id
        );

        const property = propertiesData.find(
          (p) => p.id === entry.property_id
        );

        const collector = usersData.find(
          (u) => u.id === entry.recorded_by
        );

        return {
          ...entry,

          tenant_name:
            tenant?.full_name ||
            room?.booked_by_name ||
            'Resident',

          property_name:
            property?.name || 'NA',

          room_number:
            room?.room_number || 'NA',

          collected_by:
            collector?.full_name || 'Staff',
        };
      });

      /* ─────────────────────────────────────────────
         DYNAMIC OCCUPANCY FIX
      ───────────────────────────────────────────── */

      const updatedRooms = roomsData.map((room) => {

        const occupiedBeds = tenantsData.filter(
          (tenant) =>
            tenant?.room_id === room?.id &&
            tenant?.is_active
        ).length;

        return {
          ...room,
          occupied_beds: occupiedBeds,
        };
      });

      /* ─────────────────────────────────────────────
         SET STATE
      ───────────────────────────────────────────── */

      setProperties(propertiesData);
      setRooms(updatedRooms);
      setTenants(tenantsData);
      setLedger(enrichedLedger);

      /* ─────────────────────────────────────────────
         STATS
      ───────────────────────────────────────────── */

      const periodLabel = getPeriodLabel(currentPeriod);

      const verifiedLedger = enrichedLedger.filter(
        (l) =>
          l?.is_verified &&
          !l?.is_rejected
      );

      const earnings = verifiedLedger
        .filter(
          (l) =>
            l?.payment_type === 'RENT' &&
            (
              l?.billing_month === periodLabel ||
              l?.payment_for_month === periodLabel
            )
        )
        .reduce(
          (sum, l) => sum + Number(l?.paid_amount || 0),
          0
        );

      const advance = verifiedLedger
        .filter((l) => l?.payment_type === 'ADVANCE')
        .reduce(
          (sum, l) => sum + Number(l?.paid_amount || 0),
          0
        );

      const security = verifiedLedger
        .filter((l) => l?.payment_type === 'SECURITY')
        .reduce(
          (sum, l) => sum + Number(l?.paid_amount || 0),
          0
        );

      const due = tenantsData
        .filter((t) => t?.is_active)
        .reduce(
          (sum, tenant) =>
            sum +
            calculateBalanceAtPeriod(
              tenant,
              verifiedLedger,
              periodLabel
            ),
          0
        );

      setStats({
        earnings,
        due,
        advance,
        security,
      });

    } catch (err) {

      console.error('Fetch Error:', err);

    } finally {

      setLoading(false);
      setRefreshing(false);

    }

  }, [session, currentPeriod, calculateBalanceAtPeriod]);

  /* ─────────────────────────────────────────────
     INITIAL FETCH
  ───────────────────────────────────────────── */

  useEffect(() => {

    if (session?.user?.id) {
      fetchData();
    }

  }, [session, fetchData]);

  /* ─────────────────────────────────────────────
     LOADER
  ───────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-indigo-600 text-white">
        <Loader2 className="animate-spin mb-4" size={42} />
        <p className="font-black uppercase tracking-[0.3em] text-[10px]">
          Loading A2 Stay Pro
        </p>
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     MAIN UI
  ───────────────────────────────────────────── */

  return (
    <AuthWrapper>

      <div className="min-h-screen bg-white text-zinc-900 flex flex-col">

        {/* HEADER */}

        <header className="sticky top-0 z-50 bg-white border-b border-zinc-100 px-4 py-4 flex justify-between items-center">

          <div className="flex items-center gap-3">

            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg">
              <Home size={18} />
            </div>

            <div>
              <h1 className="font-black text-sm uppercase tracking-wide">
                {userProfile?.brand_name || 'A2 Stay'}
              </h1>

              <p className="text-[10px] uppercase font-bold text-zinc-400">
                Hospitality ERP
              </p>
            </div>

          </div>

          <button
            onClick={fetchData}
            className="p-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 transition-all"
          >
            <RefreshCw
              size={16}
              className={refreshing ? 'animate-spin' : ''}
            />
          </button>

        </header>

        {/* MAIN */}

        <main className="flex-1 p-4 pb-32 max-w-7xl mx-auto w-full">

          {/* DASHBOARD */}

          {view === 'dashboard' && (

            <div className="space-y-8 animate-in fade-in duration-300">

              <div className="flex justify-between items-center">

                <div>
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter">
                    Finance Hub
                  </h2>

                  <p className="text-zinc-400 text-xs font-bold uppercase mt-1">
                    Real-time financial overview
                  </p>
                </div>

              </div>

              {/* STAT CARDS */}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                {[
                  {
                    label: 'Collected',
                    value: stats.earnings,
                    icon: TrendingUp,
                    color: 'text-indigo-600',
                    bg: 'bg-indigo-50',
                  },

                  {
                    label: 'Dues',
                    value: stats.due,
                    icon: AlertTriangle,
                    color: 'text-rose-600',
                    bg: 'bg-rose-50',
                  },

                  {
                    label: 'Advance',
                    value: stats.advance,
                    icon: IndianRupee,
                    color: 'text-emerald-600',
                    bg: 'bg-emerald-50',
                  },

                  {
                    label: 'Security',
                    value: stats.security,
                    icon: ShieldCheck,
                    color: 'text-violet-600',
                    bg: 'bg-violet-50',
                  },

                ].map((item, index) => (

                  <div
                    key={index}
                    className={`p-6 rounded-[2rem] border border-zinc-100 ${item.bg}`}
                  >

                    <item.icon
                      size={20}
                      className={`${item.color} mb-3`}
                    />

                    <p className="text-[10px] uppercase font-black tracking-widest text-zinc-400">
                      {item.label}
                    </p>

                    <h3 className={`text-2xl font-black mt-1 ${item.color}`}>
                      ₹{Number(item.value || 0).toLocaleString()}
                    </h3>

                  </div>

                ))}

              </div>

              {/* PROPERTY GRID */}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

                {(properties || []).map((property) => (

                  <div
                    key={property.id}
                    className="bg-zinc-50 border border-zinc-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all"
                  >

                    <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-6">
                      <Building2 size={26} />
                    </div>

                    <h3 className="text-2xl font-black tracking-tight">
                      {property?.name}
                    </h3>

                    <p className="mt-2 text-[11px] font-bold uppercase text-zinc-400">
                      {property?.address}
                    </p>

                    <button
                      onClick={() => {
                        setSelectedProperty(property);
                        setView('inventory');
                      }}
                      className="mt-8 w-full py-4 rounded-2xl bg-zinc-900 hover:bg-indigo-600 text-white font-black uppercase tracking-widest text-[11px] transition-all"
                    >
                      Manage Building
                    </button>

                  </div>

                ))}

              </div>

            </div>

          )}

          {/* INVENTORY */}

          {view === 'inventory' && (

            <Inventory
              selectedProperty={selectedProperty}
              rooms={
                rooms.filter(
                  (r) => r.property_id === selectedProperty?.id
                )
              }
              tenants={tenants}
              ledger={ledger}
              fetchData={fetchData}
              setView={setView}
              userRole={userProfile?.role}
              calculateBalanceAtPeriod={calculateBalanceAtPeriod}
              currentPeriodLabel={getPeriodLabel(currentPeriod)}
            />

          )}

          {/* TENANTS */}

          {view === 'tenants' && (

            <Tenants
              tenants={tenants}
              rooms={rooms}
              ledger={ledger}
              fetchData={fetchData}
              userRole={userProfile?.role}
              calculateBalanceAtPeriod={calculateBalanceAtPeriod}
              currentPeriodLabel={getPeriodLabel(currentPeriod)}
            />

          )}

          {/* SETTINGS */}

          {view === 'settings' && (

            <div className="max-w-xl mx-auto">

              <div className="p-10 rounded-[2.5rem] border border-zinc-100 bg-zinc-50">

                <h2 className="text-2xl font-black uppercase">
                  Account Settings
                </h2>

                <div className="mt-8 space-y-4">

                  <div>
                    <p className="text-[10px] uppercase font-black text-zinc-400">
                      Name
                    </p>

                    <p className="font-bold mt-1">
                      {userProfile?.full_name || 'NA'}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-black text-zinc-400">
                      Email
                    </p>

                    <p className="font-bold mt-1">
                      {session?.user?.email || 'NA'}
                    </p>
                  </div>

                </div>

              </div>

            </div>

          )}

        </main>

        {/* BOTTOM NAV */}

        <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-zinc-100 p-4 pb-8 flex justify-around shadow-2xl z-[100]">

          {[
            {
              key: 'dashboard',
              icon: LayoutDashboard,
            },
            {
              key: 'tenants',
              icon: Users,
            },
            {
              key: 'settings',
              icon: Settings,
            },
          ].map((nav) => (

            <button
              key={nav.key}
              onClick={() => setView(nav.key)}
              className={`flex flex-col items-center gap-1 transition-all ${
                view === nav.key
                  ? 'text-indigo-600'
                  : 'text-zinc-300'
              }`}
            >

              <div
                className={`p-3 rounded-2xl ${
                  view === nav.key
                    ? 'bg-indigo-50'
                    : ''
                }`}
              >
                <nav.icon size={22} />
              </div>

            </button>

          ))}

        </nav>

      </div>

    </AuthWrapper>
  );
}
