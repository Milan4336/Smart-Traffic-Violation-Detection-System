from ultralytics import YOLO
import cv2
import os
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_inference():
    model_path = "/home/milan/Neon_Guardian/ai-training/models/trained/traffic_model_v1.pt"
    if not Path(model_path).exists():
        logger.error("No trained model found.")
        return

    model = YOLO(model_path)
    
    test_images_dir = Path("/home/milan/Neon_Guardian/ai-training/datasets/images/test")
    output_dir = Path("/home/milan/Neon_Guardian/ai-training/logs/inference_results")
    output_dir.mkdir(parents=True, exist_ok=True)

    if not test_images_dir.exists():
        logger.error("Test images directory not found.")
        return

    test_images = list(test_images_dir.glob("*.jpg")) + list(test_images_dir.glob("*.png"))
    
    if not test_images:
        logger.warning("No test images found to run inference.")
        return

    for img_path in test_images[:5]: # Test on first 5
        logger.info(f"Running inference on {img_path.name}...")
        results = model.predict(source=str(img_path), save=True, project=str(output_dir), name="run")
        logger.info(f"Results saved to {output_dir}")

if __name__ == "__main__":
    test_inference()
