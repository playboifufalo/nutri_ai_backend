import logging
from typing import Dict, Any, List, Optional, Tuple
from PIL import Image
import base64
import io
import json
import time

logger = logging.getLogger(__name__)
#Here we have several functions in case we want to speed up or improve accuracy for certain image types. For now we will use single-pass strategy for all images as it is easier to maintain and test, but we can easily add more strategies in the future if needed
class AdvancedProductScanner:   
    
    def __init__(self, vertex_service):
        self.vertex_service = vertex_service
        self.results_cache = {}  #caching
        logger.info("initialized advanced product scanner")
    
    def analyze_image_adaptive(self, image: Image.Image) -> Dict[str, Any]:     #analuzing the image with optimal strategy
        try:
            start_time = time.time()
            if image.mode in ('RGBA', 'LA', 'P'):
                image = image.convert('RGB') #converting to rgb
            width, height = image.size
            max_dim = 1280
            if max(width, height) > max_dim:
                ratio = max_dim / max(width, height)
                image = image.resize(
                    (int(width * ratio), int(height * ratio)),
                    Image.Resampling.LANCZOS,
                )
                width, height = image.size
                logger.info(f"resized to {width}x{height} before analysis")
            total_pixels = width * height
            logger.info(f"analyzing {width}x{height} image ({total_pixels:,} pixels)")
            
            #using single-pass strategy as its easier and cheaper to maintain and test
            result = self._analyze_single_pass(image)
            strategy = "single_pass"
            
            processing_time = time.time() - start_time
            
            #add meta info to result
            result.update({
                'strategy_used': strategy,
                'processing_time_seconds': round(processing_time, 2),
                'image_resolution': f"{width}x{height}",
                'total_pixels': total_pixels
            })
            
            logger.info(f"analysis complete: {result.get('total_products_found', 0)} products in {processing_time:.1f}s")
            
            return result
            
        except Exception as e:
            logger.error(f"advanced analysis error: {e}")
            return {
                'success': False,
                'error': f'advanced analysis failed: {str(e)}',
                'strategy_used': 'failed'
            }
    
    def _analyze_single_pass(self, image: Image.Image) -> Dict[str, Any]:
        logger.info("using SINGLE-PASS strategy")
        enhanced = self._enhance_image_for_analysis(image)
        base64_image = self._encode_image_to_base64(enhanced) 
        prompt = """Identify ALL food products in this image. Return JSON only, no explanation.

{
"products": [
{"name": "Product Name", "brand": "Brand or null", "weight_grams": 200, "quantity": 1, "confidence": 0.9, "calories_per_100g": 250, "protein_per_100g": 10, "carbs_per_100g": 30, "fat_per_100g": 12}
]
}

CRITICAL: You MUST list EVERY visible product, not just one. Scan the entire image.
- English names only
- Estimate weight_grams from package size (apple=180, milk=1000, yogurt=150, bread=500, candy=50, soda=330). Use printed weight if visible.
- Estimate nutrition per 100g from your knowledge
- quantity >1 only for identical items
- Max 20 products"""

        response = self.vertex_service.generate_content_with_image(
            prompt=prompt,
            base64_image=base64_image
        )
        
        return self._process_response(response, 'single_pass')

    def _analyze_simple_image(self, image: Image.Image) -> Dict[str, Any]:
        logger.info("Using SIMPLE strategy")
        base64_image = self._encode_image_to_base64(image)
        prompt = """Identify all food products in this image. JSON format: 

            {
            "products": [
                {
                "name": "product name in English",
                "brand": "brand if visible", 
                "weight_grams": 150,
                "quantity": 1,
                "confidence": 0.95
                }
            ]
            }

            IMPORTANT: All product names must be in English. List ALL visible food items."""
        
        response = self.vertex_service.generate_content_with_image(
            prompt=prompt,
            base64_image=base64_image
        )
        
        return self._process_response(response, 'advanced_simple')
   
    def _analyze_medium_image(self, image: Image.Image) -> Dict[str, Any]:
        logger.info("Using MEDIUM strategy")
        
        #enhance image quality
        enhanced_image = self._enhance_image_for_analysis(image)
        base64_image = self._encode_image_to_base64(enhanced_image)
        prompt = """Carefully examine this grocery image. Find ALL food products including small items. Response in ENGLISH. JSON:

                {
                "products": [
                    {
                    "name": "exact product name in English",
                    "brand": "brand name",
                    "weight_grams": 400,
                    "quantity": 1,
                    "confidence": 0.9
                    }
                ]
                }

                CRITICAL: All product names MUST be in English. Include ALL products - large packages, small items, bottles, cans, fresh produce."""
        
        response = self.vertex_service.generate_content_with_image(
            prompt=prompt,
            base64_image=base64_image
        )
        
        return self._process_response(response, 'advanced_medium')
    



    def _analyze_complex_image(self, image: Image.Image) -> Dict[str, Any]:
        logger.info("Using COMPLEX strategy (enhanced tiles)")
        tiles = self._create_adaptive_tiles(image)
        logger.info(f"Created {len(tiles)} adaptive tiles")
        all_products = []
        for i, tile_data in enumerate(tiles):
            tile_image = tile_data['image']
            tile_info = tile_data['info']
            logger.info(f"Analyzing tile {i+1}/{len(tiles)} ({tile_info})")
            products = self._analyze_tile_specialized(tile_image, i, tile_info)
            all_products.extend(products)
        unique_products = self._smart_deduplicate(all_products)
        
        if not unique_products:
            return {
                'success': False,
                'error': 'No products detected in complex image',
                'strategy_used': 'advanced_complex'
            }
        #Prepare result
        return self._prepare_complex_result(unique_products, len(tiles))
    



    def _create_adaptive_tiles(self, image: Image.Image) -> List[Dict[str, Any]]:
        width, height = image.size
        if width > 1500 or height > 1500:
            cols, rows = 2, 3
        elif width > 1000 or height > 1000:
            cols, rows = 2, 2
        else:
            cols, rows = 1, 2
        
        tiles = []
        overlap = 80
        tile_width = width // cols
        tile_height = height // rows
        
        for row in range(rows):
            for col in range(cols):
                left = max(0, col * tile_width - overlap)
                top = max(0, row * tile_height - overlap)
                right = min(width, (col + 1) * tile_width + overlap)
                bottom = min(height, (row + 1) * tile_height + overlap)
                
                tile_image = image.crop((left, top, right, bottom))
                
                tiles.append({
                    'image': tile_image,
                    'info': f"area_{row}_{col}_{right-left}x{bottom-top}",
                    'position': (row, col),
                    'bounds': (left, top, right, bottom)
                })
        
        return tiles
    




    def _analyze_tile_specialized(self, tile_image: Image.Image, tile_index: int, tile_info: str) -> List[Dict[str, Any]]:
        try:
            base64_tile = self._encode_image_to_base64(tile_image)
            prompt = f"""Food products in this section. Response in ENGLISH only. JSON:

                {{"products": [
                {{"name": "product name in English", "brand": "brand", "weight_grams": 200, "quantity": 1, "confidence": 0.9}}
                ]}}

                Find 2-5 clearest products. All names must be in English."""

            response = self.vertex_service.generate_content_with_image(
                prompt=prompt,
                base64_image=base64_tile
            )
            if not response or not response.get('content'):
                return []
            products = self._extract_products_from_response(response['content'])
            for product in products:
                product.update({
                    'tile_index': tile_index,
                    'tile_info': tile_info,
                    'detection_method': 'advanced_tile'
                })
            
            logger.info(f"🧩 Tile {tile_index}: {len(products)} products")
            return products
            
        except Exception as e:
            logger.warning(f"Tile {tile_index} analysis error: {e}")
            return []
    


    def _extract_products_from_response(self, content: str) -> List[Dict[str, Any]]:
        try:
            #Clean markdown formatting
            content = content.strip()
            if '```json' in content:
                start = content.find('```json') + 7
                end = content.find('```', start)
                if end != -1:
                    content = content[start:end].strip()
            data = json.loads(content)
            products = data.get('products', [])
            validated_products = []
            for product in products:
                if product.get('name'):
                    weight_value = product.get('weight_grams')
                    if not isinstance(weight_value, (int, float)) or weight_value <= 0:
                        weight_value = self._estimate_weight(product.get('name', ''))

                    quantity_value = product.get('quantity')
                    if not isinstance(quantity_value, (int, float)) or quantity_value <= 0:
                        quantity_value = 1

                    validated_product = {
                        'name': product.get('name', '').strip(),
                        'brand': product.get('brand') if product.get('brand') != 'null' else None,
                        'weight_grams': int(weight_value),
                        'quantity': int(quantity_value),
                        'confidence': float(product.get('confidence', 0.8)),
                        'calories_per_100g': float(product.get('calories_per_100g') or 0),
                        'protein_per_100g': float(product.get('protein_per_100g') or 0),
                        'carbs_per_100g': float(product.get('carbs_per_100g') or 0),
                        'fat_per_100g': float(product.get('fat_per_100g') or 0),
                    }
                    validated_products.append(validated_product)
            
            return validated_products
            
        except json.JSONDecodeError:
            return self._fallback_extract_products(content)
    



    def _smart_deduplicate(self, all_products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not all_products:
            return []
        
        unique_products = {}
        
        for product in all_products:
            name = product.get('name', '').lower().strip()
            key_words = [w for w in name.split() if len(w) > 2]
            if key_words:
                key = '_'.join(sorted(key_words[:3]))
            else:
                key = name
            if key not in unique_products:
                unique_products[key] = product
            else:
                existing_conf = unique_products[key].get('confidence', 0)
                current_conf = product.get('confidence', 0)
                
                if current_conf > existing_conf:
                    unique_products[key] = product
        
        result = list(unique_products.values())
        result.sort(key=lambda x: x.get('confidence', 0), reverse=True)
        logger.info(f"Deduplication: {len(all_products)} → {len(result)} unique products")
        return result
    



    def _enhance_image_for_analysis(self, image: Image.Image) -> Image.Image:
        width, height = image.size
        target_size = 1200  
        
        if max(width, height) != target_size:
            if max(width, height) > target_size:
                ratio = target_size / max(width, height)
            else:
                ratio = target_size / max(width, height)
            
            new_width = int(width * ratio)
            new_height = int(height * ratio)
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        return image
    



    def _encode_image_to_base64(self, image: Image.Image) -> str:
        buffered = io.BytesIO()
        image.save(buffered, format="JPEG", quality=70)
        img_data = buffered.getvalue()
        return base64.b64encode(img_data).decode('utf-8')
    



    def _estimate_weight(self, product_name: str) -> int:
        name_lower = product_name.lower()
        
        if any(word in name_lower for word in ['melon', 'watermelon', 'durian']):
            return 2000
        elif any(word in name_lower for word in ['avocado', 'pineapple']):
            return 400
        elif any(word in name_lower for word in ['banana', 'apple']):
            return 150
        elif any(word in name_lower for word in ['kiwi', 'lime']):
            return 80
        elif any(word in name_lower for word in ['grape', 'berry', 'berries']):
            return 300
        else:
            return 200

    def _estimate_nutrition(self, product_name: str) -> Dict[str, float]:
        name_lower = product_name.lower()

        #fruits
        if any(w in name_lower for w in ['apple', 'banana', 'orange', 'grape', 'berry', 'kiwi',
                                          'mango', 'pineapple', 'pear', 'peach', 'melon', 'watermelon']):
            return {'calories_per_100g': 52, 'protein_per_100g': 0.5, 'carbs_per_100g': 13, 'fat_per_100g': 0.2}
        #vegetables
        if any(w in name_lower for w in ['carrot', 'tomato', 'cucumber', 'pepper', 'onion',
                                          'lettuce', 'broccoli', 'spinach', 'cabbage', 'potato']):
            return {'calories_per_100g': 35, 'protein_per_100g': 1.5, 'carbs_per_100g': 7, 'fat_per_100g': 0.3}
        #dairy
        if any(w in name_lower for w in ['milk', 'yogurt', 'cheese', 'cream', 'butter', 'kefir']):
            return {'calories_per_100g': 120, 'protein_per_100g': 5, 'carbs_per_100g': 8, 'fat_per_100g': 7}
        #bread / bakery
        if any(w in name_lower for w in ['bread', 'bun', 'roll', 'croissant', 'bagel', 'toast']):
            return {'calories_per_100g': 265, 'protein_per_100g': 9, 'carbs_per_100g': 49, 'fat_per_100g': 3.2}
        #meat
        if any(w in name_lower for w in ['chicken', 'beef', 'pork', 'meat', 'steak', 'sausage', 'ham']):
            return {'calories_per_100g': 200, 'protein_per_100g': 22, 'carbs_per_100g': 0.5, 'fat_per_100g': 12}
        #fish
        if any(w in name_lower for w in ['fish', 'salmon', 'tuna', 'shrimp', 'seafood']):
            return {'calories_per_100g': 150, 'protein_per_100g': 20, 'carbs_per_100g': 0, 'fat_per_100g': 7}
        #snacks / sweets
        if any(w in name_lower for w in ['chips', 'cookie', 'chocolate', 'candy', 'cake', 'snack', 'wafer']):
            return {'calories_per_100g': 500, 'protein_per_100g': 5, 'carbs_per_100g': 60, 'fat_per_100g': 25}
        #drinks
        if any(w in name_lower for w in ['juice', 'soda', 'cola', 'water', 'tea', 'coffee', 'drink']):
            return {'calories_per_100g': 40, 'protein_per_100g': 0.2, 'carbs_per_100g': 10, 'fat_per_100g': 0}
        #cereal / grains
        if any(w in name_lower for w in ['rice', 'pasta', 'cereal', 'oat', 'granola', 'noodle']):
            return {'calories_per_100g': 350, 'protein_per_100g': 10, 'carbs_per_100g': 72, 'fat_per_100g': 2}
        #eggs
        if 'egg' in name_lower:
            return {'calories_per_100g': 155, 'protein_per_100g': 13, 'carbs_per_100g': 1.1, 'fat_per_100g': 11}
        #nuts
        if any(w in name_lower for w in ['nut', 'almond', 'walnut', 'cashew', 'peanut', 'pistachio']):
            return {'calories_per_100g': 600, 'protein_per_100g': 18, 'carbs_per_100g': 20, 'fat_per_100g': 50}
        #default
        return {'calories_per_100g': 150, 'protein_per_100g': 5, 'carbs_per_100g': 20, 'fat_per_100g': 5}
    



    def _fallback_extract_products(self, content: str) -> List[Dict[str, Any]]:
        import re
        products = []
        name_matches = re.findall(r'"name":\s*"([^"]+)"', content)
        for name in name_matches:
            if name.strip():
                estimated = self._estimate_nutrition(name)
                products.append({
                    'name': name.strip(),
                    'brand': None,
                    'weight_grams': self._estimate_weight(name),
                    'quantity': 1,
                    'confidence': 0.7,
                    **estimated,
                })
        return products
    



    def _process_response(self, response: Dict[str, Any], method: str) -> Dict[str, Any]:
        if not response:
            return {
                'success': False,
                'error': 'No response from AI model',
                'scan_method': method
            }
        if response.get('error'):
            return {
                'success': False,
                'error': response['error'],
                'scan_method': method
            }

        if not response.get('content'):
            return {
                'success': False,
                'error': 'No content in AI model response',
                'scan_method': method
            }
        
        products = self._extract_products_from_response(response['content'])
        
        if not products:
            return {
                'success': False,
                'error': 'No products extracted from response',
                'scan_method': method
            }
        main_product = products[0]
        total_weight = sum((p.get('weight_grams') or 0) * (p.get('quantity') or 1) for p in products)
        total_items = sum(p.get('quantity') or 1 for p in products)
        return {
            'success': True,
            'product_name': main_product['name'],
            'brand': main_product.get('brand'),
            'category': 'Multiple Products' if len(products) > 1 else 'Single Product',
            'confidence': main_product.get('confidence', 0.8),
            'weight_grams': main_product.get('weight_grams'),
            'quantity': main_product.get('quantity', 1),
            'scan_method': method,
            'model_used': 'gemini-2.5-pro',
            'image_enhanced': True,
            'total_products_found': len(products),
            'total_items_count': total_items,
            'total_weight_grams': total_weight,
            'all_products': products[:25],
            'calories_per_100g': main_product.get('calories_per_100g', 0),
            'protein_per_100g': main_product.get('protein_per_100g', 0),
            'carbs_per_100g': main_product.get('carbs_per_100g', 0),
            'fat_per_100g': main_product.get('fat_per_100g', 0)
        }
    



    def _prepare_complex_result(self, products: List[Dict[str, Any]], tiles_count: int) -> Dict[str, Any]:
        if not products:
            return {
                'success': False,
                'error': 'No products found in complex analysis'
            }
        
        main_product = products[0]
        total_weight = sum((p.get('weight_grams') or 0) * (p.get('quantity') or 1) for p in products)
        total_items = sum(p.get('quantity') or 1 for p in products)
        
        return {
            'success': True,
            'product_name': main_product['name'],
            'brand': main_product.get('brand'),
            'category': 'Multiple Products',
            'confidence': main_product.get('confidence', 0.8),
            'weight_grams': main_product.get('weight_grams'),
            'quantity': main_product.get('quantity', 1),
            'scan_method': 'advanced_complex_tiles',
            'model_used': 'gemini-2.5-pro',
            'image_enhanced': True,
            'tiles_analyzed': tiles_count,
            'total_products_found': len(products),
            'total_items_count': total_items,
            'total_weight_grams': total_weight,
            'all_products': products[:25],
            'calories_per_100g': main_product.get('calories_per_100g', 0),
            'protein_per_100g': main_product.get('protein_per_100g', 0),
            'carbs_per_100g': main_product.get('carbs_per_100g', 0),
            'fat_per_100g': main_product.get('fat_per_100g', 0)
        }




def create_advanced_scanner(vertex_service):
    return AdvancedProductScanner(vertex_service)