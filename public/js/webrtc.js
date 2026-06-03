// ─── WebRTC Proximity Manager ─────────────────────────────────────────────────

class RTCManager {
  constructor(socket) {
    this.socket = socket;
    this.peers  = {};
    this.localStream  = null;
    this.screenStream = null;
    this.micEnabled   = false;
    this.camEnabled   = false;

    // Fallback STUN — se reemplaza con TURN una vez que el servidor responde
    this.iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

    fetch('/api/ice-servers')
      .then(r => r.json())
      .then(({ iceServers }) => { this.iceServers = iceServers; })
      .catch(() => {});

    this._bindSignaling();
  }

  _bindSignaling() {
    this.socket.on('rtc:offer',  async ({ from, offer  }) => await this._handleOffer(from, offer));
    this.socket.on('rtc:answer', async ({ from, answer }) => await this._handleAnswer(from, answer));
    this.socket.on('rtc:ice',    async ({ from, candidate }) => await this._handleIce(from, candidate));
  }

  // Returns { stream, error } — NEVER throws, always reports reason
  async requestMedia(video = true, audio = true) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio,
        video: video ? { width: 320, height: 240, frameRate: 15 } : false,
      });
      return { stream, error: null };
    } catch (e) {
      let msg;
      switch (e.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          msg = 'Permiso denegado. Hacé clic en el ícono 🔒 de la barra del browser y permitir cámara/micrófono, luego recargá la página.';
          break;
        case 'NotFoundError':
        case 'DevicesNotFoundError':
          msg = 'No se encontró cámara o micrófono. Verificá que estén conectados.';
          break;
        case 'NotReadableError':
        case 'TrackStartError':
          msg = 'La cámara/micrófono está siendo usada por otra aplicación. Cerrálas e intentá de nuevo.';
          break;
        case 'OverconstrainedError':
          msg = 'La cámara no soporta la resolución pedida.';
          break;
        default:
          msg = `Error al acceder a medios: ${e.name} — ${e.message}`;
      }
      console.warn('[RTC]', msg);
      return { stream: null, error: msg };
    }
  }

  async getLocalStream() {
    if (this.localStream) return this.localStream;
    const { stream, error } = await this.requestMedia(true, true);
    if (!stream) {
      window.dispatchEvent(new CustomEvent('rtc:mediaError', { detail: { message: error } }));
      return null;
    }
    this.localStream = stream;
    // Start con tracks deshabilitados — se activan al presionar botón
    this.localStream.getAudioTracks().forEach(t => t.enabled = false);
    this.localStream.getVideoTracks().forEach(t => t.enabled = false);
    // Notificar que el stream local está listo
    window.dispatchEvent(new CustomEvent('rtc:localStreamReady', { detail: { stream } }));
    return this.localStream;
  }

  async toggleMic() {
    if (!this.localStream) {
      const s = await this.getLocalStream();
      if (!s) return { on: false, error: true };
    }
    this.micEnabled = !this.micEnabled;
    this.localStream.getAudioTracks().forEach(t => t.enabled = this.micEnabled);
    return { on: this.micEnabled, error: false };
  }

  async toggleCam() {
    if (!this.localStream) {
      const s = await this.getLocalStream();
      if (!s) return { on: false, error: true };
    }
    this.camEnabled = !this.camEnabled;
    this.localStream.getVideoTracks().forEach(t => t.enabled = this.camEnabled);
    return { on: this.camEnabled, error: false };
  }

  async toggleScreen() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
      this.socket.emit('screen:share', false);
      const local = await this.getLocalStream();
      Object.values(this.peers).forEach(({ pc }) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender && local) sender.replaceTrack(local.getVideoTracks()[0]);
      });
      return { on: false, error: false };
    }
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = this.screenStream.getVideoTracks()[0];
      Object.values(this.peers).forEach(({ pc }) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      });
      screenTrack.addEventListener('ended', () => this.toggleScreen());
      this.socket.emit('screen:share', true);
      return { on: true, error: false };
    } catch (e) {
      const msg = e.name === 'NotAllowedError'
        ? 'Permiso de pantalla denegado.'
        : `Error al compartir pantalla: ${e.message}`;
      window.dispatchEvent(new CustomEvent('rtc:mediaError', { detail: { message: msg } }));
      return { on: false, error: true };
    }
  }

  _createPC(peerId) {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });

    pc.addEventListener('icecandidate', ({ candidate }) => {
      if (candidate) this.socket.emit('rtc:ice', { to: peerId, candidate });
    });

    pc.addEventListener('track', ({ streams }) => {
      if (streams[0]) this._onRemoteStream(peerId, streams[0]);
    });

    pc.addEventListener('connectionstatechange', () => {
      if (['failed','disconnected','closed'].includes(pc.connectionState)) {
        this._removePeer(peerId);
      }
    });

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => pc.addTrack(t, this.localStream));
    }

    this.peers[peerId] = { pc, stream: null };
    return pc;
  }

  async connectTo(peerId) {
    if (this.peers[peerId]) return;
    await this.getLocalStream();
    const pc = this._createPC(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.socket.emit('rtc:offer', { to: peerId, offer });
  }

  async _handleOffer(from, offer) {
    await this.getLocalStream();
    if (!this.peers[from]) this._createPC(from);
    const pc = this.peers[from].pc;
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.socket.emit('rtc:answer', { to: from, answer });
  }

  async _handleAnswer(from, answer) {
    const peer = this.peers[from];
    if (peer) await peer.pc.setRemoteDescription(answer);
  }

  async _handleIce(from, candidate) {
    const peer = this.peers[from];
    if (peer) try { await peer.pc.addIceCandidate(candidate); } catch(e) {}
  }

  _onRemoteStream(peerId, stream) {
    if (this.peers[peerId]) this.peers[peerId].stream = stream;
    window.dispatchEvent(new CustomEvent('rtc:remoteStream', { detail: { peerId, stream } }));
  }

  _removePeer(peerId) {
    if (this.peers[peerId]) {
      this.peers[peerId].pc.close();
      delete this.peers[peerId];
      window.dispatchEvent(new CustomEvent('rtc:peerLeft', { detail: { peerId } }));
    }
  }

  disconnect(peerId) { this._removePeer(peerId); }
  disconnectAll() { Object.keys(this.peers).forEach(id => this._removePeer(id)); }
}
