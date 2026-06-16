import { Router } from 'express';
import { upload } from '../config/cloudinary.js';
import { requireAuth } from '../middleware/auth.js';
import User from '../models/User.js';

const router = Router();

// Upload single image
router.post('/profile-photo', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const imageUrl = req.file.path;
    
    // Add photo to user's photos array
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $push: { photos: imageUrl } },
      { new: true }
    );

    res.json({
      success: true,
      imageUrl: imageUrl,
      user: user.toPublic()
    });
  } catch (e) {
    console.error('Upload error:', e);
    next(e);
  }
});

// Upload multiple images
router.post('/profile-photos', requireAuth, upload.array('images', 6), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    const imageUrls = req.files.map(file => file.path);
    
    // Add photos to user's photos array
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $push: { photos: { $each: imageUrls } } },
      { new: true }
    );

    res.json({
      success: true,
      imageUrls: imageUrls,
      user: user.toPublic()
    });
  } catch (e) {
    console.error('Upload error:', e);
    next(e);
  }
});

// Remove photo
router.delete('/profile-photo', requireAuth, async (req, res, next) => {
  try {
    const { photoUrl } = req.body;
    if (!photoUrl) {
      return res.status(400).json({ error: 'Photo URL required' });
    }

    const user = await User.findById(req.userId);
    user.photos = user.photos.filter(url => url !== photoUrl);
    await user.save();

    res.json({ success: true, user: user.toPublic() });
  } catch (e) {
    next(e);
  }
});

// Upload and set as main profile photo (first photo)
router.post('/profile-photo/main', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const imageUrl = req.file.path;
    
    // Add photo at the beginning of photos array
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $push: { photos: { $each: [imageUrl], $position: 0 } } },
      { new: true }
    );

    res.json({
      success: true,
      imageUrl: imageUrl,
      user: user.toPublic()
    });
  } catch (e) {
    console.error('Upload error:', e);
    next(e);
  }
});

export default router;