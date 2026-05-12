import R from "./ramda.js";

const TILE_COLORS = ["blue", "yellow", "red", "black", "white"];

const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);

const cloneState = function (state) {
    return JSON.parse(JSON.stringify(state));
};

const placeTilesInPatternLine = function (player, tiles, patternLineIndex) {
    if (patternLineIndex === 5) {
        player.floorLine = player.floorLine.concat(tiles);
        return;
    }

    const line = player.patternLines[patternLineIndex];
    const maxCapacity = patternLineIndex + 1;
    const combined = line.concat(tiles);
    
    if (combined.length > maxCapacity) {
        player.patternLines[patternLineIndex] = combined.slice(0, maxCapacity);
        const overflow = combined.slice(maxCapacity);
        player.floorLine = player.floorLine.concat(overflow);
    } else {
        player.patternLines[patternLineIndex] = combined;
    }
};

const isLegalPlacement = function (player, color, patternLineIndex) {
    if (patternLineIndex === 5) {
        return true; 
    }

    const line = player.patternLines[patternLineIndex];
    const wallRow = player.wall[patternLineIndex];

    if (line.length > 0 && line[0] !== color) {
        return false;
    }

    if (wallRow.includes(color)) {
        return false;
    }

    return true;
};

export const createGame = function (numPlayers) {
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

    const initialBag = shuffle(
        R.flatten(TILE_COLORS.map((color) => R.repeat(color, 20)))
    );

    const numFactories = (numPlayers * 2) + 1;
    let currentBag = [...initialBag];
    
    const factories = R.range(0, numFactories).map(() => {
        const factoryTiles = R.take(4, currentBag);
        currentBag = R.drop(4, currentBag);
        return factoryTiles;
    });

    return {
        players: players,
        activePlayerIndex: 0,
        factories: factories,
        center: ["first-player-token"],
        bag: currentBag,
        box: [],
        phase: "FACTORY_OFFER"
    };
};

export const pickFromFactory = function (state, factoryIndex, color, patternLineIndex) {
    const activePlayer = state.players[state.activePlayerIndex];
    
    if (!isLegalPlacement(activePlayer, color, patternLineIndex)) {
        throw new Error("Illegal move! You cannot place that color there.");
    }

    const newState = cloneState(state);
    const factory = newState.factories[factoryIndex];
    
    const pickedTiles = factory.filter((t) => t === color);
    const remainingTiles = factory.filter((t) => t !== color);
    
    newState.factories[factoryIndex] = [];
    newState.center = newState.center.concat(remainingTiles);
    
    const newActivePlayer = newState.players[newState.activePlayerIndex];
    placeTilesInPatternLine(newActivePlayer, pickedTiles, patternLineIndex);
    
    newState.activePlayerIndex = (newState.activePlayerIndex + 1) % newState.players.length;
    
    return newState;
};

// --- NEW FUNCTION: Picking from the Center ---
export const pickFromCenter = function (state, color, patternLineIndex) {
    const activePlayer = state.players[state.activePlayerIndex];
    
    if (!isLegalPlacement(activePlayer, color, patternLineIndex)) {
        throw new Error("Illegal move! You cannot place that color there.");
    }

    const newState = cloneState(state);
    const newActivePlayer = newState.players[newState.activePlayerIndex];
    
    // 1. Check if the first player token is in the center
    if (newState.center.includes("first-player-token")) {
        // Remove it from center
        newState.center = newState.center.filter((t) => t !== "first-player-token");
        // Put it in the player's floor line
        newActivePlayer.floorLine.push("first-player-token");
        newActivePlayer.hasFirstPlayerToken = true;
    }

    // 2. Take chosen colors
    const pickedTiles = newState.center.filter((t) => t === color);
    const remainingTiles = newState.center.filter((t) => t !== color);
    
    newState.center = remainingTiles;
    
    // 3. Place them in the pattern line
    placeTilesInPatternLine(newActivePlayer, pickedTiles, patternLineIndex);
    
    // 4. Advance turn
    newState.activePlayerIndex = (newState.activePlayerIndex + 1) % newState.players.length;
    
    return newState;
};