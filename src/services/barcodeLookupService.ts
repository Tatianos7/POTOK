import { EanIndexEntry } from '../data/eanIndexSeed';

const EAN_INDEX_STORAGE_KEY = 'potok_ean_index_v1';

const loadEanIndex = (): EanIndexEntry[] => {
  try {
    const stored = localStorage.getItem(EAN_INDEX_STORAGE_KEY);
    if (!stored) return [];
    const parsed: EanIndexEntry[] = JSON.parse(stored);
    return parsed;
  } catch (error) {
    console.error('Failed to load EAN index', error);
    return [];
  }
};

export const barcodeLookupService = {
  findProductId(barcode: string): EanIndexEntry | null {
    const items = loadEanIndex();
    return items.find((i) => i.barcode === barcode) || null;
  },
  addMapping(entry: EanIndexEntry) {
    console.warn('[barcodeLookupService] addMapping disabled: Supabase is source of truth');
    void entry;
  },
};

