# app_cammini — portale degli itinerari su mappa

Progetto di SEI / La Scuola / Il Capitello per un portale didattico di itinerari storici su mappa
(primo caso: il cammino di Abramo). Referente: Tommaso, coordinatore multimediale.
Lingua di lavoro: italiano, anche per testi dell'interfaccia, commenti nel codice e messaggi.

## Obiettivo

- Un portale con più itinerari. Ogni itinerario ha tappe (pin) con schede di approfondimento,
  tracciati tra le tappe, aree evidenziate e, quando serve, il confronto tra assetti politici.
- Esperienza: si parte dal globo, si vola sulla regione, si segue il percorso tappa per tappa.
- Navigazione: «Visualizza il cammino» e «Torna al globo» sotto la scheda («Visualizza» sempre attivo: dal globo porta alla
  regione, altrove riporta la carta sull'intero percorso senza cambiare tappa); sotto il titoletto
  «Tappe» le frecce «Precedente» (a sinistra) e «Successiva» (a destra), con il contatore in mezzo.
  Le tappe sono separate dalla scheda da una linea. Passi: globo, panoramica (breve descrizione del
  cammino, solo testo, tutte le tappe bianche), poi le tappe. «Visualizza il cammino» porta sempre
  alla panoramica; da lì «Successiva» va alla prima tappa (rossa, con il fumetto). L'epoca non cambia
  mai da sola passando da un passo all'altro (solo il globo torna su "Oggi"): la sceglie chi guarda.
- Accessibilità in una tendina laterale (linguetta sul bordo sinistro della mappa, si apre e si
  chiude, Esc la chiude): caratteri più piccoli/grandi, tutto maiuscolo e carattere ad alta
  leggibilità (Atkinson Hyperlegible). Tutti e tre valgono ovunque: pannello, legenda, scheda e anche
  nomi sulla carta, pin e fumetto della tappa (dal 2026-11-08 anche la dimensione: i caratteri della
  carta moltiplicano le misure per `--scala`, e a caratteri grandi compaiono meno nomi insieme finché
  non ci si avvicina). Le scelte restano nel browser di chi guarda.
- Niente «Stai guardando: …» sulla legenda e niente note in fondo al pannello (tolte il 2026-11-06):
  le fonti restano nel riquadro delle attribuzioni in basso a destra della mappa. La nota «tracciato
  indicativo» e quella sul satellite di oggi andranno ripensate (per esempio in una pagina «Fonti»).
- Scheda della tappa: il clic su un nodo porta alla tappa e apre una finestra modale con immagine
  facoltativa (`immagine: { src, alt, crediti }` nei dati della tappa) e testo obbligatorio
  (`approfondimento`, o in mancanza il testo del pannello). Il clic sull'immagine la apre a tutto
  schermo con lo zoom (rotella, pizzico, doppio clic, pulsanti −/+/Adatta, trascinamento).
  Per ora solo Ur ha un'immagine, di prova: ritaglio del satellite NASA (pubblico dominio), da
  sostituire con le immagini della redazione. Sta nell'archivio immagini del backoffice e si pubblica
  in WebP in `prototipo/cammini/abramo/immagini/`.
  Inquadratura del cammino (`inquadraCammino`): la più ravvicinata che contiene tutte le tappe con
  i tratti e tutte le aree della cartina storica, lasciando libero l'angolo della legenda; si adatta
  da sola alla dimensione dello schermo.
- **Dati del portale separati dalla pagina** (2026-11-08): `cammino.html` è una pagina sola per tutti
  i cammini e legge `prototipo/cammini/indice.json` e la cartella del cammino scelto
  (`cammino.html?cammino=abramo`; senza, il primo dell'indice): `cammino.json` (titoli, testi del globo
  e della panoramica, tappe con coordinate e tracciato, frecce, nomi scritti a mano, epoche) e una
  cartina per epoca (`1700ac.json`: stili, elementi, nomi, alone). Il formato è il contratto
  `condiviso/cammino.ts`. I livelli della cartina storica si generano dai suoi stili (riempimenti,
  contorni, alone, linee), la legenda dagli stili con una voce di legenda, i pulsanti delle epoche dalle
  epoche del cammino (in ordine di anno, poi «Oggi»). Questi file li scrive il backoffice: non si
  modificano a mano.
- **Backoffice** (prima versione costruita il 2026-11-08): `backoffice/`, workspace npm di questo
  repository, "gemello" di quello dell'Atlante d'arte (`C:\Users\Dringoli\ProgettiReda\atlante_arte`):
  SvelteKit 3 + Svelte 5, SQLite con `node:sqlite` (`backoffice/dati/cammini.db`, non versionato),
  migrazioni SQL numerate. Il nucleo (connessione e migrazioni, registro delle modifiche e degli errori,
  backup, archivio immagini con sharp e relative pagine, selettore di immagini, stile) è copiato
  dall'Atlante e adattato: i due progetti restano separati. Pagine: Cammini (testi, tappe con ordine
  ↑↓, cartine), tappa (luogo dall'anagrafe, testi, immagine dall'archivio, tracciato), Luoghi
  (anagrafe con ricerca e «dove è usato»), cartina (pulsante e anno, stili modificabili: colori,
  contorno, opacità e spessore a zoom 3 / 7, tratteggio, voce di legenda; conteggi; punti di
  controllo), Immagini, Pubblicazione («Aggiorna il portale»: scrive `prototipo/cammini/`, anche i
  cammini in bozza, segnati nell'indice; un tracciato che non parte dalla tappa precedente, per
  esempio dopo aver spostato le tappe, diventa una linea dritta e la pagina lo segnala; «Prepara la
  demo»: aggiorna il portale e copia in `pubblicazione/` il sito pronto da caricare con FileZilla su
  qualunque server web: `index.html` (la pagina, con il satellite accanto in `bmng/` e `noindex`),
  `dati/` con i soli file comuni usati, `cammini/`, `robots.txt`, `LEGGIMI.txt`; «Apri la cartella»), Backup,
  Registro. Abramo è stato caricato dal prototipo (`npm run carica-prototipo`) ed è in bozza; il giro
  database → portale dà file identici a prima. Il backup salva anche i file SVG delle cartine.
  Mancano: il disegno di aree e tracciati nel backoffice, lo spostamento dei singoli nomi, l'IA per i
  nomi non in anagrafe, il ripristino dal registro, la pubblicazione vera su un server.
  Schema logico (discusso il 2026-11-08 a partire da `er-cammino.docx` di Tommaso): cammini; tappe
  (del solo loro cammino, con ordine, nome breve per il pin, riferimento, luogo attuale, testi di
  pannello e scheda, immagine, `tracciato` GeoJSON dalla tappa precedente: vuoto = linea dritta);
  anagrafe dei luoghi (nome, nome antico, nome attuale, coordinate: usata da tappe, città delle
  cartine e punti di controllo; in futuro comune con l'Atlante); immagini come nell'Atlante.
  «Oggi» non sta nel database (satellite, confini e nomi attuali sono file comuni a tutti).
  Ogni epoca storica è una **cartina** che appartiene a **un solo cammino** (deciso: niente
  condivisione), e un cammino può averne **più d'una** (selettore «Oggi · 1700 a.C. · 1200 a.C.»,
  in ordine di anno). La cartina ha: stili (simbologia: colore, motivo, simbolo, ritaglio sulle
  terre, **testo di legenda facoltativo**: la legenda dell'epoca si genera dagli stili, dopo il
  cammino), elementi (aree e linee GeoJSON con il loro stile), nomi (testo, sottotitolo, categoria
  tipografica, posizione, inclinazione, zoom, «anche in Oggi»), il file sorgente e i punti di
  controllo. Elementi e nomi hanno un'origine (importato / disegnato / modificato): una nuova
  importazione sostituisce solo quelli importati.
  **La cartina si consegna solo in SVG** (deciso: nessun formato proprietario, niente .ai/PDF), con i
  testi come testi. Il disegno di aree e tracciati nel backoffice si farà in una seconda fase.
  **Importazione dell'SVG nel backoffice** (costruita il 2026-11-08; Cammini → «Nuova cartina» o la
  cartina → «Importa e classifica» e «Allinea»):
  1. *File*: il browser estrae il disegno (`src/lib/estrazione.ts`: forme campionate, colori, opacità
     compresa quella dei gruppi, testi con inizio e fine della riga; salta gli effetti ritagliati da un
     ritaglio non rettangolare, trova cornice e legenda) e lo manda al server con il file
     (`dati/cartine/<sha256>.svg`; colonne `svg`, `disegno`, `classificazione` di `cartine`).
  2. *Allinea* (`/cartine/[id]/allinea`, da `allinea.html`): spilli nel database (punti di controllo),
     proposti dai nomi dell'anagrafe se la cartina non ne ha; deformazione dal vivo
     (`src/lib/georeferenziazione.ts`, la stessa del server), scarti, pieghe, griglia, fiumi veri,
     «Salva gli spilli» e «Salva e genera». Satellite servito dal backoffice (`/api/satellite.pmtiles`).
  3. *Classifica* (`/cartine/[id]/importa`, con il disegno originale accanto): ogni colore → uno stile
     (o «nuovo stile»), il percorso del cammino o niente; i testi, già ricomposti in parole (lettere
     lungo le curve, pezzi di crenatura: `gruppiDiTesto`), → nome con categoria, riga successiva o
     sottotitolo del nome sopra, o niente, con il testo da scrivere nel portale. Proposte: dalle scelte
     della cartina attuale (una nuova versione del file si riclassifica da sola; regni e regioni si
     cercano tra le scritte in maiuscolo), altrimenti dall'anagrafe (capitali: il simbolo vicino ha un
     colore diverso da quello più comune), dal colore (acque), dalle maiuscole, dalle righe sotto.
  4. *Genera* (`src/lib/server/importazione-svg.ts`, geometria con jsts): forme intere, anche oltre la
     cornice (l'arco intero, come deciso); un'area di stile coprente (opacità ≥ 0,5) toglie la parte
     coperta alle aree disegnate prima, un velo no; ritaglio sulle terre emerse di Natural Earth per gli
     stili che lo chiedono (`stili.ritaglio`); città e vette dove sono i luoghi dell'anagrafe; nomi con
     l'inclinazione portata sulla carta e l'ordine dei nomi già importati; frecce dai triangoli del
     colore del percorso; tracciati delle tappe dalla rete delle linee del percorso (`percorso.ts`: pezzi
     ricollegati entro 60 km, strada più breve, più cara contromano rispetto alle frecce e sui tratti già
     fatti, raccordo esatto sulle tappe); alone. Sostituisce solo elementi e nomi «importati».
  Rigenerata così, la cartina di Abramo coincide con quella di Python: aree entro lo 0,2%, stili
  identici, tracciati entro 2-3 km, nomi entro 1-5 km (misure dei caratteri del browser). Due correzioni:
  la regione «Babilonia» va sulla sua scritta (Python la metteva sulla città, 113 km più in là).
  **Le cartine sono già disegnate** (2026-11-08): non si possono rifare su un fondo modello
  georeferenziato (resta una possibilità futura: `metodo` della cartina = punti di controllo o
  fondo modello). Quindi georeferenziazione assistita: il sistema (anche con l'IA) propone gli
  abbinamenti tra nomi della cartina e luoghi, il redattore li conferma e sposta a mano gli
  «spilli» sul globo vedendo il disegno trasparente sopra il satellite, con la deformazione
  ricalcolata dal vivo. Punti di controllo anche sulla geografia fisica (capi, foci, confluenze),
  più affidabili delle città antiche; ogni punto ha un peso secondo la certezza del luogo.
  **Prima prova: `prototipo/allinea.html`** (2026-11-08), **superata dal backoffice**: il suo pulsante
  non aggiorna più il portale (`strumenti/server.py` risponde 410 e rimanda al backoffice), perché il
  vecchio giro con l'importatore Python sovrascriverebbe spilli e cartina del database. Leggeva l'SVG nel browser (trasformazioni,
  classi e forme le risolve il browser), salta gli effetti grafici (elementi ritagliati da un ritaglio
  non rettangolare, come le copie schiarite dentro l'arco), trova la cornice (il fondo più grande) e la
  legenda (rettangolo bianco piccolo). Abbina i nomi ai luoghi di `dati/luoghi.js` (nome e altri nomi)
  e ai simboli (forme piccole, escluse le punte di freccia dello stesso colore della loro linea),
  valutando tutti gli abbinamenti insieme. Deformazione thin plate spline dal vivo trascinando gli
  spilli; un luogo probabile cede il 35% verso dove lo vorrebbe il disegno, uno ipotetico il 70%
  (`CEDE`). Scarto di ogni spillo = dove andrebbe il luogo togliendo lo spillo (media ~24 km sulla
  Mezzaluna, ~75 km ai bordi: Ur, Susa). Avviso di piega se due spilli si contraddicono. La bozza degli
  spilli resta nel browser; **«Aggiorna la cartina del portale»** (collegato il 2026-11-08) la salva in
  `cartine/mezzaluna_1700ac.punti.json` (POST `/api/allinea` di `strumenti/server.py`, accettato solo dal
  computer stesso), rilancia `importa_cartina_ai.py`, che usa la stessa deformazione (stesso spazio
  longitudine/Mercatore, stesso `CEDE`: verificato identico al metro) e scrive
  `strumenti/importazioni/abramo_1700ac.json`, poi `npm run importa-cartina -- abramo 1700ac --pubblica`
  la portava nel database del backoffice (comando ora tolto). La pagina
  dice se il portale usa gli spilli che si vedono o se ci sono modifiche, che si possono annullare
  («Torna agli spilli del portale»). Le città si scrivono dove sta il loro spillo (se manca, dove dice
  l'anagrafe; avviso se lo spillo è a più di 1 km dall'anagrafe); i tratti del cammino arrivano
  esattamente sulle tappe, riassorbendo lo scostamento nei ~30 km vicini (`raccorda`). Ora gli spilli
  sono le 20 proposte automatiche, ancora da confermare. Manca: l'IA per i nomi non in anagrafe e lo
  spostamento dei singoli nomi.

## Decisioni già prese

- **Tecnologia mappa: MapLibre GL JS** (open source, BSD), non Google Earth. Google Earth resta
  utile solo come strumento di lavoro interno o attività per gli studenti.
- **Satellite: NASA Blue Marble Next Generation, luglio**, 8 riquadri GeoTIFF a 500 m/pixel,
  dominio pubblico (attribuzione: "NASA Earth Observatory, Blue Marble Next Generation").
  Convertiti in `bmng/bmng.pmtiles` (mondo intero, zoom 0-7, WebP, ~118 MB) con
  `bmng/genera_tile_bmng.py`. Il file non va su GitHub (vedi `.gitignore`).
- **Zoom: minimo 0,5, massimo 8**: oltre l'8 il satellite non aggiunge dettaglio.
- **Confini e nomi attuali secondo il punto di vista ufficiale italiano** (Natural Earth,
  `ne_10m_admin_0_countries_ita`), a piena risoluzione; tratti contesi o provvisori puntinati,
  con nota esplicita nel portale. Preferenza della redazione: nomi e suddivisioni moderne.
- **Capitali**: Natural Earth segna Gerusalemme come capitale di Israele anche nel punto di vista
  italiano, il che non corrisponde alla posizione ufficiale italiana. L'elenco delle capitali va
  quindi validato dalla redazione: tabella nel backoffice, precompilata e corretta.
- **Epoche, una sola per vista**: pannello "1700 a.C. · Oggi" (il Confronta con il cursore a
  tendina è stato tolto il 2026-11-06: non serve). La regola vale per ogni itinerario e ogni scheda
  ed è scritta in un solo punto, la tabella `EPOCHE` di `cammino.html`:
  | Sempre, in ogni epoca | Solo "Oggi" | Solo nell'epoca storica ("allora") |
  |---|---|---|
  | satellite (di oggi, dichiarato), fiumi, geografia fisica in tondo (mari, rilievi, deserti; dalla cartina anche Mar Morto, Penisola del Sinai, M.te Ararat, M.te Sinai), cammino con le frecce e tappe | confini e nomi degli Stati attuali, capitali, grandi città, etichette scritte a mano di fiumi e regioni (`LABELS`: Eufrate, Tigri, Nilo, Giordano, Mesopotamia, Deserto siriano) | **la cartina del volume disegnata sopra il satellite, con tutti i suoi dettagli** (dal 2026-11-07): regni con i colori della cartina (pieni, più coprenti della stampa perché si vedano sul satellite) e il contorno grigio, Mari in giallo pieno; arco della Mezzaluna (velo bianco e contorno blu, intero, anche sul mare e nella parte che la stampa taglia); costa di allora; tutti i nomi della cartina (regni e popoli in maiuscolo, regioni in maiuscolo spaziato, sottotitoli «12ª dinastia…» e «Sotto Hammurabi…», nomi inclinati come nella cartina, fiumi al posto e con l'inclinazione della cartina, Cipro); capitali con il pallino rosso, città con quello bianco; alone: il mondo si scurisce gradualmente allontanandosi dai dati della cartina (16 veli leggeri, `ALONE` in `importa_cartina_ai.py`), senza riquadri |
  In "Oggi" nessuna area tematica (Mezzaluna fertile e Valle del Nilo tolte il 2026-11-07): sopra la
  carta di oggi c'è solo il cammino.
  Legenda: al primo posto, in entrambe le epoche, «Cammino di Abramo» con il simbolo della carta
  (tratteggio rosso su bordo bianco). Nell'epoca storica poi le voci della cartina del volume, senza
  interruttori: «Regno di Mari conquistato da Hammurabi nel 1700 a.C. circa», «Capitali» (la Mezzaluna fertile non è in legenda: deciso il 2026-11-08; uno stile «velo»
  con voce di legenda avrebbe in legenda un simbolo a velo, tinta leggera e bordo del suo colore). Sulla carta il nome «Mezzaluna fertile» (regione antica,
  aggiunto nel backoffice come nome «disegnato», quindi resta rigenerando) sta dentro l'arco nel deserto
  siriano (40° E, 32,9° N), dove il bordo interno è quasi orizzontale e non ci sono altri nomi. In "Oggi"
  poi l'interruttore "Cartina muta", che toglie tutti i nomi dalla carta, anche quelli delle tappe
  (restano i numeri), e vale solo in "Oggi". Niente altre voci.
  Niente di moderno nell'epoca storica, niente di antico in "Oggi". Per un itinerario con un'altra
  epoca (per esempio 1500 a.C.) cambiano solo il pulsante, il titolo e i dati dei regni.
  - **Solo caratteri a bastoni, nessun graziato**: pannello con titoli in Josefin Sans e testo in
    Mulish (scelti il 2026-11-06 tra sette coppie provate); nomi sulla carta in Alegreya Sans.
  - **Pannello "Notte"**: blu profondo (#10213a) come il cielo intorno al globo, intestazione
    sfumata, accento corallo (#ff6b57) per i pulsanti, giallo (#ffd166) per occhielli e titoletti.
    Uguale con il tema chiaro o scuro del sistema.
  - *1700 a.C.*: solo regni antichi, nomi in *corsivo*. **Il corsivo è riservato ai nomi antichi**:
    la geografia fisica (mari, fiumi, rilievi, deserti) è in tondo colorato, azzurro per le acque e
    beige per rilievi e regioni, e vale in ogni epoca.
  - *Oggi*: solo Stati attuali, nomi in MAIUSCOLO spaziato (Alegreya Sans). Confini come negli
    atlanti: fascia color prugna semitrasparente (#6f4a68) con filo bianco sopra, a puntini se contesi;
    nessun'altra linea ha la fascia (fiumi azzurri semplici, percorso rosso).
  - Il satellite è sempre quello di oggi (dichiararlo).
- **Regni storici come poligoni, non come immagini**: le cartine del volume si georeferenziano e se
  ne estraggono le aree colorate (`strumenti/estrai_regni_da_cartina.py`). Stesso colore per lo
  stesso Stato in ogni epoca (quando c'è la cartina del volume, i suoi colori); territori passati di
  mano tratteggiati, salvo che la cartina li disegni altrimenti (Mari: giallo pieno); vassalli = colore del
  dominante più chiaro; zone contese = tratteggio; sfere di influenza = solo contorno.
  Meglio ancora: chiedere al cartografo i file sorgente vettoriali a livelli.
- **Ordine dei livelli**: satellite → riempimenti degli Stati → confini → aree tematiche
  (solo contorno se ci sono i regni) → percorso → frecce → pin → etichette. Il cammino ha il
  tracciato e le tre punte di freccia della cartina del volume, uguale in ogni epoca: rosso (#c42a40)
  su bordo bianco (#fffaf0), tratteggiato dove non è ancora stato percorso; il rosso del cammino non si
  usa per gli Stati.
- **Fiumi**: tutti i tratti di Natural Earth 10m, compaiono per importanza con lo zoom e
  svaniscono verso lo zoom 7, dove il satellite li mostra da sé (Natural Earth è in scala
  1:10 milioni e da vicino non combacia).

## Struttura

```
app_cammini/
├── package.json              workspace npm (backoffice) e comandi
├── pubblicazione/            demo pronta per FileZilla (npm run prepara-demo; non versionata, ~120 MB)
├── condiviso/cammino.ts      contratto dei file pubblicati: Indice, Cammino, Cartina (backoffice → portale)
├── backoffice/               SvelteKit 3 + Svelte 5 + node:sqlite (vedi «Backoffice» sopra)
│   ├── db/                   connessione, migrazioni (migrazioni/001_schema_iniziale.sql), comandi
│   │                         carica-prototipo e pubblica; prove in db.test.ts e src/lib/server/importazione.test.ts
│   ├── src/lib/              disegno.ts (disegno estratto, classificazione, gruppi di testo), estrazione.ts
│   │                         (lettura dell'SVG nel browser), georeferenziazione.ts (thin plate spline)
│   ├── src/lib/server/       cammini, luoghi, cartine, importazione-svg (classificazione e generazione),
│   │                         geometria (jsts, terre emerse), percorso, pubblicazione, immagini, registro, backup
│   ├── src/routes/           cammini, cammini/[id]/tappe/[tappa], cammini/[id]/cartine/nuova, luoghi,
│   │                         cartine/[id] (+ importa, allinea), immagini, pubblicazione, backup, registro,
│   │                         api (immagini, satellite.pmtiles, fiumi.geojson, cartine/[id]/svg)
│   └── dati/                 cammini.db, archivio immagini, cartine/ (i file SVG) (locale, non versionato)
├── prototipo/
│   ├── cammino.html          il portale: una pagina per tutti i cammini (sorgente leggibile, librerie da CDN)
│   ├── cammini/              SCRITTO DAL BACKOFFICE: indice.json e una cartella per cammino
│   │   └── abramo/           cammino.json, 1700ac.json (la cartina), immagini/ (WebP)
│   ├── allinea.html          prima prova della georeferenziazione assistita (superata dal backoffice)
│   ├── cartine/mezzaluna_1700ac.svg  la cartina del volume in SVG (da cartina_in_svg.py, per le prove)
│   ├── cartine/mezzaluna_1700ac.punti.json  gli spilli con cui è generata la cartina del portale (da allinea.html)
│   └── dati/                 dati comuni a tutti i cammini («Oggi»)
│       ├── base.js           GEO: vecchie aree tematiche (non più caricato dalla pagina)
│       ├── confini.geojson   confini mondiali, punto di vista italiano (c: 0 normale, 1 conteso)
│       ├── fiumi.geojson     fiumi mondiali (s: importanza, da: zoom di comparsa)
│       ├── luoghi.js         LUOGHI: anagrafe di prova (nome, altri nomi, coordinate, certezza, nota),
│       │                     in JSON dopo «const LUOGHI =», così la legge anche Python
│       ├── mondo.js          MONDO: ~900 nomi italiani (Stati, capitali, grandi città, oceani, mari,
│       │                     continenti, grandi rilievi e deserti, vette note), con zoom di comparsa
│       └── regni_1700ac.geojson  vecchi regni estratti da Mezzal.psd (non più usati)
├── bmng/
│   ├── genera_tile_bmng.py   GeoTIFF/JPEG NASA → tile WebP → bmng.pmtiles
│   ├── bmng.pmtiles          (locale, non versionato)
│   ├── anteprima.html, server_anteprima.py, LEGGIMI.md
│   └── cammino.html          vecchia copia autonoma (librerie incorporate), sostituita da prototipo/
├── strumenti/
│   ├── server.py             server locale con richieste Range (necessario per .pmtiles); chiede al
│   │                         browser di ricontrollare pagina e dati a ogni caricamento (no-cache);
│   │                         lascia leggere i file al backoffice; non riceve più gli spilli di allinea.html
│   ├── prepara_confini_fiumi.py  rigenera confini.geojson e fiumi.geojson
│   ├── prepara_etichette_mondo.py rigenera mondo.js e capitali_da_validare.csv (scelte e correzioni nel codice)
│   ├── capitali_da_validare.csv  capitali per la redazione, con esito e nota (Excel, separatore ;)
│   ├── cartina_in_svg.py     .ai → SVG, solo per le prove (il cartografo consegnerà l'SVG)
│   ├── importa_cartina_ai.py SUPERATO dal backoffice: cartina vettoriale .ai → importazioni/abramo_1700ac.json
│   │                         (georeferenziazione con gli spilli di allinea.html, ritaglio sulle terre emerse,
│   │                         stili, elementi, nomi, alone, tracciati delle tappe, frecce)
│   ├── importazioni/         risultato del vecchio importatore, non più letto (non versionato)
│   ├── estrai_regni_da_cartina.py  cartina raster (PSD) → poligoni dai colori (superato)
│   └── mezzal_punti_controllo.json  punti di controllo usati per Mezzal.psd
├── Mezzal.psd                cartina del volume (Mezzaluna fertile, 1700 a.C.), raster
├── Mezzal-e-perc-Abramo_mod.ai  la stessa cartina in vettoriale (Illustrator CS5.1, PDF compatibile):
│                             aree, percorso, arco della Mezzaluna, pallini e testi come oggetti
└── quadranti mondo NASA Blue Marble Next Generation/   8 GeoTIFF (locale, non versionato)
```

## Comandi

```powershell
py -m pip install pillow numpy pmtiles shapely scipy scikit-image psd-tools
py strumenti\server.py                 # poi http://localhost:8000/prototipo/cammino.html
py strumenti\prepara_confini_fiumi.py  # rigenera confini e fiumi
py strumenti\prepara_etichette_mondo.py # rigenera i nomi di tutto il mondo e l'elenco delle capitali
npm install                             # una volta: librerie del backoffice (serve Node 24)
npm run backoffice                      # backoffice su http://localhost:5175
npm run carica-prototipo                # una volta sola, a database vuoto: carica Abramo, luoghi e spilli
npm run pubblica                        # aggiorna prototipo/cammini/ (come il pulsante «Aggiorna il portale»)
npm run prepara-demo                    # demo da caricare con FileZilla in pubblicazione/ (come «Prepara la demo»)
npm test                                # prove del database e della pubblicazione
npm run check                           # controllo dei tipi
```

Aprendo `cammino.html` con doppio clic il satellite non si carica (il browser non legge .pmtiles
da file://): usare sempre il server.

## Prototipi pubblicati (claude.ai)

- Carta disegnata: https://claude.ai/artifact/KqA138h6bWEzpu3pyLhpJ1
- Satellite regionale: https://claude.ai/artifact/3z33CqMgNGcEGdb2DiTgWP
- Regni, epoche e confronto: https://claude.ai/artifact/Wn8zqqmh3Q4iTs7FVDXL1W

## Questioni aperte

- Regni del 1700 a.C.: **dalla cartina vettoriale** `Mezzal-e-perc-Abramo_mod.ai`. La cartina si discosta dal vero in media ~35 km (è il disegno); con la
  thin plate spline le città coincidono esattamente e lo scarto resta tra una città e l'altra.
  Nel file: l'Assiria non è un'area a sé ma la parte nord dell'Impero babilonese; Egitto e Canaan
  sono un unico tracciato (chiedere alla redazione il significato); non c'è una versione "prima"
  del regno di Mari. La Mezzaluna fertile ora è l'arco del volume (prima era disegnata a mano).
  Nomi della cartina (gruppo "cartina:<epoca>") nel sistema `disponiMondo`, solo in "1700 a.C.", tranne la
  geografia fisica; quelli inclinati restano al loro posto e si scontrano con gli altri come rettangoli
  ruotati. Nella panoramica alcuni nomi fitti (Canaan, Gerusalemme, Assur, Mar Morto) compaiono
  solo avvicinandosi; Zoan non compare perché c'è il pin «Egitto». Gerusalemme sta 17 km a sud di Betel: nella
  panoramica (zoom 5 circa) sono 8 pixel e il suo pallino finisce sotto il segnaposto della tappa;
  compare da zoom 6,5 circa. Segnaposto più piccoli da lontano non basterebbero (da 26 a 18 pixel:
  compare da 6,3), quindi non si sono cambiati (2026-11-08). Un pin il cui nome è nascosto (tappe
  secondarie da lontano, cartina muta) occupa ora solo il cerchio. La linea a
  puntini vicino a Ur è letta come costa del Golfo Persico allora: da confermare. Il cammino segue
  ora il percorso del volume (Carran → Palmira → Damasco → Canaan; in Egitto la tappa è Zoan).

- Dalla cartina Mezzal.psd: il "prima" della conquista di Mari è ricostruito solo dalla legenda;
  serve la cartina "prima" dalla redazione. Canaan ha lo stesso verde dell'Egitto: chiarire il
  significato. Datazione: il volume dice "1700 a.C. circa", molte opere ~1760 a.C.
- Diritti: Natural Earth e NASA sono di pubblico dominio. Per carte antiche scansionate le
  condizioni variano (Library of Congress di solito libera; David Rumsey CC BY-NC-SA; Gallica a
  pagamento per uso commerciale; biblioteche statali italiane con canoni).
- Etichette: i nomi di tutto il mondo stanno in un livello HTML proprio (`livello-nomi`); la pagina
  (`disponiMondo`) li crea quando servono, li mostra per zoom e importanza, prova posizioni
  alternative ed evita le sovrapposizioni con pin ed etichette. Stati, capitali e città solo in
  "Oggi"; la geografia fisica in ogni epoca. Il globo
  iniziale è in epoca "Oggi" ma senza nomi: compaiono da zoom 1,8 (`ZOOM_NOMI`). Densità scelta
  dalla redazione: capitali e grandi città (limiti `LIMITE_*` nello script, spazio `ARIA_X/Y`
  nella pagina). Ogni Stato ha il nome da zoom 1,8 (`ZOOM_STATI`; i microstati sotto 3.000 km²
  più da vicino) e, se manca spazio, lo prova più piccolo o spostato; le capitali compaiono tutte da
  zoom 2,6 (`ZOOM_CAPITALI`) e il loro quadratino si fissa per primo. Pannello, legenda e
  pulsanti contano come spazio occupato. Restano fuori da questo sistema le etichette scritte a
  mano nella pagina (`LABELS`: Deserto siriano, Mesopotamia, Eufrate…), che possono coprire i pin.
  Per il portale passare ai livelli "symbol" di
  MapLibre con glifi dei font ospitati in proprio. Gerusalemme non ha il simbolo di capitale
  (vedi `capitali_da_validare.csv`, 21 casi con una scelta o una nota).
- Pubblicazione: `bmng.pmtiles` (118 MB) va ospitato su un server o storage aziendale che risponda alle
  richieste «Range» (i server web comuni lo fanno). La demo (2026-11-08) si carica via FTP così com'è.
  Per la pubblicazione vera: caratteri e librerie ospitati in proprio (oggi Google Fonts e unpkg: i
  caratteri di Google trasmettono l'IP dei visitatori), pagina «Fonti», solo i cammini pubblicati.
- Funzioni proposte: confronto di scala con l'Italia, domande di osservazione per tappa,
  audio delle schede (pipeline ElevenLabs già esistente), modalità LIM, link diretti alle tappe.
