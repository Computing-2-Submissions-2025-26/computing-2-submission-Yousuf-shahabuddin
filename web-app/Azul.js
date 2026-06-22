import R from "./ramda.js";

/**
 * Azul.js is a module to model and play "Azul", a board game designed
 * by Michael Kiesling and published by Plan B Games in 2017.
 * <p>
 * In Azul, two to four players are tile-laying artists decorating the
 * walls of the Royal Palace of Evora. Each round, players take turns
 * picking tiles from circular Factory displays (or from the centre of
 * the table) and placing them on pattern lines on their player boards.
 * At the end of each round, completed pattern lines are moved onto the
 * wall, scoring points based on adjacent tiles. Excess tiles fall to
 * the floor line and cost points. The game ends after the round in
 * which any player completes a horizontal line of five tiles on their
 * wall; bonus points are then awarded for completed rows, columns and
 * colour sets. The highest score wins.
 * </p>
 * <p>
 * All functions in this module are pure: they read their inputs and
 * return new values without changing the inputs. Randomness in
 * {@link Azul.new_game} and {@link Azul.start_round} (which shuffle
 * the bag) is the only impurity and is confined to those functions.
 * </p>
 * @namespace Azul
 * @author Yousuf Shahabuddin
 * @version 2025/26
 */
const Azul = Object.create(null);

// Type definitions

/**
 * A tile colour. Tiles come in five colours plus the special
 * "first" token (which is not a colour but lives in the centre
 * and is taken by whoever picks from the centre first in a round).
 * @typedef {string} Azul.Colour
 * @memberof Azul
 */

/**
 * A pattern line on a player's board. There are five pattern lines,
 * numbered 0 to 4. Line <em>i</em> holds up to <em>i+1</em> tiles of
 * one colour. A line is "complete" when filled; at end-of-round a
 * complete line contributes one tile to the wall and the rest are
 * discarded.
 * @typedef {Array<Azul.Colour>} Azul.PatternLine
 * @memberof Azul
 */

/**
 * A row on the wall. Each row has five cells; each cell is either
 * the placed colour or undefined (not yet placed). The static
 * {@link Azul.WALL_PATTERN} dictates which column each colour
 * belongs in for each row.
 * @typedef {Array<(Azul.Colour|undefined)>} Azul.WallRow
 * @memberof Azul
 */

/**
 * A player's full state.
 * @typedef {object} Azul.Player
 * @property {string} name The display name of the player.
 * @property {number} score The player's current score; never below 0.
 * @property {Array<Azul.PatternLine>} pattern_lines The five pattern
 *           lines (length 5, where line <em>i</em> has capacity
 *           <em>i+1</em>).
 * @property {Array<Azul.WallRow>} wall The 5x5 wall. Each cell is the
 *           placed colour or undefined.
 * @property {Array<Azul.Colour>} floor_line Tiles that "fell on the
 *           floor": excess tiles, illegal placements, or tiles taken
 *           when the player took the first-player token.
 * @property {boolean} has_first_token Whether the player's floor line
 *           contains the first-player token (used to start the next
 *           round and counts as a penalty tile).
 * @memberof Azul
 */

/**
 * The complete state of an Azul game. Every action produces a new
 * game state; states are never mutated.
 * @typedef {object} Azul.Game
 * @property {Array<Azul.Player>} players The player states, in seat
 *           order.
 * @property {number} active_player The index of the player whose turn
 *           it is to pick tiles.
 * @property {Array<Array<Azul.Colour>>} factories The factory
 *           displays. Each is a list of up to four tiles. An empty
 *           list means the factory has been emptied this round.
 * @property {Array<Azul.Colour>} center The pile of tiles in the
 *           centre of the table.
 * @property {Array<Azul.Colour>} bag The tile bag (face-down draw
 *           pile).
 * @property {Array<Azul.Colour>} box The discard box; tiles that have
 *           been moved off boards. Refills the bag when it empties.
 * @property {boolean} first_token_in_center Whether the first-player
 *           token is currently in the centre (i.e. no-one has taken
 *           it yet this round).
 * @property {number} round The current round number (1 for the first).
 * @property {string} phase See {@link Azul.PHASE}.
 * @memberof Azul
 */

// Constants

/**
 * The phases of the game.
 * <ul>
 *   <li><code>FACTORY_OFFER</code> &mdash; players take turns picking
 *       tiles. The valid action is {@link Azul.pick_from_factory} or
 *       {@link Azul.pick_from_center}.</li>
 *   <li><code>ROUND_OVER</code> &mdash; all factories and the centre
 *       are empty. {@link Azul.end_round} resolves walls and scores;
 *       {@link Azul.start_round} deals the next round.</li>
 *   <li><code>GAME_OVER</code> &mdash; at least one player completed a
 *       horizontal line of five tiles. Bonus points have been awarded
 *       and {@link Azul.winners} returns the winning indices.</li>
 * </ul>
 * @memberof Azul
 * @enum {string}
 */
Azul.PHASE = Object.freeze({
    "FACTORY_OFFER": "factory_offer",
    "ROUND_OVER": "round_over",
    "GAME_OVER": "game_over"
});

/**
 * The five tile colours used in the game. Each appears 20 times in
 * the bag, for a total of 100 tiles.
 * @memberof Azul
 * @constant {Array<Azul.Colour>}
 */
Azul.COLOURS = Object.freeze(["blue", "yellow", "red", "black", "white"]);

/**
 * The number of tiles of each colour in the bag at the start of a game.
 * @memberof Azul
 * @constant {number}
 */
Azul.TILES_PER_COLOUR = 20;

/**
 * The number of tiles dealt into each factory display each round.
 * @memberof Azul
 * @constant {number}
 */
Azul.FACTORY_SIZE = 4;

/**
 * The size (rows and columns) of each player's wall.
 * @memberof Azul
 * @constant {number}
 */
Azul.WALL_SIZE = 5;

/**
 * The minimum and maximum supported player counts.
 * @memberof Azul
 * @constant {number}
 */
Azul.MIN_PLAYERS = 2;

/**
 * The maximum supported player count.
 * @memberof Azul
 * @constant {number}
 */
Azul.MAX_PLAYERS = 4;

/**
 * The penalty applied to each floor-line position. The first two
 * floor-line tiles each cost 1 point, the next three each cost 2,
 * and any tiles beyond that each cost 3. The floor line has space
 * for seven tiles before tiles are returned to the box.
 * @memberof Azul
 * @constant {Array<number>}
 */
Azul.FLOOR_PENALTIES = Object.freeze([-1, -1, -2, -2, -2, -3, -3]);

/**
 * The maximum number of tiles that can sit in the floor line before
 * further fallen tiles are returned to the box rather than counted.
 * @memberof Azul
 * @constant {number}
 */
Azul.FLOOR_CAPACITY = 7;

/**
 * The colour-by-position pattern of the wall. Each colour appears
 * exactly once in each row and each column. A tile of colour X in
 * row R must be placed at WALL_PATTERN[R].indexOf(X).
 * @memberof Azul
 * @constant {Array<Array<Azul.Colour>>}
 */
Azul.WALL_PATTERN = Object.freeze([
    Object.freeze(["blue", "yellow", "red", "black", "white"]),
    Object.freeze(["white", "blue", "yellow", "red", "black"]),
    Object.freeze(["black", "white", "blue", "yellow", "red"]),
    Object.freeze(["red", "black", "white", "blue", "yellow"]),
    Object.freeze(["yellow", "red", "black", "white", "blue"])
]);

/**
 * The bonus point values awarded at end-of-game.
 * <ul>
 *   <li><code>row</code>: 2 points per completed horizontal line of 5.</li>
 *   <li><code>column</code>: 7 points per completed vertical line of 5.</li>
 *   <li><code>colour</code>: 10 points per colour with all 5 tiles placed.</li>
 * </ul>
 * @memberof Azul
 * @constant {object}
 */
Azul.BONUS_VALUES = Object.freeze({
    "row": 2,
    "column": 7,
    "colour": 10
});

/**
 * The placeholder value used in pattern_line_index to mean
 * "send these tiles to the floor line instead of any pattern line".
 * Pattern line indices 0-4 are real pattern lines; this index sends
 * tiles straight to the floor.
 * @memberof Azul
 * @constant {number}
 */
Azul.FLOOR_INDEX = 5;

// Private helpers (functions used inside the module but not exported)

/**
 * Returns a new array with the items of the input in random order.
 * Uses the Fisher-Yates shuffle. The input array is not mutated.
 * @function
 * @private
 * @param {Array} array The array to shuffle.
 * @returns {Array} A new array with the same items in random order.
 */
const shuffled = function (array) {
    const result = array.slice();
    let i = result.length;
    while (i > 1) {
        i -= 1;
        const j = Math.floor(Math.random() * (i + 1));
        const swap = result[i];
        result[i] = result[j];
        result[j] = swap;
    }
    return result;
};

/**
 * Returns a fresh starting bag with 20 tiles of each colour, shuffled.
 * @function
 * @private
 * @returns {Array<Azul.Colour>} The shuffled bag.
 */
const fresh_bag = function () {
    const all_tiles = R.chain(
        function (colour) {
            return R.repeat(colour, Azul.TILES_PER_COLOUR);
        },
        Azul.COLOURS
    );
    return shuffled(all_tiles);
};

/**
 * Returns an empty 5x5 wall.
 * @function
 * @private
 * @returns {Array<Azul.WallRow>} The wall.
 */
const empty_wall = function () {
    return R.times(
        function () {
            return R.repeat(undefined, Azul.WALL_SIZE);
        },
        Azul.WALL_SIZE
    );
};

/**
 * Returns a fresh player state for the given name.
 * @function
 * @private
 * @param {string} name The display name.
 * @returns {Azul.Player} The new player state.
 */
const new_player = function (name) {
    return {
        "name": name,
        "score": 0,
        "pattern_lines": R.times(() => [], Azul.WALL_SIZE),
        "wall": empty_wall(),
        "floor_line": [],
        "has_first_token": false
    };
};

/**
 * Draws <em>count</em> tiles from the bag, refilling from the box
 * (after shuffling) if the bag runs out. Returns the drawn tiles and
 * the new bag and box states.
 * @function
 * @private
 * @param {Array<Azul.Colour>} bag The current bag.
 * @param {Array<Azul.Colour>} box The current box.
 * @param {number} count The number of tiles to draw.
 * @returns {{drawn: Array<Azul.Colour>, bag: Array<Azul.Colour>,
 *           box: Array<Azul.Colour>}} The drawn tiles and updated
 *           piles.
 */
const draw_tiles = function (bag, box, count) {
    let working_bag = bag.slice();
    let working_box = box.slice();
    const drawn = [];
    let i = 0;
    while (i < count) {
        if (working_bag.length === 0) {
            if (working_box.length === 0) {
                // No more tiles anywhere. Stop drawing.
                break;
            }
            working_bag = shuffled(working_box);
            working_box = [];
        }
        drawn.push(working_bag[working_bag.length - 1]);
        working_bag = working_bag.slice(0, -1);
        i += 1;
    }
    return {"drawn": drawn, "bag": working_bag, "box": working_box};
};

/**
 * Returns the column index on the wall at which the given colour
 * belongs in the given row.
 * @function
 * @private
 * @param {number} row The wall row index.
 * @param {Azul.Colour} colour The tile colour.
 * @returns {number} The column index (0-4).
 */
const wall_column_for = function (row, colour) {
    return Azul.WALL_PATTERN[row].indexOf(colour);
};

// Public placement and legality

/**
 * Tests whether placing the given colour in the given pattern line of
 * the given player would be legal. Placement is legal when:
 * <ul>
 *   <li>The pattern line is empty, or already contains the same
 *       colour; AND</li>
 *   <li>The corresponding wall row does not already contain that
 *       colour.</li>
 * </ul>
 * The {@link Azul.FLOOR_INDEX} pseudo-line (sending tiles straight to
 * the floor) is always legal.
 * @memberof Azul
 * @function
 * @param {Azul.Player} player The player making the placement.
 * @param {Azul.Colour} colour The tile colour being placed.
 * @param {number} pattern_line_index The pattern line index (0-4) or
 *        {@link Azul.FLOOR_INDEX}.
 * @returns {boolean} True if the placement is legal.
 */
Azul.is_legal_placement = function (player, colour, pattern_line_index) {
    if (pattern_line_index === Azul.FLOOR_INDEX) {
        return true;
    }
    if (pattern_line_index < 0 || pattern_line_index >= Azul.WALL_SIZE) {
        return false;
    }
    const line = player.pattern_lines[pattern_line_index];
    const wall_row = player.wall[pattern_line_index];
    if (R.includes(colour, wall_row)) {
        return false;
    }
    if (line.length > 0 && line[0] !== colour) {
        return false;
    }
    return true;
};

/**
 * Places a batch of tiles into one of the player's pattern lines (or
 * sends them all to the floor). Overflow above the line's capacity
 * also falls to the floor. Tiles beyond floor capacity are dropped
 * (returned separately so the caller can put them in the box).
 * Internal helper used by pick_from_factory / pick_from_center.
 * @function
 * @private
 * @param {Azul.Player} player The player state.
 * @param {Array<Azul.Colour>} tiles The tiles being placed.
 * @param {number} pattern_line_index Where to place them.
 * @returns {{player: Azul.Player, to_box: Array<Azul.Colour>}}
 *          The updated player state and any tiles that fell off the
 *          end of the floor and should go to the box.
 */
const place_into_pattern_line = function (player, tiles, pattern_line_index) {
    if (pattern_line_index === Azul.FLOOR_INDEX) {
        return add_to_floor(player, tiles);
    }
    const line = player.pattern_lines[pattern_line_index];
    const capacity = pattern_line_index + 1;
    const room = capacity - line.length;
    const placed = tiles.slice(0, room);
    const overflow = tiles.slice(room);
    const new_line = line.concat(placed);
    const after_place = R.mergeRight(player, {
        "pattern_lines": R.update(
            pattern_line_index,
            new_line,
            player.pattern_lines
        )
    });
    return add_to_floor(after_place, overflow);
};

/**
 * Adds tiles to the player's floor line, honouring floor capacity.
 * Tiles beyond capacity are returned in the to_box list rather than
 * lost.
 * @function
 * @private
 * @param {Azul.Player} player The player state.
 * @param {Array<Azul.Colour>} tiles Tiles to add to the floor.
 * @returns {{player: Azul.Player, to_box: Array<Azul.Colour>}}
 *          The updated player and any overflow tiles.
 */
const add_to_floor = function (player, tiles) {
    const room = Azul.FLOOR_CAPACITY - player.floor_line.length;
    const onto_floor = tiles.slice(0, Math.max(0, room));
    const to_box = tiles.slice(Math.max(0, room));
    const new_floor = player.floor_line.concat(onto_floor);
    return {
        "player": R.mergeRight(player, {"floor_line": new_floor}),
        "to_box": to_box
    };
};


// Game lifecycle

/**
 * Returns a new game state. The number of factories scales with
 * player count: 2 * players + 1.
 * Returns <code>undefined</code> if the player count is outside the
 * supported range.
 * @memberof Azul
 * @function
 * @param {Array<string>} player_names The display names of the
 *        players. Length determines the number of players (2-4).
 * @returns {(Azul.Game|undefined)} The initial game state ready for
 *          the first round, or undefined if the count is invalid.
 */
Azul.new_game = function (player_names) {
    const n = player_names.length;
    if (n < Azul.MIN_PLAYERS || n > Azul.MAX_PLAYERS) {
        return undefined;
    }
    const initial = {
        "players": player_names.map(new_player),
        "active_player": 0,
        "factories": R.times(
            () => [],
            (n * 2) + 1
        ),
        "center": [],
        "bag": fresh_bag(),
        "box": [],
        "first_token_in_center": true,
        "round": 0,
        "phase": Azul.PHASE.FACTORY_OFFER
    };
    return Azul.start_round(initial);
};

/**
 * Deals the next round: refills each factory with four tiles, clears
 * the centre, and resets the first-player token to the centre. The
 * starting player is whoever holds the first-player token in their
 * floor line (set during the previous {@link Azul.end_round}); they
 * are also relieved of the token here.
 * @memberof Azul
 * @function
 * @param {Azul.Game} game The current game state.
 * @returns {Azul.Game} The game at the start of a new round.
 */
Azul.start_round = function (game) {
    let bag = game.bag;
    let box = game.box;
    const new_factories = game.factories.map(function () {
        const result = draw_tiles(bag, box, Azul.FACTORY_SIZE);
        bag = result.bag;
        box = result.box;
        return result.drawn;
    });

    // Decide who starts: whoever has the first token from last round.
    const holder = game.players.findIndex(function (p) {
        return p.has_first_token;
    });
    const start_index = (
        holder === -1
        ? game.active_player
        : holder
    );
    // Clear the token off any player who had it.
    const new_players = game.players.map(function (p) {
        return R.mergeRight(p, {"has_first_token": false});
    });

    return R.mergeRight(game, {
        "factories": new_factories,
        "center": [],
        "bag": bag,
        "box": box,
        "first_token_in_center": true,
        "active_player": start_index,
        "round": game.round + 1,
        "phase": Azul.PHASE.FACTORY_OFFER,
        "players": new_players
    });
};

// Picking tiles (the heart of a turn)

/**
 * Performs the common end-of-turn bookkeeping after a pick: returns
 * the next game state with the active player advanced and the phase
 * updated to ROUND_OVER if all factories and the centre are now empty.
 * @function
 * @private
 * @param {Azul.Game} game The game state with picked tiles already
 *        applied.
 * @returns {Azul.Game} The game state ready for the next pick or for
 *          end-of-round.
 */
const after_pick = function (game) {
    const factories_empty = R.all(R.isEmpty, game.factories);
    const center_empty = R.isEmpty(game.center);
    if (factories_empty && center_empty) {
        return R.mergeRight(game, {"phase": Azul.PHASE.ROUND_OVER});
    }
    const next = (game.active_player + 1) % game.players.length;
    return R.mergeRight(game, {"active_player": next});
};

/**
 * The active player picks every tile of one colour from a factory.
 * The picked tiles go into a pattern line (or to the floor) of the
 * active player. Any other tiles in that factory are moved into the
 * centre.
 * Returns <code>undefined</code> if the move is invalid: wrong phase,
 * factory index out of range, factory contains no tile of that
 * colour, or the placement is illegal.
 * @memberof Azul
 * @function
 * @param {Azul.Game} game The current game state.
 * @param {number} factory_index The factory to pick from.
 * @param {Azul.Colour} colour The colour to pick.
 * @param {number} pattern_line_index The pattern line to place the
 *        picked tiles in, or {@link Azul.FLOOR_INDEX} to send them
 *        straight to the floor.
 * @returns {(Azul.Game|undefined)} The game state after the pick, or
 *          undefined if the call was invalid.
 */
Azul.pick_from_factory = function (
    game,
    factory_index,
    colour,
    pattern_line_index
) {
    if (game.phase !== Azul.PHASE.FACTORY_OFFER) {
        return undefined;
    }
    if (factory_index < 0 || factory_index >= game.factories.length) {
        return undefined;
    }
    const factory = game.factories[factory_index];
    const picked = factory.filter(function (t) {
        return t === colour;
    });
    if (picked.length === 0) {
        return undefined;
    }
    const player = game.players[game.active_player];
    if (!Azul.is_legal_placement(player, colour, pattern_line_index)) {
        return undefined;
    }

    const remaining = factory.filter(function (t) {
        return t !== colour;
    });
    const new_factories = R.update(factory_index, [], game.factories);
    const new_center = game.center.concat(remaining);

    const placement = place_into_pattern_line(
        player,
        picked,
        pattern_line_index
    );
    const new_players = R.update(
        game.active_player,
        placement.player,
        game.players
    );
    const new_box = game.box.concat(placement.to_box);

    return after_pick(R.mergeRight(game, {
        "factories": new_factories,
        "center": new_center,
        "players": new_players,
        "box": new_box
    }));
};

/**
 * The active player picks every tile of one colour from the centre.
 * If the first-player token is still in the centre, the player also
 * takes it (it lands on their floor line as a penalty tile, and
 * determines who starts next round).
 * Returns <code>undefined</code> if the move is invalid: wrong phase,
 * the centre contains no tile of that colour, or the placement is
 * illegal.
 * @memberof Azul
 * @function
 * @param {Azul.Game} game The current game state.
 * @param {Azul.Colour} colour The colour to pick.
 * @param {number} pattern_line_index The pattern line to place the
 *        picked tiles in, or {@link Azul.FLOOR_INDEX} to send them
 *        straight to the floor.
 * @returns {(Azul.Game|undefined)} The game state after the pick, or
 *          undefined if the call was invalid.
 */
Azul.pick_from_center = function (game, colour, pattern_line_index) {
    if (game.phase !== Azul.PHASE.FACTORY_OFFER) {
        return undefined;
    }
    const picked = game.center.filter(function (t) {
        return t === colour;
    });
    if (picked.length === 0) {
        return undefined;
    }
    const player = game.players[game.active_player];
    if (!Azul.is_legal_placement(player, colour, pattern_line_index)) {
        return undefined;
    }
    const remaining = game.center.filter(function (t) {
        return t !== colour;
    });

    // Take the first-player token if it is still there.
    let token_to_floor = [];
    let player_with_token = player;
    let still_in_center = game.first_token_in_center;
    if (game.first_token_in_center) {
        player_with_token = R.mergeRight(player, {"has_first_token": true});
        token_to_floor = ["first"];
        still_in_center = false;
    }

    // Place the first-player token (if taken) onto the floor first,
    // then the picked tiles. The token takes a floor slot.
    const placement1 = add_to_floor(player_with_token, token_to_floor);
    const placement2 = place_into_pattern_line(
        placement1.player,
        picked,
        pattern_line_index
    );

    const new_players = R.update(
        game.active_player,
        placement2.player,
        game.players
    );
    // The first-player token is not a real tile, so it must never enter
    // the discard box (from there it could be shuffled into the bag and
    // dealt into a factory). If a full floor line pushed it into the
    // overflow, drop it here.
    const overflow = placement1.to_box.concat(placement2.to_box).filter(
        function (t) {
            return t !== "first";
        }
    );
    const new_box = game.box.concat(overflow);

    return after_pick(R.mergeRight(game, {
        "center": remaining,
        "first_token_in_center": still_in_center,
        "players": new_players,
        "box": new_box
    }));
};

// Scoring
/**
 * Returns how many points placing a tile at (row, col) on a wall
 * would score. Counts the horizontally-connected and vertically-
 * connected tiles around the placement (inclusive of the new tile).
 * The rules:
 * <ul>
 *   <li>If the tile has no neighbours, score 1.</li>
 *   <li>Otherwise, count any horizontal run (≥2) and add it; count
 *       any vertical run (≥2) and add it. A tile that is part of
 *       both adds both.</li>
 * </ul>
 * @memberof Azul
 * @function
 * @param {Array<Azul.WallRow>} wall The wall <em>after</em> the tile
 *        has been placed.
 * @param {number} row The row of the new tile.
 * @param {number} col The column of the new tile.
 * @returns {number} The points scored for that placement.
 */
Azul.score_tile_placement = function (wall, row, col) {
    let h_run = 1;
    let c = col - 1;
    while (c >= 0 && wall[row][c] !== undefined) {
        h_run += 1;
        c -= 1;
    }
    c = col + 1;
    while (c < Azul.WALL_SIZE && wall[row][c] !== undefined) {
        h_run += 1;
        c += 1;
    }

    let v_run = 1;
    let r = row - 1;
    while (r >= 0 && wall[r][col] !== undefined) {
        v_run += 1;
        r -= 1;
    }
    r = row + 1;
    while (r < Azul.WALL_SIZE && wall[r][col] !== undefined) {
        v_run += 1;
        r += 1;
    }

    if (h_run === 1 && v_run === 1) {
        return 1;
    }
    return (
        (
            h_run > 1
            ? h_run
            : 0
        )
        + (
            v_run > 1
            ? v_run
            : 0
        )
    );
};

/**
 * Computes the floor-line penalty for the given list of fallen tiles.
 * Always returns a non-positive number.
 * @memberof Azul
 * @function
 * @param {Array<Azul.Colour>} floor_line The floor line.
 * @returns {number} The penalty (e.g. -3 for a floor of 2 tiles).
 */
Azul.floor_penalty = function (floor_line) {
    return R.sum(floor_line.map(function (ignore, i) {
        return (
            i < Azul.FLOOR_PENALTIES.length
            ? Azul.FLOOR_PENALTIES[i]
            : -3
        );
    }));
};

/**
 * Computes the end-of-game bonus for a completed wall: 2 points per
 * complete horizontal row, 7 per complete vertical column, 10 per
 * fully placed colour. Returns the breakdown as well as the total.
 * @memberof Azul
 * @function
 * @param {Array<Azul.WallRow>} wall The wall.
 * @returns {{rows: number, columns: number, colours: number,
 *           total: number}} The bonus breakdown.
 */
Azul.bonus_score = function (wall) {
    const rows = wall.filter(function (row) {
        return R.all((cell) => cell !== undefined, row);
    }).length;

    const columns = R.range(0, Azul.WALL_SIZE).filter(function (col) {
        return R.all((row) => row[col] !== undefined, wall);
    }).length;

    const colours = Azul.COLOURS.filter(function (colour) {
        const count = R.sum(wall.map(function (row) {
            return row.filter((cell) => cell === colour).length;
        }));
        return count === Azul.WALL_SIZE;
    }).length;

    return {
        "rows": rows,
        "columns": columns,
        "colours": colours,
        "total": (
            rows * Azul.BONUS_VALUES.row
            + columns * Azul.BONUS_VALUES.column
            + colours * Azul.BONUS_VALUES.colour
        )
    };
};

/**
 * Resolves a single player's complete pattern lines, moving one tile
 * from each onto the wall and scoring, then applies the floor-line
 * penalty and clears the floor. Tiles discarded (from completed lines
 * or the floor) are returned for the caller to add to the box.
 * Internal helper used by {@link Azul.end_round}.
 * @function
 * @private
 * @param {Azul.Player} player The player state.
 * @returns {{player: Azul.Player, discarded: Array<Azul.Colour>}}
 *          The updated player and tiles to send to the box.
 */
const resolve_pattern_lines = function (player) {
    let wall = player.wall;
    let pattern_lines = player.pattern_lines;
    let score = player.score;
    let discarded = [];

    let row = 0;
    while (row < Azul.WALL_SIZE) {
        const line = pattern_lines[row];
        if (line.length === row + 1) {
            const colour = line[0];
            const col = wall_column_for(row, colour);
            // Update wall (immutably).
            wall = R.update(
                row,
                R.update(col, colour, wall[row]),
                wall
            );
            score += Azul.score_tile_placement(wall, row, col);
            // Excess tiles from the line go to discards.
            discarded = discarded.concat(line.slice(1));
            pattern_lines = R.update(row, [], pattern_lines);
        }
        row += 1;
    }

    // Apply floor penalty. Floor tiles go to discards, but the
    // first-player token (represented as "first" in floor_line) does
    // NOT go to the box; it is dropped because the player keeps the
    // has_first_token flag.
    score = Math.max(0, score + Azul.floor_penalty(player.floor_line));
    const floor_discards = player.floor_line.filter(function (t) {
        return t !== "first";
    });

    return {
        "player": R.mergeRight(player, {
            "wall": wall,
            "pattern_lines": pattern_lines,
            "floor_line": [],
            "score": score
        }),
        "discarded": discarded.concat(floor_discards)
    };
};

/**
 * Tests whether a player's wall contains a completed horizontal row.
 * Completing such a row ends the game at the end of the current
 * round.
 * @memberof Azul
 * @function
 * @param {Azul.Player} player The player.
 * @returns {boolean} True if any row of the wall is fully tiled.
 */
Azul.has_completed_row = function (player) {
    return player.wall.some(function (row) {
        return R.all((cell) => cell !== undefined, row);
    });
};

/**
 * Performs end-of-round bookkeeping: moves a tile from each complete
 * pattern line onto the wall (scoring as it goes), applies floor
 * penalties, clears floor lines, and returns discarded tiles to the
 * box. If any player has completed a horizontal row, the phase moves
 * to GAME_OVER and end-of-game bonuses are added; otherwise the
 * phase becomes ROUND_OVER and {@link Azul.start_round} can be called.
 * Returns <code>undefined</code> if the round isn't actually over
 * (factories or centre still have tiles).
 * @memberof Azul
 * @function
 * @param {Azul.Game} game The current game state.
 * @returns {(Azul.Game|undefined)} The resolved game state, or
 *          undefined if called too early.
 */
Azul.end_round = function (game) {
    if (game.phase !== Azul.PHASE.ROUND_OVER) {
        return undefined;
    }
    let box = game.box;
    const resolved_players = game.players.map(function (player) {
        const result = resolve_pattern_lines(player);
        box = box.concat(result.discarded);
        return result.player;
    });

    const game_should_end = resolved_players.some(Azul.has_completed_row);

    if (game_should_end) {
        const final_players = resolved_players.map(function (p) {
            const bonus = Azul.bonus_score(p.wall);
            return R.mergeRight(p, {"score": p.score + bonus.total});
        });
        return R.mergeRight(game, {
            "players": final_players,
            "box": box,
            "phase": Azul.PHASE.GAME_OVER
        });
    }

    return R.mergeRight(game, {
        "players": resolved_players,
        "box": box,
        "phase": Azul.PHASE.ROUND_OVER
    });
};

// Winners
/**
 * Returns the indices of the winner(s) of a completed game. Highest
 * score wins; ties are broken by who has more completed horizontal
 * rows; a remaining tie returns multiple winners.
 * Returns <code>undefined</code> if the game is not over.
 * @memberof Azul
 * @function
 * @param {Azul.Game} game The game state.
 * @returns {(Array<number>|undefined)} The winning player indices,
 *          or undefined if the game is not over.
 */
Azul.winners = function (game) {
    if (game.phase !== Azul.PHASE.GAME_OVER) {
        return undefined;
    }
    const max_score = Math.max(...game.players.map((p) => p.score));
    const top_scorers = game.players.map(
        (p, i) => ({"player": p, "index": i})
    ).filter((entry) => entry.player.score === max_score);

    if (top_scorers.length === 1) {
        return [top_scorers[0].index];
    }

    // Tie-break on number of completed horizontal rows.
    const rows_completed = function (player) {
        return player.wall.filter(function (row) {
            return R.all((cell) => cell !== undefined, row);
        }).length;
    };
    const max_rows = Math.max(
        ...top_scorers.map((e) => rows_completed(e.player))
    );
    return top_scorers.filter(
        (e) => rows_completed(e.player) === max_rows
    ).map((e) => e.index);
};

export default Object.freeze(Azul);
