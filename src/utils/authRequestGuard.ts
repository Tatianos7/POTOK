/** Invalidates in-flight auth work even when an account switches A -> B -> A. */
export function createAuthRequestGuard() {
  let revision = 0;
  return {
    begin() {
      const current = ++revision;
      return () => current === revision;
    },
    capture() {
      const current = revision;
      return () => current === revision;
    },
    invalidate() {
      revision += 1;
    },
  };
}
