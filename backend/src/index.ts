import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Polyfill fetch for Node.js < 18
if (!globalThis.fetch) {
  const fetch = require('node-fetch');
  globalThis.fetch = fetch;
}

import authRoutes from './routes/auth';
import contactRoutes from './routes/contacts';
import groupRoutes from './routes/groups';
import messageRoutes from './routes/messages';
import callRoutes from './routes/calls';
import fileRoutes from './routes/files';
import folderRoutes from './routes/folders';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5000').replace(/\/$/, '');

const io = new Server(httpServer, {
  cors: {
    origin: frontendUrl,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: frontendUrl,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/folders', folderRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_chat', (chatId: string) => {
    socket.join(`chat_${chatId}`);
    console.log(`Socket ${socket.id} joined chat_${chatId}`);
  });

  socket.on('leave_chat', (chatId: string) => {
    socket.leave(`chat_${chatId}`);
    console.log(`Socket ${socket.id} left chat_${chatId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

export { io };

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server running on http://0.0.0.0:${PORT}`);
  console.log(`🔌 Socket.IO ready for connections`);
  
  // Keep-alive mechanism for Render deployment
  if (process.env.NODE_ENV === 'production') {
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    
    // Ping self every 14 minutes to prevent Render sleep
    setInterval(async () => {
      try {
        const response = await fetch(`${RENDER_URL}/health`);
        console.log(`🏓 Keep-alive ping: ${response.status} at ${new Date().toISOString()}`);
      } catch (error) {
        console.log('🏓 Keep-alive ping failed:', error);
      }
    }, 14 * 60 * 1000); // 14 minutes
    
    console.log('🔄 Keep-alive mechanism activated for production');
  }
});
