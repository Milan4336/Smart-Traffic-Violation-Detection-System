import os
import io
import time
import random
import requests
import cv2
import threading
import numpy as np
import redis
import json
from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.responses import JSONResponse
from ultralytics import YOLO

app = FastAPI(title="Neon Guardian - Matrix AI Service")

BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://backend:5000/api")
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "internal-secret-123")

print("Loading YOLOv8 model...")
# Check if custom model exists, otherwise fallback to pretrained
CUSTOM_MODEL_PATH = "/home/milan/Neon_Guardian/ai-training/models/trained/traffic_model_v1.pt"
if os.path.exists(CUSTOM_MODEL_PATH):
    print(f"Loading custom trained model from {CUSTOM_MODEL_PATH}")
    model = YOLO(CUSTOM_MODEL_PATH)
    USING_CUSTOM_MODEL = True
else:
    print("Custom model not found. Falling back to yolov8n.pt")
    model = YOLO('yolov8n.pt') 
    USING_CUSTOM_MODEL = False
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
    Includes technical stability tracking (FPS, Latency, Freeze Detection).
    """
    print(f"[AI] Initializing capture for {cam_id} via {rtsp_url}")
    
    retry_count = 0
    max_retries = 5
    
    while retry_count < max_retries:
        cap = cv2.VideoCapture(rtsp_url)
        
        # Stability metrics
        last_heartbeat = 0
        frame_times = []
        last_frame = None
        freeze_start_time = 0
        failure_count = 0
        session_start_time = time.time()
        
        while cap.isOpened():
            start_capture = time.time()
            ret, frame = cap.read()
            
            if not ret:
                print(f"[AI] Stream interrupted for {cam_id}. Retrying...")
                break
            
            # Reset retry on success
            retry_count = 0
            
            current_time = time.time()
            
            # FPS Tracking
            frame_times.append(current_time)
            if len(frame_times) > 30: frame_times.pop(0)
            fps = len(frame_times) / (frame_times[-1] - frame_times[0]) if len(frame_times) > 1 else 0
            
            # Freeze Detection
            is_frozen = False
            if last_frame is not None:
                # Compare a small centered region for performance
                h, w = frame.shape[:2]
                region = frame[h//4:3*h//4, w//4:3*w//4]
                last_region = last_frame[h//4:3*h//4, w//4:3*w//4]
                if np.array_equal(region, last_region):
                    if freeze_start_time == 0: freeze_start_time = current_time
                    if current_time - freeze_start_time > 5:
                        is_frozen = True
                else:
                    freeze_start_time = 0
            
            last_frame = frame.copy()
            
            # Latency Tracking (Start of capture to end of inference)
            inference_start = time.time()
            results = model(frame, verbose=False)
            inference_end = time.time()
            latency_ms = int((inference_end - start_capture) * 1000)
            
            # Failures
            if is_frozen:
                failure_count += 1
                if failure_count % 30 == 0: # Log every ~1s if frozen
                    print(f"[AI] Stream FREEZE detected for {cam_id}")

            # Send heartbeat every 10 seconds
            if current_time - last_heartbeat > 10:
                try:
                    payload = {
                        "fps": round(fps, 1),
                        "latency_ms": latency_ms,
                        "failure_count": failure_count
                    }
                    requests.post(f"{BACKEND_API_URL}/cameras/{cam_id}/heartbeat", json=payload, timeout=5)
                    last_heartbeat = current_time
                except Exception as e:
                    print(f"[AI] Failed to send heartbeat for {cam_id}: {e}")
            
            # ... (Rest of the violation detection logic remains the same)
            if USING_CUSTOM_MODEL:
                detected_objs = [box for box in results[0].boxes if int(box.cls) in [0, 1, 2, 3, 4, 5]]
            else:
                detected_objs = [box for box in results[0].boxes if int(box.cls) in [0, 2, 3, 9]]
            
            if len(detected_objs) > 0 and random.random() < 0.01:
                best_obj = max(detected_objs, key=lambda b: float(b.conf))
                confidence = float(best_obj.conf) * 100
                v_type = random.choice(["SPEEDING", "RED LIGHT", "WRONG WAY", "NO HELMET", "LANE VIOLATION"])
                v_tag = "VEHICLE"
                cls_id = int(best_obj.cls)
                if USING_CUSTOM_MODEL:
                    if cls_id == 0: v_tag = "CAR"
                    elif cls_id == 1: v_tag = "MOTORCYCLE"
                    elif cls_id == 5: v_tag = "PERSON"
                else:
                    if cls_id == 2: v_tag = "CAR"
                    elif cls_id == 3: v_tag = "MOTORCYCLE"
                    elif cls_id == 0: v_tag = "PERSON"

                violation_payload = {
                    "type": v_type,
                    "plateNumber": generate_mock_plate(),
                    "vehicleType": v_tag,
                    "confidenceScore": str(round(confidence, 1)),
                    "threatScore": str(round(random.uniform(20.0, 95.0), 1)),
                    "cameraId": cam_id,
                    "locationLat": str(lat),
                    "locationLng": str(lng),
                    "videoTimestampSeconds": str(round(current_time - session_start_time, 2)),
                    "boundingBox": json.dumps(best_obj.xyxy[0].tolist())
                }
                
                success, buffer = cv2.imencode('.jpg', frame)
                if success:
                    files = {"evidenceImage": (f"ev_{cam_id}_{int(time.time())}.jpg", buffer.tobytes(), "image/jpeg")}
                    try:
                        requests.post(f"{BACKEND_API_URL}/violations", data=violation_payload, files=files, timeout=10)
                    except Exception as e:
                        print(f"[{cam_id}] Post violation error: {e}")

        cap.release()
        retry_count += 1
        if retry_count < max_retries:
            print(f"[AI] Attempting reconnect {retry_count}/{max_retries} for {cam_id} in 5s...")
            time.sleep(5)
        else:
            print(f"[AI] Max retries reached for {cam_id}. Marking as OFFLINE.")

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
    
    # Spawning the video processing worker
    video_thread = threading.Thread(target=video_worker, daemon=True)
    video_thread.start()

def video_worker():
    """
    Background worker that pulls videos from Redis queue and processes them.
    """
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    print("[AI Worker] Video processor started, waiting for jobs...")
    
    while True:
        try:
            # BLPOP blocks until a job is available
            res = r.blpop("video:queue", timeout=30)
            if not res:
                continue
                
            _, job_data_str = res
            job = json.loads(job_data_str)
            video_id = job.get("videoId")
            file_path = job.get("filePath")
            
            print(f"[AI Worker] Processing video {video_id} at {file_path}")
            
            # Update status to processing
            try:
                requests.patch(
                    f"{BACKEND_API_URL}/videos/{video_id}/status",
                    json={"status": "processing"},
                    headers={"x-api-key": INTERNAL_API_KEY},
                    timeout=5
                )
            except Exception as e:
                print(f"[AI Worker] Failed to update status to processing: {e}")
            
            process_video(video_id, file_path)
            
        except Exception as e:
            print(f"[AI Worker] Error in worker loop: {e}")
            time.sleep(5)

def process_video(video_id, video_path):
    # Ensure evidence directory exists
    evidence_dir = "/app/uploads/evidence"
    if not os.path.exists(evidence_dir):
        os.makedirs(evidence_dir, exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[AI Worker] Failed to open video {video_path}")
        try:
            requests.patch(
                f"{BACKEND_API_URL}/videos/{video_id}/status",
                json={"status": "failed"},
                headers={"x-api-key": INTERNAL_API_KEY},
                timeout=5
            )
        except: pass
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0
    
    frame_count = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        timestamp = frame_count / fps if fps > 0 else 0
        
        # Periodic progress logs
        if total_frames > 0 and frame_count % max(1, (total_frames // 10)) == 0:
            progress = round((frame_count / total_frames) * 100)
            print(f"[AI Worker] Video {video_id} progress: {progress}%")
        
        # Run YOLO inference every 5th frame for performance
        if frame_count % 5 == 0:
            results = model(frame, verbose=False)
            if USING_CUSTOM_MODEL:
                detected_objs = [box for box in results[0].boxes if int(box.cls) in [0, 1, 2, 3, 4, 5]]
            else:
                detected_objs = [box for box in results[0].boxes if int(box.cls) in [0, 2, 3, 9]]
            
            # 5% chance per analyzed frame for a violation in this demo
            if len(detected_objs) > 0 and random.random() < 0.05:
                best_obj = max(detected_objs, key=lambda b: float(b.conf))
                confidence = float(best_obj.conf) * 100
                
                v_type = random.choice(["SPEEDING", "RED LIGHT", "WRONG WAY", "NO HELMET", "LANE VIOLATION", "TRIPLE RIDING"])
                
                # Save frame
                success, buffer = cv2.imencode('.jpg', frame)
                if success:
                    evidence_filename = f"vid_ev_{video_id}_{frame_count}.jpg"
                    evidence_path = os.path.join(evidence_dir, evidence_filename)
                    with open(evidence_path, "wb") as f:
                        f.write(buffer.tobytes())
                    
                    payload = {
                        "violationType": v_type,
                        "confidenceScore": confidence,
                        "frameTimestamp": timestamp,
                        "videoTimestampSeconds": timestamp,
                        "plateNumber": generate_mock_plate(),
                        "boundingBox": best_obj.xyxy[0].tolist(),
                        "evidenceImagePath": f"/uploads/evidence/{evidence_filename}"
                    }
                    
                    try:
                        requests.post(
                            f"{BACKEND_API_URL}/videos/{video_id}/violations",
                            json=payload,
                            headers={"x-api-key": INTERNAL_API_KEY},
                            timeout=5
                        )
                    except Exception as e:
                        print(f"[AI Worker] Failed to post video violation: {e}")

        frame_count += 1
        
    cap.release()
    
    # Finalize status
    try:
        requests.patch(
            f"{BACKEND_API_URL}/videos/{video_id}/status",
            json={"status": "completed", "durationSeconds": duration},
            headers={"x-api-key": INTERNAL_API_KEY},
            timeout=5
        )
    except Exception as e:
        print(f"[AI Worker] Failed to finalize status: {e}")
        
    print(f"[AI Worker] Finished processing video {video_id}")

@app.get("/health")
def health_check():
    return {
        "status": "AI Operations Normal", 
        "active_streams": len(camera_threads)
    }
