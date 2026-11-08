// Anagrafe dei luoghi: tappe, città e vette delle cartine, punti di controllo.
// Un luogo usato non si elimina: prima lo si toglie da dove è usato.
import type { DatabaseSync } from 'node:sqlite';
import { CERTEZZE, TIPI_LUOGO, type Certezza, type Errori, type Luogo, type LuogoInElenco, type TipoLuogo, type UsoLuogo } from '../cammini.ts';
import type { EsitoModulo } from './cammini.ts';
import { facoltativo, numero, valoriDi } from './moduli.ts';
import { registraModifica } from './registro.ts';

const opz = (valore: unknown) => (valore == null ? null : String(valore));

const comeLuogo = (r: Record<string, unknown>): Luogo => ({
  id: Number(r.id), nome: String(r.nome), nomeAntico: opz(r.nome_antico), nomeAttuale: opz(r.nome_attuale),
  altriNomi: JSON.parse(String(r.altri_nomi)), lat: Number(r.lat), lng: Number(r.lng), tipo: String(r.tipo) as TipoLuogo,
  certezza: String(r.certezza) as Certezza, nota: opz(r.nota),
});

const CONTEGGIO_USI = `((SELECT count(*) FROM tappe u WHERE u.luogo_id = l.id) + (SELECT count(*) FROM nomi u WHERE u.luogo_id = l.id)
  + (SELECT count(*) FROM punti_controllo u WHERE u.luogo_id = l.id))`;

export function elencaLuoghi(db: DatabaseSync, ricerca = ''): LuogoInElenco[] {
  const simile = `%${ricerca.replace(/[\\%_]/g, '\\$&')}%`;
  return db.prepare(`SELECT l.*, ${CONTEGGIO_USI} AS usi FROM luoghi l
      WHERE ?1 = '' OR l.nome LIKE ?2 ESCAPE '\\' OR l.nome_antico LIKE ?2 ESCAPE '\\' OR l.nome_attuale LIKE ?2 ESCAPE '\\'
        OR l.altri_nomi LIKE ?2 ESCAPE '\\'
      ORDER BY l.nome COLLATE NOCASE`)
    .all(ricerca, simile).map((r) => ({ ...comeLuogo(r), usi: Number(r.usi) }));
}

export function leggiLuogo(db: DatabaseSync, id: number): Luogo | undefined {
  const r = db.prepare('SELECT * FROM luoghi WHERE id = ?').get(id);
  return r ? comeLuogo(r) : undefined;
}

export function usiDelLuogo(db: DatabaseSync, id: number): UsoLuogo[] {
  const tappe = db.prepare(`SELECT t.id, t.posizione, t.cammino_id, c.titolo FROM tappe t JOIN cammini c ON c.id = t.cammino_id
    WHERE t.luogo_id = ? ORDER BY c.titolo, t.posizione`).all(id)
    .map((r) => ({ dove: `Tappa ${Number(r.posizione) + 1} di «${r.titolo}»`, href: `/cammini/${r.cammino_id}/tappe/${r.id}` }));
  const cartine = db.prepare(`SELECT k.id, k.pulsante, c.titolo, 'nome' AS cosa FROM nomi n JOIN cartine k ON k.id = n.cartina_id
      JOIN cammini c ON c.id = k.cammino_id WHERE n.luogo_id = ?1
    UNION ALL SELECT k.id, k.pulsante, c.titolo, 'punto' FROM punti_controllo p JOIN cartine k ON k.id = p.cartina_id
      JOIN cammini c ON c.id = k.cammino_id WHERE p.luogo_id = ?1`).all(id)
    .map((r) => ({
      dove: `${r.cosa === 'nome' ? 'Nome' : 'Punto di controllo'} sulla cartina ${r.pulsante} di «${r.titolo}»`,
      href: `/cartine/${r.id}`,
    }));
  return [...tappe, ...cartine];
}

const CAMPI_LUOGO = ['nome', 'nomeAntico', 'nomeAttuale', 'altriNomi', 'lat', 'lng', 'tipo', 'certezza', 'nota'] as const;
export type CampoLuogo = (typeof CAMPI_LUOGO)[number];
export type DatiLuogo = Omit<Luogo, 'id'>;

export function validaLuogo(modulo: FormData): EsitoModulo<DatiLuogo, CampoLuogo> {
  const valori = valoriDi(modulo, CAMPI_LUOGO);
  const errori: Errori<CampoLuogo> = {};
  if (!valori.nome) errori.nome = 'Il nome è obbligatorio.';
  // Si accettano anche le coordinate incollate insieme da Google Maps nel campo della latitudine:
  // «31.7780, 35.2354».
  let lat = numero(modulo, 'lat');
  let lng = numero(modulo, 'lng');
  const coppia = valori.lat.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coppia && !valori.lng) { lat = Number(coppia[1]); lng = Number(coppia[2]); }
  if (lat === null || Math.abs(lat) > 90) errori.lat = 'Latitudine in gradi decimali, tra -90 e 90 (per esempio 31.778).';
  if (lng === null || Math.abs(lng) > 180) errori.lng = 'Longitudine in gradi decimali, tra -180 e 180 (per esempio 35.235).';
  if (!(valori.tipo in TIPI_LUOGO)) errori.tipo = 'Scegli il tipo.';
  if (!CERTEZZE.includes(valori.certezza as Certezza)) errori.certezza = 'Scegli la certezza.';
  if (Object.keys(errori).length) return { ok: false, errori, valori };
  return {
    ok: true,
    dati: {
      nome: valori.nome, nomeAntico: facoltativo(modulo, 'nomeAntico'), nomeAttuale: facoltativo(modulo, 'nomeAttuale'),
      altriNomi: valori.altriNomi.split(',').map((s) => s.trim()).filter(Boolean), lat: lat!, lng: lng!,
      tipo: valori.tipo as TipoLuogo, certezza: valori.certezza as Certezza, nota: facoltativo(modulo, 'nota'),
    },
  };
}

const nomeGiaUsato = (db: DatabaseSync, nome: string, id: number | null) =>
  Boolean(db.prepare('SELECT 1 FROM luoghi WHERE nome = ? COLLATE NOCASE AND id IS NOT ?').get(nome, id));

export function creaLuogo(db: DatabaseSync, d: DatiLuogo): { ok: true; id: number } | { ok: false; errori: Errori<CampoLuogo> } {
  if (nomeGiaUsato(db, d.nome, null)) return { ok: false, errori: { nome: "C'è già un luogo con questo nome." } };
  const { lastInsertRowid } = db.prepare(`INSERT INTO luoghi (nome, nome_antico, nome_attuale, altri_nomi, lat, lng, tipo, certezza, nota)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(d.nome, d.nomeAntico, d.nomeAttuale, JSON.stringify(d.altriNomi), d.lat, d.lng, d.tipo, d.certezza, d.nota);
  const id = Number(lastInsertRowid);
  registraModifica(db, { azione: 'creazione', oggetto: 'luogo', oggettoId: id, titolo: d.nome, descrizione: "Luogo aggiunto all'anagrafe" });
  return { ok: true, id };
}

export function aggiornaLuogo(db: DatabaseSync, id: number, d: DatiLuogo): { ok: true } | { ok: false; errori: Errori<CampoLuogo> } {
  if (nomeGiaUsato(db, d.nome, id)) return { ok: false, errori: { nome: "C'è già un luogo con questo nome." } };
  const prima = leggiLuogo(db, id)!;
  db.prepare(`UPDATE luoghi SET nome = ?, nome_antico = ?, nome_attuale = ?, altri_nomi = ?, lat = ?, lng = ?, tipo = ?, certezza = ?,
      nota = ? WHERE id = ?`)
    .run(d.nome, d.nomeAntico, d.nomeAttuale, JSON.stringify(d.altriNomi), d.lat, d.lng, d.tipo, d.certezza, d.nota, id);
  const spostato = prima.lat !== d.lat || prima.lng !== d.lng;
  registraModifica(db, {
    azione: 'modifica', oggetto: 'luogo', oggettoId: id, titolo: d.nome,
    descrizione: spostato ? `Luogo spostato (prima ${prima.lat}, ${prima.lng})` : 'Dati del luogo modificati',
  });
  return { ok: true };
}

export function eliminaLuogo(db: DatabaseSync, id: number): { ok: true } | { ok: false; messaggio: string } {
  const luogo = leggiLuogo(db, id);
  if (!luogo) return { ok: true };
  const usi = usiDelLuogo(db, id);
  if (usi.length) return { ok: false, messaggio: `Il luogo è usato (${usi.length === 1 ? usi[0].dove : `${usi.length} volte`}): toglilo da lì prima di eliminarlo.` };
  db.prepare('DELETE FROM luoghi WHERE id = ?').run(id);
  registraModifica(db, { azione: 'eliminazione', oggetto: 'luogo', oggettoId: id, titolo: luogo.nome, descrizione: "Luogo eliminato dall'anagrafe", datiPrecedenti: luogo });
  return { ok: true };
}
