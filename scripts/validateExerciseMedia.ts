import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { exerciseContentMap } from '../src/data/exerciseContent';

type ValidationStatus = 'OK' | 'Missing' | 'Path mismatch' | 'Bad filename' | 'Duplicate exercise_id' | 'Category mismatch';
const OPTIONAL_IMAGE_CATEGORIES = new Set(['cardio']);

function buildExpectedPublicPath(category: string, exerciseId: string) {
  return path.resolve(process.cwd(), 'public', 'exercises', category, `${exerciseId}.png`);
}

function buildExpectedTechniqueImageUrl(category: string, exerciseId: string) {
  return `/exercises/${category}/${exerciseId}.png`;
}

function getCategoryFromTechniqueImageUrl(techniqueImageUrl: string) {
  const match = techniqueImageUrl.match(/^\/exercises\/([^/]+)\/[^/]+\.png$/);
  return match?.[1] ?? null;
}

function hasBadFilename(filePath: string) {
  const fileName = path.basename(filePath);

  return (
    fileName !== fileName.trim()
    || /\s/.test(fileName)
    || path.extname(fileName) !== '.png'
    || fileName.toLowerCase() !== fileName
  );
}

function getStatusMessages(category: string, exerciseId: string, techniqueImageUrl: string) {
  const expectedTechniqueImageUrl = buildExpectedTechniqueImageUrl(category, exerciseId);
  const expectedPublicPath = buildExpectedPublicPath(category, exerciseId);
  const normalizedTechniqueImageUrl = String(techniqueImageUrl ?? '').trim();
  const isOptionalCategory = OPTIONAL_IMAGE_CATEGORIES.has(category);
  const optionalCategoryWithoutImage = isOptionalCategory && !normalizedTechniqueImageUrl;

  const messages: Array<{ status: ValidationStatus; details: string }> = [];

  if (!optionalCategoryWithoutImage && normalizedTechniqueImageUrl !== expectedTechniqueImageUrl) {
    messages.push({
      status: 'Path mismatch',
      details: `${normalizedTechniqueImageUrl} -> expected ${expectedTechniqueImageUrl}`,
    });
  }

  const techniqueImageCategory = getCategoryFromTechniqueImageUrl(normalizedTechniqueImageUrl);
  if (techniqueImageCategory && techniqueImageCategory !== category) {
    messages.push({
      status: 'Category mismatch',
      details: `${techniqueImageCategory} -> expected ${category}`,
    });
  }

  if (!fs.existsSync(expectedPublicPath) && !optionalCategoryWithoutImage) {
    messages.push({
      status: 'Missing',
      details: expectedPublicPath,
    });
  } else if (fs.existsSync(expectedPublicPath) && hasBadFilename(expectedPublicPath)) {
    messages.push({
      status: 'Bad filename',
      details: path.basename(expectedPublicPath),
    });
  }

  if (messages.length === 0) {
    messages.push({
      status: 'OK',
      details: expectedTechniqueImageUrl,
    });
  }

  return messages;
}

function main() {
  const entries = Object.values(exerciseContentMap).sort((a, b) => a.exercise_id.localeCompare(b.exercise_id));
  const exerciseIdCounts = new Map<string, number>();
  let hasError = false;

  for (const exercise of entries) {
    exerciseIdCounts.set(exercise.exercise_id, (exerciseIdCounts.get(exercise.exercise_id) ?? 0) + 1);
  }

  for (const exercise of entries) {
    const duplicateCount = exerciseIdCounts.get(exercise.exercise_id) ?? 0;
    if (duplicateCount > 1) {
      hasError = true;
      console.log(
        `⚠️ Duplicate exercise_id: ${exercise.exercise_id} (${exercise.category}) — found ${duplicateCount} entries`,
      );
    }

    const results = getStatusMessages(
      exercise.category,
      exercise.exercise_id,
      exercise.technique_image_url,
    );

    for (const result of results) {
      const icon = result.status === 'OK' ? '✅' : '⚠️';
      if (result.status !== 'OK') {
        hasError = true;
      }
      console.log(
        `${icon} ${result.status}: ${exercise.exercise_id} (${exercise.category}) — ${result.details}`,
      );
    }
  }

  if (hasError) {
    process.exitCode = 1;
  }
}

main();
