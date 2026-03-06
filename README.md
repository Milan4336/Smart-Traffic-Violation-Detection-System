# Neon Guardian - Smart Traffic Violation Detection System

Neon Guardian is an AI-powered traffic enforcement and monitoring platform that ingests live camera feeds and uploaded videos, detects violations, persists evidence, triggers alerts, and updates a real-time command-center dashboard.

## Platform Workflow

`camera/video -> AI detection -> backend ingestion -> database persistence -> websocket events -> live dashboard updates`

## Major Capabilities

- Real-time RTSP/live stream processing with AI overlays.
- Batch video upload scanning with async queue processing.
- Violation detection, duplicate suppression, OCR plate extraction, and evidence capture.
- Repeat offender profiling + risk level escalation.
- Automatic fine calculation with repeat-offense multipliers.
- Blacklist/watchlist enforcement + critical alerting.
- Violation review workflow (`UNDER_REVIEW`, `APPROVED`, `REJECTED`).
- Role-based access control (`ADMIN`, `OFFICER`, `ANALYST`, `VIEWER`).
- PDF evidence report generation and report history tracking.
- Real-time metrics engine and socket-based event broadcasting.
- Camera heartbeat, latency/FPS health monitoring, and offline detection.

## Frontend Command Center (Current)

- Command-center dashboard with live metrics and activity.
- New **System Updates page** at `/system-updates`:
  - Current version banner.
  - Version history timeline.
  - Expandable categorized patch notes (`FEATURE`, `IMPROVEMENT`, `FIX`, `SECURITY`, `PERFORMANCE`).
- New **System Status page** at `/system-status`:
  - Service health cards (System, AI, Cameras, DB, Redis, API, Storage).
  - AI runtime panel, queue telemetry, DB telemetry.
  - Camera network monitoring table.
  - Incident timeline + auto-refresh telemetry.
- Global header health indicators for System/AI/Cameras/Database.

## Tech Stack

- Frontend: React, TypeScript, Tailwind CSS, Socket.IO Client, Recharts, Lucide.
- Backend: Node.js, Express, Prisma ORM, PostgreSQL, Redis, Socket.IO.
- AI Service: Python, FastAPI, OpenCV, Ultralytics YOLOv8, EasyOCR.
- Infra: Docker, Docker Compose.

## Quick Start

### Prerequisites

- Docker + Docker Compose

### Run

```bash
docker compose up --build
```

### Access

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000/api`
- AI Service: `http://localhost:8000`

### Default Admin Login

- Email: `admin@neonguardian.com`
- Password: `admin123`

## Patch Notes Data Seeding

To (re)seed system update history:

```bash
cd backend
npx ts-node prisma/seedUpdates.ts
```

To publish updates incrementally into an existing DB:

```bash
cd backend
npx ts-node scripts/publish_v1_6.ts
```

The publisher now includes the latest update stream through **v1.7.0**.

## License

Enterprise licensed for smart traffic management.
