<script lang="ts">
  import { TIPI_LUOGO } from '#lib/cammini.ts';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<svelte:head><title>Luoghi · Cammini</title></svelte:head>

<header class="intestazione-pagina">
  <div>
    <h1>Luoghi</h1>
    <p>L'anagrafe dei luoghi: tappe, città e vette delle cartine, punti di controllo. Cresce con ogni cartina importata.</p>
  </div>
  <a class="pulsante" href="/luoghi/nuovo">Nuovo luogo</a>
</header>

<form class="ricerca" method="GET">
  <label for="q" class="solo-lettori">Cerca un luogo</label>
  <input id="q" name="q" type="search" value={data.ricerca} placeholder="Cerca per nome, nome antico o altri nomi…" />
  <button class="pulsante secondario" type="submit">Cerca</button>
</form>

<table class="riquadro elenco">
  <thead>
    <tr><th scope="col">Nome</th><th scope="col">Altri nomi</th><th scope="col">Tipo</th><th scope="col">Certezza</th>
      <th scope="col" class="numero">Lat, lng</th><th scope="col" class="numero">Usi</th></tr>
  </thead>
  <tbody>
    {#each data.luoghi as l (l.id)}
      <tr>
        <td><a href="/luoghi/{l.id}">{l.nome}</a></td>
        <td class="altri">{[l.nomeAntico, ...l.altriNomi].filter(Boolean).join(', ')}</td>
        <td>{TIPI_LUOGO[l.tipo]}</td>
        <td><span class="etichetta" class:ok={l.certezza === 'certa'}>{l.certezza}</span></td>
        <td class="numero">{l.lat.toFixed(3)}, {l.lng.toFixed(3)}</td>
        <td class="numero">{l.usi}</td>
      </tr>
    {:else}
      <tr><td class="vuoto" colspan="6">{data.ricerca ? 'Nessun luogo trovato.' : "L'anagrafe è vuota."}</td></tr>
    {/each}
  </tbody>
</table>

<style>
  .ricerca { display: flex; gap: .5rem; margin-bottom: 1rem; max-width: 34rem; }
  .ricerca input { flex: 1; font: inherit; padding: .55rem .7rem; border: 1px solid var(--line); border-radius: var(--radius-sm); }
  .altri { color: var(--ink-soft); font-size: .9rem; }
  .solo-lettori { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
