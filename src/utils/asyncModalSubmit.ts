export interface AsyncSubmitLock {
  current: boolean;
}

export async function submitModalAction(
  lock: AsyncSubmitLock,
  action: () => Promise<void> | void,
  onSuccess: () => void
): Promise<boolean> {
  if (lock.current) return false;

  lock.current = true;
  try {
    await action();
    onSuccess();
    return true;
  } finally {
    lock.current = false;
  }
}
