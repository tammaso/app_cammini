<script lang="ts">
  import { enhance } from '$app/forms';
  import { NOMI_CATEGORIE } from '#lib/cammini.ts';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();

  const k = $derived(data.cartina);
  const valori = $derived(form?.valori ?? { pulsante: k.pulsante, anno: String(k.anno) });
  const errori: Record<string, string | undefined> = $derived(form?.errori ?? {});
  const erroriStile = (id: number): Record<string, string | undefined> => (form?.stile === id ? form.erroriStile ?? {} : {});
  const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  const TIPI = { area: 'Area', linea: 'Linea', punto: 'Simbolo (solo legenda)' } as const;
  const ORIGINI: Record<string, string> = { importato: 'importati', disegnato: 'disegnati nel backoffice', modificato: 'modificati a mano' };
</script>

<svelte:head><title>Cartina {k.pulsante} · Cammini</title></svelte:head>

<header class="intestazione-pagina">
  <div>
    <p><a href="/cammini/{k.camminoId}">← {k.cammino}</a></p>
    <h1>Cartina {k.pulsante}</h1>
    <p>Fonte: {k.fonte ?? '—'} · generata il {quando(k.importataIl)} · georeferenziazione con {k.metodo}</p>
  </div>
  <div class="azioni">
    <a class="pulsante" href="/cartine/{k.id}/importa">Importa e classifica</a>
    <a class="pulsante secondario" href="/cartine/{k.id}/allinea">Allinea</a>
  </div>
</header>

{#if form?.salvata}<p class="conferma" role="status">Cartina salvata.</p>{/if}

<div class="disposizione">
  <div class="colonna">
    <form class="riquadro modulo" method="POST" action="?/salva" use:enhance={() => async ({ update }) => update({ reset: false })}>
      <h2>Epoca</h2>
      <div class="due">
        <div class="campo">
          <label for="pulsante">Pulsante</label>
          <span class="aiuto">Il testo del pulsante sulla carta.</span>
          <input id="pulsante" name="pulsante" value={valori.pulsante} required aria-invalid={errori.pulsante ? 'true' : undefined} />
          {#if errori.pulsante}<span class="errore">{errori.pulsante}</span>{/if}
        </div>
        <div class="campo">
          <label for="anno">Anno</label>
          <span class="aiuto">Negativo prima di Cristo: dà l'ordine dei pulsanti.</span>
          <input id="anno" name="anno" inputmode="numeric" value={valori.anno} required aria-invalid={errori.anno ? 'true' : undefined} />
          {#if errori.anno}<span class="errore">{errori.anno}</span>{/if}
        </div>
      </div>
      <div class="azioni"><button class="pulsante" type="submit">Salva</button></div>
    </form>

    <section class="riquadro sezione">
      <h2>Stili</h2>
      <p class="aiuto">La simbologia della cartina, nell'ordine di disegno. Gli stili con una voce di legenda compaiono nella legenda dell'epoca,
        dopo il cammino. Valori che cambiano con lo zoom: «a zoom 3 / a zoom 7».</p>
      {#each data.stili as s (s.id)}
        {@const e = erroriStile(s.id)}
        <form class="stile" method="POST" action="?/stile" use:enhance={() => async ({ update }) => update({ reset: false })}>
          <input type="hidden" name="stile" value={s.id} />
          <div class="testa">
            <span class="campione {s.tipo}" style:background={s.tipo === 'linea' ? 'transparent' : s.colore}
              style:border-color={s.tipo === 'area' ? (s.contorno ?? s.colore) : undefined}
              style:border-top-color={s.tipo === 'linea' ? s.colore : undefined}></span>
            <strong>{s.nome}</strong> <span class="tipo">{TIPI[s.tipo]} · {s.elementi} {s.elementi === 1 ? 'elemento' : 'elementi'}</span>
            {#if form?.stileSalvato === s.id}<span class="etichetta ok">salvato</span>{/if}
          </div>
          <div class="campi">
            <label>Nome <input name="nome" value={s.nome} required /></label>
            <label class="largo">Voce di legenda <input name="legenda" value={s.legenda ?? ''} placeholder="(non in legenda)" /></label>
            <label>{s.tipo === 'area' ? 'Riempimento' : 'Colore'} <input name="colore" type="color" value={s.colore} /></label>
            {#if s.tipo === 'area'}
              <label>Contorno <input name="contorno" value={s.contorno ?? ''} placeholder="nessuno" /></label>
              <label>Opacità <input name="opacita" value={s.testoOpacita} /></label>
            {/if}
            {#if s.tipo !== 'punto'}<label>Spessore <input name="spessore" value={s.testoSpessore} /></label>{/if}
            {#if s.tipo === 'linea'}<label>Tratteggio <input name="tratteggio" value={s.testoTratteggio} placeholder="continua" /></label>{/if}
            {#if s.tipo === 'area'}<label class="spunta"><input type="checkbox" name="ritaglio" checked={s.ritaglio} /> Ritaglia sulle terre emerse</label>{/if}
            <button class="pulsante secondario" type="submit">Salva</button>
          </div>
          {#each Object.values(e) as messaggio (messaggio)}<p class="errore">{messaggio}</p>{/each}
        </form>
      {/each}
    </section>
  </div>

  <div class="colonna">
    <section class="riquadro sezione">
      <h2>Contenuto</h2>
      <p><strong>Elementi:</strong> {k.elementi.map((e) => `${e.n} ${ORIGINI[e.origine] ?? e.origine}`).join(', ') || 'nessuno'}.</p>
      <p><strong>Nomi:</strong></p>
      <ul>{#each k.nomi as n (n.categoria)}<li>{NOMI_CATEGORIE[n.categoria] ?? n.categoria}: {n.n}</li>{/each}</ul>
      <p class="aiuto">Una nuova generazione sostituisce solo elementi e nomi importati; stili, elementi disegnati e nomi modificati restano.
        Il ritaglio sulle terre emerse vale dalla prossima generazione.</p>
    </section>

    <section class="riquadro sezione">
      <h2>Punti di controllo</h2>
      <p class="aiuto">Gli spilli che agganciano il disegno al globo. Si spostano nella <a href="/cartine/{k.id}/allinea">pagina di allineamento</a>.</p>
      <table class="elenco piccolo">
        <thead><tr><th scope="col">Spillo</th><th scope="col">Certezza</th><th scope="col">Stato</th></tr></thead>
        <tbody>
          {#each k.punti as p (p.id)}
            <tr><td>{p.nome}{#if p.luogo && p.luogo !== p.nome} <span class="tipo">({p.luogo})</span>{/if}</td><td>{p.certezza}</td><td>{p.stato}</td></tr>
          {:else}
            <tr><td class="vuoto" colspan="3">Nessun punto di controllo.</td></tr>
          {/each}
        </tbody>
      </table>
    </section>

    <form method="POST" action="?/elimina" use:enhance={({ cancel }) => {
      if (!confirm(`Eliminare la cartina ${k.pulsante} con stili, elementi, nomi e punti di controllo?`)) cancel();
    }}>
      <button class="pulsante pericolo" type="submit">Elimina la cartina</button>
    </form>
  </div>
</div>

<style>
  .disposizione { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(18rem, 1fr); gap: 1.5rem; align-items: start; }
  .colonna { display: grid; gap: 1.25rem; }
  .modulo { max-width: none; }
  h2 { font-size: 1.05rem; }
  .due { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .sezione { padding: 1rem 1.25rem; }
  .sezione p { margin: .3rem 0; }
  .sezione ul { margin: .2rem 0 .5rem; padding-left: 1.2rem; }
  .aiuto { color: var(--ink-soft); font-size: .88rem; }
  .stile { border-top: 1px solid var(--line); padding: .8rem 0; }
  .testa { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; margin-bottom: .5rem; }
  .tipo { color: var(--ink-soft); font-size: .85rem; }
  .campione { display: inline-block; width: 22px; height: 16px; border-radius: 3px; border: 2px solid transparent; }
  .campione.punto { width: 12px; height: 12px; border-radius: 50%; border: 1px solid #231f20; }
  .campione.linea { height: 0; border-width: 3px 0 0; border-style: dotted; border-radius: 0; }
  .campi { display: flex; flex-wrap: wrap; gap: .5rem .75rem; align-items: flex-end; }
  .campi label { display: grid; gap: .2rem; font-size: .82rem; color: var(--ink-soft); }
  .campi input { font: inherit; font-size: .9rem; padding: .35rem .5rem; border: 1px solid var(--line); border-radius: var(--radius-sm); width: 8rem; color: var(--ink); }
  .campi .largo input { width: 18rem; }
  .campi input[type='color'] { width: 3rem; height: 2.1rem; padding: .15rem; }
  .campi .spunta { display: flex; flex-direction: row; align-items: center; gap: .35rem; color: var(--ink); }
  .campi .spunta input { width: auto; }
  .errore { color: var(--danger); font-size: .85rem; margin: .3rem 0 0; }
  .piccolo th, .piccolo td { padding: .35rem .5rem; font-size: .88rem; }
  .conferma { padding: .75rem 1rem; border-radius: var(--radius-sm); background: var(--accent-tint); color: var(--accent-ink); margin-bottom: 1rem; }
  @media (max-width: 1100px) { .disposizione { grid-template-columns: 1fr; } }
</style>
