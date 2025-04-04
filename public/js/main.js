// DOM Elements
const startScreen = document.getElementById('start-screen');
const createRoomScreen = document.getElementById('create-room-screen');
const joinRoomScreen = document.getElementById('join-room-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('game-over-screen');

// Buttons
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const startRoomBtn = document.getElementById('start-room-btn');
const joinRoomConfirmBtn = document.getElementById('join-room-confirm-btn');
const startGameBtn = document.getElementById('start-game-btn');
const leaveLobbyBtn = document.getElementById('leave-lobby-btn');
const backToStartBtn = document.getElementById('back-to-start-btn');
const backToStartBtn2 = document.getElementById('back-to-start-btn-2');
const playAgainBtn = document.getElementById('play-again-btn');
const returnToLobbyBtn = document.getElementById('return-to-lobby-btn');
const copyRoomCodeBtn = document.getElementById('copy-room-code-btn');
const toggleMicBtn = document.getElementById('toggle-mic-btn');
const sendChatBtn = document.getElementById('send-chat-btn');

// Inputs
const usernameCreate = document.getElementById('username-create');
const usernameJoin = document.getElementById('username-join');
const roomIdInput = document.getElementById('room-id');
const gameModeSelect = document.getElementById('game-mode');
const roomCodeCopy = document.getElementById('room-code-copy');
const chatInput = document.getElementById('chat-input');

// Displays
const roomCodeDisplay = document.getElementById('room-code-display');
const playerCount = document.getElementById('player-count');
const playersList = document.getElementById('players-list');
const gameModeDisplay = document.getElementById('game-mode-display');
const micStatus = document.getElementById('mic-status');
const gameModeIndicator = document.getElementById('game-mode-indicator');
const gameTimer = document.getElementById('game-timer');
const chatMessages = document.getElementById('chat-messages');
const gameResults = document.getElementById('game-results');

// Audio
const bgm = document.getElementById('bgm');

// Game state
let socket;
let currentRoom = null;
let currentUsername = '';
let currentGameMode = 'classic';
let isMicEnabled = false;
let localStream = null;
let peerConnections = {};
let audioContext;
let audioElements = {};

// Initialize the app
function init() {
    setupEventListeners();
    setupAudio();
    connectToServer();
}

// Set up event listeners
function setupEventListeners() {
    // Navigation buttons
    createRoomBtn.addEventListener('click', showCreateRoomScreen);
    joinRoomBtn.addEventListener('click', showJoinRoomScreen);
    startRoomBtn.addEventListener('click', createRoom);
    joinRoomConfirmBtn.addEventListener('click', joinRoom);
    startGameBtn.addEventListener('click', startGame);
    leaveLobbyBtn.addEventListener('click', leaveLobby);
    backToStartBtn.addEventListener('click', showStartScreen);
    backToStartBtn2.addEventListener('click', showStartScreen);
    playAgainBtn.addEventListener('click', playAgain);
    returnToLobbyBtn.addEventListener('click', returnToLobby);
    
    // Utility buttons
    copyRoomCodeBtn.addEventListener('click', copyRoomCode);
    toggleMicBtn.addEventListener('click', toggleMicrophone);
    sendChatBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
    
    // Handle game screen resize
    window.addEventListener('resize', resizeGameCanvas);
}

// Connect to Socket.io server
function connectToServer() {
    socket = io();
    
    // Handle connection events
    socket.on('connect', () => {
        console.log('Connected to server with socket ID:', socket.id);
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
    
    // Room events
    socket.on('room_created', (roomCode) => {
        currentRoom = roomCode;
        roomCodeDisplay.textContent = roomCode;
        roomCodeCopy.value = roomCode;
        showLobbyScreen();
    });
    
    socket.on('room_joined', (roomData) => {
        currentRoom = roomData.roomCode;
        currentGameMode = roomData.gameMode;
        roomCodeDisplay.textContent = roomData.roomCode;
        roomCodeCopy.value = roomData.roomCode;
        gameModeDisplay.textContent = getGameModeName(roomData.gameMode);
        updatePlayerList(roomData.players);
        showLobbyScreen();
    });
    
    socket.on('player_joined', (players) => {
        updatePlayerList(players);
    });
    
    socket.on('player_left', (players) => {
        updatePlayerList(players);
    });
    
    socket.on('game_started', (gameData) => {
        currentGameMode = gameData.mode;
        gameModeIndicator.textContent = getGameModeName(gameData.mode);
        startGameSession(gameData);
    });
    
    socket.on('game_state_update', (gameState) => {
        updateGameState(gameState);
    });
    
    socket.on('game_over', (results) => {
        showGameOverScreen(results);
    });
    
    socket.on('chat_message', (message) => {
        displayChatMessage(message);
    });
    
    socket.on('webrtc_offer', handleWebRTCOffer);
    socket.on('webrtc_answer', handleWebRTCAnswer);
    socket.on('webrtc_ice_candidate', handleWebRTCIceCandidate);
}

// Screen navigation functions
function showStartScreen() {
    hideAllScreens();
    startScreen.classList.remove('hidden');
}

function showCreateRoomScreen() {
    hideAllScreens();
    createRoomScreen.classList.remove('hidden');
}

function showJoinRoomScreen() {
    hideAllScreens();
    joinRoomScreen.classList.remove('hidden');
}

function showLobbyScreen() {
    hideAllScreens();
    lobbyScreen.classList.remove('hidden');
}

function showGameScreen() {
    hideAllScreens();
    gameScreen.classList.remove('hidden');
    resizeGameCanvas();
    bgm.play();
}

function showGameOverScreen(results) {
    hideAllScreens();
    gameOverScreen.classList.remove('hidden');
    displayGameResults(results);
}

function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
}

// Room management functions
function createRoom() {
    const username = usernameCreate.value.trim();
    const gameMode = gameModeSelect.value;
    
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    currentUsername = username;
    currentGameMode = gameMode;
    
    socket.emit('create_room', { username, gameMode });
}

function joinRoom() {
    const username = usernameJoin.value.trim();
    const roomId = roomIdInput.value.trim();
    
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    if (!roomId) {
        alert('Please enter a room ID');
        return;
    }
    
    currentUsername = username;
    
    socket.emit('join_room', { username, roomId });
}

function leaveLobby() {
    socket.emit('leave_room');
    showStartScreen();
}

function startGame() {
    socket.emit('start_game');
}

function playAgain() {
    socket.emit('play_again');
}

function returnToLobby() {
    socket.emit('return_to_lobby');
    showLobbyScreen();
}

// Player list management
function updatePlayerList(players) {
    playersList.innerHTML = '';
    playerCount.textContent = players.length;
    
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.username;
        if (player.id === socket.id) {
            li.innerHTML += ' <span>(You)</span>';
        }
        playersList.appendChild(li);
    });
}

// Game mode helper
function getGameModeName(mode) {
    const modes = {
        'classic': 'Classic Piko Park',
        'race': 'Time Race',
        'puzzle': 'Team Puzzle',
        'memory': 'Memory Challenge'
    };
    return modes[mode] || mode;
}

// Room code copy
function copyRoomCode() {
    roomCodeCopy.select();
    document.execCommand('copy');
    copyRoomCodeBtn.textContent = 'Copied!';
    setTimeout(() => {
        copyRoomCodeBtn.textContent = 'Copy';
    }, 2000);
}

// Audio setup
function setupAudio() {
    // Try to autoplay background music
    document.addEventListener('click', () => {
        bgm.play().catch(e => console.log('Audio play failed:', e));
    }, { once: true });
}

// Game session management
function startGameSession(gameData) {
    initGame(gameData);
    showGameScreen();
    
    // Initialize WebRTC connections if mic is enabled
    if (isMicEnabled) {
        initializeWebRTCConnections(gameData.players);
    }
}

function initGame(gameData) {
    // Initialize the game canvas and logic
    initGameCanvas();
    initGameLogic(gameData);
}

function initGameCanvas() {
    const canvas = document.getElementById('game-canvas');
    canvas.width = 800;
    canvas.height = 800;
}

function initGameLogic(gameData) {
    // This will be implemented in game.js
    startGameLoop(gameData);
}

function updateGameState(gameState) {
    // This will be implemented in game.js
    updateGame(gameState);
}

function displayGameResults(results) {
    gameResults.innerHTML = '';
    
    const title = document.createElement('h3');
    title.textContent = results.win ? 'Your team won!' : 'Your team lost!';
    gameResults.appendChild(title);
    
    results.players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'result-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = player.username + (player.id === socket.id ? ' (You)' : '');
        
        const scoreSpan = document.createElement('span');
        scoreSpan.textContent = player.score;
        
        div.appendChild(nameSpan);
        div.appendChild(scoreSpan);
        gameResults.appendChild(div);
    });
    
    if (results.time) {
        const timeDiv = document.createElement('div');
        timeDiv.className = 'result-item';
        
        const timeLabel = document.createElement('span');
        timeLabel.textContent = 'Time';
        
        const timeValue = document.createElement('span');
        timeValue.textContent = formatTime(results.time);
        
        timeDiv.appendChild(timeLabel);
        timeDiv.appendChild(timeValue);
        gameResults.appendChild(timeDiv);
    }
}

function resizeGameCanvas() {
    const canvas = document.getElementById('game-canvas');
    const gameScreen = document.getElementById('game-screen');
    const headerHeight = document.querySelector('.game-header').offsetHeight;
    
    const availableHeight = gameScreen.offsetHeight - headerHeight - 20;
    const availableWidth = gameScreen.offsetWidth - 320; // Account for chat
    
    const size = Math.min(availableWidth, availableHeight, 800);
    
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
}

// Chat functions
function sendChatMessage() {
    const message = chatInput.value.trim();
    if (message) {
        socket.emit('chat_message', message);
        chatInput.value = '';
    }
}

function displayChatMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    const senderSpan = document.createElement('span');
    senderSpan.className = 'sender';
    senderSpan.textContent = message.sender + ': ';
    
    const contentSpan = document.createElement('span');
    contentSpan.textContent = message.content;
    
    messageDiv.appendChild(senderSpan);
    messageDiv.appendChild(contentSpan);
    chatMessages.appendChild(messageDiv);
    
    // Auto-scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// WebRTC functions
async function toggleMicrophone() {
    if (isMicEnabled) {
        // Disable mic
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        Object.values(peerConnections).forEach(pc => pc.close());
        peerConnections = {};
        isMicEnabled = false;
        toggleMicBtn.textContent = '🎤 Enable Mic';
        micStatus.textContent = 'Microphone: Off';
    } else {
        // Enable mic
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            isMicEnabled = true;
            toggleMicBtn.textContent = '🎤 Disable Mic';
            micStatus.textContent = 'Microphone: On';
            
            // Initialize connections if already in game
            if (document.getElementById('game-screen').classList.contains('hidden') === false) {
                // Get current players from the player list
                const players = Array.from(document.querySelectorAll('#players-list li')).map(li => {
                    return { id: li.dataset.playerId || '' }; // You'd need to store player IDs in the list
                });
                initializeWebRTCConnections(players);
            }
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please check permissions.');
        }
    }
}

async function initializeWebRTCConnections(players) {
    if (!isMicEnabled || !localStream) return;
    
    // Initialize audio context if not already done
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    players.forEach(player => {
        if (player.id !== socket.id && !peerConnections[player.id]) {
            createPeerConnection(player.id);
        }
    });
}

function createPeerConnection(playerId) {
    const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    // Add local stream to connection
    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });
    
    // Handle remote stream
    pc.ontrack = (event) => {
        if (!audioElements[playerId]) {
            const audio = document.createElement('audio');
            audio.autoplay = true;
            audioElements[playerId] = audio;
        }
        
        const audioStream = new MediaStream();
        event.streams[0].getAudioTracks().forEach(track => {
            audioStream.addTrack(track);
        });
        
        audioElements[playerId].srcObject = audioStream;
    };
    
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('webrtc_ice_candidate', {
                to: playerId,
                candidate: event.candidate
            });
        }
    };
    
    peerConnections[playerId] = pc;
    
    // Create offer
    pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
            socket.emit('webrtc_offer', {
                to: playerId,
                offer: pc.localDescription
            });
        })
        .catch(error => console.error('Error creating offer:', error));
}

function handleWebRTCOffer(data) {
    if (!isMicEnabled || !localStream) return;
    
    const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    // Add local stream to connection
    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });
    
    // Handle remote stream
    pc.ontrack = (event) => {
        if (!audioElements[data.from]) {
            const audio = document.createElement('audio');
            audio.autoplay = true;
            audioElements[data.from] = audio;
        }
        
        const audioStream = new MediaStream();
        event.streams[0].getAudioTracks().forEach(track => {
            audioStream.addTrack(track);
        });
        
        audioElements[data.from].srcObject = audioStream;
    };
    
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('webrtc_ice_candidate', {
                to: data.from,
                candidate: event.candidate
            });
        }
    };
    
    peerConnections[data.from] = pc;
    
    pc.setRemoteDescription(new RTCSessionDescription(data.offer))
        .then(() => pc.createAnswer())
        .then(answer => pc.setLocalDescription(answer))
        .then(() => {
            socket.emit('webrtc_answer', {
                to: data.from,
                answer: pc.localDescription
            });
        })
        .catch(error => console.error('Error handling offer:', error));
}

function handleWebRTCAnswer(data) {
    const pc = peerConnections[data.from];
    if (pc) {
        pc.setRemoteDescription(new RTCSessionDescription(data.answer))
            .catch(error => console.error('Error setting answer:', error));
    }
}

function handleWebRTCIceCandidate(data) {
    const pc = peerConnections[data.from];
    if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(data.candidate))
            .catch(error => console.error('Error adding ICE candidate:', error));
    }
}

// Utility functions
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);