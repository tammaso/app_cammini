// Estrazione del disegno da una cartina SVG, nel browser (serve il DOM): l'SVG si inserisce nascosto
// nella pagina, così il browser risolve da solo trasformazioni, classi CSS e forme (percorsi, rettangoli,
// cerchi) e ne dà le coordinate sul foglio, nelle unità del viewBox. Dalla prova prototipo/allinea.html.
import { sogliaSimboli, type Disegno, type Forma, type Punto, type Riquadro, type Testo } from './disegno.ts';

const PASSO = 1; // ogni quanti punti del foglio si campionano le linee
const r2 = (n: number) => Math.round(n * 100) / 100;

// «rgb(251, 178, 115)» → «#fbb273»; «none» e colori trasparenti → null
function esadecimale(colore: string): string | null {
  const m = colore.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (!m || m[4] === '0') return null;
  return `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`;
}

const riferimento = (valore: string | null) => valore?.match(/url\(["']?#([^"')]+)/)?.[1] ?? null;

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
    const perId = (id: string) => svg!.querySelector(`[id="${CSS.escape(id)}"]`);

    // Una sfumatura vale come il suo colore medio: ogni fermata pesa per il tratto di sfumatura che copre.
    // Le fermate possono essere ereditate da un'altra sfumatura (href).
    const coloriSfumature = new Map<string, string | null>();
    function coloreSfumatura(id: string): string | null {
      if (coloriSfumature.has(id)) return coloriSfumature.get(id)!;
      let g = perId(id), fermate: Element[] = [];
      for (let salti = 0; g && salti < 5; salti++) {
        fermate = [...g.querySelectorAll('stop')];
        if (fermate.length || !/gradient$/i.test(g.tagName)) break;
        const href = riferimento(`url(${g.getAttribute('href') ?? g.getAttribute('xlink:href') ?? ''})`);
        g = href ? perId(href) : null;
      }
      let esito: string | null = null;
      const voci = fermate.map((s) => {
        const v = s.getAttribute('offset') ?? '0';
        return { posizione: Math.min(1, Math.max(0, v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v) || 0)), colore: esadecimale(getComputedStyle(s).stopColor) };
      }).filter((v): v is { posizione: number; colore: string } => v.colore !== null);
      if (voci.length) {
        const somma = [0, 0, 0];
        let pesi = 0;
        voci.forEach((v, i) => {
          const da = i === 0 ? 0 : (voci[i - 1].posizione + v.posizione) / 2;
          const a = i === voci.length - 1 ? 1 : (v.posizione + voci[i + 1].posizione) / 2;
          const peso = Math.max(a - da, 1e-6);
          [1, 3, 5].forEach((k, c) => (somma[c] += parseInt(v.colore.slice(k, k + 2), 16) * peso));
          pesi += peso;
        });
        esito = `#${somma.map((s) => Math.round(s / pesi).toString(16).padStart(2, '0')).join('')}`;
      }
      coloriSfumature.set(id, esito);
      return esito;
    }
    // il colore di un riempimento o di una linea: tinta unita, o il colore medio di una sfumatura
    const colore = (valore: string) => {
      const id = riferimento(valore);
      return id ? coloreSfumatura(id) : esadecimale(valore);
    };

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
        const id = riferimento(e.getAttribute('clip-path'));
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
      if (el.closest('defs, clipPath, mask, pattern, symbol, marker') || effetto(el)) return false;
      const st = getComputedStyle(el);
      return st.display !== 'none' && (colore(st.fill) || colore(st.stroke));
    });
    // Delle copie dello stesso tracciato con un altro colore (effetti grafici) si tiene quella disegnata
    // sopra: è quella che si vede. La firma è la geometria dell'elemento: due cerchi sono la stessa forma
    // solo se hanno lo stesso centro e lo stesso raggio.
    const GEOMETRIA = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'points', 'x1', 'y1', 'x2', 'y2', 'transform'];
    const firma = (el: Element) => {
      const st = getComputedStyle(el);
      return [el.tagName, ...GEOMETRIA.map((a) => el.getAttribute(a) ?? ''), !!colore(st.fill), !!colore(st.stroke)].join('|');
    };
    const ultima = new Map(elementi.map((el) => [firma(el), el]));
    const forme: Forma[] = [];
    const riquadro = (punti: Punto[]): Riquadro => {
      const xs = punti.map((q) => q[0]), ys = punti.map((q) => q[1]);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    };
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
      const gruppi = opacitaGruppi(el);
      forme.push({
        parti,
        riempimento: colore(st.fill),
        opacita: r2(Number(st.fillOpacity) * gruppi),
        tratto: colore(st.stroke),
        spessore: r2(parseFloat(st.strokeWidth) * scala),
        tratteggiato: st.strokeDasharray !== 'none',
        box: riquadro(parti.flat()),
      });
      const fine = punteDiFreccia(el, st, m, lunghezza);
      if (fine) forme.push(fine);
    }

    // Le punte di freccia disegnate come «marker» alla fine di una linea: il browser non le dà come forme,
    // si ricostruiscono. Il contenuto del marker si porta nel suo sistema (viewBox, punto di riferimento,
    // dimensione, spessore della linea se markerUnits = strokeWidth), si ruota lungo la linea e si mette
    // alla sua fine. Sono simboli: servono a trovare il percorso e la sua direzione.
    function punteDiFreccia(el: SVGGeometryElement, st: CSSStyleDeclaration, m: DOMMatrix, lunghezza: number): Forma | null {
      const id = riferimento(st.getPropertyValue('marker-end'));
      const marker = id ? perId(id) : null;
      if (!marker || marker.tagName.toLowerCase() !== 'marker' || lunghezza < 1) return null;
      const forma = marker.querySelector<SVGGeometryElement>('path, polygon, circle, ellipse, rect');
      if (!forma) return null;
      const riempimento = colore(getComputedStyle(forma).fill);
      if (!riempimento) return null;
      const numero = (a: string, d: number) => { const v = parseFloat(marker.getAttribute(a) ?? ''); return Number.isFinite(v) ? v : d; };
      // il contenuto e il punto di riferimento sono nelle stesse unità (quelle del viewBox del marker)
      const [, , vw, vh] = (marker.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
      const mw = numero('markerWidth', 3), mh = numero('markerHeight', 3);
      let s = vw > 0 && vh > 0 ? Math.min(mw / vw, mh / vh) : 1;
      if ((marker.getAttribute('markerUnits') ?? 'strokeWidth') === 'strokeWidth') s *= parseFloat(st.strokeWidth) || 1;
      const rx = numero('refX', 0), ry = numero('refY', 0);
      const a = el.getPointAtLength(lunghezza), b = el.getPointAtLength(Math.max(0, lunghezza - 0.5));
      const orient = marker.getAttribute('orient') ?? '0';
      const angolo = /^auto/.test(orient) ? Math.atan2(a.y - b.y, a.x - b.x) : (parseFloat(orient) * Math.PI) / 180;
      const [c, sn] = [Math.cos(angolo), Math.sin(angolo)];
      const l = forma.getTotalLength(), contorno: Punto[] = [];
      for (let k = 0; k <= 40; k++) {
        const p = forma.getPointAtLength((l * k) / 40);
        const [x, y] = [(p.x - rx) * s, (p.y - ry) * s];
        const q = punto(m, a.x + x * c - y * sn, a.y + x * sn + y * c);
        contorno.push([r2(q[0]), r2(q[1])]);
      }
      return { parti: [contorno], riempimento, opacita: 1, tratto: null, spessore: 0, tratteggiato: false, box: riquadro(contorno), simbolo: true };
    }

    // testi: ogni riga (tspan, o il testo intero) con il suo riquadro sul foglio, l'inizio e la fine della
    // riga e la sua inclinazione. Un testo lungo una curva (textPath) ha l'inclinazione della curva nel suo
    // punto di mezzo; le lettere che non ci stanno (oltre la fine della curva) il browser non le disegna.
    const testi: Testo[] = [];
    for (const t of svg.querySelectorAll<SVGTextElement>('text')) {
      const m = versoFoglio(t);
      const sulCurva = !!t.querySelector('textPath');
      const righe: SVGTextContentElement[] = !sulCurva && t.querySelectorAll('tspan').length ? [...t.querySelectorAll<SVGTSpanElement>('tspan')] : [t];
      let indice = 0;
      for (const r of righe) {
        const quanti = r.getNumberOfChars(), contenuto = (r.textContent ?? '').replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl');
        if (quanti && contenuto.trim()) {
          const angoloFoglio = (Math.atan2(m.b, m.a) * 180) / Math.PI;
          const dimensione = r2(parseFloat(getComputedStyle(t).fontSize) * Math.hypot(m.a, m.b));
          const coloreTesto = colore(getComputedStyle(t).fill) ?? '#000000';
          if (sulCurva) {
            const disegnate = [...Array(quanti).keys()].map((i) => indice + i).filter((i) => { const e = t.getExtentOfChar(i); return e.width > 0 || e.height > 0; });
            if (disegnate.length) {
              const angoli = disegnate.flatMap((i) => { const e = t.getExtentOfChar(i); return [punto(m, e.x, e.y), punto(m, e.x + e.width, e.y + e.height)]; });
              const meta = disegnate[Math.floor(disegnate.length / 2)];
              const inizio = t.getStartPositionOfChar(disegnate[0]), fine = t.getEndPositionOfChar(disegnate.at(-1)!);
              const [qi, qf] = [punto(m, inizio.x, inizio.y), punto(m, fine.x, fine.y)];
              testi.push({
                testo: contenuto, box: riquadro(angoli).map(r2) as Riquadro,
                inizio: [r2(qi[0]), r2(qi[1])], fine: [r2(qf[0]), r2(qf[1])],
                angolo: r2(angoloFoglio + t.getRotationOfChar(meta)), colore: coloreTesto, dimensione,
              });
            }
          } else {
            const primo = t.getExtentOfChar(indice), ultimo = t.getExtentOfChar(indice + quanti - 1);
            const angoli = [primo, ultimo].flatMap((e) => [punto(m, e.x, e.y), punto(m, e.x + e.width, e.y), punto(m, e.x, e.y + e.height), punto(m, e.x + e.width, e.y + e.height)]);
            const inizio = punto(m, primo.x, primo.y + primo.height / 2), fine = punto(m, ultimo.x + ultimo.width, ultimo.y + ultimo.height / 2);
            testi.push({
              testo: contenuto, box: riquadro(angoli).map(r2) as Riquadro,
              inizio: [r2(inizio[0]), r2(inizio[1])], fine: [r2(fine[0]), r2(fine[1])],
              angolo: r2(angoloFoglio), colore: coloreTesto, dimensione,
            });
          }
        }
        indice += quanti;
      }
    }

    // La cornice è la forma riempita più grande (il fondo della cartina): tutto si ritaglia lì dentro e il
    // fondo non si disegna. Non conta il foglio bianco sotto tutto il disegno, se c'è un fondo più piccolo
    // che occupa buona parte del foglio (la carta con sotto titolo e legenda). Il riquadro della legenda,
    // se sta dentro la carta, è un rettangolo bianco piccolo: quello che contiene non è carta.
    const area = (b: Riquadro) => (b[2] - b[0]) * (b[3] - b[1]);
    const riempite = forme.filter((f) => f.riempimento);
    if (!riempite.length) throw new Error('Nel disegno non ci sono aree colorate.');
    const vb = svg.viewBox.baseVal;
    const foglio: Riquadro = vb && vb.width > 0 ? [vb.x, vb.y, vb.x + vb.width, vb.y + vb.height] : riquadro(riempite.flatMap((f) => f.parti.flat()));
    const tuttoIlFoglio = (f: Forma) => f.riempimento === '#ffffff' && f.box[0] <= foglio[0] + 1 && f.box[1] <= foglio[1] + 1 && f.box[2] >= foglio[2] - 1 && f.box[3] >= foglio[3] - 1;
    const fondi = riempite.filter((f) => !tuttoIlFoglio(f) && area(f.box) > area(foglio) * 0.25);
    const candidate = fondi.length ? fondi : riempite;
    const cornice = candidate.reduce((a, f) => (area(f.box) > area(a.box) ? f : a)).box;
    const dentro = (b: Riquadro, c: Riquadro) => b[0] >= c[0] - 0.5 && b[1] >= c[1] - 0.5 && b[2] <= c[2] + 0.5 && b[3] <= c[3] + 0.5;
    const tocca = (b: Riquadro, c: Riquadro) => b[0] <= c[2] && b[2] >= c[0] && b[1] <= c[3] && b[3] >= c[1];
    const legenda = forme.find((f) => f.riempimento === '#ffffff' && f.opacita > 0.9 && area(f.box) > area(cornice) * 0.01 && area(f.box) < area(cornice) * 0.15)?.box;
    const fuoriLegenda = (b: Riquadro) => !legenda || !dentro(b, legenda);
    const soglia = sogliaSimboli(cornice);
    for (const f of forme) if (f.riempimento && f.simbolo === undefined) f.simbolo = f.box[2] - f.box[0] < soglia && f.box[3] - f.box[1] < soglia;
    return {
      cornice,
      // fuori dalla carta (titolo, legenda e note sotto la carta) non c'è niente da importare
      forme: forme.filter((f) => fuoriLegenda(f.box) && tocca(f.box, cornice) && !(f.riempimento && area(f.box) > area(cornice) * 0.9 && !f.tratto)),
      testi: testi.filter((t) => fuoriLegenda(t.box) && dentro(t.box, cornice)),
    };
  } finally {
    contenitore.remove();
  }
}
