import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  Plus, 
  Trash2, 
  User, 
  Mail, 
  Phone, 
  Building2, 
  MapPin, 
  Fingerprint,
  Edit2
} from 'lucide-react';
import { Client } from '../types';
import { saveClient, deleteClient, subscribeToClients } from '../lib/firebase';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSelect?: (client: Client) => void;
  mode?: 'manage' | 'select';
  initialData?: Client;
}

export default function ClientModal({ isOpen, onClose, userId, onSelect, mode = 'manage', initialData }: ClientModalProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);

  useEffect(() => {
    if (isOpen && initialData) {
      setEditingClient(initialData);
    } else if (isOpen && mode === 'manage' && !initialData) {
      // Don't auto-open form unless specifically editing or specifically asked
    }
  }, [isOpen, initialData, mode]);

  useEffect(() => {
    if (isOpen && userId) {
      return subscribeToClients(userId, setClients);
    }
  }, [isOpen, userId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient?.name) return;
    
    const client: Client = {
      id: editingClient.id || crypto.randomUUID(),
      name: editingClient.name,
      company: editingClient.company || '',
      email: editingClient.email || '',
      phone: editingClient.phone || '',
      address: editingClient.address || '',
      ico: editingClient.ico || '',
      updatedAt: new Date().toISOString()
    };
    
    await saveClient(userId, client);
    setEditingClient(null);
  };

  const handleDelete = async (clientId: string) => {
    if (window.confirm('Naozaj chcete zmazať tohto klienta z adresára?')) {
      await deleteClient(userId, clientId);
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-primary/60 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col transition-colors"
        >
          {/* Header */}
          <div className="bg-primary p-6 text-white flex justify-between items-center border-b border-white/10">
            <div>
              <h2 className="text-xl font-black tracking-tight flex items-center gap-3">
                <User size={24} className="text-accent" />
                {mode === 'select' ? 'VYBRAŤ KLIENTA' : 'ADRESÁR KLIENTOV'}
              </h2>
              <p className="text-xs text-slate-300 font-medium uppercase tracking-widest mt-1">
                {mode === 'select' ? 'Kliknutím na klienta ho pridáte do ponuky' : 'Spravujte databázu svojich obchodných partnerov'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-6">
            {/* Top Bar */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text"
                  placeholder="Hľadať podľa mena, firmy alebo emailu..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-accent/20 rounded-xl py-3 pl-10 pr-4 text-sm font-bold text-slate-700 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-colors"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              
              {mode === 'manage' && (
                <button 
                  onClick={() => setEditingClient({ name: '', company: '', email: '', phone: '', address: '', ico: '' })}
                  className="bg-primary text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20"
                >
                  <Plus size={16} />
                  Nový klient
                </button>
              )}
            </div>

            {/* Edit Form */}
            <AnimatePresence>
              {editingClient && (
                <motion.form 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onSubmit={handleSave}
                  className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden mb-6 transition-colors"
                >
                  <div className="space-y-1">
                    <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest px-1">Meno a Priezvisko *</label>
                    <input 
                      required
                      type="text"
                      className="theme-input w-full"
                      value={editingClient.name}
                      onChange={e => setEditingClient({...editingClient, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest px-1">Firma / Spoločnosť</label>
                    <input 
                      type="text"
                      className="theme-input w-full"
                      value={editingClient.company}
                      onChange={e => setEditingClient({...editingClient, company: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest px-1">Email</label>
                    <input 
                      type="email"
                      className="theme-input w-full"
                      value={editingClient.email}
                      onChange={e => setEditingClient({...editingClient, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest px-1">Telefón</label>
                    <input 
                      type="text"
                      className="theme-input w-full"
                      value={editingClient.phone}
                      onChange={e => setEditingClient({...editingClient, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest px-1">IČO</label>
                    <input 
                      type="text"
                      className="theme-input w-full"
                      value={editingClient.ico}
                      onChange={e => setEditingClient({...editingClient, ico: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest px-1">Adresa</label>
                    <input 
                      type="text"
                      className="theme-input w-full"
                      value={editingClient.address}
                      onChange={e => setEditingClient({...editingClient, address: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                    <button 
                      type="button"
                      onClick={() => setEditingClient(null)}
                      className="px-6 py-2 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                    >
                      Zrušiť
                    </button>
                    <button 
                      type="submit"
                      className="bg-accent text-white px-8 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 shadow-lg shadow-accent/20"
                    >
                      Uložiť do adresára
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Client List */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence initial={false}>
                  {filteredClients.map(client => (
                    <motion.div 
                      key={client.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => mode === 'select' && onSelect?.(client)}
                      className={`
                        group relative p-5 rounded-3xl border transition-all
                        ${mode === 'select' ? 'cursor-pointer hover:border-accent hover:bg-accent/5 dark:hover:bg-accent/10' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500 hover:shadow-md'}
                      `}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-primary dark:text-accent font-black text-xl transition-colors">
                          {client.name[0]}
                        </div>
                        {mode === 'manage' && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditingClient(client); }}
                              className="p-2 text-slate-400 hover:text-accent hover:bg-accent/5 rounded-xl transition-all"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDelete(client.id); }}
                              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <h3 className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight leading-tight">{client.name}</h3>
                          {client.company && (
                            <div className="flex items-center gap-2 mt-1 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest">
                              <Building2 size={12} className="text-slate-300 dark:text-slate-600" />
                              {client.company}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-50 dark:border-slate-700 transition-colors">
                          {client.email && (
                            <div className="flex items-center gap-2 text-[0.65rem] font-bold text-slate-400 truncate">
                              <Mail size={12} className="text-slate-300 shrink-0" />
                              <span className="truncate">{client.email}</span>
                            </div>
                          )}
                          {client.phone && (
                            <div className="flex items-center gap-2 text-[0.65rem] font-bold text-slate-400">
                              <Phone size={12} className="text-slate-300 shrink-0" />
                              {client.phone}
                            </div>
                          )}
                          {client.ico && (
                            <div className="flex items-center gap-2 text-[0.65rem] font-bold text-slate-400">
                              <Fingerprint size={12} className="text-slate-300 shrink-0" />
                              IČO: {client.ico}
                            </div>
                          )}
                          {client.address && (
                            <div className="flex items-center gap-2 text-[0.65rem] font-bold text-slate-400 truncate">
                              <MapPin size={12} className="text-slate-300 shrink-0" />
                              <span className="truncate">{client.address}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {filteredClients.length === 0 && (
                  <div className="col-span-full py-16 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 mx-auto mb-4">
                      <User size={32} />
                    </div>
                    <p className="font-black text-slate-400 text-sm uppercase tracking-widest">Adresár je prázdny</p>
                    <p className="text-xs text-slate-300 mt-2">Pridajte svojho prvého klienta pre rýchlejšie vystavovanie ponúk.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
