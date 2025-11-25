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
  route: string;
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
