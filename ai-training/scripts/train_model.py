import yaml
import os
from ultralytics import YOLO
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def train():
    # Load config
    config_path = Path("/home/milan/Neon_Guardian/ai-training/configs/training_config.yaml")
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    logger.info(f"Starting training with config: {config}")

    # Load model
    model_name = config.get("model", "yolov8n.pt")
    model = YOLO(model_name)

    # Training
    results = model.train(
        data="/home/milan/Neon_Guardian/ai-training/datasets/data.yaml",
        epochs=config.get("epochs", 50),
        imgsz=config.get("image_size", 640),
        batch=config.get("batch_size", 16),
        device=config.get("device", "auto"),
        project="/home/milan/Neon_Guardian/ai-training/models/trained",
        name=config.get("project_name", "NeonGuardian_Traffic"),
        save_period=config.get("save_period", 5)
    )

    logger.info("Training complete.")
    
    # Save best model to a versioned path
    best_model_path = Path(results.save_dir) / 'weights' / 'best.pt'
    if best_model_path.exists():
        versioned_path = Path("/home/milan/Neon_Guardian/ai-training/models/trained/traffic_model_v1.pt")
        import shutil
        shutil.copy2(best_model_path, versioned_path)
        logger.info(f"Verified best model saved to {versioned_path}")

if __name__ == "__main__":
    train()
