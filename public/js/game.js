// Game variables
let canvas, ctx;
let gameState = {};
let localPlayer = {};
let lastUpdateTime = 0;
let animationFrameId;
let assets = {};
let isGameRunning = false;

// Initialize game
function initGameCanvas() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    
    // Load assets
    loadAssets();
}

function loadAssets() {
    // Load character images
    assets.characters = {
        'mocha': new Image(),
        'milk': new Image()
    };
    
    assets.characters.mocha.src = 'assets/characters/mocha.png';
    assets.characters.milk.src = 'assets/characters/milk.png';
    
    // Load other assets as needed
}

function startGameLoop(gameData) {
    // Initialize game state
    gameState = gameData;
    localPlayer = gameData.players.find(p => p.id === socket.id);
    
    // Start the game loop
    isGameRunning = true;
    lastUpdateTime = performance.now();
    animationFrameId = requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
    if (!isGameRunning) return;
    
    // Calculate delta time
    const deltaTime = (timestamp - lastUpdateTime) / 1000;
    lastUpdateTime = timestamp;
    
    // Update game state
    updateLocalPlayer();
    
    // Send update to server if needed
    if (localPlayer.updated) {
        socket.emit('player_update', localPlayer);
        localPlayer.updated = false;
    }
    
    // Render game
    renderGame();
    
    // Continue the loop
    animationFrameId = requestAnimationFrame(gameLoop);
}

function updateLocalPlayer() {
    // Handle player input and update local player state
    // This would include movement, actions, etc.
    // For now, we'll just mark as updated
    localPlayer.updated = true;
}

function updateGameState(newState) {
    // Merge the new state with our current state
    gameState = { ...gameState, ...newState };
    
    // Update local player reference if it exists
    if (newState.players) {
        const player = newState.players.find(p => p.id === socket.id);
        if (player) {
            localPlayer = { ...localPlayer, ...player };
        }
    }
}

function renderGame() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    ctx.fillStyle = '#FFF5EB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw game elements based on mode
    switch (gameState.mode) {
        case 'classic':
            renderClassicMode();
            break;
        case 'race':
            renderRaceMode();
            break;
        case 'puzzle':
            renderPuzzleMode();
            break;
        case 'memory':
            renderMemoryMode();
            break;
    }
    
    // Draw players
    gameState.players.forEach(player => {
        renderPlayer(player);
    });
    
    // Draw UI
    renderUI();
}

function renderClassicMode() {
    // Render classic Piko Park mode elements
    // This would include platforms, obstacles, collectibles, etc.
    
    // Example: Draw some platforms
    ctx.fillStyle = '#B5EAD7';
    gameState.platforms.forEach(platform => {
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    });
    
    // Example: Draw collectibles
    ctx.fillStyle = '#FF9AA2';
    gameState.collectibles.forEach(item => {
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

function renderRaceMode() {
    // Render time race mode elements
    ctx.fillStyle = '#C7CEEA';
    gameState.checkpoints.forEach(checkpoint => {
        ctx.fillRect(checkpoint.x, checkpoint.y, checkpoint.width, checkpoint.height);
    });
}

function renderPuzzleMode() {
    // Render team puzzle mode elements
    ctx.fillStyle = '#E2F0CB';
    gameState.puzzlePieces.forEach(piece => {
        ctx.fillRect(piece.x, piece.y, piece.width, piece.height);
        ctx.strokeStyle = '#5A3E36';
        ctx.strokeRect(piece.x, piece.y, piece.width, piece.height);
    });
}

function renderMemoryMode() {
    // Render memory challenge mode elements
    ctx.fillStyle = '#FFDAC1';
    gameState.memoryCards.forEach(card => {
        if (card.revealed) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(card.x, card.y, card.width, card.height);
            // Draw card content
        } else {
            ctx.fillStyle = '#FF9AA2';
            ctx.fillRect(card.x, card.y, card.width, card.height);
        }
        ctx.strokeStyle = '#5A3E36';
        ctx.strokeRect(card.x, card.y, card.width, card.height);
    });
}

function renderPlayer(player) {
    // Choose character based on some player property (e.g., ID hash)
    const character = hashPlayerId(player.id) % 2 === 0 ? 'mocha' : 'milk';
    
    // Draw player
    if (assets.characters[character].complete) {
        ctx.drawImage(
            assets.characters[character],
            player.x - 25,
            player.y - 25,
            50,
            50
        );
    } else {
        // Fallback: Draw a circle
        ctx.fillStyle = character === 'mocha' ? '#5A3E36' : '#FFFFFF';
        ctx.beginPath();
        ctx.arc(player.x, player.y, 25, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw player name
    ctx.fillStyle = '#5A3E36';
    ctx.font = '12px Poppins';
    ctx.textAlign = 'center';
    ctx.fillText(player.username, player.x, player.y - 30);
}

function renderUI() {
    // Draw game timer if applicable
    if (gameState.time) {
        ctx.fillStyle = '#5A3E36';
        ctx.font = '20px Poppins';
        ctx.textAlign = 'right';
        ctx.fillText(formatTime(gameState.time), canvas.width - 20, 30);
    }
    
    // Draw score if applicable
    if (gameState.scores) {
        ctx.fillStyle = '#5A3E36';
        ctx.font = '20px Poppins';
        ctx.textAlign = 'left';
        ctx.fillText(`Score: ${gameState.scores[socket.id] || 0}`, 20, 30);
    }
}

function hashPlayerId(id) {
    // Simple hash function for player ID
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = (hash << 5) - hash + id.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

function stopGame() {
    isGameRunning = false;
    cancelAnimationFrame(animationFrameId);
}

// Handle keyboard input
const keys = {};

document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    if (isGameRunning) {
        localPlayer.updated = true;
        
        // Update player movement based on keys
        if (e.key === 'ArrowLeft') {
            localPlayer.vx = -5;
        } else if (e.key === 'ArrowRight') {
            localPlayer.vx = 5;
        } else if (e.key === 'ArrowUp') {
            localPlayer.vy = -5;
        } else if (e.key === 'ArrowDown') {
            localPlayer.vy = 5;
        } else if (e.key === ' ' || e.key === 'Spacebar') {
            // Space bar action (jump, interact, etc.)
            localPlayer.action = true;
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
    
    if (isGameRunning) {
        localPlayer.updated = true;
        
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            localPlayer.vx = 0;
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            localPlayer.vy = 0;
        } else if (e.key === ' ' || e.key === 'Spacebar') {
            localPlayer.action = false;
        }
    }
});

// Handle touch controls for mobile
// (Implementation would go here)

// Export functions needed by main.js
function initGame(gameData) {
    initGameCanvas();
    startGameLoop(gameData);
}

function updateGame(newState) {
    updateGameState(newState);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}