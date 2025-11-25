

from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base

class FoodItem(Base):
    __tablename__ = "food_items"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    category = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    

    calories_per_100g = Column(Float, nullable=True)
    protein_per_100g = Column(Float, nullable=True) 
    carbs_per_100g = Column(Float, nullable=True)
    fat_per_100g = Column(Float, nullable=True)
    fiber_per_100g = Column(Float, nullable=True)
    sugar_per_100g = Column(Float, nullable=True)
    sodium_per_100g = Column(Float, nullable=True)
    

    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    
    scan_results = relationship("ScanResult", back_populates="food_item")
    
    def __repr__(self):
        return f"<FoodItem(id={self.id}, name='{self.name}', category='{self.category}')>"

class ScanResult(Base):
    __tablename__ = "scan_results"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    food_item_id = Column(Integer, ForeignKey("food_items.id"), nullable=True)
    
    #scanning details
    image_path = Column(String(500), nullable=True)
    confidence_score = Column(Float, nullable=True)
    detected_food_name = Column(String(200), nullable=True)
    estimated_weight_grams = Column(Float, nullable=True)
    
    ai_description = Column(Text, nullable=True)
    ai_nutrition_advice = Column(Text, nullable=True)
    ai_health_score = Column(Float, nullable=True)  # 0-100 scale
    calories = Column(Float, nullable=True)
    protein = Column(Float, nullable=True)
    carbs = Column(Float, nullable=True)
    fat = Column(Float, nullable=True)
    fiber = Column(Float, nullable=True)
    
    #meta fields
    scan_timestamp = Column(DateTime, server_default=func.now())
    is_favorite = Column(Boolean, default=False)
    #connections w db
    user = relationship("User", back_populates="scan_results")
    food_item = relationship("FoodItem", back_populates="scan_results")
    
    def __repr__(self):
        return f"<ScanResult(id={self.id}, user_id={self.user_id}, food='{self.detected_food_name}')>"

class NutritionGoal(Base):
    __tablename__ = "nutrition_goals"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    daily_calories_goal = Column(Float, nullable=True)
    daily_protein_goal = Column(Float, nullable=True)   #daily user goals
    daily_carbs_goal = Column(Float, nullable=True)
    daily_fat_goal = Column(Float, nullable=True)
    daily_fiber_goal = Column(Float, nullable=True)

    #user preferences
    diet_type = Column(String(50), nullable=True) 
    allergies = Column(Text, nullable=True) 
    health_conditions = Column(Text, nullable=True)
    #meta fields
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    is_active = Column(Boolean, default=True)
    

    #db connections
    user = relationship("User", back_populates="nutrition_goals")
    
    def __repr__(self):
        return f"<NutritionGoal(id={self.id}, user_id={self.user_id}, calories={self.daily_calories_goal})>"