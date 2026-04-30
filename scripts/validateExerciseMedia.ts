import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { exerciseContentMap } from '../src/data/exerciseContent';

type ValidationStatus = 'OK' | 'Missing' | 'Path mismatch' | 'Bad filename';

function buildExpectedPublicPath(category: string, exerciseId: string) {
  return path.resolve(process.cwd(), 'public', 'exercises', category, `${exerciseId}.png`);
}

function buildExpectedTechniqueImageUrl(category: string, exerciseId: string) {
  return `/exercises/${category}/${exerciseId}.png`;
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

  const messages: Array<{ status: ValidationStatus; details: string }> = [];

  if (techniqueImageUrl !== expectedTechniqueImageUrl) {
    messages.push({
      status: 'Path mismatch',
      details: `${techniqueImageUrl} -> expected ${expectedTechniqueImageUrl}`,
    });
  }

  if (!fs.existsSync(expectedPublicPath)) {
    messages.push({
      status: 'Missing',
      details: expectedPublicPath,
    });
  } else if (hasBadFilename(expectedPublicPath)) {
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

  for (const exercise of entries) {
    const results = getStatusMessages(
      exercise.category,
      exercise.exercise_id,
      exercise.technique_image_url,
    );

    for (const result of results) {
      const icon = result.status === 'OK' ? '✅' : '⚠️';
      console.log(
        `${icon} ${result.status}: ${exercise.exercise_id} (${exercise.category}) — ${result.details}`,
      );
    }
  }
}

main();
