import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Discover() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [friendStatus, setFriendStatus] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load candidates from API
  async function loadCandidates() {
    setLoading(true);
    setError(null);
    try {
      const data = await api('/users/discover', { token });
      console.log('Discover API response:', data.length, 'candidates');
      setList(data);
      setCurrentIndex(0);
      
      // Load friend status for each candidate
      for (const user of data) {
        try {
          const status = await api(`/friends/status/${user.id}`, { token });
          setFriendStatus(prev => ({ ...prev, [user.id]: status.status }));
        } catch (err) {
          console.error('Status error for user:', user.id, err.message);
        }
      }
    } catch (err) { 
      console.error('Discover error:', err);
      setError(err.message);
    }
    setLoading(false);
  }

  // Load candidates when component mounts or token changes
  useEffect(() => { 
    loadCandidates(); 
  }, [token]);

  // Get current user
  const currentUser = list[currentIndex];

  // Send friend request
  async function sendFriendRequest() {
    if (!currentUser || actionLoading) return;
    setActionLoading(true);
    setError(null);
    try {
      const result = await api(`/friends/request/${currentUser.id}`, { method: 'POST', token });
      console.log('Friend request result:', result);
      setFriendStatus(prev => ({ ...prev, [currentUser.id]: 'request_sent' }));
      alert(`Friend request sent to ${currentUser.name}`);
    } catch (err) {
      console.error('Send friend request error:', err);
      setError(err.message);
      // Refresh status to get latest
      try {
        const status = await api(`/friends/status/${currentUser.id}`, { token });
        setFriendStatus(prev => ({ ...prev, [currentUser.id]: status.status }));
      } catch (e) {
        console.error('Refresh status error:', e);
      }
    } finally {
      setActionLoading(false);
    }
  }

  // Pass user (skip)
  function passUser() {
    if (!currentUser) return;
    setCurrentIndex(prev => prev + 1);
  }

  // Refresh candidates
  function refreshCandidates() {
    loadCandidates();
  }

  // Loading state
  if (loading) {
    return (
      <div className="center">
        <div className="loading-spinner"></div>
        <p>Loading candidates...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="center">
        <h2>Something went wrong</h2>
        <p className="error">{error}</p>
        <button className="btn-primary" onClick={refreshCandidates}>Try Again</button>
      </div>
    );
  }

  // No candidates state
  if (!list.length) {
    return (
      <div className="center">
        <h2>You're all caught up</h2>
        <p>No more users to discover right now.</p>
        <button className="btn-primary" onClick={refreshCandidates}>Refresh</button>
      </div>
    );
  }

  // No more users in current batch
  if (!currentUser) {
    return (
      <div className="center">
        <h2>No more for now</h2>
        <button className="btn-primary" onClick={refreshCandidates}>Find More</button>
      </div>
    );
  }

  // Get status for current user
  const status = friendStatus[currentUser.id];

  return (
    <div className="discover">
      {/* User Card */}
      <div className="card">
        {/* Photo Section */}
        <div 
          className="photo" 
          style={{ 
            backgroundImage: currentUser.photos?.[0] ? `url(${currentUser.photos[0]})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {!currentUser.photos?.[0] && (
            <div className="photo-empty">{currentUser.name?.[0] || '?'}</div>
          )}
          <div className="card-info">
            <h2>{currentUser.name}, {currentUser.age}</h2>
            {currentUser.location?.city && (
              <div className="loc">{currentUser.location.city}</div>
            )}
          </div>
        </div>
        
        {/* Bio Section */}
        <div className="bio">
          {currentUser.bio || 'No bio yet.'}
        </div>
        
        {/* Interests Section */}
        {currentUser.interests?.length > 0 && (
          <div className="chips small">
            {currentUser.interests.map(interest => (
              <span key={interest} className="chip on">{interest}</span>
            ))}
          </div>
        )}
      </div>
      
      {/* Action Buttons */}
      <div className="actions">
        {/* Pass Button */}
        <button 
          className="btn-circle pass" 
          onClick={passUser}
          disabled={actionLoading}
        >
          ✕
        </button>
        
        {/* Message Button - Only for Friends */}
        {status === 'friends' && (
          <button 
            className="btn-circle message" 
            onClick={() => navigate(`/direct-chat/${currentUser.id}`)}
          >
            💬
          </button>
        )}
        
        {/* Request Sent Button - Disabled */}
        {status === 'request_sent' && (
          <button 
            className="btn-circle" 
            disabled 
            style={{ background: '#ccc', cursor: 'not-allowed' }}
          >
            ✓
          </button>
        )}
        
        {/* Accept Request Button - When someone sent you request */}
        {status === 'request_received' && (
          <button 
            className="btn-circle" 
            style={{ background: '#ffaa00' }} 
            onClick={() => navigate('/matches')}
          >
            📥
          </button>
        )}
        
        {/* Send Friend Request Button */}
        {(status === 'none' || status === 'rejected' || !status) && (
          <button 
            className="btn-circle like" 
            onClick={sendFriendRequest} 
            disabled={actionLoading}
          >
            {actionLoading ? '...' : '+'}
          </button>
        )}
      </div>
      
      {/* Counter */}
      <div className="counter">
        {currentIndex + 1} of {list.length}
      </div>
    </div>
  );
}