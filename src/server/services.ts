import type { Config } from "./config";
import { ClaudeCoach, sdkTransport, type MessageTransport } from "./coach/claude";
import { DemoCoach } from "./coach/demo";
import type { CoachProvider } from "./coach/types";
import { ContentService } from "./content/service";
import type { ContentProvider } from "./content/types";
import { WikimediaProvider } from "./content/wikimedia";
import { Deduper } from "./dedupe";
import { FileStore, type KeyValueStore } from "./store";
import { DeepgramProvider, type TranscriptionProvider } from "./transcription/deepgram";
import { UsageMeter } from "./usage";
import type { AppDeps } from "./app";

export interface ServiceOverrides {
  store?: KeyValueStore;
  transport?: MessageTransport;
  contentProvider?: ContentProvider | null;
  transcription?: TranscriptionProvider | null;
  now?: () => Date;
}

/** Wire providers from configuration. Live providers are used only when credentials exist. */
export function createServices(cfg: Config, o: ServiceOverrides = {}): AppDeps {
  const store = o.store ?? new FileStore(cfg.dataDir);
  const usage = new UsageMeter(store, cfg, o.now);
  const dedupe = new Deduper();
  let coach: CoachProvider;
  if (o.transport || cfg.claude.apiKey) {
    coach = new ClaudeCoach(cfg, o.transport ?? sdkTransport(cfg.claude.apiKey!), usage);
  } else {
    coach = new DemoCoach();
  }
  const provider = o.contentProvider !== undefined ? o.contentProvider : cfg.content.live === "wikimedia" ? new WikimediaProvider(cfg.content.userAgent) : null;
  const content = new ContentService(cfg, store, coach, provider, dedupe, o.now);
  const transcription =
    o.transcription !== undefined
      ? o.transcription
      : cfg.transcription.deepgramApiKey
        ? new DeepgramProvider(cfg.transcription.deepgramApiKey, cfg.transcription.model, cfg.transcription.timeoutMs)
        : null;
  return { cfg, coach, content, transcription, usage, dedupe };
}
