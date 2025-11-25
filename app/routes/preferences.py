

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from ..models.database import get_db
from ..models.user import User
from ..models.preferences import (
    UserPreferences, 
    PreferencesCreate, 
    PreferencesUpdate, 
    PreferencesResponse,
    DIET_TYPES,
    GOAL_TYPES
)
from ..routes.auth import get_current_user

router = APIRouter(
    prefix="/preferences",
    tags=["preferences"]
)

@router.get("/me", response_model=PreferencesResponse)
def get_my_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    preferences = db.query(UserPreferences).filter(
        UserPreferences.user_id == current_user.id
    ).first()
    
    if not preferences:

        preferences = UserPreferences(
            user_id=current_user.id,
            liked_products="[]",
            disliked_products="[]",
            allergies="[]",
            last_scanned_products="[]"
        )
        db.add(preferences)
        db.commit()
        db.refresh(preferences)
    
    return PreferencesResponse.from_orm(preferences)

@router.post("/me", response_model=PreferencesResponse)
def create_my_preferences(
    preferences_data: PreferencesCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    existing_preferences = db.query(UserPreferences).filter(
        UserPreferences.user_id == current_user.id
    ).first()
    
    if existing_preferences:

        for field, value in preferences_data.dict(exclude_unset=True).items():
            if field in ['liked_products', 'disliked_products', 'allergies']:

                if field == 'liked_products':
                    existing_preferences.set_liked_products(value)
                elif field == 'disliked_products':
                    existing_preferences.set_disliked_products(value)
                elif field == 'allergies':
                    existing_preferences.set_allergies(value)
            else:
                setattr(existing_preferences, field, value)
        
        db.commit()
        db.refresh(existing_preferences)
        return PreferencesResponse.from_orm(existing_preferences)

    preferences = UserPreferences(
        user_id=current_user.id,
        diet_type=preferences_data.diet_type,
        goals=preferences_data.goals,
        caloric_target=preferences_data.caloric_target
    )

    preferences.set_liked_products(preferences_data.liked_products or [])
    preferences.set_disliked_products(preferences_data.disliked_products or [])
    preferences.set_allergies(preferences_data.allergies or [])
    preferences.set_last_scanned_products([])
    
    db.add(preferences)
    db.commit()
    db.refresh(preferences)
    
    return PreferencesResponse.from_orm(preferences)

@router.put("/me", response_model=PreferencesResponse)
def update_my_preferences(
    preferences_data: PreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    preferences = db.query(UserPreferences).filter(
        UserPreferences.user_id == current_user.id
    ).first()
    
    if not preferences:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preferences not found. Create them first."
        )

    for field, value in preferences_data.dict(exclude_unset=True).items():
        if value is not None:
            if field in ['liked_products', 'disliked_products', 'allergies']:

                if field == 'liked_products':
                    preferences.set_liked_products(value)
                elif field == 'disliked_products':
                    preferences.set_disliked_products(value)
                elif field == 'allergies':
                    preferences.set_allergies(value)
            else:
                setattr(preferences, field, value)
    
    db.commit()
    db.refresh(preferences)
    
    return PreferencesResponse.from_orm(preferences)

@router.post("/me/add-liked-product")
def add_liked_product(
    product: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    preferences = db.query(UserPreferences).filter(
        UserPreferences.user_id == current_user.id
    ).first()
    
    if not preferences:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preferences not found"
        )
    
    liked_products = preferences.get_liked_products()
    if product not in liked_products:
        liked_products.append(product)
        preferences.set_liked_products(liked_products)

        disliked_products = preferences.get_disliked_products()
        if product in disliked_products:
            disliked_products.remove(product)
            preferences.set_disliked_products(disliked_products)
        
        db.commit()
        
    return {"message": f"Product '{product}' added to favorites"}

@router.post("/me/add-disliked-product")
def add_disliked_product(
    product: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    preferences = db.query(UserPreferences).filter(
        UserPreferences.user_id == current_user.id
    ).first()
    
    if not preferences:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preferences not found"
        )
    
    disliked_products = preferences.get_disliked_products()
    if product not in disliked_products:
        disliked_products.append(product)
        preferences.set_disliked_products(disliked_products)

        liked_products = preferences.get_liked_products()
        if product in liked_products:
            liked_products.remove(product)
            preferences.set_liked_products(liked_products)
        
        db.commit()
        
    return {"message": f"Product '{product}' added to disliked"}

@router.post("/me/add-scanned-product")
def add_scanned_product(
    product: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    preferences = db.query(UserPreferences).filter(
        UserPreferences.user_id == current_user.id
    ).first()
    
    if not preferences:

        preferences = UserPreferences(
            user_id=current_user.id,
            liked_products="[]",
            disliked_products="[]",
            allergies="[]",
            last_scanned_products="[]"
        )
        db.add(preferences)
        db.commit()
        db.refresh(preferences)
    
    preferences.add_scanned_product(product)
    db.commit()
    
    return {"message": f"Product '{product}' added to scan history"}

@router.delete("/me")
def delete_my_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    preferences = db.query(UserPreferences).filter(
        UserPreferences.user_id == current_user.id
    ).first()
    
    if preferences:
        db.delete(preferences)
        db.commit()
        return {"message": "Preferences deleted"}
    
    return {"message": "Preferences not found"}

@router.get("/available-options")
def get_available_options():

    return {
        "diet_types": DIET_TYPES,
        "goal_types": GOAL_TYPES,
        "supported_products": [
            "apple", "bread", "milk", "pasta", "rice", "banana", 
            "orange", "chicken", "beef", "fish", "cheese", "yogurt",
            "tomato", "potato", "carrot", "broccoli", "pizza", "burger"
        ],
        "common_allergies": [
            "nuts", "dairy", "gluten", "eggs", "soy", "fish", "shellfish", 
            "sesame", "mustard", "celery", "lupin", "sulphites"
        ],
        "caloric_ranges": {
            "min": 800,
            "max": 5000,
            "recommended_female": "1200-2000",
            "recommended_male": "1500-2500"
        }
    }

@router.get("/stats")
def get_preference_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    preferences = db.query(UserPreferences).filter(
        UserPreferences.user_id == current_user.id
    ).first()
    
    if not preferences:
        return {
            "message": "Preferences not configured",
            "stats": {
                "liked_products_count": 0,
                "disliked_products_count": 0,
                "allergies_count": 0,
                "scan_history_count": 0
            }
        }
    
    return {
        "stats": {
            "liked_products_count": len(preferences.get_liked_products()),
            "disliked_products_count": len(preferences.get_disliked_products()),
            "allergies_count": len(preferences.get_allergies()),
            "scan_history_count": len(preferences.get_last_scanned_products()),
            "diet_type": preferences.diet_type,
            "goals": preferences.goals,
            "caloric_target": preferences.caloric_target
        }
    }