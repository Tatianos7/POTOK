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

export function openWorkoutEntryNoteComposer(
  entryId: string,
  notesById: Record<string, string>,
): { activeNoteEntryId: string; draft: string } {
  return {
    activeNoteEntryId: entryId,
    draft: notesById[entryId] ?? '',
  };
}

export function cancelWorkoutEntryNoteComposer(): {
  activeNoteEntryId: null;
  draft: string;
} {
  return {
    activeNoteEntryId: null,
    draft: '',
  };
}

export function applySavedWorkoutEntryNote(
  entryId: string,
  note: string,
  currentNotesById: Record<string, string>,
  currentExpandedEntryIds: Iterable<string>,
): {
  notesById: Record<string, string>;
  expandedEntryIds: Set<string>;
  activeNoteEntryId: null;
  draft: string;
} {
  const nextExpanded = new Set(currentExpandedEntryIds);
  nextExpanded.add(entryId);

  return {
    notesById: {
      ...currentNotesById,
      [entryId]: note,
    },
    expandedEntryIds: nextExpanded,
    activeNoteEntryId: null,
    draft: '',
  };
}

export function applyDeletedWorkoutEntryNote(
  entryId: string,
  currentNotesById: Record<string, string>,
  currentExpandedEntryIds: Iterable<string>,
): {
  notesById: Record<string, string>;
  expandedEntryIds: Set<string>;
} {
  const nextNotesById = { ...currentNotesById };
  delete nextNotesById[entryId];

  const nextExpanded = new Set(currentExpandedEntryIds);
  nextExpanded.delete(entryId);

  return {
    notesById: nextNotesById,
    expandedEntryIds: nextExpanded,
  };
}

export function toggleWorkoutEntryNoteExpanded(
  entryId: string,
  currentExpandedEntryIds: Iterable<string>,
): Set<string> {
  const nextExpanded = new Set(currentExpandedEntryIds);
  if (nextExpanded.has(entryId)) {
    nextExpanded.delete(entryId);
  } else {
    nextExpanded.add(entryId);
  }
  return nextExpanded;
}
