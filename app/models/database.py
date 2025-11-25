from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

#load env
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./nutri_ai.db")

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False} #IMPORTANT FOR SQLITE!!!
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():  #importing db
    from . import user, food
    Base.metadata.create_all(bind=engine)