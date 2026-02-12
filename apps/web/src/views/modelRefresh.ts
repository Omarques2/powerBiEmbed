export const MODEL_REFRESH_STORAGE_KEY = "shell:model-refresh:v1";
export const MODEL_REFRESH_TIMEOUT_MS = 15 * 60 * 1000;

export type ModelRefreshTracker = {
  workspaceId: string;
  reportId: string;
  startedAt: number;
  lastStatus?: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidTracker(value: unknown): value is ModelRefreshTracker {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ModelRefreshTracker>;
  return (
    isNonEmptyString(candidate.workspaceId) &&
    isNonEmptyString(candidate.reportId) &&
    typeof candidate.startedAt === "number" &&
    Number.isFinite(candidate.startedAt) &&
    candidate.startedAt > 0
  );
}

export function isModelRefreshSuccessStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized.includes("succeeded") || normalized.includes("completed");
}

export function isModelRefreshFailureStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return (
    normalized.includes("failed") ||
    normalized.includes("error") ||
    normalized.includes("cancelled") ||
    normalized.includes("timeout")
  );
}

export function isModelRefreshExpired(
  tracker: ModelRefreshTracker,
  now = Date.now(),
  timeoutMs = MODEL_REFRESH_TIMEOUT_MS,
): boolean {
  return now - tracker.startedAt >= timeoutMs;
}

export function saveModelRefreshTracker(
  storage: Storage,
  tracker: ModelRefreshTracker | null,
  key = MODEL_REFRESH_STORAGE_KEY,
): void {
  if (!tracker) {
    storage.removeItem(key);
    return;
  }
  storage.setItem(key, JSON.stringify(tracker));
}

export function loadModelRefreshTracker(
  storage: Storage,
  now = Date.now(),
  key = MODEL_REFRESH_STORAGE_KEY,
  timeoutMs = MODEL_REFRESH_TIMEOUT_MS,
): ModelRefreshTracker | null {
  const raw = storage.getItem(key);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValidTracker(parsed)) {
      storage.removeItem(key);
      return null;
    }

    if (isModelRefreshExpired(parsed, now, timeoutMs)) {
      storage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    storage.removeItem(key);
    return null;
  }
}
