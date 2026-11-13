<script lang="ts">
  import { enhance } from '$app/forms';
  import { LICENZE_SUGGERITE, NOMI_CAMPI, campiMancanti, pesoLeggibile, urlAnteprima } from '#lib/immagini.ts';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();

  const immagine = $derived(data.immagine);
  const errori = $derived(form?.errori ?? {});
  const valori = $derived(form?.valori ?? {
    alt: immagine.alt,
    didascalia: immagine.didascalia ?? '',
    crediti: immagine.crediti ?? '',
    licenza: immagine.licenza ?? '',
  });
  const mancanti = $derived(campiMancanti(immagine));
  const titolo = $derived(immagine.alt || immagine.nomeOriginale || `Immagine ${immagine.id}`);
  const dataCaricamento = $derived(
    immagine.caricataIl
      ? new Date(immagine.caricataIl).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })
      : '—',
  );
</script>

<svelte:head><title>{titolo} · Cammini</title></svelte:head>

<header class="intestazione-pagina">
  <div>
    <p><a href="/immagini">← Immagini</a></p>
    <h1>{titolo}</h1>
    {#if mancanti.length}
      <p><span class="etichetta">manca: {mancanti.map((c) => NOMI_CAMPI[c]).join(', ')}</span></p>
    {:else}
      <p><span class="etichetta ok">completa</span></p>
    {/if}
  </div>
</header>

{#if form?.salvata}<p class="conferma" role="status">Dati dell'immagine salvati.</p>{/if}
{#if form?.messaggio}<p class="avviso" role="alert">{form.messaggio}</p>{/if}

<div class="disposizione">
  <figure class="riquadro anteprima">
    <a href={urlAnteprima(immagine, 1600)} target="_blank" rel="noopener">
      <img src={urlAnteprima(immagine, 1600)} alt={immagine.alt} width={immagine.larghezza} height={immagine.altezza} />
    </a>
    <figcaption>
      <dl>
        <dt>Dimensioni</dt><dd>{immagine.larghezza} × {immagine.altezza} px</dd>
        <dt>Peso</dt><dd>{pesoLeggibile(immagine.dimensione)}</dd>
        <dt>File caricato</dt><dd>{immagine.nomeOriginale ?? '—'}</dd>
        <dt>Caricata il</dt><dd>{dataCaricamento}</dd>
        <dt>Impronta</dt><dd><code title={immagine.sha256}>{immagine.sha256.slice(0, 12)}</code></dd>
      </dl>
      {#if immagine.larghezza < 1600}
        <p class="nota">È larga meno di 1600 px: nell'ingrandimento a tutto schermo potrebbe apparire sfocata.</p>
      {/if}
    </figcaption>
  </figure>

  <div class="colonna">
    <form class="riquadro modulo" method="POST" action="?/salva" use:enhance={() => async ({ update }) => update({ reset: false })}>
      <div class="campo">
        <label for="alt">Testo alternativo</label>
        <span class="aiuto">
          Descrive l'immagine a chi non la vede (lettori di schermo). Breve e concreto: «Facciata di Santa Maria Novella con
          l'oculo e il timpano».
        </span>
        <input id="alt" name="alt" required maxlength="300" value={valori.alt} aria-invalid={errori.alt ? 'true' : undefined} />
        {#if errori.alt}<span class="errore">{errori.alt}</span>{/if}
      </div>
      <div class="campo">
        <label for="didascalia">Didascalia</label>
        <span class="aiuto">Per ora il portale non la mostra: nella scheda della tappa compaiono i crediti.</span>
        <textarea id="didascalia" name="didascalia" maxlength="1000" value={valori.didascalia}></textarea>
        {#if errori.didascalia}<span class="errore">{errori.didascalia}</span>{/if}
      </div>
      <div class="campo">
        <label for="crediti">Crediti</label>
        <span class="aiuto">
          Obbligatori per pubblicare. Autore e fonte: «Mario Rossi / Shutterstock» oppure «© Opera della Metropolitana di
          Siena».
        </span>
        <input id="crediti" name="crediti" maxlength="300" value={valori.crediti} />
        {#if errori.crediti}<span class="errore">{errori.crediti}</span>{/if}
      </div>
      <div class="campo">
        <label for="licenza">Licenza</label>
        <span class="aiuto">Facoltativa. Scegli tra i suggerimenti o scrivi la licenza indicata dalla fonte.</span>
        <input id="licenza" name="licenza" maxlength="200" list="licenze" value={valori.licenza} />
        <datalist id="licenze">
          {#each LICENZE_SUGGERITE as licenza (licenza)}<option value={licenza}></option>{/each}
        </datalist>
        {#if errori.licenza}<span class="errore">{errori.licenza}</span>{/if}
      </div>
      <div class="azioni">
        <button class="pulsante" type="submit">Salva</button>
        <a class="pulsante secondario" href="/immagini">Torna all'archivio</a>
      </div>
    </form>

    <section class="riquadro uso">
      <h2>Dove è usata</h2>
      {#if immagine.elencoUsi.length}
        <ul>
          {#each immagine.elencoUsi as uso (uso.tappaId)}
            <li><a href="/cammini/{uso.camminoId}/tappe/{uso.tappaId}">{uso.tappa}</a> · {uso.titolo}</li>
          {/each}
        </ul>
      {:else}
        <p>Non ancora usata in nessuna tappa.</p>
      {/if}
      <form
        method="POST"
        action="?/elimina"
        use:enhance={({ cancel }) => {
          if (!confirm("Eliminare l'immagine dall'archivio? Il file originale verrà cancellato.")) cancel();
        }}
      >
        <button class="pulsante pericolo" type="submit" disabled={immagine.usi > 0}
          title={immagine.usi > 0 ? 'Toglila prima dalle tappe in cui è usata' : undefined}>
          Elimina dall'archivio
        </button>
      </form>
    </section>
  </div>
</div>

<style>
  .disposizione { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(20rem, 1fr); gap: 1.5rem; align-items: start; }
  .anteprima { margin: 0; overflow: hidden; }
  .anteprima img { width: 100%; height: auto; max-height: 70vh; object-fit: contain; display: block; background: var(--surface-alt); }
  figcaption { padding: 1rem 1.25rem; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: .3rem 1rem; margin: 0; font-size: .9rem; }
  dt { color: var(--ink-soft); }
  dd { margin: 0; overflow-wrap: anywhere; }
  .nota { font-size: .85rem; color: var(--brand); margin: .75rem 0 0; }
  .colonna { display: grid; gap: 1rem; }
  .modulo { max-width: none; }
  .campo textarea { min-height: 6rem; }
  .uso { padding: 1rem 1.25rem; }
  .uso h2 { font-size: 1rem; }
  .uso ul { margin: 0 0 1rem; padding-left: 1.1rem; }
  .uso p { color: var(--ink-soft); margin: 0 0 1rem; }
  .pulsante:disabled { opacity: .5; cursor: not-allowed; }
  .conferma { padding: .75rem 1rem; border-radius: var(--radius-sm); background: var(--accent-tint); color: var(--accent-ink); margin-bottom: 1rem; }
  @media (max-width: 1000px) { .disposizione { grid-template-columns: 1fr; } }
</style>
