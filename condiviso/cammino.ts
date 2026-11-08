// Formato dei file in prototipo/cammini/: il contratto tra il backoffice, che li pubblica, e il portale
// (prototipo/cammino.html), che li legge. Un cammino è una cartella con:
//   cammino.json      il cammino (Cammino), con testi, tappe e tracciati
//   <epoca>.json      una cartina storica per ogni epoca (Cartina), per esempio 1700ac.json
//   immagini/         le immagini delle schede
// e cammini/indice.json elenca i cammini pubblicati (Indice).
// Coordinate sempre [longitudine, latitudine], in gradi.

export const VERSIONE_FORMATO = 1;

export type Coordinate = [number, number];

export interface Indice {
  versione: typeof VERSIONE_FORMATO;
  generatoIl?: string; // ISO 8601: quando il backoffice l'ha pubblicato
  // nell'ordine del portale; bozza: per ora il portale di prova mostra anche i cammini in bozza
  cammini: { id: string; titolo: string; sottotitolo: string | null; bozza?: true }[];
}

export interface Cammino {
  versione: typeof VERSIONE_FORMATO;
  generatoIl: string; // ISO 8601
  id: string; // nome della cartella e indirizzo: cammino.html?cammino=<id>
  titolo: string; // «Il cammino di Abramo», in testa al pannello
  nome: string; // «Cammino di Abramo», in legenda e nel titolo della finestra
  sottotitolo: string | null;
  // I primi due passi, prima delle tappe: il globo (che torna sempre su "Oggi") e la panoramica
  // del cammino (solo testo, tutte le tappe bianche).
  globo: { luogo: string | null; testo: string };
  panoramica: { testo: string };
  tappe: Tappa[]; // nell'ordine del viaggio
  frecce: Freccia[]; // punte di freccia sul cammino, nel verso del viaggio, uguali in ogni epoca
  // Nomi scritti a mano sulla carta: i mari in ogni epoca; fiumi e regioni solo in "Oggi" (nell'epoca
  // storica valgono quelli della cartina).
  etichette: Etichetta[];
  // Le epoche storiche, in ordine di anno. "Oggi" c'è sempre e non sta qui.
  epoche: Epoca[];
}

export interface Tappa {
  nome: string; // nel pannello e nella scheda
  breve: string; // accanto al pin
  coordinate: Coordinate;
  luogoAttuale: string | null; // «Tell el-Muqayyar, Iraq meridionale»
  riferimento: string | null; // «Gen 11,27-31»
  testo: string; // nel pannello
  approfondimento: string | null; // nella scheda; null: il testo del pannello
  immagine: { src: string; alt: string; crediti: string } | null; // src relativo alla cartella del cammino
  // Dalla tappa precedente a questa (null per la prima). null nelle altre: linea dritta.
  tracciato: Coordinate[] | null;
  secondaria?: true; // il nome accanto al pin compare solo da vicino (tappe fitte)
}

export interface Freccia {
  coordinate: Coordinate;
  rotazione: number; // gradi dal nord, in senso orario
}

export interface Etichetta {
  tipo: "mare" | "fiume" | "regione";
  testo: string;
  coordinate: Coordinate;
}

export interface Epoca {
  id: string; // «1700ac»: anche il nome del file della cartina
  pulsante: string; // «1700 a.C.»
  anno: number; // negativo prima di Cristo, per l'ordine
  cartina: string; // file della cartina, nella cartella del cammino
}

// La cartina di un'epoca: gli elementi disegnati (aree e linee) con il loro stile, i nomi e l'alone
// che scurisce il mondo intorno ai dati.
export interface Cartina {
  versione: typeof VERSIONE_FORMATO;
  id: string;
  fonte: string | null; // il file da cui è stata importata
  // Simbologia, nell'ordine di disegno (e della legenda). Valori a coppie [a zoom 3, a zoom 7].
  // Gli stili con "legenda" compaiono nella legenda dell'epoca, dopo il cammino.
  stili: Stile[];
  elementi: Raccolta<{ stile: string; nome: string | null; origine: "importato" | "disegnato" | "modificato" }>;
  // [tipo, nome, lng, lat, zoom di comparsa, { angolo, sotto }?]. Tipi: regno, regione-antica,
  // capitale-antica, citta-antica, regione, mare, fiume, isola, vetta. Regione, mare e vetta sono
  // geografia fisica: compaiono in ogni epoca.
  nomi: [string, string, number, number, number, { angolo?: number; sotto?: string }?][];
  alone: Raccolta<Record<string, never>>; // veli sovrapposti, ognuno con un buco più largo
}

export type Valore = number | [number, number];

export type Stile =
  | { id: string; tipo: "area"; nome: string; legenda?: string; riempimento: string; opacita: Valore; contorno: string | null; spessore: Valore }
  | { id: string; tipo: "linea"; nome: string; legenda?: string; colore: string; spessore: Valore; tratteggio: [number, number] | null }
  | { id: string; tipo: "punto"; nome: string; legenda?: string; colore: string }; // solo legenda (i simboli sono dei nomi)

export interface Raccolta<P> {
  type: "FeatureCollection";
  features: { type: "Feature"; properties: P; geometry: { type: string; coordinates: unknown } }[];
}
