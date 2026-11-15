<script lang="ts">
  // Pubblicazione in due passi: prima l'anteprima (il portale com'è nel database, in una cartella a parte),
  // poi «Pubblica», che copia proprio l'anteprima nel portale.
  import { enhance } from '$app/forms';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();

  let inCorso = $state<string | null>(null);
  const quando = (iso: string) => new Date(iso).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
  const anteprima = $derived(data.anteprima);
  const cambiano = $derived(anteprima?.differenze.filter((d) => d.esito !== 'uguale') ?? []);
  const tolti = $derived(cambiano.filter((d) => d.esito === 'tolto'));
  const avvia = (quale: string) => () => {
    inCorso = quale;
    return async ({ update }: { update: () => Promise<void> }) => { await update(); inCorso = null; };
  };
  const ESITO = { nuovo: 'nuovo nel portale', tolto: 'esce dal portale', cambiato: 'cambia', uguale: 'uguale' } as const;
</script>

<svelte:head><title>Pubblicazione · Cammini</title></svelte:head>

<header class="intestazione-pagina">
  <div>
    <h1>Pubblicazione</h1>
    <p>Porta i cammini del backoffice nel portale di prova, sul PC (<code>{data.stato.cartella}</code>). Prima si guarda
      l'anteprima, poi si pubblica: nel portale va esattamente quello che si è visto.</p>
  </div>
</header>

{#if form?.errore}<p class="avviso" role="alert">Operazione non riuscita: {form.errore}</p>{/if}

<section class="riquadro sezione" aria-labelledby="titolo-anteprima">
  <h2 id="titolo-anteprima">1. Anteprima</h2>
  <p>Prepara il portale con i dati di adesso in una cartella a parte: il portale vero non cambia.</p>
  <form method="POST" action="?/anteprima" use:enhance={avvia('anteprima')}>
    <button class="pulsante" type="submit" disabled={inCorso !== null}>
      {inCorso === 'anteprima' ? 'Preparazione…' : anteprima ? "Prepara di nuovo l'anteprima" : "Prepara l'anteprima"}
    </button>
    {#if anteprima}<a class="pulsante secondario" href={data.indirizzoAnteprima} target="_blank" rel="noopener">Apri l'anteprima ↗</a>{/if}
  </form>

  {#if anteprima}
    <p>Anteprima del <strong>{quando(anteprima.generatoIl)}</strong>.
      {#each anteprima.differenze as d (d.slug)}
        <a href="{data.indirizzoAnteprima}?cammino={d.slug}" target="_blank" rel="noopener">{d.titolo} ↗</a>{' '}
      {/each}
    </p>
    {#if anteprima.modificatiDopo.length}
      <p class="attenzione">Modificati dopo l'anteprima: {anteprima.modificatiDopo.join(', ')}. Queste modifiche non sono
        nell'anteprima: preparala di nuovo per pubblicarle.</p>
    {/if}
    <div class="differenze">
      <h3>Che cosa cambia nel portale pubblicandola</h3>
      {#if cambiano.length}
        <ul>
          {#each cambiano as d (d.slug)}
            <li class={d.esito}><strong>{d.titolo}</strong>: {ESITO[d.esito]}
              {#if d.dettagli.length}<ul>{#each d.dettagli as x (x)}<li>{x}</li>{/each}</ul>{/if}
            </li>
          {/each}
        </ul>
      {:else}
        <p>Niente: il portale è già uguale all'anteprima.</p>
      {/if}
    </div>
  {/if}
  {#if form?.avvisi?.length}
    <div class="attenzione">
      <p>Da controllare:</p>
      <ul>{#each form.avvisi as c (c.slug)}{#each c.avvisi as a (a)}<li>{c.titolo}: {a}</li>{/each}{/each}</ul>
    </div>
  {/if}
  <p class="aiuto">L'anteprima e il portale si aprono con il server del progetto: <code>py strumenti\server.py</code>.</p>
</section>

<section class="riquadro sezione" aria-labelledby="titolo-pubblica">
  <h2 id="titolo-pubblica">2. Pubblica</h2>
  {#if data.stato.generatoIl}
    <p>Il portale è quello del <strong>{quando(data.stato.generatoIl)}</strong>.</p>
  {:else}
    <p>Il portale non è ancora stato pubblicato dal backoffice.</p>
  {/if}
  <form method="POST" action="?/pubblica" use:enhance={({ cancel }) => {
    const domanda = tolti.length
      ? `Pubblicare l'anteprima?\n\nAttenzione: escono dal portale ${tolti.map((d) => `«${d.titolo}»`).join(', ')}.`
      : "Pubblicare l'anteprima? Il portale diventerà come l'anteprima.";
    if (!confirm(domanda)) return cancel();
    return avvia('pubblica')();
  }}>
    <button class="pulsante" type="submit" disabled={inCorso !== null || !anteprima || !cambiano.length}>
      {inCorso === 'pubblica' ? 'Pubblicazione…' : "Pubblica l'anteprima"}
    </button>
    <a class="pulsante secondario" href="http://localhost:8000/prototipo/cammino.html" target="_blank" rel="noopener">Apri il portale ↗</a>
  </form>
  {#if !anteprima}<p class="aiuto">Si pubblica dall'anteprima: preparala qui sopra.</p>
  {:else if !cambiano.length}<p class="aiuto">Non c'è niente da pubblicare.</p>{/if}
  {#if form?.pubblicato}<p class="esito" role="status">Portale aggiornato: {form.pubblicato.cammini.join(', ')}.</p>{/if}
  <p class="aiuto">Nel portale di prova ci sono anche i cammini in bozza; la pubblicazione vera, su un server, conterrà solo quelli
    pubblicati (con il satellite, 118 MB, ospitato a parte).</p>
</section>

<section class="riquadro sezione" aria-labelledby="titolo-demo">
  <h2 id="titolo-demo">Demo da caricare su un server</h2>
  <p>Prepara in <code>{data.cartellaDemo}</code> il portale com'è pubblicato, pronto da caricare così com'è, per esempio con
    FileZilla, su qualunque server web: la pagina (<code>index.html</code>), i dati, i cammini e il satellite. La demo è esclusa
    dai motori di ricerca ma è aperta a chi conosce l'indirizzo; contiene anche i cammini in bozza.</p>
  <form method="POST" action="?/demo" use:enhance={avvia('demo')}>
    <button class="pulsante" type="submit" disabled={inCorso !== null || !data.stato.generatoIl}>{inCorso === 'demo' ? 'Preparazione…' : 'Prepara la demo'}</button>
    <button class="pulsante secondario" type="submit" formaction="?/apri">Apri la cartella</button>
  </form>
  {#if form?.demo}
    <p class="esito" role="status">Demo pronta: {form.demo.file} file, {Math.round(form.demo.byte / 1024 / 1024)} MB{form.demo.satelliteCopiato ? ' (satellite copiato)' : ''}.
      Carica tutto il contenuto della cartella sul server: le istruzioni sono in <code>LEGGIMI.txt</code>.</p>
    {#if form.demo.avvisi.length}<ul class="avvisi-demo">{#each form.demo.avvisi as a (a)}<li>{a}</li>{/each}</ul>{/if}
  {/if}
</section>

<style>
  .sezione { padding: 1rem 1.25rem; display: grid; gap: .6rem; max-width: 52rem; margin-bottom: 1.25rem; }
  .sezione h2 { font-size: 1.05rem; margin: 0; }
  .sezione p { margin: 0; }
  form { display: flex; gap: .6rem; flex-wrap: wrap; }
  .aiuto { color: var(--ink-soft); font-size: .88rem; }
  .pulsante:disabled { opacity: .6; cursor: default; }
  .esito { color: var(--accent-ink); }
  .differenze { border-top: 1px solid var(--line); padding-top: .6rem; }
  .differenze h3 { font-size: .95rem; margin: 0 0 .3rem; }
  .differenze ul { margin: 0; padding-left: 1.2rem; }
  .differenze ul ul { color: var(--ink-soft); font-size: .92rem; }
  .differenze li.tolto > strong { color: var(--danger); }
  .attenzione { padding: .6rem .9rem; border-radius: var(--radius-sm); background: var(--brand-tint); color: var(--brand); }
  .attenzione p { margin: 0; font-weight: 600; }
  .attenzione ul { margin: .3rem 0 0; padding-left: 1.2rem; }
  .avvisi-demo { margin: 0; padding-left: 1.2rem; color: var(--brand); }
</style>
