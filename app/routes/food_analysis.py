

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import uuid
from pathlib import Path
import shutil

from ..models.database import get_db
from ..models.user import User
from ..models.food import FoodItem, ScanResult, NutritionGoal
from ..routes.auth import get_current_user
from ..services.ai_analyzer import ai_analyzer
from pydantic import BaseModel

router = APIRouter(
    prefix="/food",
    tags=["food_analysis"]
)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

class ScanResponse(BaseModel):
    id: int
    detected_food_name: str
    confidence_score: float
    estimated_weight_grams: float
    calories: Optional[float]
    protein: Optional[float]
    carbs: Optional[float]
    fat: Optional[float]
    fiber: Optional[float]
    ai_description: Optional[str]
    ai_nutrition_advice: Optional[str]
    ai_health_score: Optional[float]
    
    class Config:
        from_attributes = True

class FoodItemResponse(BaseModel):
    id: int
    name: str
    category: Optional[str]
    calories_per_100g: Optional[float]
    protein_per_100g: Optional[float]
    carbs_per_100g: Optional[float]
    fat_per_100g: Optional[float]
    
    class Config:
        from_attributes = True

class NutritionGoalCreate(BaseModel):
    daily_calories_goal: Optional[float] = None
    daily_protein_goal: Optional[float] = None
    daily_carbs_goal: Optional[float] = None
    daily_fat_goal: Optional[float] = None
    diet_type: Optional[str] = None
    allergies: Optional[str] = None

@router.post("/scan", response_model=ScanResponse)
async def scan_food(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )

    file_extension = file.filename.split(".")[-1] if file.filename else "jpg"
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = UPLOAD_DIR / unique_filename
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        analysis_result = ai_analyzer.analyze_food_image(str(file_path))

        nutrition_data = ai_analyzer.get_nutrition_data(
            analysis_result["food_name"],
            analysis_result["estimated_weight_grams"]
        )

        user_goals = db.query(NutritionGoal).filter(
            NutritionGoal.user_id == current_user.id,
            NutritionGoal.is_active == True
        ).first()
        
        goals_dict = None
        if user_goals:
            goals_dict = {
                "daily_calories": user_goals.daily_calories_goal,
                "daily_protein": user_goals.daily_protein_goal,
                "diet_type": user_goals.diet_type
            }

        nutrition_advice = ai_analyzer.generate_nutrition_advice(
            analysis_result["food_name"],
            nutrition_data,
            goals_dict
        )

        health_score = ai_analyzer.calculate_health_score(nutrition_data)

        food_item = db.query(FoodItem).filter(
            FoodItem.name.ilike(f"%{analysis_result['food_name']}%")
        ).first()

        scan_result = ScanResult(
            user_id=current_user.id,
            food_item_id=food_item.id if food_item else None,
            image_path=str(file_path),
            confidence_score=analysis_result["confidence_score"],
            detected_food_name=analysis_result["food_name"],
            estimated_weight_grams=analysis_result["estimated_weight_grams"],
            ai_description=analysis_result.get("description"),
            ai_nutrition_advice=nutrition_advice,
            ai_health_score=health_score,
            calories=nutrition_data["calories"],
            protein=nutrition_data["protein"],
            carbs=nutrition_data["carbs"],
            fat=nutrition_data["fat"],
            fiber=nutrition_data["fiber"]
        )
        
        db.add(scan_result)
        db.commit()
        db.refresh(scan_result)
        
        return scan_result
        
    except Exception as e:

        if file_path.exists():
            file_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing image: {str(e)}"
        )

@router.get("/scan-history", response_model=List[ScanResponse])
def get_scan_history(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    scans = db.query(ScanResult).filter(
        ScanResult.user_id == current_user.id
    ).order_by(ScanResult.scan_timestamp.desc()).offset(skip).limit(limit).all()
    
    return scans

@router.get("/scan/{scan_id}", response_model=ScanResponse)
def get_scan_result(
    scan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    scan = db.query(ScanResult).filter(
        ScanResult.id == scan_id,
        ScanResult.user_id == current_user.id
    ).first()
    
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan result not found"
        )
    
    return scan

@router.post("/scan/{scan_id}/favorite")
def toggle_favorite(
    scan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    scan = db.query(ScanResult).filter(
        ScanResult.id == scan_id,
        ScanResult.user_id == current_user.id
    ).first()
    
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan result not found"
        )
    
    scan.is_favorite = not scan.is_favorite
    db.commit()
    
    return {"message": f"Scan {'added to' if scan.is_favorite else 'removed from'} favorites"}

@router.get("/foods", response_model=List[FoodItemResponse])
def search_foods(
    q: str = "",
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):

    query = db.query(FoodItem)
    
    if q:
        query = query.filter(FoodItem.name.ilike(f"%{q}%"))
    
    foods = query.offset(skip).limit(limit).all()
    return foods

@router.post("/nutrition-goals")
def set_nutrition_goals(
    goals: NutritionGoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    db.query(NutritionGoal).filter(
        NutritionGoal.user_id == current_user.id
    ).update({"is_active": False})

    new_goals = NutritionGoal(
        user_id=current_user.id,
        **goals.dict()
    )
    
    db.add(new_goals)
    db.commit()
    db.refresh(new_goals)
    
    return {"message": "Nutrition goals updated successfully"}

@router.get("/nutrition-goals")
def get_nutrition_goals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    goals = db.query(NutritionGoal).filter(
        NutritionGoal.user_id == current_user.id,
        NutritionGoal.is_active == True
    ).first()
    
    if not goals:
        return {"message": "no nutrition goals yet were set"}
    
    return goals

@router.get("/ai-advice")
def get_ai_nutrition_advice(
    food_name: str,
    weight_grams: float = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    nutrition_data = ai_analyzer.get_nutrition_data(food_name, weight_grams)

    user_goals = db.query(NutritionGoal).filter(
        NutritionGoal.user_id == current_user.id,
        NutritionGoal.is_active == True
    ).first()
    
    goals_dict = None
    if user_goals:
        goals_dict = {
            "daily_calories": user_goals.daily_calories_goal,
            "daily_protein": user_goals.daily_protein_goal,
            "diet_type": user_goals.diet_type
        }

    advice = ai_analyzer.generate_nutrition_advice(food_name, nutrition_data, goals_dict)
    health_score = ai_analyzer.calculate_health_score(nutrition_data)
    
    return {
        "food_name": food_name,
        "weight_grams": weight_grams,
        "nutrition": nutrition_data,
        "ai_advice": advice,
        "health_score": health_score
    }
