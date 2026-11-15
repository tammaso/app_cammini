// Prove automatiche del portale (prototipo/cammino.html): un vero browser segue il racconto come un visitatore.
// Uso: npm run prova-portale  (rapporto: npx playwright show-report prove-portale/rapporto)
// Il server è quello di sempre (strumenti/server.py) su una porta sua, così non disturba quello già acceso.
// Serve la connessione a Internet: la pagina prende MapLibre da unpkg e i caratteri da Google Fonts.
import { defineConfig } from '@playwright/test';

const PORTA = 8020;

export default defineConfig({
  testDir: 'prove-portale',
  outputDir: 'prove-portale/risultati',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  // un browser alla volta: la carta si disegna senza scheda grafica (SwiftShader), quindi più browser insieme non
  // fanno prima, e il server di prova (strumenti/server.py) con tre browser che chiedono il satellite insieme a volte
  // lascia cadere qualche richiesta («Failed to fetch»), che le prove leggerebbero come errori della pagina
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'prove-portale/rapporto', open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORTA}/prototipo/`,
    // il Chrome installato sul computer: niente browser da scaricare
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    locale: 'it-IT',
    // senza animazioni (voli, tracciato che si disegna): le prove sono rapide e sempre uguali.
    // La prova delle animazioni le riaccende per sé.
    contextOptions: { reducedMotion: 'reduce' },
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'computer', testIgnore: /telefono/ },
    { name: 'telefono', testMatch: /telefono/, use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ],
  webServer: {
    command: `py strumenti/server.py ${PORTA}`,
    url: `http://localhost:${PORTA}/prototipo/cammino.html`,
    reuseExistingServer: true,
    timeout: 30_000
  }
});
