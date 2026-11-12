<script lang="ts">
  // Mappa della scheda del luogo: la posizione dell'anagrafe (spillo rosso, si trascina o si sceglie con un clic)
  // e gli spilli delle cartine legati al luogo, con la distanza dalla posizione dell'anagrafe.
  import { onMount } from 'svelte';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import type { GeoJSONSource, Map as Mappa, Marker } from 'maplibre-gl';

  export interface SpilloDelLuogo { lng: number; lat: number; stato: 'proposto' | 'confermato' | 'manuale'; cartinaId: number; cartina: string }

  interface Props {
    lat: number | null;
    lng: number | null;
    spilli: SpilloDelLuogo[];
    /** chiamata quando si sposta la posizione sulla mappa */
    sposta: (lat: number, lng: number) => void;
  }
  let { lat, lng, spilli, sposta }: Props = $props();

  const COLORE = { proposto: '#ffd166', confermato: '#5cc98a', manuale: '#6cc4ff' } as const;
  const vuota = { type: 'FeatureCollection' as const, features: [] };

  let contenitore: HTMLDivElement;
  let mappa: Mappa | undefined;
  let maplibre: typeof import('maplibre-gl') | undefined;
  let posizione: Marker | undefined;
  let pronta = $state(false);

  /** distanza in km lungo la superficie terrestre */
  function km(a: [number, number], b: [number, number]): number {
    const r = Math.PI / 180, dLat = (b[1] - a[1]) * r, dLng = (b[0] - a[0]) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }
  const valida = $derived(lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180);
  const distanze = $derived(spilli.map((s) => (valida ? km([lng!, lat!], [s.lng, s.lat]) : null)));

  function testoKm(d: number | null): string {
    if (d == null) return '';
    return d < 1 ? `${Math.round(d * 1000)} m` : `${d < 10 ? d.toFixed(1).replace('.', ',') : Math.round(d)} km`;
  }

  // la posizione dell'anagrafe segue i campi del modulo; le linee uniscono la posizione agli spilli
  $effect(() => {
    if (!pronta || !mappa || !maplibre) return;
    if (valida) {
      if (!posizione) {
        const el = document.createElement('div');
        // MapLibre posiziona il segnaposto con transform: la goccia ruotata sta in un elemento interno
        el.className = 'posizione-luogo';
        el.innerHTML = '<span></span>';
        el.title = "Posizione nell'anagrafe: trascinala per correggerla";
        posizione = new maplibre.Marker({ element: el, draggable: true, anchor: 'bottom' }).setLngLat([lng!, lat!]).addTo(mappa);
        posizione.on('dragend', () => { const q = posizione!.getLngLat(); sposta(arrotonda(q.lat), arrotonda(q.lng)); });
      } else posizione.setLngLat([lng!, lat!]);
    } else { posizione?.remove(); posizione = undefined; }
    (mappa.getSource('legami') as GeoJSONSource).setData(valida ? {
      type: 'FeatureCollection',
      features: spilli.map((s) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[lng!, lat!], [s.lng, s.lat]] } })),
    } : vuota);
  });

  const arrotonda = (v: number) => Math.round(v * 1e5) / 1e5;

  function inquadra() {
    if (!mappa || !maplibre) return;
    const punti: [number, number][] = [...(valida ? [[lng!, lat!] as [number, number]] : []), ...spilli.map((s): [number, number] => [s.lng, s.lat])];
    if (!punti.length) return;
    const b = new maplibre.LngLatBounds(punti[0], punti[0]);
    punti.forEach((p) => b.extend(p));
    mappa.fitBounds(b, { padding: 60, maxZoom: 7, duration: 600 });
  }

  function vaiA(s: SpilloDelLuogo) { mappa?.flyTo({ center: [s.lng, s.lat], zoom: Math.max(mappa.getZoom(), 7) }); }

  onMount(() => {
    let finita = false;
    (async () => {
      maplibre = await import('maplibre-gl');
      const { Protocol } = await import('pmtiles');
      if (finita) return;
      maplibre.addProtocol('pmtiles', new Protocol().tile);
      const centro: [number, number] = valida ? [lng!, lat!] : spilli[0] ? [spilli[0].lng, spilli[0].lat] : [38, 33];
      mappa = new maplibre.Map({
        container: contenitore, center: centro, zoom: valida || spilli.length ? 6 : 3.5, minZoom: 1, maxZoom: 9, renderWorldCopies: false,
        attributionControl: { compact: true },
        style: {
          version: 8,
          sources: {
            bmng: { type: 'raster', url: `pmtiles://${location.origin}/api/satellite.pmtiles`, tileSize: 512, attribution: 'Immagini: NASA Earth Observatory, Blue Marble Next Generation' },
            fiumi: { type: 'geojson', data: '/api/fiumi.geojson' },
            legami: { type: 'geojson', data: vuota },
          },
          layers: [
            { id: 'fondo', type: 'background', paint: { 'background-color': '#0b1d3a' } },
            { id: 'bmng', type: 'raster', source: 'bmng' },
            { id: 'fiumi', type: 'line', source: 'fiumi', paint: { 'line-color': '#7cc4ff', 'line-width': 1, 'line-opacity': 0.6 } },
            { id: 'legami', type: 'line', source: 'legami', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-dasharray': [1, 1.5] } },
          ],
        },
      });
      mappa.addControl(new maplibre.NavigationControl({ showCompass: false }), 'bottom-right');
      mappa.on('click', (e) => sposta(arrotonda(e.lngLat.lat), arrotonda(e.lngLat.lng)));
      mappa.on('load', () => {
        spilli.forEach((s, i) => {
          const el = document.createElement('a');
          el.className = 'spillo-cartina';
          el.href = `/cartine/${s.cartinaId}/allinea`;
          el.style.setProperty('--c', COLORE[s.stato]);
          el.textContent = String(i + 1);
          el.title = `Spillo sulla cartina ${s.cartina} (${s.stato}): apri la pagina Allinea`;
          el.addEventListener('click', (e) => e.stopPropagation());
          new maplibre!.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(mappa!);
        });
        pronta = true;
        if (valida && spilli.length) inquadra();
      });
    })();
    return () => { finita = true; mappa?.remove(); };
  });
</script>

<section class="riquadro mappa-luogo">
  <div class="carta" bind:this={contenitore}></div>
  <div class="sotto">
    <p class="aiuto">
      <span class="segno posizione"></span> Posizione nell'anagrafe: trascinala, o clicca sulla mappa, per cambiare le coordinate
      (poi «Salva»). Sposta le tappe che usano il luogo e le città delle cartine.
    </p>
    {#if spilli.length}
      <p class="aiuto">Spilli delle cartine legati al luogo (si spostano nella pagina Allinea):</p>
      <ol class="spilli">
        {#each spilli as s, i (i)}
          <li style:--c={COLORE[s.stato]}>
            <button type="button" class="n" onclick={() => vaiA(s)} title="Mostra sulla mappa">{i + 1}</button>
            <a href="/cartine/{s.cartinaId}/allinea">{s.cartina}</a>
            <span class="stato">{s.stato}</span>
            {#if distanze[i] != null}<span class="distanza" class:lontano={distanze[i]! > 1}>a {testoKm(distanze[i])} dall'anagrafe</span>{/if}
          </li>
        {/each}
      </ol>
      <button type="button" class="pulsante secondario" onclick={inquadra}>Mostra tutto</button>
    {:else}
      <p class="aiuto">Nessuno spillo di cartina è legato a questo luogo.</p>
    {/if}
  </div>
</section>

<style>
  .mappa-luogo { padding: 0; overflow: hidden; }
  .carta { height: 22rem; background: #0b1d3a; }
  .sotto { padding: .9rem 1.1rem 1rem; display: grid; gap: .6rem; justify-items: start; }
  .aiuto { color: var(--ink-soft); font-size: .85rem; margin: 0; }
  .segno.posizione { display: inline-block; width: .7rem; height: .7rem; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: #e0402f; border: 2px solid #fff; box-shadow: 0 0 0 1px #0004; vertical-align: -1px; }
  .spilli { list-style: none; margin: 0; padding: 0; display: grid; gap: .35rem; font-size: .9rem; }
  .spilli li { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
  .n { width: 1.5rem; height: 1.5rem; border-radius: 50%; border: 2px solid #fff; background: var(--c); box-shadow: 0 0 0 1px #0005; font: 800 .7rem/1 var(--font-body); color: #10213a; cursor: pointer; padding: 0; }
  .stato { color: var(--ink-soft); font-size: .8rem; }
  .distanza { font-size: .8rem; color: var(--accent-ink); }
  .distanza.lontano { color: var(--danger); }
  .carta :global(.posizione-luogo) { width: 26px; height: 32px; cursor: grab; display: grid; place-items: start center; }
  .carta :global(.posizione-luogo span) { width: 22px; height: 22px; box-sizing: border-box; border-radius: 50% 50% 50% 0; transform: rotate(-45deg);
    background: #e0402f; border: 3px solid #fff; box-shadow: 0 1px 4px #0008; margin-top: 1px; }
  .carta :global(.spillo-cartina) { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: var(--c);
    border: 2px solid #fff; box-shadow: 0 1px 4px #0008; font: 800 11px/1 var(--font-body); color: #10213a; text-decoration: none; }
</style>
