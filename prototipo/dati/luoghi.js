// Anagrafe dei luoghi, versione di prova per la georeferenziazione assistita (prototipo/allinea.html).
// Nel backoffice sarà una tabella; qui ci sono solo i luoghi scritti sulla cartina della Mezzaluna.
// Il blocco dopo «const LUOGHI =» è JSON (chiavi tra virgolette): lo legge anche strumenti/importa_cartina_ai.py.
// Ogni luogo: nome italiano, altri nomi (antichi, biblici, attuali, come possono comparire su una
// cartina), coordinate, tipo, certezza dell'identificazione e una nota.
// Certezza: "certa" (sito identificato, lo spillo tiene fermo il disegno), "probabile" (lo tira
// meno), "ipotetica" (lo tira poco). Coordinate dei siti archeologici o, per le vette, della cima.
const LUOGHI = [
  { "nome": "Carran", "altri": ["Harran", "Haran", "Charran"], "lat": 36.867, "lng": 39.033, "tipo": "citta", "certezza": "certa", "nota": "Harran, Turchia sud-orientale" },
  { "nome": "Damasco", "altri": [], "lat": 33.513, "lng": 36.292, "tipo": "citta", "certezza": "certa" },
  { "nome": "Palmira", "altri": ["Tadmor"], "lat": 34.551, "lng": 38.268, "tipo": "citta", "certezza": "certa" },
  { "nome": "Biblos", "altri": ["Byblos", "Gebal", "Jbeil"], "lat": 34.119, "lng": 35.648, "tipo": "citta", "certezza": "certa" },
  { "nome": "Sidone", "altri": ["Sidon", "Saida"], "lat": 33.563, "lng": 35.371, "tipo": "citta", "certezza": "certa" },
  { "nome": "Sichem", "altri": ["Shechem", "Tell Balata"], "lat": 32.214, "lng": 35.284, "tipo": "citta", "certezza": "certa", "nota": "Tell Balata, presso Nablus" },
  { "nome": "Betel", "altri": ["Bethel", "Beitin"], "lat": 31.928, "lng": 35.239, "tipo": "citta", "certezza": "probabile", "nota": "Di solito identificata con Beitin; altri propongono el-Bireh" },
  { "nome": "Gerusalemme", "altri": ["Jerusalem", "Urusalim"], "lat": 31.778, "lng": 35.235, "tipo": "citta", "certezza": "certa" },
  { "nome": "Mamre", "altri": ["Querce di Mamre", "Ramat el-Khalil"], "lat": 31.533, "lng": 35.1, "tipo": "citta", "certezza": "probabile", "nota": "Ramat el-Khalil, presso Hebron" },
  { "nome": "Bersabea", "altri": ["Beersheba", "Be'er Sheva"], "lat": 31.245, "lng": 34.841, "tipo": "citta", "certezza": "certa", "nota": "Tel Be'er Sheva" },
  { "nome": "Zoan", "altri": ["Tanis", "San el-Hagar"], "lat": 30.976, "lng": 31.88, "tipo": "citta", "certezza": "certa", "nota": "Tanis, delta orientale del Nilo" },
  { "nome": "Menfi", "altri": ["Memphis", "Mit Rahina"], "lat": 29.845, "lng": 31.255, "tipo": "citta", "certezza": "certa" },
  { "nome": "Mari", "altri": ["Tell Hariri"], "lat": 34.55, "lng": 40.889, "tipo": "citta", "certezza": "certa", "nota": "Tell Hariri, Siria" },
  { "nome": "Assur", "altri": ["Ashur", "Qal'at Sherqat"], "lat": 35.456, "lng": 43.262, "tipo": "citta", "certezza": "certa" },
  { "nome": "Ninive", "altri": ["Nineveh"], "lat": 36.359, "lng": 43.153, "tipo": "citta", "certezza": "certa" },
  { "nome": "Babilonia", "altri": ["Babylon", "Babel"], "lat": 32.536, "lng": 44.421, "tipo": "citta", "certezza": "certa" },
  { "nome": "Ur", "altri": ["Ur dei Caldei", "Tell el-Muqayyar"], "lat": 30.963, "lng": 46.103, "tipo": "citta", "certezza": "certa", "nota": "La città è certa; che sia la «Ur dei Caldei» della Genesi è discusso (c'è chi propone Urfa)" },
  { "nome": "Susa", "altri": ["Shush"], "lat": 32.19, "lng": 48.257, "tipo": "citta", "certezza": "certa" },
  { "nome": "Monte Ararat", "altri": ["Ararat", "M.te Ararat", "Ağrı Dağı"], "lat": 39.702, "lng": 44.298, "tipo": "vetta", "certezza": "certa", "nota": "La vetta di oggi; l'Ararat biblico è la regione di Urartu" },
  { "nome": "Monte Sinai", "altri": ["Sinai", "M.te Sinai", "Jebel Musa"], "lat": 28.539, "lng": 33.975, "tipo": "vetta", "certezza": "ipotetica", "nota": "Identificazione tradizionale con Jebel Musa" }
];
