require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const initializeSocket = require('./socket/socketHandler');
const codespaceApiRoutes = require('./routes/codeSpaceApi');
const authRoutes = require('./routes/authApi');
const uploadRoutes = require('./routes/uploadApi');

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

const server = http.createServer(app);
const io = new Server(server, {
  path: "/socket.io",
  cors: {
    origin: "*",
    credentials: true,
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected : ', mongoose.connection.host))
    .catch(err => console.error(err));

// Initialize Socket.io logic first
initializeSocket(io);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/codespaces', codespaceApiRoutes(io));
app.use('/api/uploads', uploadRoutes);

// Public share: GET /s/:id → serve file by MongoDB _id (clean URL, no filename exposed)
const Upload = require('./models/Upload');
const fs = require('fs');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

app.get('/s/:id', async (req, res) => {
  try {
    const doc = await Upload.findById(req.params.id);
    if (!doc) return res.status(404).send('Not found');
    const filePath = path.join(UPLOAD_DIR, doc.storedName);
    if (!fs.existsSync(filePath)) return res.status(404).send('File missing on disk');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalName}"`);
    res.sendFile(filePath);
  } catch {
    res.status(404).send('Not found');
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => console.log(`Server is running on port ${PORT}`));
