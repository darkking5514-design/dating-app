import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { countries } from '../utils/countries.js';

export default function Settings() {
  const { token, user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [cities, setCities] = useState([]);

  // Settings state - load from user
  const [settings, setSettings] = useState({
    showMe: true,
    showInTopPicks: true,
    readReceipts: false,
    distance: 50,
    ageMin: 18,
    ageMax: 40,
    genderPreference: 'women',
    location: {
      city: 'London',
      country: 'United Kingdom'
    }
  });

  // Password state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Load settings from user
  useEffect(() => {
    if (user) {
      setSettings({
        showMe: user.settings?.showMe !== undefined ? user.settings.showMe : true,
        showInTopPicks: user.settings?.showInTopPicks !== undefined ? user.settings.showInTopPicks : true,
        readReceipts: user.settings?.readReceipts || false,
        distance: user.settings?.distance || 50,
        ageMin: user.settings?.ageMin || 18,
        ageMax: user.settings?.ageMax || 40,
        genderPreference: user.settings?.genderPreference || 'women',
        location: {
          city: user.location?.city || 'London',
          country: user.location?.country || 'United Kingdom'
        }
      });
    }
  }, [user]);

  // Update cities when country changes
  useEffect(() => {
    if (settings.location.country) {
      const selectedCountry = countries.find(c => c.name === settings.location.country);
      setCities(selectedCountry?.cities || []);
    } else {
      setCities([]);
    }
  }, [settings.location.country]);

  // Update a setting
  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Update location
  const updateLocation = (field, value) => {
    setSettings(prev => ({
      ...prev,
      location: { ...prev.location, [field]: value }
    }));
  };

  // Save all settings
  async function saveSettings() {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const updated = await api('/users/me', {
        method: 'PUT',
        body: {
          settings: {
            showMe: settings.showMe,
            showInTopPicks: settings.showInTopPicks,
            readReceipts: settings.readReceipts,
            distance: settings.distance,
            ageMin: settings.ageMin,
            ageMax: settings.ageMax,
            genderPreference: settings.genderPreference
          },
          location: {
            city: settings.location.city,
            country: settings.location.country
          }
        },
        token
      });

      setUser(updated);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  // Change password
  async function handlePasswordChange(e) {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      setLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      setLoading(false);
      return;
    }

    try {
      await api('/users/me/password', {
        method: 'PUT',
        body: {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        },
        token
      });

      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to update password' });
    } finally {
      setLoading(false);
    }
  }

  // Delete account
  async function deleteAccount() {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone!')) return;

    try {
      await api('/users/me', { method: 'DELETE', token });
      logout();
      navigate('/signup');
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete account' });
    }
  }

  return (
    <div className="settings-page">
      <h1 className="settings-title">Settings</h1>

      {/* Message */}
      {message.text && (
        <div className={`settings-message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* ===== DISCOVERY SETTINGS ===== */}
      <section className="settings-section">
        <h2>Discovery</h2>

        {/* Location */}
        <div className="setting-item">
          <div className="setting-label">
            <span className="setting-icon">📍</span>
            <span>Location</span>
          </div>
          <div className="setting-value location-inputs">
            <select
              value={settings.location.country}
              onChange={(e) => updateLocation('country', e.target.value)}
              className="location-select"
            >
              <option value="">Select Country</option>
              {countries.map((c) => (
                <option key={c.code} value={c.name}>{c.name}</option>
              ))}
            </select>
            <select
              value={settings.location.city}
              onChange={(e) => updateLocation('city', e.target.value)}
              className="location-select"
              disabled={!settings.location.country}
            >
              <option value="">Select City</option>
              {cities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Distance */}
        <div className="setting-item">
          <div className="setting-label">
            <span className="setting-icon">📏</span>
            <span>Maximum Distance</span>
          </div>
          <div className="setting-value">
            <input
              type="range"
              min="1"
              max="100"
              value={settings.distance}
              onChange={(e) => updateSetting('distance', parseInt(e.target.value))}
              className="distance-slider"
            />
            <span className="distance-value">{settings.distance} mi</span>
          </div>
        </div>

        {/* Gender Preference */}
        <div className="setting-item">
          <div className="setting-label">
            <span className="setting-icon">👤</span>
            <span>Show me</span>
          </div>
          <div className="setting-value">
            <select
              value={settings.genderPreference}
              onChange={(e) => updateSetting('genderPreference', e.target.value)}
              className="settings-select"
            >
              <option value="women">Women</option>
              <option value="men">Men</option>
              <option value="everyone">Everyone</option>
            </select>
          </div>
        </div>

        {/* Age Range */}
        <div className="setting-item">
          <div className="setting-label">
            <span className="setting-icon">📅</span>
            <span>Age Range</span>
          </div>
          <div className="setting-value age-range">
            <input
              type="number"
              min="18"
              max={settings.ageMax}
              value={settings.ageMin}
              onChange={(e) => updateSetting('ageMin', parseInt(e.target.value))}
              className="age-input"
            />
            <span>—</span>
            <input
              type="number"
              min={settings.ageMin}
              max="100"
              value={settings.ageMax}
              onChange={(e) => updateSetting('ageMax', parseInt(e.target.value))}
              className="age-input"
            />
          </div>
        </div>
      </section>

      {/* ===== ACCOUNT SETTINGS ===== */}
      <section className="settings-section">
        <h2>Account Settings</h2>

        {/* Show Me on Tinder */}
        <div className="setting-item toggle-item">
          <div className="setting-label">
            <span className="setting-icon">👁️</span>
            <span>Show my profile</span>
          </div>
          <div className="setting-value">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.showMe}
                onChange={() => updateSetting('showMe', !settings.showMe)}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-label">{settings.showMe ? 'On' : 'Off'}</span>
          </div>
        </div>

        {/* Show in Top Picks */}
        <div className="setting-item toggle-item">
          <div className="setting-label">
            <span className="setting-icon">⭐</span>
            <span>Show in Top Picks</span>
          </div>
          <div className="setting-value">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.showInTopPicks}
                onChange={() => updateSetting('showInTopPicks', !settings.showInTopPicks)}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-label">{settings.showInTopPicks ? 'On' : 'Off'}</span>
          </div>
        </div>

        {/* Read Receipts */}
        <div className="setting-item toggle-item">
          <div className="setting-label">
            <span className="setting-icon">📨</span>
            <span>Send Read Receipts</span>
          </div>
          <div className="setting-value">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.readReceipts}
                onChange={() => updateSetting('readReceipts', !settings.readReceipts)}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-label">{settings.readReceipts ? 'On' : 'Off'}</span>
          </div>
        </div>
      </section>

      {/* ===== SAVE BUTTON ===== */}
      <button
        onClick={saveSettings}
        className="settings-btn primary save-btn"
        disabled={saving}
      >
        {saving ? 'Saving...' : '💾 Save All Settings'}
      </button>

      {/* ===== CHANGE PASSWORD ===== */}
      <section className="settings-section">
        <h2>Change Password</h2>

        <form onSubmit={handlePasswordChange} className="password-form">
          <div className="form-group">
            <input
              type="password"
              placeholder="Current Password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              placeholder="New Password (min 8 characters)"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              required
              minLength="8"
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              placeholder="Confirm New Password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="settings-btn primary" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </section>

      {/* ===== DANGER ZONE ===== */}
      <section className="settings-section danger-zone">
        <h2>Danger Zone</h2>
        <div className="setting-item">
          <div className="setting-label">
            <span className="setting-icon">⚠️</span>
            <span>Delete Account</span>
          </div>
          <div className="setting-value">
            <button onClick={deleteAccount} className="settings-btn danger">
              Delete Account
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}