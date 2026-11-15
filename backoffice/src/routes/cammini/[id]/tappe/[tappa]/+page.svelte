<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import MappaLuogo from '#lib/components/MappaLuogo.svelte';
  import SelettoreImmagini from '#lib/components/SelettoreImmagini.svelte';
  import { MAX_IMMAGINI_TAPPA } from '#lib/cammini.ts';
  import { normale } from '#lib/disegno.ts';
  import { urlAnteprima, type ImmagineScelta } from '#lib/immagini.ts';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();

  const t = $derived(data.tappa);
  const titolo = $derived(t ? t.nome : 'Nuova tappa');
  const valori = $derived(form?.valori ?? {
    nome: t?.nome ?? '', breve: t?.breve ?? '', breveOggi: t?.breveOggi ?? '', luogoId: t ? String(t.luogoId) : '', luogoAttuale: t?.luogoAttuale ?? '',
    riferimento: t?.riferimento ?? '', testo: t?.testo ?? '', approfondimento: t?.approfondimento ?? '',
    secondaria: t?.secondaria ? 'on' : '', luogoNuovo: '', luogoLat: '', luogoLng: '',
  });
  const errori: Record<string, string | undefined> = $derived(form?.errori ?? {});

  // Il luogo della tappa: si cerca nell'anagrafe per nome (anche antico o in altre forme) o se ne aggiunge uno nuovo;
  // la posizione si sceglie e si corregge sulla mappa. L'anagrafe resta dietro le quinte (pagina «Luoghi»).
  let luogoId = $state('');
  let nuovo = $state<string | null>(null); // il nome del luogo nuovo, se se ne aggiunge uno
  let lat = $state<number | null>(null);
  let lng = $state<number | null>(null);
  let cerca = $state('');
  $effect.pre(() => {
    luogoId = valori.luogoId;
    nuovo = valori.luogoNuovo ? valori.luogoNuovo : null;
    const l = data.luoghi.find((x) => String(x.id) === valori.luogoId);
    lat = valori.luogoLat ? Number(valori.luogoLat) : l?.lat ?? null;
    lng = valori.luogoLng ? Number(valori.luogoLng) : l?.lng ?? null;
  });
  const luogo = $derived(nuovo === null ? data.luoghi.find((l) => String(l.id) === luogoId) : undefined);
  const trovati = $derived.by(() => {
    const q = normale(cerca);
    if (!q) return [];
    return data.luoghi.filter((l) => [l.nome, l.nomeAntico, l.nomeAttuale, ...l.altriNomi].some((n) => n && normale(n).includes(q))).slice(0, 8);
  });
  function scegli(l: (typeof data.luoghi)[number]) { luogoId = String(l.id); nuovo = null; lat = l.lat; lng = l.lng; cerca = ''; }
  function aggiungiNuovo() { nuovo = cerca.trim(); luogoId = ''; lat = null; lng = null; cerca = ''; }
  function annullaNuovo() {
    const l = data.luoghi.find((x) => String(x.id) === valori.luogoId);
    nuovo = null; luogoId = valori.luogoId; lat = l?.lat ?? null; lng = l?.lng ?? null;
  }
  // di quanto si è spostato il luogo sulla mappa, in km
  const spostamento = $derived.by(() => {
    if (!luogo || lat == null || lng == null) return 0;
    const r = Math.PI / 180, dLat = (lat - luogo.lat) * r, dLng = (lng - luogo.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(luogo.lat * r) * Math.cos(lat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  });
  const testoKm = (d: number) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d < 10 ? d.toFixed(1).replace('.', ',') : Math.round(d)} km`);

  // galleria della scheda: immagini dell'archivio, nell'ordine scelto (la prima compare all'apertura)
  let galleria = $state<ImmagineScelta[]>([]);
  $effect.pre(() => { galleria = data.immagini; });
  let selettoreAperto = $state(false);
  let avvisoGalleria = $state<string | null>(null);
  let trascinata = $state<number | null>(null);

  function aggiungi(nuove: ImmagineScelta[]) {
    selettoreAperto = false;
    const libere = MAX_IMMAGINI_TAPPA - galleria.length;
    avvisoGalleria = nuove.length > libere ? `Al massimo ${MAX_IMMAGINI_TAPPA} immagini per tappa: ne ho aggiunte ${libere}.` : null;
    galleria = [...galleria, ...nuove.slice(0, libere)];
  }

  function sposta(da: number, a: number) {
    if (a < 0 || a >= galleria.length || da === a) return;
    const nuova = [...galleria];
    const [immagine] = nuova.splice(da, 1);
    nuova.splice(a, 0, immagine);
    galleria = nuova;
  }

  const incomplete = $derived(galleria.filter((i) => !i.completa).length);
  const salvata = $derived(form?.salvata || page.url.searchParams.has('salvata'));
</script>

<svelte:head><title>{titolo} · Cammini</title></svelte:head>

<header class="intestazione-pagina">
  <div>
    <p><a href="/cammini/{data.cammino.id}">← {data.cammino.titolo}</a></p>
    <h1>{t ? `Tappa ${t.posizione + 1}: ${t.nome}` : titolo}</h1>
  </div>
</header>

{#if salvata}<p class="conferma" role="status">Tappa salvata. Per vederla nel portale, <a href="/pubblicazione">prepara l'anteprima e pubblica</a>.</p>{/if}
{#if form?.cartine?.rigenerate.length}<p class="conferma" role="status">Luogo spostato: rigenerata la cartina {form.cartine.rigenerate.join(', ')}.</p>{/if}
{#if form?.cartine?.nonRigenerabili.length}
  <p class="avviso" role="status">Luogo spostato, ma la cartina {form.cartine.nonRigenerabili.join(', ')} non si può rigenerare qui (mancano il file SVG o
    gli spilli): se il luogo si è spostato di più di qualche km, i tratti del cammino verso questa tappa diventano linee dritte.</p>
{/if}
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

  <div class="due">
    <div class="campo">
      <label for="breveOggi">Nome breve in «Oggi»</label>
      <span class="aiuto">Accanto al pin quando la carta mostra il mondo di oggi: il nome moderno del luogo («Hebron»). Vuoto: il nome breve.</span>
      <input id="breveOggi" name="breveOggi" value={valori.breveOggi} maxlength="24" placeholder={valori.breve} aria-invalid={errori.breveOggi ? 'true' : undefined} />
      {#if errori.breveOggi}<span class="errore">{errori.breveOggi}</span>{/if}
    </div>
  </div>

  <div class="campo luogo">
    <span class="etichetta-campo" id="etichetta-luogo">Luogo</span>
    <span class="aiuto">Dove sta la tappa sulla carta. Cercalo per nome, anche antico o in un'altra forma («Harran», «Charran»); se non
      c'è, aggiungilo da qui e indicalo sulla mappa.</span>
    <input type="hidden" name="luogoId" value={luogoId} />
    <input type="hidden" name="luogoNuovo" value={nuovo ?? ''} />
    <input type="hidden" name="luogoLat" value={lat ?? ''} />
    <input type="hidden" name="luogoLng" value={lng ?? ''} />
    {#if nuovo !== null}
      <div class="scelto">
        <label for="luogoNuovoNome">Nuovo luogo</label>
        <input id="luogoNuovoNome" bind:value={nuovo} required placeholder="Il nome del luogo" />
        <span>{#if lat == null}<strong>Clicca sulla mappa dove si trova.</strong>{:else}{lat}, {lng}{/if}</span>
        <button type="button" class="pulsante secondario piccolo" onclick={annullaNuovo}>Annulla</button>
      </div>
    {:else if luogo}
      <p class="scelto"><strong>{luogo.nome}</strong>{#if luogo.nomeAttuale} · {luogo.nomeAttuale}{/if} · identificazione {luogo.certezza}</p>
    {/if}
    <input class="cerca" type="search" bind:value={cerca} aria-labelledby="etichetta-luogo"
      placeholder={luogo || nuovo !== null ? 'Cambia luogo: cerca per nome…' : 'Cerca il luogo per nome…'} />
    {#if cerca.trim()}
      <ul class="trovati">
        {#each trovati as l (l.id)}
          <li><button type="button" onclick={() => scegli(l)}><strong>{l.nome}</strong>
            {#if l.nomeAntico || l.nomeAttuale}<span>{[l.nomeAntico, l.nomeAttuale].filter(Boolean).join(' · ')}</span>{/if}</button></li>
        {/each}
        <li><button type="button" class="aggiungi-luogo" onclick={aggiungiNuovo}>+ Nuovo luogo «{cerca.trim()}»: lo indichi sulla mappa</button></li>
      </ul>
    {/if}
    <MappaLuogo {lat} {lng} spilli={[]} soloPosizione sposta={(a, b) => { lat = a; lng = b; }}
      aiuto="Il segnaposto rosso è il luogo: trascinalo, o clicca sulla mappa, per metterlo nel punto giusto (poi «Salva»)." />
    {#if luogo && spostamento > 0.05}
      <div class="avviso-luogo" role="status">
        <p>Il luogo è spostato di {testoKm(spostamento)}. Salvando, «{luogo.nome}» si sposta nell'anagrafe{#if luogo.altriUsi.length}, e con lui
          {luogo.altriUsi.join('; ')}{/if}.
          {#if spostamento > 5}Le cartine del cammino che hanno il file SVG e gli spilli si rigenerano, così il cammino si riaggancia alla
            tappa; nelle altre i tratti verso questa tappa diventano linee dritte.{/if}</p>
        <button type="button" class="pulsante secondario piccolo" onclick={() => { lat = luogo.lat; lng = luogo.lng; }}>Rimetti com'era</button>
      </div>
    {/if}
    {#if errori.luogoId}<span class="errore">{errori.luogoId}</span>{/if}
  </div>

  <div class="due">
    <div class="campo">
      <label for="luogoAttuale">Dove si trova oggi</label>
      <span class="aiuto">Il nome attuale del luogo e lo Stato: nel fumetto della tappa diventa «Oggi Tell el-Muqayyar, Iraq meridionale».</span>
      <input id="luogoAttuale" name="luogoAttuale" value={valori.luogoAttuale} placeholder={luogo?.nomeAttuale ?? 'Tell el-Muqayyar, Iraq meridionale'} />
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
    <span class="etichetta-campo">Immagini della scheda</span>
    <span class="aiuto">Facoltative. Nel portale la scheda le mostra a sinistra del testo, una alla volta, con le frecce e le miniature;
      ognuna si apre anche a tutto schermo, con lo zoom. Testo alternativo, didascalia e crediti si scrivono nell'archivio.</span>
    <input type="hidden" name="immagini" value={galleria.map((i) => i.id).join(',')} />
    <ol class="galleria">
      {#each galleria as immagine, indice (immagine.id)}
        <li
          draggable="true"
          class:trascinata={trascinata === indice}
          ondragstart={(evento) => { trascinata = indice; evento.dataTransfer?.setData('text/plain', String(indice)); }}
          ondragover={(evento) => evento.preventDefault()}
          ondrop={(evento) => { evento.preventDefault(); if (trascinata !== null) sposta(trascinata, indice); trascinata = null; }}
          ondragend={() => (trascinata = null)}
        >
          <img src={urlAnteprima(immagine, 320)} alt={immagine.alt} draggable="false" />
          <span class="posizione">{indice + 1}</span>
          <a class="testo" href="/immagini/{immagine.id}" title={immagine.alt}>{immagine.alt || immagine.nomeOriginale}</a>
          {#if immagine.didascalia}<span class="didascalia" title={immagine.didascalia}>{immagine.didascalia}</span>{/if}
          {#if !immagine.completa}
            <a class="incompleta" href="/immagini/{immagine.id}" target="_blank" rel="noopener">mancano testo alternativo o crediti ↗</a>
          {/if}
          <span class="comandi">
            <button type="button" aria-label="Sposta prima" title="Sposta prima" disabled={indice === 0} onclick={() => sposta(indice, indice - 1)}>←</button>
            <button type="button" aria-label="Sposta dopo" title="Sposta dopo" disabled={indice === galleria.length - 1} onclick={() => sposta(indice, indice + 1)}>→</button>
            <button type="button" aria-label="Togli dalla galleria" title="Togli dalla galleria" onclick={() => (galleria = galleria.filter((_, i) => i !== indice))}>×</button>
          </span>
        </li>
      {/each}
      {#if galleria.length < MAX_IMMAGINI_TAPPA}
        <li class="aggiungi">
          <button type="button" onclick={() => (selettoreAperto = true)}>+ Aggiungi immagini</button>
        </li>
      {/if}
    </ol>
    <span class="aiuto">
      {#if galleria.length > 1}Trascina le immagini o usa le frecce per cambiare l'ordine: la prima è quella che compare all'apertura.{/if}
      {#if incomplete}<strong>{incomplete === 1 ? "A un'immagine mancano" : `A ${incomplete} immagini mancano`} testo alternativo o crediti: servono per pubblicare.</strong>{/if}
      Le modifiche alla galleria si salvano con «Salva».
    </span>
    {#if avvisoGalleria}<span class="errore">{avvisoGalleria}</span>{/if}
    {#if errori.immagini}<span class="errore">{errori.immagini}</span>{/if}
  </div>

  <details class="avanzate" open={valori.secondaria === 'on'}>
    <summary>Avanzate</summary>
    <label class="spunta"><input type="checkbox" name="secondaria" checked={valori.secondaria === 'on'} />
      Nome accanto al pin solo da vicino (per le tappe fitte, che si coprirebbero). Di solito non serve: il portale mette in colonna
      i segnaposto che si sovrappongono.</label>
  </details>

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

<SelettoreImmagini aperto={selettoreAperto} multiplo={true} escluse={galleria.map((i) => i.id)} titolo="Aggiungi immagini alla scheda"
  onscegli={aggiungi} onchiudi={() => (selettoreAperto = false)} />

<style>
  .modulo { max-width: none; }
  .due { display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; }
  .etichetta-campo { font-weight: 600; }
  .luogo .scelto { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; margin: 0; }
  .luogo .scelto label { font-weight: 600; }
  .luogo .scelto input { font: inherit; padding: .4rem .6rem; border: 1px solid var(--line); border-radius: var(--radius-sm); }
  .cerca { font: inherit; padding: .5rem .7rem; border: 1px solid var(--line); border-radius: var(--radius-sm); max-width: 24rem; }
  .trovati { list-style: none; margin: 0; padding: 0; display: grid; gap: .25rem; max-width: 32rem; }
  .trovati button {
    width: 100%; text-align: left; font: inherit; padding: .4rem .6rem; border: 1px solid var(--line); border-radius: var(--radius-sm);
    background: var(--surface); cursor: pointer; display: flex; gap: .5rem; flex-wrap: wrap; align-items: baseline;
  }
  .trovati button:hover { border-color: var(--accent); }
  .trovati button span { color: var(--ink-soft); font-size: .85rem; }
  .trovati .aggiungi-luogo { color: var(--accent-ink); font-weight: 600; border-style: dashed; }
  .avviso-luogo { padding: .6rem .9rem; border-radius: var(--radius-sm); background: var(--brand-tint); color: var(--brand); display: grid; gap: .5rem; justify-items: start; }
  .avviso-luogo p { margin: 0; }
  .piccolo { padding: .3rem .7rem; font-size: .88rem; }
  .galleria { list-style: none; margin: .25rem 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); gap: .75rem; }
  .galleria li {
    position: relative; display: grid; align-content: start; gap: .25rem; padding-bottom: .4rem;
    border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden; background: var(--surface); cursor: grab;
  }
  .galleria li.trascinata { opacity: .4; }
  .galleria img { width: 100%; height: 6.5rem; object-fit: cover; display: block; background: var(--surface-alt); }
  .posizione {
    position: absolute; top: .35rem; left: .35rem; min-width: 1.5rem; height: 1.5rem; padding: 0 .3rem; border-radius: 999px;
    background: rgb(36 33 28 / .75); color: #fff; font-size: .8rem; font-weight: 700; display: grid; place-items: center;
  }
  .galleria .testo, .galleria .didascalia { padding: 0 .5rem; font-size: .8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .galleria .didascalia { color: var(--ink-soft); font-style: italic; }
  .incompleta { padding: 0 .5rem; font-size: .75rem; color: var(--brand); }
  .comandi { display: flex; gap: .25rem; padding: 0 .4rem; }
  .comandi button { flex: 1; border: 1px solid var(--line); background: var(--surface); border-radius: 6px; cursor: pointer; font: inherit; padding: .1rem 0; }
  .comandi button:disabled { opacity: .35; cursor: default; }
  .galleria .aggiungi { cursor: default; border-style: dashed; padding: 0; }
  .aggiungi button {
    width: 100%; height: 100%; min-height: 9.5rem; border: 0; background: none; color: var(--accent-ink); font: 600 .9rem var(--font-body); cursor: pointer;
  }
  .aiuto strong { color: var(--brand); font-weight: 600; }
  .spunta { display: flex; gap: .5rem; align-items: center; }
  .avanzate { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: .6rem .9rem; background: var(--surface-alt); }
  .avanzate summary { cursor: pointer; font-weight: 600; }
  .avanzate[open] summary { margin-bottom: .6rem; }
  .sezione { padding: 1rem 1.25rem; margin-top: 1.25rem; max-width: 46rem; }
  .sezione h2 { font-size: 1rem; }
  .sezione p { color: var(--ink-soft); }
  .conferma { padding: .75rem 1rem; border-radius: var(--radius-sm); background: var(--accent-tint); color: var(--accent-ink); margin-bottom: 1rem; }
  @media (max-width: 760px) { .due { grid-template-columns: 1fr; } }
</style>
