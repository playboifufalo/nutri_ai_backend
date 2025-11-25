from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os
from dotenv import load_dotenv

from .models.database import get_db, init_db
from .routes import auth, food_analysis, scanner, preferences, lifestyle, meal_planning

app = FastAPI(
    title=os.getenv("APP_NAME", "Nutri AI Backend"),
    description=os.getenv("APP_DESCRIPTION", "AI-based nutrition analysis backend"),
    version=os.getenv("APP_VERSION", "0.1.0")
)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",") if os.getenv("ALLOWED_ORIGINS") else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(food_analysis.router)
app.include_router(scanner.router)
app.include_router(preferences.router)
app.include_router(lifestyle.router)
app.include_router(meal_planning.router)

@app.on_event("startup")
async def startup_event():
    init_db()

@app.get("/")
def read_root():
    return {
        "message": "welcome to nutri ai backend",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    debug = os.getenv("DEBUG", "True").lower() == "true"
    
    uvicorn.run(
        app, 
        host=host, 
        port=port,
        reload=debug,
        log_level=os.getenv("LOG_LEVEL", "info").lower()
    )