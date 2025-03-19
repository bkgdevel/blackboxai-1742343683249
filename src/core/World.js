const { TerrainGenerator } = require('../generation/TerrainGenerator');
const { ChunkManager } = require('./ChunkManager');

class World {
    constructor() {
        this.chunkManager = new ChunkManager();
        this.terrainGenerator = new TerrainGenerator();
        this.entities = new Map(); // Store active entities
        this.players = new Map();  // Store active players
        this.lastUpdate = Date.now();
        
        // World settings
        this.settings = {
            gravity: -9.81,
            maxEntities: 1000,
            viewDistance: 8, // chunks
            tickRate: 20     // ticks per second
        };
    }

    // Update world state
    update() {
        const now = Date.now();
        const deltaTime = (now - this.lastUpdate) / 1000; // Convert to seconds
        this.lastUpdate = now;

        // Update all entities
        for (const [id, entity] of this.entities) {
            this.updateEntity(entity, deltaTime);
        }

        // Update all players
        for (const [id, player] of this.players) {
            this.updatePlayer(player, deltaTime);
        }

        // Update chunk loading/unloading
        this.chunkManager.update();
    }

    // Update entity physics and state
    updateEntity(entity, deltaTime) {
        // Apply gravity
        entity.velocity.y += this.settings.gravity * deltaTime;

        // Update position based on velocity
        const newPosition = {
            x: entity.position.x + entity.velocity.x * deltaTime,
            y: entity.position.y + entity.velocity.y * deltaTime,
            z: entity.position.z + entity.velocity.z * deltaTime
        };

        // Check for collisions before applying new position
        if (!this.checkCollision(newPosition, entity.bounds)) {
            entity.position = newPosition;
        } else {
            // Handle collision response
            entity.velocity = { x: 0, y: 0, z: 0 };
        }

        // Update entity state
        if (entity.update) {
            entity.update(deltaTime);
        }
    }

    // Update player state
    updatePlayer(player, deltaTime) {
        // Update player physics similar to entities
        this.updateEntity(player, deltaTime);

        // Update chunk loading based on player position
        const playerChunkPos = this.chunkManager.worldToChunkCoords(
            player.position.x,
            player.position.y,
            player.position.z
        );

        // Load chunks in view distance
        for (let x = -this.settings.viewDistance; x <= this.settings.viewDistance; x++) {
            for (let y = -this.settings.viewDistance; y <= this.settings.viewDistance; y++) {
                for (let z = -this.settings.viewDistance; z <= this.settings.viewDistance; z++) {
                    const chunkX = playerChunkPos.x + x;
                    const chunkY = playerChunkPos.y + y;
                    const chunkZ = playerChunkPos.z + z;

                    // Generate or load chunk if not exists
                    if (!this.chunkManager.hasChunk(chunkX, chunkY, chunkZ)) {
                        const chunk = this.terrainGenerator.generateChunk(chunkX, chunkY, chunkZ);
                        this.chunkManager.setChunk(chunkX, chunkY, chunkZ, chunk);
                    }
                }
            }
        }
    }

    // Add entity to world
    addEntity(entity) {
        if (this.entities.size >= this.settings.maxEntities) {
            throw new Error('Maximum entity limit reached');
        }
        this.entities.set(entity.id, entity);
    }

    // Remove entity from world
    removeEntity(entityId) {
        this.entities.delete(entityId);
    }

    // Add player to world
    addPlayer(player) {
        this.players.set(player.id, player);
    }

    // Remove player from world
    removePlayer(playerId) {
        this.players.delete(playerId);
    }

    // Get chunk at world coordinates
    getChunkAtPosition(x, y, z) {
        const chunkPos = this.chunkManager.worldToChunkCoords(x, y, z);
        return this.chunkManager.getChunk(chunkPos.x, chunkPos.y, chunkPos.z);
    }

    // Set voxel at world coordinates
    setVoxel(x, y, z, value) {
        const chunk = this.getChunkAtPosition(x, y, z);
        if (chunk) {
            const localPos = this.chunkManager.worldToLocalCoords(x, y, z);
            return this.chunkManager.setVoxel(chunk, localPos.x, localPos.y, localPos.z, value);
        }
        return false;
    }

    // Get voxel at world coordinates
    getVoxel(x, y, z) {
        const chunk = this.getChunkAtPosition(x, y, z);
        if (chunk) {
            const localPos = this.chunkManager.worldToLocalCoords(x, y, z);
            return this.chunkManager.getVoxel(chunk, localPos.x, localPos.y, localPos.z);
        }
        return 0; // Return air if chunk doesn't exist
    }

    // Check collision at world coordinates
    checkCollision(position, bounds) {
        return this.chunkManager.checkCollision(position, bounds);
    }

    // Save world state
    async save() {
        // Implement world state serialization
        const worldState = {
            chunks: this.chunkManager.serialize(),
            entities: Array.from(this.entities.entries()),
            players: Array.from(this.players.entries()),
            settings: this.settings
        };
        return worldState;
    }

    // Load world state
    async load(worldState) {
        // Implement world state deserialization
        this.settings = worldState.settings;
        this.chunkManager.deserialize(worldState.chunks);
        
        this.entities.clear();
        for (const [id, entity] of worldState.entities) {
            this.entities.set(id, entity);
        }

        this.players.clear();
        for (const [id, player] of worldState.players) {
            this.players.set(id, player);
        }
    }
}

module.exports = { World };