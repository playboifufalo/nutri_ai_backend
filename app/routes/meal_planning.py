

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import logging

from ..models.database import get_db
from ..models.user import User
from ..models.preferences import UserPreferences
from ..routes.auth import get_current_user
from ..services.meal_planner_ai import meal_planner

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/meal-planning",
    tags=["meal-planning"]
)

class MealPlanRequest(BaseModel):

    available_ingredients: List[str] = Field(default_factory=list, description="Available ingredients")
    allergies: List[str] = Field(default_factory=list, description="Allergies")
    diet_type: str = Field(default="balanced", description="Diet type: vegan, keto, high-protein, vegetarian, mediterranean, balanced")
    goal: str = Field(default="maintenance", description="Goal: weight_loss, muscle_gain, maintenance")
    daily_calories: int = Field(default=2000, ge=1000, le=5000, description="Daily calorie target")
    lifestyle: str = Field(default="moderate", description="Lifestyle: sedentary, moderate, active, athlete")
    time_period: int = Field(default=7, ge=1, le=30, description="Planning period in days")
    preferences: Optional[Dict[str, Any]] = Field(default=None, description="Additional preferences")

class MealPlanResponse(BaseModel):

    success: bool
    message: str
    ai_powered: bool
    meal_plan: Dict[str, Any]
    user_data: Dict[str, Any]
    generated_at: str

@router.post("/generate", response_model=Dict[str, Any])
async def generate_meal_plan(
    request: MealPlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    try:
        logger.info(f"generating meal plan for user {current_user.username}")

        logger.info(f"request type: {type(request)}")
        logger.info(f"request has dict method: {hasattr(request, 'dict')}")

        user_preferences = db.query(UserPreferences).filter(
            UserPreferences.user_id == current_user.id
        ).first()

        logger.info(f"user preferences type: {type(user_preferences)}")

        user_data = request.model_dump()

        if user_preferences:
            try:
                logger.info(f"getting allergies...")
                stored_allergies = user_preferences.get_allergies()
                logger.info(f"got allergies: {stored_allergies}")
                
                stored_liked = user_preferences.get_liked_products()
                stored_disliked = user_preferences.get_disliked_products()

                all_allergies = list(set(user_data["allergies"] + stored_allergies))
                user_data["allergies"] = all_allergies

                user_data["liked_products"] = stored_liked
                user_data["disliked_products"] = stored_disliked
                
                logger.info(f"added user preferences: {len(all_allergies)} allergies, {len(stored_liked)} liked products")
                
            except Exception as e:
                logger.warning(f"could not parse user preferences: {e}")

        user_data["username"] = current_user.username
        user_data["user_id"] = current_user.id

        logger.info(" Starting meal plan generation...")
        meal_plan_result = await meal_planner.generate_meal_plan(user_data)

        logger.info(f"meal plan result type: {type(meal_plan_result)}")
        if hasattr(meal_plan_result, '__await__'):
            logger.error("🚨 Result is a coroutine - awaiting again")
            meal_plan_result = await meal_plan_result
        
        logger.info(f"final result type: {type(meal_plan_result)}")
        
        if isinstance(meal_plan_result, dict) and meal_plan_result.get("success"):
            logger.info(f" Meal plan generated successfully for {current_user.username}")
            
            return {
                "success": True,
                "message": f"Meal plan for {request.time_period} days generated successfully",
                "ai_powered": meal_plan_result.get("ai_powered", False),
                "meal_plan": meal_plan_result.get("meal_plan"),
                "user_data": {
                    "diet_type": request.diet_type,
                    "goal": request.goal,
                    "daily_calories": request.daily_calories,
                    "time_period": request.time_period,
                    "allergies_count": len(user_data["allergies"]),
                    "ingredients_count": len(request.available_ingredients)
                },
                "generated_at": meal_plan_result.get("generated_at"),
                "user_id": current_user.id
            }
        else:
            logger.error(" Meal plan generation failed")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate meal plan"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Meal planning error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating meal plan: {str(e)}"
        )

@router.get("/diet-types")
async def get_diet_types():

    return {
        "diet_types": [
            {
                "value": "balanced",
                "name": "Balanced",
                "description": "Balanced nutrition with moderate content of all macronutrients"
            },
            {
                "value": "vegan",
                "name": "Vegan", 
                "description": "Plant-based diet without animal products"
            },
            {
                "value": "vegetarian", 
                "name": "Vegetarian",
                "description": "Diet without meat and fish, but with dairy products and eggs"
            },
            {
                "value": "keto",
                "name": "Ketogenic",
                "description": "Low-carb, high-fat diet"
            },
            {
                "value": "high-protein",
                "name": "High-protein",
                "description": "Diet with increased protein content for muscle building"
            },
            {
                "value": "mediterranean",
                "name": "Mediterranean",
                "description": "Diet rich in vegetables, fruits, fish and olive oil"
            },
            {
                "value": "low-carb",
                "name": "Low-carb",
                "description": "Diet with limited carbohydrate content"
            }
        ]
    }

@router.get("/goals")
async def get_goals():

    return {
        "goals": [
            {
                "value": "weight_loss",
                "name": "Weight Loss",
                "description": "Create calorie deficit for healthy weight loss",
                "calorie_adjustment": -0.2
            },
            {
                "value": "muscle_gain",
                "name": "Muscle Gain",
                "description": "Increase calories and protein for muscle growth",
                "calorie_adjustment": 0.15
            },
            {
                "value": "maintenance",
                "name": "Weight Maintenance",
                "description": "Balanced nutrition to maintain current weight",
                "calorie_adjustment": 0.0
            },
            {
                "value": "endurance",
                "name": "Endurance",
                "description": "Nutrition for endurance athletes",
                "calorie_adjustment": 0.1
            }
        ]
    }

@router.get("/lifestyle-types")
async def get_lifestyle_types():

    return {
        "lifestyle_types": [
            {
                "value": "sedentary",
                "name": "Sedentary",
                "description": "Office work, minimal physical activity",
                "activity_multiplier": 1.2
            },
            {
                "value": "moderate",
                "name": "Moderately Active",
                "description": "Light exercise 1-3 times per week",
                "activity_multiplier": 1.375
            },
            {
                "value": "active",
                "name": "Active",
                "description": "Moderate exercise 3-5 times per week",
                "activity_multiplier": 1.55
            },
            {
                "value": "athlete",
                "name": "Athlete",
                "description": "Intense workouts 6-7 times per week",
                "activity_multiplier": 1.725
            }
        ]
    }

@router.get("/quick-plan")
async def get_quick_meal_plan(
    calories: int = 2000,
    diet_type: str = "balanced",
    days: int = 3,
    current_user: User = Depends(get_current_user)
):

    try:
        logger.info(f"quick meal plan: {days} days, {calories} kcal, {diet_type}")

        quick_request = MealPlanRequest(
            daily_calories=calories,
            diet_type=diet_type,
            time_period=days,
            goal="maintenance",
            lifestyle="moderate"
        )

        user_data = quick_request.model_dump()
        user_data["username"] = current_user.username
        user_data["user_id"] = current_user.id
        
        meal_plan_result = await meal_planner.generate_meal_plan(user_data)
        
        if meal_plan_result.get("success"):
            return {
                "success": True,
                "message": f"Quick meal plan generated for {days} days",
                "meal_plan": meal_plan_result.get("meal_plan"),
                "note": "This is a basic meal plan. Use /generate for personalized planning.",
                "user_id": current_user.id
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate quick meal plan"
            )
            
    except Exception as e:
        logger.error(f"quick meal plan error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating quick meal plan: {str(e)}"
        )

@router.get("/themealdb-test")
async def test_themealdb():

    try:
        from ..services.meal_planner_ai import TheMealDBService

        random_meal = TheMealDBService.get_random_meal()
        categories = TheMealDBService.get_categories()
        chicken_meals = TheMealDBService.search_by_category("Chicken")[:3]
        pasta_search = TheMealDBService.search_meals_by_name("pasta")[:3]
        
        return {
            "success": True,
            "message": "TheMealDB integration test",
            "results": {
                "random_meal": {
                    "name": random_meal.get("strMeal") if random_meal else None,
                    "image": random_meal.get("strMealThumb") if random_meal else None
                },
                "categories_count": len(categories),
                "categories": categories[:10],
                "chicken_meals_count": len(chicken_meals),
                "chicken_meals": [meal.get("strMeal") for meal in chicken_meals],
                "pasta_search_count": len(pasta_search),
                "pasta_meals": [meal.get("strMeal") for meal in pasta_search]
            }
        }
        
    except Exception as e:
        logger.error(f"themealdb test error: {str(e)}")
        return {
            "success": False,
            "message": f"TheMealDB test failed: {str(e)}"
        }