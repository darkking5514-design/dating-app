# Modern Dating App — React + Express + MongoDB

Full-stack starter for a dating web app.

## Stack
- **Frontend:** Vite + React + React Router
- **Backend:** Node.js + Express + Mongoose
- **DB:** MongoDB
- **Auth:** JWT (httpOnly bearer in localStorage for simplicity)

## Features
- Email/password signup & login (JWT)
- Profile management (bio, age, gender, interested-in, photos, interests, location)
- Settings (password change, preferences, account delete)
- Discover/swipe (like / pass) other users
- Matches list (mutual likes)
- 1-on-1 messaging between matches
- Protected routes

## Run locally

### 1. MongoDB
Install MongoDB locally or use MongoDB Atlas. Get a connection string.

### 2. Backend
```bash
cd backend
cp .env.example .env       # fill MONGO_URI + JWT_SECRET
npm install
npm run dev                # http://localhost:4000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

Frontend proxies `/api` to `http://localhost:4000` (see `vite.config.js`).

## Project structure
```
backend/
  src/
    index.js              Express app
    models/               Mongoose models
    routes/               REST endpoints
    middleware/auth.js    JWT guard
frontend/
  src/
    pages/                Login, Signup, Discover, Profile, EditProfile,
                          Settings, Matches, Chat
    context/AuthContext   Auth state + token storage
    api.js                fetch wrapper
```

## API Endpoints
- `POST /api/auth/signup`        { email, password, name, age, gender, interestedIn }
- `POST /api/auth/login`         { email, password }
- `GET  /api/users/me`           current user
- `PUT  /api/users/me`           update profile
- `DELETE /api/users/me`         delete account
- `PUT  /api/users/me/password`  { currentPassword, newPassword }
- `GET  /api/users/discover`     candidates to swipe
- `POST /api/users/:id/like`     like a user (creates match if mutual)
- `POST /api/users/:id/pass`     pass on a user
- `GET  /api/matches`            list of matches
- `GET  /api/messages/:matchId`  conversation
- `POST /api/messages/:matchId`  { text } send message

## Next steps (not included)
- Real-time messaging (Socket.IO)
- Photo upload (multer + S3 / Cloudinary)
- Email verification & password reset
- Geolocation filtering
- Push notifications
