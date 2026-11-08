<script lang="ts">
  import { enhance } from '$app/forms';
  import { NOMI_CATEGORIE } from '#lib/cammini.ts';
  import { CATEGORIE_NOMI } from '#lib/disegno.ts';
  import { estraiDisegno } from '#lib/estrazione.ts';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();

  const k = $derived(data.cartina);
  const quando = (iso: string) => new Date(iso).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' });

  // --- caricamento del file: il disegno si estrae qui, nel browser, e si manda al server con il file
  let moduloSvg = $state<HTMLFormElement>();
  let svg = $state(''), disegno = $state(''), nomeFile = $state('');
  let estrazione = $state<{ errore?: string; inCorso?: boolean }>({});
  async function scegliFile(evento: Event & { currentTarget: HTMLInputElement }) {
    const file = evento.currentTarget.files?.[0];
    if (!file) return;
    estrazione = { inCorso: true };
    try {
      const testo = await file.text();
      const estratto = estraiDisegno(testo);
      svg = testo; disegno = JSON.stringify(estratto); nomeFile = file.name;
      estrazione = {};
      await Promise.resolve();
      moduloSvg?.requestSubmit();
    } catch (errore) {
      estrazione = { errore: errore instanceof Error ? errore.message : String(errore) };
    }
  }

  // --- classificazione: le scelte della pagina, partendo da quelle salvate o proposte
  const valoreColore = (u: (typeof data.colori)[number]['uso']) => (u.uso === 'stile' ? `stile:${u.stile}` : u.uso);
  let colori = $state<Record<string, string>>({});
  let nuoviNomi = $state<Record<string, string>>({});
  let usi = $state<Record<string, string>>({});
  let categorie = $state<Record<string, string>>({});
  let testi = $state<Record<string, string>>({});
  $effect.pre(() => {
    colori = Object.fromEntries(data.colori.map((c) => [c.chiave, valoreColore(c.uso)]));
    nuoviNomi = {};
    usi = Object.fromEntries(data.testi.map((t) => [t.chiave, t.uso.uso]));
    categorie = Object.fromEntries(data.testi.map((t) => [t.chiave, t.uso.uso === 'nome' ? t.uso.categoria : 'regno']));
    testi = Object.fromEntries(data.testi.map((t) => [t.chiave, t.uso.uso === 'ignora' ? t.testo : t.uso.testo]));
  });
  const proposti = $derived(data.colori.filter((c) => c.proposto).length + data.testi.filter((t) => t.proposto).length);
  let generazione = $state(false);
</script>

<svelte:head><title>Importa la cartina {k.pulsante} · Cammini</title></svelte:head>

<header class="intestazione-pagina">
  <div>
    <p><a href="/cartine/{k.id}">← Cartina {k.pulsante}</a> · {k.cammino}</p>
    <h1>Importa la cartina {k.pulsante}</h1>
    <p>Dal file SVG del cartografo alla cartina del portale: carica il file, allinealo sul globo, classifica colori e testi, genera.</p>
  </div>
</header>

<ol class="passi">
  <li class:fatto={data.haSvg}>1. File SVG</li>
  <li class:fatto={k.punti >= 3}><a href="/cartine/{k.id}/allinea">2. Allinea ({k.punti} spilli)</a></li>
  <li class:fatto={data.haSvg && proposti === 0}>3. Classifica</li>
  <li class:fatto={!!data.generataIl}>4. Genera</li>
</ol>

<section class="riquadro sezione">
  <h2>1. File SVG</h2>
  <p>{#if data.haSvg}File attuale: <strong>{k.fonte}</strong>. Caricandone un altro, colori e testi già classificati si riconoscono da soli.
    {:else}La cartina non ha ancora il file. Il cartografo consegna l'SVG con i testi come testi (non convertiti in tracciati).{/if}</p>
  <form bind:this={moduloSvg} method="POST" action="?/svg" use:enhance={() => async ({ update }) => update({ reset: false })}>
    <input type="hidden" name="svg" value={svg} />
    <input type="hidden" name="disegno" value={disegno} />
    <input type="hidden" name="nome" value={nomeFile} />
    <label class="pulsante secondario file">{data.haSvg ? 'Carica un nuovo SVG' : 'Carica il file SVG'}
      <input type="file" accept=".svg,image/svg+xml" onchange={scegliFile} /></label>
    {#if estrazione.inCorso}<span>Lettura del disegno…</span>{/if}
  </form>
  {#if estrazione.errore}<p class="avviso">Non riesco a leggere il disegno: {estrazione.errore}</p>{/if}
  {#if form?.svgCaricato}<p class="conferma">File caricato. Controlla la classificazione qui sotto e, se il disegno è cambiato, gli spilli.</p>{/if}
</section>

{#if form?.errore}<p class="avviso" role="alert">{form.errore}</p>{/if}
{#if form?.generata}
  <div class="conferma" role="status">
    <p>Cartina generata in {form.generata.secondi} s: {form.generata.elementi} elementi, {form.generata.nomi} nomi,
      {form.generata.tracciati} tracciati, {form.generata.frecce} frecce. <a href="/pubblicazione">Aggiorna il portale</a> per vederla.</p>
    {#if form.generata.avvisi.length}<ul>{#each form.generata.avvisi as a (a)}<li>{a}</li>{/each}</ul>{/if}
  </div>
{/if}
{#if form?.classificata}<p class="conferma" role="status">Classificazione salvata{form.stiliNuovi?.length ? `; stili nuovi: ${form.stiliNuovi.join(', ')}` : ''}.</p>{/if}

{#if data.haSvg}
  <form method="POST" action="?/classifica" class="classificazione" use:enhance={() => {
    generazione = true;
    return async ({ update }) => { await update({ reset: false }); generazione = false; };
  }}>
    <div class="colonne">
      <div>
        <section class="riquadro sezione">
          <h2>3. Colori</h2>
          <p class="aiuto">Ogni colore del disegno diventa uno stile della cartina (con il suo nome e, se serve, la voce di legenda),
            il percorso del cammino, o niente: fondo, mari, fiumi, contorni (li disegnano gli stili), griglia. I pallini e i triangoli
            piccoli non sono qui: servono a spilli, città e frecce.{#if proposti} Le righe <span class="etichetta">proposta</span> non sono ancora state confermate.{/if}</p>
          <table class="elenco">
            <thead><tr><th scope="col">Colore</th><th scope="col">Nel disegno</th><th scope="col">Diventa</th></tr></thead>
            <tbody>
              {#each data.colori as c (c.chiave)}
                <tr>
                  <td>
                    {#if c.tipo === 'area'}<span class="campione" style:background={c.colore} style:opacity={c.opacita}></span>
                    {:else}<svg class="campione-linea" viewBox="0 0 40 10" aria-hidden="true"><path d="M2 5H38" stroke={c.colore} stroke-width={Math.min(6, Math.max(1, c.spessore * 2))} stroke-dasharray={c.tratteggiato ? '2 3' : undefined} /></svg>{/if}
                    <code>{c.colore}</code>
                  </td>
                  <td>{c.tipo === 'area' ? 'Area' : 'Linea'} · {c.forme} {c.forme === 1 ? 'forma' : 'forme'}{#if c.tipo === 'area' && c.opacita < 0.9} · trasparente{/if}
                    {#if c.proposto}<span class="etichetta">proposta</span>{/if}</td>
                  <td>
                    <select name="colore:{c.chiave}" bind:value={colori[c.chiave]} aria-label="Che cosa diventa il colore {c.colore}">
                      <option value="ignora">Niente</option>
                      {#if c.tipo === 'linea'}<option value="percorso">Percorso del cammino</option>{/if}
                      {#each data.stili.filter((s) => s.tipo === c.tipo) as s (s.chiave)}<option value="stile:{s.chiave}">Stile: {s.nome}</option>{/each}
                      <option value="nuovo">Nuovo stile…</option>
                    </select>
                    {#if colori[c.chiave] === 'nuovo'}
                      <input class="nuovo" name="nuovo:{c.chiave}" bind:value={nuoviNomi[c.chiave]} placeholder="Nome: «Regno di Mari»" aria-label="Nome del nuovo stile" />
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </section>

        <section class="riquadro sezione">
          <h2>3. Testi</h2>
          <p class="aiuto">I pezzi di testo del disegno, già ricomposti in parole. Un nome può continuare nella riga dopo
            («Regno» / «d'Egitto») e avere un sottotitolo; scrivi come deve comparire nel portale (regni e regioni vanno in
            maiuscolo da soli). Città e vette vanno dove sta il luogo dell'anagrafe; le città che sono già tappe di solito si
            lasciano fuori: c'è il pin.</p>
          <table class="elenco testi">
            <thead><tr><th scope="col">Nel disegno</th><th scope="col">Diventa</th><th scope="col">Nel portale</th></tr></thead>
            <tbody>
              {#each data.testi as t (t.chiave)}
                <tr class:spento={usi[t.chiave] === 'ignora'}>
                  <td><span class="originale" style:color={t.colore}>{t.testo}</span>
                    {#if t.proposto}<span class="etichetta">proposta</span>{/if}</td>
                  <td class="scelte">
                    <select name="uso:{t.chiave}" bind:value={usi[t.chiave]} aria-label="Che cosa diventa «{t.testo}»">
                      <option value="ignora">Niente</option>
                      <option value="nome">Nome</option>
                      <option value="riga">Riga dopo del nome sopra</option>
                      <option value="sotto">Sottotitolo del nome sopra</option>
                    </select>
                    {#if usi[t.chiave] === 'nome'}
                      <select name="categoria:{t.chiave}" bind:value={categorie[t.chiave]} aria-label="Categoria di «{t.testo}»">
                        {#each CATEGORIE_NOMI as c (c)}<option value={c}>{NOMI_CATEGORIE[c]}</option>{/each}
                      </select>
                    {/if}
                  </td>
                  <td>
                    {#if usi[t.chiave] !== 'ignora'}
                      <textarea name="testo:{t.chiave}" rows={Math.max(1, (testi[t.chiave] ?? '').split('\n').length)} bind:value={testi[t.chiave]}
                        aria-label="Testo nel portale per «{t.testo}»"></textarea>
                      {#if usi[t.chiave] === 'nome' && ['capitale-antica', 'citta-antica', 'vetta'].includes(categorie[t.chiave])}
                        <span class="luogo" class:manca={!t.luogo}>{t.luogo ? `→ ${t.luogo}, dall'anagrafe` : "non è nell'anagrafe dei luoghi"}</span>
                      {/if}
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </section>
      </div>

      <aside class="disegno">
        <img src="/api/cartine/{k.id}/svg" alt="La cartina come l'ha disegnata il cartografo" />
      </aside>
    </div>

    <div class="barra riquadro">
      <button class="pulsante secondario" type="submit">Salva la classificazione</button>
      <button class="pulsante" type="submit" formaction="?/genera" name="salvaPrima" value="1" disabled={generazione || k.punti < 3}
        title={k.punti < 3 ? 'Prima allinea la cartina: servono almeno 3 spilli' : undefined}>
        {generazione ? 'Generazione…' : '4. Salva e genera la cartina'}</button>
      {#if data.generataIl}<span class="nota">Ultima generazione: {quando(data.generataIl)}</span>{/if}
    </div>
  </form>
{/if}

<style>
  .passi { display: flex; gap: .5rem; list-style: none; padding: 0; margin: 0 0 1rem; flex-wrap: wrap; }
  .passi li { padding: .35rem .8rem; border-radius: 999px; background: var(--surface-alt); color: var(--ink-soft); font-size: .9rem; }
  .passi li.fatto { background: var(--accent-tint); color: var(--accent-ink); }
  .sezione { padding: 1rem 1.25rem; margin-bottom: 1.25rem; }
  .sezione p { margin: .3rem 0 .6rem; }
  h2 { font-size: 1.05rem; }
  .aiuto { color: var(--ink-soft); font-size: .88rem; }
  .file { position: relative; overflow: hidden; }
  .file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .colonne { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(16rem, 1fr); gap: 1.25rem; align-items: start; }
  .disegno { position: sticky; top: 1rem; }
  .disegno img { width: 100%; border: 1px solid var(--line); border-radius: var(--radius-md); background: #fff; }
  .elenco th, .elenco td { padding: .4rem .5rem; vertical-align: top; }
  .campione { display: inline-block; width: 22px; height: 16px; border: 1px solid #8a8c8e; vertical-align: middle; margin-right: .35rem; }
  .campione-linea { width: 40px; height: 12px; vertical-align: middle; margin-right: .35rem; }
  select, textarea, .nuovo { font: inherit; font-size: .88rem; padding: .3rem .4rem; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); }
  .nuovo { display: block; margin-top: .3rem; width: 100%; }
  .scelte { display: grid; gap: .3rem; }
  textarea { width: 100%; min-width: 12rem; resize: vertical; }
  .originale { font-weight: 600; }
  .spento .originale { opacity: .55; font-weight: 400; }
  .luogo { display: block; font-size: .8rem; color: var(--accent-ink); }
  .luogo.manca { color: var(--danger); }
  .barra { position: sticky; bottom: 0; display: flex; gap: .6rem; align-items: center; padding: .75rem 1rem; flex-wrap: wrap; }
  .nota { color: var(--ink-soft); font-size: .88rem; }
  .pulsante:disabled { opacity: .55; cursor: not-allowed; }
  .conferma { padding: .75rem 1rem; border-radius: var(--radius-sm); background: var(--accent-tint); color: var(--accent-ink); margin-bottom: 1rem; }
  .conferma p { margin: 0; }
  .conferma ul { margin: .3rem 0 0; padding-left: 1.2rem; }
  @media (max-width: 1100px) { .colonne { grid-template-columns: 1fr; } .disegno { position: static; } }
</style>
