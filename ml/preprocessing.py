"""
Image validation and preprocessing utilities for MobileNetV2 inference.
"""

from io import BytesIO
from typing import Tuple

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

MOBILENET_INPUT_SIZE: Tuple[int, int] = (224, 224)


class ImageValidationError(ValueError):
    """Raised when an uploaded file is unreadable, corrupted, or unsupported."""


def verify_image_bytes(raw_bytes: bytes) -> str:
    """
    Validates raw file bytes using Pillow without trusting the filename extension alone.
    Returns the normalized format ('JPEG' or 'PNG') or raises ImageValidationError.
    """
    if not raw_bytes:
        raise ImageValidationError("Uploaded file is empty.")

    try:
        with Image.open(BytesIO(raw_bytes)) as img:
            img.verify()

        # Re-open to decode pixel data cleanly after verify()
        with Image.open(BytesIO(raw_bytes)) as img:
            img.load()
            fmt = (img.format or "").upper()
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise ImageValidationError(
            "Invalid or corrupted image file. Please upload a valid JPG or PNG photograph."
        ) from exc

    if fmt not in {"JPEG", "PNG"}:
        raise ImageValidationError(
            f"Unsupported image content format '{fmt or 'UNKNOWN'}'. Only JPG, JPEG, and PNG are allowed."
        )

    return fmt


def preprocess_image_for_mobilenet(
    image_path: str,
    target_size: Tuple[int, int] = MOBILENET_INPUT_SIZE,
) -> np.ndarray:
    """
    Loads an image from disk, applies EXIF orientation correction, converts to RGB,
    resizes to 224x224, and scales pixel values to [-1, 1] for MobileNetV2.

    Returns a float32 NumPy array of shape (1, height, width, 3).
    """
    try:
        with Image.open(image_path) as img:
            oriented = ImageOps.exif_transpose(img)
            rgb_image = oriented.convert("RGB")
            resized = rgb_image.resize(target_size, Image.Resampling.BILINEAR)
            pixel_array = np.asarray(resized, dtype=np.float32)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ImageValidationError("Could not decode the uploaded image for analysis.") from exc

    # MobileNetV2 preprocess_input scales [0, 255] -> [-1.0, 1.0]
    normalized = (pixel_array / 127.5) - 1.0
    return np.expand_dims(normalized, axis=0)
