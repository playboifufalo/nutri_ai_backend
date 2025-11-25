from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import torch
import os
from typing import Optional




_model: Optional[CLIPModel] = None
_processor: Optional[CLIPProcessor] = None

def get_clip_model():
    global _model, _processor
    
    if _model is None or _processor is None:
        print("loading clip model...")
        try:
            _model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
            _processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")      #TODO: check if there are other models
            print("clip model loaded successfully")
        except Exception as e:
            print(f"there was an error loading clip model: {e}")
            raise e
    
    return _model, _processor

def identify_product(image: Image.Image) -> str: # identify product using clip model
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
        probs = outputs.logits_per_image.softmax(dim=1) #doing the AI magic
        best_match_idx = probs.argmax().item()
        confidence = probs.max().item()
        
        return {
            "product": labels[best_match_idx],
            "confidence": float(confidence),
            "all_predictions": {labels[i]: float(probs[0][i]) for i in range(len(labels))}
        }
        
    except Exception as e:
        print(f"there was  in product identification: {e}")
        fallback_products = ["unknown_food", "generic_product"]
        return {
            "product": fallback_products[0],
            "confidence": 0.1,
            "error": str(e),
            "fallback": True
        }
