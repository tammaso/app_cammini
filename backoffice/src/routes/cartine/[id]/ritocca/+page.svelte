<script lang="ts">
  // Ritocca la cartina: la carta generata sul satellite, come nel portale. I nomi della cartina e le tappe
  // si trascinano; cliccando un nome lo si modifica nel pannello. Le aree colorate non cambiano: dipendono
  // solo dagli spilli (pagina «Allinea»).
  import { onMount, untrack } from 'svelte';
  import { deserialize } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import type { FilterSpecification, GeoJSONSource, Map as Mappa, Marker } from 'maplibre-gl';
  import { NOMI_CATEGORIE } from '#lib/cammini.ts';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  type Nome = (typeof data.nomi)[number];
  type Tappa = (typeof data.tappe)[number];

  // corpo (px) e colore di ogni categoria quando il nome non ne ha uno suo, come nel portale
  const CORPO: Record<string, number> = { regno: 20, 'regione-antica': 17, 'capitale-antica': 15, 'citta-antica': 15, regione: 16, mare: 17, fiume: 17, isola: 16, vetta: 16 };
  const COLORE: Record<string, string> = { regno: '#3a2a1a', 'regione-antica': '#5a3a1a', 'capitale-antica': '#141414', 'citta-antica': '#141414', regione: '#4a3a20', mare: '#0b2ee6', fiume: '#0b2ee6', isola: '#4a3a20', vetta: '#4a3a20' };
  const ORIGINE: Record<string, string> = { importato: 'dal disegno', modificato: 'ritoccato', disegnato: 'aggiunto' };
  const CITTA = ['citta-antica', 'capitale-antica', 'vetta'];

  let nomi = $state<Nome[]>(untrack(() => structuredClone(data.nomi)));
  let scelto = $state<number | null>(null);
  let filtro = $state('');
  let stato = $state<{ tipo: 'ok' | 'errore' | 'lavoro'; testo: string } | null>(null);
  let daPubblicare = $state(false);
  // la scheda del nome scelto, da modificare prima di salvare
  let bozza = $state({ testo: '', sotto: '', usaColore: false, colore: '#141414', corpo: '', angolo: '', zoom: '', sempre: false });

  const nomeScelto = $derived(nomi.find((n) => n.id === scelto) ?? null);
  const gruppi = $derived.by(() => {
    const f = filtro.trim().toLowerCase();
    const per = new Map<string, Nome[]>();
    for (const n of nomi) if (!f || n.testo.toLowerCase().includes(f)) per.set(n.categoria, [...(per.get(n.categoria) ?? []), n]);
    return [...per].sort((a, b) => Object.keys(NOMI_CATEGORIE).indexOf(a[0]) - Object.keys(NOMI_CATEGORIE).indexOf(b[0]));
  });
  const ritoccati = $derived(nomi.filter((n) => n.origine === 'modificato').length);

  // --- Mappa ------------------------------------------------------------------------------------------
  let contenitore: HTMLDivElement;
  let mappa: Mappa | undefined;
  let maplibre: typeof import('maplibre-gl') | undefined;
  let pronta = $state(false);
  let zoomOra = $state(0);
  const marcatori = new Map<number, Marker>();
  let marcatoriTappe: Marker[] = [];
  const delloStile = (id: string) => ['==', ['get', 'stile'], id] as FilterSpecification;
  const aZoom = (v: number | [number, number]) => (Array.isArray(v) ? ['interpolate', ['linear'], ['zoom'], 3, v[0], 7, v[1]] : v);

  function tracciati(tappe: Tappa[]) {
    return {
      type: 'FeatureCollection' as const,
      features: tappe.slice(1).map((t, i) => ({
        type: 'Feature' as const, properties: {},
        geometry: { type: 'LineString' as const, coordinates: t.tracciato?.length ? t.tracciato : [[tappe[i].lng, tappe[i].lat], [t.lng, t.lat]] },
      })),
    };
  }

  function elementoNome(n: Nome): HTMLElement {
    const el = document.createElement('div');
    el.className = `nome ${n.categoria}${n.origine !== 'importato' ? ' ritoccato' : ''}${n.id === scelto ? ' scelto' : ''}${mappa && mappa.getZoom() < n.zoom ? ' lontano' : ''}`;
    el.style.setProperty('--colore', n.colore ?? COLORE[n.categoria] ?? '#141414');
    el.style.setProperty('--corpo', `${n.corpo ?? CORPO[n.categoria] ?? 15}px`);
    const testo = document.createElement('span');
    testo.className = 'testo';
    testo.textContent = n.testo + (n.sotto ? `\n${n.sotto}` : '');
    el.append(testo);
    el.title = `${n.testo.replace(/\n/g, ' ')} · ${ORIGINE[n.origine]}: trascina per spostarlo, clicca per modificarlo`;
    el.addEventListener('click', (e) => { e.stopPropagation(); seleziona(n.id, false); });
    return el;
  }

  function creaNome(n: Nome) {
    if (!mappa || !maplibre) return;
    marcatori.get(n.id)?.remove();
    const citta = CITTA.includes(n.categoria);
    const m = new maplibre.Marker({
      element: elementoNome(n), draggable: true, rotation: citta ? 0 : n.angolo ?? 0, rotationAlignment: 'map',
      // città: il pallino (a 8,5 px dal bordo sinistro) sta sul luogo
      anchor: citta ? 'left' : 'center', offset: citta ? [-8.5, 0] : [0, 0],
    }).setLngLat([n.lng, n.lat]).addTo(mappa);
    m.on('dragend', async () => {
      const p = m.getLngLat();
      const esito = await invia('sposta', { nome: n.id, lng: p.lng, lat: p.lat }, `«${riga(n.testo)}» spostato.`);
      const voce = nomi.find((x) => x.id === n.id);
      if (esito && voce) { voce.lng = p.lng; voce.lat = p.lat; if (voce.origine === 'importato') voce.origine = 'modificato'; creaNome(voce); }
      else m.setLngLat([n.lng, n.lat]);
    });
    marcatori.set(n.id, m);
  }

  // nel portale un nome compare dal suo zoom: sotto, qui si vede più chiaro
  function aggiornaLontani() {
    if (!mappa) return;
    const z = mappa.getZoom();
    for (const n of nomi) marcatori.get(n.id)?.getElement().classList.toggle('lontano', z < n.zoom);
  }

  function creaTappe() {
    if (!mappa || !maplibre) return;
    marcatoriTappe.forEach((m) => m.remove());
    marcatoriTappe = data.tappe.map((t) => {
      const el = document.createElement('div');
      el.className = 'tappa';
      el.innerHTML = `<span class="n">${t.numero}</span><span class="b"></span>`;
      el.querySelector('.b')!.textContent = t.breve;
      el.title = `Tappa ${t.numero}, ${t.nome} (luogo: ${t.luogo}): trascina per spostarla`;
      const m = new maplibre!.Marker({ element: el, draggable: true, anchor: 'left', offset: [-13, 0] }).setLngLat([t.lng, t.lat]).addTo(mappa!);
      m.on('dragend', async () => {
        const p = m.getLngLat();
        const altrove = t.altriUsi.length ? `\n\nIl luogo «${t.luogo}» è usato anche da: ${t.altriUsi.join('; ')}. Si sposta anche lì.` : '';
        if (!confirm(`Spostare la tappa ${t.numero}, ${t.nome}? Si sposta il suo luogo nell'anagrafe e il cammino si riaggancia.${altrove}`)) {
          m.setLngLat([t.lng, t.lat]);
          return;
        }
        const esito = await invia('tappa', { tappa: t.id, lng: p.lng, lat: p.lat }, `Tappa ${t.numero} spostata, cammino riagganciato.`);
        if (esito) await invalidateAll();
        else m.setLngLat([t.lng, t.lat]);
      });
      return m;
    });
  }

  function ridisegna() {
    if (!mappa) return;
    (mappa.getSource('tracciati') as GeoJSONSource | undefined)?.setData(tracciati(data.tappe));
    marcatori.forEach((m) => m.remove());
    marcatori.clear();
    nomi.forEach(creaNome);
    creaTappe();
  }

  // dopo una rigenerazione (tappa spostata, nome riportato al disegno) i dati arrivano di nuovo dal server
  $effect(() => {
    const nuovi = data.nomi;
    void data.tappe;
    untrack(() => {
      nomi = structuredClone(nuovi);
      if (pronta) ridisegna();
      if (scelto != null && !nomi.some((n) => n.id === scelto)) scelto = null;
    });
  });

  onMount(() => {
    let finita = false;
    (async () => {
      maplibre = await import('maplibre-gl');
      const { Protocol } = await import('pmtiles');
      if (finita) return;
      maplibre.addProtocol('pmtiles', new Protocol().tile);
      const aree = data.stili.filter((s) => s.tipo === 'area');
      const linee = data.stili.filter((s) => s.tipo === 'linea');
      mappa = new maplibre.Map({
        container: contenitore, center: [38, 32], zoom: 4.5, minZoom: 2, maxZoom: 9, renderWorldCopies: false,
        attributionControl: { compact: true, customAttribution: 'Natural Earth' },
        style: {
          version: 8,
          sources: {
            bmng: { type: 'raster', url: `pmtiles://${location.origin}/api/satellite.pmtiles`, tileSize: 512, attribution: 'Immagini: NASA Earth Observatory, Blue Marble Next Generation' },
            elementi: { type: 'geojson', data: data.elementi as GeoJSON.FeatureCollection },
            tracciati: { type: 'geojson', data: tracciati(data.tappe) },
          },
          layers: [
            { id: 'fondo', type: 'background', paint: { 'background-color': '#0b1d3a' } },
            { id: 'bmng', type: 'raster', source: 'bmng' },
            ...aree.map((s) => ({ id: `area-${s.id}`, type: 'fill' as const, source: 'elementi', filter: delloStile(s.id),
              paint: { 'fill-color': s.riempimento, 'fill-opacity': aZoom(s.opacita) as never } })),
            ...aree.filter((s) => s.contorno).map((s) => ({ id: `contorno-${s.id}`, type: 'line' as const, source: 'elementi', filter: delloStile(s.id),
              paint: { 'line-color': s.contorno!, 'line-width': aZoom(s.spessore) as never } })),
            ...linee.map((s) => ({ id: `linea-${s.id}`, type: 'line' as const, source: 'elementi', filter: delloStile(s.id),
              paint: { 'line-color': s.colore, 'line-width': aZoom(s.spessore) as never, ...(s.tratteggio ? { 'line-dasharray': s.tratteggio } : {}) } })),
            { id: 'cammino-bordo', type: 'line', source: 'tracciati', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fffaf0', 'line-width': 5 } },
            { id: 'cammino', type: 'line', source: 'tracciati', layout: { 'line-join': 'round' }, paint: { 'line-color': '#c42a40', 'line-width': 2.6, 'line-dasharray': [2.2, 1.4] } },
          ],
        },
      });
      mappa.addControl(new maplibre.NavigationControl({ showCompass: false }), 'bottom-right');
      // un clic sulla carta, fuori dai nomi e dalle tappe, lascia il nome scelto
      mappa.on('click', (e) => { if (!(e.originalEvent.target as HTMLElement | null)?.closest?.('.nome, .tappa')) seleziona(null); });
      mappa.on('zoom', () => { zoomOra = mappa!.getZoom(); aggiornaLontani(); });
      mappa.on('load', () => {
        pronta = true;
        zoomOra = mappa!.getZoom();
        ridisegna();
        // tutta la cartina con le tappe
        const punti = [...data.tappe.map((t): [number, number] => [t.lng, t.lat]), ...nomi.map((n): [number, number] => [n.lng, n.lat])];
        if (punti.length) {
          const b = new maplibre!.LngLatBounds(punti[0], punti[0]);
          punti.forEach((p) => b.extend(p));
          mappa!.fitBounds(b, { padding: 50, duration: 0 });
        }
      });
    })();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') seleziona(null); };
    addEventListener('keydown', esc);
    return () => { finita = true; removeEventListener('keydown', esc); mappa?.remove(); };
  });

  // --- Scelta e modifica di un nome ------------------------------------------------------------------
  // la scheda sta in alto a sinistra sulla carta: il nome scelto va nella parte libera, alla sua destra
  const LARGHEZZA_SCHEDA = 352;
  function mostra(n: Nome, vola: boolean) {
    if (!mappa) return;
    const p = mappa.project([n.lng, n.lat]);
    const coperto = p.x < LARGHEZZA_SCHEDA + 30 && p.y < (document.querySelector('.scheda')?.getBoundingClientRect().height ?? 460) + 40;
    const offset: [number, number] = [Math.min(LARGHEZZA_SCHEDA / 2, mappa.getContainer().clientWidth / 2 - 60), 0];
    if (vola) mappa.flyTo({ center: [n.lng, n.lat], zoom: Math.max(mappa.getZoom(), 5.5), offset });
    else if (coperto) mappa.easeTo({ center: [n.lng, n.lat], offset });
  }

  function seleziona(id: number | null, vola = true) {
    scelto = id;
    marcatori.forEach((m, k) => m.getElement().classList.toggle('scelto', k === id));
    const n = nomi.find((x) => x.id === id);
    if (!n) return;
    bozza = {
      testo: n.testo, sotto: n.sotto ?? '', usaColore: n.colore != null, colore: n.colore ?? COLORE[n.categoria] ?? '#141414',
      corpo: n.corpo == null ? '' : String(n.corpo), angolo: n.angolo == null ? '' : String(n.angolo), zoom: String(n.zoom), sempre: n.sempre,
    };
    requestAnimationFrame(() => mostra(n, vola)); // dopo che la scheda è comparsa
  }

  const riga = (t: string) => t.replace(/\n/g, ' ');

  async function invia(azione: string, campi: Record<string, string | number | boolean | null>, ok: string) {
    const f = new FormData();
    for (const [k, v] of Object.entries(campi)) if (v !== null && v !== false) f.set(k, v === true ? 'on' : String(v));
    stato = { tipo: 'lavoro', testo: 'Un momento…' };
    try {
      const r = await fetch(`?/${azione}`, { method: 'POST', body: f, headers: { 'x-sveltekit-action': 'true' } });
      const esito = deserialize(await r.text());
      if (esito.type === 'success') {
        const avvisi = (esito.data?.avvisi as string[] | undefined) ?? [];
        stato = { tipo: 'ok', testo: [ok, ...avvisi].join(' ') };
        if (azione !== 'pubblica') daPubblicare = true;
        return esito.data ?? {};
      }
      stato = { tipo: 'errore', testo: esito.type === 'failure' ? String(esito.data?.errore ?? 'Non riuscito.') : 'Non riuscito.' };
    } catch (errore) {
      stato = { tipo: 'errore', testo: errore instanceof Error ? errore.message : String(errore) };
    }
    return null;
  }

  async function salva() {
    const n = nomeScelto;
    if (!n) return;
    const campi = {
      nome: n.id, testo: bozza.testo, sotto: bozza.sotto, colore: bozza.usaColore ? bozza.colore : '', corpo: bozza.corpo,
      angolo: bozza.angolo, zoom: bozza.zoom, sempre: bozza.sempre,
    };
    if (!(await invia('modifica', campi, `«${riga(bozza.testo)}» salvato.`))) return;
    const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
    Object.assign(n, {
      testo: bozza.testo.trim(), sotto: bozza.sotto.trim() || null, colore: bozza.usaColore ? bozza.colore : null, corpo: num(bozza.corpo),
      angolo: num(bozza.angolo) || null, zoom: Number(bozza.zoom.replace(',', '.')), sempre: bozza.sempre,
      origine: n.origine === 'importato' ? 'modificato' : n.origine,
    });
    creaNome(n);
  }

  async function ripristina() {
    const n = nomeScelto;
    if (!n || !confirm(`Riportare «${riga(n.testo)}» com'è nel disegno? Si perdono i ritocchi e la cartina si rigenera.`)) return;
    if (await invia('ripristina', { nome: n.id }, `«${riga(n.testo)}» riportato com'è nel disegno.`)) { scelto = null; await invalidateAll(); }
  }

  async function elimina() {
    const n = nomeScelto;
    if (!n || !confirm(`Eliminare «${riga(n.testo)}» dalla cartina?`)) return;
    if (await invia('elimina', { nome: n.id }, `«${riga(n.testo)}» eliminato.`)) {
      marcatori.get(n.id)?.remove();
      marcatori.delete(n.id);
      nomi = nomi.filter((x) => x.id !== n.id);
      scelto = null;
    }
  }

  async function correggiLuogo() {
    const n = nomeScelto;
    if (!n || !confirm(`Spostare il luogo «${n.luogo}» dell'anagrafe dove ora sta il nome? Vale per tutto ciò che usa quel luogo (tappe, altre cartine); la cartina si rigenera.`)) return;
    if (await invia('luogo', { nome: n.id }, `Luogo «${n.luogo}» spostato nell'anagrafe.`)) await invalidateAll();
  }

  async function pubblica() {
    if (await invia('pubblica', {}, 'Portale aggiornato.')) daPubblicare = false;
  }
</script>

<svelte:head><title>Ritocca la cartina {data.cartina.pulsante} · Cammini</title></svelte:head>

<div class="pagina">
  <aside class="pannello">
    <p><a href="/cartine/{data.cartina.id}">← Cartina {data.cartina.pulsante}</a> · {data.cartina.cammino}</p>
    <h1>Ritocca la cartina</h1>
    <p class="aiuto">Trascina sulla carta i nomi e le tappe; clicca un nome per modificarlo. Le aree colorate non cambiano: dipendono
      dagli spilli (<a href="/cartine/{data.cartina.id}/allinea">Allinea</a>). I nomi ritoccati restano come li lasci anche quando la cartina
      si rigenera. I nomi più chiari, a questo zoom, nel portale non compaiono ancora.</p>

    <div class="barra-stato" role="status">
      {#if stato}<p class={stato.tipo}>{stato.testo}</p>{/if}
      <button class="pulsante" type="button" onclick={pubblica} disabled={stato?.tipo === 'lavoro'}>Aggiorna il portale</button>
      {#if daPubblicare}<span class="nota">Ci sono ritocchi non ancora nel portale.</span>{/if}
    </div>


    <section>
      <h2>Nomi della cartina <span class="conta">{nomi.length}{#if ritoccati} · {ritoccati} ritoccati{/if}</span></h2>
      <input class="filtro" type="search" placeholder="Cerca un nome…" bind:value={filtro} aria-label="Cerca un nome" />
      {#each gruppi as [categoria, elenco] (categoria)}
        <h3>{NOMI_CATEGORIE[categoria] ?? categoria}</h3>
        <ul class="elenco-nomi">
          {#each elenco as n (n.id)}
            <li><button type="button" class:scelto={n.id === scelto} onclick={() => seleziona(n.id)}>
              <span class="campione" style:background={n.colore ?? COLORE[n.categoria]}></span>{riga(n.testo)}
              {#if n.origine !== 'importato'}<span class="etichetta">{ORIGINE[n.origine]}</span>{/if}
            </button></li>
          {/each}
        </ul>
      {/each}
    </section>

    <section>
      <h2>Tappe</h2>
      <p class="nota">Trascina un segnaposto sulla carta per spostare la tappa: si sposta il suo luogo nell'anagrafe e il cammino si
        riaggancia.</p>
      <ol class="elenco-tappe">
        {#each data.tappe as t (t.id)}<li>{t.nome} <span class="nota">({t.luogo})</span></li>{/each}
      </ol>
    </section>
  </aside>
  <div class="carta" bind:this={contenitore}>
    {#if !pronta}<p class="caricamento">Carico la carta…</p>{/if}
    {#if nomeScelto}
      {@const n = nomeScelto}
      <section class="scheda">
        <div class="testata"><h2>{NOMI_CATEGORIE[n.categoria] ?? n.categoria} · {ORIGINE[n.origine]}</h2>
          <button class="chiudi" type="button" onclick={() => seleziona(null)} aria-label="Chiudi la scheda" title="Chiudi (Esc)">×</button></div>
        {#if n.luogo}<p class="nota">Luogo dell'anagrafe: <a href="/luoghi/{n.luogoId}">{n.luogo}</a></p>{/if}
        <label class="campo">Testo <textarea rows={Math.max(1, bozza.testo.split('\n').length)} bind:value={bozza.testo}></textarea></label>
        {#if n.categoria === 'regno' || n.sotto}<label class="campo">Sottotitolo <textarea rows="1" bind:value={bozza.sotto}></textarea></label>{/if}
        <div class="riga-campi">
          <label class="campo">Corpo (px) <input inputmode="decimal" placeholder={String(CORPO[n.categoria] ?? '')} bind:value={bozza.corpo} /></label>
          {#if !CITTA.includes(n.categoria)}<label class="campo">Inclinazione (°) <input inputmode="decimal" placeholder="0" bind:value={bozza.angolo} /></label>{/if}
          <label class="campo">Compare da zoom <span class="con-pulsante"><input inputmode="decimal" bind:value={bozza.zoom} />
            <button class="da-qui" type="button" onclick={() => (bozza.zoom = String(Math.round(zoomOra * 10) / 10))}
              title="Usa lo zoom attuale della carta">Da qui</button></span></label>
        </div>
        <div class="riga-campi">
          <label class="spunta"><input type="checkbox" bind:checked={bozza.usaColore} /> Colore suo</label>
          <input type="color" bind:value={bozza.colore} disabled={!bozza.usaColore} aria-label="Colore del nome" />
          <label class="spunta"><input type="checkbox" bind:checked={bozza.sempre} /> Sempre visibile</label>
        </div>
        <div class="comandi">
          <button class="pulsante" type="button" onclick={salva}>Salva</button>
          {#if n.origine === 'modificato'}<button class="pulsante secondario" type="button" onclick={ripristina}>Com'è nel disegno</button>{/if}
          {#if n.origine === 'disegnato'}<button class="pulsante pericolo" type="button" onclick={elimina}>Elimina</button>{/if}
          {#if n.luogoId}<button class="pulsante secondario" type="button" onclick={correggiLuogo}>Sposta qui il luogo dell'anagrafe</button>{/if}
        </div>
        <p class="nota">Ora la carta è a zoom {zoomOra.toLocaleString('it-IT', { maximumFractionDigits: 1 })}. Inclinazione positiva: in
          discesa verso destra. Il colore vale nell'epoca storica.</p>
      </section>
    {/if}
  </div>
</div>

<style>
  .pagina { display: grid; grid-template-columns: minmax(300px, 380px) 1fr; height: 100vh; margin: -2rem -2.5rem; }
  :global(main:has(.pagina)) { max-width: none !important; }
  .pannello { overflow-y: auto; padding: 1.25rem; border-right: 1px solid var(--line); background: var(--surface); display: flex; flex-direction: column; gap: .8rem; }
  .pannello p { margin: 0; }
  h1 { font-size: 1.4rem; margin: 0; }
  h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; color: var(--brand); margin: 0 0 .4rem; }
  h3 { font-size: .85rem; margin: .6rem 0 .2rem; color: var(--ink-soft); }
  .aiuto, .nota { color: var(--ink-soft); font-size: .86rem; }
  section { border-top: 1px solid var(--line); padding-top: .8rem; }
  .conta { font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--ink-soft); }
  .barra-stato { position: sticky; top: 0; background: var(--surface); z-index: 1; display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; padding: .4rem 0; }
  .barra-stato p { width: 100%; font-size: .86rem; }
  .barra-stato .ok { color: var(--accent-ink); }
  .barra-stato .errore { color: var(--danger); }
  .barra-stato .lavoro { color: var(--ink-soft); }
  .scheda { position: absolute; top: .75rem; left: .75rem; z-index: 3; width: min(340px, calc(100% - 1.5rem)); max-height: calc(100% - 1.5rem);
    overflow-y: auto; box-sizing: border-box; font: .95rem/1.4 var(--font-body); color: var(--ink); display: grid; gap: .5rem; background: var(--surface); border-radius: var(--radius-md); padding: .8rem;
    border: 1px solid var(--line); box-shadow: 0 6px 24px rgba(0, 0, 0, .35); }
  .scheda p { margin: 0; }
  .testata { display: flex; align-items: start; justify-content: space-between; gap: .5rem; }
  .chiudi { border: 0; background: none; font-size: 1.4rem; line-height: 1; cursor: pointer; color: var(--ink-soft); padding: 0 .2rem; }
  .scheda .campo textarea { min-height: 0; }
  .con-pulsante { display: flex; gap: .3rem; }
  .da-qui { font: inherit; font-size: .78rem; font-weight: 600; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface-alt);
    cursor: pointer; white-space: nowrap; padding: 0 .45rem; }
  .campo { display: grid; gap: .2rem; font-size: .82rem; font-weight: 600; }
  .campo textarea, .campo input, .filtro { font: inherit; font-weight: 400; font-size: .9rem; padding: .35rem .45rem; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); width: 100%; box-sizing: border-box; }
  .riga-campi { display: flex; gap: .5rem; align-items: end; flex-wrap: wrap; }
  .riga-campi .campo { flex: 1; min-width: 5.5rem; }
  .spunta { display: flex; gap: .35rem; align-items: center; font-size: .86rem; }
  input[type='color'] { width: 2.4rem; height: 1.9rem; padding: 0; border: 1px solid var(--line); border-radius: var(--radius-sm); background: none; }
  .comandi { display: flex; flex-wrap: wrap; gap: .4rem; }
  .comandi .pulsante { padding: .4rem .7rem; font-size: .84rem; }
  .pulsante:disabled { opacity: .55; cursor: not-allowed; }
  .elenco-nomi, .elenco-tappe { margin: 0; padding: 0; list-style: none; display: grid; gap: .1rem; }
  .elenco-tappe { list-style: decimal; padding-left: 1.4rem; font-size: .9rem; }
  .elenco-nomi button { display: flex; gap: .45rem; align-items: center; width: 100%; text-align: left; border: 0; background: none; padding: .25rem .4rem;
    border-radius: var(--radius-sm); font: inherit; font-size: .9rem; cursor: pointer; color: var(--ink); }
  .elenco-nomi button:hover, .elenco-nomi button.scelto { background: var(--accent-tint); }
  .campione { width: .7rem; height: .7rem; border-radius: 50%; flex: none; }
  .etichetta { margin-left: auto; font-size: .72rem; }
  .carta { position: relative; min-width: 0; background: #0b1d3a; }
  .caricamento { position: absolute; inset: 0; display: grid; place-items: center; color: #a7b7cf; margin: 0; }
  /* i nomi come nel portale (epoca storica): colore della carta su un alone chiaro */
  .carta :global(.nome) { cursor: grab; white-space: pre; text-align: center; color: var(--colore); font: italic 600 var(--corpo)/1.05 'Alegreya Sans', var(--font-body), sans-serif;
    text-shadow: 0 0 1px #fffaf0, 0 0 2px #fffaf0, 0 0 3px #fffaf0, 0 0 5px rgba(255, 250, 240, .95); padding: 2px 4px; border-radius: 4px; }
  .carta :global(.nome.regno), .carta :global(.nome.regione-antica) { text-transform: uppercase; font-weight: 700; }
  .carta :global(.nome.regione-antica) { letter-spacing: .16em; }
  .carta :global(.nome.mare), .carta :global(.nome.fiume), .carta :global(.nome.regione), .carta :global(.nome.isola), .carta :global(.nome.vetta) { font-style: normal; }
  .carta :global(.nome.citta-antica), .carta :global(.nome.capitale-antica), .carta :global(.nome.vetta) { display: flex; align-items: center; gap: 5px; font-weight: 700; }
  .carta :global(.nome.citta-antica)::before, .carta :global(.nome.capitale-antica)::before { content: ''; width: 9px; height: 9px; border-radius: 50%; flex: none;
    background: var(--colore); border: 1.5px solid #fffaf0; box-sizing: border-box; }
  .carta :global(.nome.lontano) { opacity: .5; }
  .carta :global(.nome.ritoccato) { outline: 1px dashed rgba(255, 250, 240, .8); }
  .carta :global(.nome.scelto) { outline: 2px solid #ffd166; background: rgba(16, 33, 58, .35); }
  .carta :global(.tappa) { display: flex; align-items: center; gap: 6px; cursor: grab; }
  .carta :global(.tappa .n) { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: #fffaf4; color: #9b2335;
    border: 2px solid #9b2335; font: 700 13px/1 var(--font-body); box-shadow: 0 1px 4px rgba(0, 0, 0, .35); }
  .carta :global(.tappa .b) { font: 700 14px/1 var(--font-body); color: #fffaf2; text-shadow: 0 0 3px rgba(10, 14, 20, .9), 0 0 6px rgba(10, 14, 20, .7); white-space: nowrap; }
  @media (max-width: 900px) { .pagina { grid-template-columns: 1fr; grid-template-rows: auto 60vh; height: auto; margin: 0; } }
</style>
