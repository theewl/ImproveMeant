/** Calendar-day key (YYYY-MM-DD) in the device's local time zone. Use this for "today", never UTC slices. */
export function localDayKey(d: Date | string = new Date()): string {
  const x = typeof d === "string" ? new Date(d) : d;
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${m}-${day}`;
}
