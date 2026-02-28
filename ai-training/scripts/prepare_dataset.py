import os
import shutil
import random
from pathlib import Path

def prepare_dataset(raw_dir, base_dir, split_ratio=(0.7, 0.2, 0.1)):
    """
    Splits raw images and labels into train, val, and test sets.
    Assumes raw_dir contains images and labels subfolders.
    """
    raw_path = Path(raw_dir)
    images_raw = raw_path / 'images'
    labels_raw = raw_path / 'labels'

    if not images_raw.exists() or not labels_raw.exists():
        print(f"Error: {images_raw} or {labels_raw} does not exist.")
        return

    # Get all image files
    image_files = [f for f in images_raw.iterdir() if f.suffix.lower() in ['.jpg', '.jpeg', '.png']]
    
    # Shuffle for random splitting
    random.shuffle(image_files)

    num_images = len(image_files)
    train_idx = int(num_images * split_ratio[0])
    val_idx = train_idx + int(num_images * split_ratio[1])

    splits = {
        'train': image_files[:train_idx],
        'val': image_files[train_idx:val_idx],
        'test': image_files[val_idx:]
    }

    base_path = Path(base_dir)

    for split_name, files in splits.items():
        img_dest = base_path / 'images' / split_name
        lbl_dest = base_path / 'labels' / split_name
        
        img_dest.mkdir(parents=True, exist_ok=True)
        lbl_dest.mkdir(parents=True, exist_ok=True)

        print(f"Processing {split_name} split ({len(files)} images)...")

        for img_file in files:
            # Check for corresponding label
            label_file = labels_raw / f"{img_file.stem}.txt"
            
            if label_file.exists():
                # Copy image
                shutil.copy2(img_file, img_dest / img_file.name)
                # Copy label
                shutil.copy2(label_file, lbl_dest / label_file.name)
            else:
                print(f"Warning: No label found for {img_file.name}, skipping.")

    print("Dataset preparation complete.")

if __name__ == "__main__":
    RAW_DATA_DIR = "/home/milan/Neon_Guardian/ai-training/datasets/raw"
    BASE_DATA_DIR = "/home/milan/Neon_Guardian/ai-training/datasets"
    
    # Ensure directories exist
    Path(RAW_DATA_DIR).mkdir(parents=True, exist_ok=True)
    (Path(RAW_DATA_DIR) / 'images').mkdir(exist_ok=True)
    (Path(RAW_DATA_DIR) / 'labels').mkdir(exist_ok=True)

    prepare_dataset(RAW_DATA_DIR, BASE_DATA_DIR)
