/**
 * Преобразует любой ID в валидный UUID формат.
 * Используется для совместимости локальных ID с Supabase, который требует UUID.
 * Функция детерминированная - один и тот же ID всегда преобразуется в один и тот же UUID.
 * 
 * UUID формат: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * где x - любая hex цифра, y - один из 8, 9, a, b
 */
export function toUUID(id: string): string {
  // Если уже валидный UUID, возвращаем как есть
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id.toLowerCase();
  }

  // Простая хеш-функция для детерминированного преобразования
  let hash1 = 0;
  let hash2 = 0;
  let hash3 = 0;
  
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash1 = ((hash1 << 5) - hash1) + char;
    hash1 = hash1 & hash1; // Convert to 32bit integer
    hash2 = ((hash2 << 3) - hash2) + char * (i + 1);
    hash2 = hash2 & hash2;
    hash3 = ((hash3 << 7) - hash3) + char * (i * 2 + 1);
    hash3 = hash3 & hash3;
  }

  // Генерируем детерминированный UUID v4-подобный формат
  // Формат: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // где x - любая hex цифра (0-9, a-f), y - один из 8, 9, a, b
  
  // Генерируем достаточно данных для всех частей UUID
  const combined = id + hash1.toString() + hash2.toString() + hash3.toString();
  let hexString = '';
  for (let i = 0; i < combined.length; i++) {
    hexString += combined.charCodeAt(i).toString(16);
  }
  // Дополняем до нужной длины
  while (hexString.length < 32) {
    hexString += (hash1 * hash2 * hash3).toString(16);
  }
  
  // Часть 1: 8 hex символов (xxxxxxxx)
  const part1 = hexString.slice(0, 8).padEnd(8, '0');
  
  // Часть 2: 4 hex символа (xxxx)
  const part2 = hexString.slice(8, 12).padEnd(4, '0');
  
  // Часть 3: начинается с 4, затем 3 hex символа (4xxx)
  const part3 = '4' + hexString.slice(12, 15).padEnd(3, '0');
  
  // Часть 4: начинается с 8, 9, a или b, затем 3 hex символа (yxxx)
  const variantChars = ['8', '9', 'a', 'b'];
  const variantIndex = Math.abs(hash1) % 4;
  const part4 = variantChars[variantIndex] + hexString.slice(15, 18).padEnd(3, '0');
  
  // Часть 5: 12 hex символов (xxxxxxxxxxxx)
  const part5 = hexString.slice(18, 30).padEnd(12, '0');
  
  const uuid = `${part1}-${part2}-${part3}-${part4}-${part5}`;
  
  // Проверяем, что UUID правильной длины (36 символов: 32 hex + 4 дефиса)
  if (uuid.length !== 36) {
    console.error('[toUUID] Generated UUID has wrong length:', uuid.length, uuid);
  }
  
  return uuid.toLowerCase();
}

/**
 * Проверяет, является ли строка валидным UUID
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

