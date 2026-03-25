import requests
import logging
from typing import Dict, Optional
from PIL import Image
from functools import lru_cache
import time
logger = logging.getLogger(__name__)
_search_cache: Dict[str, Dict] = {}
_cache_timestamps: Dict[str, float] = {}
CACHE_TTL = 300 


def _get_cached(key: str) -> Optional[Dict]:
    if key in _search_cache:
        if time.time() - _cache_timestamps[key] < CACHE_TTL:
            return _search_cache[key]
        else:
            del _search_cache[key]
            del _cache_timestamps[key]
    return None



def _set_cached(key: str, value: Dict):
    if len(_search_cache) > 200:
        oldest = min(_cache_timestamps, key=_cache_timestamps.get)
        del _search_cache[oldest]
        del _cache_timestamps[oldest]
    _search_cache[key] = value
    _cache_timestamps[key] = time.time()


class OpenFoodFactsAPI:
    BASE_URL = "https://world.openfoodfacts.net/api/v2"
    FALLBACK_URL = "https://world.openfoodfacts.org/api/v2"
    HEADERS = {
        'User-Agent': 'nutriai'
    }

    @classmethod
    def _api_get(cls, path: str, params: dict, timeout: int = 15) -> requests.Response:
        """Try primary URL, fallback to secondary on failure."""
        for base in [cls.BASE_URL, cls.FALLBACK_URL]:
            try:
                url = f"{base}{path}" if path else base
                resp = requests.get(url, params=params, headers=cls.HEADERS, timeout=timeout)
                if resp.status_code == 200:
                    return resp
                logger.warning(f"API {base}{path} returned {resp.status_code}, trying fallback...")
            except Exception as e:
                logger.warning(f"API {base}{path} failed: {e}, trying fallback...")
        #return last response even if not 200
        return resp

    @classmethod
    def get_product_by_barcode(cls, barcode: str) -> Dict:
        cache_key = f"barcode:{barcode}"
        cached = _get_cached(cache_key)
        if cached:
            logger.info(f"cache hit for barcode '{barcode}'")
            return cached
        try:
            logger.info(f"openfoodfacts search: barcode={barcode}, length={len(barcode)}")
            response = cls._api_get(f"/product/{barcode}.json", params={}, timeout=10)
            
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
                    _set_cached(cache_key, product_info)
                    return product_info
                    
                else:
                    logger.warning(f"Product not found in database{barcode}")
                    return {
                        "found": False,
                        "barcode": barcode,
                        "error": "product not found in database",
                        "suggestion": "try searching by product name or check if barcode is correct"
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
    
    SEARCH_URLS = [
        "https://world.openfoodfacts.net/cgi/search.pl",
        "https://world.openfoodfacts.org/cgi/search.pl",
    ]

    @classmethod
    def search_products(cls, query: str, page: int = 1, page_size: int = 20) -> Dict:
        cache_key = f"search:{query}:{page}:{page_size}"
        cached = _get_cached(cache_key)
        if cached:
            logger.info(f"Cache hit for '{query}' page={page}")
            return cached
        try:
            params = {
                "search_terms": query,
                "search_simple": 1,
                "action": "process",
                "page": page,
                "page_size": page_size,
                "sort_by": "unique_scans_n",
                "json": 1,
            }
            response = None
            for url in cls.SEARCH_URLS:
                try:
                    response = requests.get(url, params=params, headers=cls.HEADERS, timeout=15)
                    if response.status_code == 200:
                        break
                    logger.warning(f"Search {url} returned {response.status_code}, trying next...")
                except Exception as e:
                    logger.warning(f"Search {url} failed: {e}, trying next...")

            if response is None or response.status_code != 200:
                status = response.status_code if response else 'no response'
                return {
                    "success": False,
                    "error": f"Search failed: {status}",
                    "products": []
                }

            data = response.json()
            products = []
            
            for product in data.get("products", []):
                nutriments = product.get("nutriments", {})
                products.append({
                    "barcode": product.get("code", ""),
                    "name": product.get("product_name", ""),
                    "brand": product.get("brands", ""), 
                    "image_url": product.get("image_url", ""),
                    "nutrition_score": product.get("nutriscore_grade", "").upper(),
                    "calories_per_100g": nutriments.get("energy-kcal_100g", 0),
                    "protein_per_100g": nutriments.get("proteins_100g", 0),
                    "carbs_per_100g": nutriments.get("carbohydrates_100g", 0),
                    "fat_per_100g": nutriments.get("fat_100g", 0),
                })
            result = {
                "success": True,
                "products": products,
                "total": data.get("count", 0),
                "page": page,
                "page_size": page_size,
                "query": query
            }
            _set_cached(cache_key, result)
            return result
                
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