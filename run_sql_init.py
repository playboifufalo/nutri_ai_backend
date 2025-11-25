#!/usr/bin/env python3
import sqlite3
import os
from pathlib import Path

def run_sql_init():
    sql_file = Path(__file__).parent / "database_init.sql"
    db_file = Path(__file__).parent / "nutri_ai.db"
    
    print("=== Database initialization from SQL file ===\n")
    
    # Check SQL file existence
    if not sql_file.exists():
        print(f"SQL file not found: {sql_file}")
        return False
    print(f"SQL file: {sql_file}")
    print(f"Database: {db_file}")
    if db_file.exists():
        print(f"removing existing database...")
        os.remove(db_file)
    
    try:
        with open(sql_file, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        print(f"SQL file read ({len(sql_content)} characters)")
        conn = sqlite3.connect(db_file)
        conn.execute("PRAGMA foreign_keys = ON")
        

        
        print("database connection established")
        cursor = conn.cursor()
        cursor.executescript(sql_content)
        
        print("SQL script executed successfully")
        
        # Check result
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT username, login, is_active FROM users ORDER BY id")
        users = cursor.fetchall()
        
        print(f"initialization results:")
        print(f"users created: {user_count}")
        print(f"user list:")
        
        for user in users:
            status = "Active" if user[2] else "Inactive"
            print(f"     - {user[0]} ({user[1]}) - {status}")
        cursor.execute("PRAGMA index_list(users)")
        indexes = cursor.fetchall()
        print(f"indexes created: {len(indexes)}")
        
        conn.close()
        print("database successfully initialized!")
        return True
        
    except sqlite3.Error as e:
        print(f"SQLite error: {e}")
        return False
    except Exception as e:
        print(f"general error: {e}")
        return False

def verify_database():
    db_file = Path(__file__).parent / "nutri_ai.db"
    
    if not db_file.exists():
        print("db not found")
        return False
    
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        
        print("db structure check:")
        cursor.execute("PRAGMA table_info(users)")
        columns = cursor.fetchall()
        print("table users fields:")
        for col in columns:
            print(f"     - {col[1]} ({col[2]}) {'NOT NULL' if col[3] else 'NULL'}")
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='trigger'")
        triggers = cursor.fetchall()
        print(f"triggers: {[t[0] for t in triggers]}")
        print("\testing updated_at trigger:")
        cursor.execute("UPDATE users SET username = username WHERE id = 1")
        cursor.execute("SELECT username, updated_at FROM users WHERE id = 1")
        result = cursor.fetchone()
        
        if result[1]:
            print("updated_at trigger works correctly")
        else:
            print("updated_at trigger did not fire")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"verification error: {e}")
        return False

if __name__ == "__main__":
    success = run_sql_init()
    
    if success:
        verify_database()
    
    print("everything done!")