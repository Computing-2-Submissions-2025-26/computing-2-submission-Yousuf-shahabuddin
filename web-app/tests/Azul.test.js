/*
  Tests for Azul.js.

  Each describe block focuses on one aspect of the game. Each test
  is a single sentence describing what the rule is and a single
  assertion checking that the code follows it. Reading this file
  top-to-bottom should explain how the game works.

  The tests are intentionally not exhaustive. They cover the rules
  of the game and the boundary conditions that a typical end-to-end
  play might not exercise.
 */

import {strict as assert} from "node:assert";
import Azul from "../Azul.js";

/* Helper: build a deterministic game state by hand for tests.*/


const make_player = function (overrides) {
    return Object.assign({
        "name": "Test",
        "score": 0,
        "pattern_lines": [[], [], [], [], []],
        "wall": [
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined]
        ],
        "floor_line": [],
        "has_first_token": false
    }, overrides);
};

const make_game = function (overrides) {
    return Object.assign({
        "players": [make_player({"name": "A"}), make_player({"name": "B"})],
        "active_player": 0,
        "factories": [["blue", "blue", "yellow", "red"], [], [], [], []],
        "center": [],
        "bag": [],
        "box": [],
        "first_token_in_center": true,
        "round": 1,
        "phase": Azul.PHASE.FACTORY_OFFER
    }, overrides);
};

/* Checks the static values.*/

describe("Constants", function () {
    it("there are five tile colours", function () {
        assert.equal(Azul.COLOURS.length, 5);
    });
    it("each colour appears twenty times in the bag", function () {
        assert.equal(Azul.TILES_PER_COLOUR, 20);
    });
    it("a wall is five by five", function () {
        assert.equal(Azul.WALL_SIZE, 5);
    });
    it("the wall pattern has each colour exactly once per row and per column",
        function () {
            const pattern = Azul.WALL_PATTERN;
            // Each row contains all 5 colours.
            pattern.forEach(function (row) {
                Azul.COLOURS.forEach(function (colour) {
                    assert.ok(row.includes(colour));
                });
            });
            // Each column contains all 5 colours.
            const columns = [0, 1, 2, 3, 4].map(function (col) {
                return pattern.map((row) => row[col]);
            });
            columns.forEach(function (col) {
                Azul.COLOURS.forEach(function (colour) {
                    assert.ok(col.includes(colour));
                });
            });
        });
    it("floor penalties total -14 for a full floor line", function () {
        assert.equal(
            Azul.FLOOR_PENALTIES.reduce((a, b) => a + b, 0),
            -14
        );
    });
});

/* Starting a game - validation and initial layout. */

describe("Starting a game", function () {
    it("rejects fewer than 2 players by returning undefined", function () {
        assert.equal(Azul.new_game(["Solo"]), undefined);
    });
    it("rejects more than 4 players by returning undefined", function () {
        assert.equal(
            Azul.new_game(["A", "B", "C", "D", "E"]),
            undefined
        );
    });
    it("creates 5 factories for 2 players", function () {
        const game = Azul.new_game(["A", "B"]);
        assert.equal(game.factories.length, 5);
    });
    it("creates 7 factories for 3 players", function () {
        const game = Azul.new_game(["A", "B", "C"]);
        assert.equal(game.factories.length, 7);
    });
    it("creates 9 factories for 4 players", function () {
        const game = Azul.new_game(["A", "B", "C", "D"]);
        assert.equal(game.factories.length, 9);
    });
    it("deals 4 tiles into each factory at the start of round 1",
        function () {
            const game = Azul.new_game(["A", "B"]);
            game.factories.forEach(function (f) {
                assert.equal(f.length, 4);
            });
        });
    it("puts the first-player token in the centre at round 1", function () {
        const game = Azul.new_game(["A", "B"]);
        assert.equal(game.first_token_in_center, true);
        assert.deepEqual(game.center, []);
    });
    it("starts in the FACTORY_OFFER phase with both players on 0 score",
        function () {
            const game = Azul.new_game(["A", "B"]);
            assert.equal(game.phase, Azul.PHASE.FACTORY_OFFER);
            assert.equal(game.players[0].score, 0);
            assert.equal(game.players[1].score, 0);
        });
    it("uses 100 tiles in total across bag and factories", function () {
        const game = Azul.new_game(["A", "B"]);
        const in_factories = game.factories.reduce(
            (sum, f) => sum + f.length,
            0
        );
        assert.equal(game.bag.length + in_factories, 100);
    });
});


// Placement legality - when can you place tiles and where?


describe("Placement legality", function () {
    it("you can always send tiles to the floor line", function () {
        const player = make_player();
        assert.equal(
            Azul.is_legal_placement(player, "red", Azul.FLOOR_INDEX),
            true
        );
    });
    it("you can place a colour in an empty pattern line", function () {
        const player = make_player();
        assert.equal(Azul.is_legal_placement(player, "red", 2), true);
    });
    it("you can add the same colour to a partially-filled pattern line",
        function () {
            const player = make_player({
                "pattern_lines": [[], [], ["red"], [], []]
            });
            assert.equal(Azul.is_legal_placement(player, "red", 2), true);
        });
    it("you cannot mix colours in one pattern line", function () {
        const player = make_player({
            "pattern_lines": [[], [], ["red"], [], []]
        });
        assert.equal(Azul.is_legal_placement(player, "blue", 2), false);
    });
    it("you cannot place a colour in a pattern line whose wall row " +
            "already has that colour", function () {
        const player = make_player({
            "wall": [
                [undefined, undefined, undefined, undefined, undefined],
                [undefined, undefined, undefined, undefined, undefined],
                ["black", undefined, undefined, undefined, undefined],
                [undefined, undefined, undefined, undefined, undefined],
                [undefined, undefined, undefined, undefined, undefined]
            ]
        });
        // Row 2's wall pattern is ["black", "white", "blue", "yellow", "red"];
        // the wall now has "black" already placed.
        assert.equal(Azul.is_legal_placement(player, "black", 2), false);
    });
    it("rejects out-of-range pattern line indices", function () {
        const player = make_player();
        assert.equal(Azul.is_legal_placement(player, "red", -1), false);
        assert.equal(Azul.is_legal_placement(player, "red", 10), false);
    });
});


// Picking from a factory - the main action of a turn.


describe("Picking from a factory", function () {
    it("moves the chosen colour onto the player's pattern line",
        function () {
            const game = make_game({
                "factories": [["blue", "blue", "yellow", "red"], [], [], [], []]
            });
            const after = Azul.pick_from_factory(game, 0, "blue", 1);
            assert.deepEqual(after.players[0].pattern_lines[1],
                 ["blue", "blue"]);
        });
    it("moves the leftover tiles into the centre", function () {
        const game = make_game({
            "factories": [["blue", "blue", "yellow", "red"], [], [], [], []]
        });
        const after = Azul.pick_from_factory(game, 0, "blue", 1);
        // "yellow" and "red" should now be in the centre, in some order.
        assert.equal(after.center.length, 2);
        assert.ok(after.center.includes("yellow"));
        assert.ok(after.center.includes("red"));
    });
    it("empties the picked factory", function () {
        const game = make_game({
            "factories": [["blue", "blue", "yellow", "red"], [], [], [], []]
        });
        const after = Azul.pick_from_factory(game, 0, "blue", 1);
        assert.deepEqual(after.factories[0], []);
    });
    it("sends overflow to the floor when more tiles picked than fit",
        function () {
            // Pattern line 0 has capacity 1.
            const game = make_game({
                "factories": [["blue", "blue", "blue", "blue"], [], [], [], []]
            });
            const after = Azul.pick_from_factory(game, 0, "blue", 0);
            assert.deepEqual(after.players[0].pattern_lines[0], ["blue"]);
            // 3 blue tiles overflow to the floor.
            assert.equal(after.players[0].floor_line.length, 3);
        });
    it("advances to the next player after a pick", function () {
        const game = make_game();
        const after = Azul.pick_from_factory(game, 0, "blue", 1);
        assert.equal(after.active_player, 1);
    });
    it("rejects picking a colour the factory doesn't contain", function () {
        const game = make_game({
            "factories": [["blue", "blue", "yellow", "red"], [], [], [], []]
        });
        assert.equal(
            Azul.pick_from_factory(game, 0, "black", 0),
            undefined
        );
    });
    it("rejects picking from a factory that's out of range", function () {
        const game = make_game();
        assert.equal(
            Azul.pick_from_factory(game, 99, "blue", 0),
            undefined
        );
    });
    it("rejects an illegal placement (wrong pattern line)", function () {
        const game = make_game({
            "factories": [["blue", "blue", "yellow", "red"], [], [], [], []],
            "players": [
                make_player({"pattern_lines": [[], [], ["red"], [], []]}),
                make_player()
            ]
        });
        // Trying to put blue in line 2 which already has red.
        assert.equal(
            Azul.pick_from_factory(game, 0, "blue", 2),
            undefined
        );
    });
});


// Picking tiles from the centre - including the first-player token.


describe("Picking from the centre", function () {
    it("moves the chosen colour from centre to the pattern line",
        function () {
            const game = make_game({
                "factories": [[], [], [], [], []],
                "center": ["red", "red", "yellow"]
            });
            const after = Azul.pick_from_center(game, "red", 1);
            assert.deepEqual(after.players[0].pattern_lines[1], ["red", "red"]);
            assert.deepEqual(after.center, ["yellow"]);
        });
    it("the first player to pick from the centre takes the first-player token",
        function () {
            const game = make_game({
                "factories": [[], [], [], [], []],
                "center": ["red"],
                "first_token_in_center": true
            });
            const after = Azul.pick_from_center(game, "red", 0);
            assert.equal(after.first_token_in_center, false);
            assert.equal(after.players[0].has_first_token, true);
            // The token also lands on the floor line.
            assert.ok(after.players[0].floor_line.includes("first"));
        });
    it("the second pick from the centre in a round does NOT take the token",
        function () {
            const game = make_game({
                "factories": [[], [], [], [], []],
                "center": ["red", "blue"],
                "first_token_in_center": false,
                "players": [
                    make_player({"name": "A", "has_first_token": true}),
                    make_player({"name": "B"})
                ]
            });
            const after = Azul.pick_from_center(game, "red", 0);
            // First player still has the token; player 0 didn't take it.
            assert.equal(after.players[0].has_first_token, true);
            assert.ok(!after.players[0].floor_line.includes("first"));
        });
    it("rejects picking a colour not in the centre", function () {
        const game = make_game({
            "factories": [[], [], [], [], []],
            "center": ["red"]
        });
        assert.equal(
            Azul.pick_from_center(game, "blue", 0),
            undefined
        );
    });
});


// Detecting round end - all factories and centre empty.


describe("Round end detection", function () {
    it("the phase becomes ROUND_OVER after the last pick of a round",
        function () {
            // Only one factory has one tile left; picking it ends the round.
            const game = make_game({
                "factories": [["blue"], [], [], [], []],
                "center": []
            });
            const after = Azul.pick_from_factory(game, 0, "blue", 0);
            assert.equal(after.phase, Azul.PHASE.ROUND_OVER);
        });
    it("phase stays FACTORY_OFFER while tiles remain", function () {
        const game = make_game({
            "factories": [["blue"], ["red"], [], [], []]
        });
        const after = Azul.pick_from_factory(game, 0, "blue", 0);
        assert.equal(after.phase, Azul.PHASE.FACTORY_OFFER);
    });
});


// Tile placement scoring - the connected-tiles rule.


describe("Tile placement scoring", function () {
    const empty_wall = function () {
        return [
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined]
        ];
    };

    it("a lone tile with no neighbours scores 1", function () {
        const wall = empty_wall();
        wall[2][2] = "red";
        assert.equal(Azul.score_tile_placement(wall, 2, 2), 1);
    });
    it("a tile next to one horizontal neighbour scores 2", function () {
        const wall = empty_wall();
        wall[2][1] = "white";
        wall[2][2] = "blue";
        assert.equal(Azul.score_tile_placement(wall, 2, 2), 2);
    });
    it("a tile in a horizontal run of 3 scores 3", function () {
        const wall = empty_wall();
        wall[0][0] = "blue";
        wall[0][1] = "yellow";
        wall[0][2] = "red";
        assert.equal(Azul.score_tile_placement(wall, 0, 1), 3);
    });
    it("a tile with horizontal AND vertical neighbours scores both runs",
        function () {
            const wall = empty_wall();
            // Horizontal run of 4 including the new tile.
            wall[2][0] = "black";
            wall[2][1] = "white";
            wall[2][2] = "blue";
            wall[2][3] = "yellow";
            // Vertical run of 3 including the new tile.
            wall[1][2] = "yellow";
            wall[3][2] = "white";
            assert.equal(Azul.score_tile_placement(wall, 2, 2), 7);
        });
    it("a tile in a vertical run of 3 scores 3 (no horizontal)",
        function () {
            const wall = empty_wall();
            wall[0][2] = "red";
            wall[1][2] = "black";
            wall[2][2] = "blue";
            assert.equal(Azul.score_tile_placement(wall, 1, 2), 3);
        });
});

// Floor penalty - how many points tiles in the floor line will cost you

describe("Floor penalty", function () {
    it("an empty floor costs nothing", function () {
        assert.equal(Azul.floor_penalty([]), 0);
    });
    it("one floor tile costs -1", function () {
        assert.equal(Azul.floor_penalty(["red"]), -1);
    });
    it("two tiles cost -2 in total", function () {
        assert.equal(Azul.floor_penalty(["red", "blue"]), -2);
    });
    it("a full floor of 7 tiles costs -14", function () {
        const floor = ["a", "b", "c", "d", "e", "f", "g"];
        assert.equal(Azul.floor_penalty(floor), -14);
    });
    it("the first-player token also counts as a floor penalty",
        function () {
            // It's a normal tile for penalty purposes.
            assert.equal(Azul.floor_penalty(["first", "red"]), -2);
        });
});

// Bonus scoring - end-game extras for completed lines and colours.


describe("Bonus scoring", function () {
    it("an empty wall has zero bonus", function () {
        const wall = [
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined]
        ];
        assert.equal(Azul.bonus_score(wall).total, 0);
    });
    it("a completed row scores 2 points", function () {
        const wall = [
            ["blue", "yellow", "red", "black", "white"],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined]
        ];
        const b = Azul.bonus_score(wall);
        assert.equal(b.rows, 1);
        assert.equal(b.total, 2);
    });
    it("a completed column scores 7 points", function () {
        const wall = [
            ["blue", undefined, undefined, undefined, undefined],
            ["white", undefined, undefined, undefined, undefined],
            ["black", undefined, undefined, undefined, undefined],
            ["red", undefined, undefined, undefined, undefined],
            ["yellow", undefined, undefined, undefined, undefined]
        ];
        const b = Azul.bonus_score(wall);
        assert.equal(b.columns, 1);
        assert.equal(b.total, 7);
    });
    it("a full colour set scores 10 points", function () {
        // Place all 5 blue tiles at their assigned positions.
        const wall = [
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined]
        ];
        Azul.COLOURS.forEach(function () {});
        // Blue is at column 0 in row 0, column 1 in row 1, etc.
        Azul.WALL_PATTERN.forEach(function (row, r) {
            const col = row.indexOf("blue");
            wall[r][col] = "blue";
        });
        const b = Azul.bonus_score(wall);
        assert.equal(b.colours, 1);
        assert.equal(b.total, 10);
    });
});

// End of round scoring

describe("End of round", function () {
    it("moves a tile from a complete pattern line onto the wall",
        function () {
            const game = make_game({
                "phase": Azul.PHASE.ROUND_OVER,
                "players": [
                    make_player({
                        "pattern_lines": [["red"], [], [], [], []]
                    }),
                    make_player()
                ]
            });
            const after = Azul.end_round(game);
            // Row 0's red goes at column 2 (WALL_PATTERN[0][2] = "red").
            assert.equal(after.players[0].wall[0][2], "red");
            assert.deepEqual(after.players[0].pattern_lines[0], []);
        });
    it("scores 1 point for a lone tile placement", function () {
        const game = make_game({
            "phase": Azul.PHASE.ROUND_OVER,
            "players": [
                make_player({"pattern_lines": [["red"], [], [], [], []]}),
                make_player()
            ]
        });
        const after = Azul.end_round(game);
        assert.equal(after.players[0].score, 1);
    });
    it("ignores incomplete pattern lines", function () {
        const game = make_game({
            "phase": Azul.PHASE.ROUND_OVER,
            "players": [
                make_player({"pattern_lines": [[], [], ["red"], [], []]}),
                make_player()
            ]
        });
        const after = Azul.end_round(game);
        // Pattern line 2 has only 1 of 3 needed - not moved.
        assert.deepEqual(after.players[0].pattern_lines[2], ["red"]);
        assert.equal(after.players[0].score, 0);
    });
    it("applies floor penalty and clears the floor", function () {
        const game = make_game({
            "phase": Azul.PHASE.ROUND_OVER,
            "players": [
                make_player({"floor_line": ["red", "blue"]}),
                make_player()
            ]
        });
        const after = Azul.end_round(game);
        // Penalty is -2 but the score can't go below 0.
        assert.equal(after.players[0].score, 0);
        assert.deepEqual(after.players[0].floor_line, []);
    });
    it("never lets a score drop below zero", function () {
        const game = make_game({
            "phase": Azul.PHASE.ROUND_OVER,
            "players": [
                make_player({
                    "score": 2,
                    "floor_line": ["a", "b", "c", "d", "e", "f", "g"]
                }),
                make_player()
            ]
        });
        const after = Azul.end_round(game);
        assert.equal(after.players[0].score, 0);
    });
    it("rejects being called outside the ROUND_OVER phase", function () {
        const game = make_game(); // FACTORY_OFFER
        assert.equal(Azul.end_round(game), undefined);
    });
});

// ---------------------------------------------------------------------
// End of game - completed row triggers final scoring.
// ---------------------------------------------------------------------

describe("End of game", function () {
    it("ends when a player completes a horizontal row of 5", function () {
        // Set up a player with a wall that becomes complete after the
        // round's pattern lines are resolved.
        const wall_4_of_5 = [
            ["blue", "yellow", "red", "black", undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined]
        ];
        const game = make_game({
            "phase": Azul.PHASE.ROUND_OVER,
            "players": [
                make_player({
                    "wall": wall_4_of_5,
                    // Pattern line 0 has the white tile that completes the row.
                    "pattern_lines": [["white"], [], [], [], []]
                }),
                make_player()
            ]
        });
        const after = Azul.end_round(game);
        assert.equal(after.phase, Azul.PHASE.GAME_OVER);
    });
    it("adds bonus points when the game ends", function () {
        // Player completes row 0 of all 5 colours. The complete row earns
        // 2 bonus points; we check the score increased by 2 over what the
        // last placement would otherwise give.
        const wall_4_of_5 = [
            ["blue", "yellow", "red", "black", undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined],
            [undefined, undefined, undefined, undefined, undefined]
        ];
        const game = make_game({
            "phase": Azul.PHASE.ROUND_OVER,
            "players": [
                make_player({
                    "wall": wall_4_of_5,
                    "pattern_lines": [["white"], [], [], [], []]
                }),
                make_player()
            ]
        });
        const after = Azul.end_round(game);
        // Placing white at (0,4) makes a horizontal run of 5 - scores 5.
        // Plus 2 bonus for the completed row.
        assert.equal(after.players[0].score, 7);
    });
    it("winners returns undefined while the game is still going",
        function () {
            const game = Azul.new_game(["A", "B"]);
            assert.equal(Azul.winners(game), undefined);
        });
    it("winners returns the highest-scoring player at game end",
        function () {
            const game = make_game({
                "phase": Azul.PHASE.GAME_OVER,
                "players": [
                    make_player({"name": "A", "score": 10}),
                    make_player({"name": "B", "score": 30}),
                    make_player({"name": "C", "score": 20})
                ]
            });
            assert.deepEqual(Azul.winners(game), [1]);
        });
});

// ---------------------------------------------------------------------
// Has-completed-row check - exposed for UI use.
// ---------------------------------------------------------------------

describe("Has completed row", function () {
    it("is false when no row is complete", function () {
        const player = make_player();
        assert.equal(Azul.has_completed_row(player), false);
    });
    it("is true when any row is complete", function () {
        const player = make_player({
            "wall": [
                ["blue", "yellow", "red", "black", "white"],
                [undefined, undefined, undefined, undefined, undefined],
                [undefined, undefined, undefined, undefined, undefined],
                [undefined, undefined, undefined, undefined, undefined],
                [undefined, undefined, undefined, undefined, undefined]
            ]
        });
        assert.equal(Azul.has_completed_row(player), true);
    });
});

// ---------------------------------------------------------------------
// Tile conservation - tiles must not appear or disappear from the system.
// ---------------------------------------------------------------------

describe("Tile conservation", function () {
    const count_tiles = function (game) {
        let total = game.bag.length + game.box.length + game.center.length;
        total += game.factories.reduce(function (sum, f) {
            return sum + f.length;
        }, 0);
        game.players.forEach(function (p) {
            total += p.pattern_lines.reduce(function (sum, line) {
                return sum + line.length;
            }, 0);
            total += p.wall.flat().filter(function (c) {
                return c !== undefined;
            }).length;
            // Exclude the first-player token because it isn't a tile;
            // it's tracked separately via has_first_token.
            total += p.floor_line.filter(function (t) {
                return t !== "first";
            }).length;
        });
        return total;
    };

    it("conserves the total tile count when picking from a factory",
        function () {
            const game = make_game({
                "factories": [["blue", "blue", "yellow", "red"],
                 [], [], [], []],
                "bag": Array(80).fill("blue")
            });
            const before = count_tiles(game);
            const after = Azul.pick_from_factory(game, 0, "blue", 1);
            assert.equal(count_tiles(after), before);
        });

    it("conserves the total tile count across end_round", function () {
        const game = make_game({
            "phase": Azul.PHASE.ROUND_OVER,
            "box": ["red"],
            "players": [
                make_player({
                    "pattern_lines": [["red"], ["blue", "blue"], [], [], []],
                    "floor_line": ["yellow"]
                }),
                make_player()
            ]
        });
        const before = count_tiles(game);
        const after = Azul.end_round(game);
        assert.equal(count_tiles(after), before);
    });
});
