export function buildWorkoutEntryNotesById(
  entryIds: string[],
  notesById: Record<string, string>,
): Record<string, string> {
  const allowedIds = new Set(entryIds);
  const next: Record<string, string> = {};

  Object.entries(notesById).forEach(([entryId, text]) => {
    if (!allowedIds.has(entryId)) return;
    if (typeof text !== 'string' || text.trim().length === 0) return;
    next[entryId] = text;
  });

  return next;
}

export function pruneWorkoutEntryNoteSet(
  entryIds: string[],
  currentIds: Iterable<string>,
): Set<string> {
  const allowedIds = new Set(entryIds);
  return new Set(Array.from(currentIds).filter((entryId) => allowedIds.has(entryId)));
}
