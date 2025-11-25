

import os
import json
import logging
from typing import Dict, List, Any, Optional
import httpx
from datetime import datetime
from google.auth.transport.requests import Request
from google.oauth2 import service_account

logger = logging.getLogger(__name__)

class VertexAIService:

    
    def __init__(self):
        self.project_id = os.getenv("VERTEX_AI_PROJECT_ID", "neon-pad-478212-c6")
        self.location = os.getenv("VERTEX_AI_LOCATION", "us-central1")
        self.api_key = os.getenv("VERTEX_AI_API_KEY")
        self.model = os.getenv("VERTEX_AI_MODEL", "gemini-pro")

        self.service_account_path = (
            os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or 
            "/app/vertex-ai-key.json"
        )

        self.access_token = None
        if os.path.exists(self.service_account_path):
            try:
                self.access_token = self._get_access_token()
                logger.info(f" Service Account loaded from {self.service_account_path}")
                logger.info(f" Vertex AI configured: {self.project_id} ({self.location})")
            except Exception as e:
                logger.error(f"failed to load service account: {e}")
        else:
            logger.warning(f" Service account file not found: {self.service_account_path}")
        
        if not self.api_key and not self.access_token:
            logger.warning(" No valid Vertex AI credentials found")
        else:
            logger.info(f" Vertex AI ready: {self.project_id} ({self.location})")
    
    def _get_access_token(self) -> Optional[str]:

        try:
            if not self.service_account_path or not os.path.exists(self.service_account_path):
                return None
                
            with open(self.service_account_path, 'r') as f:
                service_account_info = json.load(f)

            if not service_account_info.get('private_key') or not service_account_info.get('private_key_id'):
                logger.warning(f"service account missing private_key or private_key_id")
                return None
            
            credentials = service_account.Credentials.from_service_account_info(
                service_account_info,
                scopes=['https://www.googleapis.com/auth/cloud-platform']
            )

            request_obj = Request()
            credentials.refresh(request_obj)
            
            return credentials.token
            
        except ImportError:
            logger.warning("google-cloud-aiplatform not available, using API key method")
            return None
        except Exception as e:
            logger.error(f"error getting access token: {e}")
            return None
    
    async def generate_text(self, prompt: str, max_tokens: int = 1000) -> Dict[str, Any]:

        auth_token = None
        if self.access_token:
            auth_token = self.access_token
            logger.info("🔐 Using Service Account authentication")
        elif self.api_key:
            auth_token = self.api_key
            logger.info("🔑 Using API Key authentication")
        else:
            logger.error(" No authentication credentials available")
            return {
                "success": False,
                "error": "No authentication credentials configured",
                "fallback": True
            }
        
        try:

            url = f"https://{self.location}-aiplatform.googleapis.com/v1/projects/{self.project_id}/locations/{self.location}/publishers/google/models/{self.model}:generateContent"
            
            logger.info(f"🌐 Making request to Vertex AI:")
            logger.info(f"   URL: {url}")
            logger.info(f"   Project: {self.project_id}")
            logger.info(f"   Location: {self.location}")
            logger.info(f"   Model: {self.model}")
            logger.info(f"   Prompt length: {len(prompt)} chars")
            
            headers = {
                "Authorization": f"Bearer {auth_token}",  # Use full token for request
                "Content-Type": "application/json"
            }

            log_headers = headers.copy()
            log_headers["Authorization"] = f"Bearer {auth_token[:20]}..."
            logger.info(f"   Headers: {log_headers}")

            payload = {
                "contents": [{
                    "role": "user",
                    "parts": [{
                        "text": prompt
                    }]
                }],
                "generationConfig": {
                    "maxOutputTokens": max_tokens,
                    "temperature": 0.7,
                    "topP": 0.8,
                    "topK": 40
                }
            }
            
            logger.info(f"🤖 Sending request to Vertex AI: {self.model}")
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                logger.info("📡 Sending HTTP request to Vertex AI...")
                response = await client.post(url, headers=headers, json=payload)
                
                logger.info(f"📥 HTTP Response received:")
                logger.info(f"   Status Code: {response.status_code}")
                logger.info(f"   Headers: {dict(response.headers)}")
                logger.info(f"   Content Length: {len(response.content)} bytes")
                
                if response.status_code == 200:
                    result = response.json()
                    logger.info(f" JSON parsed successfully")
                    logger.info(f"   Response keys: {list(result.keys())}")

                    candidates = result.get("candidates", [])
                    logger.info(f"   Candidates found: {len(candidates)}")
                    
                    if candidates:
                        content = candidates[0].get("content", {})
                        parts = content.get("parts", [])
                        logger.info(f"   Parts found: {len(parts)}")
                        
                        if parts:
                            generated_text = parts[0].get("text", "")
                            
                            logger.info(f" Vertex AI response received: {len(generated_text)} characters")
                            logger.info(f"   Generated text preview: {generated_text[:100]}...")
                            
                            return {
                                "success": True,
                                "text": generated_text,
                                "model": self.model,
                                "provider": "vertex_ai",
                                "usage": result.get("usageMetadata", {})
                            }
                    
                    logger.error(f"no valid content in vertex ai response")
                    return {
                        "success": False,
                        "error": "No content in response",
                        "fallback": True
                    }
                
                elif response.status_code == 401:
                    logger.error("🔒 Vertex AI authentication failed")
                    logger.error(f"   Response: {response.text}")
                    return {
                        "success": False,
                        "error": "Authentication failed - check API key",
                        "fallback": True
                    }
                
                elif response.status_code == 403:
                    logger.error("🚫 Vertex AI access denied")
                    logger.error(f"   Response: {response.text}")
                    return {
                        "success": False,
                        "error": "Access denied - check project permissions", 
                        "fallback": True
                    }
                
                elif response.status_code == 429:
                    logger.error(f"vertex ai quota exceeded")
                    return {
                        "success": False,
                        "error": "Quota exceeded",
                        "fallback": True
                    }
                
                else:
                    logger.error(f"vertex ai error: {response.status_code} - {response.text}")
                    return {
                        "success": False,
                        "error": f"API error: {response.status_code}",
                        "fallback": True
                    }
                
        except httpx.TimeoutException:
            logger.error(f"vertex ai request timeout")
            return {
                "success": False,
                "error": "Request timeout",
                "fallback": True
            }
        
        except Exception as e:
            logger.error(f"vertex ai error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "fallback": True
            }
    
    def create_meal_plan_prompt(self, user_data: Dict[str, Any]) -> str:

        
        prompt = f"""Generate a detailed meal plan in JSON format with the following specifications:

User Requirements:
- Daily Calories: {user_data.get('daily_calories', 2000)} kcal
- Diet Type: {user_data.get('diet_type', 'balanced')}
- Goal: {user_data.get('goal', 'maintenance')}
- Lifestyle: {user_data.get('lifestyle', 'moderate')}
- Time Period: {user_data.get('time_period', 1)} day(s)
- Allergies: {', '.join(user_data.get('allergies', [])) or 'None'}
- Available Ingredients: {', '.join(user_data.get('available_ingredients', [])) or 'Any'}

Please create a meal plan that includes:
1. Breakfast, Lunch, Dinner, and 1-2 snacks
2. Detailed ingredient lists with quantities
3. Step-by-step cooking instructions
4. Nutritional information (calories, protein, fat, carbs)
5. Preparation time
6. Consider the user's dietary preferences and available ingredients

Return ONLY a valid JSON object with this structure:
{{
    "days": [
        {{
            "day_number": 1,
            "total_calories": 2000,
            "meals": [
                {{
                    "meal_type": "breakfast",
                    "meal_name": "Meal Name",
                    "description": "Brief description",
                    "ingredients": ["ingredient 1", "ingredient 2"],
                    "instructions": ["step 1", "step 2"],
                    "calories": 500,
                    "macros": {{"protein": 20, "fat": 15, "carbs": 65}},
                    "prep_time_minutes": 15
                }}
            ]
        }}
    ]
}}

Make sure the response is valid JSON that can be parsed."""

        return prompt
    
    async def generate_meal_plan(self, user_data: Dict[str, Any]) -> Dict[str, Any]:

        
        try:
            logger.info(f"🍽️ Generating meal plan with Vertex AI for {user_data.get('username', 'user')}")

            prompt = self.create_meal_plan_prompt(user_data)

            response = await self.generate_text(prompt, max_tokens=2000)
            
            if response.get("success"):
                generated_text = response.get("text", "")

                try:

                    clean_text = generated_text.strip()
                    if clean_text.startswith("```json"):
                        clean_text = clean_text[7:]
                    if clean_text.endswith("```"):
                        clean_text = clean_text[:-3]
                    clean_text = clean_text.strip()
                    
                    meal_plan_data = json.loads(clean_text)
                    
                    logger.info(f"ai plan successfully parsed")
                    
                    return {
                        "success": True,
                        "ai_powered": True,
                        "meal_plan": meal_plan_data,
                        "generated_at": datetime.now().isoformat(),
                        "provider": "vertex_ai",
                        "model": self.model
                    }
                
                except json.JSONDecodeError as e:
                    logger.error(f"failed to parse vertex ai json response: {e}")
                    logger.error(f"response text: {generated_text[:500]}...")
                    
                    return {
                        "success": False,
                        "error": "Failed to parse AI response",
                        "fallback": True,
                        "raw_response": generated_text[:500]
                    }
            
            else:
                logger.error(f"vertex ai generation failed: {response.get('error')}")
                return {
                    "success": False,
                    "error": response.get("error", "Unknown error"),
                    "fallback": True
                }
        
        except Exception as e:
            logger.error(f"vertex ai meal plan error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "fallback": True
            }
    
    def generate_content_with_image(self, prompt: str, base64_image: str, model_name: str = None) -> Dict[str, Any]:

        try:

            model = model_name or "gemini-2.0-flash-001"
            
            logger.info(f"sending vision request to vertex {model}")

            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {"text": prompt},
                            {
                                "inline_data": {
                                    "mime_type": "image/jpeg",
                                    "data": base64_image
                                }
                            }
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.1,
                    "topP": 0.8,
                    "topK": 40,
                    "maxOutputTokens": 2048,
                },
                "safetySettings": [
                    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
                ]
            }

            headers = {
                "Content-Type": "application/json"
            }
            
            if self.access_token:
                headers["Authorization"] = f"Bearer {self.access_token}"
            elif self.api_key:
                headers["x-api-key"] = self.api_key
            else:
                logger.error(f"no authentication method available")
                return {"error": "No authentication method available"}

            url = f"https://{self.location}-aiplatform.googleapis.com/v1/projects/{self.project_id}/locations/{self.location}/publishers/google/models/{model}:generateContent"
            
            logger.info(f" Sending vision request to Vertex AI: {model}")
            
            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, json=payload, headers=headers)
                
                if response.status_code == 200:
                    result = response.json()

                    if "candidates" in result and len(result["candidates"]) > 0:
                        candidate = result["candidates"][0]
                        
                        if "content" in candidate and "parts" in candidate["content"]:
                            content_text = ""
                            for part in candidate["content"]["parts"]:
                                if "text" in part:
                                    content_text += part["text"]
                            
                            logger.info(f" Vertex AI vision analysis completed")
                            return {
                                "success": True,
                                "content": content_text,
                                "model_used": model,
                                "usage": result.get("usageMetadata", {})
                            }
                    
                    logger.warning(f"no valid content in response")
                    return {"error": "No valid content in response", "raw_response": result}
                    
                else:
                    logger.error(f"vertex ai vision request failed: {response.status_code}")
                    logger.error(f"response: {response.text}")
                    return {"error": f"Request failed with status {response.status_code}"}
                    
        except Exception as e:
            logger.error(f"error in vertex ai vision generation: {str(e)}")
            return {"error": str(e)}

vertex_ai_service = VertexAIService()