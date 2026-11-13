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
    etichette: data.etichette, ordine: c ? String(c.ordine) : '0', stato: c?.stato ?? 'bozza',
  });
  const errori: Record<string, string | undefined> = $derived(form?.errori ?? {});
  const portale = $derived(c ? `http://localhost:8000/prototipo/cammino.html?cammino=${c.slug}` : '');
</script>

<svelte:head><title>{titolo} · Cammini</title></svelte:head>

<header class="intestazione-pagina">
  <div>
    <p><a href="/cammini">← Cammini</a></p>
    <h1>{titolo}</h1>
    {#if c}<p>Cartella e indirizzo nel portale: <code>{c.slug}</code> · <a href={portale} target="_blank" rel="noopener">vedi nel portale ↗</a></p>{/if}
  </div>
</header>

{#if form?.salvato}<p class="conferma" role="status">Cammino salvato. Per vederlo nel portale, <a href="/pubblicazione">aggiorna il portale</a>.</p>{/if}
{#if data.avvisi.length}
  <div class="attenzione" role="status">
    <p>Da controllare prima di pubblicare:</p>
    <ul>{#each data.avvisi as avviso (avviso)}<li>{avviso}</li>{/each}</ul>
  </div>
{/if}

{#if c}
  <section class="riquadro sezione">
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

  <section class="riquadro sezione">
    <div class="intestazione-sezione">
      <h2>Cartine storiche</h2>
      <a class="pulsante secondario" href="/cammini/{c.id}/cartine/nuova">Nuova cartina</a>
    </div>
    <p class="aiuto">Una per epoca: nel portale un pulsante per ciascuna, in ordine di anno, poi «Oggi». Si importano dal file SVG del
      cartografo: si carica il file, si allinea sul globo, si classificano colori e testi, si genera.</p>
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

<form class="riquadro modulo" method="POST" action="?/salva" use:enhance={() => async ({ update }) => update({ reset: false })}>
  <h2>{c ? 'Testi e impostazioni' : 'Il nuovo cammino'}</h2>
  {#if !c}
    <div class="campo">
      <label for="slug">Indirizzo</label>
      <span class="aiuto">Nome della cartella e dell'indirizzo nel portale (cammino.html?cammino=…). Minuscole, numeri e trattini; non si cambia più.</span>
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
  <fieldset class="campo stato">
    <legend>Stato</legend>
    <span class="aiuto">Il portale di prova mostra anche i cammini in bozza; la pubblicazione vera conterrà solo quelli pubblicati.</span>
    <label class="spunta"><input type="radio" name="stato" value="bozza" checked={valori.stato !== 'pubblicato'} /> Bozza</label>
    <label class="spunta"><input type="radio" name="stato" value="pubblicato" checked={valori.stato === 'pubblicato'} /> Pubblicato</label>
  </fieldset>
  <div class="azioni">
    <button class="pulsante" type="submit">{c ? 'Salva' : 'Crea il cammino'}</button>
    <a class="pulsante secondario" href="/cammini">Annulla</a>
    {#if c}
      <button class="pulsante pericolo spinta" type="submit" formaction="?/elimina" formnovalidate
        onclick={(evento) => { if (!confirm(`Eliminare «${c.titolo}» con tutte le sue tappe e cartine?`)) evento.preventDefault(); }}>
        Elimina il cammino
      </button>
    {/if}
  </div>
</form>

<style>
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
  .modulo { max-width: none; }
  .codice { font-family: Consolas, monospace; font-size: .85rem; min-height: 11rem; }
  .stato { border: 0; padding: 0; margin: 0; }
  .stato legend { font-weight: 600; padding: 0; margin-bottom: .3rem; }
  .spunta { display: flex; gap: .5rem; align-items: center; }
  .conferma { padding: .75rem 1rem; border-radius: var(--radius-sm); background: var(--accent-tint); color: var(--accent-ink); margin-bottom: 1rem; }
  .attenzione { padding: .75rem 1rem; border-radius: var(--radius-sm); background: var(--brand-tint); color: var(--brand); margin-bottom: 1rem; }
  .attenzione p { margin: 0; font-weight: 600; }
  .attenzione ul { margin: .3rem 0 0; padding-left: 1.2rem; }
  .solo-lettori { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
