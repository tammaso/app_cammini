import type { HandleServerError, ServerInit } from '@sveltejs/kit/hooks';
import { avviaBackupAutomatico } from '#lib/server/backup.ts';
import { db } from '#lib/server/db.ts';
import { avviaPuliziaRegistri, registraErrore } from '#lib/server/registro.ts';

// All'avvio del backoffice: pulizia dei registri e, se il backup automatico è attivo e l'ultimo
// ha più di un giorno, backup subito.
export const init: ServerInit = () => {
  avviaPuliziaRegistri(db);
  avviaBackupAutomatico(db);
};

// Gli errori imprevisti del codice finiscono nel registro degli errori, oltre che nel terminale.
// Quelli voluti (una pagina che non esiste, un cammino non trovato) non sono errori da correggere.
export const handleError: HandleServerError = ({ kind, error, event }) => {
  if (kind !== 'unknown') return;
  registraErrore(db, {
    origine: 'pagina',
    messaggio: error instanceof Error ? error.message : String(error),
    percorso: `${event.request.method} ${event.url.pathname}`,
    dettagli: error instanceof Error ? error.stack ?? null : null,
  });
  console.error(error);
  return { message: 'Si è verificato un errore: è stato annotato nel registro degli errori.' };
};
