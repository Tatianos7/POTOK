import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import xlsx from 'xlsx';

type ExcelExerciseRow = {
  exercise_id?: string;
  exercise_name?: string;
  name?: string;
  category?: string;
  primary_muscles?: string;
  secondary_muscles?: string;
  aliases?: string;
  start_position?: string;
  execution?: string;
  top_position?: string;
  return_phase?: string;
  mistakes?: string;
  breathing?: string;
  safety?: string;
};

type ExerciseContent = {
  exercise_id: string;
  exercise_name: string;
  aliases?: string[];
  category: string;
  technique_image_url: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  start_position?: string;
  execution?: string;
  top_position?: string;
  return_phase?: string;
  mistakes?: string[];
  breathing?: string;
  safety?: string;
};

const DEFAULT_WORKBOOK_PATH = '/Users/urijurij/Desktop/Контент база упражнений.xlsx';
const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/exerciseContent.ts');

const CATEGORY_SLUG_MAP: Record<string, string> = {
  плечи: 'shoulders',
  руки: 'arms',
  грудь: 'chest',
  спина: 'back',
  ноги: 'legs',
  ягодицы: 'glutes',
  кардио: 'cardio',
  пресс: 'abs',
};

function normalizeInlineText(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMultilineText(value: unknown): string | undefined {
  const normalized = String(value ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

  return normalized || undefined;
}

function splitList(value: unknown, separator: string | RegExp): string[] {
  const normalized = String(value ?? '').trim();
  if (!normalized) return [];

  return normalized
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCategory(category: string): string {
  const normalized = normalizeInlineText(category).toLowerCase();
  return CATEGORY_SLUG_MAP[normalized] ?? normalized.replace(/\s+/g, '_');
}

function mapRowToExerciseContent(row: ExcelExerciseRow): ExerciseContent | null {
  const exerciseId = normalizeInlineText(row.exercise_id);
  const exerciseName = normalizeInlineText(row.exercise_name || row.name);

  if (!exerciseId || !exerciseName) {
    return null;
  }

  const category = normalizeCategory(String(row.category ?? ''));
  const aliases = splitList(row.aliases, ';');
  const startPosition = normalizeMultilineText(row.start_position);
  const execution = normalizeMultilineText(row.execution);
  const topPosition = normalizeMultilineText(row.top_position);
  const returnPhase = normalizeMultilineText(row.return_phase);
  const breathing = normalizeMultilineText(row.breathing);
  const safety = normalizeMultilineText(row.safety);

  const content: ExerciseContent = {
    exercise_id: exerciseId,
    exercise_name: exerciseName,
    category,
    technique_image_url: `/exercises/${category}/${exerciseId}.png`,
    primary_muscles: splitList(row.primary_muscles, ','),
    secondary_muscles: splitList(row.secondary_muscles, ','),
  };

  if (aliases.length > 0) {
    content.aliases = aliases;
  }

  if (startPosition) {
    content.start_position = startPosition;
  }

  if (execution) {
    content.execution = execution;
  }

  if (topPosition) {
    content.top_position = topPosition;
  }

  if (returnPhase) {
    content.return_phase = returnPhase;
  }

  const mistakes = splitList(row.mistakes, ';');
  if (mistakes.length > 0) {
    content.mistakes = mistakes;
  }

  if (breathing) {
    content.breathing = breathing;
  }

  if (safety) {
    content.safety = safety;
  }

  return content;
}

function buildFileContent(items: ExerciseContent[]): string {
  const contentMap = Object.fromEntries(items.map((item) => [item.exercise_id, item]));
  const serializedMap = JSON.stringify(contentMap, null, 2);

  return `export type ExerciseContent = {
  exercise_id: string;
  exercise_name: string;
  aliases?: string[];
  category: string;
  technique_image_url: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  start_position?: string;
  execution?: string;
  top_position?: string;
  return_phase?: string;
  mistakes?: string[];
  breathing?: string;
  safety?: string;
};

export const exerciseContentMap: Record<string, ExerciseContent> = ${serializedMap};
`;
}

function main() {
  const workbookPath = path.resolve(process.cwd(), process.argv[2] ?? DEFAULT_WORKBOOK_PATH);

  if (!fs.existsSync(workbookPath)) {
    throw new Error(`Excel file not found: ${workbookPath}`);
  }

  const workbook = xlsx.readFile(workbookPath);
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('Excel workbook does not contain any sheets');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = xlsx.utils.sheet_to_json<ExcelExerciseRow>(sheet, { defval: '' });
  const items = rows
    .map(mapRowToExerciseContent)
    .filter((item): item is ExerciseContent => item !== null);

  const fileContent = buildFileContent(items);
  fs.writeFileSync(OUTPUT_PATH, fileContent, 'utf8');

  console.log(`Generated ${items.length} exercises from ${workbookPath}`);
  console.log(`Updated ${OUTPUT_PATH}`);
}

main();
