export interface QuoteItem {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

export interface ColumnConfig {
  key: 'description' | 'unit' | 'quantity' | 'unitPrice' | 'total';
  label: string;
  width: number;
  visible: boolean;
  order: number;
}

export interface ExportSettings {
  columns: ColumnConfig[];
  primaryColor: string;
  accentColor: string;
  headerFontSize: number;
  includeVAT: boolean;
  vatRate: number;
}

export type QuoteStatus = 'Koncept' | 'Odoslaná' | 'Prijatá' | 'Odmietnutá';

export type CatalogCategory = 'Materiál' | 'Práca' | 'Doprava' | 'Iné';

export interface Client {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  ico?: string;
  updatedAt: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  mj: string;
  defaultPrice: number;
  category: CatalogCategory;
  updatedAt: string;
}

export interface QuoteData {
  id: string;
  companyName: string;
  clientName: string;
  date: string;
  quoteNumber: string;
  items: QuoteItem[];
  logo?: string; // Base64 string
  paymentTerms?: string;
  exportSettings?: ExportSettings;
  status: QuoteStatus;
  updatedAt?: string;
}
