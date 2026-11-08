// Identificativo leggibile per gli URL: 'Trentino-Alto Adige/Südtirol' → 'trentino-alto-adige'.
// Dei nomi bilingui si tiene la parte prima della barra.
export function slug(testo: string): string {
  return testo
    .split('/')[0]
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
