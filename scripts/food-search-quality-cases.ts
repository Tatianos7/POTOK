export type SearchIssueCode =
  | 'MISSING_GENERIC_CANONICAL'
  | 'GENERIC_EXISTS_LOW_RANK'
  | 'BROAD_QUERY_SHOULD_SHOW_CHOICES'
  | 'ALIAS_TARGET_WRONG'
  | 'COOKING_STATE_MISMATCH'
  | 'CATEGORY_MISMATCH'
  | 'SPECIFIC_RESULT_TOO_HIGH'
  | 'RANDOM_DB_ORDER'
  | 'DUPLICATE_CANONICAL_RESULT'
  | 'DATA_QUALITY_ISSUE'
  | 'ACCEPTABLE';

export type SearchQualityCase = {
  query: string;
  group: 'known_warning' | 'dairy' | 'meat' | 'fish' | 'grains' | 'vegetables' | 'fruits' | 'beverages' | 'bread_bakery' | 'prepared';
  genericPolicy: 'required' | 'optional' | 'manual_selection';
  expectedTop3?: string[];
  notes: string;
};

export const knownWarningQueries = ['йогурт', 'овсянка', 'сыр', 'хлеб', 'чай', 'рыба'] as const;

export const foodSearchQualityCases: SearchQualityCase[] = [
  { query: 'йогурт', group: 'known_warning', genericPolicy: 'required', notes: 'A plain yogurt result is useful for ordinary user search.' },
  { query: 'овсянка', group: 'known_warning', genericPolicy: 'manual_selection', notes: 'Conversational query can mean flakes, groats, or cooked porridge.' },
  { query: 'сыр', group: 'known_warning', genericPolicy: 'manual_selection', notes: 'Cheese nutrition varies too much for one safe universal profile.' },
  { query: 'хлеб', group: 'known_warning', genericPolicy: 'manual_selection', notes: 'Bread type materially changes nutrition; show choices.' },
  { query: 'чай', group: 'known_warning', genericPolicy: 'manual_selection', notes: 'Can mean prepared unsweetened drink or dry tea leaves.' },
  { query: 'рыба', group: 'known_warning', genericPolicy: 'manual_selection', notes: 'Fish species and cooking states vary too much for one profile.' },
  { query: 'молоко', group: 'dairy', genericPolicy: 'required', expectedTop3: ['milk'], notes: 'Plain milk is a valid generic/base item.' },
  { query: 'кефир', group: 'dairy', genericPolicy: 'required', notes: 'Plain kefir is a valid generic/base item.' },
  { query: 'творог', group: 'dairy', genericPolicy: 'required', notes: 'Plain cottage cheese/curd is a useful base item, fat variants may also appear.' },
  { query: 'яйцо', group: 'prepared', genericPolicy: 'required', notes: 'User expects egg candidates; exact generic or clear forms should rank high.' },
  { query: 'курица', group: 'meat', genericPolicy: 'manual_selection', notes: 'Chicken parts and cooking states vary; manual selection is safer.' },
  { query: 'говядина', group: 'meat', genericPolicy: 'manual_selection', notes: 'Cuts vary; broad query should show choices.' },
  { query: 'свинина', group: 'meat', genericPolicy: 'manual_selection', notes: 'Cuts vary; broad query should show choices.' },
  { query: 'рис', group: 'grains', genericPolicy: 'manual_selection', notes: 'Raw vs cooked rice must stay separated.' },
  { query: 'гречка', group: 'grains', genericPolicy: 'manual_selection', notes: 'Can mean groats or cooked buckwheat porridge.' },
  { query: 'макароны', group: 'grains', genericPolicy: 'manual_selection', notes: 'Raw vs cooked pasta must stay separated.' },
  { query: 'картофель', group: 'vegetables', genericPolicy: 'manual_selection', notes: 'Raw, boiled, fried, and baked states differ.' },
  { query: 'яблоко', group: 'fruits', genericPolicy: 'required', notes: 'Plain apple is a safe generic fruit.' },
  { query: 'банан', group: 'fruits', genericPolicy: 'required', notes: 'Plain banana is a safe generic fruit.' },
  { query: 'кофе', group: 'beverages', genericPolicy: 'manual_selection', notes: 'Can mean black drink, dry coffee, or milk/sugar variants.' },
  { query: 'вода', group: 'beverages', genericPolicy: 'required', notes: 'Plain water is a valid generic zero-macro item.' },
  { query: 'масло', group: 'prepared', genericPolicy: 'manual_selection', notes: 'Can mean butter or vegetable oils.' },
  { query: 'сахар', group: 'prepared', genericPolicy: 'required', notes: 'Plain sugar is a valid generic pantry item.' },
  { query: 'соль', group: 'prepared', genericPolicy: 'required', notes: 'Plain salt is a valid generic pantry item.' },
  { query: 'морковь', group: 'vegetables', genericPolicy: 'required', notes: 'Plain carrot is a useful generic item.' },
  { query: 'лук', group: 'vegetables', genericPolicy: 'manual_selection', notes: 'Can mean onion variants or green onion.' },
  { query: 'помидор', group: 'vegetables', genericPolicy: 'required', notes: 'Plain tomato is a useful generic item.' },
  { query: 'огурец', group: 'vegetables', genericPolicy: 'required', notes: 'Plain cucumber is a useful generic item.' },
  { query: 'капуста', group: 'vegetables', genericPolicy: 'manual_selection', notes: 'Different cabbage types and states vary.' },
  { query: 'апельсин', group: 'fruits', genericPolicy: 'required', notes: 'Plain orange is a safe generic fruit.' },
  { query: 'груша', group: 'fruits', genericPolicy: 'required', notes: 'Plain pear is a safe generic fruit.' },
  { query: 'виноград', group: 'fruits', genericPolicy: 'required', notes: 'Plain grapes are a safe generic fruit.' },
  { query: 'творожок', group: 'dairy', genericPolicy: 'manual_selection', notes: 'Often branded/sweetened; should not silently map to plain cottage cheese.' },
  { query: 'сметана', group: 'dairy', genericPolicy: 'manual_selection', notes: 'Fat percentage changes nutrition materially.' },
  { query: 'сливки', group: 'dairy', genericPolicy: 'manual_selection', notes: 'Fat percentage changes nutrition materially.' },
  { query: 'индейка', group: 'meat', genericPolicy: 'manual_selection', notes: 'Part and cooking state matter.' },
  { query: 'лосось', group: 'fish', genericPolicy: 'manual_selection', notes: 'Raw/salted/cooked state matters.' },
  { query: 'тунец', group: 'fish', genericPolicy: 'manual_selection', notes: 'Fresh vs canned varies.' },
  { query: 'суп', group: 'prepared', genericPolicy: 'manual_selection', notes: 'Prepared food category too broad.' },
  { query: 'борщ', group: 'prepared', genericPolicy: 'manual_selection', notes: 'Recipe variants vary; show candidates.' },
  { query: 'каша', group: 'prepared', genericPolicy: 'manual_selection', notes: 'Grain type and milk/water differ.' },
  { query: 'салат', group: 'prepared', genericPolicy: 'manual_selection', notes: 'Prepared food category too broad.' },
  { query: 'шоколад', group: 'prepared', genericPolicy: 'manual_selection', notes: 'Type and sugar/filling vary.' },
  { query: 'печенье', group: 'bread_bakery', genericPolicy: 'manual_selection', notes: 'Brand/recipe variants vary.' },
  { query: 'булочка', group: 'bread_bakery', genericPolicy: 'manual_selection', notes: 'Bakery variants vary.' },
  { query: 'творожная запеканка', group: 'prepared', genericPolicy: 'manual_selection', notes: 'Recipe variants vary.' },
  { query: 'греческий йогурт', group: 'dairy', genericPolicy: 'required', notes: 'Specific common dairy subtype should resolve if present.' },
  { query: 'чай зеленый', group: 'beverages', genericPolicy: 'manual_selection', notes: 'Drink vs dry leaves still matters.' },
  { query: 'хлеб ржаной', group: 'bread_bakery', genericPolicy: 'required', notes: 'Specific bread subtype is safe enough if present.' },
  { query: 'картофель вареный', group: 'vegetables', genericPolicy: 'required', notes: 'Cooking state explicitly requested.' },
];

export const broadManualSelectionQueries = foodSearchQualityCases
  .filter((item) => item.genericPolicy === 'manual_selection')
  .map((item) => item.query);
