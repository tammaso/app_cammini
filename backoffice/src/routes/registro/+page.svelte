<script lang="ts">
  // Registro delle modifiche e registro degli errori.
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  let vista = $state<'modifiche' | 'errori'>('modifiche');

  const quando = (iso: string) => new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
  const AZIONE = { creazione: 'Creazione', modifica: 'Modifica', eliminazione: 'Eliminazione', ripristino: 'Ripristino' } as const;
  const OGGETTO = {
    cammino: 'Cammino', tappa: 'Tappa', luogo: 'Luogo', cartina: 'Cartina', stile: 'Stile', immagine: 'Immagine',
    pubblicazione: 'Pubblicazione',
  } as const;
  const ORIGINE = { pagina: 'Pagina', pubblicazione: 'Pubblicazione', importazione: 'Importazione', backup: 'Backup' } as const;
</script>

<svelte:head><title>Registro · Cammini</title></svelte:head>

<header class="intestazione-pagina">
  <div>
    <h1>Registro</h1>
    <p>
      Che cosa è cambiato nel backoffice e quali errori si sono verificati. Le modifiche si conservano per
      {data.giorni.modifiche} giorni, gli errori per {data.giorni.errori}: poi si cancellano da sole.
    </p>
  </div>
</header>

<div class="scelta" role="group" aria-label="Che cosa mostrare">
  <button type="button" class="pulsante" class:secondario={vista !== 'modifiche'} aria-pressed={vista === 'modifiche'}
    onclick={() => (vista = 'modifiche')}>Modifiche ({data.modifiche.length})</button>
  <button type="button" class="pulsante" class:secondario={vista !== 'errori'} aria-pressed={vista === 'errori'}
    onclick={() => (vista = 'errori')}>Errori ({data.errori.length})</button>
</div>

{#if vista === 'modifiche'}
  {#if data.modifiche.length}
    <table class="riquadro tabella">
      <thead><tr><th scope="col">Quando</th><th scope="col">Che cosa</th><th scope="col">Dove</th><th scope="col">Modifica</th></tr></thead>
      <tbody>
        {#each data.modifiche as m (m.id)}
          <tr>
            <td class="data">{quando(m.quando)}</td>
            <td><span class="etichetta {m.azione}">{AZIONE[m.azione]}</span> <span class="oggetto">{OGGETTO[m.oggetto]}</span></td>
            <td>{#if m.camminoEsiste}<a href="/cammini/{m.camminoId}">{m.titolo}</a>{:else}{m.titolo}{/if}</td>
            <td>{m.descrizione}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="vuoto">Nessuna modifica registrata.</p>
  {/if}
{:else if data.errori.length}
  <ul class="errori">
    {#each data.errori as e (e.id)}
      <li class="riquadro">
        <p><span class="data">{quando(e.quando)}</span> <span class="etichetta">{ORIGINE[e.origine] ?? e.origine}</span>
          {#if e.percorso}<code>{e.percorso}</code>{/if}</p>
        <p class="messaggio">{e.messaggio}</p>
        {#if e.dettagli}
          <details><summary>Dettagli tecnici</summary><pre>{e.dettagli}</pre></details>
        {/if}
      </li>
    {/each}
  </ul>
{:else}
  <p class="vuoto">Nessun errore registrato.</p>
{/if}

<style>
  .scelta { display: flex; gap: .5rem; margin-bottom: 1rem; }
  .tabella { width: 100%; border-collapse: collapse; font-size: .92rem; }
  .tabella th, .tabella td { padding: .55rem .75rem; text-align: left; vertical-align: top; border-bottom: 1px solid var(--line); }
  .tabella th { font-size: .8rem; color: var(--ink-soft); font-weight: 600; }
  .data { white-space: nowrap; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
  .oggetto { white-space: nowrap; }
  .etichetta.creazione, .etichetta.ripristino { background: var(--accent-tint); color: var(--accent-ink); }
  .etichetta.eliminazione { background: var(--danger-tint); color: var(--danger); }
  .errori { list-style: none; margin: 0; padding: 0; display: grid; gap: .6rem; }
  .errori li { padding: .8rem 1rem; }
  .errori p { margin: 0 0 .3rem; }
  .messaggio { font-weight: 600; }
  pre { white-space: pre-wrap; font-size: .8rem; margin: .4rem 0 0; color: var(--ink-soft); }
  .vuoto { color: var(--ink-soft); }
  .solo-lettori { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
