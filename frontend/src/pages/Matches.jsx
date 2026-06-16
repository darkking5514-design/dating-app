import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Matches() {
  const { token, user, socket } = useAuth();
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastMessages, setLastMessages] = useState({});

  async function loadUnreadCounts() {
    try {
      const counts = await api('/messages/unread-counts', { token });
      setUnreadCounts(counts);
    } catch (err) {
      console.error('Load unread counts error:', err);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      // Get friends list
      const friendsData = await api('/friends/list', { token }).catch(() => []);
      setFriends(friendsData);
      
      // Get pending requests
      const requests = await api('/friends/requests/pending', { token }).catch(() => []);
      setPendingRequests(requests);
      
      // Get sent requests
      const sent = await api('/friends/requests/sent', { token }).catch(() => []);
      setSentRequests(sent);
      
      // Load unread counts
      await loadUnreadCounts();
      
      // Load last message for each friend
      for (const friend of friendsData) {
        await loadLastMessage(friend._id);
      }
    } catch (err) {
      console.error('Load data error:', err);
    }
    setLoading(false);
  }

  async function loadLastMessage(friendId) {
    try {
      const messages = await api(`/messages/direct/${friendId}`, { token });
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        setLastMessages(prev => ({
          ...prev,
          [friendId]: {
            text: lastMsg.text,
            senderId: lastMsg.sender,
            time: lastMsg.createdAt
          }
        }));
      }
    } catch (err) {
      console.error('Load last message error:', err);
    }
  }

  useEffect(() => {
    loadData();
  }, [token]);

  // Socket listeners for real-time updates
  useEffect(() => {
    if (!socket) return;
    
    const handleNewDirectMessage = (msg) => {
      console.log('New message in Matches:', msg);
      
      // Update unread count if message is from someone else
      if (msg.sender._id !== user.id) {
        setUnreadCounts(prev => ({
          ...prev,
          [msg.sender._id]: (prev[msg.sender._id] || 0) + 1
        }));
        
        // Update last message
        setLastMessages(prev => ({
          ...prev,
          [msg.sender._id]: {
            text: msg.text,
            senderId: msg.sender._id,
            time: new Date().toISOString()
          }
        }));
        
        // Show browser notification
        if (Notification.permission === 'granted') {
          new Notification(msg.sender.name, { body: msg.text });
        }
      } else {
        // Message sent by me - update last message
        setLastMessages(prev => ({
          ...prev,
          [msg.receiver]: {
            text: msg.text,
            senderId: user.id,
            time: new Date().toISOString()
          }
        }));
      }
    };
    
    const handleMessagesRead = (data) => {
      if (data.byUser) {
        setUnreadCounts(prev => ({ ...prev, [data.byUser]: 0 }));
      }
    };
    
    socket.on('newDirectMessage', handleNewDirectMessage);
    socket.on('messagesRead', handleMessagesRead);
    
    return () => {
      socket.off('newDirectMessage', handleNewDirectMessage);
      socket.off('messagesRead', handleMessagesRead);
    };
  }, [socket, user.id]);

  // Request notification permission
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Sort friends by last message time (newest first)
  const sortedFriends = [...friends].sort((a, b) => {
    const timeA = lastMessages[a._id]?.time || 0;
    const timeB = lastMessages[b._id]?.time || 0;
    return new Date(timeB) - new Date(timeA);
  });

  async function acceptRequest(requestId) {
    try {
      await api(`/friends/request/${requestId}/accept`, { method: 'POST', token });
      await loadData();
    } catch (err) {
      console.error('Accept error:', err);
      alert(err.message || 'Something went wrong');
    }
  }

  async function rejectRequest(requestId) {
    try {
      await api(`/friends/request/${requestId}/reject`, { method: 'POST', token });
      await loadData();
    } catch (err) {
      console.error('Reject error:', err);
      alert(err.message || 'Something went wrong');
    }
  }

  function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }

  if (loading) {
    return (
      <div className="center">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="matches">
      {/* Friend Requests Received */}
      <h1>Friend Requests</h1>
      {pendingRequests.length === 0 && <p className="center">No pending friend requests</p>}
      <ul>
        {pendingRequests.map((req) => (
          <li key={req._id}>
            <div className="match-row">
              <div className="avatar" style={{ 
                backgroundImage: req.fromUser.photos?.[0] ? `url(${req.fromUser.photos[0]})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}>
                {!req.fromUser.photos?.[0] && <span>{req.fromUser.name?.[0] || '?'}</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div className="name">{req.fromUser.name}, {req.fromUser.age}</div>
                <div className="muted">Wants to be friends</div>
              </div>
              <button className="btn-primary" style={{ padding: '8px 16px', marginRight: '8px' }} onClick={() => acceptRequest(req._id)}>
                Accept
              </button>
              <button className="btn-secondary" style={{ padding: '8px 16px' }} onClick={() => rejectRequest(req._id)}>
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Chats - Sorted by last message */}
      <h1 style={{ marginTop: '24px' }}>Chats</h1>
      {sortedFriends.length === 0 && <p className="center">No friends yet. Send some friend requests!</p>}
      <ul>
        {sortedFriends.map((u) => (
          <li key={u._id}>
            <Link to={`/direct-chat/${u._id}`} className="match-row">
              <div className="avatar" style={{ 
                backgroundImage: u.photos?.[0] ? `url(${u.photos[0]})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}>
                {!u.photos?.[0] && <span>{u.name?.[0] || '?'}</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div className="name">{u.name}, {u.age}</div>
                <div className="muted">
                  {lastMessages[u._id] ? (
                    <>
                      {lastMessages[u._id].senderId === u._id ? '' : 'You: '}
                      {lastMessages[u._id].text.length > 30 
                        ? lastMessages[u._id].text.substring(0, 30) + '...' 
                        : lastMessages[u._id].text}
                      <span className="time">{formatTime(lastMessages[u._id].time)}</span>
                    </>
                  ) : (
                    'Tap to start chatting'
                  )}
                </div>
              </div>
              {unreadCounts[u._id] > 0 && (
                <div className="unread-count">{unreadCounts[u._id]}</div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}