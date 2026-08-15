import { WebSocketServer, WebSocket } from 'ws';
import http from 'node:http';

const PORT = 8080;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
  res.end('Gridiron Copilot WebSocket Relay Server Running\n');
});

const wss = new WebSocketServer({ server });
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[WS Relay] Client connected (Total: ${clients.size})`);

  ws.on('message', (data) => {
    const msgStr = data.toString();
    for (const client of clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(msgStr);
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS Relay] Client disconnected (Total: ${clients.size})`);
  });

  ws.on('error', (err) => {
    console.error('[WS Relay] Socket error:', err.message);
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 [Gridiron Copilot] WebSocket Relay Server running on ws://localhost:${PORT}\n`);
});
