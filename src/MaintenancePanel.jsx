/**
 * MaintenancePanel.jsx — A2 Stay Pro
 * Staff & Owner maintenance ticket management:
 * • View all tickets across all rooms
 * • Filter by status / priority / property
 * • Mark as In Progress / Resolved with notes
 * • Sort by priority / date
 */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import {
  Wrench, CheckCircle2, Clock, AlertTriangle, Filter, X,
  ChevronDown, ChevronUp, RefreshCw, Loader2, MessageCircle,
  MapPin, User, Calendar, ArrowRight
} from 'lucide-react';

const INP = 'w-full bg-zinc-50 border border-zinc-200 px-4 py-3 rounded-xl font-medium text-sm outline-none focus:border-indigo-400 transition-all placeholder:text-zinc-400';

const STATUS_META = {
  Open:         { color: 'bg-rose-50 text-rose-600 border-rose-200',         dot: 'bg-rose-500',    label: 'Open'        },
  'In Progress':{ color: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-400',   label: 'In Progress' },
  Resolved:     { color: 'bg-emerald-50 text-emerald-600 border-emerald-200', dot: 'bg-emerald-500', label: 'Resolved'    },
};

const PRIORITY_ORDER = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

const CATEGORY_ICONS = {
  Plumbing:'🔧', Electrical:'⚡', Furniture:'🪑',
  AC:'❄️', Cleanliness:'🧹', Security:'🔒', Other:'📋',
};

export default function MaintenancePanel({ userProfile, properties = [], rooms = [], tenants = [] }) {
  const [tickets,       setTickets]       = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [statusFilter,  setStatusFilter]  = useState('all');  // all | Open | In Progress | Resolved
  const [propFilter,    setPropFilter]    = useState('all');
  const [resolveModal,  setResolveModal]  = useState(null);   // ticket object
  const [resolveNotes,  setResolveNotes]  = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [toast,         setToast]         = useState(null);
  const [expandedId,    setExpandedId]    = useState(null);

  const isOwnerAdmin = userProfile?.role === 'owner' || userProfile?.role === 'super_admin';

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTickets = useCallback(async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      let q = supabase.from('maintenance_tickets').select('*').order('created_at', { ascending: false });
      if (userProfile.role === 'staff') {
        // Staff sees tickets for properties they can access
        q = q.eq('owner_id', userProfile.owner_id);
      } else if (userProfile.role === 'owner') {
        q = q.eq('owner_id', userProfile.id);
      }
      // super_admin: no filter
      const { data } = await q;
      setTickets(data || []);
    } catch (e) { console.error('fetchTickets:', e.message); }
    setLoading(false);
  }, [userProfile]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleStatusChange = async (ticket, newStatus) => {
    if (newStatus === 'Resolved') {
      setResolveModal(ticket);
      return;
    }
    await supabase.from('maintenance_tickets').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', ticket.id);
    showToast(`Ticket marked ${newStatus}`);
    fetchTickets();
  };

  const handleResolve = async () => {
    if (!resolveModal) return;
    setSubmitting(true);
    await supabase.from('maintenance_tickets').update({
      status:       'Resolved',
      resolve_notes: resolveNotes,
      resolved_at:  new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    }).eq('id', resolveModal.id);
    showToast('Ticket resolved ✓');
    setResolveModal(null);
    setResolveNotes('');
    fetchTickets();
    setSubmitting(false);
  };

  const whatsappTenant = (ticket) => {
    const tenant = tenants.find(t => t.id === ticket.tenant_id);
    if (!tenant) return;
    window.open(`https://wa.me/91${tenant.phone_number}?text=${encodeURIComponent(`Hi ${tenant.full_name}, we've received your maintenance request: "${ticket.title}". We'll get back to you soon. - A2 Stay Team`)}`);
  };

  // Filter + sort
  const filtered = tickets
    .filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (propFilter  !== 'all' && t.property_id !== propFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.status === 'Resolved' && b.status !== 'Resolved') return 1;
      if (b.status === 'Resolved' && a.status !== 'Resolved') return -1;
      return (PRIORITY_ORDER[a.priority] || 3) - (PRIORITY_ORDER[b.priority] || 3);
    });

  const openCount     = tickets.filter(t => t.status === 'Open').length;
  const progressCount = tickets.filter(t => t.status === 'In Progress').length;
  const resolvedCount = tickets.filter(t => t.status === 'Resolved').length;

  return (
    <div className="animate-in fade-in pb-28">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-14 right-4 z-[3000] px-5 py-3 rounded-2xl shadow-2xl font-black text-[10px] uppercase tracking-widest border-l-4 animate-in slide-in-from-right duration-200
          ${toast.type === 'error' ? 'bg-rose-600 text-white border-white' : 'bg-zinc-900 text-white border-emerald-400'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Maintenance</h2>
          <p className="text-xs text-zinc-400 font-medium mt-0.5">{openCount} open · {progressCount} in progress · {resolvedCount} resolved</p>
        </div>
        <button onClick={fetchTickets} className="p-2.5 bg-white border border-zinc-200 rounded-xl shadow-sm hover:bg-zinc-50 active:scale-90 transition-all">
          <RefreshCw size={15} className={loading ? 'animate-spin text-indigo-500' : 'text-zinc-400'}/>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Open',        count: openCount,     color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-100',    filter: 'Open'        },
          { label: 'In Progress', count: progressCount, color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-100',   filter: 'In Progress' },
          { label: 'Resolved',    count: resolvedCount, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', filter: 'Resolved'    },
        ].map(({ label, count, color, bg, border, filter: f }) => (
          <button key={label} onClick={() => setStatusFilter(statusFilter === f ? 'all' : f)}
            className={`rounded-2xl p-3.5 border text-center transition-all active:scale-95 ${statusFilter === f ? `${bg} ${border} shadow-sm` : 'bg-white border-zinc-100 shadow-sm hover:shadow-md'}`}>
            <p className={`text-2xl font-black ${color}`}>{count}</p>
            <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Filters row */}
      {properties.length > 1 && (
        <div className="mb-4">
          <select value={propFilter} onChange={e => setPropFilter(e.target.value)}
            className="bg-white border border-zinc-200 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none shadow-sm">
            <option value="all">All Properties</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {/* Ticket list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-300"><Loader2 size={28} className="animate-spin"/></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-zinc-300">
          <Wrench size={36} className="mb-3"/>
          <p className="font-bold text-sm">{statusFilter !== 'all' ? `No ${statusFilter.toLowerCase()} tickets` : 'No maintenance tickets'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ticket => {
            const tenant   = tenants.find(t => t.id === ticket.tenant_id);
            const room     = rooms.find(r => r.id === ticket.room_id);
            const prop     = properties.find(p => p.id === ticket.property_id);
            const meta     = STATUS_META[ticket.status] || STATUS_META.Open;
            const isExpanded = expandedId === ticket.id;

            return (
              <div key={ticket.id} className="bg-white border border-zinc-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                {/* Card header */}
                <button onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                  className="w-full p-4 text-left">
                  <div className="flex items-start gap-3">
                    <div className="text-xl flex-shrink-0 mt-0.5">{CATEGORY_ICONS[ticket.category] || '📋'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-black text-sm leading-tight">{ticket.title}</p>
                        {isExpanded ? <ChevronUp size={14} className="text-zinc-300 flex-shrink-0"/> : <ChevronDown size={14} className="text-zinc-300 flex-shrink-0"/>}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${meta.color}`}>{meta.label}</span>
                        <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full
                          ${ticket.priority === 'Urgent' ? 'bg-rose-100 text-rose-600' :
                            ticket.priority === 'High'   ? 'bg-orange-100 text-orange-600' :
                            ticket.priority === 'Medium' ? 'bg-amber-100 text-amber-600' :
                            'bg-zinc-100 text-zinc-500'}`}>{ticket.priority}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[9px] text-zinc-400 font-medium">
                        {tenant && <span className="flex items-center gap-1"><User size={9}/> {tenant.full_name}</span>}
                        {prop && <span className="flex items-center gap-1"><MapPin size={9}/> {prop.name}{room ? ` · Rm ${room.room_number}` : ''}</span>}
                        <span className="flex items-center gap-1"><Calendar size={9}/> {new Date(ticket.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-zinc-50 pt-3 space-y-3 animate-in fade-in duration-150">
                    {ticket.description && (
                      <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Description</p>
                        <p className="text-xs text-zinc-600 leading-relaxed">{ticket.description}</p>
                      </div>
                    )}

                    {ticket.status === 'Resolved' && (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">
                          ✓ Resolved {ticket.resolved_at && `on ${new Date(ticket.resolved_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}`}
                        </p>
                        {ticket.resolve_notes && <p className="text-xs text-emerald-700">{ticket.resolve_notes}</p>}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {/* Status change — only owners/admins/staff */}
                      {ticket.status === 'Open' && (
                        <button onClick={() => handleStatusChange(ticket, 'In Progress')}
                          className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 text-amber-700 px-3 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-amber-500 hover:text-white hover:border-amber-500 active:scale-95 transition-all">
                          <ArrowRight size={11}/> Start Working
                        </button>
                      )}
                      {ticket.status !== 'Resolved' && (
                        <button onClick={() => handleStatusChange(ticket, 'Resolved')}
                          className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-600 px-3 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-500 hover:text-white hover:border-emerald-500 active:scale-95 transition-all">
                          <CheckCircle2 size={11}/> Mark Resolved
                        </button>
                      )}
                      {ticket.status === 'Resolved' && (
                        <button onClick={() => handleStatusChange(ticket, 'Open')}
                          className="flex items-center gap-1.5 bg-zinc-100 text-zinc-500 px-3 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-zinc-200 active:scale-95 transition-all">
                          Reopen
                        </button>
                      )}
                      {tenant?.phone_number && (
                        <button onClick={() => whatsappTenant(ticket)}
                          className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-600 px-3 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-[#25D366] hover:text-white hover:border-[#25D366] active:scale-95 transition-all ml-auto">
                          <MessageCircle size={11}/> WhatsApp
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1500] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-zinc-100">
              <div>
                <h3 className="text-base font-black">Mark as Resolved</h3>
                <p className="text-xs text-zinc-400 mt-0.5 truncate">{resolveModal.title}</p>
              </div>
              <button onClick={() => { setResolveModal(null); setResolveNotes(''); }} className="p-2 bg-zinc-100 rounded-xl"><X size={17}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1.5 block">Resolution Notes (optional)</label>
                <textarea
                  value={resolveNotes}
                  onChange={e => setResolveNotes(e.target.value)}
                  className={`${INP} h-24 resize-none`}
                  placeholder="Describe what was fixed, parts replaced, time taken…"/>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setResolveModal(null); setResolveNotes(''); }}
                  className="py-3.5 bg-zinc-100 rounded-2xl font-black text-[10px] uppercase hover:bg-zinc-200 active:scale-95 transition-all">Cancel</button>
                <button onClick={handleResolve} disabled={submitting}
                  className="py-3.5 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting && <Loader2 size={13} className="animate-spin"/>}
                  <CheckCircle2 size={13}/> Resolve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
