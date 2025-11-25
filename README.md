# Nutri AI Backend

A comprehensive nutrition analysis backend service that provides food recognition, barcode scanning, and nutritional analysis using AI models including Google Vertex AI and OpenAI.

## Project Structure

The project is organized into several main directories:

### Core Application (`app/`)

**Main Files:**
- `main.py` - FastAPI application setup with all route configurations
- `auth.py` - JWT authentication system for user management

**Models (`app/models/`):**
Database models using SQLAlchemy:
- `database.py` - Database configuration and session management
- `user.py` - User account and authentication models  
- `food.py` - Food items, nutrition data, and meal tracking models
- `preferences.py` - User dietary preferences and restrictions
- `lifestyle.py` - User lifestyle and health goal models

**Routes (`app/routes/`):**
API endpoint definitions:
- `auth.py` - User authentication endpoints (register, login, logout)
- `food_analysis.py` - Food analysis and nutrition tracking endpoints
- `preferences.py` - User preference management endpoints
- `scanner.py` - Image scanning and barcode recognition endpoints
- `lifestyle.py` - Lifestyle and health goal management endpoints

**Services (`app/services/`):**
Business logic and external service integrations:
- `ai_analyzer.py` - OpenAI integration for food analysis
- `image_recognition.py` - Image processing and recognition services
- `barcode_service.py` - Barcode scanning and product lookup
- `vertex_ai_service.py` - Google Vertex AI integration
- `vertex_ai_image_scanner.py` - Advanced image scanning with Vertex AI

### Configuration and Deployment

**Docker Configuration:**
- `Dockerfile` - Main application container configuration
- `docker-compose.yml` - Production deployment setup
- `docker-compose.dev.yml` - Development environment setup
- `docker-compose.prod.yml` - Production environment with optimizations
- `Makefile` - Common Docker commands and shortcuts

**Web Server:**
- `nginx/nginx.conf` - Nginx reverse proxy configuration
- `nginx-proxy/nginx.conf` - Additional proxy configurations

**Database:**
- `database_init.sql` - Initial database schema
- `init_database.sh` - Database initialization script
- `sql/` - Additional SQL scripts and migrations

### Testing and Development

**Test Files:**
- `test_api.py` - API endpoint testing
- `test_components.py` - Component functionality testing
- `test_scanner.py` - Image scanning functionality tests
- Various product testing scripts (`test_products*.py`)

**Development Tools:**
- `run_server.py` - Local development server launcher
- `requirements.txt` - Python package dependencies
- `check_db.py` - Database connectivity verification

## API Endpoints

### Authentication Endpoints

**POST /auth/register**
Creates a new user account with email and password validation.

**POST /auth/login** 
Authenticates user credentials and returns JWT access token.

**GET /auth/me**
Returns current user profile information (requires authentication).

**POST /auth/logout**
Invalidates current user session and JWT token.

### Food Analysis Endpoints

**POST /food/scan**
Analyzes uploaded food images using AI to identify products and nutritional content.

**GET /food/scan-history**
Retrieves user's previous food scanning history with timestamps.

**GET /food/ai-advice**
Provides personalized nutrition advice based on user's dietary history.

**POST /food/nutrition-goals**
Allows users to set and update their nutritional targets and goals.

### Scanner Endpoints

**POST /scanner/detailed-analysis**
Performs comprehensive food analysis on uploaded images, identifying multiple products with weight estimates and nutritional breakdowns.

**POST /scanner/barcode**
Scans barcode images to identify specific products and retrieve detailed nutritional information.

**GET /scanner/history**
Returns history of all scanning activities for the authenticated user.

### Preferences Endpoints

**GET /preferences**
Retrieves user's dietary preferences, restrictions, and allergen information.

**POST /preferences**
Updates user's dietary preferences and food restrictions.

**DELETE /preferences**
Removes specific dietary preferences or restrictions.

### Lifestyle Endpoints

**GET /lifestyle**
Returns user's lifestyle information including activity level and health goals.

**POST /lifestyle**
Updates user's lifestyle settings and health objectives.

**GET /lifestyle/recommendations**
Provides personalized recommendations based on lifestyle and goals.

## Quick Start

### Local Development

Install Python dependencies:
```bash
pip install -r requirements.txt
```

Start the development server:
```bash
python run_server.py
```

The API will be available at `http://localhost:5000` with interactive documentation at `http://localhost:5000/docs`.

### Docker Development

Start all services including database:
```bash
docker-compose -f docker-compose.dev.yml up
```

### Production Deployment

Deploy with optimized settings:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Configuration

Create a `.env` file with required environment variables:
```
SECRET_KEY=your-jwt-secret-key
OPENAI_API_KEY=your-openai-api-key
GOOGLE_APPLICATION_CREDENTIALS=path/to/vertex-ai-credentials.json
DATABASE_URL=sqlite:///./nutri_ai.db
API_HOST=0.0.0.0
API_PORT=5000
```

## Features

The application supports:
- Multi-product food recognition from images
- Barcode scanning for packaged products
- Nutritional analysis and calorie counting
- User preference and dietary restriction management
- Meal planning and nutrition goal tracking
- AI-powered dietary recommendations
- Complete user authentication system
- Historical data tracking and analysis

## Technology Stack

- **Framework:** FastAPI (Python)
- **Database:** SQLAlchemy with SQLite/PostgreSQL
- **AI Services:** OpenAI GPT, Google Vertex AI (Gemini models)
- **Authentication:** JWT tokens
- **Containerization:** Docker with multi-stage builds
- **Web Server:** Nginx reverse proxy
- **Image Processing:** PIL, OpenCV

## Testing

Check database status:
```bash
python check_db.py
```

Test API functionality:
```bash
python test_api.py
python test_scanner.py
python test_preferences.py
```

Run component tests:
```bash
python test_components.py
```
