# API Endpoints
## Authentication
POST /auth/register - user registration  
POST /auth/login - user login, get JWT tokens  
POST /auth/refresh - refresh access token  
GET /auth/me - get current user profile  
PUT /auth/me - update user profile  
POST /auth/change-password - change user password  
POST /auth/logout - user logout  
## Food Analysis
POST /food/scan - scan and analyze product  
GET /food/scan-history - user scan history  
GET /food/scan/{scan_id} - specific scan details  
POST /food/scan/{scan_id}/favorite - add scan to favorites  
GET /food/foods - list all products  
POST /food/nutrition-goals - set nutrition goals  
GET /food/nutrition-goals - get nutrition goals  
GET /food/ai-advice - get AI nutrition recommendations  
## Scanner
POST /scanner/barcode - scan barcode from image  
POST /scanner/barcode-lookup - direct barcode lookup  
GET /scanner/search-products - search products by name  
POST /scanner/product - analyze product from image  
POST /scanner/analyze - comprehensive product analysis  
GET /scanner/supported-products - supported product categories  
## Preferences
GET /preferences/me - get user preferences  
POST /preferences/me - create user preferences  
PUT /preferences/me - update user preferences  
POST /preferences/me/add-liked-product - add liked product  
POST /preferences/me/add-disliked-product - add disliked product  
POST /preferences/me/add-scanned-product - add scanned product  
DELETE /preferences/me - delete user preferences  
GET /preferences/available-options - available preference options  
GET /preferences/stats - preferences statistics  
## Lifestyle
GET /lifestyle/types - get lifestyle types  
GET /lifestyle/categories - get lifestyle categories  
GET /lifestyle/me/profile - get user lifestyle profile  
GET /lifestyle/me - get all lifestyle preferences  
POST /lifestyle/me - create lifestyle preferences  
PUT /lifestyle/me/{lifestyle_type_id} - update specific lifestyle type  
DELETE /lifestyle/me/{lifestyle_type_id} - delete specific lifestyle type  
GET /lifestyle/me/recommendations - get lifestyle recommendations  
GET /lifestyle/compatibility/{user_id} - check compatibility with user  
## Meal Planning
POST /meal-planning/generate - generate personalized meal plan  
GET /meal-planning/quick-plan - quick simple meal plan  
GET /meal-planning/diet-types - available diet types  
GET /meal-planning/goals - nutrition goals  
GET /meal-planning/lifestyle-types - lifestyle types for calorie calculation  
GET /meal-planning/themealdb-test - test integration with TheMealDB  
## System
GET /health - server health check  
GET / - root endpoint with API info  
GET /docs - swagger documentation  
GET /redoc - redoc documentation