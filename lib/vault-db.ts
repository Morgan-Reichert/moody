// Medical documents (prescriptions, certificates…) stored as blobs in IndexedDB.

export type DocType = "ordonnance" | "certificat" | "analyse" | "autre";
export interface DocMeta {
  id: string; createdAt: number;
  type: DocType; title: string; date?: string;
  doctorId?: string; mime: string; filename: string;
  expiryDate?: string;      // YYYY-MM-DD (péremption / à renouveler avant)
  prescriber?: string;      // nom détecté du médecin
  notifyExpiry?: boolean;   // notifier à l'approche de la péremption
}
interface DocRecord extends DocMeta { blob: Blob; }

const DB = "moody-vault";
const STORE = "docs";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const tx = (db: IDBDatabase, mode: IDBTransactionMode) => db.transaction(STORE, mode).objectStore(STORE);

export async function saveDoc(rec: Omit<DocRecord, "id" | "createdAt">): Promise<DocMeta> {
  const db = await open();
  const full: DocRecord = { ...rec, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now() };
  await new Promise<void>((res, rej) => { const r = tx(db, "readwrite").put(full); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
  const { blob, ...meta } = full; return meta;
}
export async function listDocs(): Promise<DocMeta[]> {
  const db = await open();
  const all = await new Promise<DocRecord[]>((res, rej) => { const r = tx(db, "readonly").getAll(); r.onsuccess = () => res(r.result as DocRecord[]); r.onerror = () => rej(r.error); });
  return all.map(({ blob, ...m }) => m).sort((a, b) => b.createdAt - a.createdAt);
}
export async function getDocBlob(id: string): Promise<{ blob: Blob; meta: DocMeta } | null> {
  const db = await open();
  const rec = await new Promise<DocRecord | undefined>((res, rej) => { const r = tx(db, "readonly").get(id); r.onsuccess = () => res(r.result as DocRecord); r.onerror = () => rej(r.error); });
  if (!rec) return null; const { blob, ...meta } = rec; return { blob, meta };
}
export async function updateDocMeta(id: string, patch: Partial<DocMeta>): Promise<void> {
  const db = await open();
  const rec = await new Promise<DocRecord | undefined>((res, rej) => { const r = tx(db, "readonly").get(id); r.onsuccess = () => res(r.result as DocRecord); r.onerror = () => rej(r.error); });
  if (!rec) return;
  const next = { ...rec, ...patch, id: rec.id, createdAt: rec.createdAt, blob: rec.blob };
  await new Promise<void>((res, rej) => { const r = tx(db, "readwrite").put(next); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
}

export async function deleteDoc(id: string): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => { const r = tx(db, "readwrite").delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
}

/** Docs flagged for expiry notification (loaded for the reminder engine). */
export async function expiringDocs(): Promise<DocMeta[]> {
  return (await listDocs()).filter((d) => d.notifyExpiry && d.expiryDate);
}
export function openBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
