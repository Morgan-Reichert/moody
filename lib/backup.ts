// Export / import all local Moody data (localStorage). Files/documents (IndexedDB) are not included.

export function exportData(): void {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("moody_")) data[k] = localStorage.getItem(k)!;
  }
  const payload = { app: "moody", version: 1, exportedAt: new Date().toISOString(), data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `moody-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function importData(file: File): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const data = parsed?.data;
    if (parsed?.app !== "moody" || !data || typeof data !== "object") return { ok: false, count: 0, error: "Fichier de sauvegarde Moody invalide." };
    let count = 0;
    for (const [k, v] of Object.entries(data)) {
      if (k.startsWith("moody_") && typeof v === "string") { localStorage.setItem(k, v); count++; }
    }
    return { ok: true, count };
  } catch (e: any) {
    return { ok: false, count: 0, error: "Impossible de lire le fichier." };
  }
}
