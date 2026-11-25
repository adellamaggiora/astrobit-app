# Astrobit App

App di studio sul database Notion «☄️ astrobit»: corsi, atomi, grafo dei collegamenti, flashcard e controllo qualità.

Un unico file, `index.html`, senza build.

## Come legge i dati

- **Dentro Claude** (come artefatto) usa il connettore Notion, in lettura e scrittura.
- **Fuori da Claude** (GitHub Pages o altro hosting) legge due file statici, `data/data.json` e `data/bodies.json`, generati da `scripts/export-notion.mjs`. È solo lettura: i livelli 1–5 delle flashcard si salvano nel browser (`localStorage`), non su Notion.

## Configurazione (una volta sola)

1. **Integrazione Notion.** Su https://www.notion.so/profile/integrations crea un'integrazione interna con la sola capacità «Read content». Copia il token.
2. **Condividi il database.** Nella pagina «☄️ astrobit» apri `...` > Connections e aggiungi l'integrazione.
3. **Secret del repository.** Settings > Secrets and variables > Actions > New repository secret, nome `NOTION_TOKEN`, valore il token.
4. **GitHub Pages.** Settings > Pages > Source: **GitHub Actions**.
5. **Prima esportazione.** Scheda Actions > «Esporta da Notion e pubblica» > Run workflow.

Poi il workflow gira ogni 3 ore e a ogni push su `main`. Rileggere solo le pagine modificate è il comportamento predefinito; «full» le rilegge tutte.

## Esportazione in locale

```bash
NOTION_TOKEN=... node scripts/export-notion.mjs          # solo pagine modificate
NOTION_TOKEN=... node scripts/export-notion.mjs --full   # tutto
python3 -m http.server 8000                              # poi apri http://localhost:8000
```

Serve Node 20 o successivo, senza dipendenze. L'app non si apre con `file://`: i JSON si leggono solo via HTTP.

## Cosa contiene l'esportazione

`data/data.json` ha atomi, corsi, sezioni e risorse con le proprietà usate dall'app. `data/bodies.json` ha il corpo di ogni atomo in Markdown di Notion. Con un repository pubblico **chiunque può leggere tutti gli atomi**.
