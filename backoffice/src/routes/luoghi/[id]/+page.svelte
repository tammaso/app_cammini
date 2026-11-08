<script lang="ts">
  import { enhance } from '$app/forms';
  import { CERTEZZE, TIPI_LUOGO } from '#lib/cammini.ts';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();

  const l = $derived(data.luogo);
  const titolo = $derived(l ? l.nome : 'Nuovo luogo');
  const valori = $derived(form?.valori ?? {
    nome: l?.nome ?? '', nomeAntico: l?.nomeAntico ?? '', nomeAttuale: l?.nomeAttuale ?? '', altriNomi: l?.altriNomi.join(', ') ?? '',
    lat: l ? String(l.lat) : '', lng: l ? String(l.lng) : '', tipo: l?.tipo ?? 'citta', certezza: l?.certezza ?? 'certa', nota: l?.nota ?? '',
  });
  const errori: Record<string, string | undefined> = $derived(form?.errori ?? {});
  const mappa = $derived(l ? `https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lng}#map=9/${l.lat}/${l.lng}` : '');
</script>

<svelte:head><title>{titolo} · Cammini</title></svelte:head>

<header class="intestazione-pagina">
  <div>
    <p><a href="/luoghi">← Luoghi</a></p>
    <h1>{titolo}</h1>
    {#if l}<p>{l.lat}, {l.lng} · <a href={mappa} target="_blank" rel="noopener">vedi sulla mappa ↗</a></p>{/if}
  </div>
</header>

{#if form?.salvato}<p class="conferma" role="status">Luogo salvato. Le tappe che lo usano si spostano alla prossima pubblicazione.</p>{/if}
{#if form?.messaggio}<p class="avviso" role="alert">{form.messaggio}</p>{/if}

<div class="disposizione">
  <form class="riquadro modulo" method="POST" action="?/salva" use:enhance={() => async ({ update }) => update({ reset: false })}>
    <div class="campo">
      <label for="nome">Nome</label>
      <span class="aiuto">Il nome italiano: «Carran».</span>
      <input id="nome" name="nome" value={valori.nome} required aria-invalid={errori.nome ? 'true' : undefined} />
      {#if errori.nome}<span class="errore">{errori.nome}</span>{/if}
    </div>
    <div class="due">
      <div class="campo">
        <label for="nomeAntico">Nome antico</label>
        <input id="nomeAntico" name="nomeAntico" value={valori.nomeAntico} placeholder="Harran" />
      </div>
      <div class="campo">
        <label for="nomeAttuale">Nome o luogo attuale</label>
        <input id="nomeAttuale" name="nomeAttuale" value={valori.nomeAttuale} placeholder="Harran, Turchia sud-orientale" />
      </div>
    </div>
    <div class="campo">
      <label for="altriNomi">Altri nomi</label>
      <span class="aiuto">Separati da virgole: tutte le forme in cui il luogo può comparire scritto su una cartina. Servono ad abbinare
        i nomi della cartina ai luoghi.</span>
      <input id="altriNomi" name="altriNomi" value={valori.altriNomi} placeholder="Harran, Haran, Charran" />
    </div>
    <div class="due">
      <div class="campo">
        <label for="lat">Latitudine</label>
        <span class="aiuto">Gradi decimali. Si può incollare qui la coppia «lat, lng» copiata da una mappa.</span>
        <input id="lat" name="lat" value={valori.lat} required aria-invalid={errori.lat ? 'true' : undefined} />
        {#if errori.lat}<span class="errore">{errori.lat}</span>{/if}
      </div>
      <div class="campo">
        <label for="lng">Longitudine</label>
        <span class="aiuto">Gradi decimali, positivi a est di Greenwich.</span>
        <input id="lng" name="lng" value={valori.lng} aria-invalid={errori.lng ? 'true' : undefined} />
        {#if errori.lng}<span class="errore">{errori.lng}</span>{/if}
      </div>
    </div>
    <div class="due">
      <div class="campo">
        <label for="tipo">Tipo</label>
        <select id="tipo" name="tipo" value={valori.tipo}>
          {#each Object.entries(TIPI_LUOGO) as [valore, nome] (valore)}<option value={valore}>{nome}</option>{/each}
        </select>
      </div>
      <div class="campo">
        <label for="certezza">Certezza dell'identificazione</label>
        <select id="certezza" name="certezza" value={valori.certezza}>
          {#each CERTEZZE as c (c)}<option value={c}>{c}</option>{/each}
        </select>
      </div>
    </div>
    <p class="aiuto">Certa: sito identificato, lo spillo tiene fermo il disegno della cartina. Probabile o ipotetica: lo spillo cede in parte
      verso dove lo vorrebbe il disegno.</p>
    <div class="campo">
      <label for="nota">Nota</label>
      <textarea id="nota" name="nota" value={valori.nota} placeholder="Di solito identificata con Beitin; altri propongono el-Bireh"></textarea>
    </div>
    <div class="azioni">
      <button class="pulsante" type="submit">{l ? 'Salva' : 'Aggiungi il luogo'}</button>
      <a class="pulsante secondario" href="/luoghi">Annulla</a>
      {#if l}
        <button class="pulsante pericolo spinta" type="submit" formaction="?/elimina" formnovalidate disabled={data.usi.length > 0}
          title={data.usi.length ? 'Il luogo è usato: toglilo prima da lì' : undefined}
          onclick={(evento) => { if (!confirm(`Eliminare «${l.nome}» dall'anagrafe?`)) evento.preventDefault(); }}>Elimina</button>
      {/if}
    </div>
  </form>

  {#if l}
    <section class="riquadro uso">
      <h2>Dove è usato</h2>
      {#if data.usi.length}
        <ul>{#each data.usi as u (u.dove)}<li><a href={u.href}>{u.dove}</a></li>{/each}</ul>
      {:else}
        <p>Non è usato da nessuna tappa né cartina.</p>
      {/if}
    </section>
  {/if}
</div>

<style>
  .disposizione { display: grid; grid-template-columns: minmax(0, 46rem) minmax(16rem, 1fr); gap: 1.5rem; align-items: start; }
  .modulo { max-width: none; }
  .due { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .campo select { font: inherit; padding: .55rem .7rem; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); }
  .campo textarea { min-height: 5rem; }
  .aiuto { color: var(--ink-soft); font-size: .85rem; margin: 0; }
  .uso { padding: 1rem 1.25rem; }
  .uso h2 { font-size: 1rem; }
  .uso ul { margin: 0; padding-left: 1.1rem; }
  .uso p { color: var(--ink-soft); margin: 0; }
  .pulsante:disabled { opacity: .5; cursor: not-allowed; }
  .conferma { padding: .75rem 1rem; border-radius: var(--radius-sm); background: var(--accent-tint); color: var(--accent-ink); margin-bottom: 1rem; }
  @media (max-width: 1000px) { .disposizione { grid-template-columns: 1fr; } }
</style>
