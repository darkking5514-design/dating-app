import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { api } from '../api.js';
import io from 'socket.io-client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);

  // Load token from localStorage on mount only
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    console.log('Stored token:', storedToken ? 'Yes' : 'No');
    setToken(storedToken);
  }, []);

  // Load user when token changes
  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    
    async function loadUser() {
      setLoading(true);
      try {
        const userData = await api('/users/me', { token });
        if (isMounted) {
          setUser(userData);
          console.log('User loaded:', userData?.name);
        }
      } catch (err) {
        console.error('Load user error:', err);
        if (isMounted) {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    loadUser();
    
    return () => { isMounted = false; };
  }, [token]);

  // Socket connection
  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }
    
    if (socketRef.current) return;
    
    const socket = io('/', {
      auth: { token },
      transports: ['websocket']
    });
    
    socket.on('connect', () => console.log('Socket connected'));
    socket.on('connect_error', (err) => console.error('Socket error:', err.message));
    
    socketRef.current = socket;
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [token, user]);

  async function login(email, password) {
    const response = await api('/auth/login', { 
      method: 'POST', 
      body: { email, password } 
    });
    
    localStorage.setItem('token', response.token);
    setToken(response.token);
    setUser(response.user);
    return response;
  }

  async function signup(payload) {
    const response = await api('/auth/signup', { 
      method: 'POST', 
      body: payload 
    });
    
    localStorage.setItem('token', response.token);
    setToken(response.token);
    setUser(response.user);
    return response;
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }

  return (
    <AuthContext.Provider value={{ token, user, setUser, loading, login, signup, logout, socket: socketRef.current }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);