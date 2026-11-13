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
- Accessibilità **come nell'Atlante d'arte** (dal 2026-11-13): fascia in fondo al sito, sotto pannello e mappa,
  con il pulsante «Accessibilità» (simbolo della persona nel cerchio) che apre una finestra con le preferenze, nei
  colori del pannello: grandezza dei caratteri (Normale, Grande, Più grande, Molto grande = `--scala` 1, 1,15,
  1,3, 1,5; ogni livello scritto nella sua grandezza), «Tutto maiuscolo» e «Carattere ad alta leggibilità»
  (Atkinson Hyperlegible) come interruttori, «Ripristina» e «Fatto». Valgono subito. Accanto, «Aiuto» (punto di
  domanda nel cerchio) apre la guida «Come si segue il cammino»: segui il racconto, apri la scheda di una tappa,
  allora e oggi, muoviti sulla carta (anche la legenda), leggi meglio; «Ho capito». Testi della guida scritti da
  noi: da far rivedere alla redazione. Niente marchio a destra (nell'Atlante c'è quello SEI; qui da decidere). Prima (dal 2026-11-14) i comandi stavano tutti nella barra, e ancora prima in una
  tendina sul bordo sinistro della mappa; il livello «più piccolo» (0,9) è stato tolto. Tutti e tre valgono ovunque: pannello, legenda, scheda e anche
  nomi sulla carta, pin e fumetto della tappa (dal 2026-11-08 anche la dimensione: i caratteri della
  carta moltiplicano le misure per `--scala`, e a caratteri grandi compaiono meno nomi insieme finché
  non ci si avvicina). Le scelte restano nel browser di chi guarda.
- Niente «Stai guardando: …» sulla legenda e niente note in fondo al pannello (tolte il 2026-11-06):
  le fonti restano nel riquadro delle attribuzioni in basso a destra della mappa. La nota «tracciato
  indicativo» e quella sul satellite di oggi andranno ripensate (per esempio in una pagina «Fonti»).
- Scheda della tappa: il clic su un nodo porta alla tappa e apre una finestra modale. **Dal 2026-11-13 ha la
  forma della «Scopri» dell'Atlante d'arte, con i colori del pannello (blu notte, occhiello giallo)**: finestra
  larga (fino a 1180 × 740 px), in alto occhiello «Tappa N di M», titolo e luogo · riferimento a tutta
  larghezza (con la sfumatura dell'intestazione del pannello), sotto due colonne: a sinistra la galleria
  (un'immagine alla volta, intera, frecce ‹ › se sono più d'una), a destra il testo obbligatorio
  (`approfondimento`, o in mancanza il testo del pannello), che scorre nella sua colonna, e sotto una linea
  contatore «1 / 3», didascalia e crediti dell'immagine e le miniature. Tasti ← → sfogliano le immagini.
  Senza immagini: finestra stretta (660 px) con il solo testo. Sotto 860 px di larghezza (o 560 di altezza):
  tutto schermo, galleria sopra il testo, la finestra scorre. I testi sono in em su 16 px × `--scala`
  (niente `zoom`: la finestra uscirebbe dallo schermo); la colonna del testo non supera il 48%.
  Dati: `immagini: [{ src, miniatura, alt, didascalia, crediti }]` nella tappa (vuoto: solo testo).
  Il clic sull'immagine la apre a tutto schermo con lo zoom (rotella, pizzico, doppio clic, pulsanti
  −/+/Adatta, trascinamento) e le frecce per le altre immagini; in alto numero, didascalia e crediti.
  Per ora solo Ur ha un'immagine, di prova: ritaglio del satellite NASA (pubblico dominio), da
  sostituire con le immagini della redazione. Sta nell'archivio immagini del backoffice (didascalia «La
  bassa Mesopotamia intorno a Ur vista dal satellite», crediti NASA) e si pubblica in WebP in
  `prototipo/cammini/abramo/immagini/`: `<sha>.webp` fino a 2400 px e `<sha>-mini.webp` a 400 px.
  Inquadratura del cammino (`inquadraCammino`): la più ravvicinata che contiene tutte le tappe con
  i tratti e tutte le aree della cartina storica, lasciando libero l'angolo della legenda; si adatta
  da sola alla dimensione dello schermo.
  **La legenda non copre mai le tappe** (2026-11-14): anche l'inquadratura di ogni tappa lascia libero il suo
  angolo (`cameraLiberaDallaLegenda`); se, spostando la carta a mano, la legenda coprirebbe un segnaposto, quando
  la carta si ferma passa in un angolo libero (in alto a destra, poi in basso a sinistra: `sistemaLegenda`).
  Dal 2026-11-13 conta anche il fumetto della tappa: quando compare, se la legenda lo coprirebbe cambia angolo.
  **Legenda mobile** (2026-11-13): chi guarda la trascina dove vuole, per la maniglia a puntini in alto o per il
  fondo (non dai pulsanti), con il mouse o con un dito, restando dentro la carta; con la tastiera, frecce sulla
  maniglia (Maiuscolo: passi lunghi). Spostata a mano non cambia più angolo da sola e le inquadrature delle tappe
  le girano intorno (sotto, accanto, sopra o a sinistra della legenda); doppio clic sulla maniglia, Invio o Esc la
  rimettono nel suo angolo. La posizione vale finché si resta sulla pagina (non si salva).
  **Fumetto della tappa** (2026-11-13, struttura fissa): il nome della tappa e sotto «Oggi» con il luogo attuale
  (`luogoAttuale`, «Dove si trova oggi» nel backoffice: nome attuale e Stato, «Tell el-Muqayyar, Iraq
  meridionale» → «Oggi Tell el-Muqayyar, Iraq meridionale»); senza luogo attuale, solo il nome (`apriFumetto`).
  Abramo nel formato dal 2026-11-13: Sichem «Tell Balata (Nablus), Cisgiordania», Egitto «Mit Rahina (Menfi),
  presso il Cairo, Egitto»; Mòria resta «Gerusalemme, secondo la tradizione», senza Stato (da decidere con la
  redazione, come le capitali).
- **Dati del portale separati dalla pagina** (2026-11-08): `cammino.html` è una pagina sola per tutti
  i cammini e legge `prototipo/cammini/indice.json` e la cartella del cammino scelto
  (`cammino.html?cammino=abramo`; senza, il primo dell'indice): `cammino.json` (titoli, testi del globo
  e della panoramica, tappe con coordinate e tracciato, ritorno dopo l'ultima tappa, frecce, nomi scritti a
  mano, epoche) e una cartina per epoca (`1800ac.json`: stili, elementi, nomi, alone). Il formato è il contratto
  `condiviso/cammino.ts`. I livelli della cartina storica si generano dai suoi stili (riempimenti,
  contorni, alone, linee), la legenda dagli stili con una voce di legenda, i pulsanti delle epoche dalle
  epoche del cammino (in ordine di anno, poi «Oggi»). Questi file li scrive il backoffice: non si
  modificano a mano.
- **Backoffice** (prima versione costruita il 2026-11-08): `backoffice/`, workspace npm di questo
  repository, "gemello" di quello dell'Atlante d'arte (`C:\Users\Dringoli\ProgettiReda\atlante_arte`):
  SvelteKit 3 + Svelte 5, SQLite con `node:sqlite` (`backoffice/dati/cammini.db`, non versionato),
  migrazioni SQL numerate. Il nucleo (connessione e migrazioni, registro delle modifiche e degli errori,
  backup, archivio immagini con sharp e relative pagine, selettore di immagini, stile) è copiato
  dall'Atlante e adattato: i due progetti restano separati. Attenzione: i due backoffice usano spesso la stessa porta
  (5173) e gli stessi indirizzi; le anteprime delle immagini restano un anno nella cache del browser, quindi dal
  2026-11-13 il loro indirizzo porta l'impronta del file (`/api/immagini/<id>/<larghezza>?v=<sha256>`, `urlAnteprima`):
  prima, al posto delle immagini 1 e 2 dei cammini comparivano quelle dell'Atlante. Pagine: Cammini (testi, tappe con ordine
  ↑↓, cartine), tappa (luogo dall'anagrafe, testi, «Nome breve in Oggi», galleria di immagini dall'archivio
  con ordine ← → o trascinamento, al massimo 12, tracciato), Luoghi
  (anagrafe con ricerca e «dove è usato»; dal 2026-11-12 la scheda ha una mappa sul satellite con la posizione
  dell'anagrafe, che si trascina o si sceglie con un clic, e gli spilli delle cartine legati al luogo, con la
  distanza e il collegamento ad Allinea: `src/lib/components/MappaLuogo.svelte`), cartina (pulsante e anno, stili modificabili: colori,
  contorno, opacità e spessore a zoom 3 / 7, tratteggio, voce di legenda; conteggi; punti di
  controllo), Immagini, Pubblicazione («Aggiorna il portale»: scrive `prototipo/cammini/`, anche i
  cammini in bozza, segnati nell'indice; un tracciato che non parte dalla tappa precedente, per
  esempio dopo aver spostato le tappe, diventa una linea dritta e la pagina lo segnala; «Prepara la
  demo»: aggiorna il portale e copia in `pubblicazione/` il sito pronto da caricare con FileZilla su
  qualunque server web: `index.html` (la pagina, con il satellite accanto in `bmng/` e `noindex`),
  `dati/` con i soli file comuni usati, `cammini/`, `robots.txt`, `LEGGIMI.txt`; «Apri la cartella»), Backup,
  Registro. Abramo è stato caricato dal prototipo (`npm run carica-prototipo`) ed è in bozza; dal
  2026-11-12 ha la carta nuova (vedi «Nuova carta di Abramo»). Il backup salva anche i file SVG delle cartine.
  Dal 2026-11-12: nella pagina del cammino «Dopo l'ultima tappa: il cammino finisce / torna alla tappa N»
  (`cammini.ritorno_tappa_id`, tracciato in `ritorno_tracciato` dalla generazione; nel portale il ritorno
  compare percorso all'ultima tappa); nella classificazione, per regioni, mari e vette, la casella «anche in
  Oggi» (tolta = nome antico, solo nell'epoca storica: `nomi.anche_oggi = 0`, `{ oggi: false }` nel file).
  **Ritocca la cartina** (2026-11-13, `/cartine/[id]/ritocca`, pulsante «Ritocca» nella pagina della cartina;
  `src/lib/server/ritocchi.ts`): la carta generata sul satellite con aree, linee e cammino; i nomi della cartina e
  le tappe si trascinano. Clic su un nome: scheda sopra la carta (testo, sottotitolo, corpo, inclinazione, zoom di
  comparsa con «Da qui», colore, sempre visibile; «Com'è nel disegno» per i ritoccati, «Elimina» per gli aggiunti,
  «Sposta qui il luogo dell'anagrafe» per città e vette); i nomi più chiari a quello zoom nel portale non compaiono
  ancora; «Aggiorna il portale». Le aree non cambiano: dipendono solo dagli spilli. Un nome importato spostato o
  modificato diventa «modificato» e la generazione non lo ricrea: lo riconosce dalla scritta del disegno
  (`nomi.chiave`, migrazione 005, es. «MARI@592,312») o da categoria e testo; dalla chiave ricostruisce anche
  l'ordine dei nomi (la priorità quando si contendono lo spazio). «Com'è nel disegno» rimette il nome «importato» e
  rigenera. Spostare una tappa sposta il suo luogo nell'anagrafe (gli spilli no: hanno coordinate proprie) e
  rigenera, così i tratti si riagganciano; si sposta tutto ciò che usa quel luogo (la tappa Egitto usa Menfi: si
  sposta anche la città Menfi della cartina), e la conferma lo elenca. Prova in `db/db.test.ts`.
  **Nomi delle tappe in «Oggi»** (2026-11-14): accanto ai pin, in «Oggi», il nome moderno del luogo
  (`tappe.breve_oggi`, migrazione 006; «Nome breve in Oggi» nella scheda della tappa; `breveOggi` nel file; vuoto:
  il nome breve di sempre). Abramo, dalla cartina attuale della redazione: Tell el-Muqayyar, Harran, Nablus, Negev,
  Hebron, Be'er Sheva; «tra Betel e Ai», «Egitto» e «Mòria» restano come sono (la cartina non dà un nome moderno).
  Mancano: il disegno di aree e tracciati nel backoffice, l'aggiunta di nomi nuovi e lo spostamento delle frecce
  nella pagina «Ritocca», l'IA per i nomi non in anagrafe, il ripristino dal registro, la pubblicazione vera su un
  server.
  Schema logico (discusso il 2026-11-08 a partire da `er-cammino.docx` di Tommaso): cammini; tappe
  (del solo loro cammino, con ordine, nome breve per il pin, riferimento, luogo attuale, testi di
  pannello e scheda, galleria di immagini in `tappe_immagini` con la posizione (migrazione 007, 2026-11-13:
  prima una sola immagine in `tappe.immagine_id`), `tracciato` GeoJSON dalla tappa precedente: vuoto = linea dritta);
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
     Dal 2026-11-12 legge anche gli SVG «da disegno» (non da Illustrator): sfumature = colore medio delle
     fermate; il foglio bianco sotto tutto non è la cornice; fuori dalla cornice (titolo, legenda, note sotto
     la carta) non si importa niente; cerchi ed ellissi distinti per geometria (prima quelli scritti uguali
     si perdevano); soglia dei simboli in proporzione alla cornice (`sogliaSimboli`, flag `simbolo` della
     forma); punte di freccia `marker-end` ricostruite come triangoli; testi lungo una curva (`textPath`) con
     l'inclinazione della curva. Le frecce sono i simboli a triangolo (`eFreccia`), non i pallini dello
     stesso colore. Verificato: la vecchia cartina del volume si legge identica a prima.
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
     Tutte le frecce danno il verso al percorso, ma sulla carta restano solo quelle a più di 30 km dalle
     tappe (`FRECCE_LONTANE_KM`: le punte alla fine di ogni tratto starebbero sotto i segnaposto). Dalle aree
     ritagliate si tengono solo le parti poligonali (`soloPoligoni`).
  **Nuova carta di Abramo** (2026-11-12, al posto della cartina 1700 a.C. del volume, eliminata con i suoi
  stili, nomi, spilli e file): istruzioni della redazione «aree colorate e luoghi dallo screenshot approvato,
  percorso dall'SVG». Fonte `Abramo_antica_livelli_09 (1).svg` (ricostruzione vettoriale dal PNG approvato,
  «riferimenti politici senza delimitazioni territoriali», nomi politici intorno al 1800 a.C.); nel
  backoffice `Abramo_antica_livelli_09b.svg`: il percorso della 09, tutto il resto come nella PNG approvata
  `Il cammino di Abramo_ mappa antica (1).png` (l'unica PNG di riferimento; il riquadro della carta grande
  coincide al pixel con quello dell'SVG). Ricontrollato il 2026-11-12 sovrapponendo alla PNG i dati
  pubblicati riportati sul foglio: l'SVG 09 differiva dalla PNG nella fascia della Mezzaluna (più larga a nord
  e fino al golfo), negli ovali (in Egitto quello della PNG è grande, sotto Menfi), nelle scritte MEZZALUNA
  FERTILE e MESOPOTAMIA (spostate di 80-90 px) e nel pallino di Larsa (22 px). Nella 09b: fascia, Canaan e
  ovale dell'Egitto ricalcati dalla PNG; ovale del Negheb a sud di Bersabea come nel riquadro «Ingrandimento
  delle tappe» della PNG (quello della carta grande, dove Canaan è «a scala diversa» e il Mare Salato sta
  persino a ovest delle tappe, deformato cadrebbe in Giordania); scritte e Larsa dove sono nella PNG.
  Dal 2026-11-13, su richiesta della redazione: l'ovale dell'Egitto ha la forma e la grandezza di quello del
  Negheb (la stessa ellisse sul globo, semiassi 0,5° × 0,27°, intorno a Menfi); Canaan #f7c948 più coprente;
  ovali arancio #f59f3a con il contorno tratteggiato #c2410c (non più viola); Mezzaluna #57f031 scelta dalla
  redazione nel backoffice. I nomi della cartina storica nel portale hanno la classe `antico`: più grandi
  (regni 20 px, regioni antiche 17, fiumi e mari 17, città 15). Nell'epoca storica hanno il colore della
  scritta nella carta (campionato dalla PNG e messo nella 09b: `nomi.colore`, dal disegno a ogni
  generazione; fiumi e mari disegnati a mano #0b2ee6) su un alone chiaro come il fondo crema della carta;
  in «Oggi» restano come gli altri nomi. Per nome, nella classificazione: corpo in pixel (`nomi.corpo`:
  MEZZALUNA FERTILE 21, più in alto nella 09b per staccarla da MESOPOTAMIA, subito a destra di Carran; CANAAN
  spostata tra Biblo e Sichem, non sotto i nomi delle tappe) e «sempre visibile»
  (`nomi.sempre`: MEZZALUNA FERTILE e Canaan compaiono sempre e cedono solo all'interfaccia; migrazione 004).
  Segnaposto delle tappe: quando si sovrapporrebbero (Canaan, da lontano) si dispongono in colonna da nord a
  sud, a 30 px, a destra del cammino, con una linea di richiamo verso il pallino sul luogo vero, come nella PNG
  (`distanziaPin`, da zoom 3,5; i segnaposto non devono avere `position` nel CSS, o si accodano); tutte le
  tappe hanno il nome visibile (nessuna più «secondaria»); nome breve della tappa 4 «tra Betel e Ai».
  Dal 2026-11-13 (sera): ovali senza contorno tratteggiato (stile tolto); legenda «Mezzaluna fertile»,
  «Canaan», «Tappa in un'area non precisata», «Altre città dell'epoca» (pallino nero; i simboli vanno sempre in
  fondo alla legenda); aggiunti Rushalimum (Gerusalemme, città antica) e Alashiya (Cipro, scritta a mano
  sull'isola vera: nel disegno cadrebbe in mare); Assur, Menfi e Rushalimum «sempre visibili». Un nome
  «sempre visibile» cerca prima un posto libero e solo se non c'è si sovrappone a nomi e segnaposto.
  Una città coperta da un segnaposto si scrive appena sopra di lui, o appena sotto (Menfi sopra la tappa dell'Egitto; dal 2026-11-14 vale anche per le città di oggi: Gerusalemme sotto il segnaposto di Mòria, che sta a meno di 3 km).
  MEZZALUNA FERTILE tra Carran, Assur e MESOPOTAMIA (09b: x 557, y 157). Segnaposto: la tappa si colora di
  blu (#1f5fbf) solo quando la linea continua la raggiunge (classe `arrivata`); blu anche le tappe percorse.
  Epoca «1800 a.C.» (`1800ac`, anno -1800). Stili: Mezzaluna fertile (verde #dff092, velo, in legenda),
  Canaan (#fbe39a), Area non precisata (ovali #fde2ad; in legenda «Tappa in un'area non precisata», come
  nella PNG) con il contorno tratteggiato arancio come stile di linea, «Altre città dell'epoca» (punto, solo
  legenda); percorso = le 11 linee rosse tratteggiate. Nomi: Dominio di Shamshi-Adad, regni di Mari,
  Babilonia, Larsa, d'Egitto; Mezzaluna fertile, Mesopotamia, Canaan; Sinai (anche in Oggi); Assur, Mari,
  Biblo, Babilonia, Larsa, Menfi. Esclusi Rushalimum e Alashiya (non sono nella PNG) e Mar Mediterraneo e Mar
  Rosso (ci sono già le etichette scritte a mano; quella del Mar Rosso spostata dove la mette la PNG, a nord
  vicino al Sinai, 34,75° E 27,15° N). Nomi «disegnati» (la carta li mette lontani dal vero): «Mare Salato» e
  «Mare Inferiore» sulle acque di oggi, solo allora; Eufrate, Tigri e Nilo accanto ai fiumi veri, nel tratto
  dove li scrive la PNG (il Tigri della carta passa un centinaio di km a est di quello vero).
  Tappe (9, numerazione della carta): Ur dei Caldei, Carran, Sichem, Tra Betel e Ai (luogo Betel), Negheb
  (luogo nuovo, ipotetico, dove la carta mette la tappa: 30,52° N 34,70° E), Egitto (luogo Menfi, non più
  Zoan), Mamre presso Ebron, Bersabea, Mòria (luogo nuovo, ipotetico, a Gerusalemme secondo la tradizione);
  dopo Mòria il cammino finisce (il ritorno a Bersabea è stato tolto il 2026-11-13 su richiesta della
  redazione; si rimette nella pagina del cammino). La tappa 7 passa per Negheb e Betel (ritorno dall'Egitto). Testi di
  Negheb e Mòria e ritocchi di Sichem, Egitto e panoramica: bozze da far rivedere alla redazione. Spilli:
  i 13 pallini del disegno (Ur, Carran, Sichem, Betel, Gerusalemme, Mamre, Bersabea, Assur, Mari, Biblo,
  Babilonia, Larsa, Menfi) e 3 punti della costa di Canaan (Netanya, Ashdod, Rafah): la carta è schematica,
  Canaan è disegnato circa 1,6 volte più grande del resto; scarto medio 45 km.
  Della PNG il portale non sa ancora rappresentare: i due colori del cammino («Verso l'Egitto» rosso fino alla
  tappa 6, «Ritorno e tappe successive» viola dopo) e il cerchio tratteggiato della tappa 4 («Localizzazione
  indicativa»); i segnaposto di Negheb ed Egitto sono come gli altri (l'ovale c'è).
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
  Verificati il 2026-11-12 (`strumenti/prepara_confini_fiumi.py`, fonti Natural Earth di GitHub, identiche
  alla copia locale): corretti Cipro intera, Kosovo, Crimea in Ucraina, Abcasia e Ossezia in Georgia,
  Somaliland in Somalia, Sahara occidentale a sé. Due correzioni: (1) le terre che il punto di vista
  italiano (come quelli francese, tedesco e britannico) non assegna a nessuno Stato restavano senza confini;
  ora se ne disegna il contorno verso gli Stati vicini (dal file delle aree contese): Golan con la vecchia
  linea verso Israele continua e la linea del cessate il fuoco del 1974 puntinata, Abyei, triangolo di Ilemi,
  campo di ghiaccio della Patagonia, angolo di Artigas, fiume Dragonja; (2) a Gerusalemme Natural Earth
  segue il confine municipale israeliano (Gerusalemme Est in Israele): lì si usa la linea del 1949, che
  Natural Earth ha solo nel punto di vista palestinese (riquadro `GERUSALEMME`; il saliente di Latrun resta
  com'è). Da decidere con la redazione: Libano-Siria e Israele-Libano sono puntinati perché «non definiti»
  (non tracciati sul terreno), pur non essendo contesi.
- **Capitali**: Natural Earth segna Gerusalemme come capitale di Israele anche nel punto di vista
  italiano, il che non corrisponde alla posizione ufficiale italiana. L'elenco delle capitali va
  quindi validato dalla redazione: tabella nel backoffice, precompilata e corretta.
- **Epoche, una sola per vista**: pannello "1700 a.C. · Oggi" (il Confronta con il cursore a
  tendina è stato tolto il 2026-11-06: non serve). La regola vale per ogni itinerario e ogni scheda
  ed è scritta in un solo punto, la tabella `EPOCHE` di `cammino.html`:
  | Sempre, in ogni epoca | Solo "Oggi" | Solo nell'epoca storica ("allora") |
  |---|---|---|
  | satellite (di oggi, dichiarato), fiumi, geografia fisica in tondo (mari, rilievi, deserti; dalla cartina anche Mar Morto, Penisola del Sinai, M.te Ararat, M.te Sinai), cammino con le frecce e tappe | confini e nomi degli Stati attuali, capitali, grandi città, etichette scritte a mano di fiumi e regioni (`LABELS`: Eufrate, Tigri, Nilo, Giordano, Mesopotamia, Deserto siriano) | **la cartina disegnata sopra il satellite, con tutti i suoi dettagli** (dal 2026-11-07; dal 2026-11-12 la carta nuova, «1800 a.C.»): Mezzaluna fertile verde (velo), Canaan giallo, aree non precisate di Negheb ed Egitto (ovali pieni con il contorno tratteggiato), aree ritagliate sulle terre emerse; nomi politici senza confini (Dominio di Shamshi-Adad, regni di Mari, Babilonia, Larsa, d'Egitto), regioni antiche (Mezzaluna fertile, Mesopotamia, Canaan), fiumi con l'inclinazione della carta, mari con il nome antico (Mare Inferiore, Mare Salato); città dell'epoca con il pallino bianco; alone: il mondo si scurisce gradualmente allontanandosi dai dati della cartina (16 veli leggeri, `ALONE` in `importazione-svg.ts`), senza riquadri |
  In "Oggi" nessuna area tematica (Mezzaluna fertile e Valle del Nilo tolte il 2026-11-07): sopra la
  carta di oggi c'è solo il cammino.
  Legenda: al primo posto, in entrambe le epoche, «Cammino di Abramo» con il simbolo della carta
  (tratteggio rosso su bordo bianco). Nell'epoca storica poi le voci della cartina, senza interruttori:
  con la carta nuova (2026-11-12) «Mezzaluna fertile» e «Area non precisata», come nella legenda della carta
  (con la cartina del volume la Mezzaluna non era in legenda: deciso il 2026-11-08). Il nome «Mezzaluna
  fertile» ora viene dalla carta, inclinato come lì. In "Oggi"
  poi «Stati toccati dal cammino» con il loro giallo (dal 2026-11-13) e l'interruttore "Cartina muta", che toglie
  tutti i nomi dalla carta, anche quelli delle tappe (restano i numeri), e vale solo in "Oggi". Niente altre voci.
  Niente di moderno nell'epoca storica, niente di antico in "Oggi". Per un itinerario con un'altra
  epoca (per esempio 1500 a.C.) cambiano solo il pulsante, il titolo e i dati dei regni.
  - **Solo caratteri a bastoni, nessun graziato**: pannello con titoli in Josefin Sans e testo in
    Mulish (scelti il 2026-11-06 tra sette coppie provate); nomi sulla carta in Alegreya Sans.
  - **Pannello "Notte"**: blu profondo (#10213a) come il cielo intorno al globo, intestazione
    sfumata, accento corallo (#ff6b57) per i pulsanti, giallo (#ffd166) per occhielli e titoletti.
    Uguale con il tema chiaro o scuro del sistema.
  - **Niente corsivi sulla carta** (dal 2026-11-13, richiesta di Tommaso): anche i nomi antichi (regni,
    regioni antiche, capitali e città dell'epoca) sono in tondo; prima erano in corsivo, riservato a loro.
  - *Epoca storica*: solo regni antichi.
    La geografia fisica (mari, fiumi, rilievi, deserti) è in tondo colorato, blu per le acque e
    bruno per rilievi e regioni, e vale in ogni epoca.
  - **Tutti i nomi della carta, in ogni epoca, con il codice della carta del 1800 a.C.** (2026-11-13, richiesta
    della redazione): scritte scure e grandi su un alone crema (`--alone-chiaro`). Città e capitali di oggi a
    15 px nere (#141414) con il pallino o il quadratino (capitali); Stati tutti a 18 px (come l'Egitto: i piccoli, come Libano e Iraq, si leggevano male; niente forma ridotta) in prugna scuro (#4a1f45);
    acque #0b2ee6 (mari 16-17, fiumi 16, oceani 19); rilievi, deserti e regioni #6b3f12.
  - *Oggi*: solo Stati attuali, nomi in MAIUSCOLO spaziato (Alegreya Sans). Confini come negli
    atlanti: fascia color prugna (#6f4a68) con filo bianco sopra, a puntini se contesi; nessun'altra linea ha
    la fascia (fiumi azzurri semplici, percorso rosso). Dal 2026-11-13 confini più marcati e Stati riempiti con
    sette colori tenui, come in un atlante politico (`stati-fill`, da `dati/stati.geojson`: due Stati
    confinanti non hanno mai lo stesso colore, `MAPCOLOR7` di Natural Earth), più leggeri da vicino.
    Dal 2026-11-13 (richiesta di Tommaso) gli **Stati attraversati dal cammino** sono tutti del giallo dell'Iraq
    (#f7d154, `COLORE_STATI_DEL_CAMMINO`): la pagina li calcola dal cammino (tappe, tratti e ritorno, un controllo
    ogni 2 km: `statiDelCammino`); per Abramo Iraq, Turchia, Siria, Libano, Israele, Palestina, Egitto (non la
    Giordania). Gli altri Stati tengono i colori dell'atlante politico, ma il giallo (k 1) e il sabbia (k 7),
    troppo simili, diventano verde acqua (#7fdcc0) e pervinca (#93a8f0): due confinanti restano sempre diversi.
    Il giallo degli Stati del cammino è più coprente degli altri (opacità ,62 a zoom 1, ,55 a 5, ,40 a 7, ,32 a 8,
    contro ,34 / ,30 / ,20 / ,14), perché risalti; in legenda «Stati toccati dal cammino».
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
│   │                         cartine/[id] (+ importa, allinea, ritocca), immagini, pubblicazione, backup, registro,
│   │                         api (immagini, satellite.pmtiles, fiumi.geojson, cartine/[id]/svg)
│   └── dati/                 cammini.db, archivio immagini, cartine/ (i file SVG) (locale, non versionato)
├── prototipo/
│   ├── cammino.html          il portale: una pagina per tutti i cammini (sorgente leggibile, librerie da CDN)
│   ├── cammini/              SCRITTO DAL BACKOFFICE: indice.json e una cartella per cammino
│   │   └── abramo/           cammino.json, 1800ac.json (la cartina), immagini/ (WebP grandi e miniature -mini)
│   ├── allinea.html          prima prova della georeferenziazione assistita (superata dal backoffice)
│   ├── cartine/mezzaluna_1700ac.svg  la cartina del volume in SVG (da cartina_in_svg.py, per le prove)
│   ├── cartine/mezzaluna_1700ac.punti.json  gli spilli con cui è generata la cartina del portale (da allinea.html)
│   └── dati/                 dati comuni a tutti i cammini («Oggi»)
│       ├── base.js           GEO: vecchie aree tematiche (non più caricato dalla pagina)
│       ├── confini.geojson   confini mondiali, punto di vista italiano (c: 0 normale, 1 conteso)
│       ├── stati.geojson     Stati come aree (n: nome come sulla carta, k: colore 1-7), semplificati a 0,02°
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
│   ├── prepara_confini_fiumi.py  rigenera confini.geojson, stati.geojson e fiumi.geojson (per i soli confini:
│   │                         py -c "import sys; sys.path.insert(0,'strumenti'); import prepara_confini_fiumi as p; p.confini()")
│   ├── natural_earth/        copie dei file di Natural Earth usati dagli script (non versionate)
│   ├── prepara_etichette_mondo.py rigenera mondo.js e capitali_da_validare.csv (scelte e correzioni nel codice)
│   ├── capitali_da_validare.csv  capitali per la redazione, con esito e nota (Excel, separatore ;)
│   ├── cartina_in_svg.py     .ai → SVG, solo per le prove (il cartografo consegnerà l'SVG)
│   ├── importa_cartina_ai.py SUPERATO dal backoffice: cartina vettoriale .ai → importazioni/abramo_1700ac.json
│   │                         (georeferenziazione con gli spilli di allinea.html, ritaglio sulle terre emerse,
│   │                         stili, elementi, nomi, alone, tracciati delle tappe, frecce)
│   ├── importazioni/         risultato del vecchio importatore, non più letto (non versionato)
│   ├── estrai_regni_da_cartina.py  cartina raster (PSD) → poligoni dai colori (superato)
│   └── mezzal_punti_controllo.json  punti di controllo usati per Mezzal.psd
├── Abramo_antica_livelli_09 (1).svg  la carta nuova di Abramo (2026-11-12), come consegnata
├── Abramo_antica_livelli_09b.svg     la stessa con Canaan e gli ovali pieni (livello 03b): è quella nel backoffice
├── Mezzal.psd                cartina del volume (Mezzaluna fertile, 1700 a.C.), raster (superata)
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

- Carta nuova di Abramo (2026-11-12), da verificare con la redazione: epoca «1800 a.C.» (la carta dice
  «riferimenti intorno al 1800 a.C.»); testi di Negheb e Mòria e ritocchi di Sichem, Egitto e panoramica
  (bozze); fascia, Canaan e ovali sono ricalcati da noi dalla PNG: meglio un SVG del cartografo fedele alla
  PNG; la PNG distingue «Verso l'Egitto» (rosso) e «Ritorno e tappe successive» (viola) e segna la tappa 4
  come «Localizzazione indicativa»: il portale per ora no (da decidere se aggiungerlo); in anagrafe restano
  luoghi della cartina vecchia non più usati (Palmira, Damasco, Zoan, Ninive, Susa, Sidone, Monte Ararat, Monte Sinai).
  Risolto il 2026-11-13: un mare scritto a mano (nome di oggi) non compare nell'epoca storica la cui cartina dà un
  nome antico alle stesse acque (un mare solo «allora» a meno di 400 km): «Golfo Persico» sparisce nel 1800 a.C.,
  dove c'è «Mare Inferiore» (`nome-antico-altrove` in `cammino.html`).
- **Controllo dei luoghi delle due carte** (2026-11-13), confrontati con i siti reali: tappe, città della cartina
  (Assur, Mari, Biblo, Babilonia, Menfi), mari, isole e regioni giusti. Corretti: Rushalimum, spostato a mano
  (pagina «Ritocca», 13/11 alle 10:23) 30 km a nord-ovest di Gerusalemme, è tornato com'è nel disegno, cioè su
  Gerusalemme (nel portale si scrive appena sotto il segnaposto di Mòria); «Mare Salato», spostato a mano sulla
  terraferma 75 km a sud del Mar Morto, è tornato sulle acque (35,49° E 31,5° N); Larsa nell'anagrafe era 5,5 km
  a sud del sito vero (ora 31,2858° N 45,8536° E, Tell as-Senkereh). Biblo ha le coordinate giuste (Jbeil, sulla
  costa), ma finiva in mare per un difetto della pagina: quando accanto al punto non c'era posto (la scritta CANAAN),
  il nome di una città della cartina si spostava sopra il punto con tutto il pallino. Ora le città della cartina
  hanno due forme in colonna (`sopra`, `sotto`): si sposta solo il nome, il pallino resta sul punto. Lasciati come sono: Mamre è sul centro di Hebron (Ramat el-Khalil è 2 km più a
  nord: «presso Ebron» va bene); le scritte a mano dei fiumi in «Oggi» (Tigri, Nilo, Giordano, Eufrate) stanno a
  30-50 km dal fiume, cioè accanto a lui nella vista d'insieme (5-8 pixel), più lontane da vicino.
- (Cartina vecchia, superata il 2026-11-12) Regni del 1700 a.C.: **dalla cartina vettoriale** `Mezzal-e-perc-Abramo_mod.ai`. La cartina si discosta dal vero in media ~35 km (è il disegno); con la
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
  più da vicino) e, se manca spazio, lo prova spostato di poco, sopra, sotto o di lato, ma solo **tutto dentro lo
  Stato** (`nomeNelloStato`, dal 2026-11-13: prima ISRAELE finiva nel Sinai e KUWAIT in Iraq). **Filetti** (2026-11-13,
  come negli atlanti): uno Stato piccolo che si vede intero e il cui nome non entra (né nel punto né scostato) si
  scrive fuori, prima sul mare, legato da un filetto prugna a un punto ben dentro lo Stato libero da segnaposto e nomi
  (`disponiFiletti`, dopo tutti gli altri nomi; ancore in `aggiornaPostiStati`); se neanche il filetto trova posto, il
  nome torna nel suo punto. Nella panoramica di Abramo: Israele, Palestina, Libano (e Cipro su schermi piccoli). Il
  punto di KUWAIT è a 47,52° E 29,18° N (in `base.js` e `mondo.js`): da zoom 5,6 il nome ci sta tutto, più da lontano
  va sul Golfo con il filetto. Il nome di uno Stato può accostarsi al quadratino di una capitale; se il suo punto non si vede (fuori dalla
  carta, sotto il pannello) o non ha posto, da zoom 3 il nome si avvicina alla parte visibile restando dentro lo
  Stato (`aggiornaPostiStati`, ricalcolato quando la carta si ferma: nella panoramica del cammino si legge anche
  «Arabia Saudita», il cui punto è molto più a sud); le capitali compaiono tutte da
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
