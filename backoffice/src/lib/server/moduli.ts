// Lettura dei campi dei moduli: testi ripuliti, campi facoltativi, numeri.

export const testo = (modulo: FormData, nome: string) => String(modulo.get(nome) ?? '').trim();

// Un campo facoltativo vuoto diventa null.
export const facoltativo = (modulo: FormData, nome: string) => testo(modulo, nome) || null;

// Numero con la virgola o con il punto; null se il campo è vuoto o non è un numero.
export function numero(modulo: FormData, nome: string): number | null {
  const valore = testo(modulo, nome).replace(',', '.');
  if (!valore) return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
}

export const intero = (modulo: FormData, nome: string) => {
  const n = numero(modulo, nome);
  return n !== null && Number.isInteger(n) ? n : null;
};

// I valori di tutti i campi, così come sono stati scritti: si ripropongono dopo un errore.
export const valoriDi = <K extends string>(modulo: FormData, campi: readonly K[]) =>
  Object.fromEntries(campi.map((c) => [c, testo(modulo, c)])) as Record<K, string>;

export const adesso = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
