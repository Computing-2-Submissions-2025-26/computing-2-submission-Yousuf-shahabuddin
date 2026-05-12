import R from "./ramda.js";

/**
 * Initializes a new game of Azul.
 * @param {number} numPlayers - The number of players (2 to 4).
 * @returns {GameState} The initial game state.
 */
export const createGame = function (numPlayers) {
    // 1. Setup empty players
    const players = R.range(0, numPlayers).map(function () {
        return {
            score: 0,
            patternLines: [[], [], [], [], []],
            wall: [
                [null, null, null, null, null],
                [null, null, null, null, null],
                [null, null, null, null, null],
                [null, null, null, null, null],
                [null, null, null, null, null]
            ],
            floorLine: []
        };
    });

    // 2. Return the initial state
    return {
        players: players,
        activePlayerIndex: 0, // Player 1 starts
        factories: [], // We will fill these later
        center: ['first-player-token'],
        phase: 'FACTORY_OFFER'
    };
};

// We will add the other functions (pickFromFactory, etc.) here next!