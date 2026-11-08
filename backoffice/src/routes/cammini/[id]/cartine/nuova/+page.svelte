<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
  const valori = $derived(form?.valori ?? { pulsante: '', anno: '', epoca: '' });
  const errori: Record<string, string | undefined> = $derived(form?.errori ?? {});
  // il nome del file si propone dall'anno: -1200 → 1200ac
  let anno = $state('');
  let epoca = $state('');
  let toccato = $state(false);
  $effect(() => {
    if (toccato) return;
    const n = Number(anno);
    epoca = Number.isInteger(n) && anno ? (n < 0 ? `${-n}ac` : `${n}dc`) : '';
  });
</script>

<svelte:head><title>Nuova cartina · Cammini</title></svelte:head>

<header class="intestazione-pagina">
  <div>
    <p><a href="/cammini/{data.cammino.id}">← {data.cammino.titolo}</a></p>
    <h1>Nuova cartina storica</h1>
    <p>Un'epoca del cammino: nel portale avrà il suo pulsante. Dopo averla creata si carica il file SVG del cartografo.</p>
  </div>
</header>

<form class="riquadro modulo" method="POST" use:enhance>
  <div class="campo">
    <label for="pulsante">Pulsante</label>
    <span class="aiuto">Il testo del pulsante sulla carta: «1200 a.C.».</span>
    <input id="pulsante" name="pulsante" value={valori.pulsante} required aria-invalid={errori.pulsante ? 'true' : undefined} />
    {#if errori.pulsante}<span class="errore">{errori.pulsante}</span>{/if}
  </div>
  <div class="campo stretto">
    <label for="anno">Anno</label>
    <span class="aiuto">Negativo prima di Cristo: dà l'ordine dei pulsanti.</span>
    <input id="anno" name="anno" inputmode="numeric" bind:value={anno} required aria-invalid={errori.anno ? 'true' : undefined} />
    {#if errori.anno}<span class="errore">{errori.anno}</span>{/if}
  </div>
  <div class="campo stretto">
    <label for="epoca">Nome del file</label>
    <span class="aiuto">La cartina si pubblica come <code>{epoca || '…'}.json</code> nella cartella del cammino.</span>
    <input id="epoca" name="epoca" bind:value={epoca} oninput={() => (toccato = true)} required aria-invalid={errori.epoca ? 'true' : undefined} />
    {#if errori.epoca}<span class="errore">{errori.epoca}</span>{/if}
  </div>
  <div class="azioni">
    <button class="pulsante" type="submit">Crea e carica l'SVG</button>
    <a class="pulsante secondario" href="/cammini/{data.cammino.id}">Annulla</a>
  </div>
</form>
