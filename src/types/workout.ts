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

export interface ExerciseMediaItem {
  type: 'image' | 'video';
  url: string;
  order: number;
}

export type WorkoutMetricType = 'weight' | 'bodyweight' | 'time' | 'distance' | 'none';
export type WorkoutMetricUnit = 'кг' | 'св. вес' | 'сек' | 'мин' | 'м' | 'км' | null;

export interface Exercise {
  id: string;
  name: string;
  category_id: string;
  description?: string | null;
  mistakes?: string | null;
  primary_muscles?: string[] | null;
  secondary_muscles?: string[] | null;
  muscle_map_image_url?: string | null;
  media?: ExerciseMediaItem[] | null;
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

export interface WorkoutHistoryDaySummary {
  workout_day_id: string;
  date: string;
  exercise_count: number;
  total_sets: number;
  total_volume: number;
}

export interface WorkoutProgressObservation {
  exerciseGroupKey: string;
  exerciseId: string;
  exerciseName: string;
  date: string;
  entryId: string;
  createdAt?: string;
  sets: number;
  reps: number;
  weight: number;
}

export type WorkoutProgressMetricTrend = 'up' | 'down' | 'return' | 'neutral';

export interface WorkoutProgressRow {
  exerciseGroupKey: string;
  exerciseName: string;
  latestSets: number;
  latestReps: number;
  latestWeight: number;
  setsTrend: WorkoutProgressMetricTrend;
  repsTrend: WorkoutProgressMetricTrend;
  weightTrend: WorkoutProgressMetricTrend;
  lastDate: string;
}

export interface UserExerciseMedia {
  id: string;
  user_id: string;
  exercise_id: string;
  workout_entry_id?: string | null;
  workout_date?: string | null;
  file_path: string;
  file_type: 'image' | 'video';
  created_at: string;
}

export interface WorkoutEntry {
  id: string;
  workout_day_id: string;
  exercise_id: string;
  canonical_exercise_id?: string | null;
  metricType?: WorkoutMetricType;
  metricUnit?: WorkoutMetricUnit;
  sets: number;
  reps: number;
  weight: number;
  baseUnit?: string; // базовая единица (например, кг)
  displayUnit?: string; // отображаемая единица (например, кг)
  displayAmount?: number; // отображаемое значение веса
  idempotencyKey?: string; // ключ для dedup/upsert
  created_at?: string;
  updated_at?: string;
  exercise?: Exercise;
  workout_day?: WorkoutDay;
}

export interface SelectedExercise {
  exercise: Exercise;
  metricType?: WorkoutMetricType;
  metricUnit?: WorkoutMetricUnit;
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
