// JSON rientrato, ma con le liste di numeri (coordinate, tracciati) su una riga sola: i file pubblicati
// restano leggibili e le differenze tra una pubblicazione e l'altra si vedono bene.
const numero = (x: unknown) => typeof x === 'number';

export function jsonLeggibile(dati: unknown, rientro = ''): string {
  if (Array.isArray(dati) && dati.length && dati.every((x) => numero(x) || (Array.isArray(x) && x.every(numero)))) {
    return JSON.stringify(dati);
  }
  const dentro = `${rientro}  `;
  if (dati && typeof dati === 'object' && !Array.isArray(dati)) {
    const voci = Object.entries(dati).filter(([, v]) => v !== undefined);
    if (!voci.length) return '{}';
    return `{\n${voci.map(([k, v]) => `${dentro}${JSON.stringify(k)}: ${jsonLeggibile(v, dentro)}`).join(',\n')}\n${rientro}}`;
  }
  if (Array.isArray(dati) && dati.length) return `[\n${dati.map((v) => dentro + jsonLeggibile(v, dentro)).join(',\n')}\n${rientro}]`;
  return JSON.stringify(dati);
}
