import { EAN_INDEX_SEED, EanIndexEntry } from '../data/eanIndexSeed';

const EAN_INDEX_STORAGE_KEY = 'potok_ean_index_v1';

const loadEanIndex = (): EanIndexEntry[] => {
  try {
    const stored = localStorage.getItem(EAN_INDEX_STORAGE_KEY);
    if (!stored) return EAN_INDEX_SEED;
    const parsed: EanIndexEntry[] = JSON.parse(stored);
    return parsed;
  } catch (error) {
    console.error('Failed to load EAN index', error);
    return EAN_INDEX_SEED;
  }
};

const saveEanIndex = (items: EanIndexEntry[]) => {
  try {
    localStorage.setItem(EAN_INDEX_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Failed to save EAN index', error);
  }
};

export const barcodeLookupService = {
  findProductId(barcode: string): EanIndexEntry | null {
    const items = loadEanIndex();
    return items.find((i) => i.barcode === barcode) || null;
  },
  addMapping(entry: EanIndexEntry) {
    const items = loadEanIndex();
    const idx = items.findIndex((i) => i.barcode === entry.barcode);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...entry };
    } else {
      items.push({ ...entry, createdAt: entry.createdAt ?? new Date().toISOString() });
    }
    saveEanIndex(items);
  },
};

