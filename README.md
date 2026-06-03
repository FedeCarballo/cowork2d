# 🏢 CoWork2D — Tu oficina virtual retro

Espacio de coworking 2D con videochat por proximidad, chat, pantalla compartida y avatares personalizables.

---

## 🚀 Instalación y deploy local

### 1. Instalar dependencias
```bash
cd cowork2d
npm install
```

### 2. Correr en desarrollo
```bash
npm run dev
# → http://localhost:3000
```

### 3. Correr en producción
```bash
npm start
```

---

## 🌐 Deploy en Railway (recomendado — gratis)

1. **Crear cuenta** en [railway.app](https://railway.app)
2. **Subir el proyecto** (GitHub o drag & drop de la carpeta)
3. Railway detecta automáticamente el `package.json` y despliega
4. Te da una URL pública tipo `cowork2d-production.up.railway.app`
5. **Compartí esa URL** con tus compañeros

### Variables de entorno en Railway:
```
PORT=3000  (Railway lo configura solo)
```

---

## 🌐 Deploy en Render (alternativa gratis)

1. Ir a [render.com](https://render.com) → New Web Service
2. Conectar tu repo de GitHub con el proyecto
3. **Build command:** `npm install`
4. **Start command:** `node server/index.js`
5. Deploy → URL pública lista

---

## 🌐 Deploy en VPS propio (Ubuntu/Debian)

```bash
# Instalar Node 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clonar y correr
git clone <tu-repo> cowork2d
cd cowork2d
npm install
npm start

# Con PM2 para que no se caiga
npm install -g pm2
pm2 start server/index.js --name cowork2d
pm2 save
pm2 startup
```

### Nginx reverse proxy (opcional):
```nginx
server {
    listen 80;
    server_name tudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🎮 Controles

| Tecla | Acción |
|-------|--------|
| WASD / Flechas | Mover avatar |
| Acercarse a alguien | Activa videochat automáticamente |
| 🎤 | Activar/silenciar micrófono |
| 📷 | Activar/apagar cámara |
| 🖥️ | Compartir pantalla |
| 💬 | Abrir/cerrar chat |

---

## 📡 Sobre WebRTC y TURN servers

Para usuarios en la **misma red local o con buena conectividad**, los servidores STUN de Google funcionan.

Para **producción con usuarios remotos**, necesitás un servidor TURN.
Opciones gratuitas/baratas:

- **Twilio TURN** (prueba gratis): https://www.twilio.com/stun-turn
- **Metered.ca** (gratis con límite): https://www.metered.ca/tools/openrelay/
- **Coturn** (self-hosted): `apt install coturn`

Agregar en `server/index.js` y en `webrtc.js` → array `iceServers`:
```js
{ urls: 'turn:tu-servidor.com:3478', username: 'user', credential: 'pass' }
```

---

## 🔐 Autenticación con Google OAuth (opcional)

Para agregar login con Google:

1. Crear proyecto en [Google Cloud Console](https://console.cloud.google.com)
2. Habilitar Google+ API / OAuth 2.0
3. Instalar `passport-google-oauth20`:
   ```bash
   npm install passport passport-google-oauth20 express-session
   ```
4. Agregar en `server/index.js` antes del `io`:
   ```js
   const passport = require('passport');
   const GoogleStrategy = require('passport-google-oauth20').Strategy;
   
   passport.use(new GoogleStrategy({
     clientID: process.env.GOOGLE_CLIENT_ID,
     clientSecret: process.env.GOOGLE_CLIENT_SECRET,
     callbackURL: '/auth/google/callback'
   }, (accessToken, refreshToken, profile, done) => done(null, profile)));

   app.use(require('express-session')({ secret: 'cowork2d', resave: false, saveUninitialized: false }));
   app.use(passport.initialize());
   app.use(passport.session());

   app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
   app.get('/auth/google/callback', 
     passport.authenticate('google', { failureRedirect: '/' }),
     (req, res) => res.redirect('/')
   );
   ```

---

## 🗂️ Estructura del proyecto

```
cowork2d/
├── server/
│   └── index.js          ← Backend Node.js + Socket.io
├── public/
│   ├── index.html        ← Frontend entry point
│   ├── css/
│   │   └── style.css     ← Estilos retro pixel
│   └── js/
│       ├── avatars.js    ← Sprites y render de jugadores
│       ├── world.js      ← Canvas 2D, mapa, tilemap
│       ├── webrtc.js     ← WebRTC (video/audio/screen)
│       ├── ui.js         ← Video tiles, chat, toasts
│       └── app.js        ← Game loop, input, Socket events
├── package.json
└── README.md
```

---

## 💡 Próximas funcionalidades posibles

- [ ] Login con Google (ver sección de OAuth arriba)
- [ ] Salas privadas con contraseña
- [ ] Pizarrón colaborativo
- [ ] Zonas de "silencio" donde no activa el micro
- [ ] Música ambiental por zona
- [ ] Integración con Notion / Jira para tareas
