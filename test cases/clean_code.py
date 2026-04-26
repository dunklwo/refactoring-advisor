MAX_RETRIES = 3
TIMEOUT_SECONDS = 30
MIN_PASSWORD_LENGTH = 8

def is_valid_email(email: str) -> bool:
    return "@" in email and "." in email

def is_valid_age(age: int) -> bool:
    return 0 < age < 150

def is_valid_name(name: str) -> bool:
    return bool(name and len(name) > 0)

def validate_user(name: str, age: int, email: str) -> bool:
    if not is_valid_name(name):
        return False
    if not is_valid_age(age):
        return False
    if not is_valid_email(email):
        return False
    return True

def calculate_discount(price: float, rate: float) -> float:
    return price * rate / 100

def apply_tax(price: float, tax_rate: float) -> float:
    return price * (1 + tax_rate / 100)

def get_final_price(base_price: float, discount_rate: float, tax_rate: float) -> float:
    discounted = calculate_discount(base_price, discount_rate)
    after_discount = base_price - discounted
    return apply_tax(after_discount, tax_rate)