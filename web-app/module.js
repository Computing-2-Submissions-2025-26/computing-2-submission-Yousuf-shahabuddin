import R from "./ramda.js";

const TILE_COLORS = ["blue", "yellow", "red", "black", "white"];

/**
 * Shuffles an array randomly.
 * (Note: Using Math.random() is fine here for our game logic).
 */
const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);

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
            floorLine: [],
            hasFirstPlayerToken: false
        };
    });

    // 2. Create the Bag with 100 tiles (20 of each color)
    const initialBag = shuffle(
        R.flatten(TILE_COLORS.map(color => R.repeat(color, 20)))
    );

    // 3. Determine number of factories (5 for 2 players, 7 for 3, 9 for 4)
    const numFactories = (numPlayers * 2) + 1;

    // 4. Deal 4 tiles to each factory, removing them from the bag
    let currentBag = [...initialBag];
    const factories = R.range(0, numFactories).map(() => {
        const factoryTiles = R.take(4, currentBag);
        currentBag = R.drop(4, currentBag);
        return factoryTiles;
    });

    // 5. Return the full initial state
    return {
        players: players,
        activePlayerIndex: 0, // Player 1 starts
        factories: factories, // Now populated with 4 tiles each!
        center: ['first-player-token'],
        bag: currentBag, // The remaining tiles
        box: [], // Empty discard lid
        phase: "FACTORY_OFFER"
    };
};