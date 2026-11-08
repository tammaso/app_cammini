<script lang="ts">
  // Finestra di scelta dall'archivio: una o più immagini, con ricerca.
  import { urlAnteprima, type ImmagineScelta } from '#lib/immagini.ts';

  let {
    aperto,
    multiplo,
    escluse = [],
    titolo,
    onscegli,
    onchiudi,
  }: {
    aperto: boolean;
    multiplo: boolean;
    escluse?: number[]; // già presenti: mostrate ma non selezionabili
    titolo: string;
    onscegli: (immagini: ImmagineScelta[]) => void;
    onchiudi: () => void;
  } = $props();

  let finestra = $state<HTMLDialogElement>();
  let immagini = $state<ImmagineScelta[]>([]);
  let scelte = $state<ImmagineScelta[]>([]);
  let ricerca = $state('');
  let caricamento = $state(false);
  let attesa: ReturnType<typeof setTimeout> | undefined;
  let richiesta = 0;

  async function carica(testo: string) {
    const numero = ++richiesta;
    caricamento = true;
    const risposta = await fetch(`/api/immagini?q=${encodeURIComponent(testo)}`);
    const trovate: ImmagineScelta[] = await risposta.json();
    if (numero !== richiesta) return;
    immagini = trovate;
    caricamento = false;
  }

  $effect(() => {
    if (!finestra) return;
    if (aperto && !finestra.open) {
      scelte = [];
      ricerca = '';
      carica('');
      finestra.showModal();
    } else if (!aperto && finestra.open) {
      finestra.close();
    }
  });

  function cerca(evento: Event & { currentTarget: HTMLInputElement }) {
    ricerca = evento.currentTarget.value;
    clearTimeout(attesa);
    attesa = setTimeout(() => carica(ricerca), 250);
  }

  function alterna(immagine: ImmagineScelta) {
    if (!multiplo) {
      onscegli([immagine]);
      return;
    }
    scelte = scelte.some((s) => s.id === immagine.id) ? scelte.filter((s) => s.id !== immagine.id) : [...scelte, immagine];
  }

  const posizione = (id: number) => scelte.findIndex((s) => s.id === id);
</script>

<dialog bind:this={finestra} class="selettore" aria-labelledby="titolo-selettore" onclose={onchiudi}>
  <header>
    <h2 id="titolo-selettore">{titolo}</h2>
    <button type="button" class="chiudi" aria-label="Chiudi" onclick={onchiudi}>×</button>
  </header>
  <div class="barra">
    <input type="search" placeholder="Cerca per testo alternativo, didascalia, crediti o nome del file…" value={ricerca} oninput={cerca} />
    <a href="/immagini" target="_blank" rel="noopener">Carica nuove immagini ↗</a>
  </div>

  <div class="contenuto" aria-busy={caricamento}>
    {#if immagini.length}
      <ul class="griglia">
        {#each immagini as immagine (immagine.id)}
          {@const esclusa = escluse.includes(immagine.id)}
          {@const indice = posizione(immagine.id)}
          <li>
            <button
              type="button"
              class:scelta={indice >= 0}
              disabled={esclusa}
              aria-pressed={multiplo ? indice >= 0 : undefined}
              onclick={() => alterna(immagine)}
            >
              <img src={urlAnteprima(immagine.id, 320)} alt="" loading="lazy" />
              {#if indice >= 0}<span class="numero" aria-hidden="true">{indice + 1}</span>{/if}
              <span class="testo">{immagine.alt || immagine.nomeOriginale}</span>
              {#if esclusa}
                <span class="nota">già nella galleria</span>
              {:else if !immagine.completa}
                <span class="nota attenzione">mancano testo alternativo o crediti</span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {:else if !caricamento}
      <p class="vuoto">{ricerca ? 'Nessuna immagine trovata.' : "L'archivio è vuoto: carica prima le immagini."}</p>
    {/if}
  </div>

  {#if multiplo}
    <footer>
      <span>{scelte.length ? `${scelte.length} selezionate, nell'ordine dei clic` : 'Clicca sulle immagini da aggiungere'}</span>
      <button type="button" class="pulsante secondario" onclick={onchiudi}>Annulla</button>
      <button type="button" class="pulsante" disabled={!scelte.length} onclick={() => onscegli(scelte)}>
        Aggiungi {scelte.length || ''}
      </button>
    </footer>
  {/if}
</dialog>

<style>
  .selettore {
    width: min(64rem, calc(100vw - 2rem));
    max-height: calc(100vh - 3rem);
    padding: 0;
    border: 0;
    border-radius: var(--radius-md);
    box-shadow: 0 18px 46px rgb(36 33 28 / .25);
    background: var(--surface);
    color: var(--ink);
  }
  .selettore[open] { display: grid; grid-template-rows: auto auto 1fr auto; }
  .selettore::backdrop { background: rgb(36 33 28 / .45); }
  header, .barra, footer { padding: .9rem 1.25rem; display: flex; gap: 1rem; align-items: center; }
  header { justify-content: space-between; border-bottom: 1px solid var(--line); }
  header h2 { margin: 0; font-size: 1.1rem; }
  .chiudi { border: 0; background: none; font-size: 1.6rem; line-height: 1; cursor: pointer; color: var(--ink-soft); }
  .barra input { flex: 1; font: inherit; padding: .5rem .7rem; border: 1px solid var(--line); border-radius: var(--radius-sm); }
  .barra a { font-size: .9rem; white-space: nowrap; }
  .contenuto { overflow-y: auto; padding: 0 1.25rem 1rem; min-height: 12rem; }
  .griglia { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); gap: .75rem; }
  .griglia button {
    position: relative;
    width: 100%;
    display: grid;
    gap: .3rem;
    padding: 0 0 .5rem;
    border: 2px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    text-align: left;
    font: inherit;
    cursor: pointer;
    overflow: hidden;
  }
  .griglia button:hover:not(:disabled) { border-color: var(--accent); }
  .griglia button.scelta { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-tint); }
  .griglia button:disabled { opacity: .5; cursor: not-allowed; }
  .griglia img { width: 100%; height: 7.5rem; object-fit: cover; display: block; background: var(--surface-alt); }
  .numero {
    position: absolute;
    top: .4rem;
    right: .4rem;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    display: grid;
    place-items: center;
    font-weight: 700;
    font-size: .85rem;
  }
  .testo, .nota { padding: 0 .5rem; font-size: .85rem; }
  .testo { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nota { color: var(--ink-soft); font-size: .75rem; }
  .nota.attenzione { color: var(--brand); }
  .vuoto { color: var(--ink-faint); text-align: center; padding: 2rem; }
  footer { border-top: 1px solid var(--line); justify-content: flex-end; }
  footer span { margin-right: auto; color: var(--ink-soft); font-size: .9rem; }
</style>
