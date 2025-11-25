#!/usr/bin/env python3
"""
Demonstration of user database operations
"""

from app.models.database import SessionLocal
from app.models.user import User

def demo_user_operations():
    """Demonstrates user operations"""
    print("=== User Operations Demonstration ===\n")
    db = SessionLocal()
    
    try:
        print("1. View existing users:")
        users = db.query(User).all()
        for user in users:
            print(f"   - {user}")
        
        print(f"\n   Total users: {len(users)}")
        
        print("\n2. Creating new user:")
        new_user = User(
            username="demo_user",
            login="demo@example.com"
        )
        new_user.set_password("demo_password_123")
        existing = db.query(User).filter(
            (User.username == new_user.username) | (User.login == new_user.login)
        ).first()
        
        if existing:
            print(f"user with this login or username already exists: {existing}")
        else:
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            print(f"user created: {new_user}")
        
        print("\n3. Password verification:")
        test_user = db.query(User).filter(User.username == "testuser").first()
        if test_user:
            # Check correct password
            if test_user.verify_password("testpassword123"):
                print("correct password for testuser")
            else:
                print("incorrect password for testuser")
            
            # Check wrong password
            if test_user.verify_password("wrongpassword"):
                print("password verification failed")
            else:
                print("wrong password rejected")
        
        print("\n4. User search:")
        user_by_login = db.query(User).filter(User.login == "test@example.com").first()
        if user_by_login:
            print(f"found user by login: {user_by_login}")
        
        user_by_username = db.query(User).filter(User.username == "testuser").first()
        if user_by_username:
            print(f"found user by username: {user_by_username}")
        
        print("\n5. Final user list:")
        final_users = db.query(User).all()
        for user in final_users:
            print(f"- ID: {user.id}, Username: {user.username}, Login: {user.login}, Active: {user.is_active}")
        
        print(f"\ntotal users: {len(final_users)}")
        
    except Exception as e:
        print(f"error! error number: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    demo_user_operations()
    print("\n=== demonstration completed ===")