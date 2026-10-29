require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/educonnect';
if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET. Copy .env.example to .env and set it.');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });
app.set('io', io);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/groups', require('./routes/groups'));

// Uploaded files. Forced download for anything that isn't a plain image or PDF.
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    setHeaders(res, filePath) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (!/\.(png|jpe?g|gif|webp|pdf)$/i.test(filePath)) res.setHeader('Content-Disposition', 'attachment');
    },
  })
);

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

require('./socket')(io);

mongoose
  .connect(MONGO_URI)
  .then(() => {
    server.listen(PORT, () => console.log(`EduConnect running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
