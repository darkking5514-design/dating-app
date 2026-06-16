import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function DirectChat() {
  const { userId } = useParams();
  const { token, user, socket } = useAuth();
  const navigate = useNavigate();
  const [msgs, setMsgs] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const endRef = useRef(null);
  const hasLoaded = useRef(false);

  // Load data - only once
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    
    let isMounted = true;
    
    async function loadData() {
      setLoading(true);
      
      try {
        // Load user info
        const userData = await api(`/users/${userId}`, { token });
        if (isMounted) setOtherUser(userData);
        
        // Load messages
        const messages = await api(`/messages/direct/${userId}`, { token });
        if (isMounted) setMsgs(messages || []);
        
        // Mark as read
        await api(`/messages/mark-all-read/${userId}`, { method: 'POST', token }).catch(() => {});
        
      } catch (err) {
        console.error('Load error:', err);
        if (isMounted) navigate('/matches');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    loadData();
    
    return () => { isMounted = false; };
  }, [userId, token, navigate]);

  // Socket setup - only when everything is ready
  useEffect(() => {
    if (!socket || !user || !otherUser || loading) return;
    
    // Join room
    socket.emit('joinDirectChat', userId);
    
    const handleNewMessage = (msg) => {
      if (msg.sender._id === userId || msg.sender._id === user.id) {
        setMsgs(prev => {
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        
        if (msg.sender._id === userId) {
          socket.emit('markMessagesRead', { fromUserId: userId });
        }
        
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    };
    
    const handleUserTyping = (data) => {
      if (data.userId === userId) {
        setIsUserTyping(data.isTyping);
        if (!data.isTyping) setTimeout(() => setIsUserTyping(false), 1000);
      }
    };
    
    socket.on('newDirectMessage', handleNewMessage);
    socket.on('userTyping', handleUserTyping);
    
    return () => {
      socket.emit('leaveDirectChat', userId);
      socket.off('newDirectMessage', handleNewMessage);
      socket.off('userTyping', handleUserTyping);
    };
  }, [socket, user, userId, otherUser, loading]);

  // Auto scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  const handleTextChange = (e) => {
    setText(e.target.value);
    socket?.emit('typing', { receiverId: userId, isTyping: true });
    
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit('typing', { receiverId: userId, isTyping: false });
    }, 1000);
  };

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    
    const messageText = text.trim();
    const tempId = Date.now().toString();
    
    setText('');
    setSending(true);
    socket?.emit('typing', { receiverId: userId, isTyping: false });
    
    const tempMsg = {
      tempId,
      sender: user.id,
      text: messageText,
      createdAt: new Date().toISOString(),
      temp: true
    };
    
    setMsgs(prev => [...prev, tempMsg]);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    
    try {
      const msg = await api(`/messages/direct/${userId}`, {
        method: 'POST',
        body: { text: messageText },
        token
      });
      
      setMsgs(prev => prev.map(m => m.tempId === tempId ? msg : m));
      socket?.emit('sendDirectMessage', { receiverId: userId, text: messageText, tempId });
      
    } catch (err) {
      console.error('Send error:', err);
      setMsgs(prev => prev.filter(m => m.tempId !== tempId));
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="center">
        <div className="loading-spinner"></div>
        <p>Loading chat...</p>
      </div>
    );
  }

  if (!otherUser) {
    return (
      <div className="center">
        <p>User not found</p>
        <button className="btn-primary" onClick={() => navigate('/matches')}>Back to Matches</button>
      </div>
    );
  }

  return (
    <div className="chat">
      <div className="chat-header">
        <button onClick={() => navigate('/matches')} className="back-btn">←</button>
        <div>
          <h2>{otherUser.name}, {otherUser.age}</h2>
          {isUserTyping && <div className="typing-indicator">typing...</div>}
        </div>
      </div>
      
      <div className="messages">
        {msgs.length === 0 && (
          <div className="center muted" style={{ padding: '40px' }}>
            No messages yet. Say hi!
          </div>
        )}
        {msgs.map((m, idx) => (
          <div 
            key={m._id || m.tempId || idx} 
            className={`bubble ${(m.sender === user.id || m.sender?._id === user.id) ? 'me' : 'them'} ${m.temp ? 'temp' : ''}`}
          >
            {m.text}
            {m.temp && <span className="sending"> ✓</span>}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      
      <form onSubmit={send} className="composer">
        <input 
          placeholder={`Message ${otherUser.name}...`} 
          value={text} 
          onChange={handleTextChange}
          disabled={sending}
          autoFocus
        />
        <button className="btn-primary" type="submit" disabled={sending || !text.trim()}>
          {sending ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}