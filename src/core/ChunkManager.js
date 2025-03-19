const { Vector3 } = require('../math/Vector3');

class ChunkManager {
    constructor() {
        this.chunks = new Map();
        this.CHUNK_SIZE = 32;
        this.UNLOAD_TIMEOUT = 30000; // 30 seconds
        this.maxLoadedChunks = 512;  // Maximum chunks to keep in memory
    }

    // Generate unique key for chunk coordinates
    getChunkKey(x, y, z) {
        return `${x},${y},${z}`;
    }

    // Get chunk at coordinates
    getChunk(x, y, z) {
        const key = this.getChunkKey(x, y, z);
        const chunk = this.chunks.get(key);
        if (chunk) {
            chunk.lastAccessed = Date.now();
        }
        return chunk;
    }

    // Set chunk at coordinates
    setChunk(x, y, z, chunk) {
        const key = this.getChunkKey(x, y, z);
        chunk.lastAccessed = Date.now();
        this.chunks.set(key, chunk);

        // Unload old chunks if we exceed the maximum
        if (this.chunks.size > this.maxLoadedChunks) {
            this.unloadOldChunks();
        }
    }

    // Check if chunk exists
    hasChunk(x, y, z) {
        return this.chunks.has(this.getChunkKey(x, y, z));
    }

    // Convert world coordinates to chunk coordinates
    worldToChunkCoords(x, y, z) {
        return {
            x: Math.floor(x / this.CHUNK_SIZE),
            y: Math.floor(y / this.CHUNK_SIZE),
            z: Math.floor(z / this.CHUNK_SIZE)
        };
    }

    // Convert world coordinates to local chunk coordinates
    worldToLocalCoords(x, y, z) {
        return {
            x: ((x % this.CHUNK_SIZE) + this.CHUNK_SIZE) % this.CHUNK_SIZE,
            y: ((y % this.CHUNK_SIZE) + this.CHUNK_SIZE) % this.CHUNK_SIZE,
            z: ((z % this.CHUNK_SIZE) + this.CHUNK_SIZE) % this.CHUNK_SIZE
        };
    }

    // Get voxel at local coordinates within chunk
    getVoxel(chunk, x, y, z) {
        if (!this.isInChunkBounds(x, y, z)) {
            return 0;
        }
        const index = this.getVoxelIndex(x, y, z);
        return chunk.voxels[index];
    }

    // Set voxel at local coordinates within chunk
    setVoxel(chunk, x, y, z, value) {
        if (!this.isInChunkBounds(x, y, z)) {
            return false;
        }
        const index = this.getVoxelIndex(x, y, z);
        chunk.voxels[index] = value;
        chunk.modified = true;
        return true;
    }

    // Calculate voxel index in chunk array
    getVoxelIndex(x, y, z) {
        return (y * this.CHUNK_SIZE * this.CHUNK_SIZE) + (z * this.CHUNK_SIZE) + x;
    }

    // Check if coordinates are within chunk bounds
    isInChunkBounds(x, y, z) {
        return x >= 0 && x < this.CHUNK_SIZE &&
               y >= 0 && y < this.CHUNK_SIZE &&
               z >= 0 && z < this.CHUNK_SIZE;
    }

    // Create a new empty chunk
    createEmptyChunk() {
        return {
            voxels: new Uint8Array(this.CHUNK_SIZE * this.CHUNK_SIZE * this.CHUNK_SIZE),
            modified: false,
            lastAccessed: Date.now()
        };
    }

    // Unload chunks that haven't been accessed recently
    unloadOldChunks() {
        const now = Date.now();
        for (const [key, chunk] of this.chunks) {
            if (now - chunk.lastAccessed > this.UNLOAD_TIMEOUT) {
                // Save modified chunks before unloading
                if (chunk.modified) {
                    this.saveChunk(key, chunk);
                }
                this.chunks.delete(key);
            }
        }
    }

    // Save chunk to persistent storage
    async saveChunk(key, chunk) {
        try {
            // Implement chunk serialization and storage
            // This could save to a database or file system
            const chunkData = {
                voxels: Array.from(chunk.voxels),
                modified: false,
                lastAccessed: chunk.lastAccessed
            };
            
            // Example storage (implement actual storage mechanism)
            console.log(`Saving chunk ${key}`);
            return true;
        } catch (error) {
            console.error(`Error saving chunk ${key}:`, error);
            return false;
        }
    }

    // Load chunk from persistent storage
    async loadChunk(key) {
        try {
            // Implement chunk loading from storage
            // This could load from a database or file system
            console.log(`Loading chunk ${key}`);
            
            // Example loading (implement actual loading mechanism)
            const chunk = this.createEmptyChunk();
            return chunk;
        } catch (error) {
            console.error(`Error loading chunk ${key}:`, error);
            return null;
        }
    }

    // Update chunk manager state
    update() {
        // Unload old chunks
        this.unloadOldChunks();
    }

    // Check collision with voxels
    checkCollision(position, bounds) {
        const minChunk = this.worldToChunkCoords(
            position.x - bounds.x/2,
            position.y - bounds.y/2,
            position.z - bounds.z/2
        );
        const maxChunk = this.worldToChunkCoords(
            position.x + bounds.x/2,
            position.y + bounds.y/2,
            position.z + bounds.z/2
        );

        // Check each chunk that the bounds could intersect with
        for (let x = minChunk.x; x <= maxChunk.x; x++) {
            for (let y = minChunk.y; y <= maxChunk.y; y++) {
                for (let z = minChunk.z; z <= maxChunk.z; z++) {
                    const chunk = this.getChunk(x, y, z);
                    if (!chunk) continue;

                    // Check voxels within the chunk
                    if (this.checkChunkCollision(chunk, position, bounds)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // Check collision within a specific chunk
    checkChunkCollision(chunk, position, bounds) {
        const localMin = this.worldToLocalCoords(
            position.x - bounds.x/2,
            position.y - bounds.y/2,
            position.z - bounds.z/2
        );
        const localMax = this.worldToLocalCoords(
            position.x + bounds.x/2,
            position.y + bounds.y/2,
            position.z + bounds.z/2
        );

        // Check each voxel in the local bounds
        for (let x = localMin.x; x <= localMax.x; x++) {
            for (let y = localMin.y; y <= localMax.y; y++) {
                for (let z = localMin.z; z <= localMax.z; z++) {
                    if (this.isInChunkBounds(x, y, z)) {
                        if (this.getVoxel(chunk, x, y, z) !== 0) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    // Serialize chunk manager state
    serialize() {
        const serializedChunks = {};
        for (const [key, chunk] of this.chunks) {
            if (chunk.modified) {
                serializedChunks[key] = {
                    voxels: Array.from(chunk.voxels),
                    modified: false,
                    lastAccessed: chunk.lastAccessed
                };
            }
        }
        return serializedChunks;
    }

    // Deserialize chunk manager state
    deserialize(serializedChunks) {
        this.chunks.clear();
        for (const [key, chunkData] of Object.entries(serializedChunks)) {
            const chunk = {
                voxels: new Uint8Array(chunkData.voxels),
                modified: false,
                lastAccessed: chunkData.lastAccessed
            };
            this.chunks.set(key, chunk);
        }
    }
}

module.exports = { ChunkManager };