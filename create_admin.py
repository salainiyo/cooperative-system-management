from sqlmodel import Session
from db.database import engine
from models.users import User
from dependancies.auth import create_password_hash

def seed_admin():
    with Session(engine) as session:
        # Check if this admin already exists so we don't crash
        existing_admin = session.query(User).filter(User.email == "admin@gmail.com").first()
        
        if existing_admin:
            print("Admin already exists!")
            return

        # Create the master admin
        admin = User(
            email="admin@gmail.com",
            hashed_password=create_password_hash("admin@123"), # Change this!
            is_active=True,
            is_admin=True # The crucial flag!
        )
        
        session.add(admin)
        session.commit()
        print("Master Admin created successfully! You can now log in.")

if __name__ == "__main__":
    seed_admin()