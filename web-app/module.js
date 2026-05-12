import R from "./ramda.js";

const TILE_COLORS = ["blue", "yellow", "red", "black", "white"];
const FLOOR_PENALTIES = [-1, -1, -2, -2, -2, -3, -3];

// Azul's specific wall pattern mapping
export const WALL_PATTERN = [
    ["blue", "yellow", "red", "black", "white"],
    ["white", "blue", "yellow", "red", "black"],
    ["black", "white", "blue", "yellow", "red"],
    ["red", "black", "white", "blue", "yellow"],
    ["yellow", "red", "black", "white", "blue"]
];

const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);
const cloneState = (state) => JSON.parse(JSON.stringify(state));

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
    if (patternLineIndex === 5) { return true; }
    const line = player.patternLines[patternLineIndex];
    const wallRow = player.wall[patternLineIndex];
    if (line.length > 0 && line[0] !== color) { return false; }
    if (wallRow.includes(color)) { return false; }
    return true;
};

// --- NEW: Calculate score for placing a tile ---
const calculateTileScore = function (wall, row, col) {
    let hScore = 1; let vScore = 1;
    let c = col - 1; while (c >= 0 && wall[row][c]) { hScore += 1; c -= 1; }
    c = col + 1; while (c <= 4 && wall[row][c]) { hScore += 1; c += 1; }
    let r = row - 1; while (r >= 0 && wall[r][col]) { vScore += 1; r -= 1; }
    r = row + 1; while (r <= 4 && wall[r][col]) { vScore += 1; r += 1; }
    
    if (hScore === 1 && vScore === 1) { return 1; }
    let total = 0;
    if (hScore > 1) { total += hScore; }
    if (vScore > 1) { total += vScore; }
    return total;
};

// --- NEW: Process the end of a round ---
const processEndOfRound = function (state) {
    const newState = cloneState(state);
    
    newState.players.forEach((player, pIndex) => {
        // 1. Score Full Pattern Lines
        for (let r = 0; r < 5; r += 1) {
            const line = player.patternLines[r];
            if (line.length === r + 1) {
                const color = line[0];
                const col = WALL_PATTERN[r].indexOf(color);
                
                player.wall[r][col] = color; // Move 1 to wall
                player.score += calculateTileScore(player.wall, r, col); // Score it
                
                const discarded = line.slice(1); // Rest go to box
                newState.box = newState.box.concat(discarded);
                player.patternLines[r] = []; // Clear the line
            }
        }

        // 2. Process Floor Line Penalties
        let penalty = 0;
        player.floorLine.forEach((tile, index) => {
            if (index < FLOOR_PENALTIES.length) {
                penalty += FLOOR_PENALTIES[index];
            } else {
                penalty -= 3;
            }
            
            if (tile === "first-player-token") {
                newState.activePlayerIndex = pIndex; // They go first next round
            } else {
                newState.box.push(tile); // Tile goes to discard box
            }
        });
        
        player.score += penalty;
        if (player.score < 0) { player.score = 0; } // Score can't go below 0
        player.floorLine = [];
    });

    // 3. Setup Next Round (Refill Factories)
    newState.center = ["first-player-token"];
    newState.factories.forEach((factory) => {
        while (factory.length < 4) {
            if (newState.bag.length === 0) {
                if (newState.box.length === 0) { break; } // Out of tiles completely!
                newState.bag = shuffle(newState.box); // SHUFFLE BOX INTO BAG
                newState.box = [];
            }
            factory.push(newState.bag.pop());
        }
    });

    return newState;
};

const checkRoundEnd = function(state) {
    const factoriesEmpty = state.factories.every((f) => f.length === 0);
    const centerEmpty = state.center.length === 0;
    if (factoriesEmpty && centerEmpty) {
        return processEndOfRound(state);
    }
    return state;
};

export const createGame = function (numPlayers) {
    const players = R.range(0, numPlayers).map(function () {
        return { score: 0, patternLines: [[], [], [], [], []], wall: [[null, null, null, null, null], [null, null, null, null, null], [null, null, null, null, null], [null, null, null, null, null], [null, null, null, null, null]], floorLine: [] };
    });
    const initialBag = shuffle(R.flatten(TILE_COLORS.map((c) => R.repeat(c, 20))));
    const numFactories = (numPlayers * 2) + 1;
    let currentBag = [...initialBag];
    
    const factories = R.range(0, numFactories).map(() => {
        const factoryTiles = R.take(4, currentBag);
        currentBag = R.drop(4, currentBag);
        return factoryTiles;
    });

    return { players: players, activePlayerIndex: 0, factories: factories, center: ["first-player-token"], bag: currentBag, box: [], phase: "FACTORY_OFFER" };
};

export const pickFromFactory = function (state, factoryIndex, color, patternLineIndex) {
    const activePlayer = state.players[state.activePlayerIndex];
    if (!isLegalPlacement(activePlayer, color, patternLineIndex)) { throw new Error("Illegal move! You cannot place that color there."); }
    const newState = cloneState(state);
    const factory = newState.factories[factoryIndex];
    const pickedTiles = factory.filter((t) => t === color);
    const remainingTiles = factory.filter((t) => t !== color);
    newState.factories[factoryIndex] = [];
    newState.center = newState.center.concat(remainingTiles);
    placeTilesInPatternLine(newState.players[newState.activePlayerIndex], pickedTiles, patternLineIndex);
    newState.activePlayerIndex = (newState.activePlayerIndex + 1) % newState.players.length;
    return checkRoundEnd(newState);
};

export const pickFromCenter = function (state, color, patternLineIndex) {
    const activePlayer = state.players[state.activePlayerIndex];
    if (!isLegalPlacement(activePlayer, color, patternLineIndex)) { throw new Error("Illegal move!"); }
    const newState = cloneState(state);
    const newActivePlayer = newState.players[newState.activePlayerIndex];
    
    if (newState.center.includes("first-player-token")) {
        newState.center = newState.center.filter((t) => t !== "first-player-token");
        newActivePlayer.floorLine.push("first-player-token");
    }

    const pickedTiles = newState.center.filter((t) => t === color);
    newState.center = newState.center.filter((t) => t !== color);
    placeTilesInPatternLine(newActivePlayer, pickedTiles, patternLineIndex);
    newState.activePlayerIndex = (newState.activePlayerIndex + 1) % newState.players.length;
    return checkRoundEnd(newState);
};