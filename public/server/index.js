const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Game state
const rooms = {};
const players = {};

// Serve static files
app.use(express.static(path.join(__dirname, '../../public')));

// Handle socket connections
io.on('connection', (socket) => {
    console.log('New connection:', socket.id);
    players[socket.id] = { id: socket.id };
    
    // Handle room creation
    socket.on('create_room', (data) => {
        const { username, gameMode } = data;
        const roomCode = generateRoomCode();
        
        // Create new room
        rooms[roomCode] = {
            code: roomCode,
            gameMode,
            players: [{ id: socket.id, username }],
            gameState: null,
            isPlaying: false
        };
        
        // Update player info
        players[socket.id] = {
            id: socket.id,
            username,
            room: roomCode
        };
        
        // Join room
        socket.join(roomCode);
        
        // Notify client
        socket.emit('room_created', roomCode);
    });
    
    // Handle room joining
    socket.on('join_room', (data) => {
        const { username, roomId } = data;
        
        if (!rooms[roomId]) {
            socket.emit('room_error', 'Room not found');
            return;
        }
        
        if (rooms[roomId].players.length >= 10) {
            socket.emit('room_error', 'Room is full');
            return;
        }
        
        if (rooms[roomId].isPlaying) {
            socket.emit('room_error', 'Game already in progress');
            return;
        }
        
        // Add player to room
        rooms[roomId].players.push({ id: socket.id, username });
        
        // Update player info
        players[socket.id] = {
            id: socket.id,
            username,
            room: roomId
        };
        
        // Join room
        socket.join(roomId);
        
        // Notify all in room
        io.to(roomId).emit('player_joined', rooms[roomId].players);
        
        // Send room data to new player
        socket.emit('room_joined', {
            roomCode: roomId,
            gameMode: rooms[roomId].gameMode,
            players: rooms[roomId].players
        });
    });
    
    // Handle game start
    socket.on('start_game', () => {
        const player = players[socket.id];
        if (!player || !player.room) return;
        
        const room = rooms[player.room];
        if (!room || room.players[0].id !== socket.id) return; // Only room creator can start
        
        // Initialize game state based on mode
        room.gameState = initializeGameState(room.gameMode, room.players);
        room.isPlaying = true;
        
        // Notify all in room
        io.to(room.code).emit('game_started', {
            mode: room.gameMode,
            state: room.gameState
        });
        
        // Start game loop for room
        startGameLoop(room);
    });
    
    // Handle player updates during game
    socket.on('player_update', (playerData) => {
        const player = players[socket.id];
        if (!player || !player.room || !rooms[player.room].isPlaying) return;
        
        // Update player in game state
        const room = rooms[player.room];
        const playerIndex = room.gameState.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            room.gameState.players[playerIndex] = { 
                ...room.gameState.players[playerIndex], 
                ...playerData 
            };
        }
    });
    
    // Handle chat messages
    socket.on('chat_message', (message) => {
        const player = players[socket.id];
        if (!player) return;
        
        const chatMessage = {
            sender: player.username,
            content: message,
            timestamp: Date.now()
        };
        
        if (player.room) {
            // Room chat
            io.to(player.room).emit('chat_message', chatMessage);
        } else {
            // Global chat (if implemented)
        }
    });
    
    // Handle WebRTC signaling
    socket.on('webrtc_offer', (data) => {
        io.to(data.to).emit('webrtc_offer', {
            from: socket.id,
            offer: data.offer
        });
    });
    
    socket.on('webrtc_answer', (data) => {
        io.to(data.to).emit('webrtc_answer', {
            from: socket.id,
            answer: data.answer
        });
    });
    
    socket.on('webrtc_ice_candidate', (data) => {
        io.to(data.to).emit('webrtc_ice_candidate', {
            from: socket.id,
            candidate: data.candidate
        });
    });
    
    // Handle play again request
    socket.on('play_again', () => {
        const player = players[socket.id];
        if (!player || !player.room) return;
        
        const room = rooms[player.room];
        if (!room || !room.isPlaying) return;
        
        // Only room creator can initiate play again
        if (room.players[0].id === socket.id) {
            // Reset game state
            room.gameState = initializeGameState(room.gameMode, room.players);
            
            // Notify all in room
            io.to(room.code).emit('game_started', {
                mode: room.gameMode,
                state: room.gameState
            });
        }
    });
    
    // Handle return to lobby
    socket.on('return_to_lobby', () => {
        const player = players[socket.id];
        if (!player || !player.room) return;
        
        const room = rooms[player.room];
        if (!room || !room.isPlaying) return;
        
        // Only room creator can return to lobby
        if (room.players[0].id === socket.id) {
            room.isPlaying = false;
            room.gameState = null;
            
            // Notify all in room
            io.to(room.code).emit('returned_to_lobby');
        }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Disconnected:', socket.id);
        const player = players[socket.id];
        if (!player) return;
        
        // Remove from room if in one
        if (player.room) {
            const room = rooms[player.room];
            if (room) {
                room.players = room.players.filter(p => p.id !== socket.id);
                
                if (room.players.length === 0) {
                    // Delete empty room
                    delete rooms[player.room];
                } else {
                    // Notify remaining players
                    io.to(player.room).emit('player_left', room.players);
                    
                    // End game if in progress and not enough players
                    if (room.isPlaying && room.players.length < 2) {
                        room.isPlaying = false;
                        io.to(player.room).emit('game_ended', 'Not enough players');
                    }
                }
            }
        }
        
        // Remove player
        delete players[socket.id];
    });
});

// Initialize game state based on mode
function initializeGameState(mode, players) {
    const gameState = {
        mode,
        players: players.map(player => ({
            id: player.id,
            username: player.username,
            x: Math.random() * 700 + 50,
            y: Math.random() * 700 + 50,
            vx: 0,
            vy: 0,
            score: 0,
            collected: 0
        })),
        startTime: Date.now(),
        time: 0
    };
    
    switch (mode) {
        case 'classic':
            gameState.platforms = generatePlatforms();
            gameState.collectibles = generateCollectibles(players.length * 5);
            gameState.goal = { x: 400, y: 50, width: 50, height: 50 };
            break;
            
        case 'race':
            gameState.checkpoints = generateCheckpoints();
            gameState.currentCheckpoint = 0;
            break;
            
        case 'puzzle':
            gameState.puzzlePieces = generatePuzzlePieces();
            gameState.completedPieces = 0;
            break;
            
        case 'memory':
            gameState.memoryCards = generateMemoryCards();
            gameState.matchedPairs = 0;
            break;
    }
    
    return gameState;
}

// Game loop for each room
function startGameLoop(room) {
    const interval = setInterval(() => {
        if (!room.isPlaying) {
            clearInterval(interval);
            return;
        }
        
        updateGameState(room);
        
        // Check game over conditions
        const gameOver = checkGameOver(room);
        if (gameOver) {
            room.isPlaying = false;
            io.to(room.code).emit('game_over', gameOver);
            clearInterval(interval);
            return;
        }
        
        // Send game state update to all players
        io.to(room.code).emit('game_state_update', room.gameState);
    }, 1000 / 30); // 30 FPS
}

// Update game state based on mode
function updateGameState(room) {
    const { gameState } = room;
    
    // Update game time
    gameState.time = Math.floor((Date.now() - gameState.startTime) / 1000);
    
    // Mode-specific updates
    switch (gameState.mode) {
        case 'classic':
            updateClassicMode(gameState);
            break;
            
        case 'race':
            updateRaceMode(gameState);
            break;
            
        case 'puzzle':
            updatePuzzleMode(gameState);
            break;
            
        case 'memory':
            updateMemoryMode(gameState);
            break;
    }
    
    // Update player positions
    gameState.players.forEach(player => {
        player.x += player.vx;
        player.y += player.vy;
        
        // Simple bounds checking
        player.x = Math.max(0, Math.min(750, player.x));
        player.y = Math.max(0, Math.min(750, player.y));
    });
}

// Game mode specific update functions
function updateClassicMode(gameState) {
    // Check for collectible collisions
    gameState.players.forEach(player => {
        gameState.collectibles = gameState.collectibles.filter(item => {
            const dist = Math.sqrt(
                Math.pow(player.x - item.x, 2) + 
                Math.pow(player.y - item.y, 2)
            );
            
            if (dist < 30) { // Collision
                player.score += 10;
                player.collected++;
                return false; // Remove collectible
            }
            return true;
        });
    });
    
    // Check for goal collision
    gameState.players.forEach(player => {
        if (
            player.x > gameState.goal.x && 
            player.x < gameState.goal.x + gameState.goal.width &&
            player.y > gameState.goal.y && 
            player.y < gameState.goal.y + gameState.goal.height
        ) {
            player.score += 50;
        }
    });
}

function updateRaceMode(gameState) {
    // Check checkpoint collisions
    gameState.players.forEach(player => {
        const checkpoint = gameState.checkpoints[gameState.currentCheckpoint];
        if (
            player.x > checkpoint.x && 
            player.x < checkpoint.x + checkpoint.width &&
            player.y > checkpoint.y && 
            player.y < checkpoint.y + checkpoint.height
        ) {
            gameState.currentCheckpoint++;
            if (gameState.currentCheckpoint >= gameState.checkpoints.length) {
                gameState.currentCheckpoint = 0;
                player.score += 100;
            }
        }
    });
}

function updatePuzzleMode(gameState) {
    // Check puzzle piece interactions
    // (Would need more complex logic based on player actions)
}

function updateMemoryMode(gameState) {
    // Check memory card matches
    // (Would need more complex logic based on player actions)
}

// Check if game is over
function checkGameOver(room) {
    const { gameState } = room;
    
    switch (gameState.mode) {
        case 'classic':
            // Game over when all collectibles are collected
            if (gameState.collectibles.length === 0) {
                return {
                    win: true,
                    players: gameState.players,
                    time: gameState.time
                };
            }
            break;
            
        case 'race':
            // Game over after 3 minutes
            if (gameState.time >= 180) {
                return {
                    win: gameState.players.some(p => p.score >= 300),
                    players: gameState.players,
                    time: gameState.time
                };
            }
            break;
            
        case 'puzzle':
            // Game over when puzzle is complete
            if (gameState.completedPieces >= gameState.puzzlePieces.length) {
                return {
                    win: true,
                    players: gameState.players,
                    time: gameState.time
                };
            }
            break;
            
        case 'memory':
            // Game over when all pairs are matched
            if (gameState.matchedPairs >= gameState.memoryCards.length / 2) {
                return {
                    win: true,
                    players: gameState.players,
                    time: gameState.time
                };
            }
            break;
    }
    
    return null;
}

// Helper functions for game elements generation
function generatePlatforms() {
    const platforms = [];
    // Generate some platforms
    platforms.push({ x: 100, y: 600, width: 200, height: 20 });
    platforms.push({ x: 400, y: 500, width: 200, height: 20 });
    platforms.push({ x: 200, y: 400, width: 200, height: 20 });
    platforms.push({ x: 500, y: 300, width: 200, height: 20 });
    platforms.push({ x: 100, y: 200, width: 200, height: 20 });
    return platforms;
}

function generateCollectibles(count) {
    const collectibles = [];
    for (let i = 0; i < count; i++) {
        collectibles.push({
            x: Math.random() * 700 + 50,
            y: Math.random() * 700 + 50,
            radius: 10
        });
    }
    return collectibles;
}

function generateCheckpoints() {
    const checkpoints = [];
    // Generate checkpoints in a circular path
    const centerX = 400, centerY = 400, radius = 300;
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        checkpoints.push({
            x: centerX + Math.cos(angle) * radius - 25,
            y: centerY + Math.sin(angle) * radius - 25,
            width: 50,
            height: 50
        });
    }
    return checkpoints;
}

function generatePuzzlePieces() {
    const pieces = [];
    // Generate simple puzzle pieces
    for (let i = 0; i < 9; i++) {
        pieces.push({
            x: 150 + (i % 3) * 200,
            y: 150 + Math.floor(i / 3) * 200,
            width: 150,
            height: 150,
            correctPosition: i,
            currentPosition: i
        });
    }
    return pieces;
}

function generateMemoryCards() {
    const cards = [];
    const pairs = 8;
    // Generate pairs of cards
    for (let i = 0; i < pairs; i++) {
        const x1 = 100 + (i % 4) * 150;
        const y1 = 100 + Math.floor(i / 4) * 150;
        const x2 = 100 + ((i + 2) % 4) * 150;
        const y2 = 100 + (Math.floor(i / 4) + 1) * 150;
        
        cards.push({
            x: x1,
            y: y1,
            width: 100,
            height: 100,
            pairId: i,
            revealed: false,
            matched: false
        });
        
        cards.push({
            x: x2,
            y: y2,
            width: 100,
            height: 100,
            pairId: i,
            revealed: false,
            matched: false
        });
    }
    return cards;
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});