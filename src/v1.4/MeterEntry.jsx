import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { X, Zap, ChevronRight, Save } from 'lucide-react';

export default function MeterEntry({ onClose }) {
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [readings, setReadings] = useState({ prev: 0, current: '' });

  useEffect(() => {
    fetchTenants();
  }, []);

  async function fetchTenants() {
    // Fetch active tenants and their last recorded reading from ledger
    const { data } = await supabase
      .from('tenants')
      .select(`
        id, 
        full_name,
        ledger (current_reading)
      `)
      .eq('is_active', true);
    
    setTenants(data || []);
  }

  const handleSave = async () => {
    const units = parseFloat(readings.current) - readings.prev;
    const amount = units * 10; // Your rate of ₹10 per unit

    const { error } = await supabase.from('ledger').insert([{
      tenant_id: selectedTenant.id,
      prev_reading: readings.prev,
      current_reading: parseFloat(readings.current),
      elec_bill: amount,
      is_verified: false // Staff enters, you verify later
    }]);

    if (!error) {
      alert(`Bill Generated: ₹${amount}`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-[3rem] md:rounded-[3rem] shadow-2xl h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0">
          <h3 className="text-2xl font-black text-[#5f259f]">Meter Entry</h3>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 no-scrollbar">
          {!selectedTenant ? (
            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Select Tenant</p>
              {tenants.map(t => (
                <button 
                  key={t.id}
                  onClick={() => {
                    setSelectedTenant(t);
                    setReadings({ prev: t.ledger?.[0]?.current_reading || 0, current: '' });
                  }}
                  className="w-full bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center hover:border-[#5f259f] transition-all"
                >
                  <span className="font-bold text-slate-700">{t.full_name}</span>
                  <ChevronRight size={18} className="text-[#5f259f]" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-right duration-300">
              <div className="bg-[#f2ecf9] p-6 rounded-3xl border border-[#5f259f]/10">
                <p className="text-[10px] font-black text-[#5f259f] uppercase mb-1">Tenant</p>
                <h4 className="text-xl font-black">{selectedTenant.full_name}</h4>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Previous</p>
                  <p className="text-2xl font-black text-slate-600">{readings.prev}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border-2 border-[#5f259f] shadow-lg shadow-purple-50">
                  <p className="text-[10px] font-black text-[#5f259f] uppercase mb-1">Current</p>
                  <input 
                    type="number"
                    autoFocus
                    className="w-full bg-transparent text-2xl font-black outline-none text-[#5f259f]"
                    value={readings.current}
                    onChange={(e) => setReadings({...readings, current: e.target.value})}
                    placeholder="000"
                  />
                </div>
              </div>

              {readings.current && (
                <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Estimated Bill</p>
                    <h4 className="text-2xl font-black text-emerald-700 italic">
                      ₹{( (parseFloat(readings.current) - readings.prev) * 10 ).toLocaleString()}
                    </h4>
                  </div>
                  <Zap size={32} className="text-emerald-500 opacity-30" />
                </div>
              )}

              <button 
                onClick={handleSave}
                className="w-full bg-[#5f259f] text-white py-6 rounded-[2rem] font-black text-sm shadow-xl shadow-purple-200 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest"
              >
                Save Reading
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}