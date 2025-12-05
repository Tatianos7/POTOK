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

// Food types
export type FoodSource = 'local' | 'api' | 'custom' | 'openfoodfacts';

export interface Food {
  id: string;
  name: string;
  name_ru?: string; // Russian name
  name_en?: string; // English name
  brand: string | null;
  calories: number; // per 100g
  protein: number; // per 100g
  fat: number; // per 100g
  carbs: number; // per 100g
  barcode: string | null;
  image: string | null;
  source: FoodSource;
  category?: string;
  aliases?: string[]; // Alternative names for search
  serving_size?: number; // Typical serving size in grams
  createdAt: string;
  updatedAt: string;
}

export interface UserCustomFood extends Omit<Food, 'source'> {
  userId: string;
  source: 'custom';
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
}

export interface DailyMeals {
  date: string; // YYYY-MM-DD
  breakfast: MealEntry[];
  lunch: MealEntry[];
  dinner: MealEntry[];
  snack: MealEntry[];
  water: number; // glasses
}
