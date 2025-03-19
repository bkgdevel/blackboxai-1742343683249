// Game Client Implementation
class GameClient {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.ws = null;
        this.playerId = null;
        this.chunks = new Map();
        this.players = new Map();
        this.camera = {
            position: { x: 0, y: 100, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 }
        };
        
        // Input state
        this.keys = new Set();
        this.mouseButtons = new Set();
        this.mouseLocked = false;
        this.mousePosition = { x: 0, y: 0 };
        this.mouseSensitivity = 0.002;

        // Game state
        this.health = 100;
        this.oinkBalance = 0;
        this.inventory = new Array(9).fill(null);
        this.selectedSlot = 0;

        this.setupEventListeners();
        this.connectToServer();
        this.initializeGame();
    }

    // Initialize game systems
    async initializeGame() {
        await this.loadResources();
        this.resizeCanvas();
        this.startGameLoop();
        this.hideLoadingScreen();
    }

    // Load game resources
    async loadResources() {
        const totalResources = 5;
        let loadedResources = 0;

        const updateProgress = () => {
            loadedResources++;
            const progress = (loadedResources / totalResources) * 100;
            document.getElementById('loading-progress').style.width = `${progress}%`;
            document.getElementById('loading-text').textContent = `Loading resources... ${Math.floor(progress)}%`;
        };

        // Simulate resource loading
        for (let i = 0; i < totalResources; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));
            updateProgress();
        }
    }

    // Hide loading screen
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }

    // Connect to game server
    connectToServer() {
        this.ws = new WebSocket('ws://localhost:8000');

        this.ws.onopen = () => {
            console.log('Connected to server');
            this.sendJoinRequest();
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleServerMessage(message);
        };

        this.ws.onclose = () => {
            console.log('Disconnected from server');
            setTimeout(() => this.connectToServer(), 5000);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    // Send join request to server
    sendJoinRequest() {
        this.send({
            type: 'join',
            playerId: Date.now().toString()
        });
    }

    // Handle incoming server messages
    handleServerMessage(message) {
        switch (message.type) {
            case 'initial_state':
                this.handleInitialState(message);
                break;
            case 'world_update':
                this.handleWorldUpdate(message);
                break;
            case 'chunk_data':
                this.handleChunkData(message);
                break;
            case 'player_joined':
                this.handlePlayerJoined(message);
                break;
            case 'player_left':
                this.handlePlayerLeft(message);
                break;
            case 'block_update':
                this.handleBlockUpdate(message);
                break;
            case 'chat':
                this.handleChatMessage(message);
                break;
        }
    }

    // Handle initial game state
    handleInitialState(message) {
        this.playerId = message.playerId;
        this.chunks = new Map(Object.entries(message.chunks));
        this.players = new Map(message.players.map(p => [p.id, p]));
        
        // Initialize camera at spawn position
        if (message.spawnPosition) {
            this.camera.position = message.spawnPosition;
        }
    }

    // Handle world updates
    handleWorldUpdate(message) {
        // Update entities
        for (const entity of message.updates.entities) {
            if (entity.id === this.playerId) continue;
            this.players.set(entity.id, entity);
        }

        // Update blocks
        for (const block of message.updates.blocks) {
            this.updateBlock(block.position, block.type);
        }
    }

    // Handle chunk data
    handleChunkData(message) {
        for (const [key, data] of Object.entries(message.chunks)) {
            this.chunks.set(key, {
                voxels: new Uint8Array(data.voxels),
                modified: data.modified
            });
        }
    }

    // Handle player join
    handlePlayerJoined(message) {
        this.players.set(message.player.id, message.player);
        this.addChatMessage(`Player ${message.player.id} joined the game`);
    }

    // Handle player leave
    handlePlayerLeft(message) {
        this.players.delete(message.playerId);
        this.addChatMessage(`Player ${message.playerId} left the game`);
    }

    // Handle block updates
    handleBlockUpdate(message) {
        this.updateBlock(message.position, message.blockType);
    }

    // Handle chat messages
    handleChatMessage(message) {
        this.addChatMessage(`${message.playerId}: ${message.message}`);
    }

    // Update block in world
    updateBlock(position, blockType) {
        const chunkKey = this.getChunkKeyFromPosition(position);
        const chunk = this.chunks.get(chunkKey);
        if (chunk) {
            const localPos = this.worldToLocalCoords(position);
            const index = this.getVoxelIndex(localPos);
            chunk.voxels[index] = blockType;
            chunk.modified = true;
        }
    }

    // Set up event listeners
    setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));

        // Mouse events
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('wheel', (e) => this.handleMouseWheel(e));

        // Pointer lock
        this.canvas.addEventListener('click', () => this.requestPointerLock());
        document.addEventListener('pointerlockchange', () => this.handlePointerLockChange());

        // Window events
        window.addEventListener('resize', () => this.resizeCanvas());

        // Chat input
        const chatInput = document.getElementById('chat-input');
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage(chatInput.value);
                chatInput.value = '';
                chatInput.classList.add('hidden');
                this.canvas.focus();
            }
        });
    }

    // Handle keyboard input
    handleKeyDown(e) {
        this.keys.add(e.code);

        // Chat toggle
        if (e.code === 'KeyT' && !this.isChatOpen()) {
            this.openChat();
        }

        // Inventory slots
        if (e.code.startsWith('Digit')) {
            const slot = parseInt(e.code.slice(-1)) - 1;
            if (slot >= 0 && slot < 9) {
                this.selectedSlot = slot;
                this.updateInventoryUI();
            }
        }
    }

    handleKeyUp(e) {
        this.keys.delete(e.code);
    }

    // Handle mouse input
    handleMouseDown(e) {
        this.mouseButtons.add(e.button);
        if (this.mouseLocked) {
            if (e.button === 0) { // Left click
                this.breakBlock();
            } else if (e.button === 2) { // Right click
                this.placeBlock();
            }
        }
    }

    handleMouseUp(e) {
        this.mouseButtons.delete(e.button);
    }

    handleMouseMove(e) {
        if (this.mouseLocked) {
            this.camera.rotation.y -= e.movementX * this.mouseSensitivity;
            this.camera.rotation.x -= e.movementY * this.mouseSensitivity;
            
            // Clamp vertical rotation
            this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.camera.rotation.x));
        }
    }

    handleMouseWheel(e) {
        this.selectedSlot = (this.selectedSlot + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
        this.updateInventoryUI();
    }

    // Request pointer lock
    requestPointerLock() {
        this.canvas.requestPointerLock();
    }

    // Handle pointer lock change
    handlePointerLockChange() {
        this.mouseLocked = document.pointerLockElement === this.canvas;
    }

    // Resize canvas
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    // Chat functions
    openChat() {
        const chatInput = document.getElementById('chat-input');
        chatInput.classList.remove('hidden');
        chatInput.focus();
    }

    isChatOpen() {
        return !document.getElementById('chat-input').classList.contains('hidden');
    }

    sendChatMessage(message) {
        if (message.trim()) {
            this.send({
                type: 'chat',
                message: message
            });
        }
    }

    addChatMessage(message) {
        const chatMessages = document.getElementById('chat-messages');
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Update inventory UI
    updateInventoryUI() {
        const slots = document.querySelectorAll('.inventory-slot');
        slots.forEach((slot, index) => {
            slot.style.borderColor = index === this.selectedSlot ? '#00ff00' : '#004400';
        });
    }

    // Game loop
    startGameLoop() {
        const gameLoop = () => {
            this.update();
            this.render();
            requestAnimationFrame(gameLoop);
        };
        gameLoop();
    }

    // Update game state
    update() {
        if (!this.mouseLocked || this.isChatOpen()) return;

        // Update player movement
        this.updateMovement();

        // Update camera position
        this.updateCamera();

        // Send position update to server
        this.sendPositionUpdate();

        // Update UI
        this.updateUI();
    }

    // Update player movement
    updateMovement() {
        const speed = 0.1;
        const direction = { x: 0, y: 0, z: 0 };

        if (this.keys.has('KeyW')) direction.z -= Math.cos(this.camera.rotation.y);
        if (this.keys.has('KeyS')) direction.z += Math.cos(this.camera.rotation.y);
        if (this.keys.has('KeyA')) direction.x -= Math.cos(this.camera.rotation.y + Math.PI/2);
        if (this.keys.has('KeyD')) direction.x += Math.cos(this.camera.rotation.y + Math.PI/2);
        if (this.keys.has('Space')) direction.y += 1;
        if (this.keys.has('ShiftLeft')) direction.y -= 1;

        // Normalize direction vector
        const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
        if (length > 0) {
            direction.x = direction.x / length * speed;
            direction.y = direction.y / length * speed;
            direction.z = direction.z / length * speed;
        }

        // Update velocity
        this.camera.velocity = direction;
    }

    // Update camera position
    updateCamera() {
        this.camera.position.x += this.camera.velocity.x;
        this.camera.position.y += this.camera.velocity.y;
        this.camera.position.z += this.camera.velocity.z;
    }

    // Send position update to server
    sendPositionUpdate() {
        this.send({
            type: 'move',
            position: this.camera.position,
            rotation: this.camera.rotation,
            velocity: this.camera.velocity
        });
    }

    // Update UI elements
    updateUI() {
        // Update coordinates display
        document.getElementById('coordinates').textContent = 
            `${Math.floor(this.camera.position.x)}, ${Math.floor(this.camera.position.y)}, ${Math.floor(this.camera.position.z)}`;

        // Update health display
        document.getElementById('health').textContent = this.health;

        // Update $OINK balance display
        document.getElementById('oink-balance').textContent = `${this.oinkBalance} $OINK`;
    }

    // Render game
    render() {
        // Clear canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Render world
        this.renderWorld();

        // Render entities
        this.renderEntities();

        // Render UI
        this.renderUI();
    }

    // Render world
    renderWorld() {
        // Implement 3D rendering of voxels
        // This is a placeholder for actual 3D rendering
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Render entities
    renderEntities() {
        // Render other players
        for (const [id, player] of this.players) {
            if (id !== this.playerId) {
                // Implement player model rendering
            }
        }
    }

    // Render UI elements
    renderUI() {
        // UI elements are handled by HTML/CSS
    }

    // Break block
    breakBlock() {
        const target = this.getTargetBlock();
        if (target) {
            this.send({
                type: 'break_block',
                position: target.position
            });
        }
    }

    // Place block
    placeBlock() {
        const target = this.getTargetBlock();
        if (target) {
            this.send({
                type: 'place_block',
                position: target.position,
                blockType: this.inventory[this.selectedSlot]
            });
        }
    }

    // Get target block
    getTargetBlock() {
        // Implement ray casting to find target block
        return null; // Placeholder
    }

    // Send message to server
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    // Utility functions
    getChunkKeyFromPosition(position) {
        const chunkX = Math.floor(position.x / 32);
        const chunkY = Math.floor(position.y / 32);
        const chunkZ = Math.floor(position.z / 32);
        return `${chunkX},${chunkY},${chunkZ}`;
    }

    worldToLocalCoords(position) {
        return {
            x: ((position.x % 32) + 32) % 32,
            y: ((position.y % 32) + 32) % 32,
            z: ((position.z % 32) + 32) % 32
        };
    }

    getVoxelIndex(position) {
        return (position.y * 32 * 32) + (position.z * 32) + position.x;
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    const game = new GameClient();
});