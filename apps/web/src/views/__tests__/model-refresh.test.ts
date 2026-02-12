import { describe, expect, it } from "vitest";
import {
  MODEL_REFRESH_TIMEOUT_MS,
  type ModelRefreshTracker,
  isModelRefreshExpired,
  isModelRefreshFailureStatus,
  isModelRefreshSuccessStatus,
  loadModelRefreshTracker,
  saveModelRefreshTracker,
} from "@/views/modelRefresh";

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe("model refresh tracker storage", () => {
  it("saves and loads a valid tracker", () => {
    const storage = createMemoryStorage();
    const tracker: ModelRefreshTracker = {
      workspaceId: "ws-1",
      reportId: "rp-1",
      startedAt: Date.now(),
      lastStatus: "queued",
    };

    saveModelRefreshTracker(storage, tracker);
    const loaded = loadModelRefreshTracker(storage, Date.now());

    expect(loaded).toEqual(tracker);
  });

  it("clears expired tracker", () => {
    const storage = createMemoryStorage();
    const startedAt = Date.now() - MODEL_REFRESH_TIMEOUT_MS - 1_000;
    saveModelRefreshTracker(storage, {
      workspaceId: "ws-2",
      reportId: "rp-2",
      startedAt,
    });

    const loaded = loadModelRefreshTracker(storage, Date.now());
    expect(loaded).toBeNull();
  });
});

describe("model refresh status helpers", () => {
  it("detects success and failure statuses", () => {
    expect(isModelRefreshSuccessStatus("Succeeded")).toBe(true);
    expect(isModelRefreshSuccessStatus("Completed")).toBe(true);
    expect(isModelRefreshFailureStatus("Failed")).toBe(true);
    expect(isModelRefreshFailureStatus("Cancelled")).toBe(true);
    expect(isModelRefreshFailureStatus("Unknown")).toBe(false);
  });

  it("marks tracker as expired after timeout", () => {
    const now = Date.now();
    const tracker: ModelRefreshTracker = {
      workspaceId: "ws-3",
      reportId: "rp-3",
      startedAt: now - MODEL_REFRESH_TIMEOUT_MS - 1,
    };
    expect(isModelRefreshExpired(tracker, now)).toBe(true);
  });
});
