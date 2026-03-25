from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from pydantic import BaseModel, Field
from typing import List, Optional, Any
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
    

    def set_liked_products(self, products: List[str]): #setters and getters for products
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
    
    def get_last_scanned_products(self) -> list:
        """Return list of scanned products (supports both old string format and new dict format)."""
        if not self.last_scanned_products:
            return []
        try:
            return json.loads(self.last_scanned_products)
        except (json.JSONDecodeError, TypeError):
            return []

    def set_last_scanned_products(self, products: list):
        self.last_scanned_products = json.dumps(products, ensure_ascii=False)

    def add_scanned_product(self, product, max_history: int = 20):
        """Add a scanned product. Accepts either a string name or a dict with nutrition data."""
        products = self.get_last_scanned_products()

        # Normalize: if product is a string, wrap it in a dict
        if isinstance(product, str):
            product_obj = {"name": product}
        elif isinstance(product, dict):
            product_obj = product
        else:
            product_obj = {"name": str(product)}

        product_name = product_obj.get("name", "")

        # Remove existing entry with same name (dedup)
        products = [
            p for p in products
            if (p.get("name") if isinstance(p, dict) else p) != product_name
        ]

        products.insert(0, product_obj)
        if len(products) > max_history:
            products = products[:max_history]
        self.set_last_scanned_products(products)

    def remove_scanned_product(self, product: str) -> bool:
        products = self.get_last_scanned_products()
        new_products = [
            p for p in products
            if (p.get("name") if isinstance(p, dict) else p) != product
        ]
        if len(new_products) < len(products):
            self.set_last_scanned_products(new_products)
            return True
        return False

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
    last_scanned_products: List[Any] = Field(default_factory=list)
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