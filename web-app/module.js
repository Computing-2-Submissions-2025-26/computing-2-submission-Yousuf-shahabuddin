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

const handlePatternLineClick = function (patternLineIndex) {
    if (!selectedPick) { return; }
    
    if (selectedPick.source === "factory") {
        gameState = Azul.pickFromFactory(
            gameState, 
            selectedPick.index, 
            selectedPick.color, 
            patternLineIndex
        );
    }
    
    selectedPick = null;
    updateUI();
};

const createTileElement = function (color) {
    const tileSpan = document.createElement("span");
    tileSpan.style.display = "inline-block";
    tileSpan.style.width = "30px";
    tileSpan.style.height = "30px";
    tileSpan.style.margin = "5px";
    tileSpan.style.backgroundColor = color;
    if (color === "white") {
        tileSpan.style.border = "1px solid black";
    }
    return tileSpan;
};

const drawPlayerBoard = function (playerIndex, playerState) {
    const linesContainer = document.getElementById(`p${playerIndex + 1}-pattern-lines`);
    linesContainer.innerHTML = "";

    // Draw Pattern Lines
    playerState.patternLines.forEach((line, rowIndex) => {
        const rowDiv = document.createElement("div");
        rowDiv.className = "pattern-line-row";
        
        // Draw empty slots and filled tiles right-aligned
        const capacity = rowIndex + 1;
        const emptyCount = capacity - line.length;
        
        for (let i = 0; i < emptyCount; i += 1) {
            const emptySpan = createTileElement("lightgray");
            rowDiv.appendChild(emptySpan);
        }
        line.forEach((color) => {
            const filledSpan = createTileElement(color);
            rowDiv.appendChild(filledSpan);
        });

        // Click to drop tiles here (only if it is this player's turn)
        if (gameState.activePlayerIndex === playerIndex) {
            rowDiv.onclick = function () {
                handlePatternLineClick(rowIndex);
            };
        }
        linesContainer.appendChild(rowDiv);
    });

    // Draw Floor Line
    const floorDiv = document.getElementById(`p${playerIndex + 1}-floor-line`);
    floorDiv.innerHTML = "Floor Line: ";
    playerState.floorLine.forEach((color) => {
        const span = createTileElement(color);
        floorDiv.appendChild(span);
    });

    if (gameState.activePlayerIndex === playerIndex) {
        floorDiv.onclick = function () {
            handlePatternLineClick(5); // 5 represents floor line
        };
    }
};

const updateUI = function () {
    const turnIndicator = document.getElementById("turn-indicator");
    const p1Board = document.getElementById("player-1-board");
    const p2Board = document.getElementById("player-2-board");

    // Update Turn Indicator
    if (gameState.activePlayerIndex === 0) {
        turnIndicator.textContent = "Player 1's Turn";
        turnIndicator.className = "player-1-turn";
        p1Board.classList.add("active-board");
        p2Board.classList.remove("active-board");
    } else {
        turnIndicator.textContent = "Player 2's Turn";
        turnIndicator.className = "player-2-turn";
        p2Board.classList.add("active-board");
        p1Board.classList.remove("active-board");
    }

    // Draw Factories
    const factoriesContainer = document.getElementById("factories-container");
    factoriesContainer.innerHTML = "<h3>Factories</h3>"; 

    gameState.factories.forEach((factory, index) => {
        if (factory.length === 0) { return; }

        const factoryDiv = document.createElement("div");
        factoryDiv.className = "factory";
        factoryDiv.style.border = "2px solid #ccc";
        factoryDiv.style.borderRadius = "50%";
        factoryDiv.style.padding = "20px";
        factoryDiv.style.margin = "10px";
        factoryDiv.style.display = "inline-block";

        factory.forEach((tileColor) => {
            const tileSpan = createTileElement(tileColor);
            tileSpan.style.cursor = "pointer";

            if (selectedPick && selectedPick.index === index && selectedPick.color === tileColor) {
                tileSpan.style.border = "3px solid #00ff00";
            }

            tileSpan.onclick = function () {
                if (gameState.activePlayerIndex === 0 || gameState.activePlayerIndex === 1) { // ensure active
                    handleFactoryClick(index, tileColor);
                }
            };
            
            factoryDiv.appendChild(tileSpan);
        });
        factoriesContainer.appendChild(factoryDiv);
    });

    // Draw Boards
    drawPlayerBoard(0, gameState.players[0]);
    drawPlayerBoard(1, gameState.players[1]);
};