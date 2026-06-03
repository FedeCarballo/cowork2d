// ─── UI Manager ──────────────────────────────────────────────────────────────

const UI = {
  videoGrid:    document.getElementById('video-grid'),
  chatPanel:    document.getElementById('chat-panel'),
  chatMessages: document.getElementById('chat-messages'),
  chatInput:    document.getElementById('chat-input'),
  proximityToast: document.getElementById('proximity-toast'),

  _toastTimer: null,
  _selfTileCreated: false,

  // ─── Video tiles ───────────────────────────────────────────────────────────
  createSelfTile(stream) {
    if (this._selfTileCreated) return;
    this._selfTileCreated = true;
    const tile = this._makeTile('self', 'Tú (yo)', stream, true);
    this.videoGrid.prepend(tile);
  },

  _makeTile(id, name, stream, muted = false) {
    const existing = document.getElementById(`tile-${id}`);
    if (existing) {
      if (stream) existing.querySelector('video').srcObject = stream;
      return existing;
    }

    const tile = document.createElement('div');
    tile.className = 'video-tile fade-in';
    tile.id = `tile-${id}`;

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = muted;
    if (stream) video.srcObject = stream;
    tile.appendChild(video);

    const label = document.createElement('div');
    label.className = 'tile-label';
    label.textContent = name;
    tile.appendChild(label);

    return tile;
  },

  addRemoteTile(peerId, name, stream) {
    const tile = this._makeTile(peerId, name || peerId.slice(0,6), stream);
    this.videoGrid.appendChild(tile);
  },

  removeTile(peerId) {
    const t = document.getElementById(`tile-${peerId}`);
    if (t) t.remove();
  },

  setTileNear(peerId, near) {
    const t = document.getElementById(`tile-${peerId}`);
    if (t) t.classList.toggle('near', near);
  },

  updateTileStream(peerId, stream) {
    const t = document.getElementById(`tile-${peerId}`);
    if (t) t.querySelector('video').srcObject = stream;
  },

  updateSelfTileVideo(on) {
    const t = document.getElementById('tile-self');
    if (!t) return;
    const video = t.querySelector('video');
    video.style.filter  = on ? '' : 'grayscale(1) brightness(0.3)';
    video.style.opacity = on ? '1' : '0.5';
  },

  updateSelfTileAudio(on) {
    const t = document.getElementById('tile-self');
    if (!t) return;
    let icon = t.querySelector('.tile-muted');
    if (!icon) {
      icon = document.createElement('div');
      icon.className = 'tile-muted';
      t.appendChild(icon);
    }
    icon.textContent = on ? '' : '🔇';
  },

  // ─── Chat ──────────────────────────────────────────────────────────────────
  toggleChat() {
    this.chatPanel.classList.toggle('hidden');
    if (!this.chatPanel.classList.contains('hidden')) {
      this.chatInput.focus();
      this.scrollChat();
    }
  },

  addMessage(msg, selfId) {
    const div = document.createElement('div');
    div.className = 'chat-msg fade-in' + (msg.from === selfId ? ' own' : '');

    const nameEl = document.createElement('div');
    nameEl.className = 'msg-name';
    nameEl.textContent = msg.name;
    nameEl.style.color = msg.color || '#4ade80';

    const textEl = document.createElement('div');
    textEl.className = 'msg-text';
    textEl.textContent = msg.text;

    div.appendChild(nameEl);
    div.appendChild(textEl);
    this.chatMessages.appendChild(div);
    this.scrollChat();
  },

  scrollChat() {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  },

  // ─── Toast ─────────────────────────────────────────────────────────────────
  showToast(msg, duration = 3000) {
    this.proximityToast.textContent = msg;
    this.proximityToast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.proximityToast.classList.add('hidden');
    }, duration);
  },

  // ─── Media error modal ─────────────────────────────────────────────────────
  showMediaError(message) {
    const existing = document.getElementById('media-error-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'media-error-modal';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:200;
      background:rgba(0,0,0,.75);
      display:flex;align-items:center;justify-content:center;
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      background:#161922;border:2px solid #f87171;
      box-shadow:4px 4px 0 #7f1d1d;
      padding:32px 40px;max-width:460px;width:90vw;
      font-family:'Share Tech Mono',monospace;
    `;
    box.innerHTML = `
      <div style="font-family:'Press Start 2P',monospace;font-size:10px;color:#f87171;margin-bottom:16px;">⚠ ERROR DE MEDIOS</div>
      <p style="color:#e2e8f0;font-size:14px;line-height:1.7;margin-bottom:20px;">${message}</p>
      <div style="background:#0d0f14;border:1px solid #2e3650;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#94a3b8;line-height:1.9;">
        <strong style="color:#60a5fa;">Chrome/Edge:</strong> ícono 🔒 en la barra → Permisos del sitio → Cámara + Micrófono → Permitir → Recargar<br>
        <strong style="color:#60a5fa;">Firefox:</strong> ícono 🛡 → Más información → Permisos → Permitir
      </div>
      <button id="media-error-close" style="
        background:#4ade80;color:#0d0f14;
        font-family:'Press Start 2P',monospace;font-size:9px;
        border:none;padding:12px 24px;cursor:pointer;
        box-shadow:3px 3px 0 #166534;width:100%;
      ">ENTENDIDO</button>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.getElementById('media-error-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  },

  // ─── HUD ───────────────────────────────────────────────────────────────────
  updateCount(n) {
    document.getElementById('hud-count').textContent = `👥 ${n}`;
  },
};
