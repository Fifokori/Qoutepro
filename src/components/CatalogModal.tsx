import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  Plus, 
  Trash2, 
  Package, 
  Wrench, 
  Truck, 
  MoreHorizontal,
  Check,
  Tag,
  LayoutGrid
} from 'lucide-react';
import { CatalogItem, CatalogCategory } from '../types';
import { saveCatalogItem, deleteCatalogItem, subscribeToCatalog } from '../lib/firebase';

interface CatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSelect?: (item: CatalogItem) => void;
  mode?: 'manage' | 'select';
}

const CATEGORIES: CatalogCategory[] = ['Materiál', 'Práca', 'Doprava', 'Iné'];

export default function CatalogModal({ isOpen, onClose, userId, onSelect, mode = 'manage' }: CatalogModalProps) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CatalogCategory | 'All'>('All');
  const [isAddingNew, setIsAddingNew] = useState(false);
  
  // New Item State
  const [newItem, setNewItem] = useState<Partial<CatalogItem>>({
    name: '',
    mj: 'hod',
    defaultPrice: 0,
    category: 'Materiál'
  });

  useEffect(() => {
    if (isOpen && userId) {
      return subscribeToCatalog(userId, setItems);
    }
  }, [isOpen, userId]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name || !newItem.mj || newItem.defaultPrice === undefined) return;
    
    const item: CatalogItem = {
      id: crypto.randomUUID(),
      name: newItem.name,
      mj: newItem.mj,
      defaultPrice: newItem.defaultPrice,
      category: newItem.category as CatalogCategory,
      updatedAt: new Date().toISOString()
    };
    
    await saveCatalogItem(userId, item);
    setIsAddingNew(false);
    setNewItem({ name: '', mj: 'hod', defaultPrice: 0, category: 'Materiál' });
  };

  const handleDelete = async (itemId: string) => {
    if (window.confirm('Naozaj chcete zmazať túto položku z katalógu?')) {
      await deleteCatalogItem(userId, itemId);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryIcon = (category: CatalogCategory) => {
    switch (category) {
      case 'Materiál': return <Package size={14} />;
      case 'Práca': return <Wrench size={14} />;
      case 'Doprava': return <Truck size={14} />;
      default: return <Tag size={14} />;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-primary/60 backdrop-blur-sm"
        />
        
        {/* Modal Content */}
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
                <LayoutGrid size={24} className="text-accent" />
                {mode === 'select' ? 'VYBRAŤ Z KATALÓGU' : 'KATALÓG POLOŽIEK'}
              </h2>
              <p className="text-xs text-slate-300 font-medium uppercase tracking-widest mt-1">
                {mode === 'select' ? 'Kliknutím na položku ju pridáte do ponuky' : 'Spravujte svoju databázu materiálov a práce'}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-6">
            {/* Filters & Actions */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text"
                  placeholder="Hľadať položku..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-accent/20 rounded-xl py-3 pl-10 pr-4 text-sm font-bold text-slate-700 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-colors"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2 text-xs font-black uppercase tracking-widest">
                <button 
                  onClick={() => setSelectedCategory('All')}
                  className={`px-4 rounded-xl border transition-all ${selectedCategory === 'All' ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 hover:border-slate-200'}`}
                >
                  Všetko
                </button>
                {CATEGORIES.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-3 rounded-xl border transition-all ${selectedCategory === cat ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 hover:border-slate-200'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {mode === 'manage' && (
                <button 
                  onClick={() => setIsAddingNew(!isAddingNew)}
                  className="bg-primary text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20"
                >
                  <Plus size={16} />
                  Nová položka
                </button>
              )}
            </div>

            {/* Add New Form (Manage Mode) */}
            <AnimatePresence>
              {isAddingNew && mode === 'manage' && (
                <motion.form 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onSubmit={handleAddItem}
                  className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-4 overflow-hidden mb-6 transition-colors"
                >
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest px-1">Názov Položky</label>
                    <input 
                      required
                      type="text"
                      className="w-full theme-input"
                      value={newItem.name}
                      onChange={e => setNewItem({...newItem, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest px-1">MJ</label>
                    <input 
                      required
                      type="text"
                      className="w-full theme-input"
                      value={newItem.mj}
                      onChange={e => setNewItem({...newItem, mj: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest px-1">Jedn. Cena (€)</label>
                    <input 
                      required
                      type="number"
                      step="0.01"
                      className="w-full theme-input"
                      value={newItem.defaultPrice}
                      onChange={e => setNewItem({...newItem, defaultPrice: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest px-1">Kategória</label>
                    <select 
                      className="w-full theme-input"
                      value={newItem.category}
                      onChange={e => setNewItem({...newItem, category: e.target.value as CatalogCategory})}
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-4 flex justify-end gap-3 mt-2">
                    <button 
                      type="button"
                      onClick={() => setIsAddingNew(false)}
                      className="px-6 py-2 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                    >
                      Zrušiť
                    </button>
                    <button 
                      type="submit"
                      className="bg-accent text-white px-8 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:brightness-110 shadow-lg shadow-accent/20"
                    >
                      Uložiť do katalógu
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Catalog List */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence initial={false}>
                  {filteredItems.map(item => (
                    <motion.div 
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => mode === 'select' && onSelect?.(item)}
                      className={`
                        group relative p-4 rounded-2xl border transition-all flex items-center justify-between
                        ${mode === 'select' ? 'cursor-pointer hover:border-accent hover:bg-accent/5 dark:hover:bg-accent/10 hover:translate-x-1' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'}
                      `}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`
                          w-12 h-12 rounded-xl flex items-center justify-center transition-colors
                          ${item.category === 'Materiál' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-500' : ''}
                          ${item.category === 'Práca' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500' : ''}
                          ${item.category === 'Doprava' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-500' : ''}
                          ${item.category === 'Iné' ? 'bg-slate-50 dark:bg-slate-700 text-slate-500' : ''}
                        `}>
                          {getCategoryIcon(item.category)}
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight leading-tight">{item.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[0.6rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{item.category}</span>
                            <span className="text-[0.6rem] font-bold text-slate-300 dark:text-slate-600 tracking-widest">•</span>
                            <span className="text-[0.6rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{item.mj}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-sm font-black text-primary dark:text-accent transition-colors">{item.defaultPrice.toLocaleString('sk-SK', { minimumFractionDigits: 2 })} €</div>
                        {mode === 'manage' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                            className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {filteredItems.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-400">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-200 dark:text-slate-700 mx-auto mb-4 transition-colors">
                      <Search size={32} />
                    </div>
                    <p className="font-bold text-sm">Žiadne položky v katalógu</p>
                    <p className="text-xs mt-1 text-slate-300 dark:text-slate-600">Skúste zmeniť kategóriu alebo hľadaný výraz.</p>
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
