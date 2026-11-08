// Registro delle modifiche (inserimenti, modifiche, eliminazioni) e registro degli errori del backoffice.
// Le righe più vecchie dei giorni indicati qui sotto si cancellano da sole all'avvio e una volta al giorno.
import type { DatabaseSync } from 'node:sqlite';

export const GIORNI_REGISTRO_MODIFICHE = 365;
export const GIORNI_REGISTRO_ERRORI = 90;

export type Azione = 'creazione' | 'modifica' | 'eliminazione' | 'ripristino';
export type Oggetto = 'cammino' | 'tappa' | 'luogo' | 'cartina' | 'stile' | 'immagine' | 'pubblicazione';

export interface Modifica {
  azione: Azione;
  oggetto: Oggetto;
  oggettoId?: number | string | null;
  camminoId?: number | null;
  titolo: string;
  descrizione: string;
  datiPrecedenti?: unknown; // solo per le eliminazioni
}

export interface RigaModifica extends Required<Omit<Modifica, 'datiPrecedenti'>> {
  id: number;
  quando: string;
  ripristinabile: boolean;
}

export function registraModifica(db: DatabaseSync, m: Modifica): void {
  db.prepare(`INSERT INTO registro_modifiche (azione, oggetto, oggetto_id, cammino_id, titolo, descrizione, dati_precedenti)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(m.azione, m.oggetto, m.oggettoId == null ? null : String(m.oggettoId), m.camminoId ?? null, m.titolo, m.descrizione,
      m.datiPrecedenti === undefined ? null : JSON.stringify(m.datiPrecedenti));
}

const comeModifica = (r: Record<string, unknown>): RigaModifica => ({
  id: Number(r.id),
  quando: String(r.quando),
  azione: String(r.azione) as Azione,
  oggetto: String(r.oggetto) as Oggetto,
  oggettoId: r.oggetto_id == null ? null : String(r.oggetto_id),
  camminoId: r.cammino_id == null ? null : Number(r.cammino_id),
  titolo: String(r.titolo),
  descrizione: String(r.descrizione),
  // Per ora nessun ripristino automatico: i dati eliminati restano nel registro (dati_precedenti).
  ripristinabile: false,
});

export function elencaModifiche(db: DatabaseSync, filtri: { camminoId?: number; dopo?: string; limite?: number } = {}): RigaModifica[] {
  const condizioni: string[] = [];
  const parametri: (string | number)[] = [];
  if (filtri.camminoId) { condizioni.push('cammino_id = ?'); parametri.push(filtri.camminoId); }
  if (filtri.dopo) { condizioni.push('quando > ?'); parametri.push(filtri.dopo); }
  parametri.push(filtri.limite ?? 300);
  return db
    .prepare(`SELECT * FROM registro_modifiche ${condizioni.length ? `WHERE ${condizioni.join(' AND ')}` : ''}
      ORDER BY quando DESC, id DESC LIMIT ?`)
    .all(...parametri)
    .map(comeModifica);
}

export function datiPrecedenti(db: DatabaseSync, id: number): { riga: RigaModifica; dati: unknown } | null {
  const r = db.prepare('SELECT * FROM registro_modifiche WHERE id = ?').get(id);
  if (!r || r.dati_precedenti == null) return null;
  return { riga: comeModifica(r), dati: JSON.parse(String(r.dati_precedenti)) };
}

// --- Errori --------------------------------------------------------------------------------------

export interface Errore {
  origine: 'pagina' | 'pubblicazione' | 'importazione' | 'backup';
  messaggio: string;
  percorso?: string | null;
  dettagli?: string | null;
}

export interface RigaErrore extends Required<Errore> {
  id: number;
  quando: string;
}

// Registrare un errore non deve mai causarne un altro: se non si riesce, lo si scrive solo nel terminale.
export function registraErrore(db: DatabaseSync, e: Errore): void {
  try {
    db.prepare('INSERT INTO registro_errori (origine, messaggio, percorso, dettagli) VALUES (?, ?, ?, ?)')
      .run(e.origine, e.messaggio.slice(0, 2000), e.percorso ?? null, e.dettagli?.slice(0, 8000) ?? null);
  } catch (errore) {
    console.error('Errore non registrato:', e, errore);
  }
}

export function elencaErrori(db: DatabaseSync, limite = 200): RigaErrore[] {
  return db.prepare('SELECT * FROM registro_errori ORDER BY quando DESC, id DESC LIMIT ?').all(limite).map((r) => ({
    id: Number(r.id),
    quando: String(r.quando),
    origine: String(r.origine) as Errore['origine'],
    messaggio: String(r.messaggio),
    percorso: r.percorso == null ? null : String(r.percorso),
    dettagli: r.dettagli == null ? null : String(r.dettagli),
  }));
}

// --- Pulizia -------------------------------------------------------------------------------------

// quando è scritto come '2026-10-26T09:41:05Z': si confronta con una data nello stesso formato.
const giorniFa = (adesso: Date, giorni: number) =>
  new Date(adesso.getTime() - giorni * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d+Z$/, 'Z');

export function pulisciRegistri(db: DatabaseSync, adesso = new Date()): { modifiche: number; errori: number } {
  const modifiche = db.prepare('DELETE FROM registro_modifiche WHERE quando < ?').run(giorniFa(adesso, GIORNI_REGISTRO_MODIFICHE));
  const errori = db.prepare('DELETE FROM registro_errori WHERE quando < ?').run(giorniFa(adesso, GIORNI_REGISTRO_ERRORI));
  return { modifiche: Number(modifiche.changes), errori: Number(errori.changes) };
}

// All'avvio e poi una volta al giorno, con un solo timer per processo anche quando Vite ricarica i moduli.
export function avviaPuliziaRegistri(db: DatabaseSync): void {
  const globale = globalThis as typeof globalThis & { camminiTimerRegistri?: ReturnType<typeof setInterval> };
  if (globale.camminiTimerRegistri) return;
  const pulisci = () => {
    try {
      pulisciRegistri(db);
    } catch (errore) {
      console.error('Pulizia dei registri non riuscita:', errore);
    }
  };
  pulisci();
  globale.camminiTimerRegistri = setInterval(pulisci, 24 * 60 * 60 * 1000);
  globale.camminiTimerRegistri.unref();
}
