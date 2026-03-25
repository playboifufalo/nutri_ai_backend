#HERE WE just work with each user's lifestyle types and preferenes (dbs and lots of classes)

from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from .database import Base
LIFESTYLE_CATEGORIES = ["activity", "schedule", "social", "health"]
ALL_LIFESTYLE_TYPES = ["sedentary", "lightly-active"]
class LifestyleType(Base):
    __tablename__ = "lifestyle_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    category = Column(String(50), nullable=False, index=True)
    description = Column(Text)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    user_preferences = relationship("UserLifestylePreference", back_populates="lifestyle_type")

class UserLifestylePreference(Base):
    __tablename__ = "user_lifestyle_preferences"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    lifestyle_type_id = Column(Integer, ForeignKey("lifestyle_types.id"), nullable=False, index=True)
    priority = Column(Integer, default=1, nullable=False, index=True)
    intensity = Column(Integer, default=5, nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    lifestyle_type = relationship("LifestyleType", back_populates="user_preferences")
    user = relationship("User", back_populates="lifestyle_preferences")

# Pydantic Models
class LifestyleTypeResponse(BaseModel):
    id: int
    name: str
    category: str
    description: Optional[str] = None
    is_active: bool
    class Config:
        from_attributes = True

class UserLifestylePreferenceCreate(BaseModel):
    lifestyle_type_id: int
    priority: int = 1
    intensity: int = 5
    notes: Optional[str] = None

class UserLifestylePreferenceUpdate(BaseModel):
    priority: Optional[int] = None
    intensity: Optional[int] = None
    notes: Optional[str] = None

class UserLifestylePreferenceResponse(BaseModel):
    id: int
    user_id: int
    lifestyle_type_id: int
    lifestyle_type: LifestyleTypeResponse
    priority: int
    intensity: int
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class LifestyleProfileResponse(BaseModel):
    user_id: int
    total_preferences: int
    preferences_by_category: dict
    top_priorities: List[UserLifestylePreferenceResponse]
    
    @classmethod
    def from_preferences(cls, user_id: int, preferences: List[UserLifestylePreferenceResponse]):
        preferences_by_category = {}
        for pref in preferences:
            category = pref.lifestyle_type.category
            if category not in preferences_by_category:
                preferences_by_category[category] = []
            preferences_by_category[category].append(pref)
        top_priorities = sorted(preferences, key=lambda x: x.priority)[:5]
        return cls(
            user_id=user_id,
            total_preferences=len(preferences),
            preferences_by_category=preferences_by_category,
            top_priorities=top_priorities
        )