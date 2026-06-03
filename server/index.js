// require('dotenv').config();
// const express  = require('express');
// const http     = require('http');
// const { Server } = require('socket.io');
// const path     = require('path');
// const session  = require('express-session');
// const passport = require('passport');
// const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
console.log('STEP 1 - starting');
const express  = require('express');
console.log('STEP 2 - express OK');
const http     = require('http');
const { Server } = require('socket.io');
console.log('STEP 3 - socket.io OK');
const path     = require('path');
// require('dotenv').config();   // comentado temporalmente
console.log('STEP 4 - before passport');
const session  = require('express-session');
console.log('STEP 5 - session OK');
const passport = require('passport');
console.log('STEP 6 - passport OK');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
console.log('STEP 7 - google strategy OK');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});
console.log('ENV CHECK:', {
  GOOGLE_CLIENT_ID:     !!process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL:  process.env.GOOGLE_CALLBACK_URL,
  SESSION_SECRET:       !!process.env.SESSION_SECRET,
  PORT:                 process.env.PORT,
});
// ─── Auth ─────────────────────────────────────────────────────────────────────
passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.use(session({
  secret: process.env.SESSION_SECRET || 'cowork2d-secret-dev',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());

// ─── Auth routes ──────────────────────────────────────────────────────────────
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html' }),
  (req, res) => res.redirect('/')
);

app.get('/auth/logout', (req, res) => {
  req.logout(() => res.redirect('/login.html'));
});

// Endpoint para que el frontend sepa quién está logueado
app.get('/auth/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'not authenticated' });
  const { displayName, photos, emails } = req.user;
  res.json({
    name:   displayName,
    photo:  photos?.[0]?.value || null,
    email:  emails?.[0]?.value || null,
  });
});

// ─── ICE Servers (TURN credentials generadas server-side) ────────────────────
app.get('/api/ice-servers', (req, res) => {
  const domain    = process.env.METERED_DOMAIN;
  const secretKey = process.env.METERED_SECRET_KEY;
  if (!domain || !secretKey) {
    return res.json({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  }
  fetch(`https://${domain}/api/v1/turn/credential?secretKey=${secretKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'cowork2d' })
  })
  .then(r => r.json())
  .then(({ username, password }) => {
    res.json({ iceServers: [
      { urls: `stun:${domain}:80` },
      { urls: `turn:${domain}:80`,               username, credential: password },
      { urls: `turn:${domain}:80?transport=tcp`,  username, credential: password },
      { urls: `turn:${domain}:443`,               username, credential: password },
      { urls: `turn:${domain}:443?transport=tcp`, username, credential: password },
    ]});
  })
  .catch(() => res.json({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }));
});

// ─── Middleware: proteger la app principal ────────────────────────────────────
function requireAuth(req, res, next) {
  // Rutas públicas: login y assets de login
  if (req.path === '/login.html' || req.path.startsWith('/auth/') || req.path.startsWith('/css/') || req.path.startsWith('/js/')) {
    return next();
  }
  if (!req.isAuthenticated()) return res.redirect('/login.html');
  next();
}
app.use(requireAuth);
app.use(express.static(path.join(__dirname, '../public')));

// ─── State ────────────────────────────────────────────────────────────────────
const rooms = {};
const PROXIMITY_RADIUS = 120;

function getOrCreateRoom(roomId) {
  if (!rooms[roomId]) rooms[roomId] = { players: {}, chat: [] };
  return rooms[roomId];
}

function calcProximity(room) {
  const players = Object.values(room.players);
  const pairs = {};
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i], b = players[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const key = [a.id, b.id].sort().join(':');
      pairs[key] = dist < PROXIMITY_RADIUS;
    }
  }
  return pairs;
}

// ─── Socket handlers ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] ${socket.id} connected`);

  socket.on('join', ({ roomId, player }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    const room = getOrCreateRoom(roomId);
    room.players[socket.id] = {
      id:     socket.id,
      x:      400 + Math.random() * 200,
      y:      300 + Math.random() * 200,
      name:   player.name   || 'Anónimo',
      avatar: player.avatar || 0,
      photo:  player.photo  || null,
      color:  player.color  || '#4ade80',
      status: 'available',
    };
    socket.emit('room:state', { players: room.players, chat: room.chat.slice(-50) });
    socket.to(roomId).emit('player:joined', room.players[socket.id]);
    io.to(roomId).emit('proximity:update', calcProximity(room));
    console.log(`[room:${roomId}] ${room.players[socket.id].name} joined.`);
  });

  socket.on('player:move', ({ x, y }) => {
    const room = rooms[socket.roomId];
    if (!room || !room.players[socket.id]) return;
    room.players[socket.id].x = x;
    room.players[socket.id].y = y;
    socket.to(socket.roomId).emit('player:moved', { id: socket.id, x, y });
    io.to(socket.roomId).emit('proximity:update', calcProximity(room));
  });

  socket.on('player:status', (status) => {
    const room = rooms[socket.roomId];
    if (!room || !room.players[socket.id]) return;
    room.players[socket.id].status = status;
    io.to(socket.roomId).emit('player:status', { id: socket.id, status });
  });

  socket.on('chat:message', (text) => {
    const room = rooms[socket.roomId];
    if (!room || !room.players[socket.id]) return;
    const msg = {
      id:   Date.now(),
      from: socket.id,
      name: room.players[socket.id].name,
      text: text.slice(0, 300),
      ts:   new Date().toISOString(),
    };
    room.chat.push(msg);
    if (room.chat.length > 200) room.chat.shift();
    io.to(socket.roomId).emit('chat:message', msg);
  });

  socket.on('rtc:offer',  ({ to, offer })      => socket.to(to).emit('rtc:offer',  { from: socket.id, offer }));
  socket.on('rtc:answer', ({ to, answer })      => socket.to(to).emit('rtc:answer', { from: socket.id, answer }));
  socket.on('rtc:ice',    ({ to, candidate })   => socket.to(to).emit('rtc:ice',    { from: socket.id, candidate }));
  socket.on('screen:share', (sharing)           => socket.to(socket.roomId).emit('screen:share', { id: socket.id, sharing }));

  socket.on('disconnect', () => {
    const room = rooms[socket.roomId];
    if (room) {
      const name = room.players[socket.id]?.name;
      delete room.players[socket.id];
      io.to(socket.roomId).emit('player:left', socket.id);
      io.to(socket.roomId).emit('proximity:update', calcProximity(room));
      console.log(`[-] ${name} left room ${socket.roomId}`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 CoWork2D running on port ${PORT}`));
