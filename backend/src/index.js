import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

// Import Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import matchRoutes from './routes/matches.js';
import messageRoutes from './routes/messages.js';
import friendRoutes from './routes/friends.js';
import uploadRoutes from './routes/upload.js';

// Import Models
import Message from './models/Message.js';
import Match from './models/Match.js';
import User from './models/User.js';

const app = express();

// ✅ Trust proxy (for Railway/Render etc.)
app.set('trust proxy', 1);

// CORS Configuration
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'];
app.use(cors({ 
  origin: allowedOrigins, 
  credentials: true 
}));

// Security Middleware
app.use(helmet());

// ✅ Rate limiting - FIXED for proxy
const limiter = rateLimit({ 
  windowMs: 60 * 1000,
  max: 500,
  message: 'Too many requests, please try again later.',
  skipSuccessfulRequests: true,
  trustProxy: true,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  },
  validate: false // ✅ Disable validation to fix proxy warning
});
app.use('/api/', limiter);

// Body Parser
app.use(express.json({ limit: '2mb' }));

// Socket.IO Setup
const httpServer = createServer(app);
const io = new Server(httpServer, { 
  cors: { 
    origin: allowedOrigins, 
    credentials: true 
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Store online users
const onlineUsers = new Map();

// Socket.IO Authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = payload.sub;
    next();
  } catch (err) {
    console.error('Socket auth error:', err.message);
    next(new Error('Invalid token'));
  }
});

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.userId);
  
  onlineUsers.set(socket.userId, socket.id);
  socket.join(`user:${socket.userId}`);
  
  // Direct Message Events
  socket.on('joinDirectChat', (otherUserId) => {
    const roomId = [socket.userId, otherUserId].sort().join(':');
    socket.join(roomId);
    console.log(`User ${socket.userId} joined direct chat room with ${otherUserId}`);
  });
  
  socket.on('leaveDirectChat', (otherUserId) => {
    const roomId = [socket.userId, otherUserId].sort().join(':');
    socket.leave(roomId);
  });
  
  socket.on('typing', (data) => {
    const { receiverId, isTyping } = data;
    const roomId = [socket.userId, receiverId].sort().join(':');
    socket.to(roomId).emit('userTyping', { userId: socket.userId, isTyping });
  });
  
  socket.on('sendDirectMessage', async (data) => {
    const { receiverId, text, tempId } = data;
    if (!text?.trim() || !receiverId) return;
    if (receiverId === socket.userId) return;
    
    try {
      const msg = await Message.create({
        sender: socket.userId,
        receiver: receiverId,
        text: text.trim(),
        isDirect: true,
        isRead: false
      });
      
      const populated = await msg.populate('sender', 'name');
      const roomId = [socket.userId, receiverId].sort().join(':');
      
      io.to(roomId).emit('newDirectMessage', {
        ...populated.toObject(),
        tempId: tempId
      });
      
      const sender = await User.findById(socket.userId).select('name');
      io.to(`user:${receiverId}`).emit('messageNotification', {
        fromUser: socket.userId,
        fromName: sender.name,
        message: text.trim(),
        messageId: msg._id
      });
      
    } catch (err) {
      console.error('Direct message error:', err);
    }
  });
  
  socket.on('markMessagesRead', async (data) => {
    const { fromUserId } = data;
    try {
      const result = await Message.updateMany(
        {
          sender: fromUserId,
          receiver: socket.userId,
          isDirect: true,
          isRead: false
        },
        { isRead: true }
      );
      
      io.to(`user:${fromUserId}`).emit('messagesRead', {
        byUser: socket.userId,
        count: result.modifiedCount
      });
      
    } catch (err) {
      console.error('Mark read error:', err);
    }
  });
  
  // Match Chat Events
  socket.on('joinMatch', (matchId) => {
    if (!matchId) return;
    socket.join(`match:${matchId}`);
  });
  
  socket.on('leaveMatch', (matchId) => {
    if (!matchId) return;
    socket.leave(`match:${matchId}`);
  });
  
  socket.on('sendMatchMessage', async (data) => {
    const { matchId, text } = data;
    if (!text?.trim() || !matchId) return;
    
    try {
      const match = await Match.findOne({ _id: matchId, users: socket.userId });
      if (!match) return;
      
      const msg = await Message.create({ 
        match: matchId, 
        sender: socket.userId, 
        text: text.trim() 
      });
      
      const populated = await msg.populate('sender', 'name');
      io.to(`match:${matchId}`).emit('newMatchMessage', populated);
      
    } catch (err) {
      console.error('Send match message error:', err);
    }
  });
  
  socket.on('disconnect', (reason) => {
    console.log('❌ User disconnected:', socket.userId);
    onlineUsers.delete(socket.userId);
    io.emit('onlineUsers', Array.from(onlineUsers.keys()));
  });
});

// ========== API Routes ==========

app.get('/api/health', (_, res) => res.json({ 
  ok: true, 
  timestamp: new Date().toISOString(),
  onlineUsers: Array.from(onlineUsers.keys())
}));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/upload', uploadRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: Object.values(err.errors).map(e => e.message).join(', ') });
  }
  
  if (err.code === 11000) {
    return res.status(400).json({ error: 'Duplicate entry' });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }
  
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal server error' 
  });
});

// ========== MongoDB Connection ==========
const PORT = process.env.PORT || 4000;

mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 10,
  minPoolSize: 2,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
  heartbeatFrequencyMS: 10000
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`📝 Health check: http://0.0.0.0:${PORT}/api/health`);
  });
})
.catch((e) => {
  console.error('❌ MongoDB connection failed:', e.message);
  process.exit(1);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected! Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await mongoose.connection.close();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});