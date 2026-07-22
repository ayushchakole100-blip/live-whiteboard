import React, { useState } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';

const inputStyle = {
  padding: '13px 14px',
  borderRadius: '8px',
  border: '1px solid #ddd',
  fontSize: '15px',
  outline: 'none',
  width: '100%',
  fontFamily: 'inherit',
};

const labelStyle = {
  display: 'block',
  textAlign: 'left',
  fontSize: '13px',
  color: '#555',
  marginBottom: '5px',
  fontWeight: 600,
};

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [college, setCollege] = useState('');
  const [age, setAge] = useState('');
  const [branch, setBranch] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Where to send the user after auth succeeds. If they arrived via a shared
  // room link while logged out, `location.state.from` points at that room.
  const redirectTo = location.state?.from?.pathname || '/';

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isRegistering) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        await setDoc(doc(db, 'users', cred.user.uid), {
          name, college, age, branch, email,
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      padding: '20px',
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.97)',
        padding: '40px',
        borderRadius: '18px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
        width: '100%',
        maxWidth: '440px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '14px', margin: '0 auto 16px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px',
        }}>
          🎨
        </div>
        <h2 style={{ margin: 0, color: '#222', fontSize: '26px' }}>
          {isRegistering ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p style={{ color: '#777', margin: '8px 0 24px', fontSize: '14px' }}>
          {isRegistering ? 'Sign up to start collaborating on LiveBoard Pro' : 'Log in to access your whiteboards'}
        </p>

        {error && (
          <div style={{ background: '#ffebee', color: '#c62828', padding: '10px 12px', borderRadius: '8px', marginBottom: '15px', fontSize: '13px', textAlign: 'left' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isRegistering && (
            <>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input style={inputStyle} type="text" placeholder="Jane Doe" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 2 }}>
                  <label style={labelStyle}>College</label>
                  <input style={inputStyle} type="text" placeholder="e.g. IIT Bombay" value={college} onChange={e => setCollege(e.target.value)} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Age</label>
                  <input style={inputStyle} type="number" min="1" placeholder="20" value={age} onChange={e => setAge(e.target.value)} required />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Branch</label>
                <input style={inputStyle} type="text" placeholder="e.g. Computer Science" value={branch} onChange={e => setBranch(e.target.value)} required />
              </div>
              <div style={{ borderTop: '1px solid #eee', margin: '2px 0' }} />
            </>
          )}

          <div>
            {isRegistering && <label style={labelStyle}>Email Address</label>}
            <input style={inputStyle} type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            {isRegistering && <label style={labelStyle}>Password</label>}
            <input style={inputStyle} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          <button type="submit" disabled={submitting} style={{
            padding: '14px', background: submitting ? '#9aa4e8' : '#667eea', color: 'white', border: 'none',
            borderRadius: '8px', cursor: submitting ? 'default' : 'pointer', fontSize: '16px', fontWeight: 'bold',
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)', marginTop: '4px',
          }}>
            {submitting ? 'Please wait…' : (isRegistering ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <button
          onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
          style={{ background: 'none', border: 'none', color: '#764ba2', cursor: 'pointer', marginTop: '20px', fontWeight: 'bold', fontSize: '14px' }}
        >
          {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </button>
      </div>
    </div>
  );
}
