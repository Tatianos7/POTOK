export interface ProfileDetails {
  firstName: string;
  lastName?: string;
  middleName?: string;
  birthDate?: string;
  age?: number;
  height?: number;
  goal?: string;
  email?: string;
  phone?: string;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  password?: string;
  hasPremium: boolean;
  createdAt: string;
  profile: ProfileDetails;
  isAdmin?: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginCredentials {
  identifier: string;
  password: string;
}

export interface RegisterCredentials extends ProfileDetails {
  password: string;
}

export interface ProfileUpdatePayload extends ProfileDetails {}

export interface ResetPasswordPayload {
  identifier: string;
  newPassword: string;
}

export interface FeatureCard {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  isPremium: boolean;
  premiumColor?: 'green' | 'yellow';
  route?: string;
}

export interface SupportMessage {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  subject: string;
  message: string;
  status: 'new' | 'in_progress' | 'resolved';
  createdAt: string;
  responses?: MessageResponse[];
}

export interface MessageResponse {
  id: string;
  messageId: string;
  fromAdmin: boolean;
  text: string;
  createdAt: string;
}

// Food types (юридически безопасная архитектура)
export type FoodSource = 
  | 'core'             // Базовые продукты (собственная база, видны всем)
  | 'brand'            // Продукты с брендами (собственная база, видны всем)
  | 'user';            // Пользовательский продукт (виден только создателю)

export interface Food {
  id: string;
  name: string; // Русское название (основное отображение)
  name_original?: string; // Оригинальное/английское название
  barcode?: string | null;
  calories: number; // на 100 г
  protein: number;  // на 100 г
  fat: number;      // на 100 г
  carbs: number;    // на 100 г
  category?: string;
  brand?: string | null;
  source: FoodSource; // ОБЯЗАТЕЛЬНОЕ поле для юридической безопасности
  created_by_user_id?: string | null; // ID пользователя, создавшего продукт (для source='user')
  photo?: string | null;
  aliases?: string[]; // синонимы для поиска
  autoFilled?: boolean; // были ли БЖУ автозаполнены
  popularity?: number; // используется для сортировки
  createdAt: string;
  updatedAt: string;
}

// Для обратной совместимости
export interface UserCustomFood extends Omit<Food, 'source' | 'created_by_user_id'> {
  userId: string;
  source: 'user'; // Изменено с 'manual' на 'user'
  created_by_user_id: string; // Обязательно для пользовательских продуктов
}

export interface MealEntry {
  id: string;
  foodId: string;
  food: Food;
  weight: number; // in grams
  calories: number; // calculated: calories_100g * (weight / 100)
  protein: number; // calculated
  fat: number; // calculated
  carbs: number; // calculated
  note?: string | null; // Заметка к продукту в приёме пищи
}

export interface DailyMeals {
  date: string; // YYYY-MM-DD
  breakfast: MealEntry[];
  lunch: MealEntry[];
  dinner: MealEntry[];
  snack: MealEntry[];
  water: number; // glasses
  notes?: {
    breakfast?: string | null;
    lunch?: string | null;
    dinner?: string | null;
    snack?: string | null;
  };
}
