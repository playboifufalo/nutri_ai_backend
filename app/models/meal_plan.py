from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class MealPlan(Base):
    __tablename__ = "meal_plans"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    scan_session_id = Column(Integer, ForeignKey("product_scan_sessions.id"), nullable=True)
    #plan metadata
    plan_name = Column(String, default="My Meal Plan")
    total_days = Column(Integer, default=1)
    meals_per_day = Column(Integer, default=3)  #breakfast, lunch, dinner
    #nutritional goals
    daily_calorie_target = Column(Integer, nullable=True)
    daily_protein_target = Column(Float, nullable=True)
    daily_carbs_target = Column(Float, nullable=True)
    daily_fat_target = Column(Float, nullable=True)
    
    #dietary info
    dietary_restrictions = Column(JSON, default=[])  # ['vegetarian', 'no-peanuts']
    cuisine_preference = Column(String, default="Any")
    
    #status
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    #relationships
    user = relationship("User", back_populates="meal_plans")
    scan_session = relationship("ProductScanSession")
    days = relationship("MealPlanDay", back_populates="meal_plan", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<MealPlan(id={self.id}, user_id={self.user_id}, days={self.total_days})>"
    
    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "scan_session_id": self.scan_session_id,
            "plan_name": self.plan_name,
            "total_days": self.total_days,
            "meals_per_day": self.meals_per_day,
            "daily_calorie_target": self.daily_calorie_target,
            "dietary_restrictions": self.dietary_restrictions,
            "cuisine_preference": self.cuisine_preference,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "days": [day.to_dict() for day in self.days] if self.days else []
        }


class MealPlanDay(Base):
    """
    Model for a single day in a meal plan.
    Contains multiple meals (breakfast, lunch, dinner, snacks).
    """
    __tablename__ = "meal_plan_days"

    id = Column(Integer, primary_key=True, index=True)
    meal_plan_id = Column(Integer, ForeignKey("meal_plans.id"), nullable=False)
    
    day_number = Column(Integer, nullable=False)  # 1, 2, 3, etc.
    day_name = Column(String, nullable=True)  #monday, tuesday, or custom name
    date = Column(DateTime, nullable=True)  #optional specific date
    
    #daily totals (calculated from meals)
    total_calories = Column(Float, default=0.0)
    total_protein = Column(Float, default=0.0)
    total_carbs = Column(Float, default=0.0)
    total_fat = Column(Float, default=0.0)
    
    notes = Column(Text, nullable=True)  #user notes for this day
    
    #relationships
    meal_plan = relationship("MealPlan", back_populates="days")
    meals = relationship("MealPlanMeal", back_populates="day", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<MealPlanDay(id={self.id}, day={self.day_number})>"
    
    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "day_number": self.day_number,
            "day_name": self.day_name,
            "date": self.date.isoformat() if self.date else None,
            "total_calories": self.total_calories,
            "total_protein": self.total_protein,
            "total_carbs": self.total_carbs,
            "total_fat": self.total_fat,
            "notes": self.notes,
            "meals": [meal.to_dict() for meal in self.meals] if self.meals else []
        }


class MealPlanMeal(Base):
    __tablename__ = "meal_plan_meals"
    id = Column(Integer, primary_key=True, index=True)
    meal_plan_day_id = Column(Integer, ForeignKey("meal_plan_days.id"), nullable=False)
    recipe_id = Column(Integer, ForeignKey("generated_recipes.id"), nullable=True)
    #mseal info
    meal_type = Column(String, nullable=False)  #breakfast, lunch, dinner, snack
    meal_name = Column(String, nullable=False)
    meal_order = Column(Integer, default=0)  #for sorting meals in a day
    #some nutritional info (cached from recipe)
    calories = Column(Float, default=0.0)
    protein = Column(Float, default=0.0)
    carbs = Column(Float, default=0.0)
    fat = Column(Float, default=0.0)
    #serving adjustments
    serving_size_multiplier = Column(Float, default=1.0)  # 0.5 = half serving, 2.0 = double
    #custom meal data (if not using a recipe)
    custom_ingredients = Column(JSON, nullable=True) 
    custom_instructions = Column(Text, nullable=True)
    source_url = Column(String, nullable=True)  #receipe link
    #cooking time info
    prep_time = Column(Integer, nullable=True) 
    cook_time = Column(Integer, nullable=True) 
    completed = Column(Boolean, default=False) 
    completed_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)  #user notes for this meal
    #relationships
    day = relationship("MealPlanDay", back_populates="meals")
    recipe = relationship("GeneratedRecipe", backref="meal_plan_meals")


    def __repr__(self):
        return f"<MealPlanMeal(id={self.id}, type={self.meal_type}, name={self.meal_name})>"
    
    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "meal_type": self.meal_type,
            "meal_name": self.meal_name,
            "meal_order": self.meal_order,
            "calories": self.calories,
            "protein": self.protein,
            "carbs": self.carbs,
            "fat": self.fat,
            "serving_size_multiplier": self.serving_size_multiplier,
            "completed": self.completed,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "notes": self.notes,
            "recipe_id": self.recipe_id,
            "recipe": self.recipe.to_dict() if self.recipe else None,
            "custom_ingredients": self.custom_ingredients,
            "custom_instructions": self.custom_instructions,
            "source_url": self.source_url,
            "prep_time": self.prep_time,
            "cook_time": self.cook_time,
        }
