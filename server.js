const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { VoxelEngine } = require('./src/core/VoxelEngine');
const { World } = require('./src/core/World');
const { ClientHandler } = require('./src/networking/ClientHandler');

// Create HTTP server
const server = http.createServer((req, res) => {
    // Serve static files from public directory
    let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
    
    // Get the file extension
    const extname = path.extname(filePath);
    
    // Set content type based on file extension
    const contentType = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif'
    }[extname] || 'text/plain';

    // Read and serve the file
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Initialize WebSocket Server using the HTTP server
const wss = new WebSocket.Server({ server });

// Initialize Game Engine Components
const voxelEngine = new VoxelEngine();
const world = new World();

// Store connected clients
const clients = new Map();

wss.on('connection', (ws) => {
    console.log('New client connected');
    
    const clientHandler = new ClientHandler(ws, world, voxelEngine);
    const clientId = Date.now().toString();
    clients.set(clientId, clientHandler);

    // Handle incoming messages
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            clientHandler.handleMessage(data);
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(clientId);
    });

    // Send initial world state
    clientHandler.sendInitialState();
});

// Start the server
server.listen(8000, () => {
    console.log('Neo-Swine Voxel Server running on port 8000');
});

// World update loop
setInterval(() => {
    world.update();
    // Broadcast world updates to all clients
    for (const client of clients.values()) {
        client.sendWorldUpdate();
    }
}, 50); // 20 updates per second