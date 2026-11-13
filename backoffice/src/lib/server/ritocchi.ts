// Ritocchi a mano di una cartina già generata (pagina «Ritocca»): spostare e modificare i nomi, riportarli
// dove li mette il disegno, spostare le tappe. Le aree non cambiano: dipendono solo dagli spilli.
// Un nome importato che si sposta o si modifica diventa «modificato» e la generazione non lo ricrea
// (vedi importazione-svg.ts); i nomi «disegnati» (aggiunti nel backoffice) si possono anche eliminare.
import type { DatabaseSync } from 'node:sqlite';
import type { CategoriaNome } from '../disegno.ts';
import { aggiornaLuogo, leggiLuogo, usiDelLuogo } from './luoghi.ts';
import { adesso } from './moduli.ts';
import { registraModifica } from './registro.ts';

export type Origine = 'importato' | 'disegnato' | 'modificato';

export interface NomeRitoccabile {
  id: number;
  categoria: CategoriaNome;
  testo: string;
  sotto: string | null;
  lng: number;
  lat: number;
  zoom: number;
  angolo: number | null;
  colore: string | null;
  corpo: number | null;
  sempre: boolean;
  origine: Origine;
  luogoId: number | null;
  luogo: string | null; // nome del luogo dell'anagrafe (città e vette)
}

export interface TappaRitoccabile {
  id: number;
  numero: number;
  nome: string;
  breve: string;
  luogoId: number;
  luogo: string;
  lng: number;
  lat: number;
  tracciato: [number, number][] | null;
  altriUsi: string[]; // dove altro è usato il luogo della tappa (altre tappe, nomi delle cartine): spostandolo si sposta anche lì
}

const comeNome = (r: Record<string, unknown>): NomeRitoccabile => ({
  id: Number(r.id), categoria: String(r.categoria) as CategoriaNome, testo: String(r.testo), sotto: r.sotto == null ? null : String(r.sotto),
  lng: Number(r.lng), lat: Number(r.lat), zoom: Number(r.zoom), angolo: r.angolo == null ? null : Number(r.angolo),
  colore: r.colore == null ? null : String(r.colore), corpo: r.corpo == null ? null : Number(r.corpo), sempre: r.sempre === 1,
  origine: String(r.origine) as Origine, luogoId: r.luogo_id == null ? null : Number(r.luogo_id), luogo: r.luogo == null ? null : String(r.luogo),
});

export function leggiNomi(db: DatabaseSync, cartinaId: number): NomeRitoccabile[] {
  return db.prepare(`SELECT n.*, l.nome AS luogo FROM nomi n LEFT JOIN luoghi l ON l.id = n.luogo_id
    WHERE n.cartina_id = ? ORDER BY n.posizione, n.id`).all(cartinaId).map(comeNome);
}

export function leggiTappe(db: DatabaseSync, camminoId: number): TappaRitoccabile[] {
  return db.prepare(`SELECT t.id, t.posizione, t.nome, t.breve, t.luogo_id, t.tracciato, l.nome AS luogo, l.lng, l.lat
    FROM tappe t JOIN luoghi l ON l.id = t.luogo_id WHERE t.cammino_id = ? ORDER BY t.posizione`).all(camminoId).map((r) => ({
    id: Number(r.id), numero: Number(r.posizione) + 1, nome: String(r.nome), breve: String(r.breve), luogoId: Number(r.luogo_id),
    luogo: String(r.luogo), lng: Number(r.lng), lat: Number(r.lat),
    tracciato: r.tracciato == null ? null : (JSON.parse(String(r.tracciato)) as [number, number][]),
    // gli spilli hanno coordinate proprie e non si spostano con il luogo (per questo le aree restano ferme)
    altriUsi: usiDelLuogo(db, Number(r.luogo_id)).map((u) => u.dove)
      .filter((d) => !d.startsWith(`Tappa ${Number(r.posizione) + 1} di`) && !d.startsWith('Punto di controllo')),
  }));
}

function nomeDellaCartina(db: DatabaseSync, cartinaId: number, id: number): NomeRitoccabile {
  const r = db.prepare('SELECT n.*, NULL AS luogo FROM nomi n WHERE n.id = ? AND n.cartina_id = ?').get(id, cartinaId);
  if (!r) throw new Error('Nome non trovato in questa cartina.');
  return comeNome(r);
}

function annota(db: DatabaseSync, cartinaId: number, descrizione: string, datiPrecedenti?: unknown): void {
  const k = db.prepare('SELECT cammino_id, pulsante FROM cartine WHERE id = ?').get(cartinaId)!;
  db.prepare('UPDATE cammini SET modificato_il = ? WHERE id = ?').run(adesso(), Number(k.cammino_id));
  registraModifica(db, {
    azione: 'modifica', oggetto: 'cartina', oggettoId: cartinaId, camminoId: Number(k.cammino_id), titolo: String(k.pulsante), descrizione,
    ...(datiPrecedenti === undefined ? {} : { datiPrecedenti }),
  });
}

const coordinate = (lng: number, lat: number) => {
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) throw new Error('Posizione non valida.');
  return [Math.round(lng * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4] as const;
};
const testoBreve = (t: string) => t.replace(/\n/g, ' ');

// Un nome spostato sulla carta. Un nome importato diventa «modificato»: la generazione non lo ricrea.
export function spostaNome(db: DatabaseSync, cartinaId: number, id: number, lng: number, lat: number): void {
  const n = nomeDellaCartina(db, cartinaId, id);
  const [x, y] = coordinate(lng, lat);
  db.prepare("UPDATE nomi SET lng = ?, lat = ?, origine = CASE origine WHEN 'importato' THEN 'modificato' ELSE origine END WHERE id = ?").run(x, y, id);
  annota(db, cartinaId, `Nome «${testoBreve(n.testo)}» spostato a mano`, { lng: n.lng, lat: n.lat });
}

export interface DatiNome {
  testo: string;
  sotto: string | null;
  colore: string | null;
  corpo: number | null;
  sempre: boolean;
  angolo: number | null;
  zoom: number;
}

export function validaNome(modulo: FormData): { ok: true; dati: DatiNome } | { ok: false; errore: string } {
  const testo = String(modulo.get('testo') ?? '').replace(/\r/g, '').trim();
  const sotto = String(modulo.get('sotto') ?? '').replace(/\r/g, '').trim() || null;
  const colore = String(modulo.get('colore') ?? '').trim().toLowerCase() || null;
  const numero = (k: string) => { const v = String(modulo.get(k) ?? '').trim().replace(',', '.'); return v === '' ? null : Number(v); };
  const corpo = numero('corpo'), angolo = numero('angolo'), zoom = numero('zoom');
  if (!testo) return { ok: false, errore: 'Il testo del nome non può essere vuoto.' };
  if (colore && !/^#[0-9a-f]{6}$/.test(colore)) return { ok: false, errore: 'Colore come #1f5fbf.' };
  if (corpo !== null && !(corpo >= 6 && corpo <= 60)) return { ok: false, errore: 'Corpo in pixel, tra 6 e 60 (vuoto: quello della categoria).' };
  if (angolo !== null && !(angolo >= -180 && angolo <= 180)) return { ok: false, errore: 'Inclinazione in gradi, tra -180 e 180 (vuota: orizzontale).' };
  if (zoom === null || !(zoom >= 0 && zoom <= 10)) return { ok: false, errore: 'Zoom di comparsa tra 0 e 10.' };
  return { ok: true, dati: { testo, sotto, colore, corpo, sempre: modulo.get('sempre') === 'on', angolo: angolo === 0 ? null : angolo, zoom } };
}

export function modificaNome(db: DatabaseSync, cartinaId: number, id: number, d: DatiNome): void {
  const n = nomeDellaCartina(db, cartinaId, id);
  db.prepare(`UPDATE nomi SET testo = ?, sotto = ?, colore = ?, corpo = ?, sempre = ?, angolo = ?, zoom = ?,
      origine = CASE origine WHEN 'importato' THEN 'modificato' ELSE origine END WHERE id = ?`)
    .run(d.testo, d.sotto, d.colore, d.corpo, d.sempre ? 1 : 0, d.angolo, d.zoom, id);
  annota(db, cartinaId, `Nome «${testoBreve(n.testo)}» modificato a mano`, n);
}

// Il nome torna com'è nel disegno: ridiventa «importato» e la generazione (che chiama la pagina) lo ricrea
// dal disegno, al suo posto nell'ordine dei nomi (che conta quando due nomi si contendono lo spazio).
export function ripristinaNome(db: DatabaseSync, cartinaId: number, id: number): void {
  const n = nomeDellaCartina(db, cartinaId, id);
  if (n.origine !== 'modificato') throw new Error('Il nome non è stato ritoccato: è già come nel disegno.');
  db.prepare("UPDATE nomi SET origine = 'importato' WHERE id = ?").run(id);
  annota(db, cartinaId, `Nome «${testoBreve(n.testo)}» riportato com'è nel disegno`, n);
}

// Solo i nomi aggiunti nel backoffice: quelli del disegno tornerebbero alla generazione successiva.
export function eliminaNome(db: DatabaseSync, cartinaId: number, id: number): void {
  const n = nomeDellaCartina(db, cartinaId, id);
  if (n.origine !== 'disegnato') throw new Error('Si possono eliminare solo i nomi aggiunti nel backoffice; per quelli del disegno, nella classificazione scegli «Niente».');
  db.prepare('DELETE FROM nomi WHERE id = ?').run(id);
  annota(db, cartinaId, `Nome «${testoBreve(n.testo)}» eliminato`, n);
}

// Il luogo dell'anagrafe di una città o di una vetta va dove ora sta il suo nome (correzione del luogo).
export function luogoDalNome(db: DatabaseSync, cartinaId: number, id: number): void {
  const n = nomeDellaCartina(db, cartinaId, id);
  if (n.luogoId == null) throw new Error('Questo nome non è legato a un luogo dell\'anagrafe.');
  const l = leggiLuogo(db, n.luogoId)!;
  const esito = aggiornaLuogo(db, l.id, { ...l, lng: n.lng, lat: n.lat });
  if (!esito.ok) throw new Error(Object.values(esito.errori).join(' '));
}

// Una tappa spostata: si sposta il suo luogo nell'anagrafe (le coordinate delle tappe vengono da lì); i
// tratti del cammino si riagganciano alla generazione successiva (che chiama la pagina).
export function spostaTappa(db: DatabaseSync, camminoId: number, tappaId: number, lng: number, lat: number): string {
  const t = db.prepare('SELECT luogo_id, nome FROM tappe WHERE id = ? AND cammino_id = ?').get(tappaId, camminoId);
  if (!t) throw new Error('Tappa non trovata in questo cammino.');
  const [x, y] = coordinate(lng, lat);
  const l = leggiLuogo(db, Number(t.luogo_id))!;
  const esito = aggiornaLuogo(db, l.id, { ...l, lng: x, lat: y });
  if (!esito.ok) throw new Error(Object.values(esito.errori).join(' '));
  return String(t.nome);
}

