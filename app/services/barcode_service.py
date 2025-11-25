

try:
    from pyzbar.pyzbar import decode
    BARCODE_AVAILABLE = True
except ImportError as e:
    print(f"warning: pyzbar not available: {e}")
    BARCODE_AVAILABLE = False

from PIL import Image
import requests
import logging

logger = logging.getLogger(__name__)

def analyze_barcode_image(image: Image.Image) -> dict:
    if not BARCODE_AVAILABLE:
        return {
            "error": "Barcode scanning not available - zbar library not installed",
            "message": "Please install zbar library for barcode scanning",
            "install_instructions": "brew install zbar  # on macOS"
        }
    
    try:

        barcodes = decode(image)
        
        if barcodes:

            barcode_data = barcodes[0].data.decode("utf-8")
            barcode_type = barcodes[0].type
            
            logger.info(f"found barcode: {barcode_data} (type: {barcode_type})")

            product_info = get_product_info(barcode_data)
            
            return {
                "barcode": barcode_data,
                "barcode_type": barcode_type,
                "product": product_info,
                "source": "openfoodfacts"
            }
        else:
            logger.info(f"barcode not found on image")
            return {
                "message": "No barcode found, try AI recognition."
            }
            
    except Exception as e:
        logger.error(f"error during barcode analysis: {str(e)}")
        return {
            "error": str(e),
            "message": "Error processing barcode"
        }

def get_product_info(barcode: str) -> dict:

    try:
        # Запрос к OpenFoodFacts API
        url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
        response = requests.get(url, timeout=10)
        
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
                
                logger.info(f"product information found: {product_info['name']}")
                return product_info
            else:
                logger.info(f"product with barcode {barcode} not found in openfoodfacts database")
                return {
                    "found": False,
                    "message": "Product not found in database"
                }
        else:
            logger.error(f"openfoodfacts request error: {response.status_code}")
            return {
                "found": False,
                "error": f"API request failed: {response.status_code}"
            }
            
    except requests.exceptions.Timeout:
        logger.error(f"timeout during openfoodfacts request")
        return {
            "found": False,
            "error": "Request timeout"
        }
    except Exception as e:
        logger.error(f"error getting product information: {str(e)}")
        return {
            "found": False,
            "error": str(e)
        }

def extract_nutrition_info(product: dict) -> dict:

    nutrition = {}
    nutriments = product.get("nutriments", {})
    
    # Основные питательные вещества на 100г
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