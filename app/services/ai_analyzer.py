

import os
from typing import Dict, Any, Optional, List
from PIL import Image
import logging
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True

    openai_api_key = os.getenv("OPENAI_API_KEY")
    if openai_api_key and openai_api_key != "your-openai-api-key-here":
        openai_client = OpenAI(api_key=openai_api_key)
    else:
        openai_client = None
        logger.warning(f"openai api key not configured, using fallback data")
        
except ImportError:
    OPENAI_AVAILABLE = False
    openai_client = None
    logger.warning(f"openai package not installed, using fallback data only")

import openai
import json
from typing import Dict, List, Optional, Tuple
from PIL import Image
import base64
import io
from pathlib import Path

class AIFoodAnalyzer:
    def __init__(self, api_key: Optional[str] = None):

        self.client = openai.OpenAI(api_key=api_key) if api_key else None

        self.food_database = {
            "apple": {
                "calories_per_100g": 52,
                "protein_per_100g": 0.3,
                "carbs_per_100g": 14,
                "fat_per_100g": 0.2,
                "fiber_per_100g": 2.4,
                "category": "fruit"
            },
            "banana": {
                "calories_per_100g": 89,
                "protein_per_100g": 1.1,
                "carbs_per_100g": 23,
                "fat_per_100g": 0.3,
                "fiber_per_100g": 2.6,
                "category": "fruit"
            },
            "bread": {
                "calories_per_100g": 265,
                "protein_per_100g": 9,
                "carbs_per_100g": 49,
                "fat_per_100g": 3.2,
                "fiber_per_100g": 2.7,
                "category": "grain"
            },
            "chicken breast": {
                "calories_per_100g": 165,
                "protein_per_100g": 31,
                "carbs_per_100g": 0,
                "fat_per_100g": 3.6,
                "fiber_per_100g": 0,
                "category": "protein"
            },
            "rice": {
                "calories_per_100g": 130,
                "protein_per_100g": 2.7,
                "carbs_per_100g": 28,
                "fat_per_100g": 0.3,
                "fiber_per_100g": 0.4,
                "category": "grain"
            }
        }
    
    def encode_image(self, image_path: str) -> str:

        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def analyze_food_image(self, image_path: str) -> Dict:

        try:
            if self.client:
                return self._analyze_with_openai(image_path)
            else:
                return self._analyze_with_fallback(image_path)
        except Exception as e:
            return self._analyze_with_fallback(image_path, error=str(e))
    
    def _analyze_with_openai(self, image_path: str) -> Dict:

        base64_image = self.encode_image(image_path)
        
        response = self.client.chat.completions.create(
            model="gpt-4-vision-preview",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": """Analyze this food image and provide:
                            1. Food name/type
                            2. Estimated weight in grams
                            3. Confidence score (0-1)
                            4. Brief description
                            
                            Return as JSON with keys: food_name, estimated_weight_grams, confidence_score, description"""   #here's the basic prompt for openai response
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=300
        )
        
        try:
            result = json.loads(response.choices[0].message.content)
            result["ai_powered"] = True
            return result
        except json.JSONDecodeError:
            return self._analyze_with_fallback(image_path)
    
    def _analyze_with_fallback(self, image_path: str, error: str = None) -> Dict:

        image_name = Path(image_path).stem.lower()

        matched_food = None
        for food_name in self.food_database.keys():
            if food_name in image_name or image_name in food_name:
                matched_food = food_name
                break
        
        if not matched_food:
            matched_food = "unknown food"
        
        return {
            "food_name": matched_food,
            "estimated_weight_grams": 150,
            "confidence_score": 0.7 if matched_food != "unknown food" else 0.3,
            "description": f"food in the image: {matched_food}",
            "ai_powered": False,
            "error": error
        }
    
    def get_nutrition_data(self, food_name: str, weight_grams: float) -> Dict:

        food_name_lower = food_name.lower()
        nutrition_per_100g = None
        for db_food, data in self.food_database.items():
            if db_food in food_name_lower or food_name_lower in db_food:  #trying to find a food in openfoodfacts db
                nutrition_per_100g = data
                break
        
        if not nutrition_per_100g:
            nutrition_per_100g = {
                "calories_per_100g": 200,
                "protein_per_100g": 5,
                "carbs_per_100g": 30,       #mock values
                "fat_per_100g": 8,
                "fiber_per_100g": 3,
                "category": "unknown"
            }
        multiplier = weight_grams / 100 #calculate nutrition based on weight
        
        return {
            "calories": round(nutrition_per_100g["calories_per_100g"] * multiplier, 1),
            "protein": round(nutrition_per_100g["protein_per_100g"] * multiplier, 1),
            "carbs": round(nutrition_per_100g["carbs_per_100g"] * multiplier, 1),
            "fat": round(nutrition_per_100g["fat_per_100g"] * multiplier, 1),
            "fiber": round(nutrition_per_100g["fiber_per_100g"] * multiplier, 1),
            "category": nutrition_per_100g["category"]
        }
    
    def generate_nutrition_advice(self, food_name: str, nutrition_data: Dict, user_goals: Optional[Dict] = None) -> str:

        try:
            if self.client and user_goals:
                return self._generate_ai_advice(food_name, nutrition_data, user_goals)
            else:
                return self._generate_fallback_advice(food_name, nutrition_data)
        except:
            return self._generate_fallback_advice(food_name, nutrition_data)
    
    def _generate_ai_advice(self, food_name: str, nutrition_data: Dict, user_goals: Dict) -> str:
#getting another prompt for advice generation
        prompt = f"""
        Food: {food_name}
        Nutrition: {nutrition_data}
        User goals: {user_goals}
        
        Provide brief, helpful nutrition advice about this food in the context of the user's goals.     
        Keep it under 100 words and be encouraging.
Generate basic advice without AI"""
        category = nutrition_data.get("category", "unknown")
        calories = nutrition_data.get("calories", 0)
        protein = nutrition_data.get("protein", 0)
        
        if category == "fruit":
            return f"Great choice! {food_name} is rich in vitamins and fiber. The {calories} calories come mainly from natural sugars."
        elif category == "protein":
            return f"{food_name} provides {protein}g of protein to help build and maintain muscles."
        elif category == "grain":
            return f"{food_name} provides energy through carbohydrates. Consider pairing with protein for balanced nutrition."
        else:
            return f"{food_name} contains {calories} calories. Consider the portion size as part of your daily nutrition goals."
    
    def calculate_health_score(self, nutrition_data: Dict) -> float:

        category = nutrition_data.get("category", "unknown")
        calories = nutrition_data.get("calories", 0)
        protein = nutrition_data.get("protein", 0)
        fiber = nutrition_data.get("fiber", 0)
        fat = nutrition_data.get("fat", 0)

        category_scores = {
            "fruit": 8.5,
            "vegetable": 9.0,
            "protein": 7.5,
            "grain": 6.5,
            "dairy": 6.0,
            "unknown": 5.0
        }
        
        base_score = category_scores.get(category, 5.0)

        if fiber > 3:
            base_score += 0.5
        if protein > 10:
            base_score += 0.5
        if calories > 400:  #high calorie
            base_score -= 1.0
        if fat > 15:  #high fat
            base_score -= 0.5
        
        return max(1.0, min(10.0, round(base_score, 1)))

ai_analyzer = AIFoodAnalyzer()