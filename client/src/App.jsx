import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import Auth from './Auth';
import Whiteboard from './Whiteboard';

function Dashboard() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');

  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 9);
    navigate(`/room/${newRoomId}`);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (joinCode.trim()) navigate(`/room/${joinCode.trim()}`);
  };

  return (
    <div style={{ backgroundColor: '#f4f7f6', minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      {/* Navigation Bar */}
      <nav style={{ background: 'white', padding: '15px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h2 style={{ margin: 0, color: '#333' }}>LiveBoard Pro</h2>
        <button onClick={() => signOut(auth)} style={{ padding: '8px 16px', background: '#ffebee', color: '#c62828', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          Log Out
        </button>
      </nav>

      <div style={{ maxWidth: '800px', margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
        <h1 style={{ color: '#2c3e50', marginBottom: '10px' }}>Welcome to your Workspace</h1>
        <p style={{ color: '#7f8c8d', marginBottom: '40px' }}>Create a new live session or join an existing one.</p>
        
        <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', flexWrap: 'wrap' }}>
          
          {/* Create Room Card */}
          <div style={{ flex: '1', minWidth: '300px', background: 'white', padding: '40px 30px', borderRadius: '12px', boxShadow: '0 8px 20px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginTop: 0 }}>Start Fresh</h3>
            <p style={{ color: '#7f8c8d', fontSize: '14px', marginBottom: '25px' }}>Generate a unique link and start drawing instantly.</p>
            <button onClick={createRoom} style={{ padding: '14px 24px', background: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', width: '100%' }}>
              + Create New Room
            </button>
          </div>

          {/* Join Room Card */}
          <div style={{ flex: '1', minWidth: '300px', background: 'white', padding: '40px 30px', borderRadius: '12px', boxShadow: '0 8px 20px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginTop: 0 }}>Join Session</h3>
            <p style={{ color: '#7f8c8d', fontSize: '14px', marginBottom: '25px' }}>Enter a code provided by your team member.</p>
            <form onSubmit={handleJoin} style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="text" placeholder="e.g., a8f9x2" value={joinCode} onChange={(e) => setJoinCode(e.target.value)}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' }}
              />
              <button type="submit" style={{ padding: '12px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                Join
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}

function RoomView() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Link copied! Share it with your team.");
  };

  return (
    <div style={{ backgroundColor: '#e9ecef', minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      <nav style={{ background: 'white', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
        <button onClick={() => navigate('/')} style={{ padding: '8px 16px', background: 'none', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer' }}>
          ← Back to Dashboard
        </button>
        <div style={{ fontWeight: 'bold', color: '#555' }}>Room: <span style={{ color: '#3498db' }}>{roomId}</span></div>
        <button onClick={copyLink} style={{ padding: '8px 16px', background: '#9b59b6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          📋 Copy Link
        </button>
      </nav>
      
      <Whiteboard roomId={roomId} />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}><h2>Loading Workspace...</h2></div>;

  return (
    <Router>
      <Routes>
        <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/room/:roomId" element={user ? <RoomView /> : <Navigate to="/login" />} />
        <Route path="/login" element={!user ? <Auth /> : <Navigate to="/" />} />
      </Routes>
    </Router>
  );
}