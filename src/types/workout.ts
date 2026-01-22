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
  canonical_muscle_id?: string | null;
  region?: 'upper' | 'lower' | 'core' | string;
}

export interface Exercise {
  id: string;
  name: string;
  category_id: string;
  description?: string | null;
  is_custom: boolean;
  created_by_user_id?: string | null;
  canonical_exercise_id?: string | null;
  normalized_name?: string | null;
  movement_pattern?: 'push' | 'pull' | 'hinge' | 'squat' | 'carry' | 'rotation' | string;
  equipment_type?: string | null;
  difficulty_level?: string | null;
  is_compound?: boolean;
  energy_system?: 'aerobic' | 'anaerobic' | 'mixed' | string;
  metabolic_equivalent?: number | null;
  aliases?: string[] | null;
  safety_flags?: Record<string, unknown> | null;
  category?: ExerciseCategory;
  muscles?: Muscle[];
}

export interface ExerciseMuscle {
  exercise_id: string;
  muscle_id: string;
  role?: 'prime' | 'secondary' | 'stabilizer' | string;
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
  canonical_exercise_id?: string | null;
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

