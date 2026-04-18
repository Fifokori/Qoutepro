/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Download, 
  Image as ImageIcon, 
  FileText, 
  User, 
  Calendar, 
  Hash,
  X,
  History,
  Check,
  Clock,
  ExternalLink,
  Copy,
  LogOut,
  LogIn,
  Loader2,
  ShieldCheck,
  Settings,
  LayoutDashboard,
  ChevronDown,
  LayoutGrid,
  Search,
  ArrowUpDown,
  FileEdit,
  Send,
  CheckCircle,
  XCircle,
  MoreVertical,
  Eye,
  PieChart,
  Euro,
  FileDown,
  Users,
  Building,
  Sun,
  Moon,
  Palette,
  ArrowUp
} from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  auth, 
  loginWithGoogle, 
  logout, 
  db,
  subscribeToQuotes,
  saveQuote,
  deleteQuote
} from './lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query 
} from 'firebase/firestore';
import { QuoteItem, QuoteData, ExportSettings, ColumnConfig, QuoteStatus } from './types';
import { exportToExcel } from './lib/excelExport';
import { exportToPDF } from './lib/pdfExport';
import CatalogModal from './components/CatalogModal';
import ClientModal from './components/ClientModal';
import ClientsView from './components/ClientsView';
import { CatalogItem, Client } from './types';
import { saveClient, subscribeToClients } from './lib/firebase';

const INITIAL_ITEM: QuoteItem = {
  id: crypto.randomUUID(),
  description: '',
  unit: 'hod',
  quantity: 1,
  unitPrice: 0,
};

const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  columns: [
    { key: 'description', label: 'Popis položky', width: 50, visible: true, order: 0 },
    { key: 'unit', label: 'MJ', width: 10, visible: true, order: 1 },
    { key: 'quantity', label: 'Mn.', width: 12, visible: true, order: 2 },
    { key: 'unitPrice', label: 'J. cena', width: 15, visible: true, order: 3 },
    { key: 'total', label: 'Spolu', width: 15, visible: true, order: 4 },
  ],
  primaryColor: '1E293B',
  accentColor: '2563EB',
  headerFontSize: 20,
  includeVAT: true,
  vatRate: 20
};

const DEFAULT_QUOTE = (userId: string): QuoteData => ({
  id: crypto.randomUUID(),
  companyName: '',
  clientName: '',
  date: new Date().toISOString().split('T')[0],
  quoteNumber: `CP-${new Date().getFullYear()}-${Math.floor(Math.random() * 900) + 100}`,
  items: [{ ...INITIAL_ITEM, id: crypto.randomUUID() }],
  logo: undefined,
  paymentTerms: `1. Splatnosť faktúry je 14 dní od dátumu vystavenia, pokiaľ nie je dohodnuté inak.\n2. Tovar zostáva majetkom dodávateľa až do úplného zaplatenia.\n3. Cenová ponuka je platná 30 dní od dátumu vystavenia.\n4. V prípade akýchkoľvek otázok nás neváhajte kontaktovať.\n\nĎakujeme za prejavenú dôveru a tešíme sa na spoluprácu!`,
  status: 'Koncept',
  exportSettings: DEFAULT_EXPORT_SETTINGS
});

export default function App() {
  const [user, loading, error] = useAuthState(auth);
  const [view, setView] = useState<'dashboard' | 'editor' | 'clients'>('dashboard');
  const [quotes, setQuotes] = useState<QuoteData[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [data, setData] = useState<QuoteData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof QuoteData>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogMode, setCatalogMode] = useState<'manage' | 'select'>('manage');
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientModalMode, setClientModalMode] = useState<'manage' | 'select'>('select');
  const [showSaveClientPrompt, setShowSaveClientPrompt] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('quotepro-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [accent, setAccent] = useState(() => {
    return localStorage.getItem('quotepro-accent') || '#2563eb';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('quotepro-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent);
    localStorage.setItem('quotepro-accent', accent);
  }, [accent]);

  const [total, setTotal] = useState(0);
  const [commonItems, setCommonItems] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<string | null>(null);
  const [history, setHistory] = useState<QuoteData[]>([]);
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');

  const isAdmin = user?.email === 'korsnakf@gmail.com';

  // Listen to allowed emails if admin
  useEffect(() => {
    if (isAdmin) {
      const q = query(collection(db, 'allowed_emails'));
      return onSnapshot(q, (snapshot) => {
        setAllowedEmails(snapshot.docs.map(doc => doc.id));
      });
    }
  }, [isAdmin]);

  // Listen to clients
  useEffect(() => {
    if (user) {
      return subscribeToClients(user.uid, setClients);
    }
  }, [user]);

  const addAllowedEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) return;
    try {
      await setDoc(doc(db, 'allowed_emails', newEmail.toLowerCase()), {
        email: newEmail.toLowerCase(),
        addedBy: user?.email,
        createdAt: new Date().toISOString()
      });
      setNewEmail('');
    } catch (e) {
      console.error("Failed to add email:", e);
      alert("Chyba pri pridávaní emailu. Skontrolujte oprávnenia.");
    }
  };

  const removeAllowedEmail = async (email: string) => {
    try {
      await deleteDoc(doc(db, 'allowed_emails', email));
    } catch (e) {
      console.error("Failed to remove email:", e);
    }
  };

  // Load history and common items from localStorage
  useEffect(() => {
    const savedItems = localStorage.getItem('quote_pro_common_items');
    if (savedItems) {
      try {
        setCommonItems(JSON.parse(savedItems));
      } catch (e) {
        console.error('Failed to parse common items', e);
      }
    }

    const savedHistory = localStorage.getItem('quote_pro_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  const saveToHistory = (quote: QuoteData) => {
    const newHistory = [quote, ...history.filter(h => h.quoteNumber !== quote.quoteNumber)].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('quote_pro_history', JSON.stringify(newHistory));
  };

  // Save new items to common items on export
  const saveToCommonItems = (items: QuoteItem[]) => {
    const descriptions = items
      .map(item => item.description.replace(/<[^>]*>?/gm, '').trim()) // Extract plain text for indexing
      .filter(desc => desc.length > 3);
    
    const originalHtmlMap = new Map();
    items.forEach(item => {
      const plainText = item.description.replace(/<[^>]*>?/gm, '').trim();
      if (plainText.length > 3) originalHtmlMap.set(plainText, item.description);
    });

    const newCommon = Array.from(new Set([...commonItems, ...Array.from(originalHtmlMap.values())])).slice(0, 50);
    setCommonItems(newCommon);
    localStorage.setItem('quote_pro_common_items', JSON.stringify(newCommon));
  };

  // Listen to quotes if user is logged in
  useEffect(() => {
    if (user) {
      return subscribeToQuotes(user.uid, (fetchedQuotes) => {
        setQuotes(fetchedQuotes);
      });
    }
  }, [user]);

  const createNewQuote = () => {
    if (user) {
      const newQuote = DEFAULT_QUOTE(user.uid);
      setData(newQuote);
      setView('editor');
    }
  };

  const openQuote = (quote: QuoteData) => {
    setData(quote);
    setView('editor');
  };

  const duplicateQuote = async (quote: QuoteData) => {
    if (user) {
      const duplicated: QuoteData = {
        ...quote,
        id: crypto.randomUUID(),
        quoteNumber: `${quote.quoteNumber}-KOPIA`,
        date: new Date().toISOString().split('T')[0],
        status: 'Koncept',
        updatedAt: new Date().toISOString()
      };
      await saveQuote(user.uid, duplicated);
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    if (user && window.confirm('Naozaj chcete zmazať túto cenovú ponuku?')) {
      await deleteQuote(user.uid, quoteId);
    }
  };

  const handleSaveAndExit = async () => {
    if (user && data) {
      await saveQuote(user.uid, data);
      setView('dashboard');
    }
  };

  const updateStatus = async (quoteId: string, status: QuoteStatus) => {
    if (user) {
      const quote = quotes.find(q => q.id === quoteId);
      if (quote) {
        await saveQuote(user.uid, { ...quote, status });
      }
    }
  };

  const calculateQuoteTotal = (quote: QuoteData) => {
    const subtotal = quote.items.reduce((acc, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      return acc + (qty * price);
    }, 0);
    if (!quote.exportSettings?.includeVAT) return subtotal;
    const vatRate = Number(quote.exportSettings.vatRate) || 0;
    return subtotal * (1 + (vatRate / 100));
  };

  const filteredQuotes = (quotes || [])
    .filter(q => 
      q.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      q.quoteNumber.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const fieldA = a[sortField];
      const fieldB = b[sortField];
      if (typeof fieldA === 'string' && typeof fieldB === 'string') {
        return sortOrder === 'asc' ? fieldA.localeCompare(fieldB) : fieldB.localeCompare(fieldA);
      }
      return 0;
    });

  const stats = {
    total: filteredQuotes.length,
    prijate: filteredQuotes.filter(q => q.status === 'Prijatá').length,
    odoslane: filteredQuotes.filter(q => q.status === 'Odoslaná').length,
    odmietnute: filteredQuotes.filter(q => q.status === 'Odmietnutá').length,
    totalValue: filteredQuotes.reduce((acc, q) => acc + calculateQuoteTotal(q), 0),
  };

  useEffect(() => {
    if (data?.items) {
      setTotal(data.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0));
    }
  }, [data?.items]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setData(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeItem = (id: string) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.filter(item => item.id !== id)
      };
    });
  };

  const updateItem = (id: string, field: keyof QuoteItem, value: any) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(item => 
          item.id === id ? { ...item, [field]: value } : item
        )
      };
    });
  };

  const addItem = () => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: [...prev.items, { ...INITIAL_ITEM, id: crypto.randomUUID() }]
      };
    });
  };

  const removeLogo = () => {
    setData(prev => {
      if (!prev) return prev;
      return { ...prev, logo: undefined };
    });
  };

  const handleCatalogSelect = (item: CatalogItem) => {
    if (!data) return;
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: [...prev.items, { 
          id: crypto.randomUUID(), 
          description: item.name || '', 
          unit: item.mj || 'hod', 
          quantity: 1, 
          unitPrice: Number(item.defaultPrice) || 0
        }]
      };
    });
    setIsCatalogOpen(false);
  };

  const handleClientSelect = (client: Client) => {
    if (!data) return;
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        clientName: client.name,
        companyName: client.company || prev.companyName
      };
    });
    setIsClientModalOpen(false);
  };

  const handleSaveCurrentClient = async () => {
    if (user && data) {
      const client: Client = {
        id: crypto.randomUUID(),
        name: data.clientName,
        company: data.companyName,
        updatedAt: new Date().toISOString()
      };
      await saveClient(user.uid, client);
      setShowSaveClientPrompt(false);
    }
  };

  const handleExport = async () => {
    if (!data) return;
    saveToCommonItems(data.items);
    saveToHistory(data);
    await exportToExcel(data);
    
    // Check if client already exists
    const exists = clients.some(c => c.name.toLowerCase() === data.clientName.toLowerCase());
    if (!exists && data.clientName) {
      setShowSaveClientPrompt(true);
    }
  };

  const handlePDFExport = async () => {
    if (!data) return;
    saveToCommonItems(data.items);
    saveToHistory(data);
    await exportToPDF(data);

    // Check if client already exists
    const exists = clients.some(c => c.name.toLowerCase() === data.clientName.toLowerCase());
    if (!exists && data.clientName) {
      setShowSaveClientPrompt(true);
    }
  };

  const loadFromHistory = (quote: QuoteData) => {
    setData({
      ...quote,
      // We might want to refresh the date to today when "reusing"
      date: new Date().toISOString().split('T')[0],
      // And maybe generate a new quote number if it's a reuse case
      // But for "viewing" we keep it. Let's just load it as is for now.
    });
  };

  const removeFromHistory = (quoteNumber: string) => {
    const newHistory = history.filter(h => h.quoteNumber !== quoteNumber);
    setHistory(newHistory);
    localStorage.setItem('quote_pro_history', JSON.stringify(newHistory));
  };

  const updateExportSetting = (field: keyof ExportSettings, value: any) => {
    setData(prev => ({
      ...prev,
      exportSettings: {
        ...prev.exportSettings!,
        [field]: value
      }
    }));
  };

  const updateColumnConfig = (key: string, field: keyof ColumnConfig, value: any) => {
    setData(prev => ({
      ...prev,
      exportSettings: {
        ...prev.exportSettings!,
        columns: prev.exportSettings!.columns.map(col => 
          col.key === key ? { ...col, [field]: value } : col
        )
      }
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={40} className="text-accent animate-spin" />
          <p className="text-sm font-black text-primary tracking-widest animate-pulse">NAČÍTAVAM SYSTÉM...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f1f5f9] p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full theme-card overflow-hidden shadow-2xl"
        >
          <div className="bg-primary p-8 text-center text-white relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-accent"></div>
            <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center font-black text-white text-3xl mx-auto mb-6 shadow-xl shadow-accent/20">Q</div>
            <h1 className="text-3xl font-black tracking-tighter mb-2">QUOTEPRO</h1>
            <p className="text-xs text-slate-300 font-medium uppercase tracking-[0.2em]">Profesionálny systém cenových ponúk</p>
          </div>
          
          <div className="p-8 space-y-8 bg-white text-center">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-800">Vitajte späť!</h2>
              <p className="text-sm text-text-muted">Pre pokračovanie a prístup k vašim ponukám sa prosím prihláste.</p>
            </div>

            <button
              onClick={loginWithGoogle}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 py-4 px-6 rounded-xl font-bold text-slate-700 hover:border-accent hover:bg-accent/5 transition-all shadow-sm group active:scale-[0.98]"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              PRIHLÁSIŤ SA CEZ GOOGLE
            </button>

            <div className="flex items-center gap-2 justify-center text-[0.6rem] text-text-muted font-bold uppercase tracking-widest bg-slate-50 py-3 rounded-lg">
              <ShieldCheck size={14} className="text-emerald-500" />
              Zabezpečené cez Firebase Auth
            </div>
          </div>
        </motion.div>
        
        <p className="mt-8 text-[0.65rem] text-text-muted font-bold uppercase tracking-widest opacity-50">
          QuotePro v2.4.0 &bull; Cloud Infrastructure
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg transition-colors duration-500">
      {/* Header - Refined Dark Theme */}
      <header className="bg-primary dark:bg-[#0f1117] text-white py-4 px-8 flex justify-between items-center border-b border-white/5 shadow-2xl z-50 backdrop-blur-xl">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setView('dashboard')}>
            <div className="w-10 h-10 bg-gradient-to-br from-accent to-indigo-600 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-lg shadow-accent/20 group-hover:rotate-12 transition-transform duration-500">Q</div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-black tracking-tighter leading-none bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">QUOTEPRO</h1>
              <span className="text-[0.6rem] font-bold opacity-30 tracking-[0.3em] uppercase mt-1">v2.5 Enterprise</span>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-2 pr-6">
            <button 
              onClick={() => setView('dashboard')}
              className={`nav-link ${view === 'dashboard' ? 'nav-link-active' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full bg-accent absolute -left-1 top-1/2 -translate-y-1/2 transition-opacity ${view === 'dashboard' ? 'opacity-100' : 'opacity-0'}`}></div>
              <PieChart size={14} />
              Prehľad
            </button>
            <button 
              onClick={() => setView('editor')}
              className={`nav-link ${view === 'editor' ? 'nav-link-active' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full bg-accent absolute -left-1 top-1/2 -translate-y-1/2 transition-opacity ${view === 'editor' ? 'opacity-100' : 'opacity-0'}`}></div>
              <FileEdit size={14} />
              Editor
            </button>
            <button 
              onClick={() => setView('clients')}
              className={`nav-link ${view === 'clients' ? 'nav-link-active' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full bg-accent absolute -left-1 top-1/2 -translate-y-1/2 transition-opacity ${view === 'clients' ? 'opacity-100' : 'opacity-0'}`}></div>
              <Users size={14} />
              Klienti
            </button>
          </nav>
        </div>
        
        <div className="flex gap-4 items-center">
          <div className="hidden xl:flex gap-4 items-center border-r border-white/5 pr-6">
            {view === 'dashboard' && (
              <button 
                onClick={createNewQuote}
                className="flex items-center gap-2 bg-accent px-5 py-2.5 rounded-full text-[0.7rem] font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:brightness-110 active:scale-95 transition-all"
              >
                <Plus size={14} />
                Nová Ponuka
              </button>
            )}
            <div className="text-right ml-2">
              <div className="text-[0.65rem] opacity-50 uppercase font-bold tracking-widest">Stav Systému</div>
              <div className="text-[0.65rem] font-black text-emerald-400 flex items-center justify-end gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                ONLINE
              </div>
            </div>
          </div>

          <div className="relative">
            <button 
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              className="p-2 mr-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10 text-white/80 hover:text-white"
              title={theme === 'light' ? 'Zapnúť tmavý režim' : 'Zapnúť svetlý režim'}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            <button 
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all border ${isSettingsOpen ? 'bg-white/10 border-white/20' : 'border-transparent hover:bg-white/5'}`}
            >
              <div className="text-right hidden sm:block">
                <div className="text-[0.65rem] font-black tracking-wider uppercase">{user.displayName}</div>
                <div className="text-[0.55rem] opacity-40 font-bold">{isAdmin ? 'ADMINISTRÁTOR' : 'POUŽÍVATEĽ'}</div>
              </div>
              <div className="relative">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-lg border border-white/20 shadow-sm" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-xs font-black">
                    {user.displayName?.[0]}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <Settings size={8} className="text-primary" />
                </div>
              </div>
              <ChevronDown size={14} className={`opacity-40 transition-transform duration-300 ${isSettingsOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isSettingsOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsSettingsOpen(false)}
                  ></div>
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 py-2"
                  >
                    <div className="px-4 py-3 border-b border-slate-50 dark:border-slate-700 mb-2">
                       <div className="text-[0.6rem] font-black text-text-muted dark:text-slate-400 uppercase tracking-widest mb-1">Prihlásený ako</div>
                       <div className="text-sm font-bold text-primary dark:text-slate-100 truncate">{user.email}</div>
                    </div>

                    <div className="p-2 space-y-1">
                      <button 
                        onClick={() => {
                          setCatalogMode('manage');
                          setIsCatalogOpen(true);
                          setIsSettingsOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left rounded-xl"
                      >
                        <LayoutGrid size={16} className="text-slate-400" />
                        Správa katalógu položiek
                      </button>
                    </div>

                    <div className="px-4 py-3 border-t border-slate-50 dark:border-slate-700">
                      <div className="text-[0.6rem] font-black text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Palette size={12} />
                        Farba akcentu
                      </div>
                      <div className="flex gap-2">
                        {[
                          { name: 'Modrá', value: '#2563eb' },
                          { name: 'Červená', value: '#ef4444' },
                          { name: 'Zelená', value: '#10b981' },
                          { name: 'Fialová', value: '#8b5cf6' },
                          { name: 'Oranžová', value: '#f59e0b' }
                        ].map(color => (
                          <button
                            key={color.value}
                            onClick={() => setAccent(color.value)}
                            className={`w-8 h-8 rounded-full border-2 transition-transform active:scale-90 ${accent === color.value ? 'border-primary ring-2 ring-accent ring-offset-2 scale-110' : 'border-transparent hover:scale-105'}`}
                            style={{ backgroundColor: color.value }}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="px-4 py-4 space-y-4 border-b border-slate-50 mb-2 bg-slate-50/50">
                        <div className="flex items-center gap-2 text-[0.6rem] font-black text-accent uppercase tracking-widest border-b border-accent/10 pb-2">
                          <ShieldCheck size={12} />
                          Pridávanie účtov (Whitelist)
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="email"
                            placeholder="Nový email..."
                            className="flex-1 theme-input text-[0.65rem] py-1.5 bg-white"
                            value={newEmail}
                            onChange={e => setNewEmail(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button 
                            onClick={(e) => { e.stopPropagation(); addAllowedEmail(); }}
                            className="px-3 py-1.5 bg-accent text-white rounded-lg font-black text-[0.6rem] hover:brightness-110 transition-all"
                          >
                            PRIDAŤ
                          </button>
                        </div>
                        <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                          {allowedEmails.map(email => (
                            <div key={email} className="flex items-center justify-between bg-white px-2 py-1.5 rounded-lg border border-slate-100 text-[0.65rem] font-bold text-slate-700">
                              <span className="truncate pr-2">{email}</span>
                              <button 
                                onClick={(e) => { e.stopPropagation(); removeAllowedEmail(email); }}
                                className="text-slate-300 hover:text-red-500 transition-colors p-1"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="px-2">
                      <button 
                        onClick={() => { logout(); setIsSettingsOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all text-xs font-bold group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-50 group-hover:bg-red-100 flex items-center justify-center transition-colors">
                          <LogOut size={16} />
                        </div>
                        Odhlásiť sa zo systému
                      </button>
                    </div>

                    {/* Export Template Customization */}
                    {data && (
                      <div className="px-4 py-4 border-t border-slate-100 bg-slate-50/20">
                        <div className="flex items-center gap-2 text-[0.6rem] font-black text-slate-400 uppercase tracking-widest mb-4">
                          <FileText size={12} />
                          Nastavenia Exportu (Excel)
                        </div>
                        
                        <div className="space-y-4">
                          {/* VAT Toggle */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-600">Zahrnúť DPH</span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); updateExportSetting('includeVAT', !data.exportSettings?.includeVAT); }}
                              className={`w-10 h-5 rounded-full transition-colors relative ${data.exportSettings?.includeVAT ? 'bg-accent' : 'bg-slate-200'}`}
                            >
                              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${data.exportSettings?.includeVAT ? 'left-6' : 'left-1'}`}></div>
                            </button>
                          </div>

                          {data.exportSettings?.includeVAT && (
                            <div className="flex items-center justify-between">
                              <span className="text-[0.65rem] font-bold text-slate-500">Sadzba DPH (%)</span>
                              <input 
                                type="number"
                                className="w-16 theme-input text-[0.65rem] py-1 text-right"
                                value={data.exportSettings.vatRate}
                                onChange={(e) => { e.stopPropagation(); updateExportSetting('vatRate', parseFloat(e.target.value) || 0); }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          )}

                          {/* Colors */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[0.6rem] block font-bold text-slate-500 mb-1">Hlavná farba</span>
                              <div className="flex gap-2 items-center">
                                <input 
                                  type="color"
                                  className="w-6 h-6 rounded border-none p-0 bg-transparent overflow-hidden"
                                  value={'#' + data.exportSettings?.primaryColor}
                                  onChange={(e) => { e.stopPropagation(); updateExportSetting('primaryColor', e.target.value.substring(1).toUpperCase()); }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-[0.65rem] font-mono font-bold text-slate-400">#{data.exportSettings?.primaryColor}</span>
                              </div>
                            </div>
                            <div>
                              <span className="text-[0.6rem] block font-bold text-slate-500 mb-1">Akcent</span>
                              <div className="flex gap-2 items-center">
                                <input 
                                  type="color"
                                  className="w-6 h-6 rounded border-none p-0 bg-transparent overflow-hidden"
                                  value={'#' + data.exportSettings?.accentColor}
                                  onChange={(e) => { e.stopPropagation(); updateExportSetting('accentColor', e.target.value.substring(1).toUpperCase()); }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-[0.65rem] font-mono font-bold text-slate-400">#{data.exportSettings?.accentColor}</span>
                              </div>
                            </div>
                          </div>

                          {/* Columns */}
                          <div className="space-y-2">
                            <span className="text-[0.6rem] block font-bold text-slate-500 uppercase tracking-widest">Stĺpce v tabuľke</span>
                            <div className="space-y-1">
                              {data.exportSettings?.columns.map((col) => (
                                <div key={col.key} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-100 group">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); updateColumnConfig(col.key, 'visible', !col.visible); }}
                                    className={`p-1 rounded transition-colors ${col.visible ? 'text-accent bg-accent/5' : 'text-slate-300'}`}
                                  >
                                    <Check size={12} />
                                  </button>
                                  <input 
                                    type="text"
                                    className="flex-1 bg-transparent border-none text-[0.65rem] font-bold p-0 focus:ring-0"
                                    value={col.label}
                                    onChange={(e) => { e.stopPropagation(); updateColumnConfig(col.key, 'label', e.target.value); }}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder="Názov stĺpca"
                                  />
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[0.5rem] font-black text-slate-300">W</span>
                                    <input 
                                      type="number"
                                      className="w-10 bg-slate-50 border border-slate-200 rounded text-[0.55rem] py-0 px-1 font-bold"
                                      value={col.width}
                                      onChange={(e) => { e.stopPropagation(); updateColumnConfig(col.key, 'width', parseInt(e.target.value) || 10); }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-[1440px] mx-auto w-full">
        {view === 'clients' ? (
          <ClientsView userId={user.uid} />
        ) : view === 'dashboard' ? (
          <div className="space-y-10">
                {/* Dashboard Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                  {[
                    { label: 'Počet ponúk', value: stats.total, icon: FileText, color: '#3b82f6', bg: 'bg-blue-50/30 dark:bg-blue-500/[0.03]', gradient: 'from-blue-500/10 to-transparent' },
                    { label: 'Prijaté', value: stats.prijate, icon: CheckCircle, color: '#10b981', bg: 'bg-emerald-50/30 dark:bg-emerald-500/[0.03]', gradient: 'from-emerald-500/10 to-transparent' },
                    { label: 'Odoslané', value: stats.odoslane, icon: Send, color: '#6366f1', bg: 'bg-indigo-50/30 dark:bg-indigo-500/[0.03]', gradient: 'from-indigo-500/10 to-transparent' },
                    { label: 'Odmietnuté', value: stats.odmietnute, icon: XCircle, color: '#ef4444', bg: 'bg-rose-50/30 dark:bg-rose-500/[0.03]', gradient: 'from-rose-500/10 to-transparent' },
                    { label: 'Celková hodnota', value: stats.totalValue, icon: Euro, color: '#f59e0b', bg: 'bg-amber-50/30 dark:bg-amber-500/[0.03]', gradient: 'from-amber-500/10 to-transparent', suffix: ' €' }
                  ].map((stat, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      whileHover={{ y: -6, scale: 1.02 }}
                      className={`group relative overflow-hidden bg-white dark:bg-[#1a1d27] border border-slate-200 dark:border-white/[0.06] rounded-[2.2rem] p-7 shadow-xl shadow-black/5 hover:shadow-accent/20 transition-all duration-500 ${stat.bg}`}
                      style={{ borderLeft: `4px solid ${stat.color}` }}
                    >
                      <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${stat.gradient} -mr-20 -mt-20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`}></div>
                       <div className="flex justify-between items-start mb-6 relative z-10">
                        <span className="text-[0.7rem] font-black text-text-muted dark:text-slate-400 uppercase tracking-[0.25em]">{stat.label}</span>
                        <stat.icon size={48} className="text-text-muted opacity-5 dark:opacity-10 absolute -right-4 -top-4 scale-125 group-hover:rotate-12 group-hover:scale-150 group-hover:opacity-30 transition-all duration-700 ease-out" />
                      </div>
                      <div className="flex flex-col gap-1 relative z-10">
                        <div className="text-4xl lg:text-5xl font-black text-text-dark dark:text-white tracking-tighter tabular-nums flex items-baseline gap-1 animate-fade-up font-display">
                          {quotes === null ? (
                            <div className="h-10 w-24 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg"></div>
                          ) : (
                            <>
                              {typeof stat.value === 'number' 
                                ? stat.value.toLocaleString('sk-SK', { minimumFractionDigits: stat.suffix ? 2 : 0 })
                                : stat.value}{stat.suffix}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest mt-4 bg-slate-100 dark:bg-slate-800/50 w-fit px-2.5 py-1 rounded-md">
                          <span>tento kvartál</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

            {/* Dashboard Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="relative flex-1 max-w-xl group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-accent transition-colors" size={18} />
                <input 
                  type="text"
                  placeholder="Rýchle vyhľadávanie podkladov..."
                  className="w-full bg-white dark:bg-[#1a1d27] border border-slate-200 dark:border-white/[0.06] focus:ring-4 focus:ring-accent/10 rounded-2xl py-4 pl-12 pr-12 text-sm font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600 dark:text-white transition-all shadow-lg shadow-black/5"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 text-[0.6rem] font-black text-slate-400">
                  ⌘ K
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white dark:bg-[#1a1d27] p-1.5 rounded-2xl border border-slate-200 dark:border-white/[0.06] shadow-lg shadow-black/5">
                   <select 
                    className="bg-transparent border-none rounded-xl py-2 px-4 text-xs font-black text-slate-600 dark:text-slate-300 focus:ring-0 uppercase tracking-widest"
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as any)}
                  >
                    <option value="updatedAt">Upravené</option>
                    <option value="quoteNumber">ID</option>
                    <option value="clientName">Zákazník</option>
                    <option value="date">Dátum</option>
                  </select>
                  <button 
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-400 transition-all active:scale-90"
                  >
                    <ArrowUpDown size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Dashboard Table */}
            <div className="bg-white dark:bg-[#1a1d27] rounded-[2.5rem] border border-slate-200 dark:border-white/[0.06] shadow-2xl overflow-hidden transition-all duration-500">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-20">
                       <th className="px-8 py-6 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200 dark:border-white/[0.06] w-[220px]">Identifikátor</th>
                       <th className="px-8 py-6 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200 dark:border-white/[0.06]">Obchodný Partner</th>
                       <th className="px-8 py-6 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200 dark:border-white/[0.06] text-center w-[150px]">Dátum</th>
                       <th className="px-8 py-6 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200 dark:border-white/[0.06] text-right w-[180px]">Celková Suma</th>
                       <th className="px-8 py-6 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200 dark:border-white/[0.06] text-center w-[160px]">Stav</th>
                       <th className="px-8 py-6 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200 dark:border-white/[0.06] text-right w-[180px]">Akcie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.03] transition-colors">
                    <AnimatePresence initial={false}>
                      {quotes === null ? (
                        // Loading Skeletons
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i} className="animate-pulse">
                            <td className="px-8 py-6"><div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl w-3/4"></div></td>
                            <td className="px-8 py-6"><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg w-1/2"></div></td>
                            <td className="px-8 py-6"><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg w-20 mx-auto"></div></td>
                            <td className="px-8 py-6"><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg w-24 ml-auto"></div></td>
                            <td className="px-8 py-6"><div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-full w-24 mx-auto"></div></td>
                            <td className="px-8 py-6"><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg w-20 ml-auto"></div></td>
                          </tr>
                        ))
                      ) : (
                        filteredQuotes.map((quote, index) => (
                          <motion.tr 
                            key={quote.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: 0.1 + index * 0.05 }}
                            className="hover:bg-accent/[0.03] dark:hover:bg-accent/[0.06] transition-all group/row cursor-pointer"
                            onClick={() => openQuote(quote)}
                          >
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-4">
                                <div className="w-1.5 h-10 rounded-full bg-accent opacity-0 group-hover/row:opacity-100 transition-all -ml-1"></div>
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-accent font-mono tracking-tight">{quote.quoteNumber}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-100 truncate">{quote.clientName || '—'}</span>
                              </div>
                            </td>
                            <td className="px-8 py-6 text-center whitespace-nowrap">
                              <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.06]">
                                {(quote.date && quote.date.includes('-')) ? quote.date.split('-').reverse().join('.') : (quote.date || '—')}
                              </span>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <div className="flex flex-col items-end">
                                <span className="text-base font-black text-primary dark:text-white tabular-nums">
                                  {calculateQuoteTotal(quote).toLocaleString('sk-SK', { minimumFractionDigits: 2 })} €
                                </span>
                              </div>
                            </td>
                            <td className="px-8 py-6 text-center">
                              <div className="relative inline-block group/status">
                                <button className={`
                                  px-4 py-2 rounded-full text-[0.6rem] font-black uppercase tracking-[0.15em] border transition-all duration-300
                                  ${quote.status === 'Koncept' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 shadow-sm shadow-black/5' : ''}
                                  ${quote.status === 'Odoslaná' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-sm shadow-blue-500/10' : ''}
                                  ${quote.status === 'Prijatá' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-sm shadow-emerald-500/10' : ''}
                                  ${quote.status === 'Odmietnutá' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-sm shadow-rose-500/10' : ''}
                                `}>
                                  {quote.status}
                                </button>
                              </div>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover/row:opacity-100 transition-all duration-300 translate-x-4 group-hover/row:translate-x-0">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); openQuote(quote); }}
                                  className="p-2.5 text-slate-400 hover:text-accent hover:bg-accent/10 rounded-xl transition-all"
                                  title="Detail"
                                >
                                  <Eye size={18} />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); duplicateQuote(quote); }}
                                  className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-xl transition-all"
                                  title="Kopírovať"
                                >
                                  <Copy size={18} />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteQuote(quote.id); }}
                                  className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                  title="Zmazať"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))
                      )}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
              
              {filteredQuotes.length === 0 && (
                <div className="py-32 text-center bg-white dark:bg-[#1a1d27]">
                  <div className="w-24 h-24 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/[0.06] rounded-[2.5rem] flex items-center justify-center text-slate-200 dark:text-slate-800 mx-auto mb-8 transition-all hover:scale-110 active:rotate-12">
                    <Search size={48} />
                  </div>
                  <h3 className="text-xl font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-2">Žiadne výsledky nenašli</h3>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mb-8 max-w-md mx-auto">Skúste zadať iný názov klienta alebo skontrolujte ID ponuky.</p>
                  <button 
                    onClick={createNewQuote}
                    className="inline-flex items-center gap-2 bg-accent text-white px-8 py-4 rounded-full font-black text-xs uppercase tracking-widest hover:shadow-xl hover:shadow-accent/30 transition-all active:scale-95"
                  >
                    <Plus size={16} />
                    Vytvoriť prvú ponuku
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : data && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
            {/* Main Content Area */}
            <div className="space-y-6 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => handleSaveAndExit()}
                    className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-all"
                    title="Späť na prehľad"
                  >
                    <X size={20} />
                  </button>
                  <div>
                    <h2 className="text-2xl font-black text-primary tracking-tight">{data.quoteNumber || 'Nová Ponuka'}</h2>
                    <p className="text-xs text-text-muted font-medium">Upravte detaily a uložte zmeny</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => updateStatus(data.id, 'Odoslaná')}
                    className="flex items-center gap-2 bg-indigo-50 text-indigo-500 px-4 py-2 rounded-lg text-[0.6rem] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100"
                  >
                    <Send size={12} />
                    Označiť ako odoslanú
                  </button>
                  <button 
                    onClick={handleSaveAndExit}
                    className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-[0.6rem] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
                  >
                    <Check size={14} />
                    Uložiť a zavrieť
                  </button>
                </div>
              </div>

            {/* Items Table Card */}
            <section className="theme-card">
              {/* Responsive table container */}
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  <div className="grid grid-cols-[1fr_100px_100px_140px_140px_50px] bg-slate-50/80 px-4 py-3 border-b border-border items-center">
                    <div className="theme-label mb-0">Popis materiálu / Práce</div>
                    <div className="theme-label mb-0 text-center">MJ</div>
                    <div className="theme-label mb-0 text-center">Množstvo</div>
                    <div className="theme-label mb-0 text-right pr-4">J. cena</div>
                    <div className="theme-label mb-0 text-right pr-4">Celkom</div>
                    <div></div>
                  </div>

                  <div className="divide-y divide-border">
                    <AnimatePresence initial={false}>
                      {data.items.map((item) => (
                        <motion.div 
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          whileHover={{ scale: 1.002, x: 2 }}
                          className="grid grid-cols-[1fr_100px_100px_140px_140px_50px] px-4 py-4 items-start hover:bg-white hover:shadow-[0_0_15px_rgba(37,99,235,0.06)] hover:ring-1 hover:ring-accent/5 transition-all duration-300 relative rounded-lg border-l-4 border-l-transparent hover:border-l-accent group/row"
                        >
                          <div className="relative group/quill">
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <ReactQuill 
                                  theme="snow"
                                  value={item.description}
                                  onChange={value => updateItem(item.id, 'description', value)}
                                  placeholder="Zadajte popis s formátovaním..."
                                  className="bg-white rounded border-transparent focus-within:border-accent/30 transition-all text-sm"
                                  modules={{
                                    toolbar: [
                                      ['bold', 'italic'],
                                      [{ 'list': 'bullet' }],
                                    ],
                                  }}
                                />
                              </div>
                              <button 
                                onClick={() => setActiveSuggestionIndex(activeSuggestionIndex === item.id ? null : item.id)}
                                className="mt-1 p-1.5 text-slate-400 hover:text-accent border border-slate-100 hover:border-accent/20 rounded-md transition-all shadow-sm bg-white"
                                title="Návrhy z minulosti"
                              >
                                <History size={16} />
                              </button>
                            </div>

                            {activeSuggestionIndex === item.id && commonItems.length > 0 && (
                              <div className="absolute top-full left-0 w-full bg-white border border-border shadow-2xl rounded-xl z-50 max-h-[250px] overflow-y-auto p-3 mt-1 space-y-1 animate-in fade-in slide-in-from-top-2">
                                <div className="text-[0.6rem] font-black text-text-muted uppercase tracking-widest px-2 py-1 mb-2 border-b border-slate-100 flex items-center justify-between">
                                  <span>Časté položky</span>
                                  <History size={10} />
                                </div>
                                {commonItems.filter(ci => !item.description.includes(ci)).map((suggestion, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      updateItem(item.id, 'description', suggestion);
                                      setActiveSuggestionIndex(null);
                                    }}
                                    className="w-full text-left px-3 py-2.5 text-xs hover:bg-accent/5 hover:text-accent rounded-lg flex items-center justify-between group transition-colors border border-transparent hover:border-accent/10"
                                  >
                                    <div className="truncate pr-4" dangerouslySetInnerHTML={{ __html: suggestion }} />
                                    <Check size={12} className="opacity-0 group-hover:opacity-100" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          <div className="pt-2 px-2">
                            <select 
                              className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-transparent focus:border-accent/30 focus:bg-white dark:focus:bg-slate-800 rounded py-1 px-1 text-center text-xs font-bold text-text-muted transition-all appearance-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                              value={item.unit}
                              onChange={e => updateItem(item.id, 'unit', e.target.value)}
                            >
                              <option value="hod">hod</option>
                              <option value="ks">ks</option>
                              <option value="m">m</option>
                              <option value="m2">m2</option>
                              <option value="kpl">kpl</option>
                              <option value="km">km</option>
                              <option value="t">t</option>
                            </select>
                          </div>
                          <div className="pt-2 px-2">
                            <input 
                              type="number"
                              className="w-full bg-slate-50/50 border border-transparent focus:border-border focus:bg-white rounded py-1 text-center text-sm font-bold appearance-none transition-all"
                              value={item.quantity}
                              onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div className="pt-2 text-right pr-4">
                            <div className="flex items-center justify-end bg-slate-50/50 border border-transparent focus-within:border-border focus-within:bg-white rounded px-2 py-1 transition-all">
                              <input 
                                type="number"
                                step="0.01"
                                className="w-full bg-transparent border-none focus:ring-0 text-right text-sm font-bold p-0"
                                value={item.unitPrice}
                                onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              />
                              <span className="text-[0.6rem] font-black text-text-muted ml-1">€</span>
                            </div>
                          </div>
                          <div className="pt-3 text-right pr-4 text-sm font-black text-primary">
                            {(item.quantity * item.unitPrice).toLocaleString('sk-SK', { minimumFractionDigits: 2 })} €
                          </div>
                          <div className="pt-2 flex justify-center">
                            <button 
                              onClick={() => removeItem(item.id)}
                              disabled={data.items.length <= 1}
                              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-0"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50/30 border-t border-border flex gap-3">
                <button 
                  onClick={() => {
                    setCatalogMode('select');
                    setIsCatalogOpen(true);
                  }}
                  className="flex-[2] flex items-center justify-center gap-2 py-3 bg-white border-2 border-slate-200 rounded-xl text-primary font-black text-xs uppercase tracking-widest hover:border-accent hover:text-accent hover:bg-accent/5 transition-all group shadow-sm"
                >
                  <LayoutGrid size={16} className="group-hover:rotate-12 transition-transform" />
                  Vybrať z katalógu
                </button>
                <button 
                  onClick={addItem}
                  className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-xl text-text-muted font-bold text-xs uppercase tracking-widest hover:border-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all group"
                  title="Pridať prázdny riadok"
                >
                  <Plus size={18} />
                  Ručne +
                </button>
              </div>
            </section>

            <section className="theme-card active:shadow-md transition-shadow">
              <div className="bg-slate-50/80 px-6 py-3 border-b border-border flex items-center gap-2 text-text-muted font-black text-[0.7rem] uppercase tracking-widest">
                <FileText size={14} className="text-accent" />
                Zmluvné podmienky a poznámky
              </div>
              <div className="p-6">
                <textarea 
                  rows={6}
                  className="theme-input min-h-[140px] resize-y bg-slate-50/30 border-slate-200 focus:bg-white"
                  placeholder="Zadajte vlastné platobné podmienky..."
                  value={data.paymentTerms}
                  onChange={e => setData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                />
              </div>
            </section>

            <section className="text-text-muted text-[0.7rem] font-medium italic leading-relaxed px-4 py-2 bg-slate-100/50 rounded-lg inline-block">
              * Všetky výpočty sú spracované v reálnom čase podľa legislatívy SR.
            </section>
          </div>

          {/* Sidebar Area */}
          <aside className="space-y-6">
            <div className="sticky top-6 space-y-6">
              {/* Info Card */}
              <div className="theme-card">
                <div className="bg-slate-50/80 px-5 py-3 border-b border-border flex items-center gap-2 text-text-muted font-black text-[0.7rem] uppercase tracking-widest">
                  <User size={14} className="text-accent" />
                  Metadáta Ponuky
                </div>
                <div className="p-5 space-y-6">
                  {/* Logo Section */}
                  <div className="space-y-2">
                    <label className="theme-label font-black text-[0.6rem]">Vaše Firemné Logo</label>
                    {data.logo ? (
                      <div className="relative border-2 border-slate-100 rounded-xl bg-white p-4 group shadow-sm overflow-hidden min-h-[100px] flex items-center">
                        <img src={data.logo} alt="Logo" className="max-h-20 mx-auto object-contain" />
                        <button 
                          onClick={removeLogo}
                          className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-8 cursor-pointer hover:border-accent hover:bg-accent/5 transition-all group text-text-muted">
                        <ImageIcon size={32} className="mb-2 opacity-20 group-hover:opacity-100 group-hover:text-accent transition-all" />
                        <span className="text-[0.65rem] font-black uppercase tracking-widest group-hover:text-accent">Drog & Drop logo</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                      </label>
                    )}
                  </div>

                  <div className="h-px bg-slate-100"></div>

                  <div className="space-y-4">
                    <div>
                      <label className="theme-label font-black text-[0.6rem]">Dodávateľ (Vaša Firma)</label>
                      <input 
                        type="text"
                        placeholder="Meno Vašej firmy"
                        className="theme-input bg-slate-50/50 focus:bg-white"
                        value={data.companyName}
                        onChange={e => setData(prev => ({ ...prev, companyName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="theme-label font-black text-[0.6rem] m-0">Odberateľ (Klient)</label>
                        <button 
                          onClick={() => {
                            setClientModalMode('select');
                            setIsClientModalOpen(true);
                          }}
                          className="text-[0.6rem] font-black text-accent uppercase tracking-widest hover:underline flex items-center gap-1"
                        >
                          <Building size={10} />
                          Vybrať z adresára
                        </button>
                      </div>
                      <input 
                        type="text"
                        placeholder="Meno klienta"
                        className="theme-input bg-slate-50/50 focus:bg-white"
                        value={data.clientName}
                        onChange={e => setData(prev => ({ ...prev, clientName: e.target.value }))}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="theme-label font-black text-[0.6rem]">Dátum</label>
                        <input 
                          type="date"
                          className="theme-input bg-slate-50/50 focus:bg-white text-xs px-2"
                          value={data.date}
                          onChange={e => setData(prev => ({ ...prev, date: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="theme-label font-black text-[0.6rem]">ID Ponuky</label>
                        <input 
                          type="text"
                          className="theme-input bg-slate-50/50 focus:bg-white"
                          value={data.quoteNumber}
                          onChange={e => setData(prev => ({ ...prev, quoteNumber: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Totals Card */}
              <div className="theme-card bg-primary text-white border-none shadow-xl shadow-primary/20">
                <div className="bg-white/5 border-b border-white/10 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-[0.7rem] uppercase tracking-widest text-slate-400">
                    <Hash size={16} />
                    Rekapitulácia
                  </div>
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
                </div>
                
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center text-sm border-b border-white/5 pb-3">
                    <span className="text-slate-400 font-bold uppercase text-[0.6rem] tracking-wider">Základ (Bez DPH)</span>
                    <span className="font-black text-lg">{total.toLocaleString('sk-SK', { minimumFractionDigits: 2 })} €</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-white/5 pb-3">
                    <span className="text-slate-400 font-bold uppercase text-[0.6rem] tracking-wider">DPH (20%)</span>
                    <span className="font-bold">{(total * 0.2).toLocaleString('sk-SK', { minimumFractionDigits: 2 })} €</span>
                  </div>

                  <div className="pt-4 flex flex-col items-end gap-1">
                    <div className="text-[0.65rem] font-black text-accent uppercase tracking-widest">K úhrade spolu</div>
                    <div className="text-4xl font-black tracking-tighter text-white drop-shadow-md">
                      {(total * 1.2).toLocaleString('sk-SK', { minimumFractionDigits: 2 })} €
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 mt-6">
                    <button
                      onClick={handleExport}
                      className="group relative w-full bg-accent text-white py-4 rounded-xl font-black text-sm shadow-2xl hover:bg-blue-500 active:scale-[0.98] transition-all flex items-center justify-center gap-3 overflow-hidden shadow-accent/40"
                    >
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                      <span className="relative flex items-center gap-3">
                        <Download size={20} className="group-hover:bounce" />
                        GENEROVAŤ EXCEL (XLSX)
                      </span>
                    </button>

                    <button
                      onClick={handlePDFExport}
                      className="group relative w-full bg-white border-2 border-slate-100 text-slate-700 py-4 rounded-xl font-black text-sm shadow-lg hover:border-red-100 hover:bg-red-50/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3 overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-red-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                      <span className="relative flex items-center gap-3">
                        <FileDown size={20} className="text-red-500 group-hover:scale-110 transition-transform" />
                        EXPORTIŤ PDF (TLAČ)
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* History Card */}
              <AnimatePresence>
                {history.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="theme-card"
                  >
                    <div className="bg-slate-50/80 px-5 py-3 border-b border-border flex items-center gap-2 text-text-muted font-black text-[0.7rem] uppercase tracking-widest">
                      <Clock size={14} className="text-accent" />
                      Nedávne Ponuky
                    </div>
                    <div className="p-3 space-y-2">
                      {history.map((h) => (
                        <div key={h.quoteNumber} className="group relative bg-white border border-slate-100 rounded-lg p-3 hover:border-accent/30 hover:shadow-sm transition-all">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[0.65rem] font-black text-primary truncate max-w-[120px]">{h.quoteNumber}</span>
                            <span className="text-[0.6rem] text-text-muted font-bold">{h.date}</span>
                          </div>
                          <div className="text-xs font-bold text-slate-700 truncate mb-2">{h.clientName || 'Neznámy klient'}</div>
                          
                          <div className="flex gap-2">
                            <button 
                              onClick={() => loadFromHistory(h)}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-slate-50 hover:bg-accent hover:text-white rounded text-[0.65rem] font-bold transition-all"
                            >
                              <Copy size={10} />
                              NAČÍTAŤ
                            </button>
                            <button 
                              onClick={() => removeFromHistory(h.quoteNumber)}
                              className="px-2 py-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                              title="Zmazať z histórie"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </aside>
        </div>
      )}
    </main>

    <footer className="py-4 px-8 border-t border-border bg-white dark:bg-slate-900 transition-colors flex justify-between items-center text-[0.7rem] font-bold text-text-muted dark:text-slate-500 uppercase tracking-[0.1em]">
      <div>QuotePro v2.5.0 <span className="opacity-40">Build 2024.12</span></div>
      <div className="hidden sm:block">Všetky výpočty v reálnom čase (EUR)</div>
    </footer>

    {user && (
      <CatalogModal 
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        userId={user.uid}
        mode={catalogMode}
        onSelect={handleCatalogSelect}
      />
    )}

    {user && (
      <ClientModal 
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        userId={user.uid}
        mode={clientModalMode}
        onSelect={handleClientSelect}
      />
    )}

    {/* Save Client Prompt */}
    <AnimatePresence>
      {showSaveClientPrompt && (
        <div className="fixed inset-x-0 bottom-8 z-[120] flex justify-center px-4">
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="bg-primary text-white p-4 rounded-2xl shadow-2xl border border-white/10 flex flex-col md:flex-row items-center gap-6 max-w-2xl w-full"
          >
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <User size={24} className="text-accent" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h4 className="font-black text-sm tracking-tight leading-tight">Uložiť klienta do adresára?</h4>
              <p className="text-xs text-slate-300 font-medium mt-1">
                Zistili sme, že klient <span className="text-white font-bold">{data?.clientName}</span> nie je vo vašom adresári.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button 
                onClick={() => setShowSaveClientPrompt(false)}
                className="px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-300 hover:text-white transition-colors"
              >
                Nie teraz
              </button>
              <button 
                onClick={handleSaveCurrentClient}
                className="bg-accent text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 shadow-lg shadow-accent/20 flex items-center gap-2"
              >
                <Check size={14} />
                Uložiť klienta
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </div>
  );
}
