
import logging
import base64
import io
from typing import Dict, Any, Optional
from PIL import Image

logger = logging.getLogger(__name__)

class VertexAIImageScanner:
    def __init__(self, vertex_service):
        self.vertex_service = vertex_service
    
    def encode_image_to_base64(self, image: Image.Image) -> str:

        buffered = io.BytesIO()

        if image.mode in ('RGBA', 'LA', 'P'):
            image = image.convert('RGB')
        image.save(buffered, format="JPEG", quality=85)
        img_bytes = buffered.getvalue()
        return base64.b64encode(img_bytes).decode('utf-8')
    
    def analyze_product_image(self, image: Image.Image) -> Dict[str, Any]:

        try:

            base64_image = self.encode_image_to_base64(image)

            prompt = """
Analyze this image and identify the main food product. Return ONLY valid JSON:
{
  "product_name": "Product Name",
  "brand": "Brand Name or null", 
  "category": "food category",
  "confidence": 0.85
}"""

            response = self.vertex_service.generate_content_with_image(
                prompt=prompt,
                base64_image=base64_image
            )
            
            if response and 'content' in response:
                content = response['content'].strip()
                if content.startswith('```json'):
                    content = content.replace('```json', '').replace('```', '').strip()
                
                try:
                    import json
                    result = json.loads(content)

                    result['scan_method'] = 'vertex_ai_vision'
                    result['model_used'] = 'gemini-2.0-flash-001'
                    result['success'] = True
                    
                    logger.info(f" Vertex AI identified product: {result.get('product_name', 'unknown')}")
                    return result
                    
                except json.JSONDecodeError as je:
                    logger.warning(f"json parsing failed: {je}, raw content: {content[:200]}...")
                    return self._fallback_response(f"JSON parsing failed: {str(je)}")
            else:
                logger.error(f"no valid response from vertex ai")
                return self._fallback_response("No response from Vertex AI")
                
        except Exception as e:
            logger.error(f"error in vertex ai image analysis: {str(e)}")
            return self._fallback_response(f"Analysis error: {str(e)}")

    def analyze_products_with_weights(self, image: Image.Image) -> Dict[str, Any]:

        try:

            base64_image = self.encode_image_to_base64(image)

            prompt = """Find and identify all the products on the image. Return only valid JSON in format:
                {
                "total_products": 3,
                "analysis_confidence": 0.85,
                "products": [
                    {
                    "id": 1,
                    "name": "product name",
                    "brand": "brand or unknown",
                    "category": "category",
                    "estimated_weight_grams": 100,
                    "package_info": "box description",
                    "confidence": 0.90,
                    "is_food": true,
                    "nutrition_per_100g": {
                        "calories": 250,
                        "protein": 10,
                        "carbs": 30,
                        "fat": 8
                    },
                    "total_nutrition": {
                        "calories": 250,
                        "protein": 10,
                        "carbs": 30,
                        "fat": 8
                    }
                    }
                ],
                "total_estimated_weight": 100,
                "total_calories": 250,
                "scan_method": "vertex_ai_detailed"
                }
"""

            response = self.vertex_service.generate_content_with_image(
                prompt=prompt,
                base64_image=base64_image
            )
            
            if response and 'content' in response:

                content = response['content'].strip()

                if content.startswith('```json'):
                    content = content.replace('```json', '').replace('```', '').strip()

                logger.info(f"raw vertex ai response length: {len(content)}")
                logger.info(f"raw content preview: {content[:500]}...")
                
                try:
                    import json
                    result = json.loads(content)

                    result['scan_method'] = 'vertex_ai_detailed'
                    result['model_used'] = 'gemini-2.0-flash-001'
                    result['success'] = True
                    
                    products_count = result.get('total_products', 0)
                    logger.info(f" Vertex AI identified {products_count} products with weights")
                    return result
                    
                except json.JSONDecodeError as je:
                    logger.warning(f"json parsing failed: {je}")
                    logger.warning(f"raw content length: {len(content)}")
                    logger.warning(f"content ends with: ...{content[-200:]}")

                    try:

                        if content.count('{') > content.count('}'):
                            missing_braces = content.count('{') - content.count('}')
                            fixed_content = content + '}' * missing_braces
                            logger.info(f"trying to fix json with {missing_braces} closing braces")
                            result = json.loads(fixed_content)

                            result['scan_method'] = 'vertex_ai_detailed'
                            result['model_used'] = 'gemini-2.0-flash-001'
                            result['success'] = True
                            result['json_fixed'] = True
                            
                            products_count = result.get('total_products', 0)
                            logger.info(f" Fixed JSON! Vertex AI identified {products_count} products")
                            return result
                            
                    except json.JSONDecodeError:
                        logger.warning(f"failed to fix truncated json")

                    return {
                        'total_products': 0,
                        'products': [],
                        'scan_method': 'vertex_ai_detailed',
                        'success': False,
                        'error': f'JSON parsing failed: {str(je)}',
                        'raw_response_length': len(content),
                        'raw_response_preview': content[:1000]
                    }
            else:
                logger.error(f"no valid response from vertex ai")
                return self._fallback_response_detailed("No response from Vertex AI")
                
        except Exception as e:
            logger.error(f"error in vertex ai detailed analysis: {str(e)}")
            return self._fallback_response_detailed(f"analysis error {str(e)}")

    def analyze_for_barcode(self, image: Image.Image) -> Dict[str, Any]:

        try:
            base64_image = self.encode_image_to_base64(image)
            
            prompt = """
                Look for barcodes in this image. Return ONLY valid JSON:
                {
                "barcode_detected": true/false,
                "barcode_value": "1234567890123 or null",
                "barcode_type": "EAN-13/UPC/QR or null",
                "confidence": 0.85
                }"""

            response = self.vertex_service.generate_content_with_image(
                prompt=prompt,
                base64_image=base64_image
            )
            
            if response and 'content' in response:
                content = response['content'].strip()
                if content.startswith('```json'):
                    content = content.replace('```json', '').replace('```', '').strip()
                
                try:
                    import json
                    result = json.loads(content)
                    result['scan_method'] = 'vertex_ai_barcode'
                    result['model_used'] = 'gemini-2.0-flash-001'
                    result['success'] = True
                    
                    barcode_detected = result.get('barcode_detected', False)
                    logger.info(f" Barcode detection: {barcode_detected}")
                    return result
                    
                except json.JSONDecodeError as je:
                    logger.warning(f"barcode json parsing failed: {je}")
                    return self._fallback_response(f"JSON parsing failed: {str(je)}")
            else:
                return self._fallback_response("No barcode response from Vertex AI")
                
        except Exception as e:
            logger.error(f"error in barcode analysis: {str(e)}")
            return self._fallback_response(f"Barcode analysis error: {str(e)}")

    def _fallback_response(self, error_message: str) -> Dict[str, Any]:



        return {
            'product_name': 'unknown_product',
            'brand': None,
            'category': 'unknown',
            'confidence': 0.1,
            'scan_method': 'fallback',
            'success': False,
            'error': error_message
        }

    def _fallback_response_detailed(self, error_message: str) -> Dict[str, Any]:
        return {
            'total_products': 0,
            'products': [],
            'analysis_confidence': 0.1,
            'scan_method': 'fallback_detailed',
            'success': False,
            'error': error_message,
            'total_estimated_weight': 0,
            'total_calories': 0
        }