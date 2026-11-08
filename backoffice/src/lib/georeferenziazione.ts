// Georeferenziazione di una cartina con i punti di controllo («spilli»): dal foglio (coordinate dell'SVG)
// alla carta (longitudine, latitudine). Thin plate spline in longitudine e latitudine di Mercatore,
// la stessa della prova prototipo/allinea.html. Usata dalla pagina di allineamento (dal vivo) e dal
// server (generazione della cartina): danno lo stesso risultato.
import type { Punto, Riquadro } from './disegno.ts';

export type Certezza = 'certa' | 'probabile' | 'ipotetica';

export interface Spillo {
  sx: number; // punto del foglio
  sy: number;
  lng: number; // punto del globo
  lat: number;
  certezza: Certezza;
}

// Uno spillo certo tiene il disegno esattamente lì. Uno probabile o ipotetico cede: il suo punto del
// disegno va solo in parte verso il luogo, il resto verso dove lo metterebbero gli altri spilli.
export const CEDE: Record<Certezza, number> = { certa: 0, probabile: 0.35, ipotetica: 0.7 };

const R = Math.PI / 180;
export const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * R) / 2)) / R;
export const daMercY = (y: number) => (2 * Math.atan(Math.exp(y * R)) - Math.PI / 2) / R;
const U = (r2: number) => (r2 > 1e-12 ? (r2 * Math.log(r2)) / 2 : 0); // r² log r

export const km = ([a, b]: Punto, [c, d]: Punto) => {
  const s = Math.sin(((d - b) * R) / 2) ** 2 + Math.cos(b * R) * Math.cos(d * R) * Math.sin(((c - a) * R) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(s));
};

export interface Modello {
  uv: Punto[];
  wx: Float64Array;
  wy: Float64Array;
  n: number;
  origine: Punto; // le coordinate del foglio si normalizzano sulla cornice (la spline non cambia)
  scala: number;
}

function risolvi(A: Float64Array[], colonne: Float64Array[]): Float64Array[] {
  const n = A.length;
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > Math.abs(A[p][k])) p = i;
    [A[k], A[p]] = [A[p], A[k]];
    colonne.forEach((c) => ([c[k], c[p]] = [c[p], c[k]]));
    for (let i = k + 1; i < n; i++) {
      const f = A[i][k] / A[k][k];
      if (!f) continue;
      for (let j = k; j < n; j++) A[i][j] -= f * A[k][j];
      colonne.forEach((c) => (c[i] -= f * c[k]));
    }
  }
  return colonne.map((c) => {
    const x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = c[i];
      for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j];
      x[i] = s / A[i][i];
    }
    return x;
  });
}

export function adatta(punti: Spillo[], cornice: Riquadro, conCertezza = true): Modello | null {
  if (punti.length < 3) return null;
  const origine: Punto = [cornice[0], cornice[1]];
  const scala = cornice[2] - cornice[0] || 1;
  const norm = (x: number, y: number): Punto => [(x - origine[0]) / scala, (y - origine[1]) / scala];
  // dove va il punto di ogni spillo incerto: tra il luogo e la posizione che gli darebbero gli altri
  const mete = punti.map((p, i): Punto => {
    const cede = conCertezza && punti.length >= 4 ? CEDE[p.certezza] ?? 0 : 0;
    if (!cede) return [p.lng, mercY(p.lat)];
    const [lng, lat] = trasforma(adatta(punti.filter((_, k) => k !== i), cornice, false)!, p.sx, p.sy);
    return [p.lng + (lng - p.lng) * cede, mercY(p.lat) + (mercY(lat) - mercY(p.lat)) * cede];
  });
  const n = punti.length, N = n + 3, uv = punti.map((p) => norm(p.sx, p.sy));
  const A = Array.from({ length: N }, () => new Float64Array(N));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) A[i][j] = U((uv[i][0] - uv[j][0]) ** 2 + (uv[i][1] - uv[j][1]) ** 2);
    A[i][n] = A[n][i] = 1;
    A[i][n + 1] = A[n + 1][i] = uv[i][0];
    A[i][n + 2] = A[n + 2][i] = uv[i][1];
  }
  const bx = new Float64Array(N), by = new Float64Array(N);
  mete.forEach(([X, Y], i) => { bx[i] = X; by[i] = Y; });
  const [wx, wy] = risolvi(A, [bx, by]);
  return { uv, wx, wy, n, origine, scala };
}

export function trasforma(m: Modello, x: number, y: number): Punto {
  const u = (x - m.origine[0]) / m.scala, v = (y - m.origine[1]) / m.scala;
  const { uv, wx, wy, n } = m;
  let X = wx[n] + wx[n + 1] * u + wx[n + 2] * v, Y = wy[n] + wy[n + 1] * u + wy[n + 2] * v;
  for (let i = 0; i < n; i++) {
    const k = U((u - uv[i][0]) ** 2 + (v - uv[i][1]) ** 2);
    X += wx[i] * k;
    Y += wy[i] * k;
  }
  return [X, daMercY(Y)];
}

// Dal globo al foglio: il punto del disegno che ora si vede lì (per agganciare uno spillo nuovo)
export function inversa(m: Modello, lng: number, lat: number, partenza: Punto): Punto {
  let [x, y] = partenza;
  for (let k = 0; k < 30; k++) {
    const [X, Y] = trasforma(m, x, y), h = 0.5;
    const [Xx, Yx] = trasforma(m, x + h, y), [Xy, Yy] = trasforma(m, x, y + h);
    const a = (Xx - X) / h, b = (Xy - X) / h, c = (Yx - Y) / h, d = (Yy - Y) / h, det = a * d - b * c;
    const ex = lng - X, ey = lat - Y;
    x += (d * ex - b * ey) / det;
    y += (-c * ex + a * ey) / det;
    if (Math.abs(ex) + Math.abs(ey) < 1e-7) break;
  }
  return [x, y];
}

// Scarto di ogni spillo: si toglie lo spillo, si rifà la deformazione con gli altri e si guarda dove
// finisce il suo punto del disegno. La distanza dal luogo è quanto il disegno, lì, si discosta dal vero.
export function scarti(punti: Spillo[], cornice: Riquadro): (number | null)[] {
  if (punti.length < 4) return punti.map(() => null);
  return punti.map((p, i) => km(trasforma(adatta(punti.filter((_, k) => k !== i), cornice, false)!, p.sx, p.sy), [p.lng, p.lat]));
}

// Ritaglio sulla cornice, nelle coordinate del foglio (Sutherland-Hodgman per i poligoni)
export function ritagliaPoligono(anello: Punto[], [x0, y0, x1, y1]: Riquadro): Punto[] {
  const taglia = (a: Punto, b: Punto, asse: 0 | 1, valore: number): Punto => {
    const t = (valore - a[asse]) / (b[asse] - a[asse]);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  const lati: [(p: Punto) => boolean, (a: Punto, b: Punto) => Punto][] = [
    [(p) => p[0] >= x0, (a, b) => taglia(a, b, 0, x0)], [(p) => p[0] <= x1, (a, b) => taglia(a, b, 0, x1)],
    [(p) => p[1] >= y0, (a, b) => taglia(a, b, 1, y0)], [(p) => p[1] <= y1, (a, b) => taglia(a, b, 1, y1)],
  ];
  let uscita = anello;
  for (const [dentro, incrocio] of lati) {
    const entrata = uscita;
    uscita = [];
    for (let i = 0; i < entrata.length; i++) {
      const a = entrata[i], b = entrata[(i + 1) % entrata.length];
      if (dentro(b)) { if (!dentro(a)) uscita.push(incrocio(a, b)); uscita.push(b); }
      else if (dentro(a)) uscita.push(incrocio(a, b));
    }
    if (!uscita.length) break;
  }
  return uscita;
}

export function ritagliaLinea(linea: Punto[], [x0, y0, x1, y1]: Riquadro): Punto[][] {
  const dentro = (p: Punto) => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
  const pezzi: Punto[][] = [];
  let pezzo: Punto[] = [];
  for (const p of linea) {
    if (dentro(p)) pezzo.push(p);
    else { if (pezzo.length > 1) pezzi.push(pezzo); pezzo = []; }
  }
  if (pezzo.length > 1) pezzi.push(pezzo);
  return pezzi;
}
