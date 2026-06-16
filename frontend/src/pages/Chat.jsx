import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Chat() {
  const { matchId } = useParams();
  const { token, user, socket } = useAuth();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    // Load initial messages
    api(`/messages/${matchId}`, { token }).then(setMsgs).catch(console.error);
    
    // Join match room
    socket?.emit('joinMatch', matchId);
    
    // Listen for new messages
    const onNewMessage = (msg) => {
      setMsgs(prev => [...prev, msg]);
    };
    socket?.on('newMessage', onNewMessage);
    
    return () => {
      socket?.off('newMessage', onNewMessage);
    };
  }, [matchId, token, socket]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim() || !socket) return;
    socket.emit('sendMessage', { matchId, text: text.trim() });
    setText('');
  }

  return (
    <div className="chat">
      <div className="messages">
        {msgs.map((m) => (
          <div key={m._id} className={`bubble ${m.sender === user.id ? 'me' : 'them'}`}>{m.text}</div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="composer">
        <input placeholder="Say something nice…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-primary" type="submit">Send</button>
      </form>
    </div>
  );
}