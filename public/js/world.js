// ─── World / Canvas renderer ─────────────────────────────────────────────────

const TILE = 32;

// Map layout: 0=floor, 1=wall, 2=desk, 3=plant, 4=coffee, 5=tv, 6=door
// 30 cols × 22 rows
const MAP_COLS = 30;
const MAP_ROWS = 22;

const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,2,2,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,2,2,0,0,0,0,1],
  [1,0,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,2,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,2,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,5,5,0,0,2,0,1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,3,0,0,0,1,0,5,5,0,0,2,0,1,0,0,3,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,1,1,1,1,6,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,1],
  [1,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const COLORS = {
  0: '#1a1f2e',   // floor
  1: '#0d1117',   // wall
  2: '#2d1b00',   // desk
  3: '#0d2b1a',   // plant
  4: '#1a0d0d',   // coffee spot
  5: '#0d0d1f',   // tv area
  6: '#1a1f2e',   // door
};
const BORDER_COLORS = {
  0: '#1e2438',
  1: '#4ade8022',
  2: '#8b5e2a',
  3: '#166534',
  4: '#7f1d1d',
  5: '#1e3a5f',
  6: '#4ade8055',
};
const EMOJIS = {
  2: '🖥️',
  3: '🌿',
  4: '☕',
  5: '📺',
  6: '🚪',
};

// Area labels
const AREA_LABELS = [
  { x: 2,  y: 2,  text: '💻 Dev Corner' },
  { x: 11, y: 6,  text: '🎤 Meeting Room' },
  { x: 1,  y: 13, text: '☕ Kitchen' },
  { x: 23, y: 13, text: '☕ Kitchen' },
  { x: 1,  y: 15, text: '📋 Open Space' },
];

class WorldRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = { x: 0, y: 0 };
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight - 48; // minus HUD
    this.mapW = MAP_COLS * TILE;
    this.mapH = MAP_ROWS * TILE;
  }

  centerOn(x, y) {
    this.camera.x = Math.round(x - this.canvas.width  / 2);
    this.camera.y = Math.round(y - this.canvas.height / 2);
    // Clamp
    this.camera.x = Math.max(0, Math.min(this.camera.x, this.mapW - this.canvas.width));
    this.camera.y = Math.max(0, Math.min(this.camera.y, this.mapH - this.canvas.height));
  }

  // Convert world → screen
  w2s(x, y) {
    return { x: x - this.camera.x, y: y - this.camera.y };
  }

  drawTile(col, row, type) {
    const sx = col * TILE - this.camera.x;
    const sy = row * TILE - this.camera.y;
    const ctx = this.ctx;

    // Skip if off screen
    if (sx > this.canvas.width || sy > this.canvas.height || sx + TILE < 0 || sy + TILE < 0) return;

    ctx.fillStyle = COLORS[type] || COLORS[0];
    ctx.fillRect(sx, sy, TILE, TILE);

    // Grid lines
    ctx.strokeStyle = BORDER_COLORS[type] || '#1e2438';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, sy, TILE, TILE);

    // Floor: subtle checker
    if (type === 0) {
      if ((col + row) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(sx, sy, TILE, TILE);
      }
    }

    // Wall shading
    if (type === 1) {
      ctx.fillStyle = 'rgba(74,222,128,0.04)';
      ctx.fillRect(sx, sy, TILE, TILE);
      // top highlight
      ctx.fillStyle = 'rgba(74,222,128,0.08)';
      ctx.fillRect(sx, sy, TILE, 3);
    }

    // Emoji decoration
    if (EMOJIS[type]) {
      ctx.font = `${TILE * 0.55}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(EMOJIS[type], sx + TILE / 2, sy + TILE / 2);
    }
  }

  drawMap() {
    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        this.drawTile(c, r, MAP[r][c]);
      }
    }
    // Area labels
    const ctx = this.ctx;
    AREA_LABELS.forEach(l => {
      const sx = l.x * TILE - this.camera.x + TILE / 2;
      const sy = l.y * TILE - this.camera.y - 8;
      if (sx < -100 || sx > this.canvas.width + 100) return;
      ctx.save();
      ctx.font = '10px "Share Tech Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(74,222,128,0.4)';
      ctx.fillText(l.text, sx, sy);
      ctx.restore();
    });
  }

  render(players, selfId, proximityPairs) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawMap();

    // Sort players: self last (drawn on top)
    const sorted = Object.values(players).sort((a, b) => (a.id === selfId ? 1 : -1));

    sorted.forEach(p => {
      const sp = this.w2s(p.x, p.y);
      const inProximity = Object.entries(proximityPairs).some(([key, near]) => {
        return near && key.includes(p.id) && (selfId === p.id ? false : key.includes(selfId));
      });
      drawPlayer(ctx, { ...p, x: sp.x, y: sp.y }, p.id === selfId, inProximity && p.id !== selfId);
    });
  }
}

// Walkability check
function isTileWalkable(wx, wy) {
  const col = Math.floor(wx / TILE);
  const row = Math.floor(wy / TILE);
  if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return false;
  const t = MAP[row][col];
  return t === 0 || t === 6; // walkable: floor + doors
}
