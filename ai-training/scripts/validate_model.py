import json
from ultralytics import YOLO
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def validate():
    # Load the trained model
    model_path = "/home/milan/Neon_Guardian/ai-training/models/trained/traffic_model_v1.pt"
    if not Path(model_path).exists():
        logger.error(f"Model path {model_path} does not exist. Run training first.")
        return

    model = YOLO(model_path)

    # Validate the model
    metrics = model.val(data="/home/milan/Neon_Guardian/ai-training/datasets/data.yaml")
    
    # Extract results
    report = {
        "mAP50": metrics.box.map50,
        "mAP50-95": metrics.box.map,
        "precision": metrics.box.mp,
        "recall": metrics.box.mr,
        "fitness": metrics.fitness
    }

    # Save report
    report_path = "/home/milan/Neon_Guardian/ai-training/logs/validation_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=4)

    logger.info(f"Validation report saved to {report_path}")
    logger.info(f"mAP50: {report['mAP50']}")

if __name__ == "__main__":
    validate()
