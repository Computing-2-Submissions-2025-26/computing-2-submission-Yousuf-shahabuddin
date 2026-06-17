[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/H6lPFq0J)
# Computing 2 Coursework Submission

**CID**: 02631134

A web-app implementation of **Azul**, a tile-laying game designed by Michael Kiesling and published by Plan B Games in 2017.

N.B: Fix the diamond block design as it is hard to see with Deuteranopia.

Thank you very much, I hope you enjoy my recreation of the game!

## Playing the game

Open `web-app/index.html` in Firefox using the VS Code launch configuration "Run Web App – Firefox". Choose 2 to 4 players, enter their names, and click Start game.

Each round, players take turns picking all tiles of one colour from a Factory display (or from the centre of the table) and placing them on one of their five pattern lines. The current player is highlighted with a blue border — all boards are always visible since Azul is an open-information game.

Completed pattern lines move one tile onto the wall at end-of-round, scoring points for connected tiles. Tiles that don't fit fall to the floor line, costing penalty points.

The game ends after any round in which a player completes a full horizontal row of five tiles on their wall. Bonus points are then awarded: +2 per completed row, +7 per completed column, +10 per colour with all five tiles placed. Highest score wins; ties broken by more completed rows.

Full rules are available on the setup screen under "How to play". The Bonus button in the top bar shows the bonus scoring reference at any time during play.

## Checklist

### Install dependencies locally
```sh
npm install
```

### Game Module – API
- [x] Module file at `web-app/Azul.js`, documented with JSDoc.
- [x] `jsdoc.json` points to `web-app/Azul.js`.
- [x] Compiled via `npx jsdoc -c jsdoc.json` (or the run configuration "Generate Docs").
- [x] Generated docs in `docs/` open from `docs/index.html`.

### Game Module – Implementation
- [x] `web-app/Azul.js` is fully implemented. Pure functions throughout; no mutation of inputs.

### Unit Tests – Specification
- [x] Test descriptions written in `web-app/tests/Azul.test.js`. Each `describe` block focuses on one aspect of the rules; each `it` is one sentence describing a rule.

### Unit Tests – Implementation
- [x] All 62 tests implemented and passing (`npx mocha`).

### Web Application
- [x] `web-app/index.html`
- [x] `web-app/default.css`
- [x] `web-app/main.js`
- [x] SVG assets in `web-app/assets/` – `tile-*.svg`, `factory.svg`, `player-board.svg`, `bag.svg`, `box.svg`, `background.svg`, `first-player-token.svg`. All are plain single-file SVGs using `viewBox="0 0 100 100"` and easy to replace.

### Finally
- [ ] Push to GitHub.
- [ ] Sync the changes.
- [ ] Check submission on GitHub website.
