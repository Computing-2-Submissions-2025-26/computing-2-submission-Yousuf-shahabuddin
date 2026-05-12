import * as Azul from "./Module.js";

// Global variable to hold the current state of the game
let gameState;

// 1. Handle the Instruction Popup
const modal = document.getElementById("instruction-modal");
const startBtn = document.getElementById("start-game-btn");

startBtn.onclick = function () {
    modal.classList.add("hidden"); // Hide the popup
    startGame(2); // Start a 2 player game
};

// 2. Start the game and update the screen
const startGame = function (numPlayers) {
    gameState = Azul.createGame(numPlayers);
    updateUI();
};

// 3. Update the HTML based on the Game State
const updateUI = function () {
    const turnIndicator = document.getElementById("turn-indicator");
    const player1Board = document.getElementById("player-1-board");
    const player2Board = document.getElementById("player-2-board");

    // Update Turn Text and Colors
    if (gameState.activePlayerIndex === 0) {
        turnIndicator.textContent = "Player 1's Turn";
        turnIndicator.className = "player-1-turn";
        player1Board.classList.add("active-board");
        player2Board.classList.remove("active-board");
    } else {
        turnIndicator.textContent = "Player 2's Turn";
        turnIndicator.className = "player-2-turn";
        player2Board.classList.add("active-board");
        player1Board.classList.remove("active-board");
    }

    // --- NEW: Draw the Factories ---
    const factoriesContainer = document.getElementById("factories-container");
    factoriesContainer.innerHTML = '<h3>Factories</h3>'; // Clear old ones

    gameState.factories.forEach((factory, index) => {
        const factoryDiv = document.createElement("div");
        factoryDiv.className = "factory";
        factoryDiv.style.border = "2px solid #ccc";
        factoryDiv.style.borderRadius = "50%";
        factoryDiv.style.padding = "20px";
        factoryDiv.style.margin = "10px";
        factoryDiv.style.display = "inline-block";

        // Add the colored tiles as little squares
        factory.forEach(tileColor => {
            const tileSpan = document.createElement("span");
            tileSpan.style.display = "inline-block";
            tileSpan.style.width = "30px";
            tileSpan.style.height = "30px";
            tileSpan.style.margin = "5px";
            tileSpan.style.backgroundColor = tileColor; 
            if (tileColor === 'white') tileSpan.style.border = "1px solid black";
            
            // We will add click events to these later!
            factoryDiv.appendChild(tileSpan);
        });

        factoriesContainer.appendChild(factoryDiv);
    });
};

    // Later, we will add code here to draw the SVG tiles based on gameState.factories