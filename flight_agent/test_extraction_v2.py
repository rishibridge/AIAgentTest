from agent import parse_flight_card

if __name__ == "__main__":
    # User provided text
    failing_text = """
    Book with AmericanAirline
    Basic Economy
    $259
    Seat selection for a fee
    Standard seat
    Priority boarding for a fee
    No ticket changes
    1 free carry-on
    1st checked bag: $80
    Main Cabin
    $319
    Free seat selection
    Extra legroom available for a fee
    Priority boarding for a fee
    Free change, possible fare difference
    1 free carry-on
    1st checked bag: $80
    Main Plus
    $441
    Free seat selection
    Extra legroom
    Priority boarding for a fee
    Free change, possible fare difference
    1 free carry-on
    1st checked bag free
    """
    
    print("--- TESTING FAILING TEXT ---")
    result = parse_flight_card(failing_text)
    print(f"\nResult: {result}")
    
    if result == 259.0:
        print("FAIL: Basic Economy price ($259) was selected!")
    elif result == 319.0:
        print("SUCCESS: Main Cabin price ($319) was selected.")
    else:
        print(f"Unexpected result: {result}")
