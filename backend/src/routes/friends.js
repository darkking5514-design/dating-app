import { Router } from 'express';
import FriendRequest from '../models/FriendRequest.js';
import Friend from '../models/Friend.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Send friend request
router.post('/request/:userId', requireAuth, async (req, res, next) => {
  try {
    const toUserId = req.params.userId;
    const fromUserId = req.userId;

    console.log('Send friend request:', { fromUserId, toUserId });

    if (toUserId === fromUserId) {
      return res.status(400).json({ error: 'Cannot send request to yourself' });
    }

    const toUser = await User.findById(toUserId);
    if (!toUser) return res.status(404).json({ error: 'User not found' });

    // Check if already friends
    const existingFriend = await Friend.findOne({ 
      users: { $all: [fromUserId, toUserId] } 
    });
    
    if (existingFriend) {
      return res.status(400).json({ error: 'Already friends' });
    }

    // Check if there is a pending request FROM me TO them
    const myPendingRequest = await FriendRequest.findOne({
      fromUser: fromUserId,
      toUser: toUserId,
      status: 'pending'
    });
    
    if (myPendingRequest) {
      return res.status(400).json({ error: 'Friend request already sent' });
    }

    // Check if there is a pending request FROM them TO me
    const theirPendingRequest = await FriendRequest.findOne({
      fromUser: toUserId,
      toUser: fromUserId,
      status: 'pending'
    });
    
    if (theirPendingRequest) {
      return res.status(400).json({ error: 'They already sent you a request' });
    }

    // Check for rejected request - update it
    const rejectedRequest = await FriendRequest.findOne({
      $or: [
        { fromUser: fromUserId, toUser: toUserId, status: 'rejected' },
        { fromUser: toUserId, toUser: fromUserId, status: 'rejected' }
      ]
    });

    if (rejectedRequest) {
      rejectedRequest.status = 'pending';
      rejectedRequest.fromUser = fromUserId;
      rejectedRequest.toUser = toUserId;
      await rejectedRequest.save();
      console.log('Rejected request updated to pending');
      return res.json({ message: 'Friend request sent', requestId: rejectedRequest._id });
    }

    // Create new request
    const request = await FriendRequest.create({
      fromUser: fromUserId,
      toUser: toUserId,
      status: 'pending'
    });

    console.log('New friend request created:', request._id);
    res.json({ message: 'Friend request sent', requestId: request._id });
  } catch (e) {
    console.error('Send request error:', e);
    next(e);
  }
});

// Get pending requests (received)
router.get('/requests/pending', requireAuth, async (req, res, next) => {
  try {
    console.log('Fetching pending requests for user:', req.userId);
    
    const requests = await FriendRequest.find({
      toUser: req.userId,
      status: 'pending'
    }).populate('fromUser', 'name age photos gender bio');
    
    console.log('Found pending requests:', requests.length);
    res.json(requests);
  } catch (e) {
    console.error('Get pending requests error:', e);
    res.json([]);
  }
});

// Get sent requests
router.get('/requests/sent', requireAuth, async (req, res, next) => {
  try {
    const requests = await FriendRequest.find({
      fromUser: req.userId,
      status: 'pending'
    }).populate('toUser', 'name age photos gender bio');
    
    res.json(requests);
  } catch (e) {
    res.json([]);
  }
});

// Accept friend request
router.post('/request/:requestId/accept', requireAuth, async (req, res, next) => {
  try {
    const requestId = req.params.requestId;
    console.log('Accept request:', { requestId, userId: req.userId });

    // Find the request
    const request = await FriendRequest.findById(requestId);
    
    if (!request) {
      console.log('Request not found:', requestId);
      return res.status(404).json({ error: 'Request not found' });
    }
    
    // Check authorization
    if (request.toUser.toString() !== req.userId) {
      console.log('Not authorized:', request.toUser.toString(), 'vs', req.userId);
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Check status
    if (request.status !== 'pending') {
      console.log('Request already processed, status:', request.status);
      return res.status(400).json({ error: 'Request already processed' });
    }

    // Check if friendship already exists (to avoid duplicate)
    const existingFriend = await Friend.findOne({ 
      users: { $all: [request.fromUser, request.toUser] } 
    });
    
    let friend = null;
    if (!existingFriend) {
      // Create friendship
      friend = await Friend.create({
        users: [request.fromUser, request.toUser]
      });
      console.log('Friendship created:', friend._id);
    } else {
      console.log('Friendship already exists');
      friend = existingFriend;
    }

    // Update request status
    request.status = 'accepted';
    await request.save();
    console.log('Request status updated to accepted');

    // Return success with friend data
    const friendUser = await User.findById(request.fromUser).select('name age photos gender');
    
    res.json({ 
      message: 'Friend request accepted', 
      friendId: friend._id,
      friend: friendUser
    });
  } catch (e) {
    console.error('Accept request error:', e);
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

// Reject friend request
router.post('/request/:requestId/reject', requireAuth, async (req, res, next) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId);
    
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.toUser.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    request.status = 'rejected';
    await request.save();

    res.json({ message: 'Friend request rejected' });
  } catch (e) {
    next(e);
  }
});

// Get all friends
router.get('/list', requireAuth, async (req, res, next) => {
  try {
    console.log('Fetching friends for user:', req.userId);
    
    const friends = await Friend.find({ users: req.userId });
    console.log('Found friend records:', friends.length);
    
    const friendIds = friends.map(f => {
      const id1 = f.users[0].toString();
      const id2 = f.users[1].toString();
      return id1 === req.userId ? id2 : id1;
    });
    
    const friendUsers = await User.find({ _id: { $in: friendIds } }).select('name age photos gender bio');
    
    console.log('Found friends:', friendUsers.length);
    res.json(friendUsers);
  } catch (e) {
    console.error('Get friends error:', e);
    res.json([]);
  }
});

// Check friend status
router.get('/status/:userId', requireAuth, async (req, res, next) => {
  try {
    const otherUserId = req.params.userId;
    const myUserId = req.userId;
    
    // Check if friends
    const isFriend = await Friend.findOne({ users: { $all: [myUserId, otherUserId] } });
    if (isFriend) {
      return res.json({ status: 'friends' });
    }
    
    // Check if pending request from me to them
    const myRequest = await FriendRequest.findOne({
      fromUser: myUserId,
      toUser: otherUserId,
      status: 'pending'
    });
    if (myRequest) {
      return res.json({ status: 'request_sent', requestId: myRequest._id });
    }
    
    // Check if pending request from them to me
    const theirRequest = await FriendRequest.findOne({
      fromUser: otherUserId,
      toUser: myUserId,
      status: 'pending'
    });
    if (theirRequest) {
      return res.json({ status: 'request_received', requestId: theirRequest._id });
    }
    
    // Check if rejected
    const rejected = await FriendRequest.findOne({
      $or: [
        { fromUser: myUserId, toUser: otherUserId, status: 'rejected' },
        { fromUser: otherUserId, toUser: myUserId, status: 'rejected' }
      ]
    });
    if (rejected) {
      return res.json({ status: 'rejected' });
    }
    
    res.json({ status: 'none' });
  } catch (e) {
    console.error('Status check error:', e);
    res.json({ status: 'none' });
  }
});

export default router;