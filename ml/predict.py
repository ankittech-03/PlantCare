"""
MobileNetV2 TensorFlow/Keras model loader and predictor for PlantCare.
Loads the saved model and class mapping once at application startup.
"""

import json
import os
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from ml.disease_info import get_disease_details
from ml.preprocessing import MOBILENET_INPUT_SIZE, preprocess_image_for_mobilenet

MIN_CONFIDENCE_THRESHOLD = 55.0


class ModelUnavailableError(RuntimeError):
    """Raised when the trained model file or class mapping is missing or failed to load."""


class LowConfidencePredictionError(ValueError):
    """Raised when model confidence is below the minimum reliability threshold."""


class PlantDiseasePredictor:
    """Wraps a TensorFlow/Keras MobileNetV2 classifier and class label mapping."""

    def __init__(self, model_path: str, class_names_path: str) -> None:
        self.model_path = model_path
        self.class_names_path = class_names_path
        self.model: Any = None
        self.class_names: List[str] = []
        self.input_size: Tuple[int, int] = MOBILENET_INPUT_SIZE
        self.load_error: Optional[str] = None
        self._load_artifacts()

    @property
    def is_ready(self) -> bool:
        return self.model is not None and len(self.class_names) > 0 and self.load_error is None

    def _load_artifacts(self) -> None:
        if not os.path.exists(self.class_names_path):
            self.load_error = (
                f"Class label mapping file is missing at '{self.class_names_path}'. "
                "Please place class_names.json in the models/ directory."
            )
            return

        try:
            with open(self.class_names_path, "r", encoding="utf-8") as fh:
                loaded_classes = json.load(fh)
            if not isinstance(loaded_classes, list) or not all(
                isinstance(item, str) and item.strip() for item in loaded_classes
            ):
                self.load_error = "class_names.json must be a non-empty JSON list of class label strings."
                return
            self.class_names = [item.strip() for item in loaded_classes]
        except (OSError, json.JSONDecodeError) as exc:
            self.load_error = f"Failed to read class_names.json: {exc}"
            return

        if not os.path.exists(self.model_path):
            self.load_error = (
                f"Trained model file not found at '{self.model_path}'. "
                "Run ml/train_mobilenetv2.py on a PlantVillage dataset or place a compatible "
                "MobileNetV2 .keras model at models/plant_disease_model.keras."
            )
            return

        try:
            import tensorflow as tf  # Lazy import so missing TF fails clearly without crashing DB routes

            model = tf.keras.models.load_model(self.model_path, compile=False)
        except ImportError as exc:
            self.load_error = (
                f"TensorFlow is not installed ({exc}). Install dependencies via: pip install -r requirements.txt"
            )
            return
        except Exception as exc:
            self.load_error = f"Failed to load Keras model '{self.model_path}': {exc}"
            return

        # Verify model input & output tensor dimensions against class_names.json
        input_shape = getattr(model, "input_shape", None)
        if isinstance(input_shape, (list, tuple)) and len(input_shape) >= 4:
            h, w = input_shape[1], input_shape[2]
            if isinstance(h, int) and isinstance(w, int) and h > 0 and w > 0:
                self.input_size = (h, w)

        output_shape = getattr(model, "output_shape", None)
        if isinstance(output_shape, (list, tuple)) and len(output_shape) >= 2:
            num_outputs = output_shape[-1]
            if isinstance(num_outputs, int) and num_outputs != len(self.class_names):
                self.load_error = (
                    f"Model output dimension ({num_outputs}) does not match "
                    f"class_names.json count ({len(self.class_names)})."
                )
                return

        self.model = model
        self.load_error = None

    @staticmethod
    def _to_probabilities(raw_scores: np.ndarray) -> np.ndarray:
        scores = np.asarray(raw_scores, dtype=np.float64).ravel()
        total = float(np.sum(scores))
        if np.all(scores >= 0.0) and abs(total - 1.0) <= 1e-2:
            return scores
        shifted = scores - np.max(scores)
        exps = np.exp(shifted)
        return exps / np.sum(exps)

    def predict(self, image_path: str, lang: str = "en") -> Dict[str, object]:
        if not self.is_ready:
            raise ModelUnavailableError(self.load_error or "Plant disease model is not loaded.")

        batch = preprocess_image_for_mobilenet(image_path, target_size=self.input_size)

        try:
            raw_predictions = self.model.predict(batch, verbose=0)
        except Exception as exc:
            raise RuntimeError(f"Model inference failed: {exc}") from exc

        probabilities = self._to_probabilities(raw_predictions[0])
        if probabilities.size != len(self.class_names):
            raise RuntimeError(
                f"Prediction vector size ({probabilities.size}) does not match class labels ({len(self.class_names)})."
            )

        top_index = int(np.argmax(probabilities))
        confidence_pct = round(float(probabilities[top_index]) * 100.0, 1)

        if confidence_pct < MIN_CONFIDENCE_THRESHOLD:
            if str(lang).lower().startswith("hi"):
                msg = (
                    f"विश्वसनीय निदान के लिए मॉडल का विश्वास स्तर ({confidence_pct}%) बहुत कम है। "
                    "कृपया स्पष्ट रोशनी में एक ही पत्ती की साफ तस्वीर अपलोड करें।"
                )
            else:
                msg = (
                    f"Prediction confidence ({confidence_pct}%) is too low for a reliable diagnosis. "
                    "Please upload a clear, well-lit close-up photo of a single Tomato, Potato, or Bell Pepper leaf."
                )
            raise LowConfidencePredictionError(msg)

        raw_label = self.class_names[top_index]
        details = get_disease_details(raw_label, lang=lang)

        return {
            "raw_label": raw_label,
            "plant": details["plant"],
            "disease": details["disease"],
            "confidence": confidence_pct,
            "disease_info": {
                "description": details["description"],
                "symptoms": details["symptoms"],
                "recommendations": details["recommendations"],
            },
        }
