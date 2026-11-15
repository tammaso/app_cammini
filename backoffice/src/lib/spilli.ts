// Proposte automatiche degli spilli (punti di controllo) di una cartina: ogni nome della cartina che è nell'anagrafe
// va al simbolo più vicino, valutando tutti gli abbinamenti insieme (dove i nomi sono fitti il simbolo più vicino può
// essere del nome accanto). Le usa la pagina Allinea (nel browser) e la generazione con le proposte accettate (nel server).
import { eSimbolo, normale, type Forma, type Punto } from './disegno.ts';
import type { Certezza } from './georeferenziazione.ts';

export interface LuogoPerSpilli { id: number; nome: string; lat: number; lng: number; certezza: Certezza; chiavi: string[] }
export interface SpilloProposto {
  nome: string; luogoId: number; luogo: string; sx: number; sy: number; lng: number; lat: number; certezza: Certezza; stato: 'proposto';
}

// testi: le parole già ricomposte (gruppiDiTesto), con il loro riquadro sul foglio; luoghi: con tutte le forme del nome
// già normalizzate (normale)
export function proponiSpilli(forme: Forma[], testi: { testo: string; box: number[] }[], luoghi: LuogoPerSpilli[]): SpilloProposto[] {
  const centro = (b: number[]): Punto => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  // i simboli, escluse le punte di freccia che stanno sulla loro linea dello stesso colore
  const sullaSuaLinea = (f: Forma) => forme.some((l) => l.tratto && l.tratto === f.riempimento
    && l.parti.some((p) => p.some((q) => Math.hypot(q[0] - centro(f.box)[0], q[1] - centro(f.box)[1]) < 4)));
  const simboli = forme.filter((f) => eSimbolo(f) && !sullaSuaLinea(f)).map((f) => centro(f.box));
  const nomi = testi.map((t) => ({ t, luogo: luoghi.find((l) => l.chiavi.includes(normale(t.testo))) })).filter((x) => x.luogo);
  // il riquadro di un testo comprende lo spazio di ascendenti e discendenti: si stringe in altezza
  const costo = (b: number[], s: Punto) => {
    const h = b[3] - b[1], y0 = b[1] + h * 0.25, y1 = b[3] - h * 0.2;
    return Math.hypot(Math.max(b[0] - s[0], 0, s[0] - b[2]), Math.max(y0 - s[1], 0, s[1] - y1));
  };
  const coppie: [number, number, number][] = [];
  nomi.forEach((x, i) => simboli.forEach((s, j) => coppie.push([costo(x.t.box, s), i, j])));
  coppie.sort((a, b) => a[0] - b[0]);
  const scelta = new Map<number, number>(), presi = new Set<number>();
  for (const [c, i, j] of coppie) if (c < 15 && !scelta.has(i) && !presi.has(j)) { scelta.set(i, j); presi.add(j); }
  for (let migliorato = true; migliorato;) {
    migliorato = false;
    const indici = [...scelta.keys()];
    for (const i of indici) for (const k of indici) {
      if (i >= k) continue;
      const a = scelta.get(i)!, b = scelta.get(k)!;
      if (costo(nomi[i].t.box, simboli[b]) + costo(nomi[k].t.box, simboli[a]) < costo(nomi[i].t.box, simboli[a]) + costo(nomi[k].t.box, simboli[b]) - 1e-6) {
        scelta.set(i, b); scelta.set(k, a); migliorato = true;
      }
    }
  }
  return [...scelta].map(([i, j]) => {
    const l = nomi[i].luogo!;
    return { nome: l.nome, luogoId: l.id, luogo: l.nome, sx: simboli[j][0], sy: simboli[j][1], lng: l.lng, lat: l.lat, certezza: l.certezza, stato: 'proposto' as const };
  }).sort((a, b) => b.lat - a.lat);
}
