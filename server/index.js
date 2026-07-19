const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] }
});

// This acts as our temporary database for room state
// Structure: { "room-id-123": [ {x, y, isStarting, color, size}, ... ] }
const roomData = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    
    // If the room doesn't exist in memory yet, create an empty array for it
    if (!roomData[roomId]) {
      roomData[roomId] = [];
    }
    
    // When a user joins, instantly send them the entire drawing history
    socket.emit('load_canvas', roomData[roomId]);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('draw', (data) => {
    const { roomId } = data;
    if (!roomData[roomId]) roomData[roomId] = [];
    
    // Save the new coordinate to the room's history array
    roomData[roomId].push(data);
    
    // Broadcast it to everyone else in the room
    socket.to(roomId).emit('receive_draw', data);
  });

  // Handle a complete board wipe
  socket.on('clear_board', (roomId) => {
    roomData[roomId] = []; // Empty the server memory for this room
    socket.to(roomId).emit('board_cleared'); // Tell other clients to wipe their screens
  });
});

server.listen(3001, () => {
  console.log('Server is running on port 3001');
});