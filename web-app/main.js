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

    // Later, we will add code here to draw the SVG tiles based on gameState.factories
};