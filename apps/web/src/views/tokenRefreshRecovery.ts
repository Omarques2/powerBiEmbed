export function shouldRecoverVisualAfterTokenRefresh(reason: string): boolean {
  return reason.trim().toLowerCase() === "token-expired";
}

export async function recoverVisualAfterTokenRefresh(
  reason: string,
  recover: () => Promise<void>,
): Promise<void> {
  if (!shouldRecoverVisualAfterTokenRefresh(reason)) return;

  try {
    await recover();
  } catch {
    // best effort only: token renewal must not fail because visual recovery failed
  }
}
