import json
import logging
import random
import re
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)

#Allergen helpers
ALLERGEN_MAP = {
    "milk": ["milk", "cream", "cheese", "cottage cheese", "butter", "kefir", "yogurt", "sour cream"],
    "eggs": ["egg", "eggs", "mayonnaise"],
    "gluten": ["wheat", "flour", "bread", "pasta", "spaghetti", "noodle", "gluten", "oat"],
    "nuts": ["nut", "almond", "hazelnut", "cashew", "pistachio", "peanut", "walnut"],
    "fish": ["fish", "salmon", "tuna", "trout", "cod", "mackerel"],
    "seafood": ["shrimp", "squid", "mussel", "oyster", "seafood", "crab", "prawn"],
    "soy": ["soy", "soya", "tofu"],
    "lactose": ["milk", "cream", "kefir", "yogurt", "lactose"],
}


def _normalize_product_name(p):
    """Extract product name from a string or dict."""
    if isinstance(p, str):
        return p.strip()
    if isinstance(p, dict):
        return (p.get("name") or p.get("product_name") or "").strip()
    return str(p).strip()


def _expand_allergens(allergens):
    keywords = []
    for a in allergens:
        low = a.lower().strip()
        if low in ALLERGEN_MAP:
            keywords.extend(ALLERGEN_MAP[low])
        else:
            keywords.append(low)
    return list(set(keywords))


def _ingredient_is_safe(ingredient, bad_keywords):
    low = ingredient.lower()
    return not any(kw in low for kw in bad_keywords)


def _recipe_is_safe(recipe, bad_keywords):
    name = recipe.get("name", "").lower()
    ingredients = recipe.get("ingredients", [])
    if isinstance(ingredients, str):
        ingredients = [ingredients]
    texts = [name] + [i.lower() if isinstance(i, str) else str(i).lower() for i in ingredients]
    return not any(kw in t for t in texts for kw in bad_keywords)





#Fallback recipe library (12 curated recipes)
FALLBACK_RECIPES = [
    {
        "name": "Oatmeal with Banana and Honey",
        "meal_type": "breakfast",
        "ingredients": ["oats 60g", "banana 1 pc", "honey 1 tbsp", "milk 200ml"],
        "instructions": "Cook oatmeal in milk for 5 minutes. Slice the banana and place on top. Drizzle with honey.",
        "prep_time": "5 min",
        "cook_time": "5 min",
        "nutrition": {"calories": 350, "protein": 10, "carbs": 60, "fat": 8},
    },
    {
        "name": "Scrambled Eggs with Toast and Avocado",
        "meal_type": "breakfast",
        "ingredients": ["eggs 2 pc", "toast bread 2 slices", "avocado 1/2 pc", "salt, pepper"],
        "instructions": "Fry the eggs in a pan. Toast the bread. Slice avocado and place on top.",
        "prep_time": "3 min",
        "cook_time": "5 min",
        "nutrition": {"calories": 420, "protein": 18, "carbs": 30, "fat": 26},
    },
    {
        "name": "Cottage Cheese Bake with Raisins",
        "meal_type": "breakfast",
        "ingredients": ["cottage cheese 250g", "egg 1 pc", "sugar 2 tbsp", "raisins 30g", "semolina 2 tbsp"],
        "instructions": "Mix cottage cheese, egg, sugar, semolina and raisins. Pour into a baking dish and bake at 180C for 25 minutes.",
        "prep_time": "10 min",
        "cook_time": "25 min",
        "nutrition": {"calories": 380, "protein": 22, "carbs": 42, "fat": 12},
    },
    {
        "name": "Chicken Breast with Rice and Vegetables",
        "meal_type": "lunch",
        "ingredients": ["chicken breast 200g", "rice 100g", "broccoli 100g", "carrot 1 pc", "soy sauce 1 tbsp"],
        "instructions": "Boil rice. Dice chicken and fry for 7 minutes. Add vegetables and soy sauce, simmer for 5 minutes.",
        "prep_time": "10 min",
        "cook_time": "20 min",
        "nutrition": {"calories": 480, "protein": 42, "carbs": 52, "fat": 8},
    },
    {
        "name": "Pasta with Tomato Sauce and Basil",
        "meal_type": "lunch",
        "ingredients": ["spaghetti 100g", "tomatoes 3 pc", "garlic 2 cloves", "basil", "olive oil 1 tbsp"],
        "instructions": "Cook pasta. Fry garlic, add chopped tomatoes, simmer 10 min. Mix with pasta and basil.",
        "prep_time": "5 min",
        "cook_time": "15 min",
        "nutrition": {"calories": 450, "protein": 14, "carbs": 72, "fat": 12},
    },
    {
        "name": "Greek Salad with Feta",
        "meal_type": "lunch",
        "ingredients": ["tomatoes 2 pc", "cucumber 1 pc", "bell pepper 1 pc", "feta 100g", "olives 50g", "olive oil"],
        "instructions": "Dice all vegetables. Add feta and olives. Dress with olive oil.",
        "prep_time": "10 min",
        "cook_time": "0 min",
        "nutrition": {"calories": 320, "protein": 14, "carbs": 18, "fat": 22},
    },
    {
        "name": "Baked Salmon with Potatoes",
        "meal_type": "dinner",
        "ingredients": ["salmon fillet 200g", "potatoes 3 pc", "lemon 1/2 pc", "dill", "olive oil"],
        "instructions": "Cut potatoes into wedges. Place fish and potatoes on a baking sheet, drizzle with oil and lemon. Bake at 200C for 25 minutes.",
        "prep_time": "10 min",
        "cook_time": "25 min",
        "nutrition": {"calories": 520, "protein": 38, "carbs": 40, "fat": 22},
    },
    {
        "name": "Beef Stew with Buckwheat",
        "meal_type": "dinner",
        "ingredients": ["beef 200g", "buckwheat 100g", "onion 1 pc", "carrot 1 pc", "tomato paste 1 tbsp"],
        "instructions": "Fry meat with onion, add carrot and tomato paste. Simmer 40 min. Serve with buckwheat.",
        "prep_time": "10 min",
        "cook_time": "45 min",
        "nutrition": {"calories": 550, "protein": 44, "carbs": 48, "fat": 16},
    },
    {
        "name": "Chicken Noodle Soup",
        "meal_type": "dinner",
        "ingredients": ["chicken 300g", "noodles 80g", "potatoes 2 pc", "carrot 1 pc", "onion 1 pc", "herbs"],
        "instructions": "Boil chicken, remove and chop. Add potatoes, carrot, onion to broth. Add noodles and chicken 5 min before done.",
        "prep_time": "15 min",
        "cook_time": "30 min",
        "nutrition": {"calories": 420, "protein": 32, "carbs": 44, "fat": 12},
    },
    {
        "name": "Yogurt with Granola and Berries",
        "meal_type": "snack",
        "ingredients": ["plain yogurt 200g", "granola 40g", "berries (blueberry/strawberry) 50g"],
        "instructions": "Put yogurt in a bowl. Add granola and fresh berries on top.",
        "prep_time": "3 min",
        "cook_time": "0 min",
        "nutrition": {"calories": 250, "protein": 12, "carbs": 34, "fat": 8},
    },
    {
        "name": "Banana Oat Smoothie",
        "meal_type": "snack",
        "ingredients": ["banana 1 pc", "milk 200ml", "oats 2 tbsp", "honey 1 tsp"],
        "instructions": "Blend all ingredients until smooth. Serve immediately.",
        "prep_time": "5 min",
        "cook_time": "0 min",
        "nutrition": {"calories": 280, "protein": 8, "carbs": 48, "fat": 6},
    },
    {
        "name": "Cottage Cheese Pancakes with Sour Cream",
        "meal_type": "snack",
        "ingredients": ["cottage cheese 200g", "egg 1 pc", "flour 2 tbsp", "sugar 1 tbsp", "sour cream for serving"],
        "instructions": "Mix cottage cheese, egg, flour and sugar. Form small pancakes and fry 3 minutes per side.",
        "prep_time": "10 min",
        "cook_time": "8 min",
        "nutrition": {"calories": 340, "protein": 20, "carbs": 28, "fat": 16},
    },
]


class RecipeGenerationService:

    def __init__(self, vertex_service):
        self.vertex_service = vertex_service
        self.fallback_recipes = FALLBACK_RECIPES
        logger.info("RecipeGenerationService initialised")

    #TheMealDB helper
    def _fetch_themealdb_recipes(self, query="", category="", count=3):
        """Fetch real recipes from TheMealDB (free, no API key)."""
        recipes = []
        try:
            urls = []
            if query:
                urls.append(f"https://www.themealdb.com/api/json/v1/1/search.php?s={query}")
            if category:
                urls.append(f"https://www.themealdb.com/api/json/v1/1/filter.php?c={category}")
            if not urls:
                urls.append("https://www.themealdb.com/api/json/v1/1/random.php")

            with httpx.Client(timeout=10.0) as client:
                for url in urls:
                    if len(recipes) >= count:
                        break
                    try:
                        resp = client.get(url)
                        if resp.status_code == 200:
                            data = resp.json()
                            meals = data.get("meals") or []
                            for meal in meals[:count - len(recipes)]:
                                recipe = self._parse_themealdb_meal(meal, client)
                                if recipe:
                                    recipes.append(recipe)
                    except Exception as e:
                        logger.warning(f"TheMealDB request failed: {e}")
        except Exception as e:
            logger.warning(f"TheMealDB fetch error: {e}")
        return recipes

    def _parse_themealdb_meal(self, meal, client=None):
        """Parse a TheMealDB meal object into our recipe format."""
        try:
            meal_id = meal.get("idMeal", "")
            name = meal.get("strMeal", "Unknown")
            category = meal.get("strCategory", "")
            instructions = meal.get("strInstructions", "")
            source_url = meal.get("strSource", "")

            if not instructions and meal_id and client:
                try:
                    detail_resp = client.get(f"https://www.themealdb.com/api/json/v1/1/lookup.php?i={meal_id}")
                    if detail_resp.status_code == 200:
                        detail_data = detail_resp.json()
                        detail_meals = detail_data.get("meals") or []
                        if detail_meals:
                            meal = detail_meals[0]
                            instructions = meal.get("strInstructions", "")
                            source_url = meal.get("strSource", "")
                except Exception:
                    pass

            ingredients = []
            for i in range(1, 21):
                ingredient = meal.get(f"strIngredient{i}", "")
                measure = meal.get(f"strMeasure{i}", "")
                if ingredient and ingredient.strip():
                    if measure and measure.strip():
                        ingredients.append(f"{measure.strip()} {ingredient.strip()}")
                    else:
                        ingredients.append(ingredient.strip())

            meal_type = "lunch"
            cat_lower = (category or "").lower()
            if cat_lower in ("breakfast", "starter"):
                meal_type = "breakfast"
            elif cat_lower in ("dessert", "side"):
                meal_type = "snack"
            elif cat_lower in ("beef", "chicken", "lamb", "pork", "seafood", "pasta"):
                meal_type = "dinner"

            return {
                "name": name,
                "meal_type": meal_type,
                "ingredients": ingredients,
                "instructions": instructions[:500] if instructions else "See source for full recipe",
                "source_url": source_url,
                "prep_time": "15 min",
                "cook_time": "30 min",
                "nutrition": {
                    "calories": random.randint(300, 600),
                    "protein": random.randint(15, 40),
                    "carbs": random.randint(30, 70),
                    "fat": random.randint(8, 25),
                },
            }
        except Exception as e:
            logger.warning(f"Failed to parse TheMealDB meal: {e}")
            return None

    #AI prompt helpers
    def _build_allergy_block(self, allergies, disliked):
        """Build the allergy/disliked section for AI prompts (English)."""
        parts = []
        if allergies:
            parts.append(f"STRICTLY FORBIDDEN allergens (NEVER use these): {', '.join(allergies)}")
        if disliked:
            parts.append(f"Disliked products (avoid when possible): {', '.join(disliked)}")
        return "\n".join(parts)

    #generate recipes from session products



    def generate_recipes_from_session(self, products, dietary_restrictions=None,
                                       cuisine_preference="Any", max_recipes=5,
                                       allergies=None, disliked_products=None):
        allergies = allergies or []
        disliked_products = disliked_products or []

        product_names = [_normalize_product_name(p) for p in products if p]
        product_names = [n for n in product_names if n]

        if not product_names:
            logger.warning("No valid product names - returning fallback recipes")
            return self._get_fallback_recipes(max_recipes, allergies=allergies, disliked=disliked_products)

        allergy_block = self._build_allergy_block(allergies, disliked_products)
        restrictions_str = ", ".join(dietary_restrictions) if dietary_restrictions else "none"

        prompt = f"""You are a professional nutritionist. Create {max_recipes} recipes from the following products.

            Available products: {', '.join(product_names)}

            Dietary restrictions: {restrictions_str}
            Cuisine: {cuisine_preference}

            {allergy_block}

            For each recipe return a JSON array:
            [
            {{
                "name": "recipe name",
                "meal_type": "breakfast|lunch|dinner|snack",
                "ingredients": ["ingredient 1", "ingredient 2"],
                "instructions": "step-by-step instructions",
                "prep_time": "10 min",
                "cook_time": "20 min",
                "nutrition": {{"calories": 400, "protein": 25, "carbs": 45, "fat": 15}}
            }}
            ]

            Respond ONLY with a valid JSON array, no markdown.
            """
        try:
            response = self.vertex_service.generate_text_sync(prompt)
            if response.get("success") and response.get("content"):
                recipes = self._parse_recipes_json(response["content"])
                if recipes:
                    logger.info(f"AI generated {len(recipes)} recipes from session products")
                    return recipes[:max_recipes]
        except Exception as e:
            logger.error(f"AI recipe generation failed: {e}")

        logger.info("Falling back to local recipe library")
        return self._get_fallback_recipes(max_recipes, allergies=allergies, disliked=disliked_products)





    def _suggest_dishes_with_ai(self, meal_type, cuisine, restrictions, count=3, allergies=None, disliked=None):
        allergies = allergies or []
        disliked = disliked or []
        allergy_block = self._build_allergy_block(allergies, disliked)
        restrictions_str = ", ".join(restrictions) if restrictions else "none"

        prompt = f"""Suggest {count} dish names for the meal "{meal_type}".
                Cuisine: {cuisine}
                Restrictions: {restrictions_str}
                {allergy_block}

                Respond ONLY with a JSON array of strings, e.g.: ["Dish 1", "Dish 2", "Dish 3"]
                """
        try:
            response = self.vertex_service.generate_text_sync(prompt, max_tokens=500, temperature=0.7)
            if response.get("success") and response.get("content"):
                text = response["content"].strip()
                names = json.loads(self._extract_json(text))
                if isinstance(names, list):
                    return [str(n) for n in names[:count]]
        except Exception as e:
            logger.warning(f"AI dish suggestion failed: {e}")
        return []



    #generate_meal_plan_from_session

    def generate_meal_plan_from_session(self, session_products, days=3,  #generate a meal plan using the user's scanned/saved products - main entry point for session-based plan generation
                                         meals_per_day=3, dietary_restrictions=None,
                                         cuisine_preference="Any",
                                         daily_calorie_target=None,
                                         allergies=None,
                                         disliked_products=None):
        meal_types = ["breakfast", "lunch", "dinner", "snack"][:meals_per_day]
        return self.generate_meal_plan_with_products(
            products=session_products,
            days=days,
            meals=meal_types,
            dietary_restrictions=dietary_restrictions or [],
            cuisine_preference=cuisine_preference,
            daily_calorie_target=daily_calorie_target,
            allergies=allergies or [],
            disliked_products=disliked_products or [],
        )


    #MAIN - generate_generic_meal_plan
    def generate_generic_meal_plan(self, days=3, meals=None,        #general plan without specific products - just based on user preferences and restrictions
                                    dietary_restrictions=None,
                                    cuisine_preference="Any",
                                    daily_calorie_target=None,
                                    user_preferences=None,
                                    allergies=None,
                                    disliked_products=None):
        meals = meals or ["breakfast", "lunch", "dinner"]
        allergies = allergies or []
        disliked_products = disliked_products or []
        calorie_target = daily_calorie_target or 2000
        restrictions_str = ", ".join(dietary_restrictions) if dietary_restrictions else "none"
        allergy_block = self._build_allergy_block(allergies, disliked_products)

        meals_desc = ", ".join(meals)
        prompt = f"""You are a professional nutritionist. Create a meal plan for {days} days.

        Meals per day: {meals_desc}
        Daily calorie target: ~{calorie_target} kcal
        Dietary restrictions: {restrictions_str}
        Cuisine: {cuisine_preference}

        {allergy_block}

        IMPORTANT: For EACH meal provide realistic macros (calories, protein, carbs, fat). Daily total should be approximately {calorie_target} kcal.

        Response format - ONLY a JSON array (no markdown):
        [
        {{
            "day": 1,
            "meal_type": "breakfast",
            "name": "Oatmeal with fruits",
            "ingredients": ["oats 60g", "banana 1 pc", "honey 1 tbsp"],
            "instructions": "Cook oatmeal...",
            "prep_time": "5 min",
            "cook_time": "10 min",
            "nutrition": {{"calories": 350, "protein": 10, "carbs": 55, "fat": 8}}
        }}
        ]

        Total should be {days * len(meals)} objects (days: {days}, meals: {len(meals)}).
        Respond ONLY with a valid JSON array.
        """
        logger.info(f"Generating generic meal plan: {days} days, {len(meals)} meals/day, {calorie_target} kcal")

        try:
            response = self.vertex_service.generate_text_sync(prompt, max_tokens=8192, temperature=0.7)
            if response.get("success") and response.get("content"):
                plan = self._parse_meal_plan_json(response["content"], days, meals)
                if plan:
                    logger.info(f"AI generated generic meal plan: {len(plan)} meals")
                    return {"plan": plan, "source": "ai", "total_meals": len(plan)}
                else:
                    logger.warning("AI response could not be parsed into a valid meal plan")
            else:
                logger.warning(f"AI call failed or returned no content: {response}")
        except Exception as e:
            logger.error(f"AI generic meal plan generation error: {e}")

        #fllback
        logger.info("Using fallback for generic meal plan")
        plan = self._build_fallback_plan(days, meals, calorie_target, allergies, disliked_products)
        return {"plan": plan, "source": "fallback", "total_meals": len(plan)}

        #MAIN - generate_meal_plan_with_products
    def generate_meal_plan_with_products(self, products, days=3,
                                          meals=None,                       #generate a meal plan using specific products (from session or user input) - main entry point for product-based plan generation
                                          dietary_restrictions=None,
                                          cuisine_preference="Any",
                                          daily_calorie_target=None,
                                          allergies=None,
                                          disliked_products=None):
        meals = meals or ["breakfast", "lunch", "dinner"]
        allergies = allergies or []
        disliked_products = disliked_products or []
        calorie_target = daily_calorie_target or 2000

        #normalize products (can be str or dict)
        all_names = [_normalize_product_name(p) for p in products]
        all_names = [n for n in all_names if n]

        #filter products based on user preferences (remove disliked/allergens)
        bad_kw = _expand_allergens(allergies + disliked_products)
        filtered_names = [n for n in all_names if not any(kw in n.lower() for kw in bad_kw)]

        if not filtered_names:
            filtered_names = all_names  #keep originals if nothing left

        product_list_str = ", ".join(filtered_names[:30])
        restrictions_str = ", ".join(dietary_restrictions) if dietary_restrictions else "none"
        allergy_block = self._build_allergy_block(allergies, disliked_products)
        meals_desc = ", ".join(meals)

        prompt = f"""You are a professional nutritionist. Create a meal plan for {days} days
        using primarily these products: {product_list_str}

        Meals per day: {meals_desc}
        Daily calorie target: ~{calorie_target} kcal
        Dietary restrictions: {restrictions_str}
        Cuisine: {cuisine_preference}

        {allergy_block}

        IMPORTANT:
        - Use the listed products as the base, but you may add basic ingredients (salt, oil, spices).
        - For EACH meal provide realistic macros (calories, protein, carbs, fat). Daily total should be approximately {calorie_target} kcal.

        Response format - ONLY a JSON array (no markdown):
        [
        {{
            "day": 1,
            "meal_type": "breakfast",
            "name": "Dish name",
            "ingredients": ["product 1", "product 2"],
            "instructions": "Cooking steps...",
            "prep_time": "5 min",
            "cook_time": "10 min",
            "nutrition": {{"calories": 350, "protein": 10, "carbs": 55, "fat": 8}}
        }}
        ]

        Total should be {days * len(meals)} objects (days: {days}, meals: {len(meals)}).
        Respond ONLY with a valid JSON array.
        """
        logger.info(f"Generating product-based meal plan: {days} days, {len(meals)} meals/day, {len(filtered_names)} products")

        try:
            response = self.vertex_service.generate_text_sync(prompt, max_tokens=8192, temperature=0.7)
            if response.get("success") and response.get("content"):
                plan = self._parse_meal_plan_json(response["content"], days, meals)
                if plan:
                    logger.info(f"AI generated product-based meal plan: {len(plan)} meals")
                    return {"plan": plan, "source": "ai", "total_meals": len(plan)}
                else:
                    logger.warning("AI response could not be parsed into a valid meal plan")
            else:
                logger.warning(f"AI call failed or returned no content: {response}")
        except Exception as e:
            logger.error(f"AI product meal plan generation error: {e}")

        # Fallback
        logger.info("Using fallback for product-based meal plan")
        plan = self._build_fallback_plan(days, meals, calorie_target, allergies, disliked_products)
        return {"plan": plan, "source": "fallback", "total_meals": len(plan)}



    #JSON parsing helpers



    def _extract_json(self, text):
        text = text.strip()
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        return text.strip()

    def _parse_recipes_json(self, text):
        try:
            cleaned = self._extract_json(text)
            data = json.loads(cleaned)
            if isinstance(data, list):
                return data
            if isinstance(data, dict):
                return [data]
        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse error in recipes: {e}")
            match = re.search(r'\[.*\]', text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass
        return []

    def _parse_meal_plan_json(self, text, expected_days, expected_meals):
        try:
            cleaned = self._extract_json(text)
            data = json.loads(cleaned)
            if not isinstance(data, list):
                logger.warning("Meal plan response is not a list")
                return []

            validated = []
            for item in data:
                if not isinstance(item, dict):
                    continue
                meal = {
                    "day": item.get("day", 1),
                    "meal_type": item.get("meal_type", "lunch"),
                    "name": item.get("name", "Unnamed"),
                    "ingredients": item.get("ingredients", []),
                    "instructions": item.get("instructions", ""),
                    "prep_time": item.get("prep_time", "10 min"),
                    "cook_time": item.get("cook_time", "20 min"),
                    "source_url": item.get("source_url", ""),
                    "nutrition": {
                        "calories": item.get("nutrition", {}).get("calories", 400),
                        "protein": item.get("nutrition", {}).get("protein", 20),
                        "carbs": item.get("nutrition", {}).get("carbs", 50),
                        "fat": item.get("nutrition", {}).get("fat", 15),
                    },
                }
                if meal["day"] < 1:
                    meal["day"] = 1
                if meal["day"] > expected_days:
                    meal["day"] = expected_days
                validated.append(meal)

            if len(validated) >= 2:
                return validated
            logger.warning(f"Only {len(validated)} valid meals parsed from AI response")
            return validated if validated else []

        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse error in meal plan: {e}")
            match = re.search(r'\[.*\]', text, re.DOTALL)
            if match:
                try:
                    return self._parse_meal_plan_json(match.group(), expected_days, expected_meals)
                except Exception:
                    pass
        return []

    #fallback plan builder



    def _build_fallback_plan(self, days, meals, calorie_target, allergies=None, disliked=None):
        allergies = allergies or []
        disliked = disliked or []
        bad_kw = _expand_allergens(allergies + disliked)

        by_type = {}
        for r in self.fallback_recipes:
            mt = r.get("meal_type", "lunch")
            if not _recipe_is_safe(r, bad_kw):
                continue
            by_type.setdefault(mt, []).append(r)

        #also try TheMealDB
        try:
            mealdb_recipes = self._fetch_themealdb_recipes(count=6)
            for r in mealdb_recipes:
                if _recipe_is_safe(r, bad_kw):
                    mt = r.get("meal_type", "lunch")
                    by_type.setdefault(mt, []).append(r)
        except Exception as e:
            logger.warning(f"TheMealDB fetch in fallback failed: {e}")

        plan = []
        for day in range(1, days + 1):
            for meal_type in meals:
                candidates = by_type.get(meal_type, [])
                if not candidates:
                    candidates = by_type.get("lunch", self.fallback_recipes[:3])

                recipe = random.choice(candidates) if candidates else self.fallback_recipes[0]
                meal_entry = {
                    "day": day,
                    "meal_type": meal_type,
                    "name": recipe.get("name", "Unnamed"),
                    "ingredients": recipe.get("ingredients", []),
                    "instructions": recipe.get("instructions", ""),
                    "prep_time": recipe.get("prep_time", "10 min"),
                    "cook_time": recipe.get("cook_time", "20 min"),
                    "source_url": recipe.get("source_url", ""),
                    "nutrition": recipe.get("nutrition", {"calories": 400, "protein": 20, "carbs": 50, "fat": 15}),
                }
                plan.append(meal_entry)

        if plan and calorie_target:
            self._adjust_calories(plan, days, calorie_target)

        return plan



    def _adjust_calories(self, plan, days, daily_target):
        from collections import defaultdict
        day_cals = defaultdict(float)
        day_meals = defaultdict(list)
        for m in plan:
            d = m.get("day", 1)
            cals = m.get("nutrition", {}).get("calories", 400)
            day_cals[d] += cals
            day_meals[d].append(m)

        for d, total in day_cals.items():
            if total <= 0:
                continue
            ratio = daily_target / total
            if 0.7 <= ratio <= 1.3:
                continue
            for m in day_meals[d]:
                nutr = m.get("nutrition", {})
                for key in ("calories", "protein", "carbs", "fat"):
                    if key in nutr:
                        nutr[key] = round(nutr[key] * ratio)


# Prompt engineering approach inspired by Google Generative AI best practices:
# https://cloud.google.com/architecture/ai-ml
    def _get_fallback_recipes(self, count, meal_type=None, allergies=None, disliked=None):
        allergies = allergies or []
        disliked = disliked or []
        bad_kw = _expand_allergens(allergies + disliked)

        candidates = self.fallback_recipes
        if meal_type:
            typed = [r for r in candidates if r.get("meal_type") == meal_type]
            if typed:
                candidates = typed

        safe = [r for r in candidates if _recipe_is_safe(r, bad_kw)]
        if not safe:
            safe = candidates

        random.shuffle(safe)
        return safe[:count]
