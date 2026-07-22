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

// rooms[roomId] = {
//   hostUid: string | null,       // uid of whoever is currently admin
//   hostSocketId: string | null,  // that admin's *current* live socket id
//   participants: { [socketId]: { uid, name } },  // approved, currently connected
//   pending: { [socketId]: { uid, name } },        // waiting on host approval
//   history: [],                                    // sequence of draw events (each tagged with userId)
// }
const rooms = {};

function getRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = { hostUid: null, hostSocketId: null, participants: {}, pending: {}, history: [], undone: {} };
  }
  return rooms[roomId];
}

function broadcastParticipants(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  const list = Object.entries(room.participants).map(([socketId, info]) => ({
    socketId, uid: info.uid, name: info.name, isHost: info.uid === room.hostUid,
  }));
  io.to(roomId).emit('participants_update', list);
}

function handleLeave(socket) {
  const roomId = socket.data.roomId;
  if (!roomId || !rooms[roomId]) return;
  const room = rooms[roomId];

  delete room.participants[socket.id];
  delete room.pending[socket.id];

  if (room.hostSocketId === socket.id) {
    // Promote the next remaining participant so the room isn't stuck without an admin.
    const remaining = Object.entries(room.participants);
    if (remaining.length > 0) {
      const [newHostSocketId, info] = remaining[0];
      room.hostUid = info.uid;
      room.hostSocketId = newHostSocketId;
      io.to(newHostSocketId).emit('you_are_now_host');
    } else {
      room.hostUid = null;
      room.hostSocketId = null;
    }
  }

  broadcastParticipants(roomId);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', ({ roomId, user }) => {
    if (!roomId || !user || !user.uid) return;
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.uid = user.uid;
    socket.data.name = user.name;

    const room = getRoom(roomId);

    // Nobody holds the room yet, or this uid IS the current host reconnecting
    // (e.g. page refresh) — auto-admit as admin.
    if (!room.hostUid || room.hostUid === user.uid) {
      room.hostUid = user.uid;
      room.hostSocketId = socket.id;
      room.participants[socket.id] = { uid: user.uid, name: user.name };
      socket.emit('join_approved', { isHost: true });
      socket.emit('load_canvas', room.history);
      broadcastParticipants(roomId);
      return;
    }

    // Already an approved participant reconnecting (matched by uid, since
    // socket ids change on reconnect) — let them straight back in.
    const alreadyApproved = Object.values(room.participants).some((p) => p.uid === user.uid);
    if (alreadyApproved) {
      room.participants[socket.id] = { uid: user.uid, name: user.name };
      socket.emit('join_approved', { isHost: false });
      socket.emit('load_canvas', room.history);
      broadcastParticipants(roomId);
      return;
    }

    // Otherwise: needs the host to approve them first.
    room.pending[socket.id] = { uid: user.uid, name: user.name };
    socket.emit('waiting_approval');
    if (room.hostSocketId) {
      io.to(room.hostSocketId).emit('join_request', { socketId: socket.id, uid: user.uid, name: user.name });
    }
  });

  socket.on('approve_join', ({ roomId, socketId }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostSocketId) return; // only the current host can approve
    const pendingUser = room.pending[socketId];
    if (!pendingUser) return;
    delete room.pending[socketId];
    room.participants[socketId] = pendingUser;
    io.to(socketId).emit('join_approved', { isHost: false });
    io.to(socketId).emit('load_canvas', room.history);
    broadcastParticipants(roomId);
  });

  socket.on('deny_join', ({ roomId, socketId }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostSocketId) return; // only the current host can deny
    delete room.pending[socketId];
    io.to(socketId).emit('join_denied');
  });

  socket.on('draw', (data) => {
    const room = rooms[data.roomId];
    if (!room || !room.participants[socket.id]) return; // must be an approved participant
    // Trust the room's own record of who's connected as this socket, not
    // whatever userId the client claims, so people can't draw as someone else.
    const uid = room.participants[socket.id].uid;
    data.userId = uid;
    room.history.push(data);
    if (room.undone[uid]) room.undone[uid] = []; // a fresh stroke invalidates old redo history
    socket.to(data.roomId).emit('receive_draw', data);
  });

  socket.on('undo_stroke', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.participants[socket.id]) return;
    const uid = room.participants[socket.id].uid;

    // Find this user's most recent stroke still in the history.
    let strokeId = null;
    for (let i = room.history.length - 1; i >= 0; i--) {
      if (room.history[i].userId === uid) { strokeId = room.history[i].strokeId; break; }
    }
    if (!strokeId) return;

    const removed = room.history.filter((e) => e.userId === uid && e.strokeId === strokeId);
    room.history = room.history.filter((e) => !(e.userId === uid && e.strokeId === strokeId));
    if (!room.undone[uid]) room.undone[uid] = [];
    room.undone[uid].push(removed);

    io.to(roomId).emit('history_sync', room.history);
  });

  socket.on('redo_stroke', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.participants[socket.id]) return;
    const uid = room.participants[socket.id].uid;
    if (!room.undone[uid] || room.undone[uid].length === 0) return;

    const restored = room.undone[uid].pop();
    room.history.push(...restored);
    io.to(roomId).emit('history_sync', room.history);
  });

  socket.on('clear_board', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostSocketId) return; // admin-only
    room.history = [];
    io.to(roomId).emit('board_cleared');
  });

  socket.on('leave_room', () => handleLeave(socket));
  socket.on('disconnect', () => handleLeave(socket));
});

// FIX 2: Allow Render to inject its own dynamic port, falling back to 3001 for local testing
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
