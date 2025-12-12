import { Food } from '../types';

// Мини-база для демо-режима анализатора рецептов (20+ продуктов)
export const demoProducts: Array<
  Pick<Food, 'name' | 'calories' | 'protein' | 'fat' | 'carbs' | 'aliases'>
> = [
  { name: 'Говядина постная', calories: 250, protein: 26, fat: 15, carbs: 0, aliases: ['говядина'] },
  { name: 'Куриная грудка', calories: 165, protein: 31, fat: 3.6, carbs: 0, aliases: ['курица', 'филе куриное'] },
  { name: 'Свинина', calories: 270, protein: 20, fat: 21, carbs: 0, aliases: ['свинина'] },
  { name: 'Индейка', calories: 189, protein: 29, fat: 7, carbs: 0, aliases: ['индейка'] },
  { name: 'Рыба белая', calories: 120, protein: 20, fat: 3, carbs: 0, aliases: ['треска', 'минтай'] },
  { name: 'Лосось', calories: 208, protein: 20, fat: 13, carbs: 0, aliases: ['семга'] },
  { name: 'Яйцо куриное', calories: 157, protein: 12.7, fat: 11.5, carbs: 0.7, aliases: ['яйцо', 'яйца'] },
  { name: 'Молоко 3.2%', calories: 60, protein: 3, fat: 3.2, carbs: 4.7, aliases: ['молоко'] },
  { name: 'Сливки 10%', calories: 119, protein: 3, fat: 10, carbs: 4, aliases: ['сливки'] },
  { name: 'Сыр твердый', calories: 350, protein: 25, fat: 27, carbs: 0, aliases: ['сыр'] },
  { name: 'Йогурт натуральный', calories: 60, protein: 3.5, fat: 3, carbs: 5, aliases: ['йогурт'] },
  { name: 'Картофель', calories: 77, protein: 2, fat: 0.4, carbs: 17, aliases: ['картошка', 'картофелин'] },
  { name: 'Морковь', calories: 35, protein: 1, fat: 0.1, carbs: 8, aliases: ['морковка'] },
  { name: 'Лук репчатый', calories: 40, protein: 1.4, fat: 0.1, carbs: 9, aliases: ['лук', 'луковица'] },
  { name: 'Чеснок', calories: 149, protein: 6.4, fat: 0.5, carbs: 33, aliases: ['долька чеснока', 'чеснок'] },
  { name: 'Помидоры', calories: 20, protein: 1, fat: 0.2, carbs: 4, aliases: ['томаты', 'помидор'] },
  { name: 'Огурцы', calories: 15, protein: 0.8, fat: 0.1, carbs: 3, aliases: ['огурец'] },
  { name: 'Банан', calories: 95, protein: 1.5, fat: 0.3, carbs: 21, aliases: ['банан'] },
  { name: 'Яблоко', calories: 47, protein: 0.4, fat: 0.4, carbs: 10, aliases: ['яблоко'] },
  { name: 'Гречка сухая', calories: 313, protein: 12.6, fat: 3.3, carbs: 62, aliases: ['гречневая крупа'] },
  { name: 'Рис сухой', calories: 330, protein: 6.7, fat: 0.7, carbs: 74, aliases: ['рис'] },
  { name: 'Макароны сухие', calories: 350, protein: 12, fat: 1.5, carbs: 70, aliases: ['паста'] },
  { name: 'Мука пшеничная', calories: 334, protein: 10, fat: 1.2, carbs: 70, aliases: ['мука'] },
  { name: 'Сахар', calories: 387, protein: 0, fat: 0, carbs: 100, aliases: ['сахар'] },
  { name: 'Сливочное масло', calories: 748, protein: 0.8, fat: 82, carbs: 0.5, aliases: ['масло сливочное'] },
  { name: 'Подсолнечное масло', calories: 884, protein: 0, fat: 100, carbs: 0, aliases: ['масло растительное'] },
];

