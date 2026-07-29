import React, { useState } from 'react';
import { Lock, KeyRound, ArrowRight, ShieldCheck, Video } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === 'SUTOuser1234') {
      sessionStorage.setItem('suto_auth', 'true');
      onLoginSuccess();
    } else {
      setError(true);
      setTimeout(() => setError(false), 1500);
    }
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
      <div 
        className="glass-panel animate-fade-in" 
        style={{ width: '100%', maxWidth: '420px', padding: '36px 32px', textAlign: 'center' }}
      >
        <div style={{ 
          width: '64px', 
          height: '64px', 
          borderRadius: '16px', 
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.3))', 
          border: '1px solid rgba(99, 102, 241, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          boxShadow: 'var(--shadow-glow)'
        }}>
          <Video size={32} color="#8b5cf6" />
        </div>

        <h2 style={{ fontSize: '1.6rem', fontWeight: '700', marginBottom: '8px' }}>
          SUTO VoiceOver Studio
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '28px' }}>
          Internal video voice-over generator & editor
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px', textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '500' }}>
              Access Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock 
                size={18} 
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} 
              />
              <input
                type="password"
                className="input-field"
                style={{ 
                  paddingLeft: '42px',
                  borderColor: error ? 'var(--danger)' : undefined,
                  boxShadow: error ? '0 0 10px rgba(239, 68, 68, 0.4)' : undefined
                }}
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>
            {error && (
              <span style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '6px', display: 'block' }}>
                Incorrect password. Please try again.
              </span>
            )}
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
          >
            Access Studio <ArrowRight size={18} />
          </button>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
          <ShieldCheck size={14} /> Password protected access
        </div>
      </div>
    </div>
  );
}
