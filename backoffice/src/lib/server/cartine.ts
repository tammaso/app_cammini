// Cartine storiche: epoca, stili (la simbologia), elementi, nomi e punti di controllo.
// Un'importazione sostituisce solo elementi e nomi «importati»: quelli disegnati o modificati nel
// backoffice restano. Gli stili già presenti restano come li ha lasciati il redattore.
import type { DatabaseSync } from 'node:sqlite';
import type { Cartina as CartinaPubblicata, Coordinate, Freccia } from '../../../../condiviso/cammino.ts';
import { inTransazione } from '../../../db/connessione.ts';
import type { Cartina, CartinaInElenco, Certezza, Errori, PuntoControllo, Stile } from '../cammini.ts';
import type { EsitoModulo } from './cammini.ts';
import { adesso, facoltativo, intero, valoriDi } from './moduli.ts';
import { registraModifica } from './registro.ts';

const opz = (valore: unknown) => (valore == null ? null : String(valore));
const json = <T>(valore: unknown): T | null => (valore == null ? null : (JSON.parse(String(valore)) as T));

export function elencaCartine(db: DatabaseSync, camminoId: number): CartinaInElenco[] {
  return db.prepare(`SELECT k.*, (SELECT count(*) FROM elementi e WHERE e.cartina_id = k.id) AS elementi,
      (SELECT count(*) FROM nomi n WHERE n.cartina_id = k.id) AS nomi,
      (SELECT count(*) FROM punti_controllo p WHERE p.cartina_id = k.id) AS punti
    FROM cartine k WHERE k.cammino_id = ? ORDER BY k.anno`).all(camminoId).map((r) => ({
    id: Number(r.id), epoca: String(r.epoca), pulsante: String(r.pulsante), anno: Number(r.anno),
    elementi: Number(r.elementi), nomi: Number(r.nomi), punti: Number(r.punti),
  }));
}

const comeStile = (r: Record<string, unknown>): Stile => ({
  id: Number(r.id), chiave: String(r.chiave), posizione: Number(r.posizione), tipo: String(r.tipo) as Stile['tipo'],
  nome: String(r.nome), legenda: opz(r.legenda), colore: String(r.colore), opacita: json(r.opacita), contorno: opz(r.contorno),
  spessore: json(r.spessore), tratteggio: json(r.tratteggio), ritaglio: Boolean(r.ritaglio), elementi: Number(r.elementi ?? 0),
});

export function leggiCartina(db: DatabaseSync, id: number): Cartina | undefined {
  const r = db.prepare('SELECT k.*, c.titolo AS cammino FROM cartine k JOIN cammini c ON c.id = k.cammino_id WHERE k.id = ?').get(id);
  if (!r) return undefined;
  const stili = db.prepare(`SELECT s.*, (SELECT count(*) FROM elementi e WHERE e.stile_id = s.id) AS elementi FROM stili s
    WHERE s.cartina_id = ? ORDER BY s.posizione, s.id`).all(id).map(comeStile);
  const punti: PuntoControllo[] = db.prepare(`SELECT p.*, l.nome AS luogo FROM punti_controllo p LEFT JOIN luoghi l ON l.id = p.luogo_id
    WHERE p.cartina_id = ? ORDER BY p.posizione`).all(id).map((p) => ({
    id: Number(p.id), nome: String(p.nome), luogo: opz(p.luogo), sx: Number(p.sx), sy: Number(p.sy), lng: Number(p.lng),
    lat: Number(p.lat), certezza: String(p.certezza) as Certezza, stato: String(p.stato) as PuntoControllo['stato'],
  }));
  return {
    id, camminoId: Number(r.cammino_id), cammino: String(r.cammino), epoca: String(r.epoca), pulsante: String(r.pulsante),
    anno: Number(r.anno), fonte: opz(r.fonte), metodo: String(r.metodo), importataIl: opz(r.importata_il), stili,
    elementi: db.prepare('SELECT origine, count(*) AS n FROM elementi WHERE cartina_id = ? GROUP BY origine').all(id)
      .map((e) => ({ origine: String(e.origine), n: Number(e.n) })),
    nomi: db.prepare('SELECT categoria, count(*) AS n FROM nomi WHERE cartina_id = ? GROUP BY categoria ORDER BY min(posizione)').all(id)
      .map((e) => ({ categoria: String(e.categoria), n: Number(e.n) })),
    punti,
  };
}

// --- Epoca della cartina ------------------------------------------------------------------------------

const CAMPI_CARTINA = ['pulsante', 'anno'] as const;
export type CampoCartina = (typeof CAMPI_CARTINA)[number];

export function validaCartina(modulo: FormData): EsitoModulo<{ pulsante: string; anno: number }, CampoCartina> {
  const valori = valoriDi(modulo, CAMPI_CARTINA);
  const errori: Errori<CampoCartina> = {};
  if (!valori.pulsante) errori.pulsante = 'Il testo del pulsante è obbligatorio: «1700 a.C.».';
  const anno = intero(modulo, 'anno');
  if (anno === null) errori.anno = 'Un numero intero, negativo prima di Cristo: -1700.';
  if (Object.keys(errori).length) return { ok: false, errori, valori };
  return { ok: true, dati: { pulsante: valori.pulsante, anno: anno! } };
}

export function aggiornaCartina(db: DatabaseSync, id: number, d: { pulsante: string; anno: number }): void {
  const cartina = leggiCartina(db, id)!;
  db.prepare('UPDATE cartine SET pulsante = ?, anno = ? WHERE id = ?').run(d.pulsante, d.anno, id);
  db.prepare('UPDATE cammini SET modificato_il = ? WHERE id = ?').run(adesso(), cartina.camminoId);
  registraModifica(db, { azione: 'modifica', oggetto: 'cartina', oggettoId: id, camminoId: cartina.camminoId, titolo: d.pulsante, descrizione: 'Pulsante o anno della cartina modificati' });
}

// --- Stili --------------------------------------------------------------------------------------------

// Un valore che cambia con lo zoom si scrive «0,82 / 0,66» (a zoom 3 / a zoom 7); uno fisso «0,14».
export const valoreInTesto = (v: number | [number, number] | null) =>
  v == null ? '' : (Array.isArray(v) ? v : [v]).map((n) => String(n).replace('.', ',')).join(' / ');

function valoreDaTesto(testo: string): number | [number, number] | null | undefined {
  if (!testo) return null;
  const numeri = testo.split(/[/;]/).map((s) => Number(s.trim().replace(',', '.')));
  if (numeri.some((n) => !Number.isFinite(n) || n < 0) || numeri.length > 2) return undefined;
  return numeri.length === 2 ? [numeri[0], numeri[1]] : numeri[0];
}

const CAMPI_STILE = ['nome', 'legenda', 'colore', 'contorno', 'opacita', 'spessore', 'tratteggio'] as const;
export type CampoStile = (typeof CAMPI_STILE)[number];
type DatiStile = Pick<Stile, 'nome' | 'legenda' | 'colore' | 'contorno' | 'opacita' | 'spessore' | 'tratteggio' | 'ritaglio'>;

export function validaStile(modulo: FormData): EsitoModulo<DatiStile, CampoStile> {
  const valori = valoriDi(modulo, CAMPI_STILE);
  const errori: Errori<CampoStile> = {};
  const colore = (s: string) => /^#[0-9a-f]{6}$/i.test(s);
  if (!valori.nome) errori.nome = 'Il nome è obbligatorio.';
  if (!colore(valori.colore)) errori.colore = 'Un colore come #ffd87d.';
  if (valori.contorno && !colore(valori.contorno)) errori.contorno = 'Un colore come #5e6062, o vuoto per nessun contorno.';
  const opacita = valoreDaTesto(valori.opacita);
  if (opacita === undefined || [opacita].flat().some((n) => n != null && n > 1)) errori.opacita = 'Tra 0 e 1: «0,82 / 0,66» o «0,14».';
  const spessore = valoreDaTesto(valori.spessore);
  if (spessore === undefined) errori.spessore = 'In pixel: «1,1 / 1,8» o «2».';
  const tratteggio = valoreDaTesto(valori.tratteggio);
  if (tratteggio === undefined || (tratteggio !== null && !Array.isArray(tratteggio))) errori.tratteggio = 'Trattino / spazio: «0,1 / 2», o vuoto per una linea continua.';
  if (Object.keys(errori).length) return { ok: false, errori, valori };
  return {
    ok: true,
    dati: {
      nome: valori.nome, legenda: facoltativo(modulo, 'legenda'), colore: valori.colore.toLowerCase(),
      contorno: valori.contorno ? valori.contorno.toLowerCase() : null, opacita: opacita ?? null, spessore: spessore ?? null,
      tratteggio: (tratteggio as [number, number] | null) ?? null, ritaglio: modulo.get('ritaglio') === 'on',
    },
  };
}

export function aggiornaStile(db: DatabaseSync, id: number, d: DatiStile): void {
  const r = db.prepare('SELECT s.cartina_id, k.cammino_id FROM stili s JOIN cartine k ON k.id = s.cartina_id WHERE s.id = ?').get(id)!;
  const s = (v: unknown) => (v == null ? null : JSON.stringify(v));
  db.prepare(`UPDATE stili SET nome = ?, legenda = ?, colore = ?, contorno = ?, opacita = ?, spessore = ?, tratteggio = ?, ritaglio = ? WHERE id = ?`)
    .run(d.nome, d.legenda, d.colore, d.contorno, s(d.opacita), s(d.spessore), s(d.tratteggio), d.ritaglio ? 1 : 0, id);
  db.prepare('UPDATE cammini SET modificato_il = ? WHERE id = ?').run(adesso(), Number(r.cammino_id));
  registraModifica(db, { azione: 'modifica', oggetto: 'stile', oggettoId: id, camminoId: Number(r.cammino_id), titolo: d.nome, descrizione: 'Stile della cartina modificato (vale dalla prossima generazione per il ritaglio, subito per il resto)' });
}

// --- Importazione -------------------------------------------------------------------------------------

// Un punto di controllo come lo salva allinea.html (prototipo/cartine/<cartina>.punti.json)
export interface PuntoImportato {
  nome: string;
  luogo: string | null;
  sx: number;
  sy: number;
  lng: number;
  lat: number;
  certezza: Certezza;
  stato: PuntoControllo['stato'];
}

export interface Importazione {
  camminoId: number;
  epoca: string;
  pulsante: string; // usati solo se la cartina è nuova: poi restano quelli del backoffice
  anno: number;
  fonte: string | null;
  cartina: Pick<CartinaPubblicata, 'stili' | 'elementi' | 'nomi' | 'alone'>;
  tracciati?: (Coordinate[] | null)[]; // uno per ogni tappa dopo la prima
  frecce?: Freccia[];
  punti?: PuntoImportato[];
}

export interface EsitoImportazione {
  cartinaId: number;
  nuova: boolean;
  stiliNuovi: number;
  elementi: number;
  nomi: number;
  avvisi: string[];
}

// Il luogo dell'anagrafe per un nome della cartina: per nome o per uno degli altri nomi.
function trovaLuogo(db: DatabaseSync, nome: string | null): number | null {
  if (!nome) return null;
  const r = db.prepare(`SELECT id FROM luoghi WHERE nome = ?1 COLLATE NOCASE
      OR EXISTS (SELECT 1 FROM json_each(altri_nomi) WHERE lower(value) = lower(?1)) LIMIT 1`).get(nome.replace(/\n/g, ' '));
  return r ? Number(r.id) : null;
}

export function importaCartina(db: DatabaseSync, imp: Importazione): EsitoImportazione {
  return inTransazione(db, () => {
    const avvisi: string[] = [];
    const esistente = db.prepare('SELECT id FROM cartine WHERE cammino_id = ? AND epoca = ?').get(imp.camminoId, imp.epoca);
    let cartinaId: number;
    if (esistente) {
      cartinaId = Number(esistente.id);
      db.prepare('UPDATE cartine SET fonte = ?, alone = ?, importata_il = ? WHERE id = ?')
        .run(imp.fonte, JSON.stringify(imp.cartina.alone), adesso(), cartinaId);
    } else {
      cartinaId = Number(db.prepare(`INSERT INTO cartine (cammino_id, epoca, pulsante, anno, fonte, alone, importata_il)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(imp.camminoId, imp.epoca, imp.pulsante, imp.anno, imp.fonte, JSON.stringify(imp.cartina.alone), adesso()).lastInsertRowid);
    }

    // stili: si aggiungono quelli nuovi; quelli già presenti restano come sono
    const stili = new Map(db.prepare('SELECT id, chiave FROM stili WHERE cartina_id = ?').all(cartinaId).map((r) => [String(r.chiave), Number(r.id)]));
    let stiliNuovi = 0;
    imp.cartina.stili.forEach((s, posizione) => {
      if (stili.has(s.id)) return;
      const j = (v: unknown) => (v == null ? null : JSON.stringify(v));
      const { lastInsertRowid } = db.prepare(`INSERT INTO stili (cartina_id, chiave, posizione, tipo, nome, legenda, colore, opacita, contorno,
          spessore, tratteggio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(cartinaId, s.id, posizione, s.tipo, s.nome, s.legenda ?? null, s.tipo === 'area' ? s.riempimento : s.colore,
          s.tipo === 'area' ? j(s.opacita) : null, s.tipo === 'area' ? s.contorno : null,
          s.tipo === 'punto' ? null : j(s.spessore), s.tipo === 'linea' ? j(s.tratteggio) : null);
      stili.set(s.id, Number(lastInsertRowid));
      stiliNuovi++;
    });

    // elementi e nomi importati: si sostituiscono
    db.prepare("DELETE FROM elementi WHERE cartina_id = ? AND origine = 'importato'").run(cartinaId);
    const nuovoElemento = db.prepare("INSERT INTO elementi (cartina_id, stile_id, nome, geometria, origine) VALUES (?, ?, ?, ?, 'importato')");
    for (const f of imp.cartina.elementi.features) {
      const stile = stili.get(f.properties.stile);
      if (stile === undefined) { avvisi.push(`Elemento «${f.properties.nome ?? '?'}» con uno stile sconosciuto (${f.properties.stile}): saltato.`); continue; }
      nuovoElemento.run(cartinaId, stile, f.properties.nome, JSON.stringify(f.geometry));
    }
    db.prepare("DELETE FROM nomi WHERE cartina_id = ? AND origine = 'importato'").run(cartinaId);
    const nuovoNome = db.prepare(`INSERT INTO nomi (cartina_id, posizione, categoria, testo, sotto, lng, lat, zoom, angolo, luogo_id, origine)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'importato')`);
    imp.cartina.nomi.forEach(([categoria, nome, lng, lat, zoom, extra], posizione) => {
      const luogo = /^(capitale-antica|citta-antica|vetta)$/.test(categoria) ? trovaLuogo(db, nome) : null;
      if (/^(capitale-antica|citta-antica|vetta)$/.test(categoria) && luogo === null) avvisi.push(`«${nome}» non è nell'anagrafe dei luoghi.`);
      nuovoNome.run(cartinaId, posizione, categoria, nome, extra?.sotto ?? null, lng, lat, zoom, extra?.angolo ?? null, luogo);
    });

    // tracciati delle tappe e frecce del cammino, se l'importazione li porta
    if (imp.tracciati) {
      const tappe = db.prepare('SELECT id FROM tappe WHERE cammino_id = ? ORDER BY posizione').all(imp.camminoId).map((r) => Number(r.id));
      if (tappe.length !== imp.tracciati.length + 1) {
        avvisi.push(`Il cammino ha ${tappe.length} tappe, la cartina ${imp.tracciati.length + 1}: tracciati non aggiornati.`);
      } else {
        imp.tracciati.forEach((t, i) => db.prepare('UPDATE tappe SET tracciato = ? WHERE id = ?').run(t ? JSON.stringify(t) : null, tappe[i + 1]));
      }
    }
    if (imp.frecce) db.prepare('UPDATE cammini SET frecce = ? WHERE id = ?').run(JSON.stringify(imp.frecce), imp.camminoId);

    // punti di controllo: si sostituiscono tutti
    if (imp.punti) {
      db.prepare('DELETE FROM punti_controllo WHERE cartina_id = ?').run(cartinaId);
      imp.punti.forEach((p, posizione) => {
        const luogo = trovaLuogo(db, p.luogo);
        if (p.luogo && luogo === null) avvisi.push(`Il punto di controllo «${p.nome}» rimanda a un luogo che non è nell'anagrafe.`);
        db.prepare(`INSERT INTO punti_controllo (cartina_id, posizione, nome, luogo_id, sx, sy, lng, lat, certezza, stato)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(cartinaId, posizione, p.nome, luogo, p.sx, p.sy, p.lng, p.lat, p.certezza, p.stato);
      });
    }

    db.prepare('UPDATE cammini SET modificato_il = ? WHERE id = ?').run(adesso(), imp.camminoId);
    const pulsante = String(db.prepare('SELECT pulsante FROM cartine WHERE id = ?').get(cartinaId)!.pulsante);
    registraModifica(db, {
      azione: esistente ? 'modifica' : 'creazione', oggetto: 'cartina', oggettoId: cartinaId, camminoId: imp.camminoId, titolo: pulsante,
      descrizione: `Cartina importata da ${imp.fonte ?? 'file'}: ${imp.cartina.elementi.features.length} elementi, ${imp.cartina.nomi.length} nomi`
        + (imp.tracciati ? ', tracciati delle tappe' : '') + (imp.punti ? `, ${imp.punti.length} punti di controllo` : ''),
    });
    return {
      cartinaId, nuova: !esistente, stiliNuovi, elementi: imp.cartina.elementi.features.length, nomi: imp.cartina.nomi.length, avvisi,
    };
  });
}

// Gli spilli della pagina di allineamento: sostituiscono tutti i punti di controllo della cartina
export interface SpilloSalvato {
  nome: string;
  luogoId: number | null;
  sx: number;
  sy: number;
  lng: number;
  lat: number;
  certezza: Certezza;
  stato: PuntoControllo['stato'];
}

export function salvaPunti(db: DatabaseSync, cartinaId: number, punti: SpilloSalvato[]): void {
  const numero = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  for (const p of punti) {
    if (!numero(p.sx) || !numero(p.sy) || !numero(p.lng) || !numero(p.lat) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) {
      throw new Error(`Spillo «${p.nome}» con coordinate non valide.`);
    }
    if (!['certa', 'probabile', 'ipotetica'].includes(p.certezza) || !['proposto', 'confermato', 'manuale'].includes(p.stato)) {
      throw new Error(`Spillo «${p.nome}» con certezza o stato non validi.`);
    }
  }
  const cartina = leggiCartina(db, cartinaId)!;
  inTransazione(db, () => {
    db.prepare('DELETE FROM punti_controllo WHERE cartina_id = ?').run(cartinaId);
    punti.forEach((p, posizione) => {
      const luogo = p.luogoId != null && db.prepare('SELECT 1 FROM luoghi WHERE id = ?').get(p.luogoId) ? p.luogoId : null;
      db.prepare(`INSERT INTO punti_controllo (cartina_id, posizione, nome, luogo_id, sx, sy, lng, lat, certezza, stato)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(cartinaId, posizione, String(p.nome || `Punto ${posizione + 1}`).slice(0, 120), luogo, p.sx, p.sy, p.lng, p.lat, p.certezza, p.stato);
    });
    registraModifica(db, {
      azione: 'modifica', oggetto: 'cartina', oggettoId: cartinaId, camminoId: cartina.camminoId, titolo: cartina.pulsante,
      descrizione: `Punti di controllo salvati: ${punti.length}, ${punti.filter((p) => p.stato !== 'proposto').length} confermati o aggiunti a mano`,
    });
  });
}

export function eliminaCartina(db: DatabaseSync, id: number): void {
  const cartina = leggiCartina(db, id);
  if (!cartina) return;
  db.prepare('DELETE FROM cartine WHERE id = ?').run(id);
  registraModifica(db, {
    azione: 'eliminazione', oggetto: 'cartina', oggettoId: id, camminoId: cartina.camminoId, titolo: cartina.pulsante,
    descrizione: 'Cartina eliminata, con stili, elementi, nomi e punti di controllo',
  });
}
