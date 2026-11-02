// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { speechCaptureSupported, useSpeechCapture } from "../../src/client/lib/useSpeechCapture";

/** Minimal fake of the Web Speech API's SpeechRecognition. */
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = "";
  started = 0;
  stopped = 0;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    this.started++;
  }
  stop() {
    this.stopped++;
    this.onend?.();
  }
  abort() {}
  emit(parts: { text: string; final: boolean }[], resultIndex = 0) {
    const results = parts.map((p) => ({ isFinal: p.final, 0: { transcript: p.text } }));
    this.onresult?.({ resultIndex, results });
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeRecognition.instances = [];
});

describe("useSpeechCapture", () => {
  it("reports unsupported without the API", () => {
    expect(speechCaptureSupported()).toBe(false);
    const { result } = renderHook(() => useSpeechCapture());
    expect(result.current.supported).toBe(false);
    act(() => result.current.start()); // no-op, no throw
    expect(result.current.text).toBe("");
  });

  it("collects final results, keeps interim text separate, and restarts after the browser ends early", () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    const { result } = renderHook(() => useSpeechCapture());
    expect(result.current.supported).toBe(true);
    act(() => result.current.start());
    const r = FakeRecognition.instances[0]!;
    expect(r.continuous).toBe(true);
    expect(r.interimResults).toBe(true);
    expect(r.started).toBe(1);
    act(() => r.emit([{ text: "When a measure becomes ", final: true }, { text: "a tar", final: false }]));
    expect(result.current.text).toBe("When a measure becomes");
    expect(result.current.interim).toBe("a tar");
    // The real API sends the cumulative list; resultIndex points at the first changed entry.
    act(() => r.emit([{ text: "When a measure becomes ", final: true }, { text: "a target people game it.", final: true }], 1));
    expect(result.current.text).toBe("When a measure becomes a target people game it.");
    // Browser ends on silence while we're still recording → restarted.
    act(() => r.onend?.());
    expect(r.started).toBe(2);
    act(() => result.current.stop());
    expect(r.started).toBe(2); // not restarted after an explicit stop
  });

  it("marks itself failed on a real error but ignores routine 'no-speech'", () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    const { result } = renderHook(() => useSpeechCapture());
    act(() => result.current.start());
    const r = FakeRecognition.instances[0]!;
    act(() => r.onerror?.({ error: "no-speech" }));
    expect(result.current.failed).toBeNull();
    act(() => r.onerror?.({ error: "not-allowed" }));
    expect(result.current.failed).toBe("not-allowed");
  });
});
