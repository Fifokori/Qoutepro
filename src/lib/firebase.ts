import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  onSnapshot, 
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { QuoteData } from '../types';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Login failed:", error);
    throw error;
  }
};

export const logout = () => signOut(auth);

// Quote Helpers
export const subscribeToQuotes = (userId: string, callback: (quotes: QuoteData[]) => void) => {
  const q = query(
    collection(db, 'users', userId, 'quotes'),
    orderBy('updatedAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const quotes = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as QuoteData[];
    callback(quotes);
  });
};

export const saveQuote = async (userId: string, quote: QuoteData) => {
  const quoteRef = doc(db, 'users', userId, 'quotes', quote.id);
  
  // Strip undefined values which Firestore doesn't support
  const cleanData = JSON.parse(JSON.stringify({
    ...quote,
    updatedAt: new Date().toISOString()
  }));
  
  await setDoc(quoteRef, cleanData, { merge: true });
};

export const deleteQuote = async (userId: string, quoteId: string) => {
  const quoteRef = doc(db, 'users', userId, 'quotes', quoteId);
  await deleteDoc(quoteRef);
};

// Catalog Helpers
import { CatalogItem } from '../types';

export const subscribeToCatalog = (userId: string, callback: (items: CatalogItem[]) => void) => {
  const q = query(
    collection(db, 'users', userId, 'catalog'),
    orderBy('name', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as CatalogItem[];
    callback(items);
  });
};

export const saveCatalogItem = async (userId: string, item: CatalogItem) => {
  const itemRef = doc(db, 'users', userId, 'catalog', item.id);
  const cleanData = JSON.parse(JSON.stringify({
    ...item,
    updatedAt: new Date().toISOString()
  }));
  await setDoc(itemRef, cleanData, { merge: true });
};

export const deleteCatalogItem = async (userId: string, itemId: string) => {
  const itemRef = doc(db, 'users', userId, 'catalog', itemId);
  await deleteDoc(itemRef);
};

// Client Helpers
import { Client } from '../types';

export const subscribeToClients = (userId: string, callback: (clients: Client[]) => void) => {
  const q = query(
    collection(db, 'users', userId, 'clients'),
    orderBy('name', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const clients = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as Client[];
    callback(clients);
  });
};

export const saveClient = async (userId: string, client: Client) => {
  const clientRef = doc(db, 'users', userId, 'clients', client.id);
  const cleanData = JSON.parse(JSON.stringify({
    ...client,
    updatedAt: new Date().toISOString()
  }));
  await setDoc(clientRef, cleanData, { merge: true });
};

export const deleteClient = async (userId: string, clientId: string) => {
  const clientRef = doc(db, 'users', userId, 'clients', clientId);
  await deleteDoc(clientRef);
};
