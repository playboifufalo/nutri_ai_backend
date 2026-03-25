from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
from .database import Base

class ProductScanSession(Base):
    __tablename__ = "product_scan_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_name = Column(String, default="Product Scan")
    scan_method = Column(String, nullable=False)                #just some attributes for tracking how the scan was performed
    total_products = Column(Integer, default=0)
    total_weight_grams = Column(Integer, default=0)
    total_items_count = Column(Integer, default=0)
    processing_time_seconds = Column(Float, default=0.0)
    image_resolution = Column(String) 
    strategy_used = Column(String) 
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True) 
    #relationships
    user = relationship("User", back_populates="scan_sessions")
    scanned_products = relationship("ScannedProduct", back_populates="scan_session", cascade="all, delete-orphan")
    generated_recipes = relationship("GeneratedRecipe", back_populates="scan_session")



    def __repr__(self):
        return f"<ProductScanSession(id={self.id}, user_id={self.user_id}, products={self.total_products})>"



class ScannedProduct(Base):
    __tablename__ = "scanned_products"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("product_scan_sessions.id"), nullable=False)
    name = Column(String, nullable=False)
    brand = Column(String, nullable=True)
    weight_grams = Column(Integer, nullable=False)
    quantity = Column(Integer, default=1)
    confidence = Column(Float, nullable=False)
    tile_index = Column(Integer, nullable=True)  
    tile_info = Column(String, nullable=True)
    detection_method = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    scan_session = relationship("ProductScanSession", back_populates="scanned_products")


    def __repr__(self):
        return f"<ScannedProduct(id={self.id}, name='{self.name}', quantity={self.quantity})>"



    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'brand': self.brand,
            'weight_grams': self.weight_grams,
            'quantity': self.quantity,
            'confidence': self.confidence,
            'tile_index': self.tile_index,
            'detection_method': self.detection_method,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }



class GeneratedRecipe(Base):
    __tablename__ = "generated_recipes"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("product_scan_sessions.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipe_name = Column(String, nullable=False)
    cuisine_type = Column(String, nullable=True)
    difficulty_level = Column(String, default="Medium")
    cooking_time_minutes = Column(Integer, nullable=True)
    serving_size = Column(Integer, default=2)
    ingredients_list = Column(Text, nullable=False) 
    cooking_instructions = Column(Text, nullable=False)     #attributes for generated recipes we store
    nutritional_info = Column(Text, nullable=True)
    source_url = Column(String, nullable=True) 
    products_used_count = Column(Integer, default=0) 
    ai_model_used = Column(String, default="gemini-2.5-pro")
    generation_confidence = Column(Float, default=0.8)
    created_at = Column(DateTime, default=datetime.utcnow)
    scan_session = relationship("ProductScanSession", back_populates="generated_recipes")
    user = relationship("User", back_populates="generated_recipes")



    def __repr__(self):
        return f"<GeneratedRecipe(id={self.id}, name='{self.recipe_name}', difficulty='{self.difficulty_level}')>"  #function for debugging and logging



    def to_dict(self):  #convert to dictionary for API responses
        import json
        try:
            ingredients = json.loads(self.ingredients_list) if self.ingredients_list else []
        except json.JSONDecodeError:
            ingredients = []
        try:
            nutrition = json.loads(self.nutritional_info) if self.nutritional_info else {}
        except json.JSONDecodeError:
            nutrition = {}
        return {
            'id': self.id,
            'recipe_name': self.recipe_name,
            'cuisine_type': self.cuisine_type,
            'difficulty_level': self.difficulty_level,
            'cooking_time_minutes': self.cooking_time_minutes,
            'serving_size': self.serving_size,
            'ingredients': ingredients,
            'instructions': self.cooking_instructions,
            'nutritional_info': nutrition,
            'products_used_count': self.products_used_count,
            'generation_confidence': self.generation_confidence,
            'source_url': self.source_url, 
            'created_at': self.created_at.isoformat() if self.created_at else None
        }