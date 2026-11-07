# Verifica prima versione

## Aggiornamento grafica strongmanitalia

- Marchio principale e quattro loghi copiati dal sito di riferimento, serviti localmente. Font Oswald variabile caricato da file locale, senza dipendenze da Google Fonts a runtime. Provenienza e licenza: [ASSETS.md](ASSETS.md).
- Eliminati dall'interfaccia i marchi precedenti; aggiornati titolo pagina, icona, header, footer, finestre e nome del CSV.
- `npm.cmd test`: **15 test passati, 0 falliti**, inclusi i controlli HTTP dei cinque PNG e del font con i rispettivi Content-Type. Controllo sintassi superato per app, dati e server.
- Browser: ricerca atleta, scheda e chiusura, cambio categoria, filtro squadra, ordinamento per prova e apertura delle regole verificati. Confermati font Oswald, lime #91D900 e caricamento dei sette elementi immagine.
- Layout verificato tramite emulazione browser a **320, 390, 768 e 1440 px**: nessun overflow orizzontale della pagina; la tabella resta scorrevole nella propria regione. Logo largo rispettivamente circa 204, 260, 260 e 300 px. I pannelli Arbitro e Centro Gara passano da due colonne a una sotto 850 px.
- I normali clic Playwright con attesa di stabilità restano limitati dall'ambiente integrato, come già riportato sotto. Per i controlli funzionali sono stati usati eventi DOM e un clic forzato per aprire la scheda atleta; non è una verifica completa di touch o tecnologie assistive.
- Server di verifica separato sulla porta 4175; l'anteprima già esistente sulla porta 4173 è stata riutilizzata per la consegna. Dopo modifiche al server, riavviare `npm.cmd start` per applicare anche la nuova mappa MIME; non è necessario reinstallare dipendenze.

Ambiente: Windows, Node.js v24.22.1. Anteprima locale: http://127.0.0.1:4173.

## Test automatici

Comando: `npm.cmd test` (equivalente a `node --test tests/*.test.js`). **15 test passati, 0 falliti**.

- 6 test del [motore punteggi](tests/scoring.test.js): direzione tempo/peso/ripetizioni, punti per iscritti, pari merito, risultati mancanti, DNS/DNF, isolamento categorie, totali e countback.
- 4 test dello [stato condiviso](tests/arena-state.test.js): validazione misure generiche, flusso conferma e propagazione tra peer, ricalcolo totale e blocco del punteggio pending.
- 4 test di [stato](tests/state.test.js): record completi, duplicati e ID ignoti, misure e stati incoerenti, dati corrotti, storage indisponibile, copia indipendente e CSV/formule.
- 1 test del [server](tests/server.test.js): pagina e moduli HTTP 200, CSP, tentativi di uscita dalla cartella pubblica, path malformati, file assenti, GET/HEAD e metodo non supportato.

Controllo sintassi `node --check` superato per i moduli e il server.

## Verifiche nel browser integrato

Pagina caricata con dati e moduli reali dal server locale. **14 controlli funzionali passati**:

1. Otto atleti nella categoria M90.
2. Ricerca per nome.
3. Punteggio invariato dopo la ricerca.
4. Apertura del dettaglio atleta.
5. Stato vuoto su ricerca senza risultati.
6. Cambio categoria con sei atlete.
7. Filtro squadra con due atlete.
8. Classifica per singola prova.
9. Primo classificato della prova corretto.
10. Simulazione e aggiornamento dello stato.
11. Salvataggio dei 130 risultati nel browser.
12. Generazione del CSV della vista corrente, verificando il contenuto del Blob senza scaricare file di test.
13. Ripristino dei dati dimostrativi.
14. Apertura delle regole e dei limiti della demo.

Vista mobile a 390 × 844: nessun overflow orizzontale della pagina, tabella larga 850 px all'interno di una regione scorrevole di 336 px; categorie scorrevoli. Anteprima riportata a desktop.

**Limite della verifica:** nel browser integrato i clic Playwright con verifica di stabilità hanno prodotto timeout pur con elementi visibili. I controlli funzionali sono stati completati invocando gli eventi DOM reali (`click`, `input`, `change`) nella pagina. Ciò verifica handler e rendering, ma non equivale a una verifica completa dei gesti reali, del focus o delle tecnologie assistive. Nessun test browser aggiunge dipendenze al progetto.

## Controllo sicurezza

Audit read-only richiesto alla sessione SECURITY_AGENT su interfaccia, stato, motore e server. Uso di `textContent`/API DOM, CSV con escaping, dati locali validati e server confinato alla cartella pubblica. Le regole e lo stato demo sono espliciti.

## Blocchi e assunzioni

- Miro non accessibile/verificato: requisiti annotati nel [README](README.md), senza contenuti inventati.
- Dati dimostrativi e regole provvisorie; nessun collegamento ai risultati ufficiali di StrengthTech.
- Nessun backend, account o aggiornamento fra dispositivi; il live è simulato.
- L'anteprima richiede il processo locale attivo. Nessuna pubblicazione remota effettuata.
