import * as Azul from "./Module.js";

let gameState;
let selectedPick = null;

const modal = document.getElementById("instruction-modal");
const startBtn = document.getElementById("start-game-btn");

startBtn.onclick = function () {
    modal.classList.add("hidden");
    startGame(2);
};

const startGame = function (numPlayers) {
    gameState = Azul.createGame(numPlayers);
    updateUI();
};

const handleFactoryClick = function (factoryIndex, color) {
    selectedPick = { source: "factory", index: factoryIndex, color: color };
    updateUI();
};

const handleCenterClick = function (color) {
    selectedPick = { source: "center", color: color };
    updateUI();
};

const handlePatternLineClick = function (patternLineIndex) {
    if (!selectedPick) { return; }
    try {
        if (selectedPick.source === "factory") {
            gameState = Azul.pickFromFactory(gameState, selectedPick.index, selectedPick.color, patternLineIndex);
        } else if (selectedPick.source === "center") {
            gameState = Azul.pickFromCenter(gameState, selectedPick.color, patternLineIndex);
        }
        selectedPick = null;
        updateUI();
    } catch (error) {
        alert(error.message);
        selectedPick = null;
        updateUI();
    }
};

const createTileElement = function (color, isFaded = false) {
    const img = document.createElement("img");
    if (color === "first-player-token") {
        img.src = "assets/first-player-token.svg"; 
        img.alt = "Token";
        img.style.backgroundColor = "purple"; 
    } else {
        img.src = "assets/tile-" + color + ".svg"; 
        img.alt = color + " tile";
        img.style.backgroundColor = color; 
    }
    img.style.width = "30px"; img.style.height = "30px"; img.style.margin = "2px"; img.style.display = "inline-block";
    if (color === "white") { img.style.border = "1px solid black"; }
    if (isFaded) { img.style.opacity = "0.2"; } // For empty wall slots
    return img;
};

const createEmptySlot = function () {
    const div = document.createElement("div");
    div.style.width = "30px"; div.style.height = "30px"; div.style.margin = "2px";
    div.style.display = "inline-block"; div.style.border = "1px dashed #ccc";
    return div;
};

const drawPlayerBoard = function (playerIndex, playerState) {
    // 1. Update Score
    document.getElementById("p" + (playerIndex + 1) + "-score").textContent = "Score: " + playerState.score;

    // 2. Draw Pattern Lines
    const linesContainer = document.getElementById("p" + (playerIndex + 1) + "-pattern-lines");
    linesContainer.innerHTML = "";
    playerState.patternLines.forEach((line, rowIndex) => {
        const rowDiv = document.createElement("div");
        rowDiv.className = "pattern-line-row";
        const emptyCount = (rowIndex + 1) - line.length;
        for (let i = 0; i < emptyCount; i += 1) { rowDiv.appendChild(createEmptySlot()); }
        line.forEach((color) => { rowDiv.appendChild(createTileElement(color)); });
        if (gameState.activePlayerIndex === playerIndex) {
            rowDiv.onclick = function () { handlePatternLineClick(rowIndex); };
        }
        linesContainer.appendChild(rowDiv);
    });

    // 3. Draw Wall (NEW!)
    const wallContainer = document.getElementById("p" + (playerIndex + 1) + "-wall");
    wallContainer.innerHTML = "";
    for (let r = 0; r < 5; r += 1) {
        const wallRowDiv = document.createElement("div");
        wallRowDiv.className = "wall-row";
        for (let c = 0; c < 5; c += 1) {
            const placedColor = playerState.wall[r][c];
            if (placedColor) {
                wallRowDiv.appendChild(createTileElement(placedColor));
            } else {
                // Show the faded background pattern color
                const patternColor = Azul.WALL_PATTERN[r][c];
                wallRowDiv.appendChild(createTileElement(patternColor, true));
            }
        }
        wallContainer.appendChild(wallRowDiv);
    }

    // 4. Draw Floor Line
    const floorDiv = document.getElementById("p" + (playerIndex + 1) + "-floor-line");
    floorDiv.innerHTML = "<span>Floor Line: </span>";
    playerState.floorLine.forEach((color) => { floorDiv.appendChild(createTileElement(color)); });
    if (gameState.activePlayerIndex === playerIndex) {
        floorDiv.onclick = function () { handlePatternLineClick(5); };
    }
};

const updateUI = function () {
    const turnIndicator = document.getElementById("turn-indicator");
    const p1Board = document.getElementById("player-1-board");
    const p2Board = document.getElementById("player-2-board");

    if (gameState.activePlayerIndex === 0) {
        turnIndicator.textContent = "Player 1's Turn"; turnIndicator.className = "player-1-turn";
        p1Board.classList.add("active-board"); p2Board.classList.remove("active-board");
    } else {
        turnIndicator.textContent = "Player 2's Turn"; turnIndicator.className = "player-2-turn";
        p2Board.classList.add("active-board"); p1Board.classList.remove("active-board");
    }

    const factoriesContainer = document.getElementById("factories-container");
    factoriesContainer.innerHTML = "<h3>Factories</h3>"; 
    gameState.factories.forEach((factory, index) => {
        if (factory.length === 0) { return; }
        const factoryDiv = document.createElement("div");
        factoryDiv.className = "factory";
        factory.forEach((tileColor) => {
            const tileImg = createTileElement(tileColor);
            tileImg.style.cursor = "pointer";
            if (selectedPick && selectedPick.source === "factory" && selectedPick.index === index && selectedPick.color === tileColor) {
                tileImg.style.border = "3px solid #00ff00"; 
            }
            tileImg.onclick = function () {
                if (gameState.activePlayerIndex === 0 || gameState.activePlayerIndex === 1) { handleFactoryClick(index, tileColor); }
            };
            factoryDiv.appendChild(tileImg);
        });
        factoriesContainer.appendChild(factoryDiv);
    });

    const centerContainer = document.getElementById("center-container");
    centerContainer.innerHTML = "<h3>Center</h3>";
    const centerDiv = document.createElement("div");
    centerDiv.style.border = "2px dashed #999"; centerDiv.style.padding = "20px"; centerDiv.style.minHeight = "40px";
    gameState.center.forEach((tileColor) => {
        const tileImg = createTileElement(tileColor);
        if (tileColor !== "first-player-token") {
            tileImg.style.cursor = "pointer";
            if (selectedPick && selectedPick.source === "center" && selectedPick.color === tileColor) { tileImg.style.border = "3px solid #00ff00"; }
            tileImg.onclick = function () {
                if (gameState.activePlayerIndex === 0 || gameState.activePlayerIndex === 1) { handleCenterClick(tileColor); }
            };
        }
        centerDiv.appendChild(tileImg);
    });
    centerContainer.appendChild(centerDiv);

    drawPlayerBoard(0, gameState.players[0]);
    drawPlayerBoard(1, gameState.players[1]);
};