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

/*
 DOM helpers
*/

const $ = function (selector) {
    return document.querySelector(selector);
};

const $$ = function (selector) {
    return Array.from(document.querySelectorAll(selector));
};

/*
Make an element keyboard-accessible: focusable via Tab and activated
by Enter or Space. Pair this with a click listener; the keydown handler
added here triggers element.click(), so the same handler runs for both
mouse and keyboard. The role="button" attribute tells screen readers
the element is interactive even though it is a div, not a button.
*/
const make_keyboard_clickable = function (element) {
    element.tabIndex = 0;
    element.setAttribute("role", "button");
    element.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            element.click();
        }
    });
};


/*
Asset paths (theming)
All SVG filenames referenced by the JavaScript live here. To re-theme,
drop in replacement SVGs with these filenames OR edit the paths below.
*/

const ASSET_PATHS = Object.freeze({
    "tile_prefix": "./assets/tile-",
    "tile_suffix": ".svg",
    "first_player_token": "./assets/first-player-token.svg"
});

/*
App state

`game` is the pure game state from Azul.js. It is absent until a game
  starts; reading an absent property returns undefined.
`selection` is what the active player has currently tapped:
  absent, or {source: "factory", index: N, colour: "blue"},
  or {source: "center", colour: "blue"}.
`score_snapshot` lets us show "+N this round" in the round summary.*/

const app = Object.create(null);
app.score_snapshot = [];

// Screen / overlay management

const all_screens = ["#setup-screen", "#game-screen"];
const all_overlays = [
    "#rules-overlay",
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

// Setup screen

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
            tile.setAttribute(
                "aria-label",
                "Pick " + colour + " from factory " + (factory_index + 1)
            );
            make_keyboard_clickable(tile);
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
        tile.setAttribute("aria-label", "Pick " + colour + " from centre");
        make_keyboard_clickable(tile);
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

/*Render every player's board side by side. The active player gets a
visual accent so it is clear whose turn it is. Only the active
player's board responds to pattern-line and floor clicks.*/
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
        board_el.dataset.playerIndex = String(index);
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

    // Pattern lines | divider | wall - laid out as a grid row.
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
    line_el.dataset.row = String(row_index);

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

    /* Only the active player's lines are clickable, and only when a
    colour has been selected from a factory or the centre.*/
    if (is_active && app.selection !== undefined) {
        const legal = Azul.is_legal_placement(
            player,
            app.selection.colour,
            row_index
        );
        if (legal) {
            line_el.classList.add("is-clickable");
            line_el.setAttribute(
                "aria-label",
                "Place tiles on pattern line " + (row_index + 1)
            );
            make_keyboard_clickable(line_el);
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
        slot.dataset.row = String(row_index);
        slot.dataset.col = String(col_index);
        if (placed[col_index] !== undefined) {
            slot.classList.add("is-filled");
            slot.appendChild(tile_image(placed[col_index]));
        } else {
            /* Faded "ghost" tile shows which colour belongs in each
            wall position, so players can plan ahead.*/
            slot.appendChild(tile_image(pattern_colour));
        }
        row_el.appendChild(slot);
    });

    return row_el;
};

const render_floor_line = function (player, is_active) {
    const line_el = document.createElement("div");
    line_el.className = "floor-line";

    /* Always render all seven slots so the penalty numbers above each
    slot are always visible, even before any tiles have fallen.*/
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
        line_el.setAttribute("aria-label", "Send selected tiles to floor");
        make_keyboard_clickable(line_el);
        line_el.addEventListener("click", function () {
            handle_pattern_line_click(Azul.FLOOR_INDEX);
        });
    }

    return line_el;
};

// Click handlers

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
    sync_drag_layer();
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
    sync_drag_layer();
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
    sync_drag_layer();
    advance_after_move();
};

/* Scoring-phase animation
When the round ends, rather than jumping straight to the resolved
state, we animate the wall-tiling phase: each player is highlighted in
turn, completed pattern lines slide a tile across to the wall, and the
leftover and floor tiles fly to the discard box.

IMPORTANT ARCHITECTURE NOTE: the scoring logic lives entirely in the
pure module (Azul.end_round). This animation never computes scores or
resolves the board itself. It is given the "before" state (round over)
and the "after" state (end_round's output) and simply animates the
visual difference between the two, deriving what moved by comparing
the two states. When the animation finishes, the real resolved state
is rendered. The module remains the single source of truth.
*/

const SCORE_STEP_DELAY = 650;    // ms between animation steps
const SCORE_FLY_TIME = 550;      // ms for a tile to fly to its target

// Returns the on-screen centre of an element, or undefined if missing.
const element_center = function (selector) {
    const el = $(selector);
    if (el === null) {
        return undefined;
    }
    const rect = el.getBoundingClientRect();
    return {
        "x": rect.left + rect.width / 2,
        "y": rect.top + rect.height / 2
    };
};

// Creates a floating tile in the drag layer at `from`, transitions it to
// `to`, and removes it when done for better visuals.
const fly_tile = function (colour, from, to) {
    if (from === undefined || to === undefined) {
        return;
    }
    const el = document.createElement("img");
    el.className = "drag-tile flying";
    el.src = drag_tile_src(colour);
    el.alt = "";
    el.style.left = from.x + "px";
    el.style.top = from.y + "px";
    $("#drag-layer").appendChild(el);
    /* Force a reflow so the starting position is committed before we
     change it, otherwise the browser may skip the transition. Reading
     a layout property (offsetWidth) triggers the reflow.*/
    apply_fly_target(el, to);
};

/* Sets the transition and destination on a flying tile after a reflow.
 Separated out so the reflow-triggering read is not a bare expression
 statement (which the linter disallows).*/
const apply_fly_target = function (el, to) {
    const reflow = el.offsetWidth;
    el.dataset.reflow = String(reflow);
    el.style.transition = (
        "left " + SCORE_FLY_TIME + "ms ease-in-out, " +
        "top " + SCORE_FLY_TIME + "ms ease-in-out"
    );
    el.style.left = to.x + "px";
    el.style.top = to.y + "px";
    window.setTimeout(function () {
        el.remove();
    }, SCORE_FLY_TIME + 50);
};

/* Returns a single animation step that resolves one completed pattern
 line: slides a tile to the wall and sends the leftovers to the box.
 Defined outside any loop so the linter is satisfied; the closure
 captures its arguments cleanly.*/
const make_wall_step = function (board_sel, row, col, colour, leftover) {
    return function () {
        const from = element_center(
            board_sel + " .pattern-line[data-row=\"" + row + "\"]"
        );
        const to = element_center(
            board_sel + " .wall-slot[data-row=\"" + row
            + "\"][data-col=\"" + col + "\"]"
        );
        fly_tile(colour, from, to);
        const box = element_center("#box-icon");
        let k = 0;
        while (k < leftover) {
            fly_tile(colour, from, box);
            k += 1;
        }
    };
};

// Returns the highlight step for a player.
const make_highlight_step = function (board_sel) {
    return function () {
        $$(".player-board").forEach(function (b) {
            b.classList.remove("is-scoring");
        });
        const board = $(board_sel);
        if (board !== null) {
            board.classList.add("is-scoring");
        }
    };
};

// Returns the floor-clearing step for a player.
const make_floor_step = function (board_sel, floor_colours) {
    return function () {
        const from = element_center(board_sel + " .floor-line");
        const box = element_center("#box-icon");
        floor_colours.forEach(function (colour) {
            fly_tile(colour, from, box);
        });
    };
};

/* Builds the ordered list of animation steps for one player by comparing
 their before-state and after-state. Each step is a function with no
 arguments that performs one visual action.*/
const build_player_steps = function (before, after, player_index) {
    const board_sel = (
        ".player-board[data-player-index=\"" + player_index + "\"]"
    );
    const steps = [make_highlight_step(board_sel)];

    /* For each pattern line that was complete and is now empty, add a
    step to slide a tile to the wall and send leftovers to the box.
    Map over the wall rows (not a raw loop with inline closures). */
    Azul.WALL_PATTERN.forEach(function (pattern_row, row) {
        const before_line = before.players[player_index].pattern_lines[row];
        const after_line = after.players[player_index].pattern_lines[row];
        const was_complete = (
            before_line.length === row + 1
            && after_line.length === 0
        );
        if (was_complete) {
            const colour = before_line[0];
            const col = pattern_row.indexOf(colour);
            steps.push(make_wall_step(board_sel, row, col, colour, row));
        }
    });

    /* Floor tiles fly to the box (excluding the first-player token,
    which is not a real tile). */
    const floor = before.players[player_index].floor_line.filter(
        (t) => t !== "first"
    );
    if (floor.length > 0) {
        steps.push(make_floor_step(board_sel, floor));
    }

    return steps;
};
/* Runs an array of step functions in sequence, pausing SCORE_STEP_DELAY
 between each. Calls on_complete after the last step.*/
const run_steps = function (steps, index, on_complete) {
    if (index >= steps.length) {
        window.setTimeout(on_complete, SCORE_STEP_DELAY);
        return;
    }
    steps[index]();
    window.setTimeout(function () {
        run_steps(steps, index + 1, on_complete);
    }, SCORE_STEP_DELAY);
};

// Orchestrates the whole scoring animation, then calls on_complete.
const animate_scoring = function (before_game, after_game, on_complete) {
    // Show the before-state so starting positions (full pattern lines,
    // floor tiles) exist in the DOM for the animation to read.
    app.game = before_game;
    render_game_screen();
    $("#status-message").textContent = "Scoring the round\u2026";

    // Build all steps across all players, in seat order.
    let all_steps = [];
    before_game.players.forEach(function (ignore, player_index) {
        all_steps = all_steps.concat(
            build_player_steps(before_game, after_game, player_index)
        );
    });

    run_steps(all_steps, 0, function () {
        // Clear the scoring highlight and reveal the resolved state.
        $$(".player-board").forEach(function (b) {
            b.classList.remove("is-scoring");
        });
        app.game = after_game;
        render_game_screen();
        on_complete();
    });
};

const advance_after_move = function () {
    /* After every placement, check whether the round or game has ended.
     When the round ends we animate the scoring phase between the
     round-over state and the resolved state (both produced by the pure
     module); the resolved state is shown when the animation completes.*/
    if (app.game.phase === Azul.PHASE.ROUND_OVER) {
        const before_game = app.game;
        const after_game = Azul.end_round(app.game);
        animate_scoring(before_game, after_game, function () {
            if (after_game.phase === Azul.PHASE.GAME_OVER) {
                show_game_over();
            } else {
                show_round_summary();
            }
        });
        return;
    }
    render_game_screen();
};

// Round summary

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

// Game over

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
    delete app.selection;
    sync_drag_layer();
    hide_all_overlays();
    show_screen("#setup-screen");
    render_player_name_inputs();
};

const handle_quit = function () {
    if (window.confirm("Quit this game and return to the menu?")) {
        handle_new_game();
    }
};

// Bonuses overlay

const handle_show_bonus = function () {
    show_overlay("#bonus-overlay");
};

const handle_close_bonus = function () {
    hide_all_overlays();
};

// Rules overlay (available from the setup screen and during the game)

const handle_show_rules = function () {
    show_overlay("#rules-overlay");
};

const handle_close_rules = function () {
    hide_all_overlays();
};

// High-contrast mode (colour-blindness accessibility)

/* Toggled by the Contrast button in the top bar. Adds a class
 "high-contrast" to <body>. The CSS then uses that class to overlay
 a text label (B/Y/R/K/W) and a distinct border style on every tile
 via the .tile-wrapper::after pseudo-element, so that colour is no longer
 the only distinguishing feature between tile types. Should be easier to
 see, although the tiles do already have differentiating patterns.
*/
const handle_contrast_toggle = function () {
    document.body.classList.toggle("high-contrast");
    $("#contrast-button").classList.toggle("is-active");
};

/* Tile drag layer (mouse-only cursor-follow animation)

 While a colour is selected with the mouse, copies of the picked tiles
 float just behind the cursor with a slight lag, as if being carried.
 This is purely decorative: it reads app.selection but never changes
 game state, and it is disabled for keyboard users (it only starts in
 response to a real mousemove). The actual selection logic is unchanged.

 "Weight" is produced by easing each tile toward the cursor by a
 fraction of the remaining distance every animation frame, so the
 cluster trails rather than snapping to the pointer. Each tile in the
 cluster eases at a slightly different rate so they fan out a little.
 */




const DRAG_EASE = 0.18;          // fraction of the gap closed per frame
const DRAG_TILE_SPREAD = 6;      // px offset between stacked tiles

const drag = Object.create(null);
drag.cursor_x = 0;
drag.cursor_y = 0;
drag.tiles = [];                 // [{el, x, y, ease, offset_x, offset_y}]
drag.active = false;
// drag.frame holds the requestAnimationFrame id while animating; it is
// left unset (undefined) when no animation is running.

/* Counts how many tiles of the selected colour are in the selection's
  source, so we know how many floating copies to create.*/
const count_selected_tiles = function () {
    if (app.selection === undefined) {
        return 0;
    }
    const colour = app.selection.colour;
    const source = (
        app.selection.source === "factory"
        ? app.game.factories[app.selection.index]
        : app.game.center
    );
    return source.filter((t) => t === colour).length;
};

const drag_tile_src = function (colour) {
    return (
        colour === "first"
        ? ASSET_PATHS.first_player_token
        : ASSET_PATHS.tile_prefix + colour + ASSET_PATHS.tile_suffix
    );
};

const animate_drag = function () {
    drag.tiles.forEach(function (tile) {
        const target_x = drag.cursor_x + tile.offset_x;
        const target_y = drag.cursor_y + tile.offset_y;
        tile.x += (target_x - tile.x) * tile.ease;
        tile.y += (target_y - tile.y) * tile.ease;
        tile.el.style.left = tile.x + "px";
        tile.el.style.top = tile.y + "px";
    });
    if (drag.active) {
        drag.frame = window.requestAnimationFrame(animate_drag);
    }
};

const stop_drag = function () {
    drag.active = false;
    if (drag.frame !== undefined) {
        window.cancelAnimationFrame(drag.frame);
        delete drag.frame;
    }
    $("#drag-layer").innerHTML = "";
    drag.tiles = [];
};

const start_drag = function () {
    stop_drag();
    const colour = app.selection.colour;
    const count = count_selected_tiles();
    const layer = $("#drag-layer");
    let i = 0;
    while (i < count) {
        const el = document.createElement("img");
        el.className = "drag-tile";
        el.src = drag_tile_src(colour);
        el.alt = "";
        el.style.left = drag.cursor_x + "px";
        el.style.top = drag.cursor_y + "px";
        layer.appendChild(el);
        drag.tiles.push({
            "el": el,
            "x": drag.cursor_x,
            "y": drag.cursor_y,
            // Tiles further back in the stack ease a touch slower, so the
            // cluster fans out behind the cursor as it moves.
            "ease": DRAG_EASE - (i * 0.02),
            "offset_x": i * DRAG_TILE_SPREAD,
            "offset_y": i * DRAG_TILE_SPREAD
        });
        i += 1;
    }
    drag.active = true;
    drag.frame = window.requestAnimationFrame(animate_drag);
};



/* Single entry point: called after any change to app.selection. Starts
the trail if a selection exists and the cursor has been seen (mouse
user), otherwise stops it.*/
const sync_drag_layer = function () {
    if (app.selection !== undefined && drag.cursor_x !== 0) {
        start_drag();
    } else {
        stop_drag();
    }
};

const handle_mouse_move = function (event) {
    drag.cursor_x = event.clientX;
    drag.cursor_y = event.clientY;
};




// Global keyboard shortcuts
/* Escape key deselects any currently-picked tile. This matches the
behaviour of clicking the already-selected tile to deselect it, and
is a common accessibility pattern for cancelling a selection, so it
should feel instinctual to anyone who has used a computer*/

const handle_global_keydown = function (event) {
    if (event.key === "Escape" && app.selection !== undefined) {
        delete app.selection;
        sync_drag_layer();
        render_game_screen();
    }
};




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
    $("#rules-button").addEventListener("click", handle_show_rules);
    $("#setup-rules-button").addEventListener("click", handle_show_rules);
    $("#rules-close-button").addEventListener("click", handle_close_rules);
    $("#contrast-button").addEventListener("click", handle_contrast_toggle);
    document.addEventListener("keydown", handle_global_keydown);
    document.addEventListener("mousemove", handle_mouse_move);
};

/* Module scripts are deferred, so the DOM is already parsed when this
 code runs. Call init directly rather than waiting for DOMContentLoaded,
 which has already fired by the time a module script executes.*/
init();
