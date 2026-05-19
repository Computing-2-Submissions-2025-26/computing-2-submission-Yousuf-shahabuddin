/**
 * main.js
 *
 * The web app for Azul. This file is the bridge between the browser
 * (clicks, drawing) and the pure game module Azul.js (the rules).
 *
 * Organisation, top to bottom:
 *   1. Imports and DOM helpers.
 *   2. Asset paths (configured in one place for easy theming).
 *   3. The app state object: a small wrapper around the pure game
 *      state, plus UI-only details (which tile is currently selected).
 *   4. Setup screen.
 *   5. Game screen rendering: factories, centre, all player boards.
 *   6. Selection and placement event handling.
 *   7. Round summary, game over, bonus overlay.
 *   8. High-contrast mode (accessibility).
 *   9. Wiring (event listeners) that runs once the page loads.
 *
 * All rules live in Azul.js. This file only translates user input
 * into module calls and renders the resulting state.
 *
 * Azul is an open-information game (every player can see everyone's
 * boards), so there is no pass-the-device handoff between turns. The
 * active player is indicated visually on the boards row.
 */

import Azul from "./Azul.js";

// =====================================================================
// DOM helpers
// =====================================================================

const $ = function (selector) {
    return document.querySelector(selector);
};

const $$ = function (selector) {
    return Array.from(document.querySelectorAll(selector));
};

// =====================================================================
// Asset paths (theming)
// =====================================================================
//
// All SVG filenames referenced by the JavaScript live here. To re-theme,
// drop in replacement SVGs with these filenames OR edit the paths below.

const ASSET_PATHS = Object.freeze({
    "tile_prefix": "./assets/tile-",
    "tile_suffix": ".svg",
    "first_player_token": "./assets/first-player-token.svg"
});

// =====================================================================
// App state
// =====================================================================
//
// `game` is the pure game state from Azul.js. It is absent until a game
//   starts; reading an absent property returns undefined.
// `selection` is what the active player has currently tapped:
//   absent, or {source: "factory", index: N, colour: "blue"},
//   or {source: "center", colour: "blue"}.
// `score_snapshot` lets us show "+N this round" in the round summary.

const app = Object.create(null);
app.score_snapshot = [];

// =====================================================================
// Screen / overlay management
// =====================================================================

const all_screens = ["#setup-screen", "#game-screen"];
const all_overlays = [
    "#bonus-overlay",
    "#round-summary-screen",
    "#game-over-screen"
];

const show_screen = function (screen_id) {
    all_screens.forEach(function (id) {
        $(id).classList.toggle("hidden", id !== screen_id);
    });
};

const hide_all_overlays = function () {
    all_overlays.forEach(function (id) {
        $(id).classList.add("hidden");
    });
};

const show_overlay = function (overlay_id) {
    all_overlays.forEach(function (id) {
        $(id).classList.toggle("hidden", id !== overlay_id);
    });
};

// =====================================================================
// Setup screen
// =====================================================================

const default_name = function (index) {
    return "Player " + (index + 1);
};

const render_player_name_inputs = function () {
    const count = parseInt(
        document.querySelector("input[name=player-count]:checked").value,
        10
    );
    const container = $("#player-names");
    container.innerHTML = "";
    let i = 0;
    while (i < count) {
        const row = document.createElement("div");
        row.className = "player-name-row";

        const label = document.createElement("label");
        label.htmlFor = "player-name-" + i;
        label.textContent = "Player " + (i + 1);

        const input = document.createElement("input");
        input.type = "text";
        input.id = "player-name-" + i;
        input.value = default_name(i);
        input.maxLength = 20;

        row.appendChild(label);
        row.appendChild(input);
        container.appendChild(row);
        i += 1;
    }
};

const handle_setup_submit = function (event) {
    event.preventDefault();
    const count = parseInt(
        document.querySelector("input[name=player-count]:checked").value,
        10
    );
    const names = [];
    let i = 0;
    while (i < count) {
        const input = $("#player-name-" + i);
        names.push(input.value.trim() || default_name(i));
        i += 1;
    }

    app.game = Azul.new_game(names);
    if (app.game === undefined) {
        return;
    }
    delete app.selection;
    app.score_snapshot = app.game.players.map((p) => p.score);
    show_screen("#game-screen");
    hide_all_overlays();
    render_game_screen();
};

/*Each tile is wrapped in a .tile-wrapper div so that high-contrast mode
can use CSS ::after pseudo-elements to overlay a text label on top of
the SVG image. The data-label attribute on the wrapper carries the
single-letter abbreviation (B/Y/R/K/W) that the CSS reads via
attr(data-label). The <img> itself carries the colour for styling.*/

/* Labels use K for black (standard accessibility convention; B is taken
by blue). The wrapper also receives all interactive classes
(is-clickable, is-selected, is-dimmed) and event listeners, so clicks
on either the image or the label overlay register correctly.*/

const TILE_LABELS = Object.freeze({
    "blue": "B",
    "yellow": "Y",
    "red": "R",
    "black": "K",
    "white": "W",
    "first": "1"
});

const tile_image = function (colour) {
    const wrapper = document.createElement("div");
    wrapper.className = "tile-wrapper";
    wrapper.dataset.label = TILE_LABELS[colour] || colour[0].toUpperCase();

    const img = document.createElement("img");
    img.className = "tile";
    img.draggable = false;

    if (colour === "first") {
        img.src = ASSET_PATHS.first_player_token;
        img.alt = "First-player token";
    } else {
        img.src = ASSET_PATHS.tile_prefix + colour + ASSET_PATHS.tile_suffix;
        img.alt = colour + " tile";
    }

    wrapper.appendChild(img);
    return wrapper;
};

/*Each render call rebuilds the game screen DOM entirely from the current
game state, rather than storing references to individual elements and
updating them in place.

This is a deliberate choice: because Azul.js is purely functional, the
game state is always a complete, self-contained snapshot. Rebuilding
the DOM from that snapshot is simpler and less error-prone than trying
to track which parts of the UI need updating after each move. There is
no risk of the DOM drifting out of sync with the game state, because
the DOM is always derived fresh from the state.

The trade-off is that we do more DOM work per turn than strictly
necessary. For a turn-based game with a small board, this is
imperceptible to the user.*/

const render_game_screen = function () {
    const game = app.game;
    if (game === undefined) {
        return;
    }

    $("#round-number").textContent = game.round;
    $("#bag-count").textContent = game.bag.length;
    $("#box-count").textContent = game.box.length;

    render_status_message();
    render_factories();
    render_center();
    render_all_boards();
};

const render_status_message = function () {
    const active = app.game.players[app.game.active_player];
    let msg;
    if (app.selection === undefined) {
        msg = active.name + ", pick a colour from a factory or the centre.";
    } else {
        msg = active.name + " selected " + app.selection.colour
                + ". Now choose a pattern line or the floor.";
    }
    $("#status-message").textContent = msg;
};

const render_factories = function () {
    const container = $("#factories");
    container.innerHTML = "";

    app.game.factories.forEach(function (factory, factory_index) {
        const fac_el = document.createElement("div");
        fac_el.className = "factory";
        if (factory.length === 0) {
            fac_el.classList.add("is-empty");
        }

        const tile_grid = document.createElement("div");
        tile_grid.className = "factory-tiles";

        factory.forEach(function (colour) {
            const tile = tile_image(colour);
            const is_selected = (
                app.selection !== undefined
                && app.selection.source === "factory"
                && app.selection.index === factory_index
                && app.selection.colour === colour
            );
            tile.classList.add("is-clickable");
            if (is_selected) {
                tile.classList.add("is-selected");
            } else if (
                app.selection !== undefined
                && app.selection.colour !== colour
            ) {
                tile.classList.add("is-dimmed");
            }
            tile.addEventListener("click", function () {
                handle_factory_tile_click(factory_index, colour);
            });
            tile_grid.appendChild(tile);
        });

        fac_el.appendChild(tile_grid);
        container.appendChild(fac_el);
    });
};

const render_center = function () {
    const container = $("#center");
    container.innerHTML = "";

    if (app.game.first_token_in_center) {
        const token = tile_image("first");
        token.classList.add("first-token");
        container.appendChild(token);
    }

    app.game.center.forEach(function (colour) {
        const tile = tile_image(colour);
        const is_selected = (
            app.selection !== undefined
            && app.selection.source === "center"
            && app.selection.colour === colour
        );
        tile.classList.add("is-clickable");
        if (is_selected) {
            tile.classList.add("is-selected");
        } else if (
            app.selection !== undefined
            && app.selection.colour !== colour
        ) {
            tile.classList.add("is-dimmed");
        }
        tile.addEventListener("click", function () {
            handle_center_tile_click(colour);
        });
        container.appendChild(tile);
    });

    container.classList.toggle(
        "is-empty",
        app.game.center.length === 0 && !app.game.first_token_in_center
    );
};

// Render every player's board side by side. The active player gets a
// visual accent so it is clear whose turn it is. Only the active
// player's board responds to pattern-line and floor clicks.
const render_all_boards = function () {
    const container = $("#boards-row");
    container.innerHTML = "";
    container.style.setProperty(
        "--board-count",
        String(app.game.players.length)
    );

    app.game.players.forEach(function (player, index) {
        const is_active = (index === app.game.active_player);
        const board_el = document.createElement("div");
        board_el.className = "player-board";
        if (is_active) {
            board_el.classList.add("is-active");
        }
        render_player_board_into(board_el, player, is_active);
        container.appendChild(board_el);
    });
};

const render_player_board_into = function (container, player, is_active) {
    // Header: player name and current score.
    const header = document.createElement("div");
    header.className = "player-board-header";

    const name = document.createElement("span");
    name.className = "player-board-name";
    name.textContent = player.name;
    header.appendChild(name);

    const score = document.createElement("span");
    score.className = "player-board-score";
    score.textContent = player.score;
    header.appendChild(score);

    container.appendChild(header);

    // Pattern lines | divider | wall — laid out as a grid row.
    const grid = document.createElement("div");
    grid.className = "board-grid";

    const lines = document.createElement("div");
    lines.className = "pattern-lines";
    let row = 0;
    while (row < Azul.WALL_SIZE) {
        lines.appendChild(render_pattern_line(player, row, is_active));
        row += 1;
    }
    grid.appendChild(lines);

    const div = document.createElement("div");
    div.className = "board-divider";
    grid.appendChild(div);

    const wall = document.createElement("div");
    wall.className = "wall";
    let r = 0;
    while (r < Azul.WALL_SIZE) {
        wall.appendChild(render_wall_row(player, r));
        r += 1;
    }
    grid.appendChild(wall);

    container.appendChild(grid);

    // Floor line sits below the pattern-lines/wall grid, full width.
    const floor_zone = document.createElement("div");
    floor_zone.className = "floor-line-zone";
    floor_zone.appendChild(render_floor_line(player, is_active));
    container.appendChild(floor_zone);
};

const render_pattern_line = function (player, row_index, is_active) {
    const line_el = document.createElement("div");
    line_el.className = "pattern-line";

    const line = player.pattern_lines[row_index];
    const capacity = row_index + 1;

    // Empty slots appear on the left; placed tiles fill from the right.
    const empty_count = capacity - line.length;
    let i = 0;
    while (i < empty_count) {
        const slot = document.createElement("div");
        slot.className = "slot";
        line_el.appendChild(slot);
        i += 1;
    }
    line.forEach(function (colour) {
        line_el.appendChild(tile_image(colour));
    });

    // Only the active player's lines are clickable, and only when a
    // colour has been selected from a factory or the centre.
    if (is_active && app.selection !== undefined) {
        const legal = Azul.is_legal_placement(
            player,
            app.selection.colour,
            row_index
        );
        if (legal) {
            line_el.classList.add("is-clickable");
            line_el.addEventListener("click", function () {
                handle_pattern_line_click(row_index);
            });
        } else {
            line_el.classList.add("is-illegal");
        }
    }

    return line_el;
};

const render_wall_row = function (player, row_index) {
    const row_el = document.createElement("div");
    row_el.className = "wall-row";
    const placed = player.wall[row_index];
    const pattern = Azul.WALL_PATTERN[row_index];

    pattern.forEach(function (pattern_colour, col_index) {
        const slot = document.createElement("div");
        slot.className = "wall-slot";
        if (placed[col_index] !== undefined) {
            slot.classList.add("is-filled");
            slot.appendChild(tile_image(placed[col_index]));
        } else {
            // Faded "ghost" tile shows which colour belongs in each
            // wall position, so players can plan ahead.
            slot.appendChild(tile_image(pattern_colour));
        }
        row_el.appendChild(slot);
    });

    return row_el;
};

const render_floor_line = function (player, is_active) {
    const line_el = document.createElement("div");
    line_el.className = "floor-line";

    // Always render all seven slots so the penalty numbers above each
    // slot are always visible, even before any tiles have fallen.
    let i = 0;
    while (i < Azul.FLOOR_CAPACITY) {
        const slot = document.createElement("div");
        slot.className = "floor-slot";

        const penalty = document.createElement("span");
        penalty.className = "floor-slot-penalty";
        penalty.textContent = Azul.FLOOR_PENALTIES[i];
        slot.appendChild(penalty);

        const placed = player.floor_line[i];
        if (placed !== undefined) {
            const tile = tile_image(placed);
            if (placed === "first") {
                tile.classList.add("first-token");
            }
            slot.appendChild(tile);
        }

        line_el.appendChild(slot);
        i += 1;
    }

    if (is_active && app.selection !== undefined) {
        line_el.classList.add("is-clickable");
        line_el.addEventListener("click", function () {
            handle_pattern_line_click(Azul.FLOOR_INDEX);
        });
    }

    return line_el;
};

// =====================================================================
// Click handlers
// =====================================================================

const handle_factory_tile_click = function (factory_index, colour) {
    // Clicking the already-selected colour deselects it.
    if (
        app.selection !== undefined
        && app.selection.source === "factory"
        && app.selection.index === factory_index
        && app.selection.colour === colour
    ) {
        delete app.selection;
    } else {
        app.selection = {
            "source": "factory",
            "index": factory_index,
            "colour": colour
        };
    }
    render_game_screen();
};

const handle_center_tile_click = function (colour) {
    if (
        app.selection !== undefined
        && app.selection.source === "center"
        && app.selection.colour === colour
    ) {
        delete app.selection;
    } else {
        app.selection = {"source": "center", "colour": colour};
    }
    render_game_screen();
};

const handle_pattern_line_click = function (pattern_line_index) {
    if (app.selection === undefined) {
        return;
    }
    let next;
    if (app.selection.source === "factory") {
        next = Azul.pick_from_factory(
            app.game,
            app.selection.index,
            app.selection.colour,
            pattern_line_index
        );
    } else {
        next = Azul.pick_from_center(
            app.game,
            app.selection.colour,
            pattern_line_index
        );
    }
    // Module returns undefined if the move was invalid; the UI
    // prevents this in practice but we guard here for safety.
    if (next === undefined) {
        return;
    }
    app.game = next;
    delete app.selection;
    advance_after_move();
};

const advance_after_move = function () {
    // After every placement, check whether the round or game has ended.
    // end_round() is called immediately so the UI always shows the
    // resolved state rather than a transient ROUND_OVER phase.
    if (app.game.phase === Azul.PHASE.ROUND_OVER) {
        app.game = Azul.end_round(app.game);
        if (app.game.phase === Azul.PHASE.GAME_OVER) {
            render_game_screen();
            show_game_over();
            return;
        }
        render_game_screen();
        show_round_summary();
        return;
    }
    render_game_screen();
};

// =====================================================================
// Round summary
// =====================================================================

const render_scoreboard = function (
    container,
    game,
    leader_indices,
    show_delta
) {
    container.innerHTML = "";
    const ranking = game.players.map(function (player, index) {
        return {"player": player, "index": index};
    }).sort(function (a, b) {
        return b.player.score - a.player.score;
    });

    ranking.forEach(function (entry) {
        const row = document.createElement("div");
        row.className = "scoreboard-row";
        if (leader_indices.includes(entry.index)) {
            row.classList.add("is-leader");
        }

        const name = document.createElement("div");
        name.className = "score-name";
        name.textContent = entry.player.name;
        row.appendChild(name);

        const delta = document.createElement("div");
        delta.className = "score-delta";
        if (show_delta) {
            const change = entry.player.score - (
                app.score_snapshot[entry.index] || 0
            );
            const sign = (
                change >= 0
                ? "+"
                : ""
            );
            delta.textContent = sign + change + " this round";
        }
        row.appendChild(delta);

        const total = document.createElement("div");
        total.className = "score-total";
        total.textContent = entry.player.score;
        row.appendChild(total);

        container.appendChild(row);
    });
};

const show_round_summary = function () {
    const game = app.game;
    const max_score = Math.max(...game.players.map((p) => p.score));
    const leaders = game.players.map(function (p, i) {
        return (
            p.score === max_score
            ? i
            : -1
        );
    }).filter((i) => i >= 0);
    render_scoreboard($("#round-scoreboard"), game, leaders, true);
    show_overlay("#round-summary-screen");
};

const handle_next_round = function () {
    app.score_snapshot = app.game.players.map((p) => p.score);
    app.game = Azul.start_round(app.game);
    delete app.selection;
    hide_all_overlays();
    render_game_screen();
};

// =====================================================================
// Game over
// =====================================================================

const show_game_over = function () {
    const game = app.game;
    const winners = Azul.winners(game);

    $("#winner-announcement").textContent = (
        winners.length === 1
        ? game.players[winners[0]].name + " wins!"
        : "Tie: " + winners.map(function (i) {
            return game.players[i].name;
        }).join(", ")
    );

    render_scoreboard($("#final-scoreboard"), game, winners, false);
    show_overlay("#game-over-screen");
};

const handle_new_game = function () {
    hide_all_overlays();
    show_screen("#setup-screen");
    render_player_name_inputs();
};

const handle_quit = function () {
    if (window.confirm("Quit this game and return to the menu?")) {
        handle_new_game();
    }
};

// =====================================================================
// Bonus overlay
// =====================================================================

const handle_show_bonus = function () {
    show_overlay("#bonus-overlay");
};

const handle_close_bonus = function () {
    hide_all_overlays();
};

// =====================================================================
// High-contrast mode (colour-blindness accessibility)
// =====================================================================
//
// Toggled by the Contrast button in the top bar. Adds a class
// "high-contrast" to <body>. The CSS then uses that class to overlay
// a text label (B/Y/R/K/W) and a distinct border style on every tile
// via the .tile-wrapper::after pseudo-element, so colour is no longer
// the only distinguishing feature between tile types.

const handle_contrast_toggle = function () {
    document.body.classList.toggle("high-contrast");
    $("#contrast-button").classList.toggle("is-active");
};

// =====================================================================
// Wiring
// =====================================================================

const init = function () {
    render_player_name_inputs();

    $$("input[name=player-count]").forEach(function (radio) {
        radio.addEventListener("change", render_player_name_inputs);
    });

    $("#setup-form").addEventListener("submit", handle_setup_submit);
    $("#next-round-button").addEventListener("click", handle_next_round);
    $("#new-game-button").addEventListener("click", handle_new_game);
    $("#quit-button").addEventListener("click", handle_quit);
    $("#bonus-button").addEventListener("click", handle_show_bonus);
    $("#bonus-close-button").addEventListener("click", handle_close_bonus);
    $("#contrast-button").addEventListener("click", handle_contrast_toggle);
};

// Module scripts are deferred, so the DOM is already parsed when this
// code runs. Call init directly rather than waiting for DOMContentLoaded,
// which has already fired by the time a module script executes.
init();
