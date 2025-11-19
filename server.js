import { startServer } from './app_server.js';

// Start Deno WebSocket server for local dev alongside Live Server
startServer(8081, '0.0.0.0');
