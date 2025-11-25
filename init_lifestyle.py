"""
Initialize lifestyle preferences data in the database
"""

import sqlite3
import os
from datetime import datetime
DB_PATH = "data/nutri_ai.db"

def init_lifestyle_data():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    


    lifestyle_types = [
        #activity levels
        ("sedentary", "activity", "Minimal physical activity, desk job", True),
        ("lightly-active", "activity", "Light exercise 1-3 times per week", True),
        ("moderately-active", "activity", "Moderate exercise 3-5 times per week", True),
        ("very-active", "activity", "Heavy exercise 6-7 times per week", True),
        ("extremely-active", "activity", "Very heavy exercise, physical job, training twice per day", True),
        
        #schedule preferences
        ("early-bird", "schedule", "Prefers early morning activities and meals", True),
        ("night-owl", "schedule", "Prefers evening activities and late meals", True),
        ("regular-schedule", "schedule", "Consistent daily routine and meal times", True),
        ("irregular-schedule", "schedule", "Variable schedule, flexible meal timing", True),
        
        #social eating habits
        ("family-oriented", "social", "Enjoys family meals and cooking together", True),
        ("social-eater", "social", "Prefers dining out and social food experiences", True),
        ("solo-eater", "social", "Comfortable eating alone, values quiet meals", True),
        ("meal-prepper", "social", "Enjoys planning and preparing meals in advance", True),
        
        #health focus areas
        ("weight-management", "health", "Focused on maintaining healthy weight", True),
        ("muscle-building", "health", "Focused on building muscle mass", True),
        ("endurance-training", "health", "Focused on cardiovascular endurance", True),
        ("recovery-focused", "health", "Focused on recovery and healing", True),
        ("stress-management", "health", "Focused on managing stress through diet", True)
    ]
    
    try:
        print("Inserting lifestyle types...")
        cursor.executemany("""
            INSERT OR REPLACE INTO lifestyle_types (name, category, description, is_active)
            VALUES (?, ?, ?, ?)
        """, lifestyle_types)
        conn.commit()
        print(f"inserted {len(lifestyle_types)} lifestyle types")
        
        cursor.execute("SELECT COUNT(*) FROM lifestyle_types WHERE is_active = 1")
        count = cursor.fetchone()[0]
        print(f"overall lifestle types: {count}")
        
        cursor.execute("""
            SELECT category, COUNT(*) as count
            FROM lifestyle_types 
            WHERE is_active = 1
            GROUP BY category
            ORDER BY category
        """)

        for category, count in cursor.fetchall():
            print(f"  • {category}: {count} types")
            
    except sqlite3.Error as e:
        print(f"db error {e}")
        conn.rollback()
        return False
        
    finally:
        conn.close()
    
    return True

def verify_database_structure():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        tables_to_check = ["lifestyle_types", "user_lifestyle_preferences"]
        
        print("checking db structure")
        for table in tables_to_check:
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name=?
            """, (table,))
            if cursor.fetchone():
                print(f"table '{table}' exists")
                cursor.execute(f"PRAGMA table_info({table})")
                columns = cursor.fetchall()
                print(f"columns: {', '.join([col[1] for col in columns])}")
            else:
                print(f"table '{table}' is missing")
        cursor.execute("PRAGMA foreign_key_list(user_lifestyle_preferences)")
        foreign_keys = cursor.fetchall()
        
        if foreign_keys:
            print(f"foregidn key constraints found: {len(foreign_keys)}")
        else:
            print("no foreign key found")
            
        return True
        
    except sqlite3.Error as e:
        print(f"couldnt verifying structure: {e}")
        return False
        
    finally:
        conn.close()

def add_sample_user_preferences():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id, username FROM users WHERE is_active = 1 LIMIT 5")
        users = cursor.fetchall()
        
        if not users:
            print("no users found to add sample preferences")
            return True
            
        cursor.execute("SELECT id, name, category FROM lifestyle_types WHERE is_active = 1") #get lifestyle type IDs
        lifestyle_types = cursor.fetchall()
        lifestyle_dict = {name: (id, category) for id, name, category in lifestyle_types}
        
        sample_preferences = [
            ("moderately-active", 1, 4),
            ("muscle-building", 2, 5),
            ("meal-prepper", 3, 4),
            ("regular-schedule", 4, 3),
            ("lightly-active", 1, 3),
            ("weight-management", 2, 4),
            ("family-oriented", 3, 4),
            ("early-bird", 4, 3),
        ]
        
        print("adding sample lifestyle preferences")
        
        for i, user in enumerate(users):
            user_id = user[0]
            username = user[1]
            preferences_to_add = sample_preferences[i*4:(i+1)*4] if i < len(sample_preferences)//4 else sample_preferences[:4]
            
            added_count = 0
            for lifestyle_name, priority, intensity in preferences_to_add:
                if lifestyle_name in lifestyle_dict:
                    lifestyle_id, category = lifestyle_dict[lifestyle_name]
                    cursor.execute("""
                        SELECT id FROM user_lifestyle_preferences 
                        WHERE user_id = ? AND lifestyle_type_id = ?
                    """, (user_id, lifestyle_id))
                    
                    if not cursor.fetchone():
                        cursor.execute("""
                            INSERT INTO user_lifestyle_preferences 
                            (user_id, lifestyle_type_id, priority, intensity, notes, created_at)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """, (user_id, lifestyle_id, priority, intensity, 
                              f"Sample {category} preference", datetime.now()))
                        added_count += 1
            if added_count > 0:
                print(f"added {added_count} preferences for user '{username}'")
        conn.commit()
        return True
    except sqlite3.Error as e:
        print(f"couldnt add sample preferences: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

def main():
    print("initializing lifestyle preferences data")
    print(f"database: {DB_PATH}")
    
    if not os.path.exists(DB_PATH):
        print(f"database file not found: {DB_PATH}")
        print("please run the main database initialization first")
        return
    if not verify_database_structure():
        print("database structure verification failed")
        return
    if not init_lifestyle_data():
        print("failed to initialize lifestyle data")
        return
    if not add_sample_user_preferences():
        print("failed to add sample preferences")
        return
    
    print("lifestyle preferences initialization completed successfully!")
    print("you can now:")
    print("  • Access lifestyle types at /lifestyle/types")
    print("  • Get categories at /lifestyle/categories") 
    print("  • Manage user preferences at /lifestyle/me")
    print("  • Get recommendations at /lifestyle/me/recommendations")
    print("  • Check compatibility at /lifestyle/compatibility/{user_id}")

if __name__ == "__main__":
    main()