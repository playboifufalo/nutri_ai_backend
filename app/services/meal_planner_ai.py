import os
import json
import requests
import logging
from typing import Dict, List, Optional, Any
from dotenv import load_dotenv
from datetime import datetime, timedelta
load_dotenv()
logger = logging.getLogger(__name__)

try:
    from .vertex_ai_service import vertex_ai_service
    VERTEX_AI_AVAILABLE = True
    logger.info("vertex ai service loaded")
except ImportError:
    VERTEX_AI_AVAILABLE = False
    vertex_ai_service = None
    logger.warning("vertex ai service not available")

class TheMealDBService:
    BASE_URL = "https://www.themealdb.com/api/json/v1/1"
    @classmethod
    def search_meals_by_name(cls, name: str) -> List[Dict]:

        try:
            url = f"{cls.BASE_URL}/search.php"
            response = requests.get(url, params={"s": name}, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                return data.get("meals", [])
            return []
        except Exception as e:
            logger.error(f"themealdb search error: {e}")
            return []
    @classmethod
    def get_random_meal(cls) -> Optional[Dict]:

        try:
            url = f"{cls.BASE_URL}/random.php"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                meals = data.get("meals", [])
                return meals[0] if meals else None
            return None
        except Exception as e:
            logger.error(f"themealdb random meal error: {e}")
            return None
    @classmethod
    def search_by_category(cls, category: str) -> List[Dict]:
        try:
            url = f"{cls.BASE_URL}/filter.php"
            response = requests.get(url, params={"c": category}, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                return data.get("meals", [])[:10] 
            return []
        except Exception as e:
            logger.error(f"themealdb category search error: {e}")
            return []
    @classmethod
    def get_categories(cls) -> List[str]:
        try:
            url = f"{cls.BASE_URL}/categories.php"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                categories = data.get("categories", [])
                return [cat["strCategory"] for cat in categories]
            return []
        except Exception as e:
            logger.error(f"themealdb categories error: {e}")
            return ["Beef", "Chicken", "Pasta", "Vegetarian", "Seafood"]

 # Based on Google Vertex AI Gemini API documentation:
# https://cloud.google.com/vertex-ai/generative-ai/docs
# Used for generating meal recommendations and nutrition analysis.
class MealPlannerAI:
    def __init__(self):
        self.vertex_ai_service = vertex_ai_service
        self.meal_db = TheMealDBService()
        self.ai_provider = os.getenv("AI_PROVIDER", "vertex").lower()
        self.nutrition_estimates = {
            "breakfast": {"min_cal": 300, "max_cal": 500, "protein_ratio": 0.20},
            "lunch": {"min_cal": 400, "max_cal": 700, "protein_ratio": 0.25},
            "dinner": {"min_cal": 400, "max_cal": 800, "protein_ratio": 0.30},
            "snack": {"min_cal": 100, "max_cal": 300, "protein_ratio": 0.15}
        }
        logger.info(f"mealplannerai initialized with provider: {self.ai_provider}")
    async def generate_meal_plan(self, user_data: Dict) -> Dict:

        try:
            available_ingredients = user_data.get("available_ingredients", [])
            allergies = user_data.get("allergies", [])
            diet_type = user_data.get("diet_type", "balanced")
            goal = user_data.get("goal", "maintenance")
            daily_calories = user_data.get("daily_calories", 2000)
            lifestyle = user_data.get("lifestyle", "moderate")
            time_period = user_data.get("time_period", 7)
            logger.info(f"generating meal plan for {time_period} days, {daily_calories} kcal, {diet_type} diet")
            if self.ai_provider == "vertex" and VERTEX_AI_AVAILABLE and self.vertex_ai_service:
                logger.info("attempting vertex AI meal plan generation")
                ai_result = await self.vertex_ai_service.generate_meal_plan(user_data)
                logger.info(f"vertex ai result type: {type(ai_result)}")
                logger.info(f"vertex ai result keys: {list(ai_result.keys()) if isinstance(ai_result, dict) else 'not a dict'}")
                if ai_result.get("success"):
                    logger.info("vertex AI meal plan generated successfully")

                    enhanced_plan = await self._enhance_with_meal_images(ai_result["meal_plan"])
                    return {
                        "success": True,
                        "ai_powered": True,
                        "meal_plan": enhanced_plan,
                        "generated_at": datetime.now().isoformat(),
                        "provider": "vertex_ai"
                    }
                else:
                    logger.warning(f"vertex AI generation failed: {ai_result.get('error', 'Unknown error')}")

            logger.info("Using template-based meal plan generation")
            return self._generate_fallback_meal_plan(user_data)
                
        except Exception as e:
            logger.error(f"meal plan generation error: {e}")
            return self._generate_fallback_meal_plan(user_data)
    
    def _create_meal_plan_prompt(self, user_data: Dict) -> str:
        available_ingredients = user_data.get("available_ingredients", [])
        allergies = user_data.get("allergies", [])
        diet_type = user_data.get("diet_type", "balanced")
        goal = user_data.get("goal", "maintenance")
        daily_calories = user_data.get("daily_calories", 2000)
        lifestyle = user_data.get("lifestyle", "moderate")
        time_period = user_data.get("time_period", 7)
        prompt = f"""
        You are a professional nutritionist and meal planner.
        Based on the following user data, create a personalized meal plan that includes full recipes with nutritional information and cooking instructions.
        Each meal should be realistic to prepare, nutritionally balanced, and match the user's preferences.

        User Data:
        - Available ingredients: {', '.join(available_ingredients) if available_ingredients else 'No specific restrictions'}
        - Allergies: {', '.join(allergies) if allergies else 'None'}
        - Diet type: {diet_type}
        - Goal: {goal}
        - Daily calorie target: {daily_calories} kcal
        - Lifestyle: {lifestyle}
        - Timeframe: {time_period} days

        Requirements:
        1. Create meals for {time_period} days
        2. Each day should have breakfast, lunch, dinner, and 1 snack
        3. Total daily calories should be approximately {daily_calories} kcal
        4. Avoid all listed allergens completely
        5. Use available ingredients when possible
        6. Match the {diet_type} diet requirements
        7. Consider the {goal} goal in macro distribution

        For each meal, provide:
        - Meal name
        - Brief description (1 sentence)
        - Recipe with ingredients list (with quantities) and detailed step-by-step instructions (5-8 steps per recipe)
        - Each instruction step must be a clear, actionable sentence (e.g. "Preheat oven to 180°C", "Sauté onions for 3 minutes until translucent")
        - Estimated calories and macros (protein, fat, carbs in grams)
        - Preparation time and cooking time in minutes

        IMPORTANT: Each recipe MUST have at least 5 detailed cooking instruction steps. Short 1-2 step instructions are NOT acceptable.

        Return ONLY a valid JSON object in this exact format:
        {{
            "days": [
                {{
                    "day_number": 1,
                    "total_calories": 2000,
                    "meals": [
                        {{
                            "meal_type": "breakfast",
                            "meal_name": "Protein Pancakes",
                            "description": "Fluffy pancakes packed with protein",
                            "ingredients": ["2 eggs", "1 banana", "30g oats", "1 tsp vanilla"],
                            "instructions": [
                                "In a blender, combine oats, eggs, mashed banana, and vanilla extract until smooth.",
                                "Heat a non-stick skillet over medium heat and lightly grease with butter or cooking spray.",
                                "Pour about 1/4 cup of batter per pancake onto the skillet.",
                                "Cook for 2-3 minutes until bubbles form on the surface and edges look set.",
                                "Flip carefully and cook for another 1-2 minutes until golden brown.",
                                "Serve warm topped with fresh berries and a drizzle of honey."
                            ],
                            "calories": 350,
                            "macros": {{"protein": 20, "fat": 8, "carbs": 45}},
                            "prep_time_minutes": 5,
                            "cook_time_minutes": 10,
                            "image_url": null
                        }}
                    ]
                }}
            ],
            "total_plan_summary": {{
                "average_daily_calories": 2000,
                "diet_compliance": "100%",
                "allergen_free": true,
                "goal_aligned": true
            }}
        }}
        Generate the meal plan now:"""
        return prompt
    

    
    async def _enhance_with_meal_images(self, meal_plan_data: Any) -> Any:
        if not isinstance(meal_plan_data, dict) or "days" not in meal_plan_data:
            return meal_plan_data
        for day in meal_plan_data["days"]:
            if "meals" not in day:
                continue
            for meal in day["meals"]:
                meal_name = meal.get("meal_name", "")
                image_url = self._find_meal_image(meal_name)
                meal["image_url"] = image_url
        return meal_plan_data
    


    
    def _find_meal_image(self, meal_name: str) -> Optional[str]:
        try:
            meals = self.meal_db.search_meals_by_name(meal_name)        #trying to find an image for the meal by searching in database first trying full name, then keywords
            if meals and meals[0].get("strMealThumb"):
                return meals[0]["strMealThumb"]
            keywords = meal_name.lower().split()
            for keyword in keywords:
                if len(keyword) > 3:
                    meals = self.meal_db.search_meals_by_name(keyword)
                    if meals and meals[0].get("strMealThumb"):
                        return meals[0]["strMealThumb"]
            return None
        except Exception as e:
            logger.error(f"image search error for {meal_name}: {e}")
            return None
    


    
    def _extract_json_from_text(self, text: str) -> Dict:
        try:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start != -1 and end > start:
                json_str = text[start:end]
                return json.loads(json_str)
            return self._create_fallback_structure()
        except Exception:
            return self._create_fallback_structure()
    


    
    def _generate_fallback_meal_plan(self, user_data: Dict) -> Dict:
        daily_calories = user_data.get("daily_calories", 2000)
        time_period = user_data.get("time_period", 7)
        diet_type = user_data.get("diet_type", "balanced")
        allergies = user_data.get("allergies", [])
        days = []
        for day_num in range(1, time_period + 1):
            day_meals = self._create_fallback_day_meals(daily_calories, diet_type, allergies) #create simple meals based on calorie distribution and diet type, without AI (in case of connection); might be used in the future
            days.append({
                "day_number": day_num,
                "total_calories": sum(meal["calories"] for meal in day_meals),
                "meals": day_meals
            })
        return {
            "success": True,
            "ai_powered": False,
            "meal_plan": {
                "days": days,
                "total_plan_summary": {
                    "average_daily_calories": daily_calories,
                    "diet_compliance": "90%",
                    "allergen_free": len(allergies) == 0,
                    "goal_aligned": True,
                    "note": "Fallback meal plan - basic template"
                }
            },
            "user_data": user_data,
            "generated_at": datetime.now().isoformat()
        }
    

    

    def _create_fallback_day_meals(self, daily_calories: int, diet_type: str, allergies: List[str]) -> List[Dict]: #a function that creates simple meals based on calorie distribution and diet type, without AI (in case of connection), might be used in the future or as a backup
        breakfast_cal = int(daily_calories * 0.25) 
        lunch_cal = int(daily_calories * 0.35)  
        dinner_cal = int(daily_calories * 0.30)
        snack_cal = int(daily_calories * 0.10)
        meals = [
            {
                "meal_type": "breakfast",
                "meal_name": "Oatmeal with Fruits",
                "description": "Healthy oatmeal topped with fresh fruits and nuts",
                "ingredients": ["1 cup rolled oats", "1 cup water or milk", "1 banana", "1 tbsp honey", "handful of mixed nuts", "pinch of cinnamon"],
                "instructions": [
                    "Bring 1 cup of water or milk to a gentle boil in a medium saucepan over medium heat.",
                    "Add the rolled oats, reduce heat to low, and stir occasionally for 4-5 minutes until the oats are soft and creamy.",
                    "While the oats cook, peel and slice the banana into thin rounds.",
                    "Roughly chop the mixed nuts (almonds, walnuts, or pecans) for added crunch.",
                    "Transfer the cooked oatmeal to a serving bowl and sprinkle with a pinch of cinnamon.",
                    "Arrange the banana slices on top, scatter the chopped nuts, and drizzle with honey.",
                    "Let it cool for 1-2 minutes before serving. Enjoy warm!"
                ],
                "calories": breakfast_cal,
                "macros": {
                    "protein": int(breakfast_cal * 0.15 / 4),
                    "fat": int(breakfast_cal * 0.25 / 9),
                    "carbs": int(breakfast_cal * 0.60 / 4)
                },
                "prep_time_minutes": 5,
                "cook_time_minutes": 8,
                "image_url": None
            },
            {
                "meal_type": "lunch", 
                "meal_name": "Grilled Chicken Salad",
                "description": "Fresh salad with grilled chicken breast and vegetables",
                "ingredients": ["150g chicken breast", "2 cups mixed greens", "1 medium tomato", "1/2 cucumber", "1/4 red onion", "2 tbsp olive oil", "1 tbsp lemon juice", "salt and pepper to taste"],
                "instructions": [
                    "Season the chicken breast on both sides with salt, pepper, and a drizzle of olive oil.",
                    "Heat a grill pan or skillet over medium-high heat until hot.",
                    "Cook the chicken breast for 5-6 minutes per side until the internal temperature reaches 74°C (165°F) and juices run clear.",
                    "While the chicken rests for 5 minutes, wash and dry the mixed greens and arrange them on a large plate.",
                    "Dice the tomato, slice the cucumber into half-moons, and thinly slice the red onion.",
                    "In a small bowl, whisk together olive oil, lemon juice, salt, and pepper to make the dressing.",
                    "Slice the rested chicken into strips and arrange on top of the salad.",
                    "Scatter the vegetables over the greens and drizzle with the lemon dressing. Serve immediately."
                ],
                "calories": lunch_cal,
                "macros": {
                    "protein": int(lunch_cal * 0.30 / 4),
                    "fat": int(lunch_cal * 0.35 / 9),
                    "carbs": int(lunch_cal * 0.35 / 4)
                },
                "prep_time_minutes": 10,
                "cook_time_minutes": 15,
                "image_url": None
            },
            {
                "meal_type": "dinner",
                "meal_name": "Baked Salmon with Vegetables", 
                "description": "Omega-rich salmon with roasted seasonal vegetables",
                "ingredients": ["150g salmon fillet", "1 cup broccoli florets", "2 medium carrots", "1 tbsp olive oil", "1 clove garlic (minced)", "1 tsp dried herbs (thyme or dill)", "1/2 lemon", "salt and pepper to taste"],
                "instructions": [
                    "Preheat the oven to 200°C (400°F) and line a large baking sheet with parchment paper.",
                    "Cut the broccoli into bite-sized florets and slice the carrots into 1cm rounds.",
                    "Toss the vegetables with half the olive oil, minced garlic, salt, and pepper, then spread them in a single layer on one side of the baking sheet.",
                    "Place the salmon fillet skin-side down on the other side of the sheet. Drizzle with remaining olive oil, season with herbs, salt, and pepper.",
                    "Squeeze the lemon half over the salmon and vegetables.",
                    "Bake for 20-25 minutes until the salmon flakes easily with a fork and vegetables are tender and slightly caramelized.",
                    "Let rest for 2-3 minutes, then plate the salmon over the roasted vegetables and serve."
                ],
                "calories": dinner_cal,
                "macros": {
                    "protein": int(dinner_cal * 0.35 / 4),
                    "fat": int(dinner_cal * 0.40 / 9),
                    "carbs": int(dinner_cal * 0.25 / 4)
                },
                "prep_time_minutes": 10,
                "cook_time_minutes": 25,
                "image_url": None
            },
            {
                "meal_type": "snack",
                "meal_name": "Greek Yogurt with Berries",
                "description": "Protein-rich snack with antioxidant-packed berries",
                "ingredients": ["150g Greek yogurt", "1/2 cup mixed berries (blueberries, raspberries, strawberries)", "1 tsp honey", "1 tbsp granola (optional)"],
                "instructions": [
                    "Scoop the Greek yogurt into a serving bowl or glass.",
                    "Wash the mixed berries thoroughly under cold running water and pat dry.",
                    "If using strawberries, hull and slice them into halves.",
                    "Arrange the berries on top of the yogurt in a colorful pattern.",
                    "Drizzle with honey and sprinkle granola on top if desired.",
                    "Serve immediately for the best texture and freshness."
                ],
                "calories": snack_cal,
                "macros": {
                    "protein": int(snack_cal * 0.40 / 4),
                    "fat": int(snack_cal * 0.30 / 9),
                    "carbs": int(snack_cal * 0.30 / 4)
                },
                "prep_time_minutes": 5,
                "cook_time_minutes": 0,
                "image_url": None
            }
        ]
        return meals
    


    def _create_fallback_structure(self) -> Dict:
        return {
            "days": [{
                "day_number": 1,
                "total_calories": 2000,
                "meals": [{
                    "meal_type": "breakfast",
                    "meal_name": "Simple Breakfast",
                    "description": "Basic healthy breakfast",
                    "ingredients": ["ingredients list"],
                    "instructions": ["preparation steps"],
                    "calories": 400,
                    "macros": {"protein": 20, "fat": 15, "carbs": 45},
                    "prep_time_minutes": 15,
                    "image_url": None
                }]
            }],
            "total_plan_summary": {
                "average_daily_calories": 2000,
                "diet_compliance": "Basic",
                "allergen_free": True,
                "goal_aligned": True
            }
        }

meal_planner = MealPlannerAI()