#!/usr/bin/env python3
import uvicorn  #startup code for server
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

if __name__ == "__main__":
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    debug = os.getenv("DEBUG", "True").lower() == "true"    #configuration from env
    log_level = os.getenv("LOG_LEVEL", "info").lower()
    
    print(f"sStarting Nutri AI Backend...")
    print(f"host: {host}:{port}")
    print(f"debug mode: {debug}")
    print(f"log level: {log_level}")
    print(f"documentation: http://{host}:{port}/docs")
    print(f"health check: http://{host}:{port}/health")
    
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=debug,
        log_level=log_level
    )