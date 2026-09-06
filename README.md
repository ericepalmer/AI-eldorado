# The Quest for El Dorado (AI)

Digital adaptation of [The Quest for El Dorado](https://boardgamegeek.com/boardgame/217372/the-quest-for-el-dorado) by Reiner Knizia — a deck-building race through jungle, river, and village to the city of gold.

**Live:** [games.palton.xyz/eldorado/](https://games.palton.xyz/eldorado/) · counts: [/eldorado/count.html](https://games.palton.xyz/eldorado/count.html)

Play against 1–3 AI rivals in the browser.

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5177/`.

## Deploy (DreamHost)

```bash
chmod +x deploy/dreamhost.sh
./deploy/dreamhost.sh theeping@games.palton.xyz
```

That builds with base `/eldorado/` and rsyncs `dist/` to `~/games.palton.xyz/eldorado/`.

Then refresh the landing card (from the AI-skippity repo):

```bash
cd ../AI-skippity
./deploy/update-landing.sh theeping@games.palton.xyz
```

## What's included

- First-play route assembled from five **37-hex tiles** (B → C → N → I → K) plus ending gate — each tile is a large hex with **4 hexes per side**
- Terrain colors map to symbols: green/machete, blue/paddle, yellow/coin, grey/rubble, black/mountain, red/camp
- Starting decks (4 Travelers, 3 Explorers, 1 Sailor) and the full 18-type market (3 copies each)
- Movement, hiring, deck thinning at camps, jokers, action cards, and final-round / blockade tie-breakers
- Original UI artwork (not the commercial Franz Vohwinkel illustrations)

## Rules reference

Official overview and community resources: [BoardGameGeek](https://boardgamegeek.com/boardgame/217372/the-quest-for-el-dorado)
