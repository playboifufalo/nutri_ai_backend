from PIL import Image
import logging
from typing import Optional

logger = logging.getLogger(__name__)

try:
    from transformers import CLIPProcessor, CLIPModel
    import torch
    CLIP_AVAILABLE = True
except ImportError:
    CLIP_AVAILABLE = False
    CLIPModel = None
    CLIPProcessor = None
    logger.warning("torch/transformers not installed, CLIP scanner disabled")


_model = None
_processor = None

def get_clip_model():
    global _model, _processor

    if not CLIP_AVAILABLE:
        raise RuntimeError("torch/transformers not installed")

    if _model is None or _processor is None:
        logger.info("loading clip model...")
        try:
            _model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
            _processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
            logger.info("clip model loaded successfully")
        except Exception as e:
            logger.error(f"error loading clip model: {e}")
            raise e

    return _model, _processor

def identify_product(image: Image.Image) -> dict:
    if not CLIP_AVAILABLE:
        return {
            "product": "unknown_food",
            "confidence": 0.1,
            "error": "CLIP model not available (torch/transformers not installed)",
            "fallback": True
        }

    try:
        model, processor = get_clip_model()
        labels = [
            "apple", "bread", "milk", "pasta",
            "rice", "banana", "orange",
            "chicken", "beef", "fish",
            "cheese", "yogurt", "tomato",
            "potato", "carrot", "broccoli",
            "pizza", "burger"
        ]

        inputs = processor(text=labels, images=image, return_tensors="pt", padding=True)
        outputs = model(**inputs)
        probs = outputs.logits_per_image.softmax(dim=1)
        best_match_idx = probs.argmax().item()
        confidence = probs.max().item()

        return {
            "product": labels[best_match_idx],
            "confidence": float(confidence),
            "all_predictions": {labels[i]: float(probs[0][i]) for i in range(len(labels))}
        }

    except Exception as e:
        logger.error(f"error in product identification: {e}")
        return {
            "product": "unknown_food",
            "confidence": 0.1,
            "error": str(e),
            "fallback": True
        }
