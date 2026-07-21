const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

// FIX 1: Change origin to "*" so Vercel can communicate with the backend
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const roomData = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    if (!roomData[roomId]) roomData[roomId] = [];
    socket.emit('load_canvas', roomData[roomId]);
  });

  socket.on('draw', (data) => {
    const { roomId } = data;
    if (!roomData[roomId]) roomData[roomId] = [];
    roomData[roomId].push(data);
    socket.to(roomId).emit('receive_draw', data);
  });

  socket.on('clear_board', (roomId) => {
    roomData[roomId] = []; 
    socket.to(roomId).emit('board_cleared'); 
  });
});

// FIX 2: Allow Render to inject its own dynamic port, falling back to 3001 for local testing
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});