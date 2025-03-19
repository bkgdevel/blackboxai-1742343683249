class ClientHandler {
    constructor(ws, world, voxelEngine) {
        this.ws = ws;
        this.world = world;
        this.voxelEngine = voxelEngine;
        this.playerId = null;
        this.lastUpdate = Date.now();
        this.updateRate = 50; // Send updates every 50ms
        
        // Message handlers
        this.messageHandlers = {
            'join': this.handleJoin.bind(this),
            'move': this.handleMove.bind(this),
            'place_block': this.handlePlaceBlock.bind(this),
            'break_block': this.handleBreakBlock.bind(this),
            'request_chunks': this.handleRequestChunks.bind(this),
            'chat': this.handleChat.bind(this),
            'interact': this.handleInteract.bind(this)
        };
    }

    // Handle incoming messages
    handleMessage(data) {
        try {
            if (this.messageHandlers[data.type]) {
                this.messageHandlers[data.type](data);
            } else {
                console.warn(`Unknown message type: ${data.type}`);
            }
        } catch (error) {
            console.error('Error handling message:', error);
            this.sendError('Error processing request');
        }
    }

    // Send message to client
    send(message) {
        if (this.ws.readyState === this.ws.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    // Send error message to client
    sendError(message) {
        this.send({
            type: 'error',
            message: message
        });
    }

    // Handle player join request
    handleJoin(data) {
        this.playerId = data.playerId || Date.now().toString();
        
        // Create player entity
        const player = {
            id: this.playerId,
            position: { x: 0, y: 100, z: 0 }, // Spawn position
            rotation: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            bounds: { x: 0.6, y: 1.8, z: 0.6 }, // Player hitbox
            type: 'player'
        };

        // Add player to world
        this.world.addPlayer(player);

        // Send initial game state
        this.sendInitialState();

        // Broadcast join message
        this.broadcast({
            type: 'player_joined',
            player: {
                id: player.id,
                position: player.position,
                rotation: player.rotation
            }
        });
    }

    // Handle player movement
    handleMove(data) {
        const player = this.world.players.get(this.playerId);
        if (!player) return;

        // Update player position and rotation
        player.position = data.position;
        player.rotation = data.rotation;
        player.velocity = data.velocity;

        // Broadcast player movement to other clients
        this.broadcast({
            type: 'player_moved',
            playerId: this.playerId,
            position: player.position,
            rotation: player.rotation
        }, true); // Exclude self from broadcast
    }

    // Handle block placement
    handlePlaceBlock(data) {
        const { x, y, z, blockType } = data;
        
        // Validate block placement
        if (this.isValidBlockPlacement(x, y, z)) {
            this.world.setVoxel(x, y, z, blockType);
            
            // Broadcast block update
            this.broadcast({
                type: 'block_update',
                position: { x, y, z },
                blockType: blockType
            });
        }
    }

    // Handle block breaking
    handleBreakBlock(data) {
        const { x, y, z } = data;
        
        // Validate block breaking
        if (this.isValidBlockBreak(x, y, z)) {
            this.world.setVoxel(x, y, z, 0); // 0 = air
            
            // Broadcast block update
            this.broadcast({
                type: 'block_update',
                position: { x, y, z },
                blockType: 0
            });
        }
    }

    // Handle chunk request
    handleRequestChunks(data) {
        const { chunks } = data;
        const chunkData = {};

        // Get requested chunks
        for (const coord of chunks) {
            const chunk = this.world.getChunkAtPosition(coord.x, coord.y, coord.z);
            if (chunk) {
                chunkData[`${coord.x},${coord.y},${coord.z}`] = {
                    voxels: Array.from(chunk.voxels),
                    modified: chunk.modified
                };
            }
        }

        // Send chunks to client
        this.send({
            type: 'chunk_data',
            chunks: chunkData
        });
    }

    // Handle chat messages
    handleChat(data) {
        // Broadcast chat message to all clients
        this.broadcast({
            type: 'chat',
            playerId: this.playerId,
            message: data.message
        });
    }

    // Handle player interaction
    handleInteract(data) {
        const { type, target } = data;
        
        // Handle different types of interactions
        switch (type) {
            case 'npc':
                this.handleNPCInteraction(target);
                break;
            case 'item':
                this.handleItemInteraction(target);
                break;
            case 'vehicle':
                this.handleVehicleInteraction(target);
                break;
        }
    }

    // Send initial game state to client
    sendInitialState() {
        const nearbyChunks = this.getNearbyChunks();
        const players = Array.from(this.world.players.values())
            .map(p => ({
                id: p.id,
                position: p.position,
                rotation: p.rotation
            }));

        this.send({
            type: 'initial_state',
            playerId: this.playerId,
            chunks: nearbyChunks,
            players: players,
            settings: {
                viewDistance: this.world.settings.viewDistance,
                gravity: this.world.settings.gravity
            }
        });
    }

    // Send world update to client
    sendWorldUpdate() {
        const now = Date.now();
        if (now - this.lastUpdate < this.updateRate) return;
        this.lastUpdate = now;

        // Get nearby entities and changes
        const updates = this.getWorldUpdates();
        
        if (Object.keys(updates).length > 0) {
            this.send({
                type: 'world_update',
                updates: updates
            });
        }
    }

    // Broadcast message to all clients
    broadcast(message, excludeSelf = false) {
        const clients = this.world.players.keys();
        for (const clientId of clients) {
            if (excludeSelf && clientId === this.playerId) continue;
            
            const client = this.world.players.get(clientId);
            if (client && client.ws.readyState === client.ws.OPEN) {
                client.ws.send(JSON.stringify(message));
            }
        }
    }

    // Get nearby chunks for initial state
    getNearbyChunks() {
        const chunks = {};
        const player = this.world.players.get(this.playerId);
        if (!player) return chunks;

        const chunkPos = this.voxelEngine.worldToChunkCoords(
            player.position.x,
            player.position.y,
            player.position.z
        );

        // Get chunks in view distance
        const viewDistance = this.world.settings.viewDistance;
        for (let x = -viewDistance; x <= viewDistance; x++) {
            for (let y = -viewDistance; y <= viewDistance; y++) {
                for (let z = -viewDistance; z <= viewDistance; z++) {
                    const chunk = this.world.getChunkAtPosition(
                        chunkPos.x + x,
                        chunkPos.y + y,
                        chunkPos.z + z
                    );
                    if (chunk) {
                        chunks[`${chunkPos.x + x},${chunkPos.y + y},${chunkPos.z + z}`] = {
                            voxels: Array.from(chunk.voxels),
                            modified: chunk.modified
                        };
                    }
                }
            }
        }

        return chunks;
    }

    // Get world updates for client
    getWorldUpdates() {
        const updates = {
            entities: [],
            blocks: [],
            events: []
        };

        // Add entity updates
        for (const entity of this.world.entities.values()) {
            updates.entities.push({
                id: entity.id,
                type: entity.type,
                position: entity.position,
                rotation: entity.rotation
            });
        }

        // Add block updates (if any chunks were modified)
        // Add game events (if any occurred)

        return updates;
    }

    // Validate block placement
    isValidBlockPlacement(x, y, z) {
        // Check if position is within world bounds
        // Check if player has permission to place block
        // Check if block can be placed at position
        return true; // Implement actual validation
    }

    // Validate block breaking
    isValidBlockBreak(x, y, z) {
        // Check if position is within world bounds
        // Check if player has permission to break block
        // Check if block can be broken
        return true; // Implement actual validation
    }

    // Handle NPC interaction
    handleNPCInteraction(target) {
        // Implement NPC interaction logic
    }

    // Handle item interaction
    handleItemInteraction(target) {
        // Implement item interaction logic
    }

    // Handle vehicle interaction
    handleVehicleInteraction(target) {
        // Implement vehicle interaction logic
    }
}

module.exports = { ClientHandler };