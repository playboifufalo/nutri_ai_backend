

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from PIL import Image
from typing import Optional
import io
import logging

from ..models.database import get_db
from ..models.user import User
from ..models.preferences import UserPreferences
from ..routes.auth import get_current_user
from ..models.ai_scanner.scanner import identify_product

from ..services.openfoodfacts_service import OpenFoodFactsAPI, analyze_barcode_image

from ..services.barcode_service_mock import analyze_barcode_image as mock_analyze_barcode

from ..services.vertex_ai_image_scanner import (
    identify_product_with_vertex, 
    detect_barcode_with_vertex,
    analyze_products_detailed_with_vertex
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/scanner",
    tags=["scanner"]
)

def is_image_file(file: UploadFile) -> bool:
    if file.content_type and file.content_type.startswith("image/"):
        return True
    if file.filename:
        return any(file.filename.lower().endswith(ext)              #TODO: ADD uploading from the local device
                  for ext in ['.jpg', '.jpeg', '.png'])
    
    return False

def update_scan_history(db: Session, user_id: int, product: str):
    try:
        preferences = db.query(UserPreferences).filter(
            UserPreferences.user_id == user_id
        ).first()
        
        if not preferences:
            preferences = UserPreferences(
                user_id=user_id,
                liked_products="[]",
                disliked_products="[]",
                allergies="[]",
                last_scanned_products="[]"
            )
            db.add(preferences)
            db.commit()
            db.refresh(preferences)
        preferences.add_scanned_product(product)
        db.commit()
        
        logger.info(f"added product '{product}' to user {user_id} scan history")
        
    except Exception as e:
        logger.error(f"error updating scan history: {str(e)}")

@router.post("/barcode-lookup")
async def lookup_barcode(
    barcode: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    try:

        if not barcode or not barcode.isdigit():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Barcode must contain only digits"
            )
        
        if len(barcode) < 8 or len(barcode) > 13:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Barcode must be between 8 and 13 digits long"
            )
        
        logger.info(f" Looking up barcode: {barcode} for user {current_user.username}")

        product_info = OpenFoodFactsAPI.get_product_by_barcode(barcode)
        
        if product_info.get("found"):

            product_name = product_info.get("name", f"Product {barcode}")
            update_scan_history(db, current_user.id, product_name)
            
            logger.info(f" Product found: {product_name}")
            
            return {
                "success": True,
                "message": f"Product found: {product_name}",
                "barcode": barcode,
                "product": product_info,
                "scan_method": "barcode_lookup",
                "user_id": current_user.id
            }
        else:
            logger.warning(f" Product not found for barcode: {barcode}")
            
            return {
                "success": False,
                "message": f"Product with barcode {barcode} not found in database",
                "barcode": barcode,
                "error": product_info.get("error", "Unknown error"),
                "suggestion": product_info.get("suggestion", "Try a different barcode or use image scanning"),
                "scan_method": "barcode_lookup",
                "user_id": current_user.id
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Barcode lookup error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during barcode lookup: {str(e)}"
        )

@router.get("/search-products")
async def search_products(
    query: str,
    page: int = 1,
    page_size: int = 10,
    current_user: User = Depends(get_current_user)
):

    try:
        # Валидация параметров
        if not query or len(query.strip()) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Query must be at least 2 characters long"
            )
        
        if page < 1:
            page = 1
            
        if page_size < 1 or page_size > 50:
            page_size = 10
        
        logger.info(f" Searching products: '{query}' for user {current_user.username}")
        
        # Поиск через OpenFoodFacts API
        search_results = OpenFoodFactsAPI.search_products(
            query=query.strip(),
            page=page,
            page_size=page_size
        )
        
        if search_results.get("success"):
            logger.info(f" Found {len(search_results['products'])} products")
            
            return {
                "success": True,
                "message": f"Found {search_results.get('total', 0)} products",
                "query": query,
                "results": search_results["products"],
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": search_results.get("total", 0),
                    "total_pages": (search_results.get("total", 0) + page_size - 1) // page_size
                },
                "user_id": current_user.id
            }
        else:
            logger.warning(f" Search failed: {search_results.get('error')}")
            
            return {
                "success": False,
                "message": "Search failed",
                "query": query,
                "error": search_results.get("error", "Unknown error"),
                "results": [],
                "user_id": current_user.id
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Product search error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during product search: {str(e)}"
        )

@router.post("/barcode")
async def scan_barcode(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    try:

        if not is_image_file(file):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="FILE MUSF BE AN IMAGE!"
            )

        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))

        try:
            result = analyze_barcode_image(image)
        except Exception as e:
            logger.warning(f"real barcode service failed: {e}, using mock")
            result = mock_analyze_barcode(image)
        
        if result.get("barcode"):
            logger.info(f"barcode found: {result['barcode']} for user {current_user.username}")

            product_name = result.get("product", {}).get("name", f"Product {result['barcode']}")
            update_scan_history(db, current_user.id, product_name)
            
            return {
                "success": True,
                "message": f"Barcode successfully scanned: {result['barcode']}",
                "scan_type": "barcode",
                "barcode": result["barcode"],
                "product_info": result.get("product", {}),
                "user_id": current_user.id
            }
        else:
            logger.info(f"barcode not found for user {current_user.username}")
            return {
                "success": False,
                "message": "Barcode not found in image",
                "scan_type": "barcode",
                "suggestion": "Try scanning the product through general scanner"
            }
            
    except Exception as e:
        logger.error(f"error scanning barcode: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing image: {str(e)}"
        )

@router.post("/product")
async def scan_product(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    try:

        if not is_image_file(file):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be an image"
            )
        
        # Читаем изображение
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))
        
        logger.info(f" Using Vertex AI for product recognition (user: {current_user.username})")

        recognition_result = identify_product_with_vertex(image)
        
        if recognition_result.get("success", False):
            identified_product = recognition_result.get("product_name", "unknown")
            confidence = recognition_result.get("confidence", 0.0)
            is_fallback = recognition_result.get("fallback", False)
            brand = recognition_result.get("brand")
            category = recognition_result.get("category")
        else:

            logger.warning(" Vertex AI failed, falling back to CLIP model")
            clip_result = identify_product(image)
            
            if isinstance(clip_result, dict):
                identified_product = clip_result.get("product", "unknown")
                confidence = clip_result.get("confidence", 0.0)
                is_fallback = True
                brand = None
                category = "unknown"
            else:
                identified_product = clip_result
                confidence = 0.8
                is_fallback = True
                brand = None
                category = "unknown"
        
        logger.info(f" Product recognized: {identified_product} (confidence: {confidence:.2f}) for user {current_user.username}")

        update_scan_history(db, current_user.id, identified_product)
        
        return {
            "success": True,
            "message": f"Product successfully recognized: {identified_product}",
            "scan_type": "product_recognition",
            "identified_product": identified_product,
            "brand": brand,
            "category": category,
            "confidence": confidence,
            "is_fallback": is_fallback,
            "scan_method": "vertex_ai" if not is_fallback else "clip_fallback",
            "user_id": current_user.id,
            "full_analysis": recognition_result if not is_fallback else None
        }
            
    except Exception as e:
        logger.error(f"error recognizing product: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing image: {str(e)}"
        )

@router.post("/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    scan_type: Optional[str] = "auto",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    try:
        # Проверка типа файла
        if not is_image_file(file):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="FILE MUST BE AN IMAGE!"
            )
        
        # Читаем изображение
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))
        
        results = []
        
        logger.info(f" Starting universal analysis with Vertex AI (user: {current_user.username})")
        
        # Сначала пробуем найти баркод с помощью Vertex AI
        vertex_barcode_result = detect_barcode_with_vertex(image)
        if vertex_barcode_result.get("barcode_detected"):
            results.append({
                "method": "vertex_ai_barcode",
                "success": True,
                "data": vertex_barcode_result,
                "message": f"Vertex AI нашел баркод: {vertex_barcode_result.get('barcode_number', 'неизвестно')}"
            })
        else:

            barcode_result = analyze_barcode_image(image)
            if barcode_result.get("barcode"):
                results.append({
                    "method": "traditional_barcode",
                    "success": True,
                    "data": barcode_result,
                    "message": f"Традиционный анализ нашел баркод: {barcode_result['barcode']}"
                })
            else:
                results.append({
                    "method": "barcode_analysis",
                    "success": False,
                    "message": "Баркод не найден"
                })
        
        # Затем пробуем AI распознавание продукта с Vertex AI
        try:
            recognition_result = identify_product_with_vertex(image)
            
            if recognition_result.get("success", False):
                identified_product = recognition_result.get("product_name", "unknown")
                confidence = recognition_result.get("confidence", 0.0)
                
                if confidence > 0.3:  # Минимальная уверенность
                    results.append({
                        "method": "vertex_ai_product",
                        "success": True,
                        "data": recognition_result,
                        "message": f"Vertex AI распознал продукт: {identified_product} (confidence: {confidence:.2f})"
                    })
                else:
                    results.append({
                        "method": "vertex_ai_product",
                        "success": False,
                        "message": f"Vertex AI распознавание с низкой уверенностью: {confidence:.2f}"
                    })
            else:

                logger.info(" Vertex AI failed, trying CLIP model")
                clip_result = identify_product(image)
                
                if isinstance(clip_result, dict):
                    identified_product = clip_result.get("product", "unknown")
                    confidence = clip_result.get("confidence", 0.0)
                    is_fallback = clip_result.get("fallback", False)
                    
                    if not is_fallback and confidence > 0.3:
                        results.append({
                            "method": "clip_ai_fallback",
                            "success": True,
                            "data": clip_result,
                            "message": f"CLIP AI (fallback) распознал продукт: {identified_product} (confidence: {confidence:.2f})"
                        })
                    else:
                        results.append({
                            "method": "ai_recognition",
                            "success": False,
                            "message": f"AI распознавание с низкой уверенностью: {confidence:.2f}"
                        })
                else:
                    # Старый формат
                    results.append({
                        "method": "clip_ai_fallback",
                        "success": True,
                        "data": {"product": clip_result},
                        "message": f"CLIP AI (fallback) распознал продукт: {clip_result}"
                    })
        except Exception as ai_error:
            results.append({
                "method": "ai_recognition",
                "success": False,
                "message": f"AI распознавание не удалось: {str(ai_error)}"
            })
        
        # Определяем основной результат
        main_result = None
        main_message = ""
        
        # Приоритет баркоду
        if results[0]["success"]:
            main_result = results[0]["data"]
            barcode_num = main_result.get('barcode_number') or main_result.get('barcode', 'unknown')
            main_message = f"Отсканирован баркод: {barcode_num}"
        elif len(results) > 1 and results[1]["success"]:
            main_result = results[1]["data"]

            product_name = (main_result.get('product_name') or 
                          main_result.get('product') or 
                          'unknown product')
            main_message = f"Распознан продукт: {product_name}"
        else:
            main_message = "Не удалось распознать изображение"
        
        logger.info(f"Анализ завершен для пользователя {current_user.username}: {main_message}")
        
        return {
            "success": main_result is not None,
            "message": main_message,
            "main_result": main_result,
            "all_methods": results,
            "user_id": current_user.id
        }
            
    except Exception as e:
        logger.error(f"Ошибка при анализе изображения: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при обработке изображения: {str(e)}"
        )

@router.post("/detailed-analysis")
async def analyze_products_detailed(
    file: UploadFile = File(...),
    model_override: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    try:

        if not is_image_file(file):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be an image"
            )

        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))
        
        model_info = f" (model: {model_override})" if model_override else ""
        logger.info(f" Starting detailed products analysis for user {current_user.username}{model_info}")

        analysis_result = analyze_products_detailed_with_vertex(image, model_name=model_override)
        
        if analysis_result.get("success", False):
            products_count = analysis_result.get("total_products", 0)
            total_weight = analysis_result.get("total_estimated_weight", 0)
            
            logger.info(f" Detailed analysis completed: {products_count} products, {total_weight}g total")

            if analysis_result.get("products"):
                for product in analysis_result["products"]:
                    product_name = f"{product.get('name', 'Unknown')} ({product.get('estimated_weight_grams', 0)}g)"
                    update_scan_history(db, current_user.id, product_name)
            
            return {
                "success": True,
                "message": f"Detailed analysis completed: {products_count} products identified",
                "scan_type": "detailed_products_analysis",
                "analysis": analysis_result,
                "user_id": current_user.id
            }
        else:
            logger.warning(f"detailed analysis failed, trying fallback")

            simple_result = identify_product_with_vertex(image)
            
            return {
                "success": False,
                "message": "Detailed analysis failed, fallback result provided",
                "scan_type": "detailed_products_analysis_fallback",
                "fallback_result": simple_result,
                "error": analysis_result.get("error", "Unknown error"),
                "user_id": current_user.id
            }
            
    except Exception as e:
        logger.error(f"error in detailed products analysis: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during detailed analysis: {str(e)}"
        )

@router.get("/supported-products")
async def get_supported_products():

    # Обновленный список продуктов из scanner.py
    supported_products = [
        "apple", "bread", "milk", "pasta", "rice", "banana", 
        "orange", "chicken", "beef", "fish", "cheese", "yogurt",
        "tomato", "potato", "carrot", "broccoli", "pizza", "burger"
    ]
    
    return {
        "supported_products": supported_products,
        "total_count": len(supported_products),
        "scan_methods": [
            "barcode_scanning",
            "ai_product_recognition"
        ],
        "confidence_threshold": 0.3
    }