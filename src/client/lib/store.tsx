import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppStatus } from "../../shared/types";
import { api, setAccessToken } from "./api";
import { audioStore } from "./audioStore";
import { clearData, loadData, saveData, type AppData, emptyData } from "./storage";

interface Ctx {
  data: AppData;
  update: (fn: (d: AppData) => AppData) => void;
  deleteAll: () => Promise<void>;
  status: AppStatus | null;
  statusError: string | null;
  refreshStatus: () => void;
  saveFailed: boolean;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children, initial }: { children: ReactNode; initial?: AppData }) {
  const [data, setData] = useState<AppData>(() => initial ?? loadData());
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    setAccessToken(data.prefs.accessToken);
  }, [data.prefs.accessToken]);

  useEffect(() => {
    if (first.current && initial) {
      first.current = false;
      return;
    }
    first.current = false;
    setSaveFailed(!saveData(data));
  }, [data, initial]);

  const refreshStatus = useCallback(() => {
    api
      .status()
      .then((s) => {
        setStatus(s);
        setStatusError(null);
      })
      .catch((e: Error) => setStatusError(e.message));
  }, []);

  useEffect(() => refreshStatus(), [refreshStatus]);

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), []);

  const deleteAll = useCallback(async () => {
    clearData();
    try {
      await audioStore.clear();
    } catch {
      /* IndexedDB unavailable: nothing stored there */
    }
    setData((d) => ({ ...emptyData(), prefs: { ...emptyData().prefs, accessToken: d.prefs.accessToken } }));
  }, []);

  const value = useMemo(() => ({ data, update, deleteAll, status, statusError, refreshStatus, saveFailed }), [data, update, deleteAll, status, statusError, refreshStatus, saveFailed]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}
