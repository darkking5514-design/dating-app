import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Match from '../models/Match.js';
import UserInteraction from '../models/UserInteraction.js';
import Friend from '../models/Friend.js';
import FriendRequest from '../models/FriendRequest.js';
import { requireAuth } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

// ========== PROFILE ROUTES ==========

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.toPublic());
  } catch (e) {
    next(e);
  }
});

router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const allowed = ['name', 'age', 'gender', 'interestedIn', 'bio', 'interests', 'photos', 'location'];
    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
    const user = await User.findByIdAndUpdate(req.userId, patch, { new: true });
    res.json(user.toPublic());
  } catch (e) {
    next(e);
  }
});

router.put('/me/password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password too short (min 8 characters)' });
    }
    const user = await User.findById(req.userId);
    const ok = await bcrypt.compare(currentPassword || '', user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Current password incorrect' });
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.delete('/me', requireAuth, async (req, res, next) => {
  try {
    await User.findByIdAndDelete(req.userId);
    await Match.deleteMany({ users: req.userId });
    await UserInteraction.deleteMany({ $or: [{ fromUser: req.userId }, { toUser: req.userId }] });
    await Friend.deleteMany({ users: req.userId });
    await FriendRequest.deleteMany({ $or: [{ fromUser: req.userId }, { toUser: req.userId }] });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ========== DISCOVER ROUTES ==========

router.get('/discover', requireAuth, async (req, res, next) => {
  try {
    const me = await User.findById(req.userId);
    if (!me) return res.status(404).json({ error: 'User not found' });
    
    // Get all friends
    const friends = await Friend.find({ users: me._id });
    const friendIds = friends.map(f => 
      f.users[0].toString() === me._id.toString() ? f.users[1].toString() : f.users[0].toString()
    );
    
    // Get pending requests
    const sentRequests = await FriendRequest.find({ fromUser: me._id, status: 'pending' }).select('toUser');
    const receivedRequests = await FriendRequest.find({ toUser: me._id, status: 'pending' }).select('fromUser');
    const interactions = await UserInteraction.find({ fromUser: me._id }).select('toUser');
    
    const excludeIds = [
      ...friendIds,
      ...sentRequests.map(r => r.toUser.toString()),
      ...receivedRequests.map(r => r.fromUser.toString()),
      ...interactions.map(i => i.toUser.toString()),
      me._id.toString()
    ];
    
    const uniqueExcludeIds = [...new Set(excludeIds)];
    let filter = { _id: { $nin: uniqueExcludeIds } };
    
    if (me.interestedIn && me.interestedIn.length > 0) {
      filter.gender = { $in: me.interestedIn };
    }
    
    const candidates = await User.find(filter).limit(20);
    res.json(candidates.map(u => u.toPublic()));
  } catch (e) {
    next(e);
  }
});

// ========== LIKE / PASS ==========

router.post('/:id/like', requireAuth, async (req, res, next) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ error: 'Cannot like yourself' });
    }
    const them = await User.findById(req.params.id);
    if (!them) return res.status(404).json({ error: 'User not found' });
    
    await UserInteraction.findOneAndUpdate(
      { fromUser: req.userId, toUser: them._id },
      { type: 'like', createdAt: new Date() },
      { upsert: true }
    );
    res.json({ matched: false });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/pass', requireAuth, async (req, res, next) => {
  try {
    await UserInteraction.findOneAndUpdate(
      { fromUser: req.userId, toUser: req.params.id },
      { type: 'pass', createdAt: new Date() },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ========== FORGOT PASSWORD ==========

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'Email not found' });
    
    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();
    
    const resetLink = `http://localhost:5173/reset-password?token=${token}`;
    console.log('=========================================');
    console.log('PASSWORD RESET LINK:', resetLink);
    console.log('=========================================');
    
    res.json({ message: 'Password reset link sent (check console)' });
  } catch (e) {
    next(e);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password too short' });
    }
    
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });
    
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ error: 'User not found' });
    res.json(u.toPublic());
  } catch (e) {
    next(e);
  }
});

// Update my profile - add settings support
router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const allowed = ['name', 'age', 'gender', 'interestedIn', 'bio', 'interests', 'photos', 'location', 'settings'];
    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
    const user = await User.findByIdAndUpdate(req.userId, patch, { new: true });
    res.json(user.toPublic());
  } catch (e) {
    next(e);
  }
});

export default router;


