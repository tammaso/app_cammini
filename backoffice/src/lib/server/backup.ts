// Backup dei dati del backoffice in una cartella scelta dalla pagina «Cronologia»: anche una cartella
// sincronizzata con il cloud (Google Drive per desktop, OneDrive), così le copie escono dal PC.
// - Database: una copia coerente anche con il backoffice acceso (VACUUM INTO), con data e ora nel
//   nome; si tengono le ultime COPIE_DA_TENERE.
// - Immagini originali e file SVG delle cartine: si copiano solo quelli nuovi. Il nome è l'impronta del contenuto, quindi
//   un file già presente con lo stesso nome è già identico.
// Le anteprime e i siti generati non servono: si rigenerano da soli.
// Il backup automatico è acceso di serie (dal 2026-11-15) e parte una volta al giorno; si spegne dalla pagina
// «Cronologia». Finché non si sceglie una cartella si salva in CARTELLA_PREDEFINITA (Documenti\Backup cammini):
// sullo stesso disco del PC, protegge dagli errori ma non da un guasto, e la pagina lo dice.
import { spawn } from 'node:child_process';
import { copyFile, mkdir, readdir, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { inTransazione, PERCORSO_DB } from '../../../db/connessione.ts';
import { applicaMigrazioni } from '../../../db/migra.ts';
import { CARTELLA_IMMAGINI } from './immagini.ts';
import { CARTELLA_CARTINE } from './importazione-svg.ts';
import { registraErrore, registraModifica } from './registro.ts';

export const COPIE_DA_TENERE = 30;
export const INTERVALLO_AUTOMATICO = 24 * 60 * 60 * 1000;
const CONTROLLO_OGNI = 60 * 60 * 1000; // con il backoffice acceso si ricontrolla ogni ora

const SOTTOCARTELLA_DATABASE = 'database';
const SOTTOCARTELLA_IMMAGINI = join('immagini', 'originali');

// --- Impostazioni -----------------------------------------------------------------------------

export const CARTELLA_PREDEFINITA = process.env.CAMMINI_BACKUP ?? join(homedir(), 'Documents', 'Backup cammini');

export interface ImpostazioniBackup {
  cartella: string;
  predefinita: boolean; // la cartella è quella di serie: nessuno l'ha ancora scelta
  automatico: boolean;
  ultimo: string | null; // ISO 8601 dell'ultimo backup riuscito
  errore: string | null; // dell'ultimo tentativo non riuscito
}

export function leggiImpostazioniBackup(db: DatabaseSync): ImpostazioniBackup {
  const valori = new Map(db.prepare("SELECT chiave, valore FROM impostazioni WHERE chiave LIKE 'backup_%'").all()
    .map((r) => [String(r.chiave), String(r.valore)]));
  return {
    cartella: valori.get('backup_cartella') ?? CARTELLA_PREDEFINITA,
    predefinita: !valori.has('backup_cartella'),
    // acceso di serie: spento solo se qualcuno l'ha spento
    automatico: valori.get('backup_automatico') !== '0',
    ultimo: valori.get('backup_ultimo') ?? null,
    errore: valori.get('backup_errore') ?? null,
  };
}

function scrivi(db: DatabaseSync, chiave: string, valore: string | null) {
  if (valore === null) db.prepare('DELETE FROM impostazioni WHERE chiave = ?').run(chiave);
  else {
    db.prepare('INSERT INTO impostazioni (chiave, valore) VALUES (?, ?) ON CONFLICT (chiave) DO UPDATE SET valore = excluded.valore')
      .run(chiave, valore);
  }
}

export const salvaCartellaBackup = (db: DatabaseSync, cartella: string) => scrivi(db, 'backup_cartella', cartella);
export const impostaBackupAutomatico = (db: DatabaseSync, attivo: boolean) => scrivi(db, 'backup_automatico', attivo ? '1' : '0');

function registraEsito(db: DatabaseSync, esito: { riuscito: true; quando: Date } | { riuscito: false; errore: string }) {
  if (esito.riuscito) {
    scrivi(db, 'backup_ultimo', esito.quando.toISOString());
    scrivi(db, 'backup_errore', null);
  } else {
    scrivi(db, 'backup_errore', esito.errore);
  }
}

// La cartella deve esistere ed essere scrivibile: si prova a scriverci un file e a cancellarlo.
export async function controllaCartella(percorso: string): Promise<string | null> {
  if (!percorso) return 'Indica la cartella.';
  if (!isAbsolute(percorso)) return 'Serve il percorso completo, per esempio C:\\Users\\nome\\OneDrive\\Backup cammini.';
  try {
    if (!(await stat(percorso)).isDirectory()) return 'Il percorso indicato è un file, non una cartella.';
  } catch {
    return 'La cartella non esiste. Creala e riprova.';
  }
  const prova = join(percorso, `.prova-cammini-${process.pid}`);
  try {
    await writeFile(prova, 'prova');
    await unlink(prova);
  } catch {
    return 'Non è possibile scrivere in questa cartella.';
  }
  return null;
}

// --- Backup -------------------------------------------------------------------------------------

export interface EsitoBackup {
  file: string; // copia del database appena creata
  immaginiCopiate: number;
  copieEliminate: number;
}

const due = (n: number) => String(n).padStart(2, '0');
// Nel nome l'ora locale: è quella che si legge sull'orologio del PC.
export const nomeCopia = (d: Date) =>
  `cammini-${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}_${due(d.getHours())}-${due(d.getMinutes())}-${due(d.getSeconds())}.db`;

export interface OpzioniBackup {
  cartella: string;
  cartellaImmagini?: string; // archivio del backoffice (contiene originali/)
  cartellaCartine?: string; // file SVG delle cartine
  cartellaTemporanea?: string; // dove preparare la copia prima di spostarla
  copieDaTenere?: number;
  adesso?: Date;
}

// un backup o un ripristino alla volta
let inCorso = false;
async function daSolo<T>(operazione: () => Promise<T>): Promise<T> {
  if (inCorso) throw new Error("C'è già un backup o un ripristino in corso: attendi qualche secondo.");
  inCorso = true;
  try {
    return await operazione();
  } finally {
    inCorso = false;
  }
}

export const eseguiBackup = (db: DatabaseSync, opzioni: OpzioniBackup): Promise<EsitoBackup> => daSolo(() => copiaInBackup(db, opzioni));

async function copiaInBackup(db: DatabaseSync, opzioni: OpzioniBackup): Promise<EsitoBackup> {
  {
    const {
      cartella,
      cartellaImmagini = CARTELLA_IMMAGINI,
      cartellaCartine = CARTELLA_CARTINE,
      cartellaTemporanea = join(dirname(PERCORSO_DB), 'backup-in-corso'),
      copieDaTenere = COPIE_DA_TENERE,
      adesso = new Date(),
    } = opzioni;
    const problema = await controllaCartella(cartella);
    if (problema) throw new Error(problema);

    // La copia si prepara sul disco locale e poi si sposta: su una cartella sincronizzata con il
    // cloud si scrive così un file solo, già completo.
    const nome = nomeCopia(adesso);
    await mkdir(cartellaTemporanea, { recursive: true });
    const temporanea = join(cartellaTemporanea, nome);
    await rm(temporanea, { force: true });
    db.exec(`VACUUM INTO '${temporanea.replaceAll("'", "''")}'`);
    const cartellaDatabase = join(cartella, SOTTOCARTELLA_DATABASE);
    await mkdir(cartellaDatabase, { recursive: true });
    const file = join(cartellaDatabase, nome);
    await copyFile(temporanea, file);
    await rm(temporanea, { force: true });

    const origine = join(cartellaImmagini, 'originali');
    const destinazione = join(cartella, SOTTOCARTELLA_IMMAGINI);
    await mkdir(destinazione, { recursive: true });
    const presenti = new Set(await readdir(destinazione));
    let immaginiCopiate = 0;
    for (const voce of await readdir(origine).catch(() => [] as string[])) {
      if (presenti.has(voce)) continue;
      await copyFile(join(origine, voce), join(destinazione, voce));
      immaginiCopiate++;
    }
    // i file SVG delle cartine, come li ha consegnati il cartografo: anche il loro nome è l'impronta
    const destinazioneCartine = join(cartella, 'cartine');
    await mkdir(destinazioneCartine, { recursive: true });
    const cartinePresenti = new Set(await readdir(destinazioneCartine));
    for (const voce of await readdir(cartellaCartine).catch(() => [] as string[])) {
      if (!cartinePresenti.has(voce)) await copyFile(join(cartellaCartine, voce), join(destinazioneCartine, voce));
    }

    // Le copie del database più vecchie oltre il limite si eliminano (il nome ordina per data).
    const copie = (await readdir(cartellaDatabase)).filter((n) => /^cammini-.*\.db$/.test(n)).sort().reverse();
    for (const vecchia of copie.slice(copieDaTenere)) await rm(join(cartellaDatabase, vecchia), { force: true });

    return { file, immaginiCopiate, copieEliminate: Math.max(0, copie.length - copieDaTenere) };
  }
}

// --- Ripristino -----------------------------------------------------------------------------------
// Il database torna com'era in una copia del backup, con il backoffice acceso (2026-11-14; prima si spostavano i file a
// mano, a backoffice chiuso, e le istruzioni dimenticavano i file SVG delle cartine):
// 1. la copia si porta in una cartella locale, si controlla (integrità, è un database dei cammini, non viene da una
//    versione più recente del backoffice) e si aggiorna allo schema attuale; il file nel backup non cambia;
// 2. si salva una copia dello stato attuale nella cartella del backup, tra le altre: per annullare basta ripristinarla;
// 3. i dati si sostituiscono tabella per tabella in una sola transazione (o tutto o niente), sulla stessa connessione:
//    il backoffice non va riavviato. Restano di questo PC le impostazioni (cartella e backup automatico); i registri
//    tengono la storia della copia più le righe di qui che la copia non ha, con una riga per il ripristino;
// 4. tornano le immagini originali e i file SVG delle cartine che mancano (il nome è l'impronta: quelli presenti sono già
//    uguali). Le anteprime delle immagini si rigenerano da sole. Il portale non cambia finché non lo si aggiorna.

export interface EsitoRipristino {
  sicurezza: string; // nome della copia dello stato di prima, nella cartella del backup
  immaginiCopiate: number;
  cartineCopiate: number;
  immaginiMancanti: string[]; // file che il database richiama e che non ci sono né qui né nel backup
  cartineMancanti: string[];
}

export const NOME_COPIA = /^cammini-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/;
// non si sostituiscono: le impostazioni sono di questo PC, i registri si uniscono a parte, le migrazioni dicono lo schema
const TABELLE_A_PARTE = new Set(['impostazioni', 'registro_modifiche', 'registro_errori', 'migrazioni']);
const REGISTRI = ['registro_modifiche', 'registro_errori'];
const virgolette = (nome: string) => `"${nome.replaceAll('"', '""')}"`;

export const ripristinaCopia = (db: DatabaseSync, opzioni: OpzioniBackup & { nome: string; cartellaMigrazioni?: string }): Promise<EsitoRipristino> =>
  daSolo(async () => {
    const {
      cartella, nome,
      cartellaImmagini = CARTELLA_IMMAGINI,
      cartellaCartine = CARTELLA_CARTINE,
      cartellaTemporanea = join(dirname(PERCORSO_DB), 'backup-in-corso'),
    } = opzioni;
    if (!NOME_COPIA.test(nome)) throw new Error('Copia non valida: scegline una dall\'elenco.');
    const sorgente = join(cartella, SOTTOCARTELLA_DATABASE, nome);
    if (!(await stat(sorgente).catch(() => null))?.isFile()) throw new Error(`La copia ${nome} non c'è più nella cartella del backup.`);

    // 1. la copia, preparata in locale
    await mkdir(cartellaTemporanea, { recursive: true });
    const preparata = join(cartellaTemporanea, `da-ripristinare-${nome}`);
    await copyFile(sorgente, preparata);
    try {
      const copia = new DatabaseSync(preparata);
      try {
        const integrita = String(Object.values(copia.prepare('PRAGMA integrity_check').get() ?? {})[0] ?? '');
        if (integrita !== 'ok') throw new Error(`La copia ${nome} è danneggiata (${integrita}).`);
        const tabelle = new Set(copia.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => String(r.name)));
        if (!tabelle.has('cammini') || !tabelle.has('migrazioni')) throw new Error(`${nome} non è una copia del database dei cammini.`);
        const note = new Set(db.prepare('SELECT nome FROM migrazioni').all().map((r) => String(r.nome)));
        const ignote = copia.prepare('SELECT nome FROM migrazioni').all().map((r) => String(r.nome)).filter((n) => !note.has(n));
        if (ignote.length) throw new Error(`La copia viene da una versione più recente del backoffice (${ignote.join(', ')}): aggiorna prima il backoffice.`);
        applicaMigrazioni(copia, opzioni.cartellaMigrazioni);
      } finally {
        copia.close();
      }

      // 2. lo stato di adesso, tra le copie del backup (ma non al posto di quella scelta)
      let adesso = opzioni.adesso ?? new Date();
      if (nomeCopia(adesso) === nome) adesso = new Date(adesso.getTime() + 1000);
      const { file: sicurezza } = await copiaInBackup(db, { ...opzioni, adesso, copieDaTenere: Number.MAX_SAFE_INTEGER });

      // 3. la sostituzione, tutta in una volta (niente attese da qui a DETACH: nessun'altra richiesta si inserisce)
      db.exec('PRAGMA foreign_keys = OFF'); // si rimette dopo: non si può cambiare dentro una transazione
      db.exec(`ATTACH DATABASE '${preparata.replaceAll("'", "''")}' AS copia`);
      try {
        inTransazione(db, () => {
          const tabelle = db.prepare("SELECT name FROM main.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()
            .map((r) => String(r.name)).filter((t) => !TABELLE_A_PARTE.has(t));
          const colonne = (schema: string, tabella: string) =>
            db.prepare(`PRAGMA ${schema}.table_info(${virgolette(tabella)})`).all().map((r) => String(r.name));
          for (const t of tabelle) db.exec(`DELETE FROM main.${virgolette(t)}`);
          for (const t of tabelle) {
            const comuni = colonne('main', t).filter((c) => colonne('copia', t).includes(c)).map(virgolette).join(', ');
            if (!comuni) continue; // aggiornata allo schema attuale, la copia ha tutte le tabelle: è solo prudenza
            db.exec(`INSERT INTO main.${virgolette(t)} (${comuni}) SELECT ${comuni} FROM copia.${virgolette(t)}`);
          }
          // i registri: le righe della copia più quelle di qui che la copia non ha (scritte dopo, o su questo PC), in
          // ordine di tempo; una riga è la stessa se tutti i campi tranne il numero coincidono
          for (const r of REGISTRI) {
            const nomi = colonne('main', r).filter((c) => c !== 'id').map(virgolette);
            const campi = nomi.join(', '), uguale = nomi.map((c) => `c.${c} IS q.${c}`).join(' AND ');
            db.exec(`CREATE TEMP TABLE registro_unito AS
              SELECT ${campi} FROM copia.${r}
              UNION ALL
              SELECT ${campi} FROM main.${r} AS q WHERE NOT EXISTS (SELECT 1 FROM copia.${r} AS c WHERE ${uguale})`);
            db.exec(`DELETE FROM main.${r}`);
            db.exec(`INSERT INTO main.${r} (${campi}) SELECT ${campi} FROM temp.registro_unito ORDER BY quando, rowid`);
            db.exec('DROP TABLE temp.registro_unito');
          }
          const violazioni = db.prepare('PRAGMA main.foreign_key_check').all();
          if (violazioni.length) throw new Error(`La copia ha riferimenti non validi, per esempio ${JSON.stringify({ ...violazioni[0] })}.`);
          registraModifica(db, {
            azione: 'ripristino', oggetto: 'database', titolo: nome,
            descrizione: `Database ripristinato dalla copia ${nome}; lo stato di prima è nella copia ${basename(sicurezza)}`,
          });
        });
      } finally {
        db.exec('DETACH DATABASE copia');
        db.exec('PRAGMA foreign_keys = ON');
      }

      // 4. i file che mancano: immagini originali e SVG delle cartine
      const ripristinaFile = async (da: string, a: string) => {
        await mkdir(a, { recursive: true });
        const presenti = new Set(await readdir(a));
        let copiati = 0;
        for (const voce of await readdir(da).catch(() => [] as string[])) {
          if (presenti.has(voce)) continue;
          await copyFile(join(da, voce), join(a, voce));
          copiati++;
        }
        return copiati;
      };
      const immaginiCopiate = await ripristinaFile(join(cartella, SOTTOCARTELLA_IMMAGINI), join(cartellaImmagini, 'originali'));
      const cartineCopiate = await ripristinaFile(join(cartella, 'cartine'), cartellaCartine);
      const mancanti = async (cartellaFile: string, sql: string) => {
        const elenco: string[] = [];
        for (const r of db.prepare(sql).all()) {
          const file = String(r.file);
          if (!(await stat(join(cartellaFile, file)).catch(() => null))) elenco.push(file);
        }
        return elenco;
      };
      return {
        sicurezza: basename(sicurezza),
        immaginiCopiate,
        cartineCopiate,
        immaginiMancanti: await mancanti(cartellaImmagini, 'SELECT file FROM immagini'),
        cartineMancanti: await mancanti(cartellaCartine, 'SELECT svg AS file FROM cartine WHERE svg IS NOT NULL'),
      };
    } finally {
      await rm(preparata, { force: true });
    }
  });

// Ripristino dalla pagina: gli errori finiscono anche nel registro degli errori.
export async function ripristinoRegistrato(db: DatabaseSync, nome: string, opzioni: Omit<OpzioniBackup, 'cartella'> = {}): Promise<EsitoRipristino> {
  const { cartella } = leggiImpostazioniBackup(db);
  try {
    return await ripristinaCopia(db, { ...opzioni, cartella, nome });
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : String(errore);
    registraErrore(db, { origine: 'backup', messaggio: `Ripristino non riuscito: ${messaggio}`, dettagli: errore instanceof Error ? errore.stack ?? null : null });
    throw errore;
  }
}

// Backup dalla pagina o dal timer: l'esito si registra nelle impostazioni, riuscito o no.
export async function backupRegistrato(db: DatabaseSync, opzioni: Omit<OpzioniBackup, 'cartella'> = {}): Promise<EsitoBackup> {
  const { cartella, predefinita } = leggiImpostazioniBackup(db);
  try {
    // la cartella di serie si crea al primo backup; una scelta a mano deve già esserci
    if (predefinita) await mkdir(cartella, { recursive: true });
    const esito = await eseguiBackup(db, { ...opzioni, cartella });
    registraEsito(db, { riuscito: true, quando: opzioni.adesso ?? new Date() });
    return esito;
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : String(errore);
    registraEsito(db, { riuscito: false, errore: messaggio });
    registraErrore(db, { origine: 'backup', messaggio, dettagli: errore instanceof Error ? errore.stack ?? null : null });
    throw errore;
  }
}

export function backupDovuto(impostazioni: ImpostazioniBackup, adesso = new Date()): boolean {
  if (!impostazioni.automatico) return false;
  return !impostazioni.ultimo || adesso.getTime() - new Date(impostazioni.ultimo).getTime() >= INTERVALLO_AUTOMATICO;
}

// Avvio del backoffice: controllo subito, poi ogni ora finché resta acceso. Un solo timer per
// processo, anche quando Vite ricarica i moduli in sviluppo.
export function avviaBackupAutomatico(db: DatabaseSync): void {
  const globale = globalThis as typeof globalThis & { camminiTimerBackup?: ReturnType<typeof setInterval> };
  if (globale.camminiTimerBackup) return;
  const controlla = () => {
    if (!backupDovuto(leggiImpostazioniBackup(db))) return;
    backupRegistrato(db).catch((errore) => console.error('Backup automatico non riuscito:', errore));
  };
  controlla();
  globale.camminiTimerBackup = setInterval(controlla, CONTROLLO_OGNI);
  globale.camminiTimerBackup.unref();
}

// --- Copie presenti, per la pagina ----------------------------------------------------------------

export interface CopiaBackup {
  nome: string;
  byte: number;
}

export async function elencaCopie(cartella: string): Promise<CopiaBackup[]> {
  const cartellaDatabase = join(cartella, SOTTOCARTELLA_DATABASE);
  const nomi = (await readdir(cartellaDatabase).catch(() => [] as string[])).filter((n) => /^cammini-.*\.db$/.test(n)).sort().reverse();
  return Promise.all(nomi.map(async (nome) => ({ nome, byte: (await stat(join(cartellaDatabase, nome))).size })));
}

// --- Scelta della cartella con la finestra di Windows -----------------------------------------------

// Il backoffice gira su questo PC: può aprire la finestra «Sfoglia per cartelle» di Windows.
// Restituisce il percorso scelto, o null se si chiude la finestra senza scegliere.
export function scegliCartella(): Promise<string | null> {
  if (process.platform !== 'win32') {
    return Promise.reject(new Error('La finestra di scelta funziona solo su Windows: scrivi il percorso nel campo.'));
  }
  // La finestra si apre sopra il browser grazie a un modulo invisibile «sempre in primo piano».
  const script = [
    '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
    'Add-Type -AssemblyName System.Windows.Forms',
    '$sopra = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true }',
    '$finestra = New-Object System.Windows.Forms.FolderBrowserDialog',
    "$finestra.Description = 'Cartella per il backup dei cammini'",
    '$finestra.ShowNewFolderButton = $true',
    "if ($finestra.ShowDialog($sopra) -eq 'OK') { Write-Output $finestra.SelectedPath }",
  ].join('; ');
  return new Promise((risolvi, rifiuta) => {
    const processo = spawn('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { windowsHide: true });
    let uscita = '';
    processo.stdout.on('data', (dati: Buffer) => (uscita += dati.toString('utf8')));
    processo.on('error', rifiuta);
    processo.on('close', () => risolvi(uscita.trim() || null));
  });
}
