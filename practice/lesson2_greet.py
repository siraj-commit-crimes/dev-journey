# Lesson 2: input and if/else

name = input("What is your name? ")

if name.lower() == "siraj":
    print(f"Welcome back, {name}! Ready to code with Najdi?")
elif name.lower() == "najdi":
    print(f"Hey {name}! Thanks for mentoring me.")
elif name.lower() == "jaafar":
    print(f"Hey {name}! Glad you're here too.")
else:
    print(f"Nice to meet you, {name}! Welcome to Python.")

print("Let's keep learning.")
