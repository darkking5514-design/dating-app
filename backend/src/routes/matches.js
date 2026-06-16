import { Router } from 'express';
import Match from '../models/Match.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const matches = await Match.find({ users: req.userId })
      .populate('users', 'name photos age bio')
      .sort('-createdAt');
    const data = matches.map((m) => {
      const other = m.users.find((u) => !u._id.equals(req.userId));
      return { id: m._id, createdAt: m.createdAt, user: other };
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

export default router;
