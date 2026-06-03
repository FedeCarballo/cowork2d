// ─── Avatar sprites (emoji → canvas rendering) ───────────────────────────────
const AVATARS = [
  { id: 0, emoji: '🧑‍💻', label: 'Developer' },
  { id: 1, emoji: '👩‍🎨', label: 'Designer' },
  { id: 2, emoji: '🧑‍🔬', label: 'Researcher' },
  { id: 3, emoji: '👩‍💼', label: 'Manager' },
  { id: 4, emoji: '🧑‍🏫', label: 'Teacher' },
  { id: 5, emoji: '🧙', label: 'Wizard' },
  { id: 6, emoji: '🦸', label: 'Hero' },
  { id: 7, emoji: '🤖', label: 'Robot' },
];

// Build the avatar picker UI
function buildAvatarPicker() {
  const container = document.getElementById('avatar-picker');
  AVATARS.forEach(av => {
    const el = document.createElement('div');
    el.className = 'avatar-opt' + (av.id === 0 ? ' selected' : '');
    el.textContent = av.emoji;
    el.dataset.id = av.id;
    el.title = av.label;
    el.addEventListener('click', () => {
      document.querySelectorAll('.avatar-opt').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      window._selectedAvatar = av.id;
    });
    container.appendChild(el);
  });
  window._selectedAvatar = 0;
}

// Draw a single player on canvas
function drawPlayer(ctx, p, isSelf, proximity) {
  const SIZE = 32;
  const HALF = SIZE / 2;

  // Shadow
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + HALF + 4, HALF * 0.8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Glow if near
  if (proximity) {
    ctx.save();
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 18;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(p.x, p.y, HALF + 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // Self indicator ring
  if (isSelf) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, HALF + 4, 0, Math.PI * 2);
    ctx.strokeStyle = p.color || '#4ade80';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();
  }

  // Emoji sprite
  ctx.save();
  ctx.font = `${SIZE}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(AVATARS[p.avatar ?? 0]?.emoji || '🧑‍💻', p.x, p.y);
  ctx.restore();

  // Status dot
  const statusColor = { available: '#4ade80', busy: '#f87171', away: '#fbbf24' }[p.status || 'available'];
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x + HALF - 4, p.y - HALF + 4, 5, 0, Math.PI * 2);
  ctx.fillStyle = statusColor;
  ctx.fill();
  ctx.strokeStyle = '#0d0f14';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Name tag
  const name = (p.name || 'Anónimo').slice(0, 12);
  ctx.save();
  ctx.font = '11px "Share Tech Mono", monospace';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(name).width;
  ctx.fillStyle = 'rgba(13,15,20,0.85)';
  ctx.fillRect(p.x - tw / 2 - 4, p.y + HALF + 6, tw + 8, 16);
  ctx.fillStyle = p.color || '#4ade80';
  ctx.fillText(name, p.x, p.y + HALF + 17);
  ctx.restore();

  // Bubble speech (if p.bubble)
  if (p.bubble) {
    ctx.save();
    ctx.font = '11px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    const bw = Math.min(ctx.measureText(p.bubble).width + 16, 180);
    const bx = p.x - bw / 2;
    const by = p.y - HALF - 36;
    ctx.fillStyle = 'rgba(30,35,48,0.95)';
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(bx, by, bw, 22);
    ctx.fill();
    ctx.stroke();
    // tail
    ctx.beginPath();
    ctx.moveTo(p.x - 5, by + 22);
    ctx.lineTo(p.x, by + 30);
    ctx.lineTo(p.x + 5, by + 22);
    ctx.fillStyle = 'rgba(30,35,48,0.95)';
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(p.bubble.slice(0, 24), p.x, by + 15);
    ctx.restore();
  }
}
