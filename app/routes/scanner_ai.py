
"""AI-focused scanner routes for product detection and recipe generation."""

import uuid
from threading import Lock
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, status
from sqlalchemy.orm import Session
from typing import List, Optional
from PIL import Image
import io
import logging
from datetime import datetime

from ..models.database import get_db
from ..models.user import User
from ..routes.auth import get_current_user
from ..services.vertex_ai_service import VertexAIService
from ..services.advanced_product_scanner import AdvancedProductScanner
from ..services.recipe_generator import RecipeGenerationService
from ..models.scanned_products import ProductScanSession, ScannedProduct, GeneratedRecipe

logger = logging.getLogger(__name__)

# task_id: {"status": str, "result": dict|None, "error": str|None}
SCAN_TASKS = {}
SCAN_TASKS_LOCK = Lock()

router = APIRouter(prefix="/scanner", tags=["scanner"])

# Endpoint for checking async task status
@router.get("/scan-status/{task_id}", summary="Check status of async image analysis")
async def get_scan_status(task_id: str):
    """Check task status and get result if ready."""
    with SCAN_TASKS_LOCK:
        task = SCAN_TASKS.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        # Don't return image_bytes even if present in result
        result = task["result"]
        if result and "image_bytes" in result:
            result = dict(result)
            result.pop("image_bytes")
        return {
            "task_id": task_id,
            "status": task["status"],
            "result": result,
            "error": task["error"]
        }

@router.post("/scan-async", summary="Async image analysis (Vertex AI)")
async def scan_image_async(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    session_name: str = Form(default="Product Scan"),
    analysis_strategy: str = Form(default="adaptive"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Asynchronously analyze image, returns task_id for status polling."""
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    task_id = str(uuid.uuid4())
    with SCAN_TASKS_LOCK:
        SCAN_TASKS[task_id] = {"status": "processing", "result": None, "error": None}

    # Save image to memory (otherwise UploadFile will be closed)
    image_bytes = await image.read()


    def process_scan_task(task_id, image_bytes, session_name, analysis_strategy, user_id):
        """Background task for image analysis via Vertex AI and storing result in SCAN_TASKS."""
        try:
            vertex_service = VertexAIService()
            product_scanner = AdvancedProductScanner(vertex_service)
            pil_image = Image.open(io.BytesIO(image_bytes))
            scan_result = product_scanner.analyze_image_adaptive(pil_image)
            with SCAN_TASKS_LOCK:
                if scan_result.get("success"):
                    SCAN_TASKS[task_id]["status"] = "completed"
                    SCAN_TASKS[task_id]["result"] = scan_result
                else:
                    SCAN_TASKS[task_id]["status"] = "failed"
                    SCAN_TASKS[task_id]["error"] = scan_result.get("error", "Scan failed")
        except Exception as exc:
            with SCAN_TASKS_LOCK:
                SCAN_TASKS[task_id]["status"] = "failed"
                SCAN_TASKS[task_id]["error"] = str(exc)

    background_tasks.add_task(
        process_scan_task, task_id, image_bytes, session_name, analysis_strategy, current_user.id
    )

    return {"task_id": task_id, "status": "processing"}


def _load_image(uploaded_file: UploadFile) -> Image.Image:
    try:
        image_bytes = uploaded_file.file.read()
        image = Image.open(io.BytesIO(image_bytes))
        return image
    finally:
        uploaded_file.file.close()


@router.post("/analyze-advanced")
async def analyze_image_advanced(
    image: UploadFile = File(...),
    session_name: str = Form(default="Product Scan"),
    analysis_strategy: str = Form(default="adaptive"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Scan a product image and store all detected products in a single session list."""
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    vertex_service = VertexAIService()
    product_scanner = AdvancedProductScanner(vertex_service)

    try:
        pil_image = _load_image(image)
        scan_result = product_scanner.analyze_image_adaptive(pil_image)

        if not scan_result.get("success"):
            error_msg = scan_result.get("error", "Scan failed")
            # Rate limit or AI overload → 503 Service Unavailable (client can retry)
            if "overloaded" in error_msg.lower() or "rate" in error_msg.lower() or "429" in error_msg:
                raise HTTPException(
                    status_code=503,
                    detail="AI service is temporarily overloaded. Please wait a moment and try again."
                )
            raise HTTPException(status_code=422, detail=error_msg)

        products = scan_result.get("all_products", [])
        if not products:
            return {
                "session_id": None,
                "products": [],
                "total_products": 0,
                "status": "no_products_found",
            }

        session = ProductScanSession(
            user_id=current_user.id,
            session_name=session_name,
            scan_method=scan_result.get("scan_method", "advanced_ai"),
            total_products=len(products),
            total_weight_grams=scan_result.get("total_weight_grams", 0),
            total_items_count=scan_result.get("total_items_count", 0),
            processing_time_seconds=scan_result.get("processing_time_seconds", 0),
            image_resolution=scan_result.get("image_resolution"),
            strategy_used=scan_result.get("strategy_used"),
        )
        db.add(session)
        db.flush()

        saved_products = []
        for idx, product in enumerate(products):
            scanned = ScannedProduct(
                session_id=session.id,
                name=product.get("name"),
                brand=product.get("brand"),
                weight_grams=product.get("weight_grams", 0),
                quantity=product.get("quantity", 1),
                confidence=product.get("confidence", 0.8),
                tile_index=product.get("tile_index", idx),
                tile_info=product.get("tile_info"),
                detection_method=product.get("detection_method", "advanced_ai"),
            )
            db.add(scanned)
            saved_products.append(
                {
                    "name": scanned.name,
                    "brand": scanned.brand,
                    "weight_grams": scanned.weight_grams,
                    "quantity": scanned.quantity,
                    "confidence": scanned.confidence,
                    "detection_method": scanned.detection_method,
                    "calories_per_100g": product.get("calories_per_100g", 0),
                    "protein_per_100g": product.get("protein_per_100g", 0),
                    "carbs_per_100g": product.get("carbs_per_100g", 0),
                    "fat_per_100g": product.get("fat_per_100g", 0),
                }
            )

        db.commit()
        return {
            "session_id": session.id,
            "products": saved_products,
            "total_products": len(saved_products),
            "strategy_used": scan_result.get("strategy_used"),
            "processing_time_seconds": scan_result.get("processing_time_seconds"),
            "status": "success",
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.error("Scan failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Scan failed: {exc}")


@router.post("/sessions/{session_id}/recipes")
async def generate_recipes(
    session_id: int,
    cuisine_preference: str = Form(default="Any"),
    dietary_restrictions: List[str] = Form(default=[]),
    max_recipes: int = Form(default=3),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vertex_service = VertexAIService()
    recipe_service = RecipeGenerationService(vertex_service)

    recipes = recipe_service.generate_recipes_from_session(
        session_id=session_id,
        db=db,
        user_id=current_user.id,
        cuisine_preference=cuisine_preference,
        dietary_restrictions=dietary_restrictions,
        max_recipes=max_recipes,
    )

    if not recipes:
        raise HTTPException(status_code=404, detail="No recipes generated")

    return {
        "session_id": session_id,
        "recipes": recipes,
        "total_recipes": len(recipes),
        "status": "success",
    }


@router.post("/meal-plans/create",
             summary="Create Meal Plan",
             description="Create a meal plan based on user's saved products and preferences")
async def create_meal_plan(
    days: int = Form(default=3, ge=1, le=7),
    meals_per_day: int = Form(default=3, ge=1, le=5),
    dietary_restrictions: List[str] = Form(default=[]),
    cuisine_preference: str = Form(default="Any"),
    daily_calorie_target: Optional[int] = Form(default=None),
    plan_name: Optional[str] = Form(default=None),
    use_saved_products: bool = Form(default=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from ..models.meal_plan import MealPlan, MealPlanDay, MealPlanMeal
    from ..models.preferences import UserPreferences
    user_prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    
    if user_prefs:
        user_dietary = user_prefs.get_allergies()
        if user_prefs.diet_type:
            user_dietary.append(user_prefs.diet_type)
        dietary_restrictions = list(set(dietary_restrictions + user_dietary))
        
        if not daily_calorie_target:
            daily_calorie_target = user_prefs.caloric_target
    saved_products = []
    if use_saved_products and user_prefs:
        saved_products = user_prefs.get_last_scanned_products() #you need at least 5 products to create a meal plan
    if use_saved_products and len(saved_products) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": f"Not enough products to create a meal plan. You have {len(saved_products)} product(s), but at least 5 are required.",
                "current_count": len(saved_products),
                "minimum_required": 5,
                "suggestion": "Please scan, search, or add more products before creating a meal plan."
            }
        )
    if not plan_name:
        if saved_products:
            plan_name = f"Meal Plan from {len(saved_products)} products - {datetime.now().strftime('%Y-%m-%d')}"
        else:
            plan_name = f"Meal Plan - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    
    vertex_service = VertexAIService()
    recipe_service = RecipeGenerationService(vertex_service)
    meal_types = ["breakfast", "lunch", "dinner", "snack"][:meals_per_day]
    
    # Gather allergies and disliked products for the prompt
    user_allergies = []
    user_disliked = []
    if user_prefs:
        user_allergies = user_prefs.get_allergies()
        user_disliked = user_prefs.get_disliked_products()
    
    if saved_products:
        logger.info(f"Creating meal plan with {len(saved_products)} saved products")
        plan_data = recipe_service.generate_meal_plan_with_products(
            products=saved_products,
            days=days,
            meals=meal_types,
            dietary_restrictions=dietary_restrictions,
            cuisine_preference=cuisine_preference,
            daily_calorie_target=daily_calorie_target,
            allergies=user_allergies,
            disliked_products=user_disliked,
        )
    else:
        logger.info(f"Creating generic meal plan (no saved products)")
        plan_data = recipe_service.generate_generic_meal_plan(
            days=days,
            meals=meal_types,
            dietary_restrictions=dietary_restrictions,
            cuisine_preference=cuisine_preference,
            daily_calorie_target=daily_calorie_target,
            user_preferences=user_prefs,
            allergies=user_allergies,
            disliked_products=user_disliked,
        )
    
    if not plan_data.get("plan"):
        raise HTTPException(status_code=500, detail="Failed to generate meal plan")
    
    meal_plan = MealPlan(
        user_id=current_user.id,
        scan_session_id=None, 
        plan_name=plan_name,
        total_days=days,
        meals_per_day=meals_per_day,
        daily_calorie_target=daily_calorie_target or 2000,
        dietary_restrictions=dietary_restrictions,
        cuisine_preference=cuisine_preference,
        is_active=True
    )
    db.add(meal_plan)
    db.flush()
    meals_by_day = {}
    for meal_item in plan_data.get("plan", []):
        day_num = meal_item.get("day", 1) - 1
        if day_num not in meals_by_day:
            meals_by_day[day_num] = []
        meals_by_day[day_num].append(meal_item)
    for day_num in sorted(meals_by_day.keys()):
        day_meals = meals_by_day[day_num]
        
        meal_plan_day = MealPlanDay(
            meal_plan_id=meal_plan.id,
            day_number=day_num + 1,
            day_name=f"Day {day_num + 1}",
            total_calories=0.0,
            total_protein=0.0,
            total_carbs=0.0,
            total_fat=0.0
        )
        db.add(meal_plan_day)
        db.flush()
        
        day_totals = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0}
        
        for idx, meal_item in enumerate(day_meals):
            nutrition = meal_item.get("nutrition", {})
            
            meal_plan_meal = MealPlanMeal(
                meal_plan_day_id=meal_plan_day.id,
                meal_type=meal_item.get("meal_type", "meal"),
                meal_name=meal_item.get("name", "Unknown Meal"),
                meal_order=idx,
                calories=nutrition.get("calories", 0.0),
                protein=nutrition.get("protein", 0.0),
                carbs=nutrition.get("carbs", 0.0),
                fat=nutrition.get("fat", 0.0),
                serving_size_multiplier=1.0,
                completed=False,
                custom_ingredients=meal_item.get("ingredients"),
                custom_instructions=meal_item.get("instructions"),
                source_url=meal_item.get("source_url"),
                prep_time=meal_item.get("prep_time"),
                cook_time=meal_item.get("cook_time"),
            )
            db.add(meal_plan_meal)
            
            day_totals["calories"] += meal_plan_meal.calories
            day_totals["protein"] += meal_plan_meal.protein
            day_totals["carbs"] += meal_plan_meal.carbs
            day_totals["fat"] += meal_plan_meal.fat
        meal_plan_day.total_calories = day_totals["calories"]
        meal_plan_day.total_protein = day_totals["protein"]
        meal_plan_day.total_carbs = day_totals["carbs"]
        meal_plan_day.total_fat = day_totals["fat"]
    
    db.commit()
    db.refresh(meal_plan)
    if saved_products and user_prefs:
        logger.info(f"🧹 Clearing {len(saved_products)} saved products after meal plan creation")
        user_prefs.set_last_scanned_products([])
        db.commit()
    
    return {
        "success": True,
        "message": "Meal plan created successfully",
        "meal_plan_id": meal_plan.id,
        "plan_name": meal_plan.plan_name,
        "total_days": meal_plan.total_days,
        "meals_per_day": meal_plan.meals_per_day,
        "products_used": len(saved_products) if saved_products else 0,
        "products_cleared": len(saved_products) if saved_products else 0,
        "meal_plan": meal_plan.to_dict()
    }



@router.get("/my-recipes")
async def get_my_recipes(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    recipes = (
        db.query(GeneratedRecipe)
        .filter(GeneratedRecipe.user_id == current_user.id)
        .order_by(GeneratedRecipe.created_at.desc())
        .limit(limit)
        .all()
    )

    return [recipe.to_dict() for recipe in recipes]



@router.get("/my-sessions")
async def get_my_sessions(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(ProductScanSession)
        .filter(ProductScanSession.user_id == current_user.id)
        .order_by(ProductScanSession.created_at.desc())
        .limit(limit)
        .all()
    )

    return {
        "success": True,
        "count": len(sessions),
        "sessions": [
            {
                "id": session.id,
                "session_name": session.session_name,
                "scan_method": session.scan_method,
                "total_products": session.total_products,
                "created_at": session.created_at.isoformat() if session.created_at else None,
                "is_active": session.is_active
            }
            for session in sessions
        ]
    }



@router.get("/sessions/{session_id}/products")
async def get_session_products(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ProductScanSession)
        .filter(
            ProductScanSession.id == session_id,
            ProductScanSession.user_id == current_user.id,
        )
        .first()
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    products = (
        db.query(ScannedProduct)
        .filter(ScannedProduct.session_id == session_id)
        .all()
    )

    return {
        "session_id": session_id,
        "session_name": session.session_name,
        "products": [product.to_dict() for product in products],
        "total_products": len(products),
    }


# -------------------
# MEAL PLAN MANAGEMENT ENDPOINTS
# -------------------

@router.get("/meal-plans/my",
            summary="Get My Meal Plans",
            description="Get all meal plans for the current user")
async def get_my_meal_plans(
    limit: int = 20,
    active_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from ..models.meal_plan import MealPlan
    
    query = db.query(MealPlan).filter(MealPlan.user_id == current_user.id)
    
    if active_only:
        query = query.filter(MealPlan.is_active == True)
    
    meal_plans = query.order_by(MealPlan.created_at.desc()).limit(limit).all()
    
    return {
        "success": True,
        "count": len(meal_plans),
        "meal_plans": [plan.to_dict() for plan in meal_plans]
    }




@router.get("/meal-plans/{meal_plan_id}",
            summary="Get Meal Plan Details",
            description="Get full details of a specific meal plan including all days and meals")
async def get_meal_plan_details(
    meal_plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from ..models.meal_plan import MealPlan
    
    meal_plan = db.query(MealPlan).filter(
        MealPlan.id == meal_plan_id,
        MealPlan.user_id == current_user.id
    ).first()
    
    if not meal_plan:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    
    return {
        "success": True,
        "meal_plan": meal_plan.to_dict()
    }




@router.put("/meal-plans/{meal_plan_id}",
            summary="Update Meal Plan",
            description="Update meal plan details (name, status, etc.)")
async def update_meal_plan(
    meal_plan_id: int,
    plan_name: str = Form(None),
    is_active: bool = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from ..models.meal_plan import MealPlan
    
    meal_plan = db.query(MealPlan).filter(
        MealPlan.id == meal_plan_id,
        MealPlan.user_id == current_user.id
    ).first()
    
    if not meal_plan:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    
    if plan_name is not None:
        meal_plan.plan_name = plan_name
    if is_active is not None:
        meal_plan.is_active = is_active
    
    meal_plan.updated_at = datetime.now()
    db.commit()
    db.refresh(meal_plan)
    
    return {
        "success": True,
        "meal_plan": meal_plan.to_dict()
    }




@router.delete("/meal-plans/{meal_plan_id}",
               summary="Delete Meal Plan",
               description="Delete a meal plan")
async def delete_meal_plan(
    meal_plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from ..models.meal_plan import MealPlan
    
    meal_plan = db.query(MealPlan).filter(
        MealPlan.id == meal_plan_id,
        MealPlan.user_id == current_user.id
    ).first()
    
    if not meal_plan:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    
    db.delete(meal_plan)
    db.commit()
    
    return {
        "success": True,
        "message": f"Meal plan {meal_plan_id} deleted"
    }




@router.post("/meal-plans/{meal_plan_id}/meals/{meal_id}/complete",
             summary="Mark Meal as Completed",
             description="Mark a meal in a meal plan as completed")
async def complete_meal(
    meal_plan_id: int,
    meal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a meal as completed."""
    from ..models.meal_plan import MealPlan, MealPlanMeal
    
    # Verify meal plan belongs to user
    meal_plan = db.query(MealPlan).filter(
        MealPlan.id == meal_plan_id,
        MealPlan.user_id == current_user.id
    ).first()
    
    if not meal_plan:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    
    # Get the meal
    meal = db.query(MealPlanMeal).filter(MealPlanMeal.id == meal_id).first()
    
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    # Mark as completed
    meal.completed = True
    meal.completed_at = datetime.now()
    db.commit()
    
    return {
        "success": True,
        "meal": meal.to_dict()
    }




@router.delete("/meal-plans/{meal_plan_id}/meals/{meal_id}",
               summary="Delete Meal from Plan",
               description="Delete a specific meal from a meal plan")
async def delete_meal_from_plan(
    meal_plan_id: int,
    meal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from ..models.meal_plan import MealPlan, MealPlanMeal, MealPlanDay
    
    meal_plan = db.query(MealPlan).filter(
        MealPlan.id == meal_plan_id,
        MealPlan.user_id == current_user.id
    ).first()
    if not meal_plan:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    meal = db.query(MealPlanMeal).filter(MealPlanMeal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    day_id = meal.meal_plan_day_id
    meal_name = meal.meal_name
    meal_type = meal.meal_type
    db.delete(meal)
    db.commit()
    day = db.query(MealPlanDay).filter(MealPlanDay.id == day_id).first()
    if day:
        remaining_meals = db.query(MealPlanMeal).filter(
            MealPlanMeal.meal_plan_day_id == day_id
        ).all()
        day.total_calories = sum(m.calories for m in remaining_meals)
        day.total_protein = sum(m.protein for m in remaining_meals)
        day.total_carbs = sum(m.carbs for m in remaining_meals)
        day.total_fat = sum(m.fat for m in remaining_meals)
        db.commit()
    
    return {
        "success": True,
        "message": f"Meal '{meal_name}' ({meal_type}) deleted from meal plan",
        "meal_id": meal_id,
        "day_totals": {
            "calories": day.total_calories if day else 0,
            "protein": day.total_protein if day else 0,
            "carbs": day.total_carbs if day else 0,
            "fat": day.total_fat if day else 0
        }
    }
