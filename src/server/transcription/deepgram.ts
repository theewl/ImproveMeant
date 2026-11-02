import type { DeliveryMetrics } from "../../shared/types";
import { deliveryFromWordTimings } from "../../shared/observations";
import { AppError } from "../errors";

// Deepgram pre-recorded transcription adapter.
// POST https://api.deepgram.com/v1/listen with raw audio bytes, header
// "Authorization: Token <key>". mip_opt_out=true asks Deepgram not to retain
// the request for model improvement. Response path:
// results.channels[0].alternatives[0].{transcript, words[{word,start,end}]}.
// Based on Deepgram's public docs (see docs/research); not live-verified from the dev container.

export interface TranscriptionResult {
  transcript: string;
  delivery: DeliveryMetrics;
  provider: string;
}

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(audio: Uint8Array, contentType: string, recordingSeconds: number): Promise<TranscriptionResult>;
}

interface DeepgramResponse {
  results?: { channels?: { alternatives?: { transcript?: string; words?: { word: string; start: number; end: number }[] }[] }[] };
}

export class DeepgramProvider implements TranscriptionProvider {
  readonly name = "deepgram";
  constructor(
    private apiKey: string,
    private model: string,
    private timeoutMs: number,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async transcribe(audio: Uint8Array, contentType: string, recordingSeconds: number): Promise<TranscriptionResult> {
    const qs = new URLSearchParams({ model: this.model, smart_format: "true", punctuate: "true", mip_opt_out: "true" });
    let res: Response;
    try {
      res = await this.fetchImpl(`https://api.deepgram.com/v1/listen?${qs}`, {
        method: "POST",
        headers: { Authorization: `Token ${this.apiKey}`, "Content-Type": contentType },
        body: audio as unknown as BodyInit,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const timeout = (err as Error).name === "TimeoutError";
      throw new AppError(timeout ? "provider_timeout" : "provider_error", timeout ? "Transcription timed out." : "Couldn't reach the transcription service.", 503, true);
    }
    if (res.status === 401 || res.status === 403) {
      throw new AppError("provider_error", "The transcription service rejected the server's credentials.", 502, false);
    }
    if (res.status === 400 || res.status === 415) {
      throw new AppError("provider_error", "The transcription service couldn't read this audio format.", 502, false);
    }
    if (!res.ok) throw new AppError("provider_error", `Transcription failed (HTTP ${res.status}).`, 502, true);
    const data = (await res.json()) as DeepgramResponse;
    const alt = data.results?.channels?.[0]?.alternatives?.[0];
    const transcript = (alt?.transcript ?? "").trim();
    if (!transcript) {
      throw new AppError("empty_response", "No speech was recognised in this recording. Try again closer to the microphone, or type your answer.", 422, true);
    }
    return { transcript, delivery: deliveryFromWordTimings(alt?.words ?? [], recordingSeconds), provider: this.name };
  }
}
