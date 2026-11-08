// Backup dei dati del backoffice in una cartella scelta dalla pagina «Backup»: anche una cartella
// sincronizzata con il cloud (Google Drive per desktop, OneDrive), così le copie escono dal PC.
// - Database: una copia coerente anche con il backoffice acceso (VACUUM INTO), con data e ora nel
//   nome; si tengono le ultime COPIE_DA_TENERE.
// - Immagini originali e file SVG delle cartine: si copiano solo quelli nuovi. Il nome è l'impronta del contenuto, quindi
//   un file già presente con lo stesso nome è già identico.
// Le anteprime e i siti generati non servono: si rigenerano da soli.
// Il backup automatico è spento finché non lo si attiva: poi parte una volta al giorno.
import { spawn } from 'node:child_process';
import { copyFile, mkdir, readdir, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { PERCORSO_DB } from '../../../db/connessione.ts';
import { CARTELLA_IMMAGINI } from './immagini.ts';
import { CARTELLA_CARTINE } from './importazione-svg.ts';
import { registraErrore } from './registro.ts';

export const COPIE_DA_TENERE = 30;
export const INTERVALLO_AUTOMATICO = 24 * 60 * 60 * 1000;
const CONTROLLO_OGNI = 60 * 60 * 1000; // con il backoffice acceso si ricontrolla ogni ora

const SOTTOCARTELLA_DATABASE = 'database';
const SOTTOCARTELLA_IMMAGINI = join('immagini', 'originali');

// --- Impostazioni -----------------------------------------------------------------------------

export interface ImpostazioniBackup {
  cartella: string | null;
  automatico: boolean;
  ultimo: string | null; // ISO 8601 dell'ultimo backup riuscito
  errore: string | null; // dell'ultimo tentativo non riuscito
}

export function leggiImpostazioniBackup(db: DatabaseSync): ImpostazioniBackup {
  const valori = new Map(db.prepare("SELECT chiave, valore FROM impostazioni WHERE chiave LIKE 'backup_%'").all()
    .map((r) => [String(r.chiave), String(r.valore)]));
  return {
    cartella: valori.get('backup_cartella') ?? null,
    automatico: valori.get('backup_automatico') === '1',
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

let inCorso = false;

export async function eseguiBackup(db: DatabaseSync, opzioni: OpzioniBackup): Promise<EsitoBackup> {
  if (inCorso) throw new Error("C'è già un backup in corso: attendi qualche secondo.");
  inCorso = true;
  try {
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
  } finally {
    inCorso = false;
  }
}

// Backup dalla pagina o dal timer: l'esito si registra nelle impostazioni, riuscito o no.
export async function backupRegistrato(db: DatabaseSync, opzioni: Omit<OpzioniBackup, 'cartella'> = {}): Promise<EsitoBackup> {
  const { cartella } = leggiImpostazioniBackup(db);
  try {
    if (!cartella) throw new Error('Scegli prima la cartella dove salvare il backup.');
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
  if (!impostazioni.automatico || !impostazioni.cartella) return false;
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
