# Nutri AI Backend

AI-powered backend for a nutrition assistant mobile app that analyzes food products, generates meal plans, and provides personalized dietary recommendations.

**Author:** Timofe Stukalin, a Computer Sciences' student in UCLan University.
**Contact:** TStukalin@uclan.ac.uk
**Repository:** https://github.com/your_username/nutri-ai-backend

---

# Table of Contents

* About the Project
* Key Features
* Technology Stack
* Getting Started
* Configuration
* Usage
* Development
* API Overview
* Project Structure
* Roadmap
* Contributing
* License
* Contact
* Acknowledgments

---

# About the Project

Nutri AI Backend is a FastAPI-based server that powers the NutriAI mobile application. The system analyzes food products using AI, generates personalized meal plans, and manages user dietary preferences and lifestyle data.

The project solves the problem of manual nutrition tracking by providing automated product analysis, AI meal recommendations, and structured dietary planning.

**Target users:**

* People tracking nutrition
* Fitness enthusiasts
* Users with dietary restrictions
* Users seeking AI diet recommendations

---

# Key Features

## AI Food Analysis

* Product scanning via barcode or image
* Nutritional composition analysis
* AI health recommendations
* Product history tracking

## Meal Planning

* AI generated meal plans
* Personalized calorie targets
* Allergy and preference filtering
* Recipe generation
* Fallback recipe library

## User Personalization

* Dietary preferences
* Allergies tracking
* Favorite and disliked products
* Lifestyle profiles

## Integrations

* Google Vertex AI (Gemini)
* OpenFoodFacts database
* TheMealDB recipes API

---

# Technology Stack

## Language / Runtime

* Python 3.11

## Frameworks

* FastAPI
* SQLAlchemy
* Uvicorn

## AI Services

* Google Vertex AI (Gemini 2.5 Pro)

## Database / Storage

* PostgreSQL (production)
* SQLite (development)
* Redis (caching)

## Infrastructure

* Docker
* Docker Compose
* Nginx

## External Libraries

* httpx
* JWT authentication
* OpenFoodFacts API integration

---

# Getting Started

## Prerequisites

Make sure you have installed:

```
python --version
docker --version
docker-compose --version
```

Required:

* Python 3.11+
* Docker
* Google Cloud account (Vertex AI)

---

# Installation

## Using Docker (recommended)

Clone repository:

```
git clone https://github.com/your_username/nutri-ai-backend.git

cd nutri-ai-backend
```

Run containers:

```
docker-compose up -d --build
```

Server will start on:

```
http://localhost:3001
```

Nginx proxy:

```
http://localhost
```

---

## Local installation

Install dependencies:

```
pip install -r requirements.txt
```

Run server:

```
python run_server.py
```

---

# Configuration

Environment variables:

```
All of the variables are stored inside the .env file and can be seen only in a project's zip-archive. This was made due to the safety of all the data and the possibility that the project will keep developing and might become a commercial product in the future.
```

Can be set in:

* `.env`
* docker-compose.yml

---

# Usage

Swagger documentation:

```
/docs
```

Example:

```
http://localhost:3001/docs
```

Main capabilities:

* Register user
* Scan products
* Generate meal plans
* Manage preferences
* Get AI recommendations

You also need to be connected to the internet for the whole time of using the application in order to use all the funcitons.

---

# Development

Run development server:

```
python run_server.py
```

Recommended dev tools:

* Pytest
* Postman

---

# Running Tests

Example:

```
pytest
```

(Tests can be added in future versions)

---

# API Overview

## Auth endpoints

* POST `/auth/register`
* POST `/auth/login`
* POST `/auth/refresh`
* GET `/auth/me`

## Food analysis

* POST `/food/scan`
* GET `/food/scan-history`
* GET `/food/ai-advice`

## Scanner

* POST `/scanner/barcode-lookup`
* POST `/scanner/analyze`
* POST `/scanner/scan-async`

## Meal planning

* POST `/meal-planning/generate`
* GET `/meal-planning/quick-plan`

## Preferences

* GET `/preferences/me`
* PUT `/preferences/me`

## Lifestyle

* GET `/lifestyle/types`
* GET `/lifestyle/me/profile`

---

# Project Structure

```
app/

  main.py
  FastAPI entry point

  auth.py
  JWT authentication

  models/
    user.py
    food.py
    meal_plan.py
    preferences.py
    lifestyle.py
    scanned_products.py
    database.py

  routes/
    auth.py
    food_analysis.py
    scanner.py
    scanner_ai.py
    preferences.py
    lifestyle.py
    meal_planning.py

  services/
    vertex_ai_service.py
    recipe_generator.py
    meal_planner_ai.py
    ai_analyzer.py
    openfoodfacts_service.py
    barcode_service.py
    vertex_ai_image_scanner.py
    advanced_product_scanner.py
```

---
# Roadmap
For the future, I am planning to add more features such as sports exercises tracker and smart watch version of Nutri. Moreover, I will add some minor features such as the photo of the dishes in the meal plan; notifications and user's agreement.
The most important thing I am going to do is to add subscription and to deploy my application to AppStore and GooglePlay.

## Planned features

* Nutrition scoring system
* AI diet coach chat
* Meal plan editing UI support
* Better product recognition
* Multilingual AI responses

## Known limitations

* AI response latency (~90s timeout for food scanning and meal plan building)
* Limited fallback recipes
* Depends on external APIs

## Future improvements

* Async AI processing
* Better caching
* Recommendation engine
* ML personalization models

---

# Contributing

Contributions are welcome.

Suggested workflow:

1 Fork repository

2 Create branch:

```
git checkout -b feature-name
```

3 Commit changes:

```
git commit -m "feature description"
```

4 Push:

```
git push origin feature-name
```

# License

MIT License

See LICENSE file for details.

---

# Contact

NutriAI Team

[email@example.com](mailto:email@example.com)

https://github.com/your_username

---

# Acknowledgments

Technologies and services used:

* Google Vertex AI
* OpenFoodFacts
* TheMealDB
* FastAPI
* SQLAlchemy
* Redis
* Docker

* AIs such as ChatGPT, Grok and others were used for a research of functionality moments. For example, ChatGPT was used for understanding how AI integration works in code as there are not so many of guides of doing it properly. Moreover, Claude faster and quicker evaluation, testing & debugging (such as creating proper logs to find errors easier, creating tests and adding mock data).
Grok helped me with the structure and choosing the right stack for the project and its development. 
---
