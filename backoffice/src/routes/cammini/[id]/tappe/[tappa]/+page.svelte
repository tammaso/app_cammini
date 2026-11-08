<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import SelettoreImmagini from '#lib/components/SelettoreImmagini.svelte';
  import { urlAnteprima } from '#lib/immagini.ts';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();

  const t = $derived(data.tappa);
  const titolo = $derived(t ? t.nome : 'Nuova tappa');
  const valori = $derived(form?.valori ?? {
    nome: t?.nome ?? '', breve: t?.breve ?? '', luogoId: t ? String(t.luogoId) : '', luogoAttuale: t?.luogoAttuale ?? '',
    riferimento: t?.riferimento ?? '', testo: t?.testo ?? '', approfondimento: t?.approfondimento ?? '',
    immagineId: t?.immagineId ? String(t.immagineId) : '', secondaria: t?.secondaria ? 'on' : '',
  });
  const errori: Record<string, string | undefined> = $derived(form?.errori ?? {});

  // luogo scelto, per mostrarne le coordinate
  let luogoId = $state('');
  $effect.pre(() => { luogoId = valori.luogoId; });
  const luogo = $derived(data.luoghi.find((l) => String(l.id) === luogoId));

  // immagine della scheda: si sceglie dall'archivio
  let immagine = $state<{ id: number; alt: string } | null>(null);
  $effect.pre(() => { immagine = data.immagine; });
  let selettoreAperto = $state(false);
  const salvata = $derived(form?.salvata || page.url.searchParams.has('salvata'));
</script>

<svelte:head><title>{titolo} · Cammini</title></svelte:head>

<header class="intestazione-pagina">
  <div>
    <p><a href="/cammini/{data.cammino.id}">← {data.cammino.titolo}</a></p>
    <h1>{t ? `Tappa ${t.posizione + 1}: ${t.nome}` : titolo}</h1>
  </div>
</header>

{#if salvata}<p class="conferma" role="status">Tappa salvata. Per vederla nel portale, <a href="/pubblicazione">aggiorna il portale</a>.</p>{/if}
{#if form?.tracciatoTolto}<p class="conferma" role="status">Tracciato tolto: dalla tappa precedente ora c'è una linea dritta.</p>{/if}

<form class="riquadro modulo" method="POST" action="?/salva" use:enhance={() => async ({ update }) => update({ reset: false })}>
  <div class="due">
    <div class="campo">
      <label for="nome">Nome</label>
      <span class="aiuto">Nel pannello e nella scheda: «Ebron e le Querce di Mamre».</span>
      <input id="nome" name="nome" value={valori.nome} required aria-invalid={errori.nome ? 'true' : undefined} />
      {#if errori.nome}<span class="errore">{errori.nome}</span>{/if}
    </div>
    <div class="campo">
      <label for="breve">Nome breve</label>
      <span class="aiuto">Accanto al pin sulla carta: «Ebron».</span>
      <input id="breve" name="breve" value={valori.breve} required maxlength="24" aria-invalid={errori.breve ? 'true' : undefined} />
      {#if errori.breve}<span class="errore">{errori.breve}</span>{/if}
    </div>
  </div>

  <div class="campo">
    <label for="luogoId">Luogo</label>
    <span class="aiuto">Le coordinate del pin vengono dall'anagrafe dei luoghi. Se il luogo manca, <a href="/luoghi/nuovo" target="_blank">aggiungilo</a> e ricarica la pagina.</span>
    <select id="luogoId" name="luogoId" bind:value={luogoId} required aria-invalid={errori.luogoId ? 'true' : undefined}>
      <option value="" disabled>Scegli il luogo…</option>
      {#each data.luoghi as l (l.id)}<option value={String(l.id)}>{l.nome}</option>{/each}
    </select>
    {#if luogo}
      <span class="aiuto">{luogo.lat}, {luogo.lng} · identificazione {luogo.certezza} · <a href="/luoghi/{luogo.id}">scheda del luogo</a></span>
    {/if}
    {#if errori.luogoId}<span class="errore">{errori.luogoId}</span>{/if}
  </div>

  <div class="due">
    <div class="campo">
      <label for="luogoAttuale">Dove si trova oggi</label>
      <input id="luogoAttuale" name="luogoAttuale" value={valori.luogoAttuale} placeholder="Tell el-Muqayyar, Iraq meridionale" />
    </div>
    <div class="campo">
      <label for="riferimento">Riferimento</label>
      <input id="riferimento" name="riferimento" value={valori.riferimento} placeholder="Gen 11,27-31" />
    </div>
  </div>

  <div class="campo">
    <label for="testo">Testo del pannello</label>
    <textarea id="testo" name="testo" value={valori.testo} required aria-invalid={errori.testo ? 'true' : undefined}></textarea>
    {#if errori.testo}<span class="errore">{errori.testo}</span>{/if}
  </div>
  <div class="campo">
    <label for="approfondimento">Approfondimento della scheda</label>
    <span class="aiuto">Il testo della finestra che si apre cliccando il pin. Se è vuoto, la scheda ripete il testo del pannello.</span>
    <textarea id="approfondimento" name="approfondimento" value={valori.approfondimento}></textarea>
  </div>

  <div class="campo">
    <span class="etichetta-campo">Immagine della scheda</span>
    <span class="aiuto">Facoltativa: si apre anche a tutto schermo, con lo zoom. Testo alternativo e crediti si scrivono nell'archivio.</span>
    <input type="hidden" name="immagineId" value={immagine ? String(immagine.id) : ''} />
    <div class="immagine">
      {#if immagine}
        <img src={urlAnteprima(immagine.id, 320)} alt={immagine.alt} />
        <a href="/immagini/{immagine.id}">{immagine.alt || 'Immagine senza testo alternativo'}</a>
      {:else}
        <span class="nessuna">Nessuna immagine</span>
      {/if}
      <button class="pulsante secondario" type="button" onclick={() => (selettoreAperto = true)}>{immagine ? 'Cambia' : "Scegli dall'archivio"}</button>
      {#if immagine}<button class="pulsante secondario" type="button" onclick={() => (immagine = null)}>Togli</button>{/if}
    </div>
    {#if errori.immagineId}<span class="errore">{errori.immagineId}</span>{/if}
  </div>

  <label class="spunta"><input type="checkbox" name="secondaria" checked={valori.secondaria === 'on'} />
    Nome accanto al pin solo da vicino (per le tappe fitte, che si coprirebbero)</label>

  <div class="azioni">
    <button class="pulsante" type="submit">{t ? 'Salva' : 'Aggiungi la tappa'}</button>
    <a class="pulsante secondario" href="/cammini/{data.cammino.id}">Annulla</a>
    {#if t}
      <button class="pulsante pericolo spinta" type="submit" formaction="?/elimina" formnovalidate
        onclick={(evento) => { if (!confirm(`Eliminare la tappa «${t.nome}»?`)) evento.preventDefault(); }}>Elimina la tappa</button>
    {/if}
  </div>
</form>

{#if t && t.posizione > 0}
  <section class="riquadro sezione">
    <h2>Tracciato dalla tappa precedente</h2>
    {#if t.tracciato?.length}
      <p>{t.tracciato.length} punti, dalla cartina importata. Se le tappe sono state spostate e il tracciato non parte più dalla tappa
        precedente, la pubblicazione lo sostituisce da sola con una linea dritta.</p>
      <form method="POST" action="?/togliTracciato" use:enhance
        onsubmit={(evento) => { if (!confirm('Togliere il tracciato? Dalla tappa precedente resterà una linea dritta.')) evento.preventDefault(); }}>
        <button class="pulsante secondario" type="submit">Togli il tracciato</button>
      </form>
    {:else}
      <p>Linea dritta: questa tappa non ha un tracciato. Il disegno dei tracciati nel backoffice arriverà con la seconda fase.</p>
    {/if}
  </section>
{/if}

<SelettoreImmagini aperto={selettoreAperto} multiplo={false} titolo="Immagine della scheda"
  onscegli={([scelta]) => { immagine = { id: scelta.id, alt: scelta.alt }; selettoreAperto = false; }}
  onchiudi={() => (selettoreAperto = false)} />

<style>
  .modulo { max-width: none; }
  .due { display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; }
  .campo select { font: inherit; padding: .55rem .7rem; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); max-width: 24rem; }
  .etichetta-campo { font-weight: 600; }
  .immagine { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
  .immagine img { width: 96px; height: 64px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--line); }
  .nessuna { color: var(--ink-faint); }
  .spunta { display: flex; gap: .5rem; align-items: center; }
  .sezione { padding: 1rem 1.25rem; margin-top: 1.25rem; max-width: 46rem; }
  .sezione h2 { font-size: 1rem; }
  .sezione p { color: var(--ink-soft); }
  .conferma { padding: .75rem 1rem; border-radius: var(--radius-sm); background: var(--accent-tint); color: var(--accent-ink); margin-bottom: 1rem; }
  @media (max-width: 760px) { .due { grid-template-columns: 1fr; } }
</style>
