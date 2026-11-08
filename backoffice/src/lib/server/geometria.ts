// Operazioni geometriche sulla carta (longitudine, latitudine) con jsts, il port JavaScript di JTS: la
// stessa base di shapely, usato prima dall'importatore Python. Unioni, differenze, ritaglio sulle terre
// emerse di Natural Earth, semplificazione, buffer per l'alone.
import 'jsts/org/locationtech/jts/monkey.js';
import BufferOp from 'jsts/org/locationtech/jts/operation/buffer/BufferOp.js';
import GeoJSONReader from 'jsts/org/locationtech/jts/io/GeoJSONReader.js';
import GeoJSONWriter from 'jsts/org/locationtech/jts/io/GeoJSONWriter.js';
import TopologyPreservingSimplifier from 'jsts/org/locationtech/jts/simplify/TopologyPreservingSimplifier.js';
import type { Geometria } from 'jsts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Punto } from '../disegno.ts';

const lettore = new GeoJSONReader();
const scrittore = new GeoJSONWriter();

export type { Geometria };
export const geometria = (g: { type: string; coordinates: unknown }): Geometria => valida(lettore.read(g));

// Una forma ricavata da un disegno può incrociarsi su sé stessa: il buffer nullo la ripara.
export const valida = (g: Geometria) => (g.isValid() ? g : g.buffer(0));

export function poligono(anello: Punto[]): Geometria | null {
  if (anello.length < 3) return null;
  const chiuso = anello[0][0] === anello.at(-1)![0] && anello[0][1] === anello.at(-1)![1] ? anello : [...anello, anello[0]];
  if (chiuso.length < 4) return null;
  return geometria({ type: 'Polygon', coordinates: [chiuso] });
}

export function unione(geometrie: Geometria[]): Geometria | null {
  const valide = geometrie.filter((g) => !g.isEmpty());
  if (!valide.length) return null;
  return valide.reduce((a, b) => a.union(b));
}

export const semplifica = (g: Geometria, tolleranza: number) => TopologyPreservingSimplifier.simplify(g, tolleranza);
export const buffer = (g: Geometria, distanza: number, segmenti = 8) => BufferOp.bufferOp(g, distanza, segmenti);

// GeoJSON con le coordinate arrotondate (4 decimali: circa 10 metri)
export function inGeoJSON(g: Geometria, decimali = 4): { type: string; coordinates: unknown } {
  const f = 10 ** decimali;
  const arrotonda = (x: unknown): unknown => (typeof x === 'number' ? Math.round(x * f) / f : Array.isArray(x) ? x.map(arrotonda) : x);
  const scritta = scrittore.write(g);
  return { type: scritta.type, coordinates: arrotonda(scritta.coordinates) };
}

// Il poligono più grande di una geometria (per l'alone: un solo buco, senza isolette)
export function piuGrande(g: Geometria): Geometria {
  let migliore = g.getGeometryN(0);
  for (let i = 1; i < g.getNumGeometries(); i++) if (g.getGeometryN(i).getArea() > migliore.getArea()) migliore = g.getGeometryN(i);
  return migliore;
}

// --- Terre emerse ------------------------------------------------------------------------------------

// Natural Earth 10m, la stessa usata dagli script Python (cartella di cache di strumenti/): se manca, si scarica.
const CACHE = fileURLToPath(new URL('../../../../strumenti/natural_earth/ne_10m_land.geojson', import.meta.url));
const SORGENTE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson';

let terre: { type: string; coordinates: unknown }[] | null = null;
async function leggiTerre() {
  if (terre) return terre;
  let testo: string;
  try {
    testo = await readFile(CACHE, 'utf8');
  } catch {
    const risposta = await fetch(SORGENTE);
    if (!risposta.ok) throw new Error(`Non riesco a scaricare le terre emerse di Natural Earth (${risposta.status}).`);
    testo = await risposta.text();
    await mkdir(dirname(CACHE), { recursive: true });
    await writeFile(join(CACHE), testo);
  }
  terre = (JSON.parse(testo) as { features: { geometry: { type: string; coordinates: unknown } }[] }).features.map((f) => f.geometry);
  return terre;
}

// Le terre emerse dentro un riquadro [ovest, sud, est, nord]
export async function terreEmerse([o, s, e, n]: [number, number, number, number]): Promise<Geometria> {
  const zona = geometria({ type: 'Polygon', coordinates: [[[o, s], [e, s], [e, n], [o, n], [o, s]]] });
  const pezzi: Geometria[] = [];
  for (const g of await leggiTerre()) {
    // le terre sono poligoni o multipoligoni: si guarda prima il riquadro di ogni parte
    const parti = g.type === 'MultiPolygon' ? (g.coordinates as unknown[]).map((c) => ({ type: 'Polygon', coordinates: c })) : [g];
    for (const p of parti) {
      const anello = (p.coordinates as Punto[][])[0];
      let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const [x, y] of anello) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      if (x1 < o || x0 > e || y1 < s || y0 > n) continue;
      const parte = geometria(p).intersection(zona);
      if (!parte.isEmpty()) pezzi.push(parte);
    }
  }
  return unione(pezzi) ?? zona.difference(zona);
}
