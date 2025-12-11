export interface EanIndexEntry {
  barcode: string;
  productId: string;
  brand?: string | null;
  name_ru?: string | null;
  category?: string | null;
  createdAt?: string;
}

export const EAN_INDEX_SEED: EanIndexEntry[] = [
  {
    barcode: '4600000000010',
    productId: 'rus_0001',
    brand: 'Домик в деревне',
    name_ru: 'Молоко питьевое 3.2%',
    category: 'dairy',
    createdAt: new Date().toISOString(),
  },
  {
    barcode: '4600000000027',
    productId: 'rus_0002',
    brand: 'Простоквашино',
    name_ru: 'Кефир 1%',
    category: 'dairy',
    createdAt: new Date().toISOString(),
  },
  {
    barcode: '4600000000034',
    productId: 'rus_0003',
    name_ru: 'Хлеб пшеничный',
    category: 'bread',
    createdAt: new Date().toISOString(),
  },
  {
    barcode: '4600000000041',
    productId: 'rus_0004',
    name_ru: 'Куриное филе сырое',
    category: 'meat',
    createdAt: new Date().toISOString(),
  },
  {
    barcode: '4600000000058',
    productId: 'rus_0005',
    name_ru: 'Помидоры свежие',
    category: 'vegetables',
    createdAt: new Date().toISOString(),
  },
];

