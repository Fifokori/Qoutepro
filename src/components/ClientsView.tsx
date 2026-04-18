import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  User, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  ExternalLink 
} from 'lucide-react';
import { Client } from '../types';
import { subscribeToClients, deleteClient } from '../lib/firebase';
import ClientModal from './ClientModal';

interface ClientsViewProps {
  userId: string;
}

export default function ClientsView({ userId }: ClientsViewProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>(undefined);

  useEffect(() => {
    return subscribeToClients(userId, setClients);
  }, [userId]);

  const handleDelete = async (clientId: string) => {
    if (window.confirm('Naozaj chcete zmazať tohto klienta?')) {
      await deleteClient(userId, clientId);
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.company?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-primary dark:text-slate-100 tracking-tighter">ADRESÁR KLIENTOV</h2>
          <p className="text-sm text-text-muted dark:text-slate-400 font-medium uppercase tracking-[0.2em] mt-1">Správa vašich obchodných kontaktov</p>
        </div>
        <button 
          onClick={() => { setEditingClient(undefined); setIsModalOpen(true); }}
          className="bg-accent text-white px-6 py-3 rounded-2xl flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all font-black text-sm uppercase tracking-widest shadow-xl shadow-accent/30"
        >
          <Plus size={18} />
          Pridať klienta
        </button>
      </div>

      <div className="theme-card overflow-hidden transition-colors">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row gap-4 justify-between items-center transition-colors">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Vyhľadať v adresári..."
              className="w-full bg-white dark:bg-slate-900 border-none focus:ring-2 focus:ring-accent/20 rounded-xl py-3 pl-10 pr-4 text-sm font-bold text-slate-700 dark:text-slate-100 shadow-sm transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest bg-white dark:bg-slate-900 px-4 py-2 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
            Počet klientov: <span className="text-primary dark:text-accent font-black ml-1">{clients.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-700 transition-colors">
                <th className="px-6 py-4 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Klient / Firma</th>
                <th className="px-6 py-4 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">Kontakt</th>
                <th className="px-6 py-4 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest hidden lg:table-cell">IČO / Adresa</th>
                <th className="px-6 py-4 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest text-right">Akcie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800 transition-colors">
              {filteredClients.map(client => (
                <tr key={client.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/5 dark:bg-slate-700 text-primary dark:text-accent flex items-center justify-center font-black text-lg transition-colors">
                        {client.name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-800 dark:text-slate-100 leading-tight">{client.name}</div>
                        {client.company && (
                          <div className="text-[0.65rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">{client.company}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 hidden md:table-cell">
                    <div className="space-y-1">
                      {client.email && (
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                          <Mail size={12} className="text-slate-300 dark:text-slate-600" />
                          {client.email}
                        </div>
                      )}
                      {client.phone && (
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                          <Phone size={12} className="text-slate-300 dark:text-slate-600" />
                          {client.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 hidden lg:table-cell">
                    <div className="space-y-1">
                      {client.ico && (
                        <div className="text-[0.65rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">IČO: {client.ico}</div>
                      )}
                      {client.address && (
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                          <MapPin size={12} className="text-slate-300 dark:text-slate-600" />
                          {client.address}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end gap-1 opacity-10 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                         onClick={() => { setEditingClient(client); setIsModalOpen(true); }}
                         className="p-2 text-slate-400 hover:text-accent hover:bg-accent/5 dark:hover:bg-accent/10 rounded-xl transition-all"
                         title="Upraviť"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                         onClick={() => handleDelete(client.id)}
                         className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all"
                         title="Zmazať"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredClients.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-3xl flex items-center justify-center text-slate-200 dark:text-slate-700 mx-auto mb-4 transition-colors">
              <User size={32} />
            </div>
            <p className="font-black text-slate-400 dark:text-slate-500 text-sm uppercase tracking-widest">Žiadni klienti nenájdení</p>
            <p className="text-xs text-slate-300 dark:text-slate-600 mt-2">Upravte filtre alebo pridajte nového klienta do adresára.</p>
          </div>
        )}
      </div>

      <ClientModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userId={userId}
        mode="manage"
        initialData={editingClient}
      />
    </div>
  );
}
