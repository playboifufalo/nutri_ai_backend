"""
Vertex AI Image Scanner for Nutrition Analysis
Handles product recognition with weights estimation
"""
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
        """Convert PIL Image to base64 string"""
        buffered = io.BytesIO()
        #converting to RGB if needed (removes alpha channel)
        if image.mode in ('RGBA', 'LA', 'P'):
            image = image.convert('RGB')
        image.save(buffered, format="JPEG", quality=85)
        img_bytes = buffered.getvalue()
        return base64.b64encode(img_bytes).decode('utf-8')
    
    def analyze_product_image(self, image: Image.Image) -> Dict[str, Any]:
        """
        Analyze single product image using Vertex AI
        """
        try:
            #encode image
            base64_image = self.encode_image_to_base64(image)
            
            #create simple prompt
            prompt = """
            Analyze this image and identify the main food product. Return ONLY valid JSON:
            {
            "product_name": "Product Name",
            "brand": "Brand Name or null", 
            "category": "food category",
            "confidence": 0.85
            }"""

            #call Vertex AI
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
                    
                    #Add metadata
                    result['scan_method'] = 'vertex_ai_vision'
                    result['model_used'] = self.vertex_service.model
                    result['success'] = True
                    
                    logger.info(f"Vertex AI identified product: {result.get('product_name', 'unknown')}")
                    return result
                    
                except json.JSONDecodeError as je:
                    logger.warning(f"JSON parsing failed: {je}, raw content: {content[:200]}...")
                    return self._fallback_response(f"JSON parsing failed: {str(je)}")
            else:
                logger.error("No valid response from Vertex AI")
                return self._fallback_response("No response from Vertex AI")
                
        except Exception as e:
            logger.error(f"Error in Vertex AI image analysis: {str(e)}")
            return self._fallback_response(f"Analysis error: {str(e)}")

    def analyze_products_with_weights(self, image: Image.Image, model_name: str = None) -> Dict[str, Any]:
        try:
            #encode image
            base64_image = self.encode_image_to_base64(image)
            
            #create OPTIMIZED prompt for finding ALL products
            prompt = """Analyze the image and find ALL food products. Do not limit to 5 products!

                Return strictly JSON format (without ```json):
                {
                "total_products": number_of_found_products,
                "products": [
                    {
                    "id": 1,
                    "name": "Short product name",
                    "brand": "Brand or null",
                    "category": "Category",
                    "estimated_weight_grams": 100,
                    "confidence": 90
                    }
                ]
                }

                Important:
                - Find ALL products in the image
                - Use short names
                - Do not add extra fields
                - JSON must be valid"""
            response = self.vertex_service.generate_content_with_image(
                prompt=prompt,
                base64_image=base64_image,
                model_name=model_name
            )
            
            if response and 'content' in response:
                content = response['content'].strip()
                if content.startswith('```json'):
                    content = content.replace('```json', '').replace('```', '').strip()
                logger.info(f"Raw Vertex AI response length: {len(content)}")
                logger.info(f"Raw content preview: {content[:500]}...")
                try:
                    import json
                    result = json.loads(content)
                    result['scan_method'] = 'vertex_ai_detailed'
                    result['model_used'] = self.vertex_service.model
                    result['success'] = True
                    
                    products_count = result.get('total_products', 0)
                    logger.info(f"Vertex AI identified {products_count} products with weights")
                    return result
                except json.JSONDecodeError as je:
                    logger.warning(f"JSON parsing failed: {je}")
                    logger.warning(f"Raw content length: {len(content)}")
                    logger.warning(f"Content ends with: ...{content[-200:]}")
                    try:
                        if content.count('{') > content.count('}'):
                            missing_braces = content.count('{') - content.count('}')
                            fixed_content = content + '}' * missing_braces
                            logger.info(f"Trying to fix JSON with {missing_braces} closing braces")
                            result = json.loads(fixed_content)
                            result['scan_method'] = 'vertex_ai_detailed'
                            result['model_used'] = self.vertex_service.model
                            result['success'] = True
                            result['json_fixed'] = True
                            
                            products_count = result.get('total_products', 0)
                            logger.info(f"Fixed JSON! Vertex AI identified {products_count} products")
                            return result
                            
                    except json.JSONDecodeError:
                        logger.warning("Failed to fix truncated JSON")
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
                logger.error("No valid response from Vertex AI")
                return self._fallback_response_detailed("No response from Vertex AI")
                
        except Exception as e:
            logger.error(f"Error in Vertex AI detailed analysis: {str(e)}")
            return self._fallback_response_detailed(f"Analysis error: {str(e)}")

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
                    result['model_used'] = self.vertex_service.model
                    result['success'] = True
                    
                    barcode_detected = result.get('barcode_detected', False)
                    logger.info(f"Barcode detection: {barcode_detected}")
                    return result
                    
                except json.JSONDecodeError as je:
                    logger.warning(f"Barcode JSON parsing failed: {je}")
                    return self._fallback_response(f"JSON parsing failed: {str(je)}")
            else:
                return self._fallback_response("No barcode response from Vertex AI")
                
        except Exception as e:
            logger.error(f"Error in barcode analysis: {str(e)}")
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



def identify_product_with_vertex(image: Image.Image) -> Dict[str, Any]:
    from .vertex_ai_service import VertexAIService
    
    vertex_service = VertexAIService()
    scanner = VertexAIImageScanner(vertex_service)
    return scanner.analyze_product_image(image)




def detect_barcode_with_vertex(image: Image.Image) -> Dict[str, Any]:
    from .vertex_ai_service import VertexAIService
    
    vertex_service = VertexAIService()
    scanner = VertexAIImageScanner(vertex_service)
    return scanner.analyze_for_barcode(image)


def analyze_products_detailed_with_vertex(image: Image.Image, model_name: str = None) -> Dict[str, Any]:
    from .vertex_ai_service import VertexAIService
    vertex_service = VertexAIService()
    scanner = VertexAIImageScanner(vertex_service)
    return scanner.analyze_products_with_weights(image, model_name=model_name)