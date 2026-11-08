<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();

  let inCorso = $state(false);
  const quando = (iso: string) => new Date(iso).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
  const avvisi = $derived(form?.esito?.cammini.filter((c) => c.avvisi.length) ?? []);
</script>

<svelte:head><title>Pubblicazione · Cammini</title></svelte:head>

<header class="intestazione-pagina">
  <div>
    <h1>Pubblicazione</h1>
    <p>Porta i cammini del backoffice nel portale di prova, sul PC: una cartella per cammino in <code>{data.stato.cartella}</code>.</p>
  </div>
</header>

<section class="riquadro sezione">
  {#if data.stato.generatoIl}
    <p>Ultimo aggiornamento del portale: <strong>{quando(data.stato.generatoIl)}</strong>.</p>
  {:else}
    <p>Il portale non è ancora stato aggiornato dal backoffice.</p>
  {/if}
  {#if data.stato.modificatiDopo.length}
    <p>Cammini modificati dopo: {data.stato.modificatiDopo.join(', ')}.</p>
  {:else if data.stato.generatoIl}
    <p>Il portale è aggiornato.</p>
  {/if}
  <form method="POST" action="?/pubblica" use:enhance={() => {
    inCorso = true;
    return async ({ update }) => { await update(); inCorso = false; };
  }}>
    <button class="pulsante" type="submit" disabled={inCorso}>{inCorso ? 'Aggiornamento…' : 'Aggiorna il portale'}</button>
    <a class="pulsante secondario" href="http://localhost:8000/prototipo/cammino.html" target="_blank" rel="noopener">Apri il portale ↗</a>
  </form>
  <p class="aiuto">Il portale si apre con il server del progetto: <code>py strumenti\server.py</code>. Ci vanno anche i cammini in bozza;
    la pubblicazione vera, su un server, conterrà solo quelli pubblicati (con il satellite, 118 MB, ospitato a parte).</p>
</section>

<section class="riquadro sezione demo">
  <h2>Demo da caricare su un server</h2>
  <p>Prepara in <code>{data.cartellaDemo}</code> il portale pronto da caricare così com'è, per esempio con FileZilla, su qualunque
    server web: la pagina (<code>index.html</code>), i dati, i cammini e il satellite. Si aggiorna prima il portale di prova.
    La demo è esclusa dai motori di ricerca ma è aperta a chi conosce l'indirizzo; contiene anche i cammini in bozza.</p>
  <form method="POST" action="?/demo" use:enhance={() => {
    inCorso = true;
    return async ({ update }) => { await update(); inCorso = false; };
  }}>
    <button class="pulsante" type="submit" disabled={inCorso}>{inCorso ? 'Preparazione…' : 'Prepara la demo'}</button>
    <button class="pulsante secondario" type="submit" formaction="?/apri">Apri la cartella</button>
  </form>
  {#if form?.demo}
    <p class="esito-demo" role="status">Demo pronta: {form.demo.file} file, {Math.round(form.demo.byte / 1024 / 1024)} MB{form.demo.satelliteCopiato ? ' (satellite copiato)' : ''}.
      Carica tutto il contenuto della cartella sul server: le istruzioni sono in <code>LEGGIMI.txt</code>.</p>
    {#if form.demo.avvisi.length}<ul class="avvisi-demo">{#each form.demo.avvisi as a (a)}<li>{a}</li>{/each}</ul>{/if}
  {/if}
</section>

{#if form?.errore}<p class="avviso" role="alert">Operazione non riuscita: {form.errore}</p>{/if}
{#if form?.esito}
  <div class="esito" role="status">
    <p>Portale aggiornato: {form.esito.cammini.map((c) => c.titolo).join(', ')}.
      {#if form.esito.immaginiGenerate}Immagini generate: {form.esito.immaginiGenerate}.{/if}
      {#if form.esito.fileRimossi}File vecchi rimossi: {form.esito.fileRimossi}.{/if}</p>
  </div>
  {#if avvisi.length}
    <div class="attenzione">
      <p>Da controllare:</p>
      <ul>{#each avvisi as c (c.slug)}{#each c.avvisi as a (a)}<li>{c.titolo}: {a}</li>{/each}{/each}</ul>
    </div>
  {/if}
{/if}

<style>
  .sezione { padding: 1rem 1.25rem; display: grid; gap: .6rem; max-width: 52rem; }
  .demo { margin-top: 1.25rem; }
  .demo h2 { font-size: 1.05rem; margin: 0; }
  .esito-demo { color: var(--accent-ink); }
  .avvisi-demo { margin: 0; padding-left: 1.2rem; color: var(--brand); }
  .sezione p { margin: 0; }
  form { display: flex; gap: .6rem; flex-wrap: wrap; }
  .aiuto { color: var(--ink-soft); font-size: .88rem; }
  .pulsante:disabled { opacity: .6; cursor: progress; }
  .esito { margin-top: 1rem; padding: .75rem 1rem; border-radius: var(--radius-sm); background: var(--accent-tint); color: var(--accent-ink); max-width: 52rem; }
  .esito p { margin: 0; }
  .attenzione { margin-top: 1rem; padding: .75rem 1rem; border-radius: var(--radius-sm); background: var(--brand-tint); color: var(--brand); max-width: 52rem; }
  .attenzione p { margin: 0; font-weight: 600; }
  .attenzione ul { margin: .3rem 0 0; padding-left: 1.2rem; }
</style>
