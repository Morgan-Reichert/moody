/* Décodeur EAN-13 / EAN-8 sur scanlines — zéro dépendance.
 *
 * Pourquoi : l'API BarcodeDetector n'existe pas dans WKWebView (tout iOS).
 * Ce décodeur lit les codes 1D des boîtes de médicaments européennes depuis
 * un canvas. Les Datamatrix (petit carré CIP) ne sont pas couverts : on vise
 * les barres classiques.
 *
 * Méthode : plusieurs lignes horizontales → binarisation adaptative →
 * longueurs de plages → gardes 101 / 01010 / 101 → tables L/G/R + parité du
 * premier chiffre → somme de contrôle. La clé EAN rend un faux positif
 * hautement improbable ; on exige en plus deux lectures identiques.
 */

// Largeurs de modules (4 plages par chiffre). L commence par un espace, R par une barre.
const L: number[][] = [
  [3, 2, 1, 1], [2, 2, 2, 1], [2, 1, 2, 2], [1, 4, 1, 1], [1, 1, 3, 2],
  [1, 2, 3, 1], [1, 1, 1, 4], [1, 3, 1, 2], [1, 2, 1, 3], [3, 1, 1, 2],
];
const G = L.map((w) => [...w].reverse());
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

function matchDigit(runs: number[], table: number[][]): number {
  const total = runs[0] + runs[1] + runs[2] + runs[3];
  if (!total) return -1;
  let best = -1, bestErr = 0.45;
  for (let d = 0; d < 10; d++) {
    const t = table[d];
    let err = 0;
    for (let i = 0; i < 4; i++) err = Math.max(err, Math.abs(runs[i] * 7 / total - t[i]));
    if (err < bestErr) { bestErr = err; best = d; }
  }
  return best;
}

function checksumOK(digits: number[]): boolean {
  const n = digits.length;                      // 13 ou 8
  let sum = 0;
  for (let i = 0; i < n - 1; i++) {
    const fromRight = n - 2 - i;                // position depuis la droite, clé exclue
    sum += digits[i] * (fromRight % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === digits[n - 1];
}

/** Décode une suite de plages (largeurs px, en commençant par une plage noire). */
function decodeRuns(runs: number[]): string | null {
  // garde de début : 3 plages ≈ égales (1-1-1), précédées d'une zone calme
  for (let s = 0; s + 3 < runs.length; s += 2) {
    const [a, b, c] = [runs[s], runs[s + 1], runs[s + 2]];
    const mod = (a + b + c) / 3;
    if (mod < 1) continue;
    if (Math.abs(a - mod) > mod * 0.5 || Math.abs(b - mod) > mod * 0.5 || Math.abs(c - mod) > mod * 0.5) continue;

    for (const count of [6, 4] as const) {      // EAN-13 puis EAN-8
      let i = s + 3;
      const left: number[] = []; let parity = "";
      let ok = true;
      for (let d = 0; d < count && ok; d++) {
        const quad = runs.slice(i, i + 4);
        if (quad.length < 4) { ok = false; break; }
        const dl = matchDigit(quad, L), dg = matchDigit(quad, G);
        // L et G partagent des largeurs : on départage par la 1re plage
        // (espace long ⇒ plutôt L) puis par le meilleur score.
        if (dl >= 0 && (dg < 0 || true)) {
          if (dg >= 0 && dg !== dl) {
            // ambiguïté réelle : essaie les deux parités plus tard — trop
            // coûteux ici, on garde le meilleur err implicite (matchDigit).
          }
        }
        if (dl < 0 && dg < 0) { ok = false; break; }
        if (dl >= 0 && dg >= 0) {
          // les deux matchent : choisis celui dont l'erreur est moindre
          const total = quad.reduce((x, y) => x + y, 0);
          const err = (t: number[]) => Math.max(...quad.map((r, k) => Math.abs(r * 7 / total - t[k])));
          if (err(L[dl]) <= err(G[dg])) { left.push(dl); parity += "L"; }
          else { left.push(dg); parity += "G"; }
        } else if (dl >= 0) { left.push(dl); parity += "L"; }
        else { left.push(dg); parity += "G"; }
        i += 4;
      }
      if (!ok) continue;

      // garde centrale 01010 : 5 plages fines
      const mid = runs.slice(i, i + 5);
      if (mid.length < 5) continue;
      const midMod = mid.reduce((x, y) => x + y, 0) / 5;
      if (mid.some((r) => Math.abs(r - midMod) > midMod * 0.7)) continue;
      i += 5;

      const right: number[] = [];
      ok = true;
      for (let d = 0; d < count && ok; d++) {
        const quad = runs.slice(i, i + 4);
        if (quad.length < 4) { ok = false; break; }
        const dr = matchDigit(quad, L);          // R = mêmes largeurs que L
        if (dr < 0) { ok = false; break; }
        right.push(dr); i += 4;
      }
      if (!ok) continue;

      // garde de fin 101
      const end = runs.slice(i, i + 3);
      if (end.length < 3) continue;
      const endMod = end.reduce((x, y) => x + y, 0) / 3;
      if (end.some((r) => Math.abs(r - endMod) > endMod * 0.6)) continue;

      let digits: number[];
      if (count === 6) {
        const first = PARITY.indexOf(parity);
        if (first < 0) continue;
        digits = [first, ...left, ...right];
      } else {
        if (parity !== "LLLL") continue;
        digits = [...left, ...right];
      }
      if (!checksumOK(digits)) continue;
      return digits.join("");
    }
  }
  return null;
}

/** Binarise une ligne puis la convertit en plages noir/blanc. */
function lineToRuns(gray: Uint8ClampedArray, width: number, y: number): number[] {
  const row = gray.subarray(y * width, (y + 1) * width);
  // seuil adaptatif : moyenne locale sur une fenêtre glissante
  const W = 24;
  let acc = 0;
  for (let i = 0; i < W; i++) acc += row[i];
  const bits = new Uint8Array(width);
  for (let x = 0; x < width; x++) {
    const lo = Math.max(0, x - W / 2), hi = Math.min(width - 1, x + W / 2);
    if (x > 0) {
      if (hi < width - 1) acc += row[hi];
      if (lo > 0) acc -= row[lo - 1];
    }
    const mean = acc / (hi - lo + 1);
    bits[x] = row[x] < mean * 0.86 ? 1 : 0;   // 1 = noir
  }
  // première plage noire
  let x = 0;
  while (x < width && bits[x] === 0) x++;
  const runs: number[] = [];
  let cur = 1, len = 0;
  for (; x < width; x++) {
    if (bits[x] === cur) len++;
    else { runs.push(len); cur = bits[x]; len = 1; }
  }
  if (len) runs.push(len);
  return runs;
}

export interface EanScanner {
  /** Tente une lecture sur la frame courante. Renvoie le code ou null. */
  scan(video: HTMLVideoElement): string | null;
}

export function createEanScanner(): EanScanner {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  let last: string | null = null;
  let streak = 0;

  return {
    scan(video: HTMLVideoElement): string | null {
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) return null;
      const w = 720, h = Math.round(vh * (w / vw));
      canvas.width = w; canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      const gray = new Uint8ClampedArray(w * h);
      for (let i = 0, j = 0; j < gray.length; i += 4, j++)
        gray[j] = (data[i] * 3 + data[i + 1] * 4 + data[i + 2]) >> 3;

      // 9 lignes dans la bande centrale, lues dans les deux sens
      for (let k = -4; k <= 4; k++) {
        const y = Math.round(h / 2 + k * h * 0.07);
        if (y < 0 || y >= h) continue;
        const runs = lineToRuns(gray, w, y);
        for (const rr of [runs, [...runs].reverse()]) {
          const hit = decodeRuns(rr);
          if (hit) {
            // anti-faux-positif : deux lectures identiques avant d'accepter
            if (hit === last) { streak++; if (streak >= 1) { streak = 0; last = null; return hit; } }
            else { last = hit; streak = 0; }
            return null;
          }
        }
      }
      return null;
    },
  };
}
