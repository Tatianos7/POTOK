/**
 * Типы для системы тренировок и упражнений
 */

export interface ExerciseCategory {
  id: string;
  name: string;
  order: number;
}

export interface Muscle {
  id: string;
  name: string;
}

export interface Exercise {
  id: string;
  name: string;
  category_id: string;
  description?: string | null;
  is_custom: boolean;
  created_by_user_id?: string | null;
  category?: ExerciseCategory;
  muscles?: Muscle[];
}

export interface ExerciseMuscle {
  exercise_id: string;
  muscle_id: string;
  exercise?: Exercise;
  muscle?: Muscle;
}

export interface WorkoutDay {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  created_at?: string;
  updated_at?: string;
}

export interface WorkoutEntry {
  id: string;
  workout_day_id: string;
  exercise_id: string;
  sets: number;
  reps: number;
  weight: number;
  created_at?: string;
  updated_at?: string;
  exercise?: Exercise;
  workout_day?: WorkoutDay;
}

export interface SelectedExercise {
  exercise: Exercise;
  sets: number;
  reps: number;
  weight: number;
}

export interface CreateExerciseData {
  name: string;
  category_id: string;
  description?: string;
  muscle_ids: string[];
}

