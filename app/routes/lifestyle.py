

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from ..models.database import get_db
from ..models.user import User
from ..models.lifestyle import (
    LifestyleType, 
    UserLifestylePreference,
    LifestyleTypeResponse,
    UserLifestylePreferenceCreate,
    UserLifestylePreferenceUpdate,
    UserLifestylePreferenceResponse,
    LifestyleProfileResponse,
    LIFESTYLE_CATEGORIES,
    ALL_LIFESTYLE_TYPES
)
from ..routes.auth import get_current_user

router = APIRouter(
    prefix="/lifestyle",
    tags=["lifestyle"]
)

@router.get("/types", response_model=List[LifestyleTypeResponse])
def get_lifestyle_types(
    category: Optional[str] = Query(None, description="Filter by category: activity, schedule, social, health"),
    db: Session = Depends(get_db)
):

    query = db.query(LifestyleType).filter(LifestyleType.is_active == True)
    
    if category:
        if category not in LIFESTYLE_CATEGORIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid category. Must be one of: {', '.join(LIFESTYLE_CATEGORIES)}"
            )
        query = query.filter(LifestyleType.category == category)
    
    return query.order_by(LifestyleType.category, LifestyleType.name).all()

@router.get("/categories")
def get_lifestyle_categories():

    return {
        "categories": LIFESTYLE_CATEGORIES,
        "types_by_category": {
            "activity": ["sedentary", "lightly-active", "moderately-active", "very-active", "extremely-active"],
            "schedule": ["early-bird", "night-owl", "regular-schedule", "irregular-schedule"],
            "social": ["family-oriented", "social-eater", "solo-eater", "meal-prepper"],
            "health": ["weight-management", "muscle-building", "endurance-training", "recovery-focused", "stress-management"]
        }
    }

@router.get("/me/profile", response_model=LifestyleProfileResponse)
def get_my_lifestyle_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    preferences = db.query(UserLifestylePreference)\
        .options(joinedload(UserLifestylePreference.lifestyle_type))\
        .filter(UserLifestylePreference.user_id == current_user.id)\
        .order_by(UserLifestylePreference.priority)\
        .all()
    preference_responses = [
        UserLifestylePreferenceResponse.model_validate(pref) for pref in preferences
    ]
    
    return LifestyleProfileResponse.from_preferences(current_user.id, preference_responses)

@router.get("/me", response_model=List[UserLifestylePreferenceResponse])
def get_my_lifestyle_preferences(
    category: Optional[str] = Query(None, description="Filter by category"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    query = db.query(UserLifestylePreference)\
        .options(joinedload(UserLifestylePreference.lifestyle_type))\
        .filter(UserLifestylePreference.user_id == current_user.id)
    
    if category:
        if category not in LIFESTYLE_CATEGORIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid category. Must be one of: {', '.join(LIFESTYLE_CATEGORIES)}"
            )
        query = query.join(LifestyleType).filter(LifestyleType.category == category)
    
    preferences = query.order_by(UserLifestylePreference.priority).all()
    
    return [UserLifestylePreferenceResponse.model_validate(pref) for pref in preferences]

@router.post("/me", response_model=UserLifestylePreferenceResponse)
def add_lifestyle_preference(
    preference_data: UserLifestylePreferenceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    lifestyle_type = db.query(LifestyleType).filter(
        LifestyleType.id == preference_data.lifestyle_type_id,
        LifestyleType.is_active == True
    ).first()
    
    if not lifestyle_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lifestyle type not found"
        )

    existing = db.query(UserLifestylePreference).filter(
        UserLifestylePreference.user_id == current_user.id,
        UserLifestylePreference.lifestyle_type_id == preference_data.lifestyle_type_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have this lifestyle preference. Use PUT to update it."
        )

    preference = UserLifestylePreference(
        user_id=current_user.id,
        lifestyle_type_id=preference_data.lifestyle_type_id,
        priority=preference_data.priority,
        intensity=preference_data.intensity,
        notes=preference_data.notes
    )
    
    db.add(preference)
    db.commit()
    db.refresh(preference)

    preference = db.query(UserLifestylePreference)\
        .options(joinedload(UserLifestylePreference.lifestyle_type))\
        .filter(UserLifestylePreference.id == preference.id)\
        .first()
    
    return UserLifestylePreferenceResponse.model_validate(preference)

@router.put("/me/{lifestyle_type_id}", response_model=UserLifestylePreferenceResponse)
def update_lifestyle_preference(
    lifestyle_type_id: int,
    preference_data: UserLifestylePreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    preference = db.query(UserLifestylePreference)\
        .options(joinedload(UserLifestylePreference.lifestyle_type))\
        .filter(
            UserLifestylePreference.user_id == current_user.id,
            UserLifestylePreference.lifestyle_type_id == lifestyle_type_id
        ).first()
    
    if not preference:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lifestyle preference not found"
        )

    for field, value in preference_data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(preference, field, value)
    
    db.commit()
    db.refresh(preference)
    
    return UserLifestylePreferenceResponse.model_validate(preference)

@router.delete("/me/{lifestyle_type_id}")
def remove_lifestyle_preference(
    lifestyle_type_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    preference = db.query(UserLifestylePreference).filter(
        UserLifestylePreference.user_id == current_user.id,
        UserLifestylePreference.lifestyle_type_id == lifestyle_type_id
    ).first()
    
    if not preference:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lifestyle preference not found"
        )
    
    db.delete(preference)
    db.commit()
    
    return {"message": "Lifestyle preference removed successfully"}

@router.get("/me/recommendations", response_model=List[LifestyleTypeResponse])
def get_lifestyle_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    user_preferences = db.query(UserLifestylePreference).filter(
        UserLifestylePreference.user_id == current_user.id
    ).all()

    from ..models.preferences import UserPreferences
    diet_prefs = db.query(UserPreferences).filter(
        UserPreferences.user_id == current_user.id
    ).first()

    existing_type_ids = [pref.lifestyle_type_id for pref in user_preferences]
    
    recommendations_query = db.query(LifestyleType).filter(
        LifestyleType.is_active == True,
        ~LifestyleType.id.in_(existing_type_ids)
    )

    if diet_prefs and diet_prefs.goals:
        if diet_prefs.goals == "lose weight":
            recommendations_query = recommendations_query.filter(
                LifestyleType.name.in_([
                    'moderately-active', 'weight-management', 'meal-prepper', 'regular-schedule'
                ])
            )
        elif diet_prefs.goals == "gain weight":
            recommendations_query = recommendations_query.filter(
                LifestyleType.name.in_([
                    'very-active', 'muscle-building', 'family-oriented', 'early-bird'
                ])
            )
        elif diet_prefs.goals == "maintain weight":
            recommendations_query = recommendations_query.filter(
                LifestyleType.name.in_([
                    'lightly-active', 'regular-schedule', 'weight-management'
                ])
            )
    
    recommendations = recommendations_query.order_by(LifestyleType.category, LifestyleType.name).limit(6).all()
    
    return [LifestyleTypeResponse.model_validate(rec) for rec in recommendations]

@router.get("/compatibility/{user_id}")
def get_lifestyle_compatibility(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot compare with yourself"
        )

    target_user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    current_prefs = db.query(UserLifestylePreference)\
        .options(joinedload(UserLifestylePreference.lifestyle_type))\
        .filter(UserLifestylePreference.user_id == current_user.id)\
        .all()
    
    target_prefs = db.query(UserLifestylePreference)\
        .options(joinedload(UserLifestylePreference.lifestyle_type))\
        .filter(UserLifestylePreference.user_id == user_id)\
        .all()

    current_dict = {pref.lifestyle_type_id: pref for pref in current_prefs}
    target_dict = {pref.lifestyle_type_id: pref for pref in target_prefs}

    common_types = set(current_dict.keys()) & set(target_dict.keys())
    
    if not common_types:
        return {
            "compatibility_score": 0.0,
            "common_lifestyles": 0,
            "total_compared": 0,
            "details": "No common lifestyle preferences found"
        }

    compatible_count = 0
    total_intensity_diff = 0
    
    for type_id in common_types:
        current_intensity = current_dict[type_id].intensity
        target_intensity = target_dict[type_id].intensity
        intensity_diff = abs(current_intensity - target_intensity)
        total_intensity_diff += intensity_diff

        if intensity_diff <= 2:
            compatible_count += 1
    
    compatibility_score = (compatible_count / len(common_types)) * 100 if common_types else 0
    avg_intensity_diff = total_intensity_diff / len(common_types) if common_types else 0
    
    return {
        "compatibility_score": round(compatibility_score, 1),
        "common_lifestyles": len(common_types),
        "total_compared": len(common_types),
        "compatible_count": compatible_count,
        "avg_intensity_difference": round(avg_intensity_diff, 1),
        "target_user": {
            "id": target_user.id,
            "username": target_user.username
        }
    }