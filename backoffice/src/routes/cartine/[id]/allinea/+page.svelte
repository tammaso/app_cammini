<script lang="ts">
  // Allineamento della cartina sul globo: gli spilli agganciano un punto del disegno a un punto della carta,
  // il disegno si deforma dal vivo mentre si trascinano (thin plate spline, src/lib/georeferenziazione.ts).
  // Dalla prova prototipo/allinea.html; qui gli spilli stanno nel database (punti di controllo).
  import { onMount, untrack } from 'svelte';
  import { enhance } from '$app/forms';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import type { GeoJSONSource, Map as Mappa, Marker } from 'maplibre-gl';
  import { eSimbolo, normale, type Punto } from '#lib/disegno.ts';
  import { adatta, inversa, mercY, ritagliaLinea, ritagliaPoligono, scarti, trasforma, type Certezza, type Modello } from '#lib/georeferenziazione.ts';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();

  type Stato = 'proposto' | 'confermato' | 'manuale';
  interface Spillo { nome: string; luogoId: number | null; luogo: string | null; sx: number; sy: number; lng: number; lat: number; certezza: Certezza; stato: Stato }

  // gli spilli si leggono una volta, all'apertura: poi la pagina li modifica e li salva lei
  const disegno = untrack(() => data.disegno);
  let punti = $state<Spillo[]>(untrack(() => structuredClone(data.punti)));
  let scarto = $state<(number | null)[]>([]);
  let attivo = $state(-1);
  let opacita = $state(0.55);
  let vista = $state({ aree: true, linee: true, nomi: true, griglia: false, fiumi: false });
  let aggiunta = $state(false);
  let piegato = $state(false);
  let modificati = $state(false);
  let inviando = $state(false);
  let caricamento = $state(true);

  const COLORE: Record<Stato, string> = { proposto: '#ffd166', confermato: '#5cc98a', manuale: '#6cc4ff' };
  const confermati = $derived(punti.filter((p) => p.stato !== 'proposto').length);
  const medio = $derived.by(() => { const s = scarto.filter((v): v is number => v != null); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null; });
  const datiDaSalvare = $derived(JSON.stringify(punti.map(({ nome, luogoId, sx, sy, lng, lat, certezza, stato }) => ({ nome, luogoId, sx, sy, lng, lat, certezza, stato }))));

  // --- Proposte: ogni nome della cartina che è nell'anagrafe va al simbolo più vicino, valutando tutti
  // gli abbinamenti insieme (dove i nomi sono fitti il simbolo più vicino può essere del nome accanto)
  function proponiPunti(): Spillo[] {
    if (!disegno) return [];
    const centro = (b: number[]): Punto => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
    // i simboli, escluse le punte di freccia che stanno sulla loro linea dello stesso colore
    const sullaSuaLinea = (f: (typeof disegno.forme)[number]) => disegno.forme.some((l) => l.tratto && l.tratto === f.riempimento
      && l.parti.some((p) => p.some((q) => Math.hypot(q[0] - centro(f.box)[0], q[1] - centro(f.box)[1]) < 4)));
    const simboli = disegno.forme.filter((f) => eSimbolo(f) && !sullaSuaLinea(f)).map((f) => centro(f.box));
    const nomi = disegno.testi.map((t) => ({ t, luogo: data.luoghi.find((l) => l.chiavi.includes(normale(t.testo))) })).filter((x) => x.luogo);
    // il riquadro di un testo comprende lo spazio di ascendenti e discendenti: si stringe in altezza
    const costo = (b: number[], s: Punto) => {
      const h = b[3] - b[1], y0 = b[1] + h * 0.25, y1 = b[3] - h * 0.2;
      return Math.hypot(Math.max(b[0] - s[0], 0, s[0] - b[2]), Math.max(y0 - s[1], 0, s[1] - y1));
    };
    const coppie: [number, number, number][] = [];
    nomi.forEach((x, i) => simboli.forEach((s, j) => coppie.push([costo(x.t.box, s), i, j])));
    coppie.sort((a, b) => a[0] - b[0]);
    const scelta = new Map<number, number>(), presi = new Set<number>();
    for (const [c, i, j] of coppie) if (c < 15 && !scelta.has(i) && !presi.has(j)) { scelta.set(i, j); presi.add(j); }
    for (let migliorato = true; migliorato;) {
      migliorato = false;
      const indici = [...scelta.keys()];
      for (const i of indici) for (const k of indici) {
        if (i >= k) continue;
        const a = scelta.get(i)!, b = scelta.get(k)!;
        if (costo(nomi[i].t.box, simboli[b]) + costo(nomi[k].t.box, simboli[a]) < costo(nomi[i].t.box, simboli[a]) + costo(nomi[k].t.box, simboli[b]) - 1e-6) {
          scelta.set(i, b); scelta.set(k, a); migliorato = true;
        }
      }
    }
    return [...scelta].map(([i, j]) => {
      const l = nomi[i].luogo!;
      return { nome: l.nome, luogoId: l.id, luogo: l.nome, sx: simboli[j][0], sy: simboli[j][1], lng: l.lng, lat: l.lat, certezza: l.certezza, stato: 'proposto' as Stato };
    }).sort((a, b) => b.lat - a.lat);
  }

  // --- Carta e disegno deformato
  let mappa: Mappa;
  let maplibre: typeof import('maplibre-gl');
  let modello: Modello | null = null;
  const spilli: Marker[] = [], etichette: Marker[] = [];
  const vuota = { type: 'FeatureCollection' as const, features: [] };

  function geojsonDelDisegno() {
    const aree: GeoJSON.Feature[] = [], linee: GeoJSON.Feature[] = [];
    const T = (p: Punto) => trasforma(modello!, p[0], p[1]);
    for (const f of disegno!.forme) {
      if (f.riempimento && !eSimbolo(f)) for (const anello of f.parti) {
        const r = ritagliaPoligono(anello, disegno!.cornice);
        if (r.length < 3) continue;
        const c = r.map(T); c.push(c[0]);
        aree.push({ type: 'Feature', properties: { colore: f.riempimento, opacita: f.opacita }, geometry: { type: 'Polygon', coordinates: [c] } });
      }
      if (f.tratto) {
        const pezzi = f.parti.flatMap((p) => ritagliaLinea(p, disegno!.cornice)).map((p) => p.map(T));
        if (pezzi.length) linee.push({ type: 'Feature', properties: { colore: f.tratto, spessore: Math.max(0.6, f.spessore) }, geometry: { type: 'MultiLineString', coordinates: pezzi } });
      }
    }
    return { aree, linee };
  }

  // Griglia regolare sul foglio, deformata: una cella che si capovolge è una piega (due spilli si
  // contraddicono). Controllo fitto, più un quadratino intorno a ogni spillo.
  function grigliaEPieghe() {
    const [x0, y0, x1, y1] = disegno!.cornice, NX = 150, NY = Math.round((NX * (y1 - y0)) / (x1 - x0));
    const nodi: Punto[][] = [];
    for (let j = 0; j <= NY; j++) { nodi.push([]); for (let i = 0; i <= NX; i++) nodi[j].push(trasforma(modello!, x0 + ((x1 - x0) * i) / NX, y0 + ((y1 - y0) * j) / NY)); }
    const linee: Punto[][] = [];
    for (let j = 0; j <= NY; j += 12) linee.push(nodi[j]);
    for (let i = 0; i <= NX; i += 12) linee.push(nodi.map((r) => r[i]));
    const segno = (a: Punto, b: Punto, c: Punto) => Math.sign((b[0] - a[0]) * (mercY(c[1]) - mercY(a[1])) - (mercY(b[1]) - mercY(a[1])) * (c[0] - a[0]));
    const segni: [number, Punto[]][] = [];
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) segni.push([segno(nodi[j][i], nodi[j][i + 1], nodi[j + 1][i]), [nodi[j][i], nodi[j][i + 1], nodi[j + 1][i + 1], nodi[j + 1][i]]]);
    const normale = Math.sign(segni.reduce((s, [g]) => s + g, 0));
    const piegate = segni.filter(([g]) => g !== normale).map(([, q]) => q);
    for (const p of punti) {
      const a = trasforma(modello!, p.sx - 0.5, p.sy - 0.5), b = trasforma(modello!, p.sx + 0.5, p.sy - 0.5), d = trasforma(modello!, p.sx - 0.5, p.sy + 0.5);
      if (segno(a, b, d) !== normale) { const k = 0.06; piegate.push([[p.lng - k, p.lat - k], [p.lng + k, p.lat - k], [p.lng + k, p.lat + k], [p.lng - k, p.lat + k]]); }
    }
    return {
      griglia: { type: 'Feature' as const, properties: {}, geometry: { type: 'MultiLineString' as const, coordinates: linee } },
      piegate: piegate.map((q) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [[...q, q[0]]] } })),
    };
  }

  let ridisegnoChiesto = false;
  function chiediRidisegno() { if (!ridisegnoChiesto) { ridisegnoChiesto = true; requestAnimationFrame(ridisegna); } }
  function ridisegna() {
    ridisegnoChiesto = false;
    if (!mappa || !disegno) return;
    modello = adatta(punti, disegno.cornice);
    if (!modello) return;
    const { aree, linee } = geojsonDelDisegno();
    (mappa.getSource('aree') as GeoJSONSource).setData({ type: 'FeatureCollection', features: aree });
    (mappa.getSource('linee') as GeoJSONSource).setData({ type: 'FeatureCollection', features: linee });
    const { griglia, piegate } = grigliaEPieghe();
    (mappa.getSource('griglia') as GeoJSONSource).setData(griglia);
    (mappa.getSource('pieghe') as GeoJSONSource).setData({ type: 'FeatureCollection', features: piegate });
    piegato = piegate.length > 0;
    // dove cade davvero il punto del disegno, per gli spilli che lo tirano senza fissarlo
    const linea = punti.map((p) => [trasforma(modello!, p.sx, p.sy), [p.lng, p.lat]]).filter(([a, b]) => Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.004);
    (mappa.getSource('scarti') as GeoJSONSource).setData({ type: 'FeatureCollection', features: linea.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c } })) });
    disegno.testi.forEach((t, i) => etichette[i]?.setLngLat(trasforma(modello!, (t.box[0] + t.box[2]) / 2, (t.box[1] + t.box[3]) / 2)));
    scarto = scarti(punti, disegno.cornice);
  }

  function creaSpilli() {
    spilli.forEach((s) => s.remove());
    spilli.length = 0;
    punti.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'spillo' + (p.certezza === 'ipotetica' ? ' ipotetica' : '') + (i === attivo ? ' attivo' : '');
      el.style.setProperty('--c', COLORE[p.stato]);
      el.textContent = String(i + 1);
      el.title = p.nome;
      const s = new maplibre.Marker({ element: el, draggable: true }).setLngLat([p.lng, p.lat]).addTo(mappa);
      s.on('dragstart', () => (attivo = i));
      s.on('drag', () => { const q = s.getLngLat(); punti[i].lng = q.lng; punti[i].lat = q.lat; modificati = true; chiediRidisegno(); });
      s.on('dragend', () => { if (punti[i].stato === 'proposto') punti[i].stato = 'confermato'; creaSpilli(); });
      el.addEventListener('click', (e) => { e.stopPropagation(); attivo = i; creaSpilli(); });
      spilli.push(s);
    });
  }
  const aggiorna = () => { modificati = true; creaSpilli(); chiediRidisegno(); };

  function seleziona(i: number) {
    attivo = i;
    creaSpilli();
    mappa.flyTo({ center: [punti[i].lng, punti[i].lat], zoom: Math.max(mappa.getZoom(), 6.5) });
  }
  function togli(i: number) { punti.splice(i, 1); attivo = -1; aggiorna(); }
  function confermaTutti() { punti.forEach((p) => { if (p.stato === 'proposto') p.stato = 'confermato'; }); aggiorna(); }
  function proponi() {
    if (punti.length && !confirm('Sostituire gli spilli con le proposte automatiche?')) return;
    punti = proponiPunti(); attivo = -1; aggiorna();
  }

  $effect(() => {
    if (!mappa || caricamento) return;
    mappa.setPaintProperty('aree', 'fill-opacity', ['*', ['get', 'opacita'], opacita]);
    mappa.setPaintProperty('linee', 'line-opacity', Math.min(1, opacita + 0.3));
    for (const l of ['aree', 'linee', 'griglia'] as const) mappa.setLayoutProperty(l, 'visibility', vista[l] ? 'visible' : 'none');
    if (vista.fiumi && !mappa.getSource('fiumi')) {
      mappa.addSource('fiumi', { type: 'geojson', data: '/api/fiumi.geojson' });
      mappa.addLayer({ id: 'fiumi', type: 'line', source: 'fiumi', paint: { 'line-color': '#00e5ff', 'line-width': 1.2, 'line-opacity': 0.9 } }, 'griglia');
    }
    if (mappa.getLayer('fiumi')) mappa.setLayoutProperty('fiumi', 'visibility', vista.fiumi ? 'visible' : 'none');
  });

  let contenitore: HTMLDivElement;
  onMount(() => {
    if (!disegno) return;
    // una cartina senza spilli parte dalle proposte automatiche: si vedono subito nell'elenco
    if (!punti.length) { punti = proponiPunti(); if (punti.length) modificati = true; }
    let finita = false;
    (async () => {
      maplibre = await import('maplibre-gl');
      const { Protocol } = await import('pmtiles');
      if (finita) return;
      maplibre.addProtocol('pmtiles', new Protocol().tile);
      mappa = new maplibre.Map({
        container: contenitore, center: [38, 33], zoom: 4.3, minZoom: 1, maxZoom: 9, renderWorldCopies: false,
        attributionControl: { compact: true, customAttribution: 'Natural Earth' },
        style: {
          version: 8, projection: { type: 'globe' },
          sources: {
            bmng: { type: 'raster', url: `pmtiles://${location.origin}/api/satellite.pmtiles`, tileSize: 512, attribution: 'Immagini: NASA Earth Observatory, Blue Marble Next Generation' },
            aree: { type: 'geojson', data: vuota }, linee: { type: 'geojson', data: vuota }, griglia: { type: 'geojson', data: vuota },
            pieghe: { type: 'geojson', data: vuota }, scarti: { type: 'geojson', data: vuota },
          },
          layers: [
            { id: 'fondo', type: 'background', paint: { 'background-color': '#0b1d3a' } },
            { id: 'bmng', type: 'raster', source: 'bmng' },
            { id: 'aree', type: 'fill', source: 'aree', paint: { 'fill-color': ['get', 'colore'], 'fill-opacity': ['*', ['get', 'opacita'], 0.55], 'fill-antialias': false } },
            { id: 'linee', type: 'line', source: 'linee', layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': ['get', 'colore'], 'line-width': ['interpolate', ['linear'], ['zoom'], 3, ['*', ['get', 'spessore'], 1.2], 8, ['*', ['get', 'spessore'], 4]], 'line-opacity': 0.85 } },
            { id: 'griglia', type: 'line', source: 'griglia', layout: { visibility: 'none' }, paint: { 'line-color': '#ffffff', 'line-width': 0.7, 'line-opacity': 0.45 } },
            { id: 'pieghe', type: 'fill', source: 'pieghe', paint: { 'fill-color': '#ff3b30', 'fill-opacity': 0.55 } },
            { id: 'scarti', type: 'line', source: 'scarti', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ffd166', 'line-width': 2, 'line-dasharray': [1, 1.5] } },
          ],
        },
      });
      mappa.addControl(new maplibre.NavigationControl({ showCompass: false }), 'bottom-right');
      mappa.on('click', (e) => {
        if (!aggiunta || !modello) return;
        const c = disegno.cornice;
        const [sx, sy] = inversa(modello, e.lngLat.lng, e.lngLat.lat, [(c[0] + c[2]) / 2, (c[1] + c[3]) / 2]);
        punti.push({ nome: `Punto ${punti.length + 1}`, luogoId: null, luogo: null, sx, sy, lng: e.lngLat.lng, lat: e.lngLat.lat, certezza: 'certa', stato: 'manuale' });
        aggiunta = false; attivo = punti.length - 1; aggiorna();
      });
      mappa.on('load', () => {
        disegno.testi.forEach((t) => {
          const el = document.createElement('div');
          el.className = 'nome-disegno'; el.textContent = t.testo; el.style.color = t.colore;
          el.style.fontSize = `${Math.max(9, Math.min(14, t.dimensione * 1.3))}px`;
          etichette.push(new maplibre.Marker({ element: el }).setLngLat([0, 0]).addTo(mappa));
        });
        creaSpilli();
        ridisegna();
        caricamento = false;
        if (modello) {
          const c = disegno.cornice;
          const angoli = [[c[0], c[1]], [c[2], c[1]], [c[2], c[3]], [c[0], c[3]]].map(([x, y]) => trasforma(modello!, x, y));
          const b = new maplibre.LngLatBounds(angoli[0], angoli[0]);
          angoli.forEach((a) => b.extend(a));
          mappa.fitBounds(b, { padding: 30, duration: 0 });
        }
      });
    })();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') aggiunta = false; };
    const esci = (e: BeforeUnloadEvent) => { if (modificati) e.preventDefault(); };
    addEventListener('keydown', esc);
    addEventListener('beforeunload', esci);
    return () => { finita = true; removeEventListener('keydown', esc); removeEventListener('beforeunload', esci); mappa?.remove(); };
  });
</script>

<svelte:head><title>Allinea la cartina {data.cartina.pulsante} · Cammini</title></svelte:head>

<div class="pagina">
  <aside class="pannello">
    <p><a href="/cartine/{data.cartina.id}/importa">← Importa la cartina {data.cartina.pulsante}</a></p>
    <h1>Allinea la cartina</h1>
    <p class="file">{data.cartina.cammino} · {data.cartina.fonte ?? 'senza file'}</p>
    {#if !disegno}
      <p class="avviso">Prima carica il file SVG della cartina.</p>
    {:else}
      <p class="aiuto">Gli spilli agganciano un punto del disegno a un punto del globo. Trascinali finché coste e fiumi del disegno
        combaciano con il satellite: il disegno si deforma mentre li sposti.</p>

      <section>
        <h2>Disegno</h2>
        <label class="riga">Opacità <input type="range" min="0" max="1" step="0.05" bind:value={opacita} /></label>
        <label class="riga"><input type="checkbox" bind:checked={vista.aree} /> Aree colorate</label>
        <label class="riga"><input type="checkbox" bind:checked={vista.linee} /> Linee (coste, fiumi, percorso)</label>
        <label class="riga"><input type="checkbox" bind:checked={vista.nomi} /> Nomi della cartina</label>
        <label class="riga"><input type="checkbox" bind:checked={vista.griglia} /> Griglia della deformazione</label>
        <label class="riga"><input type="checkbox" bind:checked={vista.fiumi} /> Fiumi veri (Natural Earth)</label>
      </section>

      <section>
        <h2>Spilli</h2>
        <p>{punti.length} spilli, {confermati} confermati{#if medio != null} · il disegno si discosta dal vero in media di {Math.round(medio)} km{/if}</p>
        {#if piegato}<p class="avviso">Il disegno si piega (in rosso): due spilli si contraddicono. Di solito è un nome abbinato al pallino sbagliato.</p>{/if}
        <div class="comandi">
          <button class="pulsante secondario" type="button" aria-pressed={aggiunta} onclick={() => (aggiunta = !aggiunta)}>Aggiungi spillo</button>
          <button class="pulsante secondario" type="button" onclick={confermaTutti}>Conferma tutti</button>
          <button class="pulsante secondario" type="button" onclick={proponi}>Proponi da capo</button>
        </div>
        {#if aggiunta}<p class="nota">Clicca sul disegno nel punto da agganciare (la punta di una penisola, una foce), poi trascina lo spillo dove si
          trova davvero. Esc per annullare.</p>{/if}
        <ol class="punti">
          {#each punti as p, i (i)}
            <li class:attivo={i === attivo} style:--c={COLORE[p.stato]}>
              <span class="n">{i + 1}</span>
              {#if p.luogoId}<button type="button" class="nome" onclick={() => seleziona(i)}>{p.nome}</button>
              {:else}<input class="nome" bind:value={p.nome} onchange={() => (modificati = true)} onfocus={() => seleziona(i)} aria-label="Nome dello spillo {i + 1}" />{/if}
              <span class="scarto" class:alto={(scarto[i] ?? 0) > 60}>{scarto[i] != null ? `≈ ${Math.round(scarto[i]!)} km` : ''}</span>
              <span class="sotto">
                <select bind:value={p.certezza} onchange={aggiorna} aria-label="Certezza di {p.nome}">
                  <option>certa</option><option>probabile</option><option>ipotetica</option>
                </select>
                {#if p.stato === 'proposto'}<button type="button" class="azione" onclick={() => { p.stato = 'confermato'; aggiorna(); }}>Conferma</button>{/if}
                <button type="button" class="azione" onclick={() => togli(i)}>Togli</button>
              </span>
            </li>
          {/each}
        </ol>
        <p class="nota">Lo scarto è quanto il disegno si discosta dal vero in quel punto: dove andrebbe il luogo se lo spillo non ci fosse.
          Un luogo probabile o ipotetico tira il disegno solo in parte.</p>
      </section>

      <form method="POST" action="?/salva" class="salva" use:enhance={() => {
        inviando = true;
        return async ({ update, result }) => { await update({ reset: false, invalidateAll: false }); inviando = false; if (result.type === 'success') modificati = false; };
      }}>
        <input type="hidden" name="punti" value={datiDaSalvare} />
        <button class="pulsante secondario" type="submit" disabled={inviando}>Salva gli spilli</button>
        <button class="pulsante" type="submit" formaction="?/genera" disabled={inviando || punti.length < 3}>{inviando ? 'Un momento…' : 'Salva e genera la cartina'}</button>
        <p class="stato" role="status">
          {#if form?.errore}<span class="errore">{form.errore}</span>
          {:else if form?.generata}Cartina generata: {form.generata.elementi} elementi, {form.generata.nomi} nomi, {form.generata.tracciati} tracciati.
            <a href="/pubblicazione">Aggiorna il portale</a>{#each form.generata.avvisi as a (a)}<br />{a}{/each}
          {:else if modificati}Ci sono modifiche non salvate.
          {:else if form?.salvati}Spilli salvati.{/if}
        </p>
      </form>
    {/if}
  </aside>
  <div class="carta" class:aggiunta class:senza-nomi={!vista.nomi} bind:this={contenitore}>
    {#if caricamento && disegno}<p class="caricamento">Carico la carta…</p>{/if}
  </div>
</div>

<style>
  /* la pagina occupa tutto lo spazio accanto al menu */
  .pagina { display: grid; grid-template-columns: minmax(300px, 380px) 1fr; height: 100vh; margin: -2rem -2.5rem; }
  :global(main:has(.pagina)) { max-width: none !important; }
  .pannello { overflow-y: auto; padding: 1.25rem; border-right: 1px solid var(--line); background: var(--surface); display: flex; flex-direction: column; gap: .8rem; }
  .pannello p { margin: 0; }
  h1 { font-size: 1.4rem; margin: 0; }
  h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; color: var(--brand); margin: 0 0 .4rem; }
  .file, .aiuto, .nota { color: var(--ink-soft); font-size: .88rem; }
  section { border-top: 1px solid var(--line); padding-top: .8rem; }
  .riga { display: flex; align-items: center; gap: .5rem; margin: .25rem 0; font-size: .92rem; cursor: pointer; }
  .riga input[type='range'] { flex: 1; }
  .comandi { display: flex; flex-wrap: wrap; gap: .4rem; margin: .5rem 0; }
  .comandi .pulsante { padding: .4rem .7rem; font-size: .82rem; }
  .comandi [aria-pressed='true'] { background: var(--accent); color: #fff; }
  .punti { list-style: none; margin: .4rem 0; padding: 0; display: grid; gap: .25rem; }
  .punti li { display: grid; grid-template-columns: 24px 1fr auto; gap: .2rem .5rem; align-items: center; padding: .35rem .45rem; border-radius: var(--radius-sm); background: var(--surface-alt); }
  .punti li.attivo { outline: 2px solid var(--accent); }
  .n { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font: 700 .7rem var(--font-body); background: var(--c); color: #10213a; }
  .nome { border: 0; padding: 0; background: none; font: 600 .92rem var(--font-body); text-align: left; cursor: pointer; color: var(--ink); }
  input.nome { border-bottom: 1px dashed var(--ink-faint); cursor: text; width: 100%; }
  .scarto { font-size: .8rem; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
  .scarto.alto { color: var(--danger); font-weight: 600; }
  .sotto { grid-column: 2 / 4; display: flex; gap: .4rem; align-items: center; }
  .sotto select { font: inherit; font-size: .8rem; padding: .15rem .3rem; border: 1px solid var(--line); border-radius: 6px; }
  .azione { border: 0; background: none; color: var(--accent-ink); font: 600 .8rem var(--font-body); cursor: pointer; padding: .1rem .3rem; }
  .salva { position: sticky; bottom: -1.25rem; background: var(--surface); padding: .8rem 0 1.25rem; border-top: 1px solid var(--line); display: flex; flex-wrap: wrap; gap: .5rem; }
  .stato { width: 100%; font-size: .85rem; color: var(--ink-soft); }
  .errore { color: var(--danger); }
  .pulsante:disabled { opacity: .55; cursor: not-allowed; }
  .carta { position: relative; min-width: 0; background: #0b1d3a; }
  .caricamento { position: absolute; inset: 0; display: grid; place-items: center; color: #a7b7cf; margin: 0; }
  .carta.aggiunta :global(.maplibregl-canvas) { cursor: crosshair; }
  .carta :global(.spillo) { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; cursor: grab; font: 800 11px/1 var(--font-body);
    color: #10213a; background: var(--c); border: 2px solid #fff; box-shadow: 0 1px 5px rgba(0, 0, 0, .6); }
  .carta :global(.spillo.ipotetica) { border-style: dashed; }
  .carta :global(.spillo.attivo) { outline: 3px solid #fff; outline-offset: 2px; }
  .carta :global(.nome-disegno) { font: 600 11px/1 var(--font-body); white-space: pre; pointer-events: none; text-shadow: 0 0 2px #fff, 0 0 2px #fff, 0 0 3px #fff; }
  .carta.senza-nomi :global(.nome-disegno) { display: none; }
  @media (max-width: 900px) { .pagina { grid-template-columns: 1fr; grid-template-rows: auto 60vh; height: auto; margin: 0; } }
</style>
