# 🎨 LiveBoard Pro: Real-Time Collaborative Workspace

LiveBoard Pro is a full-stack, real-time collaborative whiteboard application built for seamless remote teamwork. It features dynamic room routing, state hydration for late joiners, and a low-latency drawing engine utilizing the HTML5 Canvas API and WebSockets.

## ✨ Key Features
*   **Real-Time Synchronization:** Sub-millisecond latency for drawing events broadcast across multiple clients using Socket.io.
*   **State Hydration:** The Node.js server retains session state in memory, allowing late joiners to instantly download the complete canvas history upon connection.
*   **Algorithmic Shape Generation:** Implements continuous coordinate snapshotting and re-rendering to preview shape primitives (rectangles, circles, lines) before committing final vectors to the server.
*   **Secure Authentication:** Firebase SDK integration for token-based user authentication and React Router route-guarding.
*   **Dynamic Room Allocation:** Algorithmic generation of unique session IDs mapped to isolated WebSocket channels.
*   **Modern UI/UX:** Features a glassmorphism toolbar, fullscreen API integration, and dynamic canvas resizing.

## 🛠️ Tech Stack
*   **Frontend:** React.js, Vite, React Router
*   **Backend:** Node.js, Express.js
*   **Real-Time Engine:** Socket.io (WebSockets)
*   **Authentication:** Firebase Auth
*   **Rendering:** HTML5 Canvas (2D Context API)

## 🚀 Installation & Setup

Because this is a full-stack application, the client and server must be run concurrently in separate terminal environments.

### 1. Clone the Repository
```bash
git clone [https://github.com/ayushchakole100-blip/live-whiteboard.git](https://github.com/ayushchakole100-blip/live-whiteboard.git)
cd live-whiteboard