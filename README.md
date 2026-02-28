# Neon Guardian - Smart Traffic Violation Detection System

![Neon Guardian System](https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=2644&auto=format&fit=crop)

Neon Guardian is an Enterprise-Grade, Edge-AI traffic surveillance network powered by a localized AI engine (YOLOv8 + OpenCV), a robust PostgreSQL backend, and a real-time reactive dark-mode intelligence dashboard. 

It handles automated ingestion of RTSP streams, active heuristic logic for vehicular threat detection, and localized encrypted WebSocket alerts. 

## Key Features
- 🔌 **Dynamic Multi-Stream Ingestion**: Seamlessly processes MP4, RTSP, CCTV, or WebCam pipelines natively in pure Python.
- ⚡ **Real-Time Edge AI Detection**: Native, GPU-ready integration using Ultralytics YOLOv8 for sub-millisecond object detection (Speeding, Red Lights, Wrong Way).
- 🌐 **Geospatial Matrix Mapping**: Translates raw database coordinates into live, active Leaflet map nodes that flash upon violations.
- 🛡️ **Level-4 Clearance & RBAC**: Strict JWT protected endpoints and distinct operational clearances.
- 📡 **Enterprise System Updater**: Fully fledged backend schema supporting Version tracking, automated Patch Notes mapping, and live Client alerts. 
- 🔗 **Redis Pub/Sub Hooks**: Completely non-blocking socket relays. The dashboard remains 100% database-driven but inherently real-time.

## Architecture Stack
- **Dashboard**: React 18, TypeScript, TailwindCSS v3 (Neon Cyber Intelligence Theme), React-Leaflet, Socket.io
- **Core API Engine**: Node.js, Express, TypeScript, Prisma ORM
- **Database Core**: PostgreSQL
- **Real-Time Mesh**: Redis
- **Deep Intel Microservice**: Python, FastAPI, OpenCV, Ultralytics YOLOv8
- **Containerization**: Full Stack Docker Compose 

## Installation & Deployment

### 1. Requirements
Ensure you have the following installed on your target machine:
- [Docker](https://www.docker.com/) & Docker Compose
- Node.js (v18+) - For local manual execution

### 2. Environment Setup
Clone the repository and spin up the production cluster:
```bash
git clone https://github.com/your-username/Smart-Traffic-Violation-Detection-System.git
cd Smart-Traffic-Violation-Detection-System
```

Ensure ports `3000` (Frontend), `5000` (Backend), `5432` (PostgresDB), and `6379` (Redis) are unbound locally.

### 3. Initialize the Core Matrix
```bash
# Starts all services 
docker-compose up --build -d
```

### 4. Database Schema Migration and Generation
Run the bundled Prisma schemas to set up the relational structure and the `SystemMetadata` seed required for the app to function securely without dummy data.
```bash
# Push schema schemas
docker-compose exec backend npx prisma generate
docker-compose exec backend npx prisma db push --accept-data-loss

# Deploy Initial Enterprise Root Seed (Creates test admin users & Demo camera networks)
docker-compose exec backend npm run prisma:seed
```

### 5. Access 
- **Main Terminal (Dashboard)**: `http://localhost:3000`
- **Default Authentication**: 
  - Login: `admin@neonguardian.com`
  - Passcode: `admin123`

---

## Technical Appendices

### AI Model Replacement
To swap out the placeholder `yolov8n.pt` with a refined proprietary tracking heuristic, simply overwrite the `.pt` binary inside `ai-service/` and edit the invocation within `main.py`.

### Camera Sub-Routing
To add a physical CCTV, utilize the `/api/cameras/register` endpoint equipped with the RTSP IP and coordinate matrix. The Python sub-service will automatically resolve this upon its 30-second sweep cycle.
