const Vector3 = require('../math/Vector3');

class VoxelEngine {
    constructor() {
        this.CHUNK_SIZE = 32; // 32x32x32 chunks
        this.MAX_HEIGHT = 256;
        this.SEED = Date.now(); // Random seed for world generation
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

    // Get voxel index in chunk array
    getVoxelIndex(x, y, z) {
        return (y * this.CHUNK_SIZE * this.CHUNK_SIZE) + (z * this.CHUNK_SIZE) + x;
    }

    // Create a new empty chunk
    createEmptyChunk() {
        return {
            voxels: new Uint8Array(this.CHUNK_SIZE * this.CHUNK_SIZE * this.CHUNK_SIZE),
            modified: false,
            lastAccessed: Date.now()
        };
    }

    // Set voxel in chunk
    setVoxel(chunk, x, y, z, value) {
        const index = this.getVoxelIndex(x, y, z);
        if (index >= 0 && index < chunk.voxels.length) {
            chunk.voxels[index] = value;
            chunk.modified = true;
            return true;
        }
        return false;
    }

    // Get voxel from chunk
    getVoxel(chunk, x, y, z) {
        const index = this.getVoxelIndex(x, y, z);
        if (index >= 0 && index < chunk.voxels.length) {
            return chunk.voxels[index];
        }
        return 0; // Air/empty space
    }

    // Check if coordinates are within chunk bounds
    isInChunkBounds(x, y, z) {
        return x >= 0 && x < this.CHUNK_SIZE &&
               y >= 0 && y < this.CHUNK_SIZE &&
               z >= 0 && z < this.CHUNK_SIZE;
    }

    // Generate chunk key for storage
    generateChunkKey(chunkX, chunkY, chunkZ) {
        return `${chunkX},${chunkY},${chunkZ}`;
    }

    // Ray casting for interaction
    raycast(origin, direction, maxDistance) {
        const ray = new Vector3(direction.x, direction.y, direction.z).normalize();
        let distance = 0;
        
        while (distance < maxDistance) {
            const x = Math.floor(origin.x + ray.x * distance);
            const y = Math.floor(origin.y + ray.y * distance);
            const z = Math.floor(origin.z + ray.z * distance);
            
            const chunk = this.worldToChunkCoords(x, y, z);
            const local = this.worldToLocalCoords(x, y, z);
            
            // Return hit information
            return {
                position: { x, y, z },
                chunk: chunk,
                local: local,
                distance: distance
            };
            
            distance += 0.1; // Step size for ray
        }
        
        return null; // No hit within maxDistance
    }

    // Collision detection
    checkCollision(position, bounds) {
        const minX = Math.floor(position.x - bounds.x / 2);
        const minY = Math.floor(position.y - bounds.y / 2);
        const minZ = Math.floor(position.z - bounds.z / 2);
        const maxX = Math.ceil(position.x + bounds.x / 2);
        const maxY = Math.ceil(position.y + bounds.y / 2);
        const maxZ = Math.ceil(position.z + bounds.z / 2);

        // Check each point for collision
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const chunk = this.worldToChunkCoords(x, y, z);
                    const local = this.worldToLocalCoords(x, y, z);
                    
                    // If voxel exists at this position, collision detected
                    if (this.getVoxel(chunk, local.x, local.y, local.z) !== 0) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
}

module.exports = { VoxelEngine };