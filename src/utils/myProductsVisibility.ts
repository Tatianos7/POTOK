import type { Food } from '../types';

export const filterVisibleUserFoods = (foods: Food[], userId: string): Food[] =>
  foods.filter((food) => food.source === 'user' && food.created_by_user_id === userId);
