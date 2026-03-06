import json
import logging
import os
import re
import subprocess
import threading
import time
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
import redis
import requests
from fastapi import FastAPI, HTTPException, Request
from ultralytics import YOLO

try:
    import easyocr  # type: ignore
except Exception:  # pragma: no cover - runtime optional dependency safety
    easyocr = None


app = FastAPI(title="Neon Guardian - AI Detection Service")

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("neon_guardian_ai")


BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://backend:5000/api")
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "internal-secret-123")

MODEL_PATH = os.getenv("MODEL_PATH", "/app/models/trained/traffic_model_v1.pt")
MODEL_FALLBACK = os.getenv("MODEL_FALLBACK", "yolov8n.pt")

DETECTION_CONFIDENCE = float(os.getenv("DETECTION_CONFIDENCE", "0.45"))
STREAM_FRAME_SKIP = int(os.getenv("STREAM_FRAME_SKIP", "3"))
VIDEO_FRAME_SKIP = int(os.getenv("VIDEO_FRAME_SKIP", "5"))
VIOLATION_COOLDOWN_SECONDS = int(os.getenv("VIOLATION_COOLDOWN_SECONDS", "12"))
NO_PLATE_COOLDOWN_SECONDS = int(os.getenv("NO_PLATE_COOLDOWN_SECONDS", "8"))

UPLOADS_DIR = Path("/app/uploads")
EVIDENCE_DIR = UPLOADS_DIR / "evidence"
SNAPSHOT_DIR = UPLOADS_DIR / "snapshots"
LIVE_DIR = UPLOADS_DIR / "live"

REQUEST_HEADERS = {"x-api-key": INTERNAL_API_KEY}


camera_threads: Dict[str, threading.Thread] = {}
camera_stop_events: Dict[str, threading.Event] = {}
streaming_processes: Dict[str, subprocess.Popen] = {}
streaming_active: Dict[str, bool] = defaultdict(bool)
latest_frames: Dict[str, np.ndarray] = {}
latest_detections: Dict[str, List[Tuple[int, int, int, int, str, float]]] = defaultdict(list)

frame_lock = threading.Lock()
dedup_lock = threading.Lock()
last_violation_sent: Dict[Tuple[str, str, str], float] = {}
last_no_plate_violation_sent: Dict[Tuple[str, str], float] = {}


VIOLATION_CLASS_MAP = {
    "red_light": "RED_LIGHT",
    "redlight": "RED_LIGHT",
    "wrong_way": "WRONG_WAY",
    "wrongway": "WRONG_WAY",
    "no_helmet": "NO_HELMET",
    "without_helmet": "NO_HELMET",
    "triple_riding": "TRIPLE_RIDING",
    "triple": "TRIPLE_RIDING",
    "overspeed": "OVERSPEED",
    "speeding": "OVERSPEED",
}

TRACKABLE_LABEL_HINTS = [
    "car",
    "bus",
    "truck",
    "motor",
    "bike",
    "scooter",
    "vehicle",
    "helmet",
    "speed",
    "red_light",
    "wrong_way",
    "triple",
]


def ensure_upload_dirs() -> None:
    for directory in (EVIDENCE_DIR, SNAPSHOT_DIR, LIVE_DIR):
        directory.mkdir(parents=True, exist_ok=True)


def load_model() -> Tuple[YOLO, bool]:
    model_path = MODEL_PATH if os.path.exists(MODEL_PATH) else MODEL_FALLBACK
    using_custom_model = model_path == MODEL_PATH
    logger.info("Loading YOLO model from %s", model_path)
    loaded = YOLO(model_path)
    logger.info("Model loaded. using_custom_model=%s", using_custom_model)
    return loaded, using_custom_model


def init_ocr_reader():
    if easyocr is None:
        logger.warning("EasyOCR is not installed. Plate OCR will be disabled.")
        return None

    try:
        reader = easyocr.Reader(["en"], gpu=False)
        logger.info("EasyOCR initialized")
        return reader
    except Exception as exc:  # pragma: no cover - runtime fallback
        logger.warning("Failed to initialize EasyOCR: %s", exc)
        return None


MODEL, USING_CUSTOM_MODEL = load_model()
OCR_READER = init_ocr_reader()


def assert_internal(request: Request) -> None:
    if request.headers.get("x-api-key") != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


def normalize_plate_text(raw: str) -> Optional[str]:
    if not raw:
        return None

    cleaned = re.sub(r"[^A-Z0-9]", "", raw.upper())
    if len(cleaned) < 5 or len(cleaned) > 12:
        return None
    return cleaned


def extract_plate_text(frame: np.ndarray, bbox: Tuple[int, int, int, int]) -> Optional[str]:
    if OCR_READER is None:
        return None

    x1, y1, x2, y2 = bbox
    h, w = frame.shape[:2]

    x1 = max(0, x1)
    y1 = max(0, y1)
    x2 = min(w, x2)
    y2 = min(h, y2)

    if x2 <= x1 or y2 <= y1:
        return None

    roi = frame[y1:y2, x1:x2]
    if roi.size == 0:
        return None

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 9, 75, 75)
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 2)

    try:
        candidates = OCR_READER.readtext(thresh, detail=0, paragraph=False)
    except Exception:
        return None

    for candidate in candidates:
        plate = normalize_plate_text(str(candidate))
        if plate:
            return plate

    return None


def infer_violation_type(class_name: str) -> str:
    normalized = class_name.lower().replace(" ", "_")

    for key, violation in VIOLATION_CLASS_MAP.items():
        if key in normalized:
            return violation

    # Fallback heuristics when running on generic COCO classes
    if any(token in normalized for token in ["motor", "bike", "scooter"]):
        return "NO_HELMET"
    return "OVERSPEED"


def is_trackable_class(class_name: str) -> bool:
    normalized = class_name.lower().replace(" ", "_")
    return any(hint in normalized for hint in TRACKABLE_LABEL_HINTS)


def build_detection_identity(plate_number: Optional[str], bbox: Tuple[int, int, int, int]) -> str:
    if plate_number:
        return plate_number

    x1, y1, x2, y2 = bbox
    cx = max(0, (x1 + x2) // 2)
    cy = max(0, (y1 + y2) // 2)
    area = max(1, (x2 - x1) * (y2 - y1))
    # Bucketize aggressively to keep de-dup identities stable across small motion.
    area_bucket = area // 25000
    return f"zone:{cx//240}:{cy//240}:a{area_bucket}"


def should_emit_violation(cam_id: str, violation_type: str, plate_number: Optional[str], bbox: Tuple[int, int, int, int]) -> bool:
    identity = build_detection_identity(plate_number, bbox)
    dedup_key = (cam_id, violation_type, identity)
    now = time.time()

    with dedup_lock:
        if not plate_number:
            no_plate_key = (cam_id, violation_type)
            no_plate_previous = last_no_plate_violation_sent.get(no_plate_key)
            if no_plate_previous and (now - no_plate_previous) < NO_PLATE_COOLDOWN_SECONDS:
                return False

        previous = last_violation_sent.get(dedup_key)
        if previous and (now - previous) < VIOLATION_COOLDOWN_SECONDS:
            return False
        last_violation_sent[dedup_key] = now
        if not plate_number:
            last_no_plate_violation_sent[(cam_id, violation_type)] = now

    return True


def send_camera_heartbeat(cam_id: str, fps: float, latency_ms: int, failure_count: int) -> None:
    payload = {
        "fps": round(fps, 2),
        "latency_ms": int(latency_ms),
        "failure_count": int(failure_count),
    }
    try:
        requests.post(
            f"{BACKEND_API_URL}/cameras/{cam_id}/heartbeat",
            json=payload,
            headers=REQUEST_HEADERS,
            timeout=5,
        )
    except Exception as exc:
        logger.warning("Heartbeat failed for camera %s: %s", cam_id, exc)


def post_live_violation(cam_id: str, payload: dict, frame: np.ndarray) -> None:
    success, encoded = cv2.imencode(".jpg", frame)
    if not success:
        return

    files = {
        "evidenceImage": (
            f"ev_{cam_id}_{int(time.time() * 1000)}.jpg",
            encoded.tobytes(),
            "image/jpeg",
        )
    }

    try:
        response = requests.post(
            f"{BACKEND_API_URL}/violations",
            data=payload,
            files=files,
            headers=REQUEST_HEADERS,
            timeout=12,
        )
        if response.status_code >= 300:
            logger.warning("Violation post failed (%s): %s", response.status_code, response.text)
    except Exception as exc:
        logger.warning("Violation post error for camera %s: %s", cam_id, exc)


def ensure_hls_process(cam_id: str, width: int, height: int, fps: float) -> None:
    process = streaming_processes.get(cam_id)
    if process is not None and process.poll() is None:
        return

    stream_dir = LIVE_DIR / cam_id
    stream_dir.mkdir(parents=True, exist_ok=True)

    output_path = stream_dir / "index.m3u8"
    process_fps = max(5, int(fps) if fps > 0 else 20)

    command = [
        "ffmpeg",
        "-y",
        "-f",
        "rawvideo",
        "-vcodec",
        "rawvideo",
        "-pix_fmt",
        "bgr24",
        "-s",
        f"{width}x{height}",
        "-r",
        str(process_fps),
        "-i",
        "-",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "ultrafast",
        "-tune",
        "zerolatency",
        "-f",
        "hls",
        "-hls_time",
        "2",
        "-hls_list_size",
        "5",
        "-hls_flags",
        "delete_segments",
        str(output_path),
    ]

    streaming_processes[cam_id] = subprocess.Popen(command, stdin=subprocess.PIPE)
    logger.info("Started HLS stream process for camera %s", cam_id)


def stop_hls_process(cam_id: str) -> None:
    process = streaming_processes.pop(cam_id, None)
    if process is None:
        return

    try:
        if process.stdin:
            process.stdin.close()
    except Exception:
        pass

    process.terminate()
    logger.info("Stopped HLS stream process for camera %s", cam_id)


def run_live_streaming(cam_id: str, frame: np.ndarray) -> None:
    if not streaming_active.get(cam_id):
        stop_hls_process(cam_id)
        return

    height, width = frame.shape[:2]
    ensure_hls_process(cam_id, width, height, 20)

    process = streaming_processes.get(cam_id)
    if process is None or process.stdin is None:
        return

    annotated = frame.copy()
    for x1, y1, x2, y2, label, conf in latest_detections.get(cam_id, []):
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(
            annotated,
            f"{label} {conf:.2f}",
            (x1, max(y1 - 8, 0)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (0, 255, 0),
            1,
            cv2.LINE_AA,
        )

    try:
        process.stdin.write(annotated.tobytes())
    except Exception as exc:
        logger.warning("HLS frame write failed for camera %s: %s", cam_id, exc)
        stop_hls_process(cam_id)


def stream_reader(cam_id: str, rtsp_url: str, lat: Optional[float], lng: Optional[float], stop_event: threading.Event) -> None:
    logger.info("Starting camera reader for %s (%s)", cam_id, rtsp_url)

    failure_count = 0
    frame_count = 0
    frame_timestamps: List[float] = []
    start_time = time.time()
    last_heartbeat_time = 0.0
    source_is_file = "://" not in rtsp_url

    while not stop_event.is_set():
        cap = cv2.VideoCapture(rtsp_url)
        if not cap.isOpened():
            failure_count += 1
            logger.warning("Cannot open stream for camera %s. retrying in 5s", cam_id)
            time.sleep(5)
            continue

        source_frame_interval = 0.0
        if source_is_file:
            source_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
            if source_fps <= 0 or source_fps > 120:
                source_fps = 25.0
            source_frame_interval = 1.0 / source_fps

        while cap.isOpened() and not stop_event.is_set():
            capture_start = time.time()
            success, frame = cap.read()
            if not success:
                if not source_is_file:
                    failure_count += 1
                    logger.warning("Frame read failed for camera %s. reconnecting.", cam_id)
                else:
                    logger.info("End of file source reached for camera %s. restarting stream.", cam_id)
                break

            frame_count += 1
            now = time.time()
            frame_timestamps.append(now)
            if len(frame_timestamps) > 30:
                frame_timestamps.pop(0)
            fps = len(frame_timestamps) / max(frame_timestamps[-1] - frame_timestamps[0], 1e-6) if len(frame_timestamps) > 1 else 0.0

            if frame_count % max(1, STREAM_FRAME_SKIP) == 0:
                infer_start = time.time()
                results = MODEL(frame, verbose=False)
                infer_end = time.time()
                latency_ms = int((infer_end - capture_start) * 1000)

                detections: List[Tuple[int, int, int, int, str, float]] = []
                boxes = results[0].boxes if results and len(results) > 0 else []

                for box in boxes:
                    confidence = float(box.conf)
                    if confidence < DETECTION_CONFIDENCE:
                        continue

                    class_id = int(box.cls)
                    class_name = str(results[0].names.get(class_id, class_id)).strip()
                    if not is_trackable_class(class_name):
                        continue

                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                    detections.append((x1, y1, x2, y2, class_name, confidence))

                    violation_type = infer_violation_type(class_name)
                    plate_number = extract_plate_text(frame, (x1, y1, x2, y2))
                    dedup_identity = build_detection_identity(plate_number, (x1, y1, x2, y2))

                    if not should_emit_violation(cam_id, violation_type, plate_number, (x1, y1, x2, y2)):
                        continue

                    payload = {
                        "type": violation_type,
                        "plateNumber": plate_number or "",
                        "vehicleType": class_name.upper().replace(" ", "_"),
                        "confidenceScore": f"{confidence * 100:.2f}",
                        "threatScore": f"{min(99.0, max(10.0, confidence * 120)):.2f}",
                        "cameraId": cam_id,
                        "locationLat": "" if lat is None else str(lat),
                        "locationLng": "" if lng is None else str(lng),
                        "videoTimestampSeconds": f"{now - start_time:.2f}",
                        "boundingBox": json.dumps([x1, y1, x2, y2]),
                        "dedupKey": dedup_identity,
                    }
                    post_live_violation(cam_id, payload, frame)

                latest_detections[cam_id] = detections

                if now - last_heartbeat_time >= 10:
                    send_camera_heartbeat(cam_id, fps=fps, latency_ms=latency_ms, failure_count=failure_count)
                    last_heartbeat_time = now

            with frame_lock:
                latest_frames[cam_id] = frame.copy()

            run_live_streaming(cam_id, frame)

            # Local file streams need explicit pacing; RTSP streams are naturally rate-limited.
            if source_frame_interval > 0:
                elapsed = time.time() - capture_start
                if elapsed < source_frame_interval:
                    time.sleep(source_frame_interval - elapsed)

        cap.release()
        stop_hls_process(cam_id)
        if not stop_event.is_set():
            time.sleep(2)

    stop_hls_process(cam_id)
    logger.info("Camera reader stopped for %s", cam_id)


def discover_and_attach_cameras() -> None:
    while True:
        try:
            response = requests.get(
                f"{BACKEND_API_URL}/cameras",
                headers=REQUEST_HEADERS,
                timeout=10,
            )
            if response.status_code != 200:
                logger.warning("Camera discovery failed (%s): %s", response.status_code, response.text)
                time.sleep(15)
                continue

            cameras = response.json()
            monitored_camera_ids = set()

            for camera in cameras:
                cam_id = str(camera.get("id"))
                rtsp_url = camera.get("rtspUrl")
                status = str(camera.get("status", "OFFLINE")).upper()

                if not cam_id:
                    continue

                # Keep readers attached for any configured camera stream so OFFLINE
                # nodes can recover automatically once the source is available again.
                should_monitor = bool(rtsp_url) and status != "MAINTENANCE"

                if should_monitor:
                    monitored_camera_ids.add(cam_id)
                    thread = camera_threads.get(cam_id)
                    if thread is None or not thread.is_alive():
                        stop_event = threading.Event()
                        camera_stop_events[cam_id] = stop_event
                        t = threading.Thread(
                            target=stream_reader,
                            args=(
                                cam_id,
                                rtsp_url,
                                camera.get("locationLat"),
                                camera.get("locationLng"),
                                stop_event,
                            ),
                            daemon=True,
                        )
                        camera_threads[cam_id] = t
                        t.start()
                        logger.info("Attached stream reader for camera %s", cam_id)
                else:
                    stop_event = camera_stop_events.get(cam_id)
                    if stop_event:
                        stop_event.set()

            for cam_id, stop_event in list(camera_stop_events.items()):
                if cam_id not in monitored_camera_ids and stop_event:
                    stop_event.set()

        except Exception as exc:
            logger.warning("Camera discovery loop error: %s", exc)

        time.sleep(15)


def ensure_camera_thread(cam_id: str) -> bool:
    thread = camera_threads.get(cam_id)
    if thread is not None and thread.is_alive():
        return True

    try:
        response = requests.get(
            f"{BACKEND_API_URL}/cameras",
            headers=REQUEST_HEADERS,
            timeout=10,
        )
        if response.status_code != 200:
            return False

        for camera in response.json():
            if str(camera.get("id")) != cam_id:
                continue

            rtsp_url = camera.get("rtspUrl")
            status = str(camera.get("status", "OFFLINE")).upper()
            if status == "MAINTENANCE" or not rtsp_url:
                return False

            stop_event = threading.Event()
            camera_stop_events[cam_id] = stop_event
            thread = threading.Thread(
                target=stream_reader,
                args=(
                    cam_id,
                    rtsp_url,
                    camera.get("locationLat"),
                    camera.get("locationLng"),
                    stop_event,
                ),
                daemon=True,
            )
            camera_threads[cam_id] = thread
            thread.start()
            return True
    except Exception:
        return False

    return False


def post_video_status(video_id: str, status: str, duration_seconds: Optional[float] = None) -> None:
    payload = {"status": status}
    if duration_seconds is not None:
        payload["durationSeconds"] = duration_seconds

    try:
        requests.patch(
            f"{BACKEND_API_URL}/videos/{video_id}/status",
            json=payload,
            headers=REQUEST_HEADERS,
            timeout=10,
        )
    except Exception as exc:
        logger.warning("Failed to update video %s status to %s: %s", video_id, status, exc)


def post_video_violation(video_id: str, payload: dict) -> None:
    try:
        response = requests.post(
            f"{BACKEND_API_URL}/videos/{video_id}/violations",
            json=payload,
            headers=REQUEST_HEADERS,
            timeout=8,
        )
        if response.status_code >= 300:
            logger.warning("Video violation post failed (%s): %s", response.status_code, response.text)
    except Exception as exc:
        logger.warning("Video violation post exception for %s: %s", video_id, exc)


def process_video(video_id: str, video_path: str) -> None:
    ensure_upload_dirs()

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.warning("Cannot open video %s", video_path)
        post_video_status(video_id, "failed")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration_seconds = (total_frames / fps) if fps > 0 else 0

    local_dedup: Dict[Tuple[str, str], float] = {}
    frame_index = 0

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break

        timestamp = (frame_index / fps) if fps > 0 else 0.0
        frame_index += 1

        if frame_index % max(1, VIDEO_FRAME_SKIP) != 0:
            continue

        results = MODEL(frame, verbose=False)
        boxes = results[0].boxes if results and len(results) > 0 else []

        for box in boxes:
            confidence = float(box.conf)
            if confidence < DETECTION_CONFIDENCE:
                continue

            class_id = int(box.cls)
            class_name = str(results[0].names.get(class_id, class_id)).strip()
            if not is_trackable_class(class_name):
                continue

            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            violation_type = infer_violation_type(class_name)
            plate_number = extract_plate_text(frame, (x1, y1, x2, y2))
            dedup_identity = build_detection_identity(plate_number, (x1, y1, x2, y2))
            dedup_key = (violation_type, dedup_identity)

            previous = local_dedup.get(dedup_key)
            if previous is not None and (timestamp - previous) < VIOLATION_COOLDOWN_SECONDS:
                continue
            local_dedup[dedup_key] = timestamp

            success_img, encoded = cv2.imencode(".jpg", frame)
            if not success_img:
                continue

            evidence_filename = f"vid_ev_{video_id}_{frame_index}.jpg"
            evidence_path = EVIDENCE_DIR / evidence_filename
            with open(evidence_path, "wb") as f:
                f.write(encoded.tobytes())

            payload = {
                "violationType": violation_type,
                "confidenceScore": confidence * 100,
                "frameTimestamp": timestamp,
                "videoTimestampSeconds": timestamp,
                "plateNumber": plate_number or "",
                "boundingBox": [x1, y1, x2, y2],
                "dedupKey": dedup_identity,
                "evidenceImagePath": f"/uploads/evidence/{evidence_filename}",
            }
            post_video_violation(video_id, payload)

    cap.release()
    post_video_status(video_id, "completed", duration_seconds)
    logger.info("Finished video processing for %s", video_id)


def video_worker() -> None:
    redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    logger.info("Video worker started")

    while True:
        try:
            queue_item = redis_client.blpop("video:queue", timeout=30)
            if not queue_item:
                continue

            _, raw_job = queue_item
            job = json.loads(raw_job)
            video_id = str(job.get("videoId"))
            file_path = str(job.get("filePath"))

            if not video_id or not file_path:
                logger.warning("Invalid video job payload: %s", raw_job)
                continue

            logger.info("Processing queued video %s", video_id)
            post_video_status(video_id, "processing")
            process_video(video_id, file_path)
        except Exception as exc:
            logger.warning("Video worker loop error: %s", exc)
            time.sleep(2)


@app.on_event("startup")
async def startup_event() -> None:
    ensure_upload_dirs()

    camera_discovery_thread = threading.Thread(target=discover_and_attach_cameras, daemon=True)
    camera_discovery_thread.start()

    worker_thread = threading.Thread(target=video_worker, daemon=True)
    worker_thread.start()

    logger.info("AI service startup complete")


@app.post("/cameras/{cam_id}/live/start")
def start_live_stream(cam_id: str, request: Request):
    assert_internal(request)
    if not ensure_camera_thread(cam_id):
        raise HTTPException(status_code=404, detail="Camera thread not active")

    streaming_active[cam_id] = True
    return {"status": "success", "message": f"Live streaming requested for {cam_id}"}


@app.post("/cameras/{cam_id}/live/stop")
def stop_live_stream(cam_id: str, request: Request):
    assert_internal(request)
    streaming_active[cam_id] = False
    stop_hls_process(cam_id)
    return {"status": "success", "message": f"Live streaming stopped for {cam_id}"}


@app.post("/cameras/{cam_id}/snapshot")
def capture_snapshot(cam_id: str, request: Request):
    assert_internal(request)

    with frame_lock:
        frame = latest_frames.get(cam_id)
        if frame is None:
            raise HTTPException(status_code=503, detail="No frame captured yet")
        frame_copy = frame.copy()

    timestamp = int(time.time())
    filename = f"snap_{cam_id}_{timestamp}.jpg"
    destination = SNAPSHOT_DIR / filename

    success, encoded = cv2.imencode(".jpg", frame_copy)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to encode snapshot")

    with open(destination, "wb") as f:
        f.write(encoded.tobytes())

    return {
        "status": "success",
        "snapshotUrl": f"/uploads/snapshots/{filename}",
        "timestamp": timestamp,
    }


@app.get("/health")
def health_check():
    active_streams = sum(1 for t in camera_threads.values() if t.is_alive())
    active_hls = sum(1 for enabled in streaming_active.values() if enabled)
    return {
        "status": "ok",
        "service": "ai-service",
        "active_streams": active_streams,
        "active_hls": active_hls,
        "ocr_enabled": OCR_READER is not None,
    }
