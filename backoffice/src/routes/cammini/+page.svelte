<script lang="ts">
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const quando = (iso: string) => new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
</script>

<svelte:head><title>Cammini · backoffice</title></svelte:head>

<header class="intestazione-pagina">
  <div>
    <h1>Cammini</h1>
    <p>Ogni cammino ha le sue tappe e le sue cartine storiche. Nel portale compaiono in quest'ordine.</p>
  </div>
  <a class="pulsante" href="/cammini/nuovo">Nuovo cammino</a>
</header>

<table class="riquadro elenco">
  <thead>
    <tr><th scope="col">Cammino</th><th scope="col">Stato</th><th scope="col" class="numero">Tappe</th>
      <th scope="col" class="numero">Cartine</th><th scope="col">Modificato</th></tr>
  </thead>
  <tbody>
    {#each data.cammini as c (c.id)}
      <tr>
        <td><a href="/cammini/{c.id}">{c.titolo}</a> <code class="slug">{c.slug}</code></td>
        <td><span class="etichetta" class:ok={c.stato === 'pubblicato'}>{c.stato}</span></td>
        <td class="numero">{c.tappe}</td>
        <td class="numero">{c.cartine}</td>
        <td>{quando(c.modificatoIl)}</td>
      </tr>
    {:else}
      <tr><td class="vuoto" colspan="5">Nessun cammino: creane uno o carica i dati del prototipo (npm run carica-prototipo).</td></tr>
    {/each}
  </tbody>
</table>

<style>
  .slug { color: var(--ink-faint); font-size: .85rem; margin-left: .3rem; }
</style>
