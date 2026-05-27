const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 5e6
});

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('create-room', (callback) => {
    let code;
    do { code = generateRoomCode(); } while (rooms[code]);
    rooms[code] = { sender: socket.id, receiver: null };
    currentRoom = code;
    socket.join(code);
    callback({ code });
  });

  socket.on('join-room', (code, callback) => {
    const room = rooms[code];
    if (!room) return callback({ error: 'Room not found. Check the code and try again.' });
    if (room.receiver) return callback({ error: 'Room is full. Only two peers allowed.' });
    room.receiver = socket.id;
    currentRoom = code;
    socket.join(code);
    socket.to(code).emit('peer-joined');
    callback({ ok: true });
  });

  socket.on('signal', (data) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('signal', data);
  });

  socket.on('use-relay', () => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('use-relay');
  });

  socket.on('relay-meta', (meta) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('relay-meta', meta);
  });

  socket.on('relay-chunk', (chunk) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('relay-chunk', chunk);
  });

  socket.on('relay-done', () => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('relay-done');
  });

  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const room = rooms[currentRoom];
    if (!room) return;
    socket.to(currentRoom).emit('peer-disconnected');
    delete rooms[currentRoom];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`LiveShare signaling server running at http://localhost:${PORT}`);
});
