class TerrainGenerator {
    constructor(seed = Date.now()) {
        this.seed = seed;
        this.CHUNK_SIZE = 32;
        
        // Terrain generation parameters
        this.params = {
            baseHeight: 64,
            heightScale: 32,
            roughness: 0.5,
            persistence: 0.5,
            octaves: 4,
            scale: 100,
            biomeScale: 200
        };

        // Biome definitions
        this.biomes = {
            PLAINS: {
                id: 0,
                heightScale: 0.3,
                roughness: 0.3
            },
            MOUNTAINS: {
                id: 1,
                heightScale: 1.0,
                roughness: 0.8
            },
            DESERT: {
                id: 2,
                heightScale: 0.2,
                roughness: 0.2
            },
            CYBERCITY: {
                id: 3,
                heightScale: 0.5,
                roughness: 0.9
            }
        };
    }

    // Generate 2D noise for terrain height
    noise2D(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        
        x -= Math.floor(x);
        y -= Math.floor(y);
        
        const u = this.fade(x);
        const v = this.fade(y);
        
        const A = this.p[X] + Y;
        const B = this.p[X + 1] + Y;
        
        return this.lerp(v,
            this.lerp(u,
                this.grad(this.p[A], x, y),
                this.grad(this.p[B], x - 1, y)
            ),
            this.lerp(u,
                this.grad(this.p[A + 1], x, y - 1),
                this.grad(this.p[B + 1], x - 1, y - 1)
            )
        );
    }

    // Fade function for noise smoothing
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    // Linear interpolation
    lerp(t, a, b) {
        return a + t * (b - a);
    }

    // Gradient function for noise
    grad(hash, x, y) {
        const h = hash & 15;
        const grad = 1 + (h & 7);
        return ((h & 8) ? -grad : grad) * x + ((h & 4) ? -grad : grad) * y;
    }

    // Generate permutation table
    generatePermutationTable() {
        this.p = new Array(512);
        for (let i = 0; i < 256; i++) {
            this.p[i] = i;
        }

        // Fisher-Yates shuffle with seed
        let random = this.seed;
        for (let i = 255; i > 0; i--) {
            random = (random * 16807) % 2147483647;
            const j = random % (i + 1);
            [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
        }

        // Duplicate the permutation table
        for (let i = 0; i < 256; i++) {
            this.p[256 + i] = this.p[i];
        }
    }

    // Get biome at coordinates
    getBiome(x, z) {
        const value = this.noise2D(x / this.params.biomeScale, z / this.params.biomeScale);
        
        if (value < -0.5) return this.biomes.DESERT;
        if (value < 0) return this.biomes.PLAINS;
        if (value < 0.5) return this.biomes.MOUNTAINS;
        return this.biomes.CYBERCITY;
    }

    // Generate height at coordinates
    generateHeight(x, z) {
        const biome = this.getBiome(x, z);
        let height = this.params.baseHeight;
        
        // Apply octaves of noise
        let amplitude = 1;
        let frequency = 1;
        let maxAmplitude = 0;
        
        for (let i = 0; i < this.params.octaves; i++) {
            const sampleX = x * frequency / this.params.scale;
            const sampleZ = z * frequency / this.params.scale;
            
            height += this.noise2D(sampleX, sampleZ) * amplitude * biome.heightScale;
            
            maxAmplitude += amplitude;
            amplitude *= this.params.persistence;
            frequency *= 2;
        }
        
        // Normalize height
        height /= maxAmplitude;
        
        // Apply biome-specific modifications
        height *= this.params.heightScale * biome.heightScale;
        height += this.params.baseHeight;
        
        return Math.floor(height);
    }

    // Generate chunk at coordinates
    generateChunk(chunkX, chunkY, chunkZ) {
        const chunk = {
            voxels: new Uint8Array(this.CHUNK_SIZE * this.CHUNK_SIZE * this.CHUNK_SIZE),
            modified: false,
            lastAccessed: Date.now()
        };

        // Generate terrain for chunk
        for (let x = 0; x < this.CHUNK_SIZE; x++) {
            for (let z = 0; z < this.CHUNK_SIZE; z++) {
                const worldX = chunkX * this.CHUNK_SIZE + x;
                const worldZ = chunkZ * this.CHUNK_SIZE + z;
                
                const height = this.generateHeight(worldX, worldZ);
                const biome = this.getBiome(worldX, worldZ);

                // Fill chunk with voxels
                for (let y = 0; y < this.CHUNK_SIZE; y++) {
                    const worldY = chunkY * this.CHUNK_SIZE + y;
                    
                    if (worldY < height) {
                        // Underground layers
                        if (worldY < height - 4) {
                            this.setVoxel(chunk, x, y, z, 2); // Stone
                        } else {
                            switch(biome.id) {
                                case this.biomes.DESERT.id:
                                    this.setVoxel(chunk, x, y, z, 3); // Sand
                                    break;
                                case this.biomes.CYBERCITY.id:
                                    this.setVoxel(chunk, x, y, z, 4); // Metal/Concrete
                                    break;
                                default:
                                    this.setVoxel(chunk, x, y, z, 1); // Dirt/Grass
                            }
                        }
                    } else if (worldY === height) {
                        // Surface layer
                        switch(biome.id) {
                            case this.biomes.DESERT.id:
                                this.setVoxel(chunk, x, y, z, 3); // Sand
                                break;
                            case this.biomes.CYBERCITY.id:
                                this.setVoxel(chunk, x, y, z, 4); // Metal/Concrete
                                break;
                            default:
                                this.setVoxel(chunk, x, y, z, 5); // Grass
                        }
                    }
                    // Air above surface (default 0)
                }
            }
        }

        // Generate cyberpunk structures in CYBERCITY biome
        if (this.getBiome(chunkX * this.CHUNK_SIZE, chunkZ * this.CHUNK_SIZE).id === this.biomes.CYBERCITY.id) {
            this.generateCyberpunkStructures(chunk, chunkX, chunkY, chunkZ);
        }

        return chunk;
    }

    // Set voxel in chunk
    setVoxel(chunk, x, y, z, value) {
        const index = (y * this.CHUNK_SIZE * this.CHUNK_SIZE) + (z * this.CHUNK_SIZE) + x;
        if (index >= 0 && index < chunk.voxels.length) {
            chunk.voxels[index] = value;
            chunk.modified = true;
        }
    }

    // Generate cyberpunk structures
    generateCyberpunkStructures(chunk, chunkX, chunkY, chunkZ) {
        // Use noise to determine building placement
        const buildingNoise = this.noise2D(chunkX, chunkZ);
        
        if (buildingNoise > 0.3) {
            // Generate a cyberpunk building
            const height = Math.floor(this.CHUNK_SIZE * 0.8);
            const width = Math.floor(this.CHUNK_SIZE * 0.6);
            const depth = Math.floor(this.CHUNK_SIZE * 0.6);
            
            const startX = Math.floor((this.CHUNK_SIZE - width) / 2);
            const startZ = Math.floor((this.CHUNK_SIZE - depth) / 2);
            
            // Build the main structure
            for (let x = startX; x < startX + width; x++) {
                for (let z = startZ; z < startZ + depth; z++) {
                    for (let y = 0; y < height; y++) {
                        // Walls
                        if (x === startX || x === startX + width - 1 ||
                            z === startZ || z === startZ + depth - 1) {
                            this.setVoxel(chunk, x, y, z, 6); // Metal wall
                        }
                        // Windows
                        else if (y % 4 === 0) {
                            this.setVoxel(chunk, x, y, z, 7); // Glass
                        }
                        // Interior
                        else {
                            this.setVoxel(chunk, x, y, z, 0); // Empty
                        }
                    }
                }
            }

            // Add neon signs and decorations
            this.addNeonDecorations(chunk, startX, startZ, width, depth, height);
        }
    }

    // Add neon decorations to buildings
    addNeonDecorations(chunk, startX, startZ, width, depth, height) {
        // Add neon signs at random positions
        for (let i = 0; i < 3; i++) {
            const x = startX + Math.floor(Math.random() * width);
            const z = startZ + Math.floor(Math.random() * depth);
            const y = Math.floor(height * 0.7) + i * 2;
            
            // Create small neon sign
            this.setVoxel(chunk, x, y, z, 8); // Neon block
            this.setVoxel(chunk, x + 1, y, z, 8);
            this.setVoxel(chunk, x, y + 1, z, 8);
        }
    }
}

module.exports = { TerrainGenerator };