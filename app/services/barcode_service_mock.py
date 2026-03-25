"""
Alternative barcode scanner without zbar dependency
For testing purposes when zbar is not available
"""

from PIL import Image
import requests
import logging

logger = logging.getLogger(__name__)

def analyze_barcode_image(image: Image.Image) -> dict:
    """
    Alternative barcode analysis implementation (without zbar).
    Returns mock data for testing purposes.
    """
    logger.info("Using mock barcode scanner (zbar not available)")
    
    # Simulate image analysis
    image_size = image.size
    
    # Simple heuristic — if the image is horizontal,
    # assume it might be a barcode
    if image_size[0] > image_size[1] * 1.5:
        # Return a test barcode
        mock_barcode = "1234567890123"
        logger.info(f"Mock barcode found: {mock_barcode}")
        
        # Get test product info
        product_info = {
            "name": "test product",
            "brand": "test Brand", 
            "found": True,
            "mock": True,
            "nutrition": {
                "calories": 250,
                "protein": 12.5,
                "carbohydrates": 30.0,
                "fat": 8.5
            }
        }
        
        return {
            "barcode": mock_barcode,
            "barcode_type": "EAN13",
            "product": product_info,
            "source": "mock_scanner",
            "note": "This is a mock result - install zbar for real barcode scanning"
        }
    else:
        return {
            "message": "No barcode found (mock scanner)",
            "note": "Install zbar library for real barcode scanning"
        }

def get_product_info(barcode: str) -> dict:
    """
    Get product info by barcode from OpenFoodFacts.
    Works without zbar.
    """
    try:
        url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get("status") == 1:
                product = data.get("product", {})
                
                product_info = {
                    "name": product.get("product_name", "Unknown product"),
                    "brand": product.get("brands", ""),
                    "categories": product.get("categories", ""),
                    "ingredients": product.get("ingredients_text", ""),
                    "nutrition": extract_nutrition_info(product),
                    "image_url": product.get("image_url", ""),
                    "found": True
                }
                
                return product_info
            else:
                return {
                    "found": False,
                    "message": "Product not found in database"
                }
        else:
            return {
                "found": False,
                "error": f"API request failed: {response.status_code}"
            }
            
    except Exception as e:
        logger.error(f"Error getting product info: {str(e)}")
        return {
            "found": False,
            "error": str(e)
        }

def extract_nutrition_info(product: dict) -> dict:
    """Extract nutrition information from product data."""
    nutrition = {}
    nutriments = product.get("nutriments", {})
    
    nutrition_mapping = {
        "energy_100g": "calories",
        "proteins_100g": "protein", 
        "carbohydrates_100g": "carbohydrates",
        "fat_100g": "fat",
        "fiber_100g": "fiber",
        "sugars_100g": "sugar",
        "sodium_100g": "sodium"
    }
    
    for api_key, our_key in nutrition_mapping.items():
        if api_key in nutriments:
            nutrition[our_key] = nutriments[api_key]
    
    return nutrition