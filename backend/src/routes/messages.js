import { Router } from 'express';
import Message from '../models/Message.js';
import Match from '../models/Match.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Helper function to check if user is in match
async function assertMember(matchId, userId) {
  const m = await Match.findById(matchId);
  if (!m) return null;
  if (!m.users.some((u) => u.equals(userId))) return null;
  return m;
}

// ========== MATCH CHAT (Mutual Likes) ==========

// Get messages for a match
router.get('/match/:matchId', requireAuth, async (req, res, next) => {
  try {
    const m = await assertMember(req.params.matchId, req.userId);
    if (!m) return res.status(404).json({ error: 'Match not found' });
    
    const msgs = await Message.find({ match: m._id }).sort('createdAt');
    res.json(msgs);
  } catch (e) {
    next(e);
  }
});

// Send message in a match
router.post('/match/:matchId', requireAuth, async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Empty message' });
    
    const m = await assertMember(req.params.matchId, req.userId);
    if (!m) return res.status(404).json({ error: 'Match not found' });
    
    const msg = await Message.create({ 
      match: m._id, 
      sender: req.userId, 
      text: text.trim() 
    });
    
    res.json(msg);
  } catch (e) {
    next(e);
  }
});

// ========== DIRECT MESSAGES (Friends) ==========

// Get all conversations (users you have chatted with)
router.get('/conversations', requireAuth, async (req, res, next) => {
  try {
    const sentMessages = await Message.find({ sender: req.userId, isDirect: true }).select('receiver');
    const receivedMessages = await Message.find({ receiver: req.userId, isDirect: true }).select('sender');
    
    const userIds = new Set();
    sentMessages.forEach(m => { if (m.receiver) userIds.add(m.receiver.toString()); });
    receivedMessages.forEach(m => { if (m.sender) userIds.add(m.sender.toString()); });
    
    const users = await User.find({ _id: { $in: Array.from(userIds) } });
    res.json(users.map(u => u.toPublic()));
  } catch (e) {
    next(e);
  }
});

// Get direct messages between two users
router.get('/direct/:userId', requireAuth, async (req, res, next) => {
  try {
    const otherUserId = req.params.userId;
    
    console.log(`GET /direct/${otherUserId} - User: ${req.userId}`);
    
    // Find all messages between these two users
    const messages = await Message.find({
      isDirect: true,
      $or: [
        { sender: req.userId, receiver: otherUserId },
        { sender: otherUserId, receiver: req.userId }
      ]
    }).sort('createdAt');
    
    console.log(`Found ${messages.length} messages`);
    
    // Mark unread messages as read
    const updateResult = await Message.updateMany(
      {
        sender: otherUserId,
        receiver: req.userId,
        isDirect: true,
        isRead: false
      },
      { isRead: true }
    );
    
    if (updateResult.modifiedCount > 0) {
      console.log(`Marked ${updateResult.modifiedCount} messages as read`);
    }
    
    res.json(messages);
  } catch (e) {
    console.error('Get direct messages error:', e);
    next(e);
  }
});

// Send direct message to any user
router.post('/direct/:userId', requireAuth, async (req, res, next) => {
  try {
    const { text } = req.body;
    const receiverId = req.params.userId;
    
    console.log(`POST /direct/${receiverId} - From: ${req.userId}, Text: ${text}`);
    
    if (!text?.trim()) {
      return res.status(400).json({ error: 'Empty message' });
    }
    
    if (receiverId === req.userId) {
      return res.status(400).json({ error: 'Cannot message yourself' });
    }
    
    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Create message
    const msg = await Message.create({
      sender: req.userId,
      receiver: receiverId,
      text: text.trim(),
      isDirect: true,
      isRead: false
    });
    
    // Populate sender info
    const populated = await msg.populate('sender', 'name');
    
    console.log(`Message created: ${msg._id}`);
    res.json(populated);
    
  } catch (e) {
    console.error('Send direct message error:', e);
    next(e);
  }
});

// Mark single message as read
router.post('/mark-read/:messageId', requireAuth, async (req, res, next) => {
  try {
    const result = await Message.updateOne(
      { _id: req.params.messageId, receiver: req.userId },
      { isRead: true }
    );
    
    res.json({ ok: true, modifiedCount: result.modifiedCount });
  } catch (e) {
    next(e);
  }
});

// Mark all messages from a user as read
router.post('/mark-all-read/:userId', requireAuth, async (req, res, next) => {
  try {
    const fromUserId = req.params.userId;
    
    console.log(`Mark all read from ${fromUserId} to ${req.userId}`);
    
    const result = await Message.updateMany(
      {
        sender: fromUserId,
        receiver: req.userId,
        isDirect: true,
        isRead: false
      },
      { isRead: true }
    );
    
    console.log(`Marked ${result.modifiedCount} messages as read`);
    res.json({ ok: true, modifiedCount: result.modifiedCount });
  } catch (e) {
    console.error('Mark all read error:', e);
    next(e);
  }
});

// Get unread count for all conversations
router.get('/unread-counts', requireAuth, async (req, res, next) => {
  try {
    const unreadMessages = await Message.aggregate([
      {
        $match: {
          receiver: req.userId,
          isDirect: true,
          isRead: false
        }
      },
      {
        $group: {
          _id: '$sender',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const counts = {};
    unreadMessages.forEach(item => {
      counts[item._id] = item.count;
    });
    
    res.json(counts);
  } catch (e) {
    console.error('Get unread counts error:', e);
    res.json({});
  }
});

// Get total unread count
router.get('/unread-total', requireAuth, async (req, res, next) => {
  try {
    const total = await Message.countDocuments({
      receiver: req.userId,
      isDirect: true,
      isRead: false
    });
    
    res.json({ total });
  } catch (e) {
    next(e);
  }
});

export default router;