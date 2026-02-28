# Smart Traffic Violation Detection System (Neon Guardian)

Neon Guardian is an advanced AI-powered traffic monitoring and violation detection platform. It uses cutting-edge computer vision (YOLOv8) and real-time data processing to identify traffic infractions, manage camera networks, and provide actionable analytics.

## Core Features

- **Real-Time Monitoring**: Live RTSP stream ingestion with overlayed AI detections.
- **Automated Violation Detection**: Identifies Red Light, Wrong Way, No Helmet, Triple Riding, and License Plate data.
- **Enterprise Video Scanner**: Upload MP4/AVI/MOV files for delayed batch processing with interactive timeline review.
- **AI Training Pipeline**: Integrated workspace to train, validate, and export custom YOLOv8 models for traffic specific classes.
- **System Updates Tracker**: Comprehensive patch notes and version management with real-time WebSocket notifications.
- **Geospatial Analytics**: Interactive mapping of violations and camera nodes.

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Lucide React, Socket.IO Client.
- **Backend**: Node.js, Express, Prisma (PostgreSQL), Redis (Queue/Pub-Sub), Multer.
- **AI Service**: Python, FastAPI, OpenCV, Ultralytics (YOLOv8), Redis.
- **Database**: PostgreSQL (Prisma ORM).
- **Deployment**: Docker & Docker Compose.

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js (v18+) - optional for local dev
- Python (3.10+) - optional for local AI dev

### Setup and Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/[your-repo]/Smart-Traffic-Violation-Detection-System.git
   cd Smart-Traffic-Violation-Detection-System
   ```

2. **Run with Docker (Recommended)**
   ```bash
   docker-compose up --build
   ```

3. **Default Credentials**
   - **URL**: `http://localhost:3000`
   - **Admin Email**: `admin@neonguardian.com`
   - **Admin Password**: `admin123`

## AI Training Pipeline

To train the model on your own data:
1. Place raw images and labels in `ai-training/datasets/raw/`.
2. Run the preparation script: `python ai-training/scripts/prepare_dataset.py`.
3. Start training: `python ai-training/scripts/train_model.py`.
4. Validate and Export: `python ai-training/scripts/validate_model.py` and `python ai-training/scripts/export_model.py`.

## License

Enterprise Licensed for Smart Traffic Management.
