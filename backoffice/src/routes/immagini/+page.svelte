<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { NOMI_CAMPI, campiMancanti, pesoLeggibile, urlAnteprima } from '#lib/immagini.ts';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();

  let moduloCaricamento = $state<HTMLFormElement>();
  let campoFile = $state<HTMLInputElement>();
  let trascinamento = $state(false);
  let inCaricamento = $state(false);

  // Trascinando dei file sul riquadro (o scegliendoli) il caricamento parte subito.
  function rilascia(evento: DragEvent) {
    evento.preventDefault();
    trascinamento = false;
    if (!evento.dataTransfer?.files.length || !campoFile) return;
    campoFile.files = evento.dataTransfer.files;
    moduloCaricamento?.requestSubmit();
  }

  function filtra(evento: Event) {
    const modulo = (evento.currentTarget as HTMLElement).closest('form')!;
    const parametri = new URLSearchParams();
    for (const [nome, valore] of new FormData(modulo)) if (String(valore).trim()) parametri.set(nome, String(valore));
    goto(`?${parametri}`, { reset: false, replace: true });
  }

  const caricate = $derived(form?.risultati?.filter((r) => r.id !== undefined && !r.giaPresente) ?? []);
  const giaPresenti = $derived(form?.risultati?.filter((r) => r.giaPresente) ?? []);
  const scartate = $derived(form?.risultati?.filter((r) => r.messaggio) ?? []);
</script>

<svelte:head><title>Immagini · Cammini</title></svelte:head>

<header class="intestazione-pagina">
  <div>
    <h1>Immagini</h1>
    <p>
      L'archivio delle immagini delle schede delle tappe. Gli originali restano intatti; per il sito si genereranno versioni
      leggere alla pubblicazione.
    </p>
  </div>
</header>

<form
  bind:this={moduloCaricamento}
  class="caricamento riquadro"
  class:trascinamento
  method="POST"
  action="?/carica"
  enctype="multipart/form-data"
  ondragover={(evento) => { evento.preventDefault(); trascinamento = true; }}
  ondragleave={() => (trascinamento = false)}
  ondrop={rilascia}
  use:enhance={() => {
    inCaricamento = true;
    return async ({ update }) => {
      await update();
      inCaricamento = false;
    };
  }}
>
  <label>
    <input
      bind:this={campoFile}
      type="file"
      name="file"
      multiple
      accept="image/jpeg,image/png,image/webp,image/tiff,image/avif,image/heic"
      onchange={() => moduloCaricamento?.requestSubmit()}
    />
    <strong>{inCaricamento ? 'Caricamento in corso…' : 'Trascina qui le immagini o clicca per sceglierle'}</strong>
    <span>JPEG, PNG, WebP, TIFF o AVIF, fino a 40 MB l'una. Meglio caricare l'originale alla massima qualità.</span>
  </label>
</form>

{#if form?.erroreCaricamento}<p class="avviso">{form.erroreCaricamento}</p>{/if}
{#if form?.risultati?.length}
  <div class="esiti" role="status">
    {#if caricate.length}
      <p class="ok">
        {caricate.length === 1 ? 'Caricata 1 immagine' : `Caricate ${caricate.length} immagini`}: completa testo alternativo e crediti.
      </p>
    {/if}
    {#each giaPresenti as risultato (risultato.nome)}
      <p>«{risultato.nome}» era già nell'archivio: <a href="/immagini/{risultato.id}">apri l'immagine esistente</a>.</p>
    {/each}
    {#each scartate as risultato (risultato.nome)}
      <p class="errore">«{risultato.nome}» non è stata caricata: {risultato.messaggio}</p>
    {/each}
  </div>
{/if}

<form class="filtri" method="GET" onsubmit={(evento) => { evento.preventDefault(); filtra(evento); }}>
  <input type="search" name="testo" value={data.filtri.testo ?? ''} placeholder="Cerca per testo alternativo, didascalia, crediti o nome del file…" />
  <label class="spunta">
    <input type="checkbox" name="stato" value="da-completare" checked={data.filtri.daCompletare} onchange={filtra} />
    Solo da completare
  </label>
  <span class="conteggio">{data.immagini.length} di {data.totale}</span>
</form>

{#if data.immagini.length}
  <ul class="griglia">
    {#each data.immagini as immagine (immagine.id)}
      {@const mancanti = campiMancanti(immagine)}
      <li class="riquadro">
        <a href="/immagini/{immagine.id}">
          <img src={urlAnteprima(immagine.id, 320)} alt={immagine.alt} loading="lazy" width={immagine.larghezza} height={immagine.altezza} />
          <span class="titolo">{immagine.alt || immagine.nomeOriginale || 'Senza titolo'}</span>
        </a>
        <span class="dettagli">
          {immagine.larghezza}×{immagine.altezza} · {pesoLeggibile(immagine.dimensione)}
          {#if immagine.usi}· in {immagine.usi === 1 ? '1 tappa' : `${immagine.usi} tappe`}{/if}
        </span>
        {#if mancanti.length}
          <span class="etichetta">manca: {mancanti.map((c) => NOMI_CAMPI[c]).join(', ')}</span>
        {:else}
          <span class="etichetta ok">completa</span>
        {/if}
      </li>
    {/each}
  </ul>
{:else}
  <p class="vuoto">{data.totale ? 'Nessuna immagine corrisponde ai filtri.' : "L'archivio è vuoto: carica le prime immagini."}</p>
{/if}

<style>
  .caricamento { margin-bottom: 1rem; border-style: dashed; border-width: 2px; transition: background .15s; }
  .caricamento.trascinamento { background: var(--accent-tint); border-color: var(--accent); }
  .caricamento label { display: grid; gap: .3rem; padding: 1.5rem; text-align: center; cursor: pointer; }
  .caricamento input { position: absolute; width: 1px; height: 1px; opacity: 0; }
  .caricamento label:focus-within { outline: 2px solid var(--accent); outline-offset: -4px; border-radius: var(--radius-md); }
  .caricamento span { color: var(--ink-soft); font-size: .9rem; }
  .esiti { margin-bottom: 1rem; display: grid; gap: .3rem; }
  .esiti p { margin: 0; }
  .esiti .ok { color: var(--accent-ink); }
  .esiti .errore { color: var(--danger); }
  .filtri { display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; }
  .filtri input[type='search'] {
    flex: 1;
    min-width: 16rem;
    font: inherit;
    padding: .5rem .7rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  .spunta { display: flex; gap: .4rem; align-items: center; }
  .conteggio { color: var(--ink-soft); font-size: .9rem; }
  .griglia { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: 1rem; }
  .griglia li { overflow: hidden; display: grid; gap: .35rem; padding-bottom: .75rem; }
  .griglia a { display: grid; gap: .4rem; text-decoration: none; color: var(--ink); }
  .griglia img { width: 100%; height: 10rem; object-fit: cover; background: var(--surface-alt); display: block; }
  .titolo, .dettagli, .griglia .etichetta { margin: 0 .75rem; }
  .titolo { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dettagli { font-size: .8rem; color: var(--ink-soft); }
  .griglia .etichetta { justify-self: start; }
  .vuoto { color: var(--ink-faint); text-align: center; padding: 2rem; }
</style>
