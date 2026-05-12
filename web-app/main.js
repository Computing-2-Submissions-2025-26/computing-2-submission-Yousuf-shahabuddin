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

// --- NEW: Handle Center Clicks ---
const handleCenterClick = function (color) {
    selectedPick = { source: "center", color: color };
    updateUI();
};

const handlePatternLineClick = function (patternLineIndex) {
    if (!selectedPick) { return; }
    
    try {
        if (selectedPick.source === "factory") {
            gameState = Azul.pickFromFactory(
                gameState, 
                selectedPick.index, 
                selectedPick.color, 
                patternLineIndex
            );
        } else if (selectedPick.source === "center") {
            gameState = Azul.pickFromCenter(
                gameState, 
                selectedPick.color, 
                patternLineIndex
            );
        }
        
        selectedPick = null;
        updateUI();
    } catch (error) {
        alert(error.message); 
        selectedPick = null;
        updateUI();
    }
};

const createTileElement = function (color) {
    const img = document.createElement("img");
    
    if (color === "first-player-token") {
        img.src = "assets/first-player-token.svg"; 
        img.alt = "First Player Token";
        img.style.backgroundColor = "purple"; // Fallback color
    } else {
        img.src = "assets/tile-" + color + ".svg"; 
        img.alt = color + " tile";
        img.style.backgroundColor = color; // Fallback color
    }
    
    img.style.width = "30px";
    img.style.height = "30px";
    img.style.margin = "5px";
    img.style.display = "inline-block";
    
    if (color === "white") {
        img.style.border = "1px solid black";
    }
    return img;
};

const createEmptySlot = function () {
    const div = document.createElement("div");
    div.style.width = "30px";
    div.style.height = "30px";
    div.style.margin = "5px";
    div.style.display = "inline-block";
    div.style.border = "1px dashed #ccc";
    return div;
};

const drawPlayerBoard = function (playerIndex, playerState) {
    const linesContainer = document.getElementById("p" + (playerIndex + 1) + "-pattern-lines");
    linesContainer.innerHTML = "";

    playerState.patternLines.forEach((line, rowIndex) => {
        const rowDiv = document.createElement("div");
        rowDiv.className = "pattern-line-row";
        
        const capacity = rowIndex + 1;
        const emptyCount = capacity - line.length;
        
        for (let i = 0; i < emptyCount; i += 1) {
            rowDiv.appendChild(createEmptySlot());
        }
        line.forEach((color) => {
            rowDiv.appendChild(createTileElement(color));
        });

        if (gameState.activePlayerIndex === playerIndex) {
            rowDiv.onclick = function () {
                handlePatternLineClick(rowIndex);
            };
        }
        linesContainer.appendChild(rowDiv);
    });

    const floorDiv = document.getElementById("p" + (playerIndex + 1) + "-floor-line");
    floorDiv.innerHTML = "<span>Floor Line: </span>";
    playerState.floorLine.forEach((color) => {
        floorDiv.appendChild(createTileElement(color));
    });

    if (gameState.activePlayerIndex === playerIndex) {
        floorDiv.onclick = function () {
            handlePatternLineClick(5);
        };
    }
};

const updateUI = function () {
    const turnIndicator = document.getElementById("turn-indicator");
    const p1Board = document.getElementById("player-1-board");
    const p2Board = document.getElementById("player-2-board");

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

    // 1. Draw Factories
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
                tileImg.style.borderRadius = "5px";
            }

            tileImg.onclick = function () {
                if (gameState.activePlayerIndex === 0 || gameState.activePlayerIndex === 1) {
                    handleFactoryClick(index, tileColor);
                }
            };
            
            factoryDiv.appendChild(tileImg);
        });
        factoriesContainer.appendChild(factoryDiv);
    });

    // 2. Draw Center (NEW CODE)
    const centerContainer = document.getElementById("center-container");
    centerContainer.innerHTML = "<h3>Center</h3>";
    const centerDiv = document.createElement("div");
    centerDiv.style.border = "2px dashed #999";
    centerDiv.style.padding = "20px";
    centerDiv.style.minHeight = "40px";
    centerDiv.style.margin = "10px auto";
    centerDiv.style.maxWidth = "600px";

    gameState.center.forEach((tileColor) => {
        const tileImg = createTileElement(tileColor);
        
        // You cannot click the first player token directly
        if (tileColor !== "first-player-token") {
            tileImg.style.cursor = "pointer";
            
            if (selectedPick && selectedPick.source === "center" && selectedPick.color === tileColor) {
                tileImg.style.border = "3px solid #00ff00"; 
                tileImg.style.borderRadius = "5px";
            }

            tileImg.onclick = function () {
                if (gameState.activePlayerIndex === 0 || gameState.activePlayerIndex === 1) {
                    handleCenterClick(tileColor);
                }
            };
        }
        
        centerDiv.appendChild(tileImg);
    });
    centerContainer.appendChild(centerDiv);

    // 3. Draw Player Boards
    drawPlayerBoard(0, gameState.players[0]);
    drawPlayerBoard(1, gameState.players[1]);
};