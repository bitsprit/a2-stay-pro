/**
 * Team.jsx — A2 Stay Pro
 * ══════════════════════════════════════════════════════
 * Fixes:
 * 1. Super Admin sees ALL owners with their property counts + staff
 * 2. Owner sees their own staff with full edit/delete
 * 3. Staff attribution shown throughout
 * 4. INP was undefined (crashing page) — defined locally
 * 5. Session-swap warning on account creation
 * ══════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import {
  UserPlus, Trash2, ShieldCheck, UserCircle, X, Loader2,
  AlertTriangle, Users, Crown, User, Building2, ChevronDown,
  ChevronUp, Edit3, Phone, Mail, CheckCircle2, Copy
} from 'lucide-react';

const INP = 'w-full bg-zinc-50 border border-zinc-200 px-4 py-3.5 rounded-2xl font-medium text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all placeholder:text-zinc-400';

const ROLE_META = {
  super_admin: { label: 'Super Admin', bg: 'bg-rose-50',    text: 'text-rose-600',   border: 'border-rose-200'   },
  owner:       { label: 'Owner',       bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200'  },
  staff:       { label: 'Staff',       bg: 'bg-indigo-50',  text: 'text-indigo-600', border: 'border-indigo-200' },
};

export default function Team({ userProfile, allUsersList = [], onRefreshUsers }) {
  const [users,         setUsers]         = useState([]);
  const [properties,    setProperties]    = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [formOpen,      setFormOpen]      = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [expandedOwner, setExpandedOwner] = useState(null); // owner id that's expanded
  const [editUser,      setEditUser]      = useState(null);  // user being edited
  const [err,           setErr]           = useState('');
  const [toast,         setToast]         = useState('');
  const [toastType,     setToastType]     = useState('success');
  const [tempCred,      setTempCred]      = useState(null);

  if (!userProfile) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 size={32} className="animate-spin text-indigo-400"/>
    </div>
  );

  const isSA     = userProfile.role === 'super_admin';
  const isOwner  = userProfile.role === 'owner';
  const canManage = isSA || isOwner;

  const showToast = (msg, type = 'success') => {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(''), 3500);
  };

  // ── Fetch all users + properties scoped to role ───────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Users query
      let uQ = supabase.from('profiles').select('*').order('role', { ascending: true });
      if (isOwner) {
        // Owner sees self + their staff only
        uQ = uQ.or(`id.eq.${userProfile.id},owner_id.eq.${userProfile.id}`);
      }
      // super_admin: no filter → everyone

      // Properties query to show per-owner context
      let pQ = supabase.from('properties').select('id, name, address, owner_id');
      if (isOwner) pQ = pQ.eq('owner_id', userProfile.id);

      const [{ data: uData }, { data: pData }] = await Promise.all([uQ, pQ]);
      setUsers(uData || []);
      setProperties(pData || []);
    } catch (e) { console.error('Team fetchAll:', e.message); }
    setLoading(false);
  }, [userProfile.id, userProfile.role, isOwner]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Create new member ─────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true); setErr('');
    const f      = new FormData(e.target);
    const name   = f.get('name')?.trim();
    const email  = f.get('email')?.trim();
    const pw     = f.get('password');
    const role   = f.get('role');
    const brand  = f.get('brand')?.trim() || userProfile.brand_name || 'A2 Stay';
    // If SA is creating an owner, let them assign owner_id = null (they ARE the owner)
    // If SA/Owner creating staff, owner_id = selected owner or current user
    const ownerId = role === 'staff' ? (f.get('assign_to') || userProfile.id) : null;

    if (!name || !email || !pw) { setErr('All fields are required.'); setSubmitting(false); return; }

    try {
      const { data: { session: curSession } } = await supabase.auth.getSession();

      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email, password: pw,
        options: { data: { full_name: name, role, brand_name: brand, owner_id: ownerId } }
      });
      if (authErr) throw authErr;

      if (authData?.user) {
        const { error: profErr } = await supabase.from('profiles').upsert({
          id: authData.user.id,
          full_name: name, email, role, brand_name: brand,
          owner_id: ownerId,
        }, { onConflict: 'id' });
        if (profErr) console.warn('Profile upsert:', profErr.message);
      }

      // Restore admin session if swapped
      if (curSession && authData?.user?.id !== curSession.user.id) {
        try {
          await supabase.auth.setSession({
            access_token:  curSession.access_token,
            refresh_token: curSession.refresh_token,
          });
        } catch (_) {}
      }

      setTempCred({ email, password: pw, name, role });
      setFormOpen(false);
      e.target.reset();
      showToast(`${ROLE_META[role]?.label || role} account created`);
      fetchAll();
      if (onRefreshUsers) onRefreshUsers();
    } catch (error) {
      setErr(error.message);
    }
    setSubmitting(false);
  };

  // ── Update member role/brand ──────────────────────────────────────────────
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    await supabase.from('profiles').update({
      full_name:  f.get('u_name'),
      role:       f.get('u_role'),
      brand_name: f.get('u_brand'),
    }).eq('id', editUser.id);
    showToast('Member updated');
    setEditUser(null);
    fetchAll();
    if (onRefreshUsers) onRefreshUsers();
  };

  // ── Delete member ─────────────────────────────────────────────────────────
  const handleDelete = async (u) => {
    if (u.id === userProfile.id) return;
    if (!window.confirm(`Remove ${u.full_name}? Their auth account will remain inactive.`)) return;
    await supabase.from('profiles').delete().eq('id', u.id);
    showToast(`${u.full_name} removed`, 'error');
    fetchAll();
    if (onRefreshUsers) onRefreshUsers();
  };

  // ── Data helpers ──────────────────────────────────────────────────────────
  const owners        = users.filter(u => u.role === 'owner');
  const admins        = users.filter(u => u.role === 'super_admin');
  const allStaff      = users.filter(u => u.role === 'staff');
  const orphanStaff   = allStaff.filter(s => !owners.some(o => o.id === s.owner_id) && s.owner_id !== userProfile.id);
  const getOwnerStaff = (ownerId) => allStaff.filter(s => s.owner_id === ownerId);
  const getOwnerProps = (ownerId) => properties.filter(p => p.owner_id === ownerId);
  const getAvatar     = (name) => (name || '?').charAt(0).toUpperCase();

  // ── Reusable user row ─────────────────────────────────────────────────────
  const UserRow = ({ u, indent = false, showProps = false }) => {
    const meta  = ROLE_META[u.role] || ROLE_META.staff;
    const isSelf = u.id === userProfile.id;
    const uProps = showProps ? getOwnerProps(u.id) : [];
    const uStaff = showProps ? getOwnerStaff(u.id) : [];
    const isExpanded = expandedOwner === u.id;

    return (
      <div className={`${indent ? 'ml-4 sm:ml-8 border-l-2 border-indigo-100 pl-3 sm:pl-4' : ''}`}>
        <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-base ${meta.bg} ${meta.text} border ${meta.border}`}>
              {getAvatar(u.full_name)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-black text-sm leading-tight truncate">{u.full_name || '—'}</p>
                {isSelf && <span className="text-[8px] bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full font-bold uppercase shrink-0">You</span>}
                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${meta.bg} ${meta.text} ${meta.border} shrink-0`}>{meta.label}</span>
              </div>
              <p className="text-[10px] text-zinc-400 font-medium truncate mt-0.5">{u.email || '—'}</p>
              {u.brand_name && <p className="text-[9px] text-zinc-300 font-medium">{u.brand_name}</p>}

              {/* Stats for owners */}
              {showProps && (uProps.length > 0 || uStaff.length > 0) && (
                <div className="flex gap-3 mt-2 flex-wrap">
                  {uProps.length > 0 && (
                    <span className="flex items-center gap-1 text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg">
                      <Building2 size={9}/> {uProps.length} property{uProps.length !== 1 ? 'ies' : 'y'}
                    </span>
                  )}
                  {uStaff.length > 0 && (
                    <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg">
                      <Users size={9}/> {uStaff.length} staff
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {showProps && (uProps.length > 0 || uStaff.length > 0) && (
                <button onClick={() => setExpandedOwner(isExpanded ? null : u.id)}
                  className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                  {isExpanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                </button>
              )}
              {canManage && !isSelf && (
                <>
                  <button onClick={() => setEditUser(u)}
                    className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                    <Edit3 size={14}/>
                  </button>
                  <button onClick={() => handleDelete(u)}
                    className="p-2 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                    <Trash2 size={14}/>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Expanded owner details */}
          {showProps && isExpanded && (
            <div className="mt-4 pt-4 border-t border-zinc-100 space-y-3 animate-in fade-in duration-200">
              {/* Properties */}
              {uProps.length > 0 && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Properties</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {uProps.map(p => (
                      <div key={p.id} className="bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2.5 flex items-start gap-2">
                        <Building2 size={13} className="text-indigo-400 mt-0.5 flex-shrink-0"/>
                        <div className="min-w-0">
                          <p className="font-black text-xs truncate">{p.name}</p>
                          <p className="text-[9px] text-zinc-400 truncate">{p.address}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Staff under this owner */}
              {uStaff.length > 0 && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Staff Members</p>
                  <div className="space-y-1.5">
                    {uStaff.map(s => (
                      <div key={s.id} className="bg-indigo-50/50 border border-indigo-100 rounded-xl px-3 py-2 flex items-center gap-2">
                        <div className="w-7 h-7 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0">
                          {getAvatar(s.full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-xs truncate">{s.full_name}</p>
                          <p className="text-[9px] text-zinc-400 truncate">{s.email}</p>
                        </div>
                        {canManage && (
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => setEditUser(s)} className="p-1.5 text-zinc-300 hover:text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all"><Edit3 size={12}/></button>
                            <button onClick={() => handleDelete(s)} className="p-1.5 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={12}/></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-in fade-in pb-28">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-16 right-4 z-[3000] px-5 py-3 rounded-2xl shadow-2xl font-black text-[10px] uppercase tracking-widest border-l-4 animate-in slide-in-from-right duration-200
          ${toastType === 'error' ? 'bg-rose-600 text-white border-white' : 'bg-zinc-900 text-white border-emerald-400'}`}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-6 gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Team</h2>
          <p className="text-sm text-zinc-400 font-medium mt-0.5">
            {isSA
              ? `${owners.length} owner${owners.length !== 1 ? 's' : ''} · ${allStaff.length} staff · ${admins.length} admin${admins.length !== 1 ? 's' : ''}`
              : `${getOwnerStaff(userProfile.id).length} staff member${getOwnerStaff(userProfile.id).length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
        {canManage && (
          <button onClick={() => { setFormOpen(true); setErr(''); setTempCred(null); }}
            className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 active:scale-95 transition-all shadow-lg flex-shrink-0">
            <UserPlus size={14}/> Add Member
          </button>
        )}
      </div>

      {/* Access level reference */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-4 mb-5 shadow-sm">
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-3">Access Levels</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { role: 'super_admin', perms: 'Full platform · All orgs · Create owners' },
            { role: 'owner',       perms: 'Own properties · Add staff · Approve all actions' },
            { role: 'staff',       perms: 'Check-in · Record payments (pending approval)' },
          ].map(({ role, perms }) => {
            const meta = ROLE_META[role];
            return (
              <div key={role} className={`rounded-xl border px-3 py-2.5 ${meta.bg} ${meta.border}`}>
                <p className={`font-black text-[9px] uppercase tracking-widest mb-1 ${meta.text}`}>{meta.label}</p>
                <p className={`text-[9px] opacity-70 ${meta.text}`}>{perms}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Temp credential notice */}
      {tempCred && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex justify-between items-start mb-2">
            <p className="font-black text-sm text-amber-800">✅ Account Created — Share Credentials</p>
            <button onClick={() => setTempCred(null)} className="text-amber-400 hover:text-amber-600 flex-shrink-0"><X size={15}/></button>
          </div>
          <div className="bg-white rounded-xl border border-amber-100 p-3 space-y-1.5">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[9px] font-black text-zinc-400 uppercase">Name · Role</p>
                <p className="text-sm font-black">{tempCred.name} · {ROLE_META[tempCred.role]?.label}</p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black text-zinc-400 uppercase">Email</p>
                <p className="text-xs font-semibold truncate">{tempCred.email}</p>
              </div>
              <button onClick={() => navigator.clipboard.writeText(tempCred.email)}
                className="p-1.5 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-all ml-2 flex-shrink-0"><Copy size={12}/></button>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[9px] font-black text-zinc-400 uppercase">Password</p>
                <p className="text-sm font-black tracking-widest">{tempCred.password}</p>
              </div>
              <button onClick={() => navigator.clipboard.writeText(tempCred.password)}
                className="p-1.5 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-all"><Copy size={12}/></button>
            </div>
          </div>
          <p className="text-[9px] text-amber-600 font-medium mt-2">Ask them to change password after first login.</p>
        </div>
      )}

      {/* User list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-300"><Loader2 size={28} className="animate-spin"/></div>
      ) : (
        <div className="space-y-3">

          {/* Super Admin: Admins block */}
          {isSA && admins.length > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2 px-1">Platform Admins</p>
              <div className="space-y-2">
                {admins.map(u => <UserRow key={u.id} u={u}/>)}
              </div>
            </div>
          )}

          {/* Super Admin: Owners with their staff + properties expandable */}
          {isSA && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2 px-1 mt-4">
                PG Owners ({owners.length})
              </p>
              {owners.length === 0 && (
                <div className="bg-white border border-dashed border-zinc-200 rounded-2xl p-8 text-center text-zinc-300">
                  <Users size={28} className="mx-auto mb-2"/><p className="text-sm font-bold">No owners yet</p>
                </div>
              )}
              <div className="space-y-2">
                {owners.map(owner => (
                  <UserRow key={owner.id} u={owner} showProps={true}/>
                ))}
              </div>
            </div>
          )}

          {/* Super Admin: Orphan staff (no owner assigned) */}
          {isSA && orphanStaff.length > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-400 mb-2 px-1 mt-4">Unassigned Staff ({orphanStaff.length})</p>
              <div className="space-y-2">
                {orphanStaff.map(u => <UserRow key={u.id} u={u}/>)}
              </div>
            </div>
          )}

          {/* Owner: Shows self + their staff */}
          {isOwner && (
            <div>
              <div className="space-y-2">
                {/* Owner themselves */}
                <UserRow key={userProfile.id} u={users.find(u => u.id === userProfile.id) || userProfile}/>

                {/* Staff under this owner */}
                {getOwnerStaff(userProfile.id).length > 0 && (
                  <>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mt-4 mb-2 px-1">
                      Your Staff ({getOwnerStaff(userProfile.id).length})
                    </p>
                    {getOwnerStaff(userProfile.id).map(s => (
                      <UserRow key={s.id} u={s} indent={true}/>
                    ))}
                  </>
                )}

                {getOwnerStaff(userProfile.id).length === 0 && (
                  <div className="bg-white border border-dashed border-zinc-200 rounded-2xl p-8 text-center text-zinc-300">
                    <UserPlus size={28} className="mx-auto mb-2"/>
                    <p className="text-sm font-bold">No staff yet</p>
                    <p className="text-xs mt-1">Add staff members to help manage your properties</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add Member Modal ─────────────────────────────────────────────── */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1500] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-zinc-100 sticky top-0 bg-white z-10">
              <h3 className="text-base font-black">Add Team Member</h3>
              <button onClick={() => setFormOpen(false)} className="p-2 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-all"><X size={17}/></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-3">
              <input name="name" required className={INP} placeholder="Full Name *"/>
              <input name="email" type="email" required className={INP} placeholder="Email / Login ID *"/>
              <input name="password" type="password" required minLength={6} className={INP} placeholder="Temporary Password (min 6) *"/>

              <div>
                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1 block">Role</label>
                <select name="role" className={INP}>
                  {isSA && <option value="owner">Owner (Property Manager)</option>}
                  <option value="staff">Staff (Building Operator)</option>
                </select>
              </div>

              {/* If SA, show brand field */}
              {isSA && (
                <input name="brand" className={INP} placeholder="Brand / PG Name" defaultValue={userProfile.brand_name || ''}/>
              )}

              {/* If SA creating staff, let them pick which owner to assign to */}
              {isSA && owners.length > 0 && (
                <div>
                  <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1 block">Assign Staff To Owner</label>
                  <select name="assign_to" className={INP}>
                    <option value="">No owner (unassigned)</option>
                    {owners.map(o => <option key={o.id} value={o.id}>{o.full_name} ({o.brand_name})</option>)}
                  </select>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle size={12} className="text-amber-500 mt-0.5 flex-shrink-0"/>
                <p className="text-[9px] text-amber-700 font-medium leading-relaxed">
                  Account creation may briefly swap your session. Your session will be automatically restored.
                </p>
              </div>

              {err && <p className="text-rose-500 text-xs font-semibold">{err}</p>}

              <button type="submit" disabled={submitting}
                className="w-full bg-zinc-900 text-white py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting && <Loader2 size={14} className="animate-spin"/>}
                Activate Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Member Modal ─────────────────────────────────────────────── */}
      {editUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1500] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-zinc-100">
              <h3 className="text-base font-black">Edit Member</h3>
              <button onClick={() => setEditUser(null)} className="p-2 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-all"><X size={17}/></button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 space-y-3">
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1 block">Full Name</label>
                <input name="u_name" required className={INP} defaultValue={editUser.full_name}/>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1 block">Brand / PG Name</label>
                <input name="u_brand" className={INP} defaultValue={editUser.brand_name || ''}/>
              </div>
              {isSA && (
                <div>
                  <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1 block">Role</label>
                  <select name="u_role" className={INP} defaultValue={editUser.role}>
                    <option value="super_admin">Super Admin</option>
                    <option value="owner">Owner</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
              )}
              {!isSA && <input name="u_role" type="hidden" value={editUser.role}/>}
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3">
                <p className="text-[9px] font-bold text-zinc-400 uppercase">Email (cannot change)</p>
                <p className="text-sm font-semibold text-zinc-600 mt-0.5">{editUser.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onClick={() => setEditUser(null)}
                  className="py-3.5 bg-zinc-100 rounded-2xl font-black text-[10px] uppercase hover:bg-zinc-200 active:scale-95 transition-all">Cancel</button>
                <button type="submit"
                  className="py-3.5 bg-zinc-900 text-white rounded-2xl font-black text-[10px] uppercase hover:bg-indigo-600 active:scale-95 transition-all shadow-lg">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}