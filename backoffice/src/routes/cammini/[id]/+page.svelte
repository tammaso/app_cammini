<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();

  const c = $derived(data.cammino);
  const titolo = $derived(c ? c.titolo : 'Nuovo cammino');
  // Dopo un errore si ripropongono i valori inviati, altrimenti quelli salvati.
  const valori = $derived(form?.valori ?? {
    slug: c?.slug ?? '', titolo: c?.titolo ?? '', nome: c?.nome ?? '', sottotitolo: c?.sottotitolo ?? '',
    globoLuogo: c?.globoLuogo ?? '', globoTesto: c?.globoTesto ?? '', panoramicaTesto: c?.panoramicaTesto ?? '',
    etichette: data.etichette, ordine: c ? String(c.ordine) : '0', stato: c?.stato ?? 'bozza', conferma: '',
  });
  const errori: Record<string, string | undefined> = $derived(form?.errori ?? {});
  const portale = $derived(c ? `http://localhost:8000/prototipo/cammino.html?cammino=${c.slug}` : '');

  // un cammino pubblicato ha l'indirizzo nel QR del libro: torna in bozza solo riscrivendo l'indirizzo
  let stato = $state('bozza');
  $effect.pre(() => { stato = valori.stato; });
  const pubblicato = $derived(c?.stato === 'pubblicato');
  const chiedeConferma = $derived(pubblicato && stato === 'bozza');

  const STATI = { fatto: 'fatto', 'da-fare': 'da fare', 'da-controllare': 'da controllare', facoltativo: 'facoltativo' } as const;

  let copiato = $state(false);
  async function copiaIndirizzo() {
    if (!c) return;
    await navigator.clipboard.writeText(`cammino.html?cammino=${c.slug}`);
    copiato = true;
    setTimeout(() => (copiato = false), 2000);
  }
</script>

<svelte:head><title>{titolo} · Cammini</title></svelte:head>

<header class="intestazione-pagina">
  <div>
    <p><a href="/cammini">← Cammini</a></p>
    <h1>{titolo}</h1>
    {#if c}
      <p>Indirizzo nel portale: <code>cammino.html?cammino={c.slug}</code>
        <button class="copia" type="button" onclick={copiaIndirizzo}>{copiato ? 'Copiato' : 'Copia'}</button>
        · <a href={portale} target="_blank" rel="noopener">vedi nel portale ↗</a></p>
    {/if}
  </div>
</header>

{#if pubblicato}
  <p class="protetto" role="note"><strong>Indirizzo protetto.</strong> Il cammino è pubblicato: il suo indirizzo va nel QR stampato sul
    libro e non cambia più. Il cammino non si può eliminare e torna in bozza solo riscrivendo l'indirizzo.</p>
{/if}
{#if form?.messaggio}<p class="avviso" role="alert">{form.messaggio}</p>{/if}
{#if form?.salvato}<p class="conferma" role="status">Cammino salvato. Per vederlo nel portale, <a href="/pubblicazione">prepara l'anteprima e pubblica</a>.</p>{/if}
{#if c && data.passi.length}
  <ol class="passi" aria-label="Il lavoro sul cammino, passo per passo">
    {#each data.passi as p, i (p.chiave)}
      <li class={p.stato}>
        <a href={p.href}>
          <span class="testa-passo"><span class="numero-passo" aria-hidden="true">{p.stato === 'fatto' ? '✓' : i + 1}</span>
            <span class="titolo-passo">{p.titolo}</span></span>
          <span class="stato-passo">{STATI[p.stato]}</span>
          <span class="testo-passo">{p.testo}</span>
        </a>
      </li>
    {/each}
  </ol>
{/if}
{#if data.avvisi.length}
  <details class="attenzione" open={data.avvisi.length <= 3}>
    <summary>Da controllare prima di pubblicare ({data.avvisi.length})</summary>
    <ul>{#each data.avvisi as avviso (avviso)}<li>{avviso}</li>{/each}</ul>
  </details>
{/if}


<form class="riquadro modulo" id="testi" method="POST" action="?/salva" use:enhance={() => async ({ update }) => update({ reset: false })}>
  <h2>{c ? 'Testi e impostazioni' : 'Il nuovo cammino'}</h2>
  {#if !c}
    <div class="campo">
      <label for="slug">Indirizzo</label>
      <span class="aiuto">Nome della cartella e dell'indirizzo nel portale (cammino.html?cammino=…), che finirà nel QR stampato sul libro.
        Minuscole, numeri e trattini; sceglilo con cura: dopo la creazione non si cambia più.</span>
      <input id="slug" name="slug" value={valori.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" aria-invalid={errori.slug ? 'true' : undefined} />
      {#if errori.slug}<span class="errore">{errori.slug}</span>{/if}
    </div>
  {/if}
  <div class="campo">
    <label for="titolo">Titolo</label>
    <span class="aiuto">In testa al pannello: «Il cammino di Abramo».</span>
    <input id="titolo" name="titolo" value={valori.titolo} required aria-invalid={errori.titolo ? 'true' : undefined} />
    {#if errori.titolo}<span class="errore">{errori.titolo}</span>{/if}
  </div>
  <div class="campo">
    <label for="nome">Nome in legenda</label>
    <span class="aiuto">Accanto alla linea del cammino nella legenda: «Cammino di Abramo».</span>
    <input id="nome" name="nome" value={valori.nome} required aria-invalid={errori.nome ? 'true' : undefined} />
    {#if errori.nome}<span class="errore">{errori.nome}</span>{/if}
  </div>
  <div class="campo">
    <label for="sottotitolo">Sottotitolo</label>
    <input id="sottotitolo" name="sottotitolo" value={valori.sottotitolo} placeholder="Dalla Mesopotamia a Canaan · Genesi 11–25" />
  </div>
  <div class="campo">
    <label for="globoLuogo">Globo: dove</label>
    <span class="aiuto">Il primo passo, con il globo che gira: una riga sopra il testo.</span>
    <input id="globoLuogo" name="globoLuogo" value={valori.globoLuogo} placeholder="Tra Africa, Asia ed Europa" />
  </div>
  <div class="campo">
    <label for="globoTesto">Globo: testo</label>
    <textarea id="globoTesto" name="globoTesto" value={valori.globoTesto}></textarea>
  </div>
  <div class="campo">
    <label for="panoramicaTesto">Panoramica del cammino</label>
    <span class="aiuto">Il passo con tutto il percorso inquadrato e le tappe bianche, prima della prima tappa.</span>
    <textarea id="panoramicaTesto" name="panoramicaTesto" value={valori.panoramicaTesto}></textarea>
  </div>
  <details class="avanzate" open={!!(errori.etichette || errori.ordine)}>
    <summary>Avanzate: nomi scritti a mano sulla carta, ordine nel portale</summary>
    <div class="campo">
    <label for="etichette">Nomi scritti a mano sulla carta</label>
    <span class="aiuto">Uno per riga: <code>tipo; testo; longitudine, latitudine</code>, con tipo <code>mare</code> (in ogni epoca),
      <code>fiume</code> o <code>regione</code> (solo in «Oggi»).</span>
    <textarea id="etichette" name="etichette" class="codice" value={valori.etichette} aria-invalid={errori.etichette ? 'true' : undefined}></textarea>
    {#if errori.etichette}<span class="errore">{errori.etichette}</span>{/if}
    </div>
    <div class="campo stretto">
    <label for="ordine">Ordine nel portale</label>
    <input id="ordine" name="ordine" inputmode="numeric" value={valori.ordine} aria-invalid={errori.ordine ? 'true' : undefined} />
    {#if errori.ordine}<span class="errore">{errori.ordine}</span>{/if}
    </div>
  </details>
  <fieldset class="campo stato">
    <legend>Stato</legend>
    <span class="aiuto">Il portale di prova mostra anche i cammini in bozza; la pubblicazione vera conterrà solo quelli pubblicati.
      Da pubblicato, l'indirizzo del cammino è protetto: è quello del QR del libro.</span>
    <label class="spunta"><input type="radio" name="stato" value="bozza" bind:group={stato} /> Bozza</label>
    <label class="spunta"><input type="radio" name="stato" value="pubblicato" bind:group={stato} /> Pubblicato</label>
  </fieldset>
  {#if chiedeConferma && c}
    <div class="campo conferma-bozza">
      <label for="conferma">Per rimetterlo in bozza, riscrivi l'indirizzo</label>
      <span class="aiuto">In bozza il cammino uscirà dalla pubblicazione vera e il QR dei libri già stampati porterà a una pagina
        d'errore. Se sei sicuro, scrivi <code>{c.slug}</code>.</span>
      <input id="conferma" name="conferma" value={valori.conferma ?? ''} autocomplete="off" spellcheck="false"
        aria-invalid={errori.conferma ? 'true' : undefined} />
      {#if errori.conferma}<span class="errore">{errori.conferma}</span>{/if}
    </div>
  {/if}
  <div class="azioni">
    <button class="pulsante" type="submit">{c ? 'Salva' : 'Crea il cammino'}</button>
    <a class="pulsante secondario" href="/cammini">Annulla</a>
    {#if c && pubblicato}
      <span class="spinta aiuto">Un cammino pubblicato non si elimina.</span>
    {:else if c}
      <button class="pulsante pericolo spinta" type="submit" formaction="?/elimina" formnovalidate
        onclick={(evento) => { if (!confirm(`Eliminare «${c.titolo}» con tutte le sue tappe e cartine?`)) evento.preventDefault(); }}>
        Elimina il cammino
      </button>
    {/if}
  </div>
</form>

{#if c}
  <section class="riquadro sezione" id="tappe">
    <div class="intestazione-sezione">
      <h2>Tappe</h2>
      <a class="pulsante secondario" href="/cammini/{c.id}/tappe/nuova">Nuova tappa</a>
    </div>
    <p class="aiuto">Nell'ordine del viaggio. Il tracciato di una tappa va dalla tappa precedente a questa; senza tracciato è una linea dritta.</p>
    <table class="elenco">
      <thead><tr><th scope="col">#</th><th scope="col">Tappa</th><th scope="col">Luogo</th><th scope="col">Riferimento</th>
        <th scope="col">Tracciato</th><th scope="col"><span class="solo-lettori">Ordine</span></th></tr></thead>
      <tbody>
        {#each data.tappe as t, i (t.id)}
          <tr>
            <td class="numero">{i + 1}</td>
            <td><a href="/cammini/{c.id}/tappe/{t.id}">{t.nome}</a>{#if t.immagini} <span class="etichetta">{t.immagini === 1 ? '1 immagine' : `${t.immagini} immagini`}</span>{/if}</td>
            <td>{t.luogo}</td>
            <td>{t.riferimento ?? '—'}</td>
            <td>{i === 0 ? 'partenza' : t.puntiTracciato ? `${t.puntiTracciato} punti` : 'linea dritta'}</td>
            <td class="ordine">
              <form method="POST" action="?/sposta" use:enhance>
                <input type="hidden" name="tappa" value={t.id} />
                <button class="freccia" type="submit" name="verso" value="su" disabled={i === 0} aria-label="Sposta {t.nome} prima">↑</button>
                <button class="freccia" type="submit" name="verso" value="giu" disabled={i === data.tappe.length - 1} aria-label="Sposta {t.nome} dopo">↓</button>
              </form>
            </td>
          </tr>
        {:else}
          <tr><td class="vuoto" colspan="6">Nessuna tappa.</td></tr>
        {/each}
      </tbody>
    </table>
    {#if data.tappe.length > 1}
      <form class="ritorno" method="POST" action="?/ritorno" use:enhance={() => async ({ update }) => update({ reset: false })}>
        <label for="ritorno">Dopo l'ultima tappa</label>
        <select id="ritorno" name="ritorno" value={String(c.ritornoTappaId ?? '')}>
          <option value="">il cammino finisce</option>
          {#each data.tappe.slice(0, -1) as t, i (t.id)}<option value={String(t.id)}>torna alla tappa {i + 1}, {t.nome}</option>{/each}
        </select>
        <button class="pulsante secondario" type="submit">Salva</button>
        <span class="aiuto">Il tracciato del ritorno viene dal percorso della cartina, alla prossima generazione.</span>
      </form>
    {/if}
  </section>

  <section class="riquadro sezione" id="cartine">
    <div class="intestazione-sezione">
      <h2>Cartine storiche</h2>
      <a class="pulsante secondario" href="/cammini/{c.id}/cartine/nuova">Nuova cartina</a>
    </div>
    <p class="aiuto">Una per epoca: nel portale un pulsante per ciascuna, in ordine di anno, poi «Oggi». Si importano dal file SVG del
      cartografo: si carica il file e si genera con le proposte del backoffice; poi, se serve, si ritocca.</p>
    <table class="elenco">
      <thead><tr><th scope="col">Epoca</th><th scope="col" class="numero">Anno</th><th scope="col" class="numero">Elementi</th>
        <th scope="col" class="numero">Nomi</th><th scope="col" class="numero">Punti di controllo</th></tr></thead>
      <tbody>
        {#each data.cartine as k (k.id)}
          <tr>
            <td><a href="/cartine/{k.id}">{k.pulsante}</a></td>
            <td class="numero">{k.anno}</td><td class="numero">{k.elementi}</td><td class="numero">{k.nomi}</td><td class="numero">{k.punti}</td>
          </tr>
        {:else}
          <tr><td class="vuoto" colspan="5">Nessuna cartina: nel portale c'è solo «Oggi».</td></tr>
        {/each}
      </tbody>
    </table>
  </section>
{/if}

<style>
  .passi { list-style: none; margin: 0 0 1.25rem; padding: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .6rem; }
  .passi a {
    display: grid; gap: .25rem; align-content: start; height: 100%; padding: .7rem .8rem; text-decoration: none; color: var(--ink);
    background: var(--surface); border: 1px solid var(--line); border-top: 4px solid var(--line); border-radius: var(--radius-sm);
  }
  .passi a:hover { border-color: var(--accent); }
  .passi .fatto a { border-top-color: var(--accent); }
  .passi .da-fare a { border-top-color: var(--brand); }
  .passi .da-controllare a { border-top-color: var(--danger); }
  .testa-passo { display: flex; align-items: center; gap: .45rem; }
  .numero-passo {
    display: grid; place-items: center; width: 1.6rem; height: 1.6rem; border-radius: 50%; font-weight: 700; font-size: .85rem;
    background: var(--surface-alt); color: var(--ink-soft);
  }
  .fatto .numero-passo { background: var(--accent-tint); color: var(--accent-ink); }
  .titolo-passo { font-weight: 700; }
  .stato-passo { font-size: .78rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-soft); }
  .fatto .stato-passo { color: var(--accent-ink); }
  .da-fare .stato-passo { color: var(--brand); }
  .da-controllare .stato-passo { color: var(--danger); }
  .testo-passo { font-size: .88rem; color: var(--ink-soft); }
  .avanzate { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: .6rem .9rem; background: var(--surface-alt); }
  .avanzate summary { cursor: pointer; font-weight: 600; }
  .avanzate[open] summary { margin-bottom: .6rem; }
  @media (max-width: 1100px) { .passi { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 640px) { .passi { grid-template-columns: 1fr; } }
  .sezione { padding: 1rem 1.25rem; margin-bottom: 1.25rem; }
  .sezione .elenco th, .sezione .elenco td { padding: .5rem .6rem; }
  .intestazione-sezione { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
  h2 { font-size: 1.1rem; }
  .aiuto { color: var(--ink-soft); font-size: .9rem; margin: .2rem 0 .6rem; }
  .ordine form { display: flex; gap: .25rem; justify-content: flex-end; }
  .ritorno { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; margin-top: .75rem; }
  .ritorno label { font-weight: 600; }
  .ritorno select { font: inherit; padding: .35rem .5rem; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); }
  .freccia { border: 1px solid var(--line); background: var(--surface); border-radius: var(--radius-sm); width: 2rem; height: 2rem; cursor: pointer; }
  .freccia:hover:not(:disabled) { border-color: var(--accent); }
  .freccia:disabled { opacity: .35; cursor: default; }
  .modulo { max-width: none; margin-bottom: 1.25rem; }
  .codice { font-family: Consolas, monospace; font-size: .85rem; min-height: 11rem; }
  .stato { border: 0; padding: 0; margin: 0; }
  .stato legend { font-weight: 600; padding: 0; margin-bottom: .3rem; }
  .spunta { display: flex; gap: .5rem; align-items: center; }
  .conferma { padding: .75rem 1rem; border-radius: var(--radius-sm); background: var(--accent-tint); color: var(--accent-ink); margin-bottom: 1rem; }
  .attenzione { padding: .75rem 1rem; border-radius: var(--radius-sm); background: var(--brand-tint); color: var(--brand); margin-bottom: 1rem; }
  .attenzione summary { font-weight: 600; cursor: pointer; }
  .attenzione ul { margin: .3rem 0 0; padding-left: 1.2rem; }
  .copia { font: inherit; font-size: .8rem; padding: .1rem .5rem; margin-left: .3rem; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); cursor: pointer; }
  .copia:hover { border-color: var(--accent); }
  .protetto { padding: .75rem 1rem; border-radius: var(--radius-sm); background: var(--surface-alt); border-left: 4px solid var(--accent); margin-bottom: 1rem; }
  .conferma-bozza { border-left: 4px solid var(--danger); padding-left: .75rem; }
  .solo-lettori { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
