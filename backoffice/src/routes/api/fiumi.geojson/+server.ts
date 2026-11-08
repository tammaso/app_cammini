import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { RequestHandler } from './$types';

// I fiumi di Natural Earth del portale, per confrontarli con quelli disegnati nella pagina di allineamento
const FILE = fileURLToPath(new URL('../../../../../prototipo/dati/fiumi.geojson', import.meta.url));

export const GET: RequestHandler = async () =>
  new Response(await readFile(FILE), { headers: { 'Content-Type': 'application/geo+json', 'Cache-Control': 'max-age=3600' } });
