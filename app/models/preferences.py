from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import json

from .database import Base

class UserPreferences(Base):
    __tablename__ = "preferences"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    liked_products = Column(Text, nullable=True)  # JSON array
    disliked_products = Column(Text, nullable=True)  # JSON array
    allergies = Column(Text, nullable=True)  # JSON array
    diet_type = Column(String(100), nullable=True, index=True)
    goals = Column(String(100), nullable=True, index=True)
    caloric_target = Column(Integer, nullable=True)
    last_scanned_products = Column(Text, nullable=True)  # JSON array
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="preferences")
    
    def get_liked_products(self) -> List[str]:
        if not self.liked_products:
            return []
        try:
            return json.loads(self.liked_products)
        except (json.JSONDecodeError, TypeError):
            return []
    
    def set_liked_products(self, products: List[str]):
        self.liked_products = json.dumps(products)
    
    def get_disliked_products(self) -> List[str]:
        if not self.disliked_products:
            return []
        try:
            return json.loads(self.disliked_products)
        except (json.JSONDecodeError, TypeError):
            return []
    
    def set_disliked_products(self, products: List[str]):
        self.disliked_products = json.dumps(products)
    
    def get_allergies(self) -> List[str]:
        if not self.allergies:
            return []
        try:
            return json.loads(self.allergies)
        except (json.JSONDecodeError, TypeError):
            return []
    
    def set_allergies(self, allergies: List[str]):
        self.allergies = json.dumps(allergies)
    
    def get_last_scanned_products(self) -> List[str]:   #error with database happens sometimes here
        if not self.last_scanned_products:
            return []
        try:
            return json.loads(self.last_scanned_products)
        except (json.JSONDecodeError, TypeError):
            return []
    
    def set_last_scanned_products(self, products: List[str]):
        self.last_scanned_products = json.dumps(products)
    
    def add_scanned_product(self, product: str, max_history: int = 20):
        products = self.get_last_scanned_products()
        
        if product in products:
            products.remove(product)
        
        products.insert(0, product)
        
        if len(products) > max_history:
            products = products[:max_history]
        
        self.set_last_scanned_products(products)

class PreferencesCreate(BaseModel):
    liked_products: Optional[List[str]] = Field(default_factory=list, description="Products user likes")
    disliked_products: Optional[List[str]] = Field(default_factory=list, description="Products user dislikes")
    allergies: Optional[List[str]] = Field(default_factory=list, description="Allergies and ingredients to avoid")  # e.g., nuts, gluten
    diet_type: Optional[str] = Field(None, description="Diet type: vegetarian, keto, gluten-free, regular, etc.")
    goals: Optional[str] = Field(None, description="Goals: lose weight, gain weight, maintain weight")
    caloric_target: Optional[int] = Field(None, ge=800, le=5000, description="Daily caloric target (800-5000)")

class PreferencesUpdate(BaseModel):
    liked_products: Optional[List[str]] = None
    disliked_products: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    diet_type: Optional[str] = None
    goals: Optional[str] = None
    caloric_target: Optional[int] = Field(None, ge=800, le=5000)

class PreferencesResponse(BaseModel):
    id: int
    user_id: int
    liked_products: List[str] = Field(default_factory=list)
    disliked_products: List[str] = Field(default_factory=list)
    allergies: List[str] = Field(default_factory=list)
    diet_type: Optional[str] = None
    goals: Optional[str] = None
    caloric_target: Optional[int] = None
    last_scanned_products: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        
    @classmethod
    def from_orm(cls, obj: UserPreferences):
        return cls(
            id=obj.id,
            user_id=obj.user_id,
            liked_products=obj.get_liked_products(),
            disliked_products=obj.get_disliked_products(),
            allergies=obj.get_allergies(),
            diet_type=obj.diet_type,
            goals=obj.goals,
            caloric_target=obj.caloric_target,
            last_scanned_products=obj.get_last_scanned_products(),
            created_at=obj.created_at,
            updated_at=obj.updated_at
        )

DIET_TYPES = [
    "regular",
    "vegetarian",
    "vegan",
    "keto",
    "gluten-free",
    "paleo",
    "mediterranean",
    "intermittent-fasting"
]

GOAL_TYPES = [
    "lose weight",
    "gain weight",
    "maintain weight",
    "improve health",
    "gain muscle mass",
    "competition preparation"
]