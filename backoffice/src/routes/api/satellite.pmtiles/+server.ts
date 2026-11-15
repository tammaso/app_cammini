// Il satellite del portale (bmng/bmng.pmtiles, NASA Blue Marble) per le mappe del backoffice: scheda del luogo,
// tappa, Allinea, Ritocca. MapLibre legge il file a pezzi (richieste Range), quindi si risponde con il pezzo chiesto.
// Ricreata il 2026-11-15: la cartella si chiama satellite.pmtiles e la regola «*.pmtiles» del .gitignore la escludeva,
// quindi non era mai arrivata su GitHub (ora c'è un'eccezione nel .gitignore).
import { error } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import type { RequestHandler } from './$types';

const FILE = fileURLToPath(new URL('../../../../../bmng/bmng.pmtiles', import.meta.url));
const INTESTAZIONI = { 'Content-Type': 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'max-age=86400' };

export const GET: RequestHandler = async ({ request }) => {
  const dimensione = await stat(FILE).then((s) => s.size, () => null);
  if (dimensione === null) error(404, 'Manca bmng/bmng.pmtiles: vedi bmng/LEGGIMI.md.');

  const m = request.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (m[1] === '' && m[2] === '')) {
    const flusso = Readable.toWeb(createReadStream(FILE)) as ReadableStream;
    return new Response(flusso, { headers: { ...INTESTAZIONI, 'Content-Length': String(dimensione) } });
  }
  // «bytes=100-199», «bytes=100-» (fino alla fine) o «bytes=-500» (gli ultimi 500)
  const inizio = m[1] === '' ? Math.max(0, dimensione - Number(m[2])) : Number(m[1]);
  const fine = m[1] === '' || m[2] === '' ? dimensione - 1 : Math.min(Number(m[2]), dimensione - 1);
  if (inizio > fine) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${dimensione}` } });

  const file = await open(FILE, 'r');
  try {
    const pezzo = Buffer.alloc(fine - inizio + 1);
    await file.read(pezzo, 0, pezzo.length, inizio);
    return new Response(pezzo, {
      status: 206,
      headers: { ...INTESTAZIONI, 'Content-Range': `bytes ${inizio}-${fine}/${dimensione}`, 'Content-Length': String(pezzo.length) },
    });
  } finally {
    await file.close();
  }
};
