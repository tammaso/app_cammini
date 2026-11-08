<script lang="ts">
  import '../app.css';
  import favicon from '#lib/assets/favicon.svg';
  import { page } from '$app/state';
  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();

  const sezioni = [
    { href: '/cammini', nome: 'Cammini', anche: '/cartine' },
    { href: '/luoghi', nome: 'Luoghi' },
    { href: '/immagini', nome: 'Immagini' },
    { href: '/pubblicazione', nome: 'Pubblicazione' },
    { href: '/backup', nome: 'Backup' },
    { href: '/registro', nome: 'Registro' },
  ];

  const dentro = (href: string) => page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  // Le cartine stanno sotto «Cammini».
  const attiva = ({ href, anche }: { href: string; anche?: string }) => dentro(href) || (anche !== undefined && dentro(anche));
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
</svelte:head>

<div class="struttura">
  <nav aria-label="Sezioni del backoffice">
    <a class="marchio" href="/">Cammini<span>backoffice</span></a>
    <ul>
      {#each sezioni as sezione (sezione.href)}
        <li>
          <a href={sezione.href} aria-current={attiva(sezione) ? 'page' : undefined}>{sezione.nome}</a>
        </li>
      {/each}
    </ul>
    <p class="portale"><a href="http://localhost:8000/prototipo/cammino.html" target="_blank" rel="noopener">Apri il portale ↗</a></p>
  </nav>
  <main>
    {@render children()}
  </main>
</div>

<style>
  .struttura { display: grid; grid-template-columns: 15rem 1fr; min-height: 100vh; }
  nav { background: var(--surface); border-right: 1px solid var(--line); padding: 1.25rem 1rem; }
  .marchio {
    display: grid;
    font: 700 1.1rem var(--font-display);
    color: var(--ink);
    text-decoration: none;
    margin-bottom: 1.5rem;
  }
  .marchio span { font: 500 .8rem var(--font-body); color: var(--brand); text-transform: uppercase; letter-spacing: .08em; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: .2rem; }
  li a { display: block; padding: .5rem .75rem; border-radius: var(--radius-sm); text-decoration: none; color: var(--ink); }
  li a:hover { background: var(--surface-alt); }
  li a[aria-current='page'] { background: var(--accent-tint); color: var(--accent-ink); font-weight: 600; }
  .portale { margin: 1.5rem 0 0; padding: 0 .75rem; font-size: .9rem; }
  main { padding: 2rem 2.5rem; max-width: 72rem; width: 100%; }

  @media (max-width: 760px) {
    .struttura { grid-template-columns: 1fr; }
    nav { border-right: 0; border-bottom: 1px solid var(--line); }
    ul { grid-auto-flow: column; overflow-x: auto; }
    main { padding: 1.25rem 1rem; }
  }
</style>
