import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile() {
  const { user } = useAuth();
  if (!user) return null;
  
  return (
    <div className="profile">
      <div className="photo-grid">
        {(user.photos?.length ? user.photos : [null]).map((p, i) => (
          <div key={i} className="photo small" style={{ backgroundImage: p ? `url(${p})` : undefined }}>
            {!p && <div className="photo-empty">{user.name[0]}</div>}
          </div>
        ))}
      </div>
      <h1>{user.name}, {user.age}</h1>
      <div className="muted">{user.gender} · interested in {user.interestedIn?.join(', ') || '—'}</div>
      <p className="bio">{user.bio || 'Add a bio to tell people about you.'}</p>
      {user.interests?.length > 0 && (
        <div className="chips">
          {user.interests.map((t) => <span key={t} className="chip on">{t}</span>)}
        </div>
      )}
      <Link to="/profile/edit" className="btn-primary block">Edit Profile</Link>
    </div>
  );
}