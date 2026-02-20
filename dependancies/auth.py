from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()

def create_password_hash(plain_password: str)-> str:
    return password_hash.hash(plain_password)