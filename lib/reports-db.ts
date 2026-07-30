// Stored PDF reports (IndexedDB — handles binary blobs cleanly, no quota drama).

export interface ReportMeta {
  id: string;
  createdAt: number;
  kind: "perso" | "therapeute";
  period: number;
  name: string;
}
interface ReportRecord extends ReportMeta { blob: Blob; }

const DB = "moody";
const STORE = "reports";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx(db: IDBDatabase, mode: IDBTransactionMode) { return db.transaction(STORE, mode).objectStore(STORE); }

export async function saveReport(rec: Omit<ReportRecord, "id" | "createdAt">): Promise<ReportMeta> {
  const db = await open();
  const full: ReportRecord = { ...rec, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now() };
  await new Promise<void>((res, rej) => { const r = tx(db, "readwrite").put(full); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
  const { blob, ...meta } = full;
  return meta;
}

export async function listReports(): Promise<ReportMeta[]> {
  const db = await open();
  const all = await new Promise<ReportRecord[]>((res, rej) => { const r = tx(db, "readonly").getAll(); r.onsuccess = () => res(r.result as ReportRecord[]); r.onerror = () => rej(r.error); });
  return all.map(({ blob, ...m }) => m).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getReportBlob(id: string): Promise<Blob | null> {
  const db = await open();
  const rec = await new Promise<ReportRecord | undefined>((res, rej) => { const r = tx(db, "readonly").get(id); r.onsuccess = () => res(r.result as ReportRecord); r.onerror = () => rej(r.error); });
  return rec?.blob ?? null;
}

export async function deleteReport(id: string): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => { const r = tx(db, "readwrite").delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Native share sheet with the PDF file (includes Print/AirPrint on iOS). Falls back to opening the PDF. */
export async function shareBlob(blob: Blob, filename: string): Promise<void> {
  try {
    const file = new File([blob], filename, { type: "application/pdf" });
    const nav = navigator as Navigator & { canShare?: (d: any) => boolean };
    if (nav.canShare && nav.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "Rapport Moody" } as ShareData);
      return;
    }
  } catch { /* cancelled or unsupported */ }
  openReportBlob(blob);
}

export function openReportBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
