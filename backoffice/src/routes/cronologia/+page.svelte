<script lang="ts">
  // Cronologia: le copie di sicurezza (backup automatico, acceso di serie, e ripristino), le modifiche del
  // backoffice; in fondo, piegati, impostazioni del backup, errori e ripristino a mano.
  import { enhance } from '$app/forms';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();

  const impostazioni = $derived(data.impostazioni);
  let inCorso = $state<string | null>(null);
  let cartella = $derived(form?.cartella ?? (impostazioni.predefinita ? '' : impostazioni.cartella));
  let tutte = $state(false);
  const MOSTRATE = 30;
  const modifiche = $derived(tutte ? data.modifiche : data.modifiche.slice(0, MOSTRATE));

  const quando = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' }) : null;
  const breve = (iso: string) => new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
  const quante = (n: number, una: string, molte: string) => (n === 1 ? `1 ${una}` : `${n} ${molte}`);
  const peso = (byte: number) => `${(byte / 1024 / 1024).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`;
  // cammini-2026-10-26_09-41-05.db → 26/10/2026 09:41, con i secondi (09:41:05) se un'altra copia è dello stesso minuto:
  // succede con la copia dello stato di prima, salvata subito dopo un backup e un ripristino
  const minuto = (nome: string) => nome.slice(0, -'-05.db'.length);
  const dataCopia = (nome: string) => {
    const conSecondi = data.copie.filter((c) => minuto(c.nome) === minuto(nome)).length > 1;
    return nome.replace(/^cammini-(\d+)-(\d+)-(\d+)_(\d+)-(\d+)-(\d+)\.db$/, conSecondi ? '$3/$2/$1 $4:$5:$6' : '$3/$2/$1 $4:$5');
  };

  const avvia = (quale: string) => () => {
    inCorso = quale;
    return async ({ update }: { update: (opzioni?: { reset?: boolean }) => Promise<void> }) => {
      await update({ reset: false });
      inCorso = null;
    };
  };
  // il ripristino sostituisce tutto il database: si chiede conferma
  const conferma = ({ formData, cancel }: { formData: FormData; cancel: () => void }) => {
    const nome = String(formData.get('nome') ?? '');
    const domanda = `Ripristinare la copia del ${dataCopia(nome)}?\n\nIl database del backoffice tornerà com'era allora: ` +
      'le modifiche fatte dopo non ci saranno più. Lo stato di adesso viene salvato prima tra le copie, così puoi tornarci.';
    if (!confirm(domanda)) return cancel();
    return avvia('ripristina')();
  };

  const AZIONE = { creazione: 'Creazione', modifica: 'Modifica', eliminazione: 'Eliminazione', ripristino: 'Ripristino' } as const;
  const OGGETTO = {
    cammino: 'Cammino', tappa: 'Tappa', luogo: 'Luogo', cartina: 'Cartina', stile: 'Stile', immagine: 'Immagine',
    pubblicazione: 'Pubblicazione', database: 'Database',
  } as const;
  const ORIGINE = { pagina: 'Pagina', pubblicazione: 'Pubblicazione', importazione: 'Importazione', backup: 'Backup' } as const;
</script>

<svelte:head><title>Cronologia · Cammini</title></svelte:head>

<header class="intestazione-pagina">
  <div>
    <h1>Cronologia</h1>
    <p>Che cosa è cambiato nel backoffice e le copie di sicurezza del lavoro, per tornare indietro se serve.</p>
  </div>
</header>

<section class="riquadro passo" aria-labelledby="titolo-copie">
  <h2 id="titolo-copie">Copie di sicurezza</h2>
  {#if impostazioni.automatico}
    <p>Il backoffice fa da solo una copia al giorno di database, immagini e file delle cartine, in <code>{impostazioni.cartella}</code>.</p>
  {:else}
    <p class="avviso" role="alert">Il backup automatico è spento: le copie si fanno solo con «Fai una copia adesso». Si riaccende nelle
      impostazioni del backup, qui sotto.</p>
  {/if}
  {#if impostazioni.predefinita}
    <p class="nota">La cartella è sullo stesso disco del PC: le copie salvano dagli errori, non da un guasto o dal furto del computer.
      Meglio una cartella sincronizzata con Google Drive o OneDrive: si sceglie nelle impostazioni del backup, qui sotto.</p>
  {/if}
  {#if data.problemaCartella}<p class="avviso" role="alert">{data.problemaCartella}</p>{/if}
  <p class="stato">
    {#if impostazioni.ultimo}Ultima copia: <strong>{quando(impostazioni.ultimo)}</strong>.{:else}Nessuna copia ancora.{/if}
  </p>
  {#if impostazioni.errore}<p class="avviso" role="alert">L'ultimo tentativo non è riuscito: {impostazioni.errore}</p>{/if}

  <form method="POST" action="?/adesso" use:enhance={avvia('adesso')}>
    <button class="pulsante" type="submit" disabled={inCorso !== null}>
      {inCorso === 'adesso' ? 'Copia in corso…' : 'Fai una copia adesso'}
    </button>
  </form>
  {#if form?.backupFatto}
    <p class="esito" role="status">
      Copia fatta: database copiato{form.backupFatto.immaginiCopiate
        ? `, ${quante(form.backupFatto.immaginiCopiate, 'immagine nuova', 'immagini nuove')}`
        : ', nessuna immagine nuova'}{form.backupFatto.copieEliminate
        ? `; ${quante(form.backupFatto.copieEliminate, 'copia vecchia eliminata', 'copie vecchie eliminate')}`
        : ''}.
    </p>
  {:else if form?.erroreBackup}
    <p class="avviso" role="alert">{form.erroreBackup}</p>
  {/if}

  <h3>Tornare a una copia</h3>
  {#if data.copie.length}
    <p>
      Riporta il database com'era in una copia, anche una fatta su un altro computer. Prima di sostituirlo il backoffice
      salva lo stato di adesso tra le copie: se cambi idea, ripristini quella. Tornano anche le immagini e i file SVG delle
      cartine che mancano. Il portale non cambia finché non lo pubblichi di nuovo.
    </p>
    <form class="manuale" method="POST" action="?/ripristina" use:enhance={conferma}>
      <label for="copia">Copia da ripristinare</label>
      <div class="riga">
        <select id="copia" name="nome">
          {#each data.copie as copia (copia.nome)}<option value={copia.nome}>{dataCopia(copia.nome)} · {peso(copia.byte)}</option>{/each}
        </select>
        <button class="pulsante secondario" type="submit" disabled={inCorso !== null}>
          {inCorso === 'ripristina' ? 'Ripristino in corso…' : 'Ripristina questa copia'}
        </button>
      </div>
    </form>
    {#if form?.ripristinoFatto}
      {@const r = form.ripristinoFatto}
      <div class="esito" role="status">
        <p>
          Database ripristinato dalla copia del {dataCopia(r.nome)}. Lo stato di prima è salvato nella copia del
          {dataCopia(r.sicurezza)}: per annullare, ripristina quella.
        </p>
        {#if r.immaginiCopiate || r.cartineCopiate}
          <p>
            Tornati dal backup: {quante(r.immaginiCopiate, 'immagine', 'immagini')} e
            {quante(r.cartineCopiate, 'file SVG di cartina', 'file SVG di cartine')}.
          </p>
        {/if}
      </div>
      {#if r.immaginiMancanti.length || r.cartineMancanti.length}
        <p class="avviso" role="alert">
          Mancano, né qui né nel backup, {quante(r.immaginiMancanti.length, 'immagine', 'immagini')} e
          {quante(r.cartineMancanti.length, 'file SVG di cartina', 'file SVG di cartine')}: le schede o le cartine che li usano
          resteranno senza finché non li ricarichi.
        </p>
      {/if}
    {:else if form?.erroreRipristino}
      <p class="avviso" role="alert">{form.erroreRipristino}</p>
    {/if}
  {:else}
    <p class="nota">Qui potrai riportare il database com'era in una copia: nella cartella non ci sono ancora copie.</p>
  {/if}
</section>

<section class="riquadro passo" aria-labelledby="titolo-modifiche">
  <h2 id="titolo-modifiche">Modifiche</h2>
  <p class="nota">Che cosa è cambiato nel backoffice, dalla più recente. Si conservano per {data.giorni.modifiche} giorni.</p>
  {#if data.modifiche.length}
    <table class="tabella">
      <thead><tr><th scope="col">Quando</th><th scope="col">Che cosa</th><th scope="col">Dove</th><th scope="col">Modifica</th></tr></thead>
      <tbody>
        {#each modifiche as m (m.id)}
          <tr>
            <td class="data">{breve(m.quando)}</td>
            <td><span class="etichetta {m.azione}">{AZIONE[m.azione]}</span> <span class="oggetto">{OGGETTO[m.oggetto]}</span></td>
            <td>{#if m.camminoEsiste}<a href="/cammini/{m.camminoId}">{m.titolo}</a>{:else}{m.titolo}{/if}</td>
            <td>{m.descrizione}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if data.modifiche.length > MOSTRATE}
      <button class="pulsante secondario" type="button" onclick={() => (tutte = !tutte)}>
        {tutte ? 'Mostra solo le ultime' : `Mostra tutte (${data.modifiche.length})`}
      </button>
    {/if}
  {:else}
    <p class="nota">Nessuna modifica registrata.</p>
  {/if}
</section>

<details class="riquadro piegato">
  <summary>Impostazioni del backup</summary>
  <div class="passo interno">
    <p>Cartella delle copie: <code>{impostazioni.cartella}</code>{impostazioni.predefinita ? ' (quella di serie)' : ''}.</p>
    <form method="POST" action="?/scegli" use:enhance={avvia('scegli')}>
      <button class="pulsante secondario" type="submit" disabled={inCorso !== null}>
        {inCorso === 'scegli' ? 'Scegli nella finestra che si è aperta…' : 'Scegli un\'altra cartella…'}
      </button>
    </form>
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
    <ul class="nota">
      <li><strong>Google Drive</strong>: installa «Google Drive per desktop»; in Esplora file compare un'unità (di solito <code>G:</code>).
        Crea una cartella in «Il mio Drive», per esempio <code>G:\Il mio Drive\Backup cammini</code>, e sceglila qui.</li>
      <li><strong>OneDrive</strong>: crea una cartella dentro OneDrive, per esempio <code>C:\Users\nome\OneDrive\Backup cammini</code>.</li>
      <li>Le copie si caricano online da sole, quando il programma di sincronizzazione è attivo.</li>
    </ul>

    <form class="automatico" method="POST" action="?/automatico" use:enhance={avvia('automatico')}>
      <input type="hidden" name="attivo" value={impostazioni.automatico ? '0' : '1'} />
      <div>
        <p class="titolo-automatico">
          Backup automatico: <span class="etichetta" class:ok={impostazioni.automatico}>{impostazioni.automatico ? 'acceso' : 'spento'}</span>
        </p>
        <p class="nota">Una volta al giorno: all'avvio del backoffice, se l'ultima copia ha più di 24 ore, e poi ogni 24 ore finché resta
          acceso. Si tengono le ultime 30 copie del database.</p>
      </div>
      <button class="pulsante secondario" type="submit" disabled={inCorso !== null}>{impostazioni.automatico ? 'Spegni' : 'Accendi'}</button>
    </form>
  </div>
</details>

<details class="riquadro piegato">
  <summary>Errori ({data.errori.length})</summary>
  <div class="passo interno">
    <p class="nota">Gli errori del backoffice, per chi ne cura il funzionamento. Si conservano per {data.giorni.errori} giorni.</p>
    {#if data.errori.length}
      <ul class="errori">
        {#each data.errori as e (e.id)}
          <li>
            <p><span class="data">{breve(e.quando)}</span> <span class="etichetta">{ORIGINE[e.origine] ?? e.origine}</span>
              {#if e.percorso}<code>{e.percorso}</code>{/if}</p>
            <p class="messaggio">{e.messaggio}</p>
            {#if e.dettagli}<details><summary>Dettagli tecnici</summary><pre>{e.dettagli}</pre></details>{/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="nota">Nessun errore registrato.</p>
    {/if}
  </div>
</details>

<details class="riquadro piegato">
  <summary>Se il backoffice non si avvia: il ripristino a mano</summary>
  <ol class="passo interno">
    <li>chiudi il backoffice (Ctrl+C nel suo terminale);</li>
    <li>nella cartella <code>backoffice\dati</code> del progetto, sposta altrove <code>cammini.db</code> (e, se ci sono,
      <code>cammini.db-wal</code> e <code>cammini.db-shm</code>);</li>
    <li>copia lì la copia scelta, dalla cartella <code>database</code> del backup, e rinominala <code>cammini.db</code>;</li>
    <li>copia in <code>backoffice\dati\immagini\originali</code> le immagini della cartella <code>immagini\originali</code> del backup;</li>
    <li>copia in <code>backoffice\dati\cartine</code> i file della cartella <code>cartine</code> del backup;</li>
    <li>riavvia il backoffice: le anteprime delle immagini si rigenerano da sole.</li>
  </ol>
</details>

<style>
  .passo { padding: 1.25rem 1.5rem; display: grid; gap: .8rem; max-width: 60rem; margin-bottom: 1.25rem; }
  .passo h2 { font-size: 1.2rem; margin: 0; }
  .passo h3 { font-size: 1rem; margin: .4rem 0 0; padding-top: .8rem; border-top: 1px solid var(--line); }
  .passo p { margin: 0; }
  .passo ul { margin: 0; padding-left: 1.3rem; display: grid; gap: .35rem; }
  ol.passo { padding-left: 2.8rem; gap: .35rem; }
  code { word-break: break-all; }
  .nota { font-size: .88rem; color: var(--ink-soft); }
  .esito { padding: .75rem 1rem; border-radius: var(--radius-sm); background: var(--accent-tint); color: var(--accent-ink); display: grid; gap: .4rem; }
  .avviso { margin: 0; }
  .manuale { display: grid; gap: .3rem; }
  .manuale label { font-weight: 600; font-size: .92rem; }
  .riga { display: flex; gap: .5rem; flex-wrap: wrap; }
  .riga input, .riga select {
    flex: 1 1 18rem; font: inherit; padding: .5rem .7rem; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface, #fff);
  }
  .riga input[aria-invalid='true'] { border-color: var(--danger); }
  .tabella { width: 100%; border-collapse: collapse; font-size: .92rem; }
  .tabella th, .tabella td { padding: .5rem .6rem; text-align: left; vertical-align: top; border-bottom: 1px solid var(--line); }
  .tabella th { font-size: .8rem; color: var(--ink-soft); font-weight: 600; }
  .data { white-space: nowrap; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
  .oggetto { white-space: nowrap; }
  .etichetta.creazione, .etichetta.ripristino { background: var(--accent-tint); color: var(--accent-ink); }
  .etichetta.eliminazione { background: var(--danger-tint); color: var(--danger); }
  .piegato { max-width: 60rem; margin-bottom: 1rem; padding: 0; }
  .piegato > summary { cursor: pointer; font-weight: 600; padding: .9rem 1.5rem; }
  .interno { margin: 0; padding-top: 0; }
  .automatico { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-top: .8rem; border-top: 1px solid var(--line); }
  .titolo-automatico { font-weight: 600; margin-bottom: .2rem !important; }
  .errori { list-style: none; padding: 0 !important; }
  .errori li { padding: .6rem 0; border-bottom: 1px solid var(--line); }
  .errori p { margin: 0 0 .3rem; }
  .messaggio { font-weight: 600; }
  pre { white-space: pre-wrap; font-size: .8rem; margin: .4rem 0 0; color: var(--ink-soft); }
</style>
