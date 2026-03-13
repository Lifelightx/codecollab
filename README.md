# LifeLightX CodeCollab

A **real-time collaborative code sharing platform** built with the **MERN stack** that allows multiple users to join a room and collaborate on code instantly.

Users can create **public or password-protected private rooms**, work with **multiple files**, and share code live with others.

Live Demo: https://jeeban.life

---

## Features

- Real-time collaborative code editing
- Multiple files support inside a room
- Public and private rooms
- Password protected private rooms
- File explorer with file management
- Live preview support
- Terminal interface
- Tabs for multiple open files
- Rooms automatically expire after **30 days**
- Real-time synchronization using **WebSockets**
- Responsive UI

---

## Tech Stack

### Frontend
- React
- Vite
- Socket.IO Client
- Context API
- Code Editor (Monaco / similar editor integration)

### Backend
- Node.js
- Express.js
- Socket.IO
- MongoDB
- Mongoose

### Deployment
- Docker
- AWS EC2

---


---

## How It Works

1. A user creates a **Code Space (Room)**.
2. The room can be:
   - Public
   - Private (password protected)
3. Users join the room using a **room ID**.
4. All participants can:
   - Create files
   - Edit code
   - View changes in real time
5. Changes are synchronized through **Socket.IO**.
6. Rooms remain active for **30 days** before automatic cleanup.

---
