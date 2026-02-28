import os
import io
import time
import random
import requests
import cv2
import threading
import numpy as np
from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.responses import JSONResponse
from ultralytics import YOLO

app = FastAPI(title="Neon Guardian - Matrix AI Service")

BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://backend:5000/api")

print("Loading YOLOv8 model for real-time tracking...")
model = YOLO('yolov8n.pt') 
print("Model loaded successfully.")

# Thread tracking dictionary
camera_threads = {}

def generate_mock_plate():
    letters = "".join(random.choices("ABCDEFGHIJKLMNOPQRSTUVWXYZ", k=3))
    numbers = "".join(random.choices("0123456789", k=3))
    return f"{letters}-{numbers}"

def stream_reader(cam_id, rtsp_url, lat, lng):
    """
    Connects to the RTSP stream or local video file.
    Runs YOLOv8 detection and posts to the backend upon violation detection.
    """
    print(f"[AI] Initializing capture for {cam_id} via {rtsp_url}")
    cap = cv2.VideoCapture(rtsp_url)
    
    # Track heartbeats
    last_heartbeat = 0
    
    while cap.isOpened():
        ret, frame = cap.read()
        
        if not ret:
            print(f"[AI] Stream interrupted for {cam_id}.")
            break
            
        current_time = time.time()
        
        # Send heartbeat every 10 seconds
        if current_time - last_heartbeat > 10:
            try:
                requests.post(f"{BACKEND_API_URL}/cameras/{cam_id}/heartbeat", timeout=5)
                last_heartbeat = current_time
            except Exception as e:
                print(f"[AI] Failed to send heartbeat for {cam_id}: {e}")
        
        # Run YOLO inference
        # In a real heavy system we'd skip frames here
        results = model(frame, verbose=False)
        
        detected_vehicles = [box for box in results[0].boxes if int(box.cls) in [2, 3, 5, 7]]
        
        # Heuristic rules: if random sample triggers logic and a car is present
        if len(detected_vehicles) > 0 and random.random() < 0.01: # 1% chance per frame for demo
            best_vehicle = max(detected_vehicles, key=lambda b: float(b.conf))
            confidence = float(best_vehicle.conf) * 100
            
            violation_types = ["SPEEDING", "RED LIGHT", "WRONG WAY", "NO HELMET", "LANE VIOLATION"]
            v_type = random.choice(violation_types)
            
            payload = {
                "type": v_type,
                "plateNumber": generate_mock_plate(),
                "vehicleType": "CAR" if int(best_vehicle.cls) == 2 else "MOTORCYCLE",
                "confidenceScore": str(round(confidence, 1)),
                "threatScore": str(round(random.uniform(20.0, 95.0), 1)),
                "cameraId": cam_id,
                "locationLat": str(lat),
                "locationLng": str(lng)
            }
            
            # Save the frame as jpeg
            success, buffer = cv2.imencode('.jpg', frame)
            if success:
                files = {
                    "evidenceImage": (f"ev_{cam_id}_{int(time.time())}.jpg", buffer.tobytes(), "image/jpeg")
                }
                
                try:
                    res = requests.post(f"{BACKEND_API_URL}/violations", data=payload, files=files, timeout=10)
                    print(f"[{cam_id}] Sent Violation: {v_type} | {res.status_code}")
                except Exception as e:
                    print(f"[{cam_id}] Post violation error: {e}")

    cap.release()
    print(f"[AI] Capture terminated for {cam_id}")

def discover_and_attach_cameras():
    """
    Periodically checks the Backend for newly registered cameras
    and spawns reader threads.
    """
    INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "internal-secret-123")
    headers = {"x-api-key": INTERNAL_API_KEY}

    while True:
        try:
            print("[AI] Querying for active cameras...")
            res = requests.get(f"{BACKEND_API_URL}/cameras", headers=headers, timeout=5)
            if res.status_code == 200:
                cameras = res.json()
                for cam in cameras:
                    cam_id = cam.get('id')
                    rtsp_url = cam.get('rtspUrl')
                    status = cam.get('status')
                    
                    if not rtsp_url:
                        continue
                        
                    if status == 'ONLINE' and cam_id not in camera_threads:
                        print(f"[AI] Discovered new active stream: {cam['name']}")
                        t = threading.Thread(
                            target=stream_reader, 
                            args=(cam_id, rtsp_url, cam.get('locationLat'), cam.get('locationLng')),
                            daemon=True
                        )
                        camera_threads[cam_id] = t
                        t.start()
                    elif status == 'OFFLINE' and cam_id in camera_threads:
                        # Cannot kill python threads elegantly automatically, but we can signal them if we want to expand.
                        # For now, if the stream reader loop fails, it ends inherently.
                        pass
            else:
                print(f"[AI] Failed to fetch cameras: {res.status_code}")
        except Exception as e:
            print(f"[AI] Camera discovery exception: {e}")
        time.sleep(30)

@app.on_event("startup")
async def startup_event():
    # Spawning the discovery mechanism
    thread = threading.Thread(target=discover_and_attach_cameras, daemon=True)
    thread.start()

@app.get("/health")
def health_check():
    return {
        "status": "AI Operations Normal", 
        "active_streams": len(camera_threads)
    }
