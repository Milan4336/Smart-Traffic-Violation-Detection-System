from ultralytics import YOLO
from pathlib import Path
import logging
import torch

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def export():
    model_path = "/home/milan/Neon_Guardian/ai-training/models/trained/traffic_model_v1.pt"
    if not Path(model_path).exists():
        logger.error(f"Model path {model_path} does not exist.")
        return

    model = YOLO(model_path)

    export_formats = ['onnx', 'torchscript']
    if torch.cuda.is_available():
        export_formats.append('engine') # TensorRT

    for fmt in export_formats:
        logger.info(f"Exporting model to {fmt} format...")
        model.export(format=fmt)

    logger.info("Export process complete.")

if __name__ == "__main__":
    export()
