// ─── CoWork2D — Main App ──────────────────────────────────────────────────────
(function () {
  'use strict';

  const SPEED = 3;
  const TILE  = 32;
  const BUBBLE_DURATION = 4000;

  let socket, rtc, world;
  let selfId   = null;
  let players  = {};
  let proximity = {};
  let prevProximity = {};
  let keys     = {};
  let selfColor = '#4ade80';
  let bubbleTimers = {};

  // ─── Init ──────────────────────────────────────────────────────────────────
  buildAvatarPicker();

  let googleUser = null; // { name, photo, email }

  // Pre-rellenar con datos de Google si está logueado
  fetch('/auth/me')
    .then(r => r.ok ? r.json() : null)
    .then(user => {
      if (!user) { window.location.href = '/login.html'; return; }
      googleUser = user;
      const input = document.getElementById('input-name');
      input.value = user.name;
      input.readOnly = true;
      input.style.opacity = '0.7';
      // Mostrar foto de perfil si hay
      if (user.photo) {
        const wrap = document.getElementById('google-profile');
        if (wrap) {
          wrap.innerHTML = `<img src="${user.photo}" style="width:40px;height:40px;border-radius:50%;border:2px solid var(--accent);">
            <span style="font-size:13px;color:var(--text-dim)">${user.name}</span>`;
        }
      }
    })
    .catch(() => { window.location.href = '/login.html'; });

  document.querySelectorAll('.color-opt').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.color-opt').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      selfColor = el.dataset.color;
    });
  });

  document.getElementById('btn-join').addEventListener('click', joinRoom);
  document.getElementById('input-name').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
  document.getElementById('input-room').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });

  function joinRoom() {
    const name = googleUser?.name || document.getElementById('input-name').value.trim() || 'Anónimo';
    const room = document.getElementById('input-room').value.trim().replace(/\s+/g,'-').toLowerCase() || 'general';

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('hud-room').textContent = `# ${room}`;

    world = new WorldRenderer(document.getElementById('world-canvas'));
    socket = io();
    rtc    = new RTCManager(socket);

    socket.emit('join', {
      roomId: room,
      player: {
        name,
        avatar: window._selectedAvatar || 0,
        color: selfColor,
        photo: googleUser?.photo || null,
      }
    });

    socket.on('connect', () => {
      selfId = socket.id;
      UI.showToast('💡 Clic en 🎤 o 📷 para activar tu cámara y micrófono', 5000);
    });

    // ─── Socket events ─────────────────────────────────────────────────────
    socket.on('room:state', ({ players: ps, chat }) => {
      players = ps;
      selfId  = socket.id;
      UI.updateCount(Object.keys(players).length);
      chat.forEach(m => UI.addMessage(m, selfId));
    });

    socket.on('player:joined', p => {
      players[p.id] = p;
      UI.showToast(`${p.name} entró a la sala`);
      UI.updateCount(Object.keys(players).length);
    });

    socket.on('player:moved', ({ id, x, y }) => {
      if (players[id]) { players[id].x = x; players[id].y = y; }
    });

    socket.on('player:left', id => {
      const name = players[id]?.name;
      delete players[id];
      rtc.disconnect(id);
      UI.removeTile(id);
      if (name) UI.showToast(`${name} salió de la sala`);
      UI.updateCount(Object.keys(players).length);
    });

    socket.on('player:status', ({ id, status }) => {
      if (players[id]) players[id].status = status;
    });

    socket.on('proximity:update', async (pairs) => {
      prevProximity = { ...proximity };
      proximity = pairs;

      for (const [key, near] of Object.entries(pairs)) {
        const [a, b] = key.split(':');
        const otherId = a === selfId ? b : (b === selfId ? a : null);
        if (!otherId) continue;

        const wasNear = prevProximity[key];
        UI.setTileNear(otherId, near);

        if (near && !wasNear) {
          const other = players[otherId];
          if (other) {
            UI.showToast(`📡 Conectando con ${other.name}...`);
            await rtc.connectTo(otherId);
          }
        } else if (!near && wasNear) {
          rtc.disconnect(otherId);
          UI.removeTile(otherId);
        }
      }
    });

    socket.on('chat:message', msg => {
      UI.addMessage(msg, selfId);
      if (players[msg.from]) {
        players[msg.from].bubble = msg.text;
        clearTimeout(bubbleTimers[msg.from]);
        bubbleTimers[msg.from] = setTimeout(() => {
          if (players[msg.from]) players[msg.from].bubble = null;
        }, BUBBLE_DURATION);
      }
    });

    window.addEventListener('rtc:remoteStream', ({ detail: { peerId, stream } }) => {
      const name = players[peerId]?.name || peerId.slice(0,6);
      UI.addRemoteTile(peerId, name, stream);
    });
    window.addEventListener('rtc:peerLeft', ({ detail: { peerId } }) => {
      UI.removeTile(peerId);
    });
    window.addEventListener('rtc:mediaError', ({ detail: { message } }) => {
      UI.showMediaError(message);
    });

    // ─── Input ─────────────────────────────────────────────────────────────
    window.addEventListener('keydown', e => {
      keys[e.code] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { keys[e.code] = false; });

    document.getElementById('chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') sendChat();
    });

    // ─── HUD buttons ───────────────────────────────────────────────────────
    const btnMic    = document.getElementById('btn-mic');
    const btnCam    = document.getElementById('btn-cam');
    const btnScreen = document.getElementById('btn-screen');

    btnMic.addEventListener('click', async () => {
      btnMic.disabled = true;
      btnMic.textContent = '⏳';
      const result = await rtc.toggleMic();
      btnMic.disabled = false;
      if (result && !result.error) {
        btnMic.classList.toggle('active',   result.on);
        btnMic.classList.toggle('inactive', !result.on);
        btnMic.textContent = result.on ? '🎤' : '🔇';
        if (rtc.localStream) {
          UI.createSelfTile(rtc.localStream);
          UI.updateSelfTileAudio(result.on);
        }
      } else {
        btnMic.textContent = '🎤';
        btnMic.classList.remove('active','inactive');
      }
    });

    btnCam.addEventListener('click', async () => {
      btnCam.disabled = true;
      btnCam.textContent = '⏳';
      const result = await rtc.toggleCam();
      btnCam.disabled = false;
      if (result && !result.error) {
        btnCam.classList.toggle('active',   result.on);
        btnCam.classList.toggle('inactive', !result.on);
        btnCam.textContent = result.on ? '📷' : '🚫';
        if (rtc.localStream) {
          UI.createSelfTile(rtc.localStream);
          UI.updateSelfTileVideo(result.on);
        }
      } else {
        btnCam.textContent = '📷';
        btnCam.classList.remove('active','inactive');
      }
    });

    btnScreen.addEventListener('click', async () => {
      btnScreen.disabled = true;
      const result = await rtc.toggleScreen();
      btnScreen.disabled = false;
      if (result && !result.error) {
        btnScreen.classList.toggle('active', result.on);
        btnScreen.textContent = result.on ? '🖥️' : '🖥️';
      }
    });

    document.getElementById('btn-chat-toggle').addEventListener('click', () => UI.toggleChat());
    document.getElementById('btn-chat-close').addEventListener('click',  () => UI.toggleChat());
    document.getElementById('btn-chat-send').addEventListener('click',   sendChat);

    document.getElementById('status-select').addEventListener('change', e => {
      socket.emit('player:status', e.target.value);
    });

    // ─── Game loop ─────────────────────────────────────────────────────────
    let lastEmit = 0;
    const EMIT_RATE = 50;

    function loop(ts) {
      if (!selfId || !players[selfId]) { requestAnimationFrame(loop); return; }

      const me = players[selfId];
      let dx = 0, dy = 0;

      if (keys['ArrowLeft']  || keys['KeyA']) dx = -SPEED;
      if (keys['ArrowRight'] || keys['KeyD']) dx =  SPEED;
      if (keys['ArrowUp']    || keys['KeyW']) dy = -SPEED;
      if (keys['ArrowDown']  || keys['KeyS']) dy =  SPEED;

      if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

      if (dx !== 0 || dy !== 0) {
        const nx = me.x + dx;
        const ny = me.y + dy;
        const M  = 10;
        const walkable =
          isTileWalkable(nx - M, ny - M) &&
          isTileWalkable(nx + M, ny - M) &&
          isTileWalkable(nx - M, ny + M) &&
          isTileWalkable(nx + M, ny + M);

        if (walkable) { me.x = nx; me.y = ny; }

        if (ts - lastEmit > EMIT_RATE) {
          socket.emit('player:move', { x: me.x, y: me.y });
          lastEmit = ts;
        }
      }

      world.centerOn(me.x, me.y);
      world.render(players, selfId, proximity);
      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
  }

  function sendChat() {
    const input = document.getElementById('chat-input');
    const text  = input.value.trim();
    if (!text || !socket) return;
    socket.emit('chat:message', text);
    input.value = '';
  }

})();
