# strongmanitalia

App per classifiche di eventi strongman, con identità grafica ripresa da [Strongman Italia](https://www.strongmanitalia.com/) su richiesta dell'utente. Loghi originali e font Oswald sono serviti localmente. Nessuna dipendenza da installare: richiede Node.js 20+.

## Avvio e test

Da questa cartella:

```powershell
npm start
```

Aprire http://127.0.0.1:4173. Tenere attivo il terminale durante l'anteprima. Per usare un'altra porta: `$env:PORT=4174` e poi `npm start`.

Su Windows PowerShell, se `npm.ps1` è bloccato dalla policy, usare `npm.cmd start` e `npm.cmd test`, oppure `node server.js` e `node --test tests/*.test.js`. Non è necessario cambiare la policy del sistema.

```powershell
npm test
```

Esiti e limiti di verifica: [TESTING.md](TESTING.md).

## Funzioni

- Header evento, statistiche, quattro categorie e cinque prove.
- Classifica con posizione, atleta, squadra, risultati per prova e punti.
- Ricerca nome/squadra, filtro squadra, ordinamento per prova.
- Scheda atleta accessibile da tastiera, finestre con chiusura Escape.
- Simulazione risultato, ricalcolo immediato, salvataggio nel browser e ripristino demo.
- Modalità Arbitro responsive per categoria, prova, atleta, misura e stato del risultato.
- Centro Gara con classifica totale live e coda dei prossimi atleti.
- Sincronizzazione demo tra schede dello stesso browser con BroadcastChannel e fallback localStorage.
- Esportazione CSV della vista filtrata.
- Layout responsive e tabella scorrevole su mobile.

I dati sono dimostrativi, con nomi inventati: **non sono risultati ufficiali e non sono sincronizzati con StrengthTech**. Lo stato è esplicitamente “demo interattiva”. Il salvataggio è locale al browser, senza account né backend e senza garanzia di persistenza fra dispositivi. Il server è un'anteprima locale, non un servizio di produzione.

## Modello modulare

- [Dati](dist/data.js): evento, categorie, atleti, prove, risultati. Ogni risultato usa `{athleteId,eventId,value,status}`; `null` indica una misura assente.
- [Motore punteggi](dist/scoring.js): funzioni pure `rankEvent(athletes,event,results)` e `calculateStandings(athletes,events,results)`. La seconda restituisce un oggetto con una classifica per categoria.
- [Stato e validazione](dist/state.js): controlli dei dati salvati, recupero errori e protezione formule CSV.
- [Stato condiviso](dist/arena-state.js): transizioni dei risultati, sincronizzazione tra schede e validazione degli input arbitro.
- [Interfaccia](dist/app.js): filtri e dettagli senza HTML interpolato nei dati.
- [Server locale](server.js): serve esclusivamente la cartella pubblica.

Punti N…1 nella categoria, parità con media delle posizioni occupate; tempi minori e pesi/ripetizioni maggiori vincono. Misure mancanti e DNS/DNF senza misura valgono zero. Spareggio totale per countback dei piazzamenti; parità persistente condivisa. Il motore ammette una misura numerica anche con DNS/DNF; il frontend salva soltanto risultati coerenti (misura presente con stato `valid`, misura assente con stato `pending`, DNS o DNF). È una convenzione del prototipo da confermare con il regolamento ufficiale.

Filtrare gli atleti non modifica la base di calcolo dei punti. L'ordinamento per prova mostra posizione e punti di quella prova, mantenendo i risultati delle altre.

## Modalità Arbitro e Centro Gara

La sezione “Modalità Arbitro” è ottimizzata per mobile/tablet. Seleziona categoria, prova e atleta, inserisci una misura e conferma uno stato `valid`, `pending`, `DNS` o `DNF`. Le prove configurate come `max`/`weight`/`distance` usano valori maggiori; `reps` usa più ripetizioni; `time` usa il tempo minore. Un `pending` non entra nel punteggio, mentre un DNS/DNF con misura numerica resta una misura valida secondo la convenzione del prototipo.

Il “Centro Gara” ricalcola subito la classifica totale e mostra lo stato di ogni prova. Più schede aperte sulla stessa origine condividono lo stato con `BroadcastChannel`; l'evento `storage` copre il fallback tra schede quando il canale non è disponibile. È una sincronizzazione locale per demo, senza server, account, autenticazione o conflitto distribuito.

La policy di scoring resta configurabile nei dati evento e nel motore: per aggiungere prove di peso o distanza basta usare `type: 'weight'` o `type: 'distance'`; `max` rimane alias compatibile per prove a massimale.

## Riferimenti e requisiti non verificati

Brief: [StrengthTech](https://strengthtech.app/en/scores/-2026-osg-european-championships-58/m90) e [board Miro](https://miro.com/app/board/uXjVEQtp5t0=/).

La lettura web della pagina StrengthTech restituisce il titolo dell'evento e i controlli lingua/unità, ma non espone la tabella atleti, i risultati o il regolamento. Il prototipo segue quindi le funzioni richieste dall'utente e le convenzioni dichiarate, senza riprodurre i suoi dati. La grafica è stata aggiornata sul riferimento Strongman Italia indicato dall'utente: marchio originale, lime #91D900, superfici antracite e font Oswald. Provenienza degli asset e licenza del font: [ASSETS.md](ASSETS.md). Il board Miro non è accessibile/verificato: **nessun suo contenuto è stato inventato**.

Da validare con i contenuti Miro e gli organizzatori:

- categorie reali e limiti di peso/età;
- tipi di prova, unità, misure parziali e penalità;
- regolamento punteggi, pari merito, countback e spareggio finale;
- inserimento/modifica risultati e relativa cronologia;
- ruoli organizzatore, giudice e spettatore;
- API/backend, sincronizzazione live e pubblicazione;
- privacy, iscrizioni e gestione dei dati reali.

Il progetto è confinato a questa cartella; il sito Mediterraneo non è coinvolto.

## Inventario file

| File | Contenuto |
| --- | --- |
| [dist/index.html](dist/index.html) | Header evento, categorie, classifica e finestre di dettaglio |
| [dist/styles.css](dist/styles.css) | Stili desktop e mobile |
| [dist/app.js](dist/app.js) | Ricerca, filtri, scheda atleta, simulazione e CSV |
| [dist/data.js](dist/data.js) | Modello dati e record dimostrativi |
| [dist/scoring.js](dist/scoring.js) | Punti, ranking, pari merito e countback |
| [dist/state.js](dist/state.js) | Validazione, stato locale e protezione CSV |
| [server.js](server.js) | Server per anteprima locale |
| [package.json](package.json) | Comandi di avvio e test, senza dipendenze |
| [tests/scoring.test.js](tests/scoring.test.js) | Test del motore |
| [tests/state.test.js](tests/state.test.js) | Test di validazione e CSV |
| [tests/server.test.js](tests/server.test.js) | Test HTTP e confinamento file |
| [TESTING.md](TESTING.md) | Esiti e limiti di verifica |
