import React, { useRef, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('https://live-whiteboard-81ro.onrender.com');
const STANDARD_COLORS = ['#000000', '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'];

export default function Whiteboard({ roomId }) {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const snapshotRef = useRef(null); // Memory buffer for shape previews
  const startCoord = useRef({ x: 0, y: 0 }); // Starting click coordinates

  const [context, setContext] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Advanced Tool State
  const [tool, setTool] = useState('pen'); // 'pen', 'eraser', 'rectangle', 'circle', 'line'
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth - 60; 
    canvas.height = window.innerHeight - 150; 
    
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    setContext(ctx);
    socket.emit('join_room', roomId);

    // HELPER: Reusable drawing function for local state, late-joiners, and network events
    const renderDataToCanvas = (data, ctxToDraw) => {
      ctxToDraw.strokeStyle = data.color;
      ctxToDraw.lineWidth = data.size;

      if (data.type === 'shape') {
        ctxToDraw.beginPath();
        if (data.shape === 'rectangle') {
          ctxToDraw.strokeRect(data.startX, data.startY, data.endX - data.startX, data.endY - data.startY);
        } else if (data.shape === 'circle') {
          const radius = Math.sqrt(Math.pow(data.startX - data.endX, 2) + Math.pow(data.startY - data.endY, 2));
          ctxToDraw.arc(data.startX, data.startY, radius, 0, 2 * Math.PI);
          ctxToDraw.stroke();
        } else if (data.shape === 'line') {
          ctxToDraw.moveTo(data.startX, data.startY);
          ctxToDraw.lineTo(data.endX, data.endY);
          ctxToDraw.stroke();
        }
      } else {
        // Freehand logic
        if (data.isStarting) {
          ctxToDraw.beginPath();
          ctxToDraw.moveTo(data.x, data.y);
        } else {
          ctxToDraw.lineTo(data.x, data.y);
          ctxToDraw.stroke();
        }
      }
    };

    socket.on('load_canvas', (historyArray) => {
      historyArray.forEach(point => renderDataToCanvas(point, ctx));
    });

    socket.on('receive_draw', (data) => renderDataToCanvas(data, ctx));
    
    socket.on('board_cleared', () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      socket.off('load_canvas');
      socket.off('receive_draw');
      socket.off('board_cleared');
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [roomId]);

  // --- MOUSE EVENTS ---
  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    setIsDrawing(true);
    startCoord.current = { x: offsetX, y: offsetY };

    // Save canvas snapshot for shape previewing
    snapshotRef.current = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);

    const activeColor = tool === 'eraser' ? '#ffffff' : color;

    if (tool === 'pen' || tool === 'eraser') {
      context.beginPath();
      context.moveTo(offsetX, offsetY);
      socket.emit('draw', { type: 'freehand', roomId, x: offsetX, y: offsetY, isStarting: true, color: activeColor, size: brushSize });
    }
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;
    const activeColor = tool === 'eraser' ? '#ffffff' : color;

    context.strokeStyle = activeColor;
    context.lineWidth = brushSize;

    if (tool === 'pen' || tool === 'eraser') {
      context.lineTo(offsetX, offsetY);
      context.stroke();
      socket.emit('draw', { type: 'freehand', roomId, x: offsetX, y: offsetY, isStarting: false, color: activeColor, size: brushSize });
    } else {
      // Shape Preview Logic: Restore snapshot, then draw temporary shape
      context.putImageData(snapshotRef.current, 0, 0);
      context.beginPath();
      
      if (tool === 'rectangle') {
        context.strokeRect(startCoord.current.x, startCoord.current.y, offsetX - startCoord.current.x, offsetY - startCoord.current.y);
      } else if (tool === 'circle') {
        const radius = Math.sqrt(Math.pow(startCoord.current.x - offsetX, 2) + Math.pow(startCoord.current.y - offsetY, 2));
        context.arc(startCoord.current.x, startCoord.current.y, radius, 0, 2 * Math.PI);
        context.stroke();
      } else if (tool === 'line') {
        context.moveTo(startCoord.current.x, startCoord.current.y);
        context.lineTo(offsetX, offsetY);
        context.stroke();
      }
    }
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    
    // If it's a shape, we finalize it on mouse UP and send the final coordinates to the server
    if (['rectangle', 'circle', 'line'].includes(tool) && e.nativeEvent) {
      socket.emit('draw', {
        type: 'shape',
        shape: tool,
        roomId,
        startX: startCoord.current.x,
        startY: startCoord.current.y,
        endX: e.nativeEvent.offsetX,
        endY: e.nativeEvent.offsetY,
        color,
        size: brushSize
      });
    }

    if (context) context.closePath();
    setIsDrawing(false);
  };

  const clearBoard = () => {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    socket.emit('clear_board', roomId);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) wrapperRef.current.requestFullscreen().catch(err => console.error(err));
    else document.exitFullscreen();
  };

  return (
    <div ref={wrapperRef} style={{ 
      display: 'flex', flexDirection: 'column', alignItems: 'center', 
      backgroundColor: isFullscreen ? '#1e1e2f' : 'transparent',
      width: '100%', height: isFullscreen ? '100vh' : 'auto', paddingTop: isFullscreen ? '20px' : '0'
    }}>
      
      {/* GUI TOOLBAR */}
      <div style={{ 
        display: 'flex', gap: '15px', alignItems: 'center', padding: '10px 20px', 
        backgroundColor: 'rgba(25, 25, 35, 0.95)', color: 'white', borderRadius: '12px', 
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)', marginBottom: '15px', flexWrap: 'wrap', justifyContent: 'center'
      }}>
        
        {/* Tool Selector */}
        <div style={{ display: 'flex', gap: '5px', backgroundColor: '#101018', padding: '5px', borderRadius: '8px' }}>
          {[
            { id: 'pen', icon: '✏️', title: 'Pen' },
            { id: 'eraser', icon: '🧽', title: 'Eraser' },
            { id: 'rectangle', icon: '▭', title: 'Rectangle' },
            { id: 'circle', icon: '◯', title: 'Circle' },
            { id: 'line', icon: '╱', title: 'Line' }
          ].map(t => (
            <button 
              key={t.id} onClick={() => setTool(t.id)} title={t.title}
              style={{ 
                padding: '8px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px',
                backgroundColor: tool === t.id ? '#3498db' : 'transparent', 
                color: tool === t.id ? 'white' : '#aaa', transition: '0.2s'
              }}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div style={{ width: '1px', height: '30px', backgroundColor: '#444' }}></div>

        {/* Colors */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {STANDARD_COLORS.map(c => (
            <div 
              key={c} onClick={() => { setColor(c); if (tool === 'eraser') setTool('pen'); }}
              style={{
                width: '22px', height: '22px', borderRadius: '50%', backgroundColor: c, cursor: 'pointer',
                border: color === c && tool !== 'eraser' ? '2px solid white' : '2px solid transparent'
              }}
            />
          ))}
          <input 
            type="color" value={color} onChange={(e) => { setColor(e.target.value); if (tool === 'eraser') setTool('pen'); }} 
            style={{ cursor: 'pointer', border: 'none', width: '26px', height: '26px', borderRadius: '50%', padding: 0 }}
          />
        </div>

        <div style={{ width: '1px', height: '30px', backgroundColor: '#444' }}></div>

        {/* Brush Size */}
        <input type="range" min="1" max="50" value={brushSize} onChange={(e) => setBrushSize(e.target.value)} style={{ width: '80px', cursor: 'pointer' }} />

        <div style={{ width: '1px', height: '30px', backgroundColor: '#444' }}></div>

        {/* Actions */}
        <button onClick={clearBoard} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#e74c3c', color: 'white', fontWeight: 'bold' }}>
          Clear
        </button>
        <button onClick={toggleFullScreen} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#7f8c8d', color: 'white' }}>
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>

      </div>

      {/* CANVAS */}
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        style={{ 
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)', 
          borderRadius: '8px', 
          cursor: tool === 'eraser' ? 'cell' : 'crosshair',
          backgroundColor: 'white'
        }}
      />
    </div>
  );
}