import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { countries } from '../utils/countries.js';

const GENDERS = ['male', 'female', 'nonbinary', 'other'];

export default function EditProfile() {
  const { user, setUser, token } = useAuth();
  const nav = useNavigate();
  const fileInputRef = useRef(null);
  const [f, setF] = useState({
    name: user?.name || '',
    age: user?.age || 25,
    gender: user?.gender || 'other',
    interestedIn: user?.interestedIn || [],
    bio: user?.bio || '',
    interests: (user?.interests || []).join(', '),
    country: user?.location?.country || '',
    city: user?.location?.city || '',
  });
  const [cities, setCities] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);

  // Update cities when country changes
  useEffect(() => {
    if (f.country) {
      const selectedCountry = countries.find(c => c.name === f.country);
      setCities(selectedCountry?.cities || []);
    } else {
      setCities([]);
    }
  }, [f.country]);

  function toggle(g) {
    setF((p) => ({ 
      ...p, 
      interestedIn: p.interestedIn.includes(g) 
        ? p.interestedIn.filter((x) => x !== g) 
        : [...p.interestedIn, g] 
    }));
  }

  // Handle image upload
  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErr('Image size must be less than 5MB');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setErr('Only JPEG, PNG, WEBP, and GIF images are allowed');
      return;
    }

    setUploading(true);
    setErr('');

    const formData = new FormData();
    formData.append('image', file);

    try {
      const result = await fetch('/api/upload/profile-photo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await result.json();
      
      if (!result.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      const currentPhotos = user?.photos || [];
      const updatedPhotos = [...currentPhotos, data.imageUrl];
      const updatedUser = { ...user, photos: updatedPhotos };
      setUser(updatedUser);
      setMsg('Photo uploaded successfully!');
      
    } catch (error) {
      console.error('Upload error:', error);
      setErr(error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
      fileInputRef.current.value = '';
    }
  }

  // Remove photo
  async function removePhoto(photoUrl) {
    try {
      const result = await api('/api/upload/profile-photo', {
        method: 'DELETE',
        body: { photoUrl },
        token
      });
      setUser(result.user);
      setMsg('Photo removed');
    } catch (error) {
      console.error('Remove photo error:', error);
      setErr('Failed to remove photo');
    }
  }

  async function submit(e) {
    e.preventDefault();
    setMsg('');
    setErr('');

    const payload = {
      name: f.name,
      age: Number(f.age),
      gender: f.gender,
      interestedIn: f.interestedIn,
      bio: f.bio,
      interests: f.interests.split(',').map((s) => s.trim()).filter(Boolean),
      photos: user?.photos || [],
      location: { city: f.city, country: f.country },
    };

    try {
      const updated = await api('/users/me', { method: 'PUT', body: payload, token });
      setUser(updated);
      setMsg('Profile saved!');
      setTimeout(() => nav('/profile'), 600);
    } catch (err) {
      setErr(err.message);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <h1>Edit Profile</h1>
      
      {err && <div className="error">{err}</div>}
      {msg && <div className="success">{msg}</div>}

      {/* Image Upload Section */}
      <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '12px' }}>
        <label style={{ fontWeight: 'bold' }}>Profile Photos</label>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={uploading}
            style={{ flex: 1 }}
          />
          <button 
            type="button" 
            className="btn-primary" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ padding: '8px 16px', fontSize: '14px' }}
          >
            {uploading ? 'Uploading...' : 'Upload Photo'}
          </button>
        </div>
        <small style={{ color: 'var(--muted)' }}>Max 5MB • JPEG, PNG, WEBP, GIF</small>
        
        {/* Uploaded Photos Preview */}
        {user?.photos && user.photos.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
            {user.photos.map((url, i) => (
              <div key={i} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <img src={url} alt={`Photo ${i+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  type="button"
                  onClick={() => removePhoto(url)}
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    background: 'red',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <label>Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
      <label>Age<input type="number" min="18" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} /></label>
      
      <label>Gender
        <select value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
          {GENDERS.map((g) => <option key={g}>{g}</option>)}
        </select>
      </label>
      
      <label>Interested in</label>
      <div className="chips">
        {GENDERS.map((g) => (
          <button type="button" key={g} className={`chip ${f.interestedIn.includes(g) ? 'on' : ''}`} onClick={() => toggle(g)}>
            {g}
          </button>
        ))}
      </div>
      
      <label>Bio<textarea rows="4" maxLength={500} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></label>
      <label>Interests (comma separated)<input value={f.interests} onChange={(e) => setF({ ...f, interests: e.target.value })} placeholder="hiking, coffee, jazz" /></label>
      
      <div className="row">
        {/* Country Dropdown */}
        <label>
          Country
          <select 
            value={f.country} 
            onChange={(e) => setF({ ...f, country: e.target.value, city: '' })}
            required
          >
            <option value="">Select Country</option>
            {countries.map((c) => (
              <option key={c.code} value={c.name}>{c.name}</option>
            ))}
          </select>
        </label>

        {/* City Dropdown */}
        <label>
          City
          <select 
            value={f.city} 
            onChange={(e) => setF({ ...f, city: e.target.value })}
            required
            disabled={!f.country}
          >
            <option value="">Select City</option>
            {cities.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </label>
      </div>
      
      <button type="submit" className="btn-primary">Save Profile</button>
    </form>
  );
}