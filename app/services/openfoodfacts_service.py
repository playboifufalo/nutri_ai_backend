import requests
import logging
from typing import Dict, Optional
from PIL import Image
logger = logging.getLogger(__name__)

class OpenFoodFactsAPI:
    BASE_URL = "https://world.openfoodfacts.org/api/v2"
    @classmethod
    def get_product_by_barcode(cls, barcode: str) -> Dict:
        try:
            url = f"{cls.BASE_URL}/product/{barcode}.json"
            
            headers = {
                'User-Agent': 'Nutri backend/0.1.0'
            }
            
            logger.info(f"openfoodfacts url search :{url}")
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("status") == 1:
                    product = data.get("product", {})
                    product_info = {
                        "found": True,
                        "barcode": barcode,
                        "name": product.get("product_name", "").strip(),
                        "brand": product.get("brands", "").strip(),
                        "categories": cls._clean_categories(product.get("categories", "")),
                        "ingredients": product.get("ingredients_text", "").strip(),
                        "nutrition": cls._extract_nutrition(product),
                        "images": cls._extract_images(product),
                        "quality_score": product.get("nutriscore_grade", "").upper(),
                        "eco_score": product.get("ecoscore_score"),
                        "allergens": cls._extract_allergens(product),
                        "additives": cls._extract_additives(product),
                        "packaging": product.get("packaging", "").strip(),
                        "origin": product.get("origins", "").strip(),
                        "stores": product.get("stores", "").strip(),
                        "data_quality": cls._assess_data_quality(product),
                        "source": "openfoodfacts",
                        "raw_data": product
                    }
                    
                    logger.info(f"Product is found in database: {product_info['name']}")
                    return product_info
                    
                else:
                    logger.warning(f"Product not found in database{barcode}")
                    return {
                        "found": False,
                        "barcode": barcode,
                        "error": "Product not found in OpenFoodFacts database",
                        "suggestion": "Try searching by product name or check if barcode is correct"
                    }
                    
            else:
                logger.error(f"-- http error {response.status_code}")
                return {
                    "found": False,
                    "barcode": barcode,
                    "error": f"http error: {response.status_code}",
                    "message": "Openfoodfgacts API is unavailable"
                }
                
        except requests.exceptions.Timeout:
            logger.error("timeout dur. requests")
            return {
                "found": False,
                "barcode": barcode,
                "error": "Request timeout",
                "message": "Openfoodfacts is taking too long"
            }
            
        except Exception as e:
            logger.error(f"unexpected error {str(e)}")
            return {
                "found": False,
                "barcode": barcode,
                "error": str(e)
            }
    
    @classmethod
    def search_products(cls, query: str, page: int = 1, page_size: int = 20) -> Dict: #product search method
        try:
            url = f"{cls.BASE_URL}/search"
            params = {
                "search_terms": query,
                "page": page,
                "page_size": page_size,
                "json": 1
            }
            headers = {
                'User-Agent': 'NutriAI-Backend/0.1.0'
            }
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                products = []
                
                for product in data.get("products", []):
                    products.append({
                        "barcode": product.get("code", ""),
                        "name": product.get("product_name", ""),
                        "brand": product.get("brands", ""), 
                        "image_url": product.get("image_url", ""),
                        "nutrition_score": product.get("nutriscore_grade", "").upper()
                    })
                
                return {
                    "success": True,
                    "products": products,
                    "total": data.get("count", 0),
                    "page": page,
                    "page_size": page_size,
                    "query": query
                }
            else:
                return {
                    "success": False,
                    "error": f"Search failed: {response.status_code}",
                    "products": []
                }
                
        except Exception as e:
            logger.error(f"search error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "products": []
            }
    
    @staticmethod
    def _extract_nutrition(product: Dict) -> Dict:

        nutrition = {}
        nutriments = product.get("nutriments", {})
        nutrition_mapping = {
            "energy-kcal_100g": "calories",
            "proteins_100g": "protein",
            "carbohydrates_100g": "carbohydrates", 
            "fat_100g": "fat",
            "fiber_100g": "fiber",
            "sugars_100g": "sugar",
            "sodium_100g": "sodium",
            "salt_100g": "salt",
            "saturated-fat_100g": "saturated_fat",
            "vitamin-c_100g": "vitamin_c",
            "calcium_100g": "calcium",
            "iron_100g": "iron"
        }
        for api_key, our_key in nutrition_mapping.items():
            value = nutriments.get(api_key)
            if value is not None:
                try:
                    nutrition[our_key] = float(value)
                except (ValueError, TypeError):
                    pass
        nutrition["unit"] = "per_100g"
        return nutrition
    
    @staticmethod
    def _extract_images(product: Dict) -> Dict:
        images = {}
        if product.get("image_url"):
            images["main"] = product["image_url"]
        if product.get("image_front_url"):
            images["front"] = product["image_front_url"]
        if product.get("image_ingredients_url"):
            images["ingredients"] = product["image_ingredients_url"]
        if product.get("image_nutrition_url"):
            images["nutrition"] = product["image_nutrition_url"]
        return images
    
    @staticmethod
    def _clean_categories(categories_str: str) -> list:
        if not categories_str:
            return []
        categories = [cat.strip() for cat in categories_str.split(",")]
        return list(set([cat for cat in categories if cat]))
    
    @staticmethod
    def _extract_allergens(product: Dict) -> list:
        allergens = []
        allergens_str = product.get("allergens", "")
        if allergens_str:
            allergens = [a.strip() for a in allergens_str.split(",") if a.strip()]
        return allergens
    @staticmethod
    def _extract_additives(product: Dict) -> list:
        additives = []
        additives_tags = product.get("additives_tags", [])
        for tag in additives_tags:
            if tag.startswith("en:"):
                additives.append(tag[3:].replace("-", " ").title())
        return additives
    @staticmethod
    def _assess_data_quality(product: Dict) -> Dict:

        quality = {
            "score": 0,
            "max_score": 10,
            "missing_fields": [],
            "quality_level": "poor"
        }
        key_fields = {
            "product_name": 2,
            "brands": 1,
            "ingredients_text": 2,
            "image_url": 1,
            "nutriments": 3,
            "categories": 1
        }
        for field, points in key_fields.items():
            if product.get(field):
                quality["score"] += points
            else:
                quality["missing_fields"].append(field)
        if quality["score"] >= 8:
            quality["quality_level"] = "excellent"
        elif quality["score"] >= 6:
            quality["quality_level"] = "good"
        elif quality["score"] >= 4:
            quality["quality_level"] = "fair"
        else:
            quality["quality_level"] = "poor"
        
        return quality
def get_product_info(barcode: str) -> Dict:

    return OpenFoodFactsAPI.get_product_by_barcode(barcode)

def analyze_barcode_image(image: Image.Image) -> Dict:

    try:
        from .barcode_service import analyze_barcode_image as real_analyze
        return real_analyze(image)
    except ImportError:

        logger.warning(f"using mock barcode service - install zbar for real scanning")
        return {
            "error": "Real barcode scanning not available",
            "message": "Mock barcode service active",
            "barcode": None,
            "product": None
        }