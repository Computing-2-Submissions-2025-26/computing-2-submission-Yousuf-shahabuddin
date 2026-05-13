import * as Azul from "./Module.js";

let gameState;
let selectedPick = null;

const modal = document.getElementById("instruction-modal");
const startBtn = document.getElementById("start-game-btn");

const startGame = function (numPlayers) {
    gameState = Azul.createGame(numPlayers);
    updateUI(); // eslint-disable-line no-use-before-define
};

startBtn.onclick = function () {
    modal.classList.add("hidden");
    startGame(2);
};

const handleFactoryClick = function (factoryIndex, color) {
    selectedPick = {
        source: "factory",
        index: factoryIndex,
        color: color
    };
    updateUI(); // eslint-disable-line no-use-before-define
};

const handleCenterClick = function (color) {
    selectedPick = {
        source: "center",
        color: color
    };
    updateUI(); // eslint-disable-line no-use-before-define
};

const handlePatternLineClick = function (patternLineIndex) {
    if (!selectedPick) {
        return;
    }

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
        updateUI(); // eslint-disable-line no-use-before-define
    } catch (error) {
        alert(error.message);
        selectedPick = null;
        updateUI(); // eslint-disable-line no-use-before-define
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

    img.style.width = "30px";
    img.style.height = "30px";
    img.style.margin = "2px";
    img.style.display = "inline-block";

    if (color === "white") {
        img.style.border = "1px solid black";
    }
    if (isFaded) {
        img.style.opacity = "0.2";
    }
    return img;
};

const createEmptySlot = function () {
    const div = document.createElement("div");
    div.style.width = "30px";
    div.style.height = "30px";
    div.style.margin = "2px";
    div.style.display = "inline-block";
    div.style.border = "1px dashed #ccc";
    return div;
};

const drawPlayerBoard = function (playerIndex, playerState) {
    const scoreId = "p" + (playerIndex + 1) + "-score";
    const scoreElement = document.getElementById(scoreId);
    scoreElement.textContent = "Score: " + playerState.score;

    const linesId = "p" + (playerIndex + 1) + "-pattern-lines";
    const linesContainer = document.getElementById(linesId);
    linesContainer.innerHTML = "";

    playerState.patternLines.forEach(function (line, rowIndex) {
        const rowDiv = document.createElement("div");
        rowDiv.className = "pattern-line-row";

        const emptyCount = (rowIndex + 1) - line.length;
        let i = 0;

        while (i < emptyCount) {
            rowDiv.appendChild(createEmptySlot());
            i += 1;
        }

        line.forEach(function (color) {
            rowDiv.appendChild(createTileElement(color));
        });

        if (gameState.activePlayerIndex === playerIndex) {
            rowDiv.onclick = function () {
                handlePatternLineClick(rowIndex);
            };
        }
        linesContainer.appendChild(rowDiv);
    });

    const wallId = "p" + (playerIndex + 1) + "-wall";
    const wallContainer = document.getElementById(wallId);
    wallContainer.innerHTML = "";

    [0, 1, 2, 3, 4].forEach(function (r) {
        const wallRowDiv = document.createElement("div");
        wallRowDiv.className = "wall-row";

        [0, 1, 2, 3, 4].forEach(function (c) {
            const placedColor = playerState.wall[r][c];
            if (placedColor) {
                wallRowDiv.appendChild(createTileElement(placedColor));
            } else {
                const patternColor = Azul.WALL_PATTERN[r][c];
                wallRowDiv.appendChild(createTileElement(patternColor, true));
            }
        });
        wallContainer.appendChild(wallRowDiv);
    });

    const floorId = "p" + (playerIndex + 1) + "-floor-line";
    const floorDiv = document.getElementById(floorId);
    floorDiv.innerHTML = "<span>Floor Line: </span>";

    playerState.floorLine.forEach(function (color) {
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

    // Update the Bag and Box counts on screen ---
    document.getElementById("bag-count").textContent = gameState.bag.length;
    document.getElementById("box-count").textContent = gameState.box.length;


    const factoriesContainer = document.getElementById("factories-container");
    factoriesContainer.innerHTML = "<h3>Factories</h3>";

    gameState.factories.forEach(function (factory, index) {
        if (factory.length === 0) {
            return;
        }

        const factoryDiv = document.createElement("div");
        factoryDiv.className = "factory";

        factory.forEach(function (tileColor) {
            const tileImg = createTileElement(tileColor);
            tileImg.style.cursor = "pointer";

            let isSelectedFactory = false;
            if (selectedPick !== null) {
                if (selectedPick.source === "factory" &&
                    selectedPick.index === index &&
                    selectedPick.color === tileColor) {
                    isSelectedFactory = true;
                }
            }

            if (isSelectedFactory) {
                // Replaced border with a smooth glowing shadow and slight lift
                tileImg.style.boxShadow = "0 0 10px 4px rgba(0, 255, 0, 0.8)";
                tileImg.style.borderRadius = "5px";
                tileImg.style.transform = "translateY(-3px) scale(1.15)";
            }

            tileImg.onclick = function () {
                const isActive = gameState.activePlayerIndex === 0
                              || gameState.activePlayerIndex === 1;
                if (isActive) {
                    handleFactoryClick(index, tileColor);
                }
            };
            factoryDiv.appendChild(tileImg);
        });
        factoriesContainer.appendChild(factoryDiv);
    });

    const centerContainer = document.getElementById("center-container");
    centerContainer.innerHTML = "<h3>Center</h3>";

    const centerDiv = document.createElement("div");
    centerDiv.style.border = "2px dashed #999";
    centerDiv.style.padding = "20px";
    centerDiv.style.minHeight = "40px";

    gameState.center.forEach(function (tileColor) {
        const tileImg = createTileElement(tileColor);

        if (tileColor !== "first-player-token") {
            tileImg.style.cursor = "pointer";

            let isSelectedCenter = false;
            if (selectedPick !== null) {
                if (selectedPick.source === "center" &&
                    selectedPick.color === tileColor) {
                    isSelectedCenter = true;
                }
            }

            if (isSelectedFactory) {
                // Replaced border with a smooth glowing shadow and slight lift
                tileImg.style.boxShadow = "0 0 10px 4px rgba(0, 255, 0, 0.8)";
                tileImg.style.borderRadius = "5px";
                tileImg.style.transform = "translateY(-3px) scale(1.15)";
            }

            tileImg.onclick = function () {
                const isActive = gameState.activePlayerIndex === 0
                              || gameState.activePlayerIndex === 1;
                if (isActive) {
                    handleCenterClick(tileColor);
                }
            };
        }
        centerDiv.appendChild(tileImg);
    });

    centerContainer.appendChild(centerDiv);
    drawPlayerBoard(0, gameState.players[0]);
    drawPlayerBoard(1, gameState.players[1]);
};