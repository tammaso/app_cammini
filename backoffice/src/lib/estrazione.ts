// Estrazione del disegno da una cartina SVG, nel browser (serve il DOM): l'SVG si inserisce nascosto
// nella pagina, così il browser risolve da solo trasformazioni, classi CSS e forme (percorsi, rettangoli,
// cerchi) e ne dà le coordinate sul foglio, nelle unità del viewBox. Dalla prova prototipo/allinea.html.
import type { Disegno, Forma, Punto, Riquadro, Testo } from './disegno.ts';

const PASSO = 1; // ogni quanti punti del foglio si campionano le linee
const r2 = (n: number) => Math.round(n * 100) / 100;

// «rgb(251, 178, 115)» → «#fbb273»; «none», gradienti e motivi → null
function esadecimale(colore: string): string | null {
  const m = colore.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (!m || m[4] === '0') return null;
  return `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`;
}

export function estraiDisegno(testoSvg: string): Disegno {
  const contenitore = document.createElement('div');
  contenitore.style.cssText = 'position:absolute;left:-20000px;top:0;visibility:hidden';
  contenitore.innerHTML = testoSvg;
  document.body.appendChild(contenitore);
  try {
    const svg = contenitore.querySelector('svg');
    if (!svg) throw new Error('Il file non contiene un disegno SVG.');
    const radice = svg.getScreenCTM()!.inverse();
    const versoFoglio = (el: SVGGraphicsElement) => radice.multiply(el.getScreenCTM()!); // dal sistema dell'elemento al foglio
    const punto = (m: DOMMatrix, x: number, y: number): Punto => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];

    // Un ritaglio non rettangolare (per esempio sull'arco della Mezzaluna) serve agli effetti grafici: le
    // copie schiarite delle aree dentro l'arco. Quello che è ritagliato così non è contenuto e si salta.
    const ritaglioRettangolare = new Map<string, boolean>();
    function rettangolare(id: string): boolean {
      if (ritaglioRettangolare.has(id)) return ritaglioRettangolare.get(id)!;
      const clip = svg!.querySelector(`clipPath#${CSS.escape(id)}`);
      const esito = !clip || [...clip.querySelectorAll<SVGGeometryElement>('path, rect, polygon')].every((c) => {
        const m = c.transform.baseVal.consolidate()?.matrix ?? new DOMMatrix(), l = c.getTotalLength(), q: Punto[] = [];
        for (let k = 0; k <= 40; k++) { const p = c.getPointAtLength((l * k) / 40); q.push(punto(m, p.x, p.y)); }
        const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
        const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
        return q.every(([x, y]) => Math.min(Math.abs(x - x0), Math.abs(x - x1), Math.abs(y - y0), Math.abs(y - y1)) < 0.5);
      });
      ritaglioRettangolare.set(id, esito);
      return esito;
    }
    const effetto = (el: Element) => {
      for (let e: Element | null = el; e && e !== svg; e = e.parentElement) {
        const id = (e.getAttribute('clip-path') || '').match(/url\(["']?#([^"')]+)/)?.[1];
        if (id && !rettangolare(id)) return true;
      }
      return false;
    };
    // l'opacità di un elemento comprende quella di tutti i gruppi che lo contengono
    const opacitaGruppi = (el: Element) => {
      let o = 1;
      for (let e: Element | null = el; e && e !== svg; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
      return o;
    };

    const elementi = [...svg.querySelectorAll<SVGGeometryElement>('path, rect, circle, ellipse, polygon, polyline, line')].filter((el) => {
      if (el.closest('defs, clipPath, mask, pattern, symbol') || effetto(el)) return false;
      const st = getComputedStyle(el);
      return st.display !== 'none' && (esadecimale(st.fill) || esadecimale(st.stroke));
    });
    // Delle copie dello stesso tracciato con un altro colore (effetti grafici) si tiene quella disegnata
    // sopra: è quella che si vede.
    const firma = (el: Element) => {
      const st = getComputedStyle(el);
      return [el.tagName, el.getAttribute('d') ?? el.outerHTML.length, el.getAttribute('transform'), !!esadecimale(st.fill), !!esadecimale(st.stroke)].join('|');
    };
    const ultima = new Map(elementi.map((el) => [firma(el), el]));
    const forme: Forma[] = [];
    for (const el of elementi) {
      if (ultima.get(firma(el)) !== el) continue;
      const st = getComputedStyle(el);
      const m = versoFoglio(el), lunghezza = el.getTotalLength(), scala = Math.hypot(m.a, m.b);
      const n = Math.max(8, Math.ceil(lunghezza / PASSO)), parti: Punto[][] = [];
      let attuale: Punto[] = [], prima: Punto | null = null;
      for (let k = 0; k <= n; k++) {
        const p = el.getPointAtLength((lunghezza * k) / n), q = punto(m, p.x, p.y);
        // un salto lungo è un nuovo sotto-tracciato (un «sposta a» nel percorso)
        if (prima && Math.hypot(q[0] - prima[0], q[1] - prima[1]) > PASSO * 4 * scala) { if (attuale.length > 1) parti.push(attuale); attuale = []; }
        attuale.push([r2(q[0]), r2(q[1])]);
        prima = q;
      }
      if (attuale.length > 1) parti.push(attuale);
      if (!parti.length) continue;
      const xs = parti.flat().map((q) => q[0]), ys = parti.flat().map((q) => q[1]);
      const gruppi = opacitaGruppi(el);
      forme.push({
        parti,
        riempimento: esadecimale(st.fill),
        opacita: r2(Number(st.fillOpacity) * gruppi),
        tratto: esadecimale(st.stroke),
        spessore: r2(parseFloat(st.strokeWidth) * scala),
        tratteggiato: st.strokeDasharray !== 'none',
        box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      });
    }

    // testi: ogni riga (tspan, o il testo intero) con il suo riquadro sul foglio, l'inizio e la fine della
    // riga e la sua inclinazione
    const testi: Testo[] = [];
    for (const t of svg.querySelectorAll<SVGTextElement>('text')) {
      const m = versoFoglio(t);
      const righe: SVGTextContentElement[] = t.querySelectorAll('tspan').length ? [...t.querySelectorAll<SVGTSpanElement>('tspan')] : [t];
      let indice = 0;
      for (const r of righe) {
        const quanti = r.getNumberOfChars(), contenuto = (r.textContent ?? '').replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl');
        if (quanti && contenuto.trim()) {
          const primo = t.getExtentOfChar(indice), ultimo = t.getExtentOfChar(indice + quanti - 1);
          const angoli = [primo, ultimo].flatMap((e) => [punto(m, e.x, e.y), punto(m, e.x + e.width, e.y), punto(m, e.x, e.y + e.height), punto(m, e.x + e.width, e.y + e.height)]);
          const xs = angoli.map((q) => q[0]), ys = angoli.map((q) => q[1]);
          const inizio = punto(m, primo.x, primo.y + primo.height / 2), fine = punto(m, ultimo.x + ultimo.width, ultimo.y + ultimo.height / 2);
          testi.push({
            testo: contenuto, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(r2) as Riquadro,
            inizio: [r2(inizio[0]), r2(inizio[1])], fine: [r2(fine[0]), r2(fine[1])],
            angolo: r2((Math.atan2(m.b, m.a) * 180) / Math.PI), colore: esadecimale(getComputedStyle(t).fill) ?? '#000000',
            dimensione: r2(parseFloat(getComputedStyle(t).fontSize) * Math.hypot(m.a, m.b)),
          });
        }
        indice += quanti;
      }
    }

    // La cornice è la forma riempita più grande (il fondo della cartina): tutto si ritaglia lì dentro e il
    // fondo non si disegna. Il riquadro della legenda è un rettangolo bianco piccolo: quello che contiene
    // non è carta.
    const area = (b: Riquadro) => (b[2] - b[0]) * (b[3] - b[1]);
    const riempite = forme.filter((f) => f.riempimento);
    if (!riempite.length) throw new Error('Nel disegno non ci sono aree colorate.');
    const cornice = riempite.reduce((a, f) => (area(f.box) > area(a.box) ? f : a)).box;
    const dentro = (b: Riquadro, c: Riquadro) => b[0] >= c[0] - 0.5 && b[1] >= c[1] - 0.5 && b[2] <= c[2] + 0.5 && b[3] <= c[3] + 0.5;
    const legenda = forme.find((f) => f.riempimento === '#ffffff' && f.opacita > 0.9 && area(f.box) > area(cornice) * 0.01 && area(f.box) < area(cornice) * 0.15)?.box;
    const fuoriLegenda = (b: Riquadro) => !legenda || !dentro(b, legenda);
    return {
      cornice,
      forme: forme.filter((f) => fuoriLegenda(f.box) && !(f.riempimento && area(f.box) > area(cornice) * 0.9 && !f.tratto)),
      testi: testi.filter((t) => fuoriLegenda(t.box) && dentro(t.box, cornice)),
    };
  } finally {
    contenitore.remove();
  }
}
