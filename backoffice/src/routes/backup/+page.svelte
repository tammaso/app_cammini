<script lang="ts">
  // Backup dei dati: cartella di destinazione (anche sincronizzata con il cloud), backup subito
  // e backup automatico giornaliero, spento finché non lo si attiva.
  import { enhance } from '$app/forms';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();

  const impostazioni = $derived(data.impostazioni);
  let inCorso = $state<string | null>(null);
  let cartella = $derived(form?.cartella ?? impostazioni.cartella ?? '');

  const quando = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' }) : null;
  const quante = (n: number, una: string, molte: string) => (n === 1 ? `1 ${una}` : `${n} ${molte}`);
  const peso = (byte: number) => `${(byte / 1024 / 1024).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`;
  // cammini-2026-10-26_09-41-05.db → 26/10/2026 09:41
  const dataCopia = (nome: string) => nome.replace(/^cammini-(\d+)-(\d+)-(\d+)_(\d+)-(\d+)-\d+\.db$/, '$3/$2/$1 $4:$5');

  const avvia = (quale: string) => () => {
    inCorso = quale;
    return async ({ update }: { update: (opzioni?: { reset?: boolean }) => Promise<void> }) => {
      await update({ reset: false });
      inCorso = null;
    };
  };
</script>

<svelte:head><title>Backup · Cammini</title></svelte:head>

<header class="intestazione-pagina">
  <div>
    <h1>Backup</h1>
    <p>
      Copia il database e le immagini originali in una cartella a tua scelta. Se la cartella è sincronizzata con il cloud
      (Google Drive per desktop, OneDrive), le copie escono anche dal PC.
    </p>
  </div>
</header>

<section class="riquadro passo" aria-labelledby="titolo-cartella">
  <h2 id="titolo-cartella">Cartella di destinazione</h2>
  {#if impostazioni.cartella}
    <p>Il backup si salva in <code>{impostazioni.cartella}</code>.</p>
    {#if data.problemaCartella}<p class="avviso" role="alert">{data.problemaCartella}</p>{/if}
  {:else}
    <p>Non hai ancora scelto la cartella.</p>
  {/if}

  <div class="azioni">
    <form method="POST" action="?/scegli" use:enhance={avvia('scegli')}>
      <button class="pulsante" type="submit" disabled={inCorso !== null}>
        {inCorso === 'scegli' ? 'Scegli nella finestra che si è aperta…' : 'Scegli la cartella…'}
      </button>
    </form>
  </div>

  <form class="manuale" method="POST" action="?/cartella" use:enhance={avvia('cartella')}>
    <label for="cartella">Oppure incolla il percorso</label>
    <div class="riga">
      <input id="cartella" name="cartella" value={cartella} placeholder="G:\Il mio Drive\Backup cammini"
        oninput={(e) => (cartella = e.currentTarget.value)} aria-invalid={form?.erroreCartella ? 'true' : undefined} />
      <button class="pulsante secondario" type="submit" disabled={inCorso !== null}>Usa questa cartella</button>
    </div>
  </form>
  {#if form?.erroreCartella}<p class="avviso" role="alert">{form.erroreCartella}</p>{/if}
  {#if form?.cartellaSalvata}<p class="esito" role="status">Cartella salvata.</p>{/if}

  <details class="aiuto">
    <summary>Come usare Google Drive o OneDrive</summary>
    <ul>
      <li>
        <strong>Google Drive</strong>: installa «Google Drive per desktop»; in Esplora file compare un'unità (di solito
        <code>G:</code>). Crea una cartella in «Il mio Drive», per esempio <code>G:\Il mio Drive\Backup cammini</code>, e
        sceglila qui.
      </li>
      <li>
        <strong>OneDrive</strong>: crea una cartella dentro OneDrive, per esempio
        <code>C:\Users\nome\OneDrive\Backup cammini</code>, e sceglila qui.
      </li>
      <li>Le copie si caricano online da sole, quando il programma di sincronizzazione è attivo.</li>
    </ul>
  </details>
</section>

<section class="riquadro passo" aria-labelledby="titolo-backup">
  <h2 id="titolo-backup">Backup</h2>
  <p class="stato">
    {#if impostazioni.ultimo}Ultimo backup riuscito: <strong>{quando(impostazioni.ultimo)}</strong>.{:else}Nessun backup ancora.{/if}
  </p>
  {#if impostazioni.errore}<p class="avviso" role="alert">L'ultimo tentativo non è riuscito: {impostazioni.errore}</p>{/if}

  <div class="azioni">
    <form method="POST" action="?/adesso" use:enhance={avvia('adesso')}>
      <button class="pulsante" type="submit" disabled={inCorso !== null || !impostazioni.cartella}>
        {inCorso === 'adesso' ? 'Backup in corso…' : 'Fai un backup adesso'}
      </button>
    </form>
  </div>
  {#if form?.backupFatto}
    <p class="esito" role="status">
      Backup fatto: database copiato{form.backupFatto.immaginiCopiate
        ? `, ${quante(form.backupFatto.immaginiCopiate, 'immagine nuova', 'immagini nuove')}`
        : ', nessuna immagine nuova'}{form.backupFatto.copieEliminate
        ? `; ${quante(form.backupFatto.copieEliminate, 'copia vecchia eliminata', 'copie vecchie eliminate')}`
        : ''}.
    </p>
  {:else if form?.erroreBackup}
    <p class="avviso" role="alert">{form.erroreBackup}</p>
  {/if}

  <form class="automatico" method="POST" action="?/automatico" use:enhance={avvia('automatico')}>
    <input type="hidden" name="attivo" value={impostazioni.automatico ? '0' : '1'} />
    <div>
      <p class="titolo-automatico">
        Backup automatico: <span class="etichetta" class:ok={impostazioni.automatico}>{impostazioni.automatico ? 'attivo' : 'spento'}</span>
      </p>
      <p class="nota">
        Una volta al giorno: all'avvio del backoffice, se l'ultimo backup ha più di 24 ore, e poi ogni 24 ore finché resta acceso.
        Si tengono le ultime 30 copie del database.
      </p>
    </div>
    <button class="pulsante secondario" type="submit" disabled={inCorso !== null || (!impostazioni.automatico && !impostazioni.cartella)}>
      {impostazioni.automatico ? 'Spegni' : 'Attiva'}
    </button>
  </form>
  {#if form?.erroreAutomatico}<p class="avviso" role="alert">{form.erroreAutomatico}</p>{/if}

  {#if data.copie.length}
    <details class="aiuto">
      <summary>Copie del database nella cartella ({data.copie.length})</summary>
      <ul class="copie">
        {#each data.copie as copia (copia.nome)}<li><span>{dataCopia(copia.nome)}</span><span class="nota">{peso(copia.byte)}</span></li>{/each}
      </ul>
    </details>
  {/if}
</section>

<section class="riquadro passo" aria-labelledby="titolo-ripristino">
  <h2 id="titolo-ripristino">Ripristino</h2>
  <p>Se un giorno servisse tornare a una copia:</p>
  <ol>
    <li>chiudi il backoffice (Ctrl+C nel suo terminale);</li>
    <li>
      nella cartella <code>backoffice\dati</code> del progetto, sposta altrove <code>cammini.db</code> (e, se ci sono,
      <code>cammini.db-wal</code> e <code>cammini.db-shm</code>);
    </li>
    <li>copia lì la copia scelta, dalla cartella <code>database</code> del backup, e rinominala <code>cammini.db</code>;</li>
    <li>copia in <code>backoffice\dati\immagini\originali</code> le immagini della cartella <code>immagini\originali</code> del backup;</li>
    <li>riavvia il backoffice: le anteprime delle immagini si rigenerano da sole.</li>
  </ol>
  <p class="nota">Conviene provare il ripristino una volta, su una copia del progetto, per essere sicuri che le copie funzionino.</p>
</section>

<style>
  .passo { padding: 1.25rem 1.5rem; display: grid; gap: .8rem; max-width: 52rem; margin-bottom: 1.25rem; }
  .passo h2 { font-size: 1.2rem; margin: 0; }
  .passo p { margin: 0; }
  .passo ol, .passo ul { margin: 0; padding-left: 1.3rem; display: grid; gap: .35rem; }
  code { word-break: break-all; }
  .nota { font-size: .88rem; color: var(--ink-soft); }
  .esito { padding: .75rem 1rem; border-radius: var(--radius-sm); background: var(--accent-tint); color: var(--accent-ink); }
  .avviso { margin: 0; }
  .manuale { display: grid; gap: .3rem; }
  .manuale label { font-weight: 600; font-size: .92rem; }
  .riga { display: flex; gap: .5rem; flex-wrap: wrap; }
  .riga input {
    flex: 1 1 20rem;
    font: inherit;
    padding: .5rem .7rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  .riga input[aria-invalid='true'] { border-color: var(--danger); }
  .aiuto { padding: .6rem .9rem; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface-alt); font-size: .92rem; }
  .aiuto summary { cursor: pointer; font-weight: 600; }
  .aiuto ul { margin-top: .5rem; }
  .automatico {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-top: .8rem;
    border-top: 1px solid var(--line);
  }
  .titolo-automatico { font-weight: 600; margin-bottom: .2rem !important; }
  .copie { list-style: none; padding: 0 !important; }
  .copie li { display: flex; justify-content: space-between; gap: 1rem; font-variant-numeric: tabular-nums; }
</style>
