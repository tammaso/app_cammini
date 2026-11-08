<script lang="ts">
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const quando = (iso: string) => new Date(iso).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<svelte:head><title>Cammini · backoffice</title></svelte:head>

<header class="intestazione-pagina">
  <div>
    <h1>Cammini</h1>
    <p>Gestione dei contenuti del portale degli itinerari su mappa.</p>
  </div>
</header>

<div class="schede-riepilogo">
  <a class="riquadro" href="/cammini"><strong>{data.cammini}</strong><span>Cammini</span></a>
  <a class="riquadro" href="/cammini"><strong>{data.tappe}</strong><span>Tappe</span></a>
  <a class="riquadro" href="/cammini"><strong>{data.cartine}</strong><span>Cartine storiche</span></a>
  <a class="riquadro" href="/luoghi"><strong>{data.luoghi}</strong><span>Luoghi nell'anagrafe</span></a>
  <a class="riquadro" href="/immagini"><strong>{data.immagini}</strong><span>Immagini</span></a>
</div>

{#if data.cammini === 0}
  <p class="avviso">
    Il database è vuoto: per partire dai dati del prototipo, ferma il backoffice e lancia <code>npm run carica-prototipo</code>.
  </p>
{/if}

<section class="riquadro stato">
  <h2>Portale</h2>
  {#if data.pubblicazione.generatoIl}
    <p>Ultimo aggiornamento: {quando(data.pubblicazione.generatoIl)}.</p>
  {:else}
    <p>Il portale non è ancora stato aggiornato dal backoffice.</p>
  {/if}
  {#if data.pubblicazione.modificatiDopo.length}
    <p>Modificati dopo: {data.pubblicazione.modificatiDopo.join(', ')}. <a href="/pubblicazione">Aggiorna il portale</a></p>
  {/if}
</section>

<style>
  .schede-riepilogo { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
  .schede-riepilogo > * { display: grid; gap: .2rem; padding: 1.1rem 1.25rem; text-decoration: none; color: var(--ink); }
  .schede-riepilogo a:hover { border-color: var(--accent); }
  strong { font: 700 1.8rem var(--font-display); color: var(--accent-ink); }
  span { color: var(--ink-soft); }
  .stato { padding: 1rem 1.25rem; }
  .stato h2 { font-size: 1rem; }
  .stato p { margin: .3rem 0 0; }
</style>
