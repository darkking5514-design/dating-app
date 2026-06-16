import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Discover from './pages/Discover.jsx';
import Profile from './pages/Profile.jsx';
import EditProfile from './pages/EditProfile.jsx';
import Settings from './pages/Settings.jsx';
import Matches from './pages/Matches.jsx';
import Chat from './pages/Chat.jsx';
import DirectChat from './pages/DirectChat.jsx';

function Protected({ children }) {
  const { token, loading } = useAuth();
  
  if (loading) {
    return <div className="center">Loading...</div>;
  }
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

function Nav() {
  const { user, logout } = useAuth();
  const location = useLocation();
  
  if (!user || location.pathname === '/login' || location.pathname === '/signup') {
    return null;
  }
  
  return (
    <nav className="nav">
      <div className="brand">Spark</div>
      <div className="links">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Discover</Link>
        <Link to="/matches" className={location.pathname === '/matches' ? 'active' : ''}>Matches</Link>
        <Link to="/profile" className={location.pathname === '/profile' ? 'active' : ''}>Profile</Link>
        <Link to="/settings" className={location.pathname === '/settings' ? 'active' : ''}>Settings</Link>
        <button onClick={logout} className="link-btn">Logout</button>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <>
      <Nav />
      <main className="container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<Protected><Discover /></Protected>} />
          <Route path="/matches" element={<Protected><Matches /></Protected>} />
          <Route path="/chat/:matchId" element={<Protected><Chat /></Protected>} />
          <Route path="/direct-chat/:userId" element={<Protected><DirectChat /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="/profile/edit" element={<Protected><EditProfile /></Protected>} />
          <Route path="/settings" element={<Protected><Settings /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}