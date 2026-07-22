import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
// import { onAuthStateChanged, signOut } from 'firebase/auth';
// import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import Auth from './Auth';
import Whiteboard from './Whiteboard';

// Guards a route: if not logged in, remember where the user was trying to go
// (e.g. a shared /room/:roomId link) and send them straight back there after login.
function RequireAuth({ user, children }) {
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function Dashboard({ user }) {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const loadProfile = async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) setProfile(snap.data());
    };
    loadProfile();
  }, [user.uid]);

  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 9);
    navigate(`/room/${newRoomId}`);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (joinCode.trim()) navigate(`/room/${joinCode.trim()}`);
  };

  const displayName = user.displayName || profile?.name || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="dashboard-layout" style={{ backgroundColor: '#f4f7f6', minHeight: '100vh', width: '100%', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", display: 'flex' }}>
      {/* LEFT SIDEBAR — user info */}
      <aside className="dashboard-sidebar" style={{
        width: '260px', minWidth: '220px', background: 'white', padding: '30px 20px',
        boxShadow: '2px 0 10px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', textAlign: 'center', flexShrink: 0,
      }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '28px', fontWeight: 'bold', marginBottom: '16px',
        }}>
          {initial}
        </div>
        <h3 style={{ margin: '0 0 4px', color: '#2c3e50' }}>{displayName}</h3>
        <p style={{ margin: '0 0 20px', color: '#95a5a6', fontSize: '13px', wordBreak: 'break-all' }}>{user.email}</p>

        <div style={{ width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {profile?.college && (
            <div>
              <div style={{ fontSize: '11px', color: '#95a5a6', fontWeight: 'bold', textTransform: 'uppercase' }}>College</div>
              <div style={{ fontSize: '14px', color: '#2c3e50' }}>{profile.college}</div>
            </div>
          )}
          {profile?.branch && (
            <div>
              <div style={{ fontSize: '11px', color: '#95a5a6', fontWeight: 'bold', textTransform: 'uppercase' }}>Branch</div>
              <div style={{ fontSize: '14px', color: '#2c3e50' }}>{profile.branch}</div>
            </div>
          )}
          {profile?.age && (
            <div>
              <div style={{ fontSize: '11px', color: '#95a5a6', fontWeight: 'bold', textTransform: 'uppercase' }}>Age</div>
              <div style={{ fontSize: '14px', color: '#2c3e50' }}>{profile.age}</div>
            </div>
          )}
        </div>

        <button onClick={() => signOut(auth)} style={{
          marginTop: 'auto', paddingTop: '20px', width: '100%', padding: '10px 16px', background: '#ffebee',
          color: '#c62828', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '30px',
        }}>
          Log Out
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <nav style={{ background: 'white', padding: '15px 40px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h2 style={{ margin: 0, color: '#333' }}>LiveBoard Pro</h2>
        </nav>

        <div style={{ maxWidth: '800px', margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
          <h1 style={{ color: '#2c3e50', marginBottom: '10px' }}>Welcome to your Workspace</h1>
          <p style={{ color: '#7f8c8d', marginBottom: '40px' }}>Create a new live session or join an existing one.</p>

          <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', flexWrap: 'wrap' }}>

            <div style={{ flex: '1', minWidth: '280px', background: 'white', padding: '40px 30px', borderRadius: '12px', boxShadow: '0 8px 20px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop: 0 }}>Start Fresh</h3>
              <p style={{ color: '#7f8c8d', fontSize: '14px', marginBottom: '25px' }}>Generate a unique link and start drawing instantly. You'll be the room admin.</p>
              <button onClick={createRoom} style={{ padding: '14px 24px', background: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', width: '100%' }}>
                + Create New Room
              </button>
            </div>

            <div style={{ flex: '1', minWidth: '280px', background: 'white', padding: '40px 30px', borderRadius: '12px', boxShadow: '0 8px 20px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop: 0 }}>Join Session</h3>
              <p style={{ color: '#7f8c8d', fontSize: '14px', marginBottom: '25px' }}>Enter a code provided by your team member. The room admin will need to approve you.</p>
              <form onSubmit={handleJoin} style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text" placeholder="e.g., a8f9x2" value={joinCode} onChange={(e) => setJoinCode(e.target.value)}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none', minWidth: 0 }}
                />
                <button type="submit" style={{ padding: '12px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Join
                </button>
              </form>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function RoomView({ user }) {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link copied! Share it with your team.');
  };

  return (
    <div style={{ backgroundColor: '#e9ecef', minHeight: '100vh', width: '100%', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      <nav style={{ background: 'white', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ fontWeight: 'bold', color: '#555' }}>Room: <span style={{ color: '#3498db' }}>{roomId}</span></div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={copyLink} style={{ padding: '8px 16px', background: '#9b59b6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            📋 Copy Link
          </button>
          {/* Clean exit: leaves the room on the server before navigating away */}
          <button onClick={() => navigate('/')} style={{ padding: '8px 16px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            🚪 Exit Room
          </button>
        </div>
      </nav>

      <Whiteboard roomId={roomId} user={user} />
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

  if (loading) return <div style={{ display: 'flex', height: '100vh', width: '100%', justifyContent: 'center', alignItems: 'center' }}><h2>Loading Workspace...</h2></div>;

  return (
    <Router>
      <Routes>
        <Route path="/" element={<RequireAuth user={user}><Dashboard user={user} /></RequireAuth>} />
        <Route path="/room/:roomId" element={<RequireAuth user={user}><RoomView user={user} /></RequireAuth>} />
        <Route path="/login" element={!user ? <Auth /> : <Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
