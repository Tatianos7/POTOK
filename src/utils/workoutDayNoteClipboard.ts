export interface ClipboardLike {
  writeText: (text: string) => Promise<void>;
}

export async function copyWorkoutDayNoteText(
  note: string,
  clipboard?: ClipboardLike | null,
): Promise<boolean> {
  const trimmedNote = note.trim();
  if (!trimmedNote) return false;

  const clipboardApi =
    clipboard ??
    (typeof navigator !== 'undefined' && navigator.clipboard ? navigator.clipboard : null);

  if (!clipboardApi) return false;

  try {
    await clipboardApi.writeText(trimmedNote);
    return true;
  } catch {
    return false;
  }
}
