import React, { useRef, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('https://live-whiteboard-81ro.onrender.com');

// const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://live-whiteboard-81ro.onrender.com';
// const socket = io(SOCKET_URL);

const STANDARD_COLORS = [
  '#000000', '#495057', '#868e96', '#ffffff',
  '#e03131', '#f08c00', '#ffd43b', '#2f9e44',
  '#0c8599', '#1971c2', '#7048e8', '#c2255c',
  '#e64980', '#495057', '#20c997', '#fd7e14',
];

// Fixed internal drawing resolution. The <canvas> is scaled to fit the
// screen with CSS (so it works on phones/tablets), and pointer/touch
// coordinates are scaled back up to this resolution before drawing.
const CANVAS_W = 1200;
const CANVAS_H = 675;

export default function Whiteboard({ roomId, user }) {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const contextRef = useRef(null);

  // Each participant's strokes live on their own offscreen canvas ("layer").
  // The visible canvas is just those layers drawn on top of each other in
  // join order. This is what makes "erase only your own drawing" possible:
  // your eraser can only ever touch pixels on your own layer.
  const layersRef = useRef({});   // userId -> offscreen <canvas>
  const orderRef = useRef([]);    // stable stacking order of userIds


  const isDrawingRef = useRef(false);
  const startCoordRef = useRef({ x: 0, y: 0 });
  const currentStrokeIdRef = useRef(null);
  const undoStackRef = useRef([]);  // strokeIds this user has drawn, most recent last
  const redoStackRef = useRef([]);  // strokeIds this user has undone, most recent last

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tool, setTool] = useState('pen'); // 'pen', 'eraser', 'rectangle', 'circle', 'line'
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [showPalette, setShowPalette] = useState(false);

  // Room access state
  const [status, setStatus] = useState('connecting'); // connecting | waiting | approved | denied
  const [isHost, setIsHost] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const getLayer = (uid) => {
    if (!layersRef.current[uid]) {
      const c = document.createElement('canvas');
      c.width = CANVAS_W;
      c.height = CANVAS_H;
      const lctx = c.getContext('2d');
      lctx.lineCap = 'round';
      lctx.lineJoin = 'round';
      layersRef.current[uid] = c;
      orderRef.current.push(uid);
    }
    return layersRef.current[uid];
  };

  const compositeAll = () => {
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    orderRef.current.forEach((uid) => {
      const layer = layersRef.current[uid];
      if (layer) ctx.drawImage(layer, 0, 0);
    });
  };

  const resetLayers = () => {
    layersRef.current = {};
    orderRef.current = [];
  };

  // Permanently applies one draw event onto the layer of whichever user drew it.
  const applyDataToLayer = (data) => {
    const layerCanvas = getLayer(data.userId);
    const ctx = layerCanvas.getContext('2d');
    ctx.lineWidth = data.size;

    if (data.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = data.color;
    }

    if (data.type === 'shape') {
      ctx.beginPath();
      if (data.shape === 'rectangle') {
        ctx.strokeRect(data.startX, data.startY, data.endX - data.startX, data.endY - data.startY);
      } else if (data.shape === 'circle') {
        const radius = Math.hypot(data.startX - data.endX, data.startY - data.endY);
        ctx.arc(data.startX, data.startY, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (data.shape === 'line') {
        ctx.moveTo(data.startX, data.startY);
        ctx.lineTo(data.endX, data.endY);
        ctx.stroke();
      }
    } else {
      if (data.isStarting) {
        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
      } else {
        ctx.lineTo(data.x, data.y);
        ctx.stroke();
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    contextRef.current = ctx;
    compositeAll();

    const name = user?.displayName || user?.email || 'Guest';
    socket.emit('join_room', { roomId, user: { uid: user.uid, name } });

    socket.on('join_approved', ({ isHost: hostFlag }) => {
      setStatus('approved');
      setIsHost(!!hostFlag);
    });
    socket.on('waiting_approval', () => setStatus('waiting'));
    socket.on('join_denied', () => setStatus('denied'));
    socket.on('join_request', (req) => setJoinRequests((prev) => [...prev, req]));
    socket.on('participants_update', (list) => setParticipants(list));
    socket.on('you_are_now_host', () => setIsHost(true));

    socket.on('load_canvas', (history) => {
      resetLayers();
      history.forEach(applyDataToLayer);
      compositeAll();
    });

    socket.on('receive_draw', (data) => {
      applyDataToLayer(data);
      compositeAll();
    });


    socket.on('board_cleared', () => {
      resetLayers();
      compositeAll();
      undoStackRef.current = [];
      redoStackRef.current = [];
      setCanUndo(false);
      setCanRedo(false);
    });

    // Sent whenever anyone's undo/redo changes the room's drawing history —
    // simplest correct approach is to fully rebuild every layer from the
    // authoritative history the server sends back.
    socket.on('history_sync', (history) => {
      resetLayers();
      history.forEach(applyDataToLayer);
      compositeAll();
    });

    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      socket.emit('leave_room', { roomId });
      socket.off('join_approved');
      socket.off('waiting_approval');
      socket.off('join_denied');
      socket.off('join_request');
      socket.off('participants_update');
      socket.off('you_are_now_host');
      socket.off('load_canvas');
      socket.off('receive_draw');
      socket.off('board_cleared');
      socket.off('history_sync');
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user.uid]);

  // --- Pointer helpers (mouse + touch share the same code path) ---
  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches.length) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDrawing = (e) => {
    if (status !== 'approved') return;
    if (e.touches) e.preventDefault();
    const { x, y } = getPos(e);
    isDrawingRef.current = true;
    startCoordRef.current = { x, y };
    currentStrokeIdRef.current = `${user.uid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (tool === 'pen' || tool === 'eraser') {
      const data = { type: 'freehand', roomId, userId: user.uid, strokeId: currentStrokeIdRef.current, x, y, isStarting: true, color, size: brushSize, tool };
      applyDataToLayer(data);
      compositeAll();
      socket.emit('draw', data);
    }
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    if (e.touches) e.preventDefault();
    const { x, y } = getPos(e);

    if (tool === 'pen' || tool === 'eraser') {
      const data = { type: 'freehand', roomId, userId: user.uid, strokeId: currentStrokeIdRef.current, x, y, isStarting: false, color, size: brushSize, tool };
      applyDataToLayer(data);
      compositeAll();
      socket.emit('draw', data);
    } else {
      // Shape preview: redraw the committed layers, then paint a temporary
      // preview on top that never gets saved until mouse/touch up.
      compositeAll();
      const ctx = contextRef.current;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.beginPath();
      const s = startCoordRef.current;
      if (tool === 'rectangle') {
        ctx.strokeRect(s.x, s.y, x - s.x, y - s.y);
      } else if (tool === 'circle') {
        const radius = Math.hypot(s.x - x, s.y - y);
        ctx.arc(s.x, s.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (tool === 'line') {
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = (e) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (['rectangle', 'circle', 'line'].includes(tool)) {
      const { x, y } = getPos(e);
      const data = {
        type: 'shape', shape: tool, roomId, userId: user.uid, strokeId: currentStrokeIdRef.current,
        startX: startCoordRef.current.x, startY: startCoordRef.current.y,
        endX: x, endY: y, color, size: brushSize, tool: 'pen',
      };
      applyDataToLayer(data);
      compositeAll();
      socket.emit('draw', data);
    }

    // A stroke just finished — record it for undo, and any pending redo
    // is now stale (this is standard undo/redo behavior).
    if (currentStrokeIdRef.current) {
      undoStackRef.current.push(currentStrokeIdRef.current);
      redoStackRef.current = [];
      setCanUndo(true);
      setCanRedo(false);
      currentStrokeIdRef.current = null;
    }
  };

  const undo = () => {
    if (undoStackRef.current.length === 0) return;
    const strokeId = undoStackRef.current.pop();
    redoStackRef.current.push(strokeId);
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
    socket.emit('undo_stroke', { roomId });
  };

  const redo = () => {
    if (redoStackRef.current.length === 0) return;
    const strokeId = redoStackRef.current.pop();
    undoStackRef.current.push(strokeId);
    setCanRedo(redoStackRef.current.length > 0);
    setCanUndo(true);
    socket.emit('redo_stroke', { roomId });
  };

  const clearBoard = () => {
    if (!isHost) return; // admin-only, also enforced server-side
    resetLayers();
    compositeAll();
    socket.emit('clear_board', { roomId, userId: user.uid });
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) wrapperRef.current.requestFullscreen().catch((err) => console.error(err));
    else document.exitFullscreen();
  };

  const approveRequest = (req) => {
    socket.emit('approve_join', { roomId, socketId: req.socketId });
    setJoinRequests((prev) => prev.filter((r) => r.socketId !== req.socketId));
  };
  const denyRequest = (req) => {
    socket.emit('deny_join', { roomId, socketId: req.socketId });
    setJoinRequests((prev) => prev.filter((r) => r.socketId !== req.socketId));
  };

  return (
    <div ref={wrapperRef} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      backgroundColor: isFullscreen ? '#1e1e2f' : 'transparent',
      width: '100%', height: isFullscreen ? '100vh' : 'auto', paddingTop: isFullscreen ? '20px' : '0',
      position: 'relative',
    }}>

      {/* Waiting / denied overlays — block interaction until the host responds */}
      {(status === 'waiting' || status === 'denied') && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(20,20,30,0.75)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '32px', maxWidth: '360px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
            {status === 'waiting' ? (
              <>
                <h3 style={{ marginTop: 0 }}>Waiting for approval…</h3>
                <p style={{ color: '#777', fontSize: '14px' }}>The room admin needs to let you in before you can see or draw on the board.</p>
              </>
            ) : (
              <>
                <h3 style={{ marginTop: 0, color: '#c62828' }}>Request denied</h3>
                <p style={{ color: '#777', fontSize: '14px' }}>The host didn't approve your request to join this room.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Incoming join requests — host only */}
      {isHost && joinRequests.length > 0 && (
        <div style={{ position: 'fixed', top: '80px', right: '16px', zIndex: 90, display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '260px' }}>
          {joinRequests.map((req) => (
            <div key={req.socketId} style={{ background: 'white', padding: '14px', borderRadius: '10px', boxShadow: '0 8px 20px rgba(0,0,0,0.25)' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '14px' }}>{req.name} wants to join</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => approveRequest(req)} style={{ flex: 1, background: '#2ecc71', color: 'white', border: 'none', borderRadius: '6px', padding: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Accept</button>
                <button onClick={() => denyRequest(req)} style={{ flex: 1, background: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', padding: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Deny</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Participants */}
      {participants.length > 0 && (
        <div style={{
          display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center',
          padding: '8px 16px', marginBottom: '10px', maxWidth: '100%',
        }}>
          {participants.map((p) => (
            <span key={p.socketId} style={{
              background: p.isHost ? '#764ba2' : '#ecf0f1', color: p.isHost ? 'white' : '#333',
              padding: '4px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: 600,
            }}>
              {p.name}{p.isHost ? ' (Admin)' : ''}
            </span>
          ))}
        </div>
      )}

      {/* GUI TOOLBAR */}
      <div style={{
        display: 'flex', gap: '15px', alignItems: 'center', padding: '10px 20px',
        backgroundColor: 'rgba(25, 25, 35, 0.95)', color: 'white', borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)', marginBottom: '15px', flexWrap: 'wrap', justifyContent: 'center',
        maxWidth: '100%', boxSizing: 'border-box',
      }}>

        {/* Tool Selector */}
        <div style={{ display: 'flex', gap: '5px', backgroundColor: '#101018', padding: '5px', borderRadius: '8px' }}>
          {[
            { id: 'pen', icon: '✏️', title: 'Pen' },
            { id: 'eraser', icon: '🧽', title: 'Eraser (erases only your own strokes)' },
            { id: 'rectangle', icon: '▭', title: 'Rectangle' },
            { id: 'circle', icon: '◯', title: 'Circle' },
            { id: 'line', icon: '╱', title: 'Line' },
          ].map((t) => (
            <button
              key={t.id} onClick={() => setTool(t.id)} title={t.title}
              style={{
                padding: '8px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px',
                backgroundColor: tool === t.id ? '#3498db' : 'transparent',
                color: tool === t.id ? 'white' : '#aaa', transition: '0.2s',
              }}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div style={{ width: '1px', height: '30px', backgroundColor: '#444' }}></div>

        {/* Colors */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPalette((p) => !p)}
            title="Choose color"
            style={{
              width: '34px', height: '34px', borderRadius: '10px', cursor: 'pointer',
              backgroundColor: color, border: '2px solid rgba(255,255,255,0.5)',
              boxShadow: showPalette ? '0 0 0 3px rgba(52,152,219,0.6)' : '0 2px 6px rgba(0,0,0,0.4)',
              transition: '0.15s',
            }}
          />

          {showPalette && (
            <>
              {/* click-away backdrop */}
              <div onClick={() => setShowPalette(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />

              <div style={{
                position: 'absolute', top: '44px', left: 0, zIndex: 50,
                background: '#16161e', border: '1px solid #333', borderRadius: '12px',
                padding: '14px', boxShadow: '0 12px 30px rgba(0,0,0,0.5)', width: '188px',
              }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px',
                }}>
                  {STANDARD_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setColor(c); if (tool === 'eraser') setTool('pen'); setShowPalette(false); }}
                      title={c}
                      style={{
                        width: '32px', height: '32px', borderRadius: '8px', backgroundColor: c, cursor: 'pointer',
                        border: color === c ? '2px solid #3498db' : '1px solid rgba(255,255,255,0.15)',
                        boxShadow: color === c ? '0 0 0 2px rgba(52,152,219,0.35)' : 'none',
                        transform: color === c ? 'scale(1.08)' : 'scale(1)',
                        transition: '0.12s',
                      }}
                    />
                  ))}
                </div>

                <label style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
                  background: '#0d0d13', borderRadius: '8px', cursor: 'pointer',
                }}>
                  <input
                    type="color" value={color}
                    onChange={(e) => { setColor(e.target.value); if (tool === 'eraser') setTool('pen'); }}
                    style={{ width: '26px', height: '26px', borderRadius: '6px', border: 'none', cursor: 'pointer', padding: 0, background: 'none' }}
                  />
                  <span style={{ color: '#aaa', fontSize: '12px', fontFamily: 'monospace' }}>{color}</span>
                </label>
              </div>
            </>
          )}
        </div>

        <div style={{ width: '1px', height: '30px', backgroundColor: '#444' }}></div>

        {/* Brush Size */}
        <input type="range" min="1" max="50" value={brushSize} onChange={(e) => setBrushSize(e.target.value)} style={{ width: '80px', cursor: 'pointer' }} />

        <div style={{ width: '1px', height: '30px', backgroundColor: '#444' }}></div>

        {/* Undo / Redo — each user can only undo/redo their own strokes */}
        <div style={{ display: 'flex', gap: '5px' }}>
          <button onClick={undo} disabled={!canUndo} title="Undo your last stroke" style={{
            padding: '8px 12px', borderRadius: '6px', border: 'none', fontSize: '16px',
            cursor: canUndo ? 'pointer' : 'default', backgroundColor: '#2c2c3a',
            color: canUndo ? 'white' : '#555',
          }}>
            ↶
          </button>
          <button onClick={redo} disabled={!canRedo} title="Redo" style={{
            padding: '8px 12px', borderRadius: '6px', border: 'none', fontSize: '16px',
            cursor: canRedo ? 'pointer' : 'default', backgroundColor: '#2c2c3a',
            color: canRedo ? 'white' : '#555',
          }}>
            ↷
          </button>
        </div>

        <div style={{ width: '1px', height: '30px', backgroundColor: '#444' }}></div>

        {/* Actions */}
        {isHost && (
          <button onClick={clearBoard} title="Only the room admin can clear the whole board" style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#e74c3c', color: 'white', fontWeight: 'bold' }}>
            Clear Board
          </button>
        )}
        <button onClick={toggleFullScreen} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#7f8c8d', color: 'white' }}>
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>

      </div>

      {/* CANVAS — fixed internal resolution, scaled responsively via CSS for phones/tablets */}
      <div style={{ width: '100%', maxWidth: `${CANVAS_W}px`, padding: '0 10px', boxSizing: 'border-box' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{
            boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            borderRadius: '8px',
            cursor: tool === 'eraser' ? 'cell' : 'crosshair',
            backgroundColor: 'white',
            width: '100%',
            height: 'auto',
            display: 'block',
            touchAction: 'none',
          }}
        />
      </div>
    </div>
  );
}
