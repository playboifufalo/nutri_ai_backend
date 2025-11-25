#!/usr/bin/env python3
from app.models.database import engine  #db initialization file
from app.models import Base, User
from app.models.database import SessionLocal

def init_database():
    """Creates all tables in the database"""
    print("Creating tables in database...")
    Base.metadata.create_all(bind=engine)
    print("Tables successfully created!")

def create_test_user():
    """Creates a test user"""
    db = SessionLocal()
    try:
        existing_user = db.query(User).first()
        if existing_user:
            print("Users already exist in database")
            return
        test_user = User(
            username="testuser",
            login="test@example.com"
        )
        test_user.set_password("testpassword123")
        
        db.add(test_user)
        db.commit()
        print("Test user created:")
        print(f"  Username: {test_user.username}")
        print(f"  Login: {test_user.login}")
        print(f"  ID: {test_user.id}")
        
    except Exception as e:
        print(f"Error creating test user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_database()
    create_test_user()