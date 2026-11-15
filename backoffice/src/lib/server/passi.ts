// Percorso guidato della pagina del cammino: i cinque passi del lavoro del redattore (testi, tappe, immagini,
// cartina, pubblicazione), ciascuno con il suo stato, calcolato dai dati. Non si salva niente.
import type { DatabaseSync } from 'node:sqlite';
import { elencaTappe, leggiCammino } from './cammini.ts';

export type StatoPasso = 'fatto' | 'da-fare' | 'da-controllare' | 'facoltativo';
export type StatoNelPortale = 'assente' | 'da-aggiornare' | 'aggiornato';

export interface Passo {
  chiave: 'testi' | 'tappe' | 'immagini' | 'cartina' | 'pubblica';
  titolo: string;
  stato: StatoPasso;
  testo: string;
  href: string; // dove si fa: una sezione della pagina o un'altra pagina
}

const quante = (n: number, una: string, molte: string) => (n === 1 ? `1 ${una}` : `${n} ${molte}`);

// avvisi: quelli della pubblicazione (componiCammino); portale: se il cammino è nel portale e se è aggiornato
export function passiDelCammino(db: DatabaseSync, id: number, { avvisi, portale }: { avvisi: string[]; portale: StatoNelPortale }): Passo[] {
  const c = leggiCammino(db, id)!;
  const tappe = elencaTappe(db, id);

  const mancano = [!c.globoTesto.trim() && 'il testo del globo', !c.panoramicaTesto.trim() && 'la panoramica'].filter(Boolean);
  const testi: Passo = {
    chiave: 'testi', titolo: 'Testi', href: '#testi',
    ...(mancano.length ? { stato: 'da-fare', testo: `Mancano ${mancano.join(' e ')}.` } : { stato: 'fatto', testo: 'Titolo, globo e panoramica.' }),
  };

  const tracciati = avvisi.filter((a) => /tracciato/.test(a)).length;
  const passoTappe: Passo = {
    chiave: 'tappe', titolo: 'Tappe', href: '#tappe',
    ...(tappe.length === 0 ? { stato: 'da-fare', testo: 'Nessuna tappa: aggiungi la prima.' }
      : tappe.length === 1 ? { stato: 'da-fare', testo: 'Una tappa sola: un cammino ne ha almeno due.' }
      : tracciati ? { stato: 'da-controllare', testo: `${tappe.length} tappe; ${quante(tracciati, 'tracciato diventa', 'tracciati diventano')} una linea dritta.` }
      : { stato: 'fatto', testo: `${tappe.length} tappe, nell'ordine del viaggio.` }),
  };

  // immagini delle schede: facoltative, ma quelle scelte devono avere testo alternativo e crediti
  const immagini = db.prepare(`SELECT t.id, count(ti.immagine_id) AS n,
      sum(CASE WHEN i.id IS NOT NULL AND (trim(i.alt) = '' OR trim(coalesce(i.crediti, '')) = '') THEN 1 ELSE 0 END) AS incomplete
    FROM tappe t LEFT JOIN tappe_immagini ti ON ti.tappa_id = t.id LEFT JOIN immagini i ON i.id = ti.immagine_id
    WHERE t.cammino_id = ? GROUP BY t.id ORDER BY t.posizione`).all(id).map((r) => ({ id: Number(r.id), n: Number(r.n), incomplete: Number(r.incomplete ?? 0) }));
  const conImmagini = immagini.filter((t) => t.n > 0).length;
  const incomplete = immagini.reduce((s, t) => s + t.incomplete, 0);
  const primaIncompleta = immagini.find((t) => t.incomplete > 0);
  const passoImmagini: Passo = {
    chiave: 'immagini', titolo: 'Immagini', href: primaIncompleta ? `/cammini/${id}/tappe/${primaIncompleta.id}` : '#tappe',
    ...(incomplete ? { stato: 'da-controllare', testo: `A ${quante(incomplete, 'immagine mancano', 'immagini mancano')} testo alternativo o crediti.` }
      : conImmagini ? { stato: 'fatto', testo: `${conImmagini} ${conImmagini === 1 ? 'tappa' : 'tappe'} su ${tappe.length} con immagini.` }
      : { stato: 'facoltativo', testo: 'Nessuna tappa ha immagini: sono facoltative.' }),
  };

  const cartine = db.prepare(`SELECT k.id, k.pulsante, (SELECT count(*) FROM elementi e WHERE e.cartina_id = k.id) AS elementi
    FROM cartine k WHERE k.cammino_id = ? ORDER BY k.anno`).all(id).map((r) => ({ id: Number(r.id), pulsante: String(r.pulsante), elementi: Number(r.elementi) }));
  const vuota = cartine.find((k) => k.elementi === 0);
  const passoCartina: Passo = {
    chiave: 'cartina', titolo: 'Cartina storica', href: vuota ? `/cartine/${vuota.id}` : cartine.length ? '#cartine' : `/cammini/${id}/cartine/nuova`,
    ...(!cartine.length ? { stato: 'facoltativo', testo: 'Nessuna: nel portale c\'è solo «Oggi».' }
      : vuota ? { stato: 'da-fare', testo: `La cartina ${vuota.pulsante} non è ancora generata.` }
      : { stato: 'fatto', testo: `Epoca ${cartine.map((k) => k.pulsante).join(', ')}` }),
  };

  const pubblica: Passo = {
    chiave: 'pubblica', titolo: 'Pubblica', href: '/pubblicazione',
    ...(portale === 'assente' ? { stato: 'da-fare', testo: 'Non è ancora nel portale.' }
      : portale === 'da-aggiornare' ? { stato: 'da-fare', testo: 'Ci sono modifiche non ancora nel portale.' }
      : { stato: 'fatto', testo: 'Il portale è aggiornato.' }),
  };

  return [testi, passoTappe, passoImmagini, passoCartina, pubblica];
}
