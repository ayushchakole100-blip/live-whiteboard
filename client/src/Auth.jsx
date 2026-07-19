import React, { useState } from 'react';
import { auth } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    }}>
      <div style={{ 
        background: 'rgba(255, 255, 255, 0.95)', 
        padding: '40px', 
        borderRadius: '16px', 
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)', 
        width: '100%', 
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        <h2 style={{ marginBottom: '10px', color: '#333', fontSize: '28px' }}>
          {isRegistering ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p style={{ color: '#666', marginBottom: '25px' }}>
          {isRegistering ? 'Sign up to start collaborating' : 'Log in to access your whiteboards'}
        </p>
        
        {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '14px' }}>{error}</div>}
        
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            type="email" 
            placeholder="Email Address" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
            style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', outline: 'none' }}
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
            style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', outline: 'none' }}
          />
          <button type="submit" style={{ 
            padding: '14px', background: '#667eea', color: 'white', border: 'none', 
            borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold',
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
          }}>
            {isRegistering ? 'Sign Up' : 'Sign In'}
          </button>
        </form>
        
        <button 
          onClick={() => setIsRegistering(!isRegistering)} 
          style={{ background: 'none', border: 'none', color: '#764ba2', cursor: 'pointer', marginTop: '20px', fontWeight: 'bold' }}
        >
          {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </button>
      </div>
    </div>
  );
}