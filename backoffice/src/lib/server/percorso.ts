// Il percorso del cammino, dalle linee della cartina: un tracciato per ogni tappa, dalla tappa precedente.
// Le linee del percorso (già sulla carta, in longitudine e latitudine) diventano una rete: punti
// consecutivi collegati, e i pezzi interrotti (per esempio dove ci sono le frecce) ricollegati se le
// estremità sono vicine. Per ogni coppia di tappe si cerca la strada più breve sulla rete; i tratti già
// percorsi costano di più, e così le linee prese contromano: il verso lo danno le punte di freccia della
// cartina (una linea senza frecce si percorre nei due versi). Così l'andata e il ritorno prendono le due
// linee che la cartina disegna (in Egitto). Ogni tracciato parte e arriva esattamente sulle tappe.
import type { Punto } from '../disegno.ts';
import { km } from '../georeferenziazione.ts';

const SALTO_KM = 60; // le estremità di un pezzo si collegano agli altri pezzi entro questa distanza
const RIPASSO = 3; // quanto costa ripercorrere un tratto già fatto
const CONTROMANO = 3; // quanto costa percorrere una linea contro il verso delle sue frecce
const FRECCIA_KM = 40; // una freccia vale per la linea che le passa entro questa distanza

export function tracciaPercorso(linee: Punto[][], tappe: Punto[], frecce: { coordinate: Punto; rotazione: number }[] = []): { tracciati: (Punto[] | null)[]; avvisi: string[] } {
  const nodi: Punto[] = [];
  const archi: Map<number, number>[] = [];
  const collega = (a: number, b: number) => {
    const d = km(nodi[a], nodi[b]);
    archi[a].set(b, Math.min(d, archi[a].get(b) ?? Infinity));
    archi[b].set(a, Math.min(d, archi[b].get(a) ?? Infinity));
  };
  const estremita: { nodo: number; linea: number }[] = [];
  linee.forEach((linea, l) => {
    linea.forEach((p, i) => {
      nodi.push(p);
      archi.push(new Map());
      if (i > 0) collega(nodi.length - 2, nodi.length - 1);
    });
    estremita.push({ nodo: nodi.length - linea.length, linea: l }, { nodo: nodi.length - 1, linea: l });
  });
  // Le estremità di un pezzo si collegano al punto più vicino di ciascun altro pezzo: chiudono i vuoti
  // lasciati per le frecce (anche lunghi: in Egitto 36 km) e gli innesti a metà linea (a Bersabea)
  const lineaDi: number[] = [];
  linee.forEach((linea, l) => linea.forEach(() => lineaDi.push(l)));
  for (const e of estremita) {
    const migliori = new Map<number, [number, number]>(); // linea -> [nodo, distanza]
    nodi.forEach((p, i) => {
      if (lineaDi[i] === e.linea) return;
      const d = km(nodi[e.nodo], p);
      if (d < SALTO_KM && d < (migliori.get(lineaDi[i])?.[1] ?? Infinity)) migliori.set(lineaDi[i], [i, d]);
    });
    for (const [nodo] of migliori.values()) collega(e.nodo, nodo);
  }

  // Il verso di ogni linea, dalle sue frecce: +1 se si percorre nel verso in cui è disegnata, -1 al contrario
  const verso = new Map<number, number>();
  const direzione = (a: Punto, b: Punto) => (Math.atan2((b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), b[1] - a[1]) * 180) / Math.PI;
  for (const f of frecce) {
    let migliore = -1, distanza = FRECCIA_KM;
    nodi.forEach((p, i) => { const d = km(f.coordinate, p); if (d < distanza) { distanza = d; migliore = i; } });
    if (migliore < 0) continue;
    const l = lineaDi[migliore], seguente = lineaDi[migliore + 1] === l ? migliore + 1 : migliore - 1;
    if (lineaDi[seguente] !== l) continue;
    const disegnata = seguente > migliore ? direzione(nodi[migliore], nodi[seguente]) : direzione(nodi[seguente], nodi[migliore]);
    const scarto = Math.abs((((disegnata - f.rotazione) % 360) + 540) % 360 - 180);
    verso.set(l, scarto < 90 ? 1 : -1);
  }
  const contromano = (u: number, v: number) => {
    if (lineaDi[u] !== lineaDi[v] || Math.abs(u - v) !== 1) return false; // i collegamenti tra pezzi non hanno verso
    const s = verso.get(lineaDi[u]);
    return s !== undefined && Math.sign(v - u) !== s;
  };

  const vicino = (p: Punto) => nodi.reduce((m, q, i) => (km(p, q) < km(p, nodi[m]) ? i : m), 0);
  const usati = new Set<string>();
  const arco = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

  // Dijkstra semplice: le reti delle cartine hanno qualche migliaio di punti
  function strada(da: number, a: number): number[] | null {
    const dist = new Float64Array(nodi.length).fill(Infinity), prima = new Int32Array(nodi.length).fill(-1), fatto = new Uint8Array(nodi.length);
    dist[da] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < nodi.length; i++) if (!fatto[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0) return null;
      if (u === a) break;
      fatto[u] = 1;
      for (const [v, d] of archi[u]) {
        const costo = dist[u] + d * (usati.has(arco(u, v)) ? RIPASSO : 1) * (contromano(u, v) ? CONTROMANO : 1);
        if (costo < dist[v]) { dist[v] = costo; prima[v] = u; }
      }
    }
    const cammino = [a];
    while (cammino[0] !== da) cammino.unshift(prima[cammino[0]]);
    return cammino;
  }

  // Se tra due punti non c'è strada, la rete è spezzata in parti lontane (una freccia lunga, un pezzo
  // staccato): si uniscono le due estremità più vicine tra la parte raggiunta e il resto, e si riprova.
  function stradaRicucendo(da: number, a: number): number[] | null {
    for (let tentativi = 0; tentativi < estremita.length; tentativi++) {
      const s = strada(da, a);
      if (s) return s;
      const raggiunti = new Set([da]), coda = [da];
      while (coda.length) for (const v of archi[coda.pop()!].keys()) if (!raggiunti.has(v)) { raggiunti.add(v); coda.push(v); }
      let coppia: [number, number] | null = null, distanza = Infinity;
      for (const e of estremita) for (const f of estremita) {
        if (!raggiunti.has(e.nodo) || raggiunti.has(f.nodo)) continue;
        const d = km(nodi[e.nodo], nodi[f.nodo]);
        if (d < distanza) { distanza = d; coppia = [e.nodo, f.nodo]; }
      }
      if (!coppia) return null;
      collega(...coppia);
    }
    return null;
  }

  const tracciati: (Punto[] | null)[] = [];
  const avvisi: string[] = [];
  if (!nodi.length) return { tracciati: tappe.slice(1).map(() => null), avvisi: ['La cartina non ha linee del percorso.'] };
  for (let i = 1; i < tappe.length; i++) {
    const s = stradaRicucendo(vicino(tappe[i - 1]), vicino(tappe[i]));
    if (!s) {
      avvisi.push(`Tra la tappa ${i} e la ${i + 1} il percorso della cartina è interrotto: linea dritta.`);
      tracciati.push(null);
      continue;
    }
    for (let k = 1; k < s.length; k++) usati.add(arco(s[k - 1], s[k]));
    tracciati.push(raccorda(s.map((n) => nodi[n]), tappe[i - 1], tappe[i]));
  }
  return { tracciati, avvisi };
}

// Il tracciato parte esattamente da `da` e arriva esattamente in `a`: il punto della rete più vicino a
// una tappa non è proprio la tappa, e lo scostamento si riassorbe dolcemente entro ~30 km (`raggio`, in
// gradi) dalle due estremità.
export function raccorda(tratto: Punto[], da: Punto, a: Punto, raggio = 0.3): Punto[] {
  if (tratto.length < 2) return [da, a];
  const s = [0];
  for (let i = 1; i < tratto.length; i++) s.push(s[i - 1] + Math.hypot(tratto[i][0] - tratto[i - 1][0], tratto[i][1] - tratto[i - 1][1]));
  const lunghezza = s.at(-1)!;
  const r = Math.min(raggio, lunghezza / 2) || 1;
  const dolce = (x: number) => { const c = Math.min(1, Math.max(0, x)); return 1 - (3 * c ** 2 - 2 * c ** 3); }; // 1 all'estremità, poi 0
  const d0 = [da[0] - tratto[0][0], da[1] - tratto[0][1]], d1 = [a[0] - tratto.at(-1)![0], a[1] - tratto.at(-1)![1]];
  return tratto.map(([x, y], i) => {
    const w0 = dolce(s[i] / r), w1 = dolce((lunghezza - s[i]) / r);
    return [Math.round((x + w0 * d0[0] + w1 * d1[0]) * 1e4) / 1e4, Math.round((y + w0 * d0[1] + w1 * d1[1]) * 1e4) / 1e4];
  });
}
