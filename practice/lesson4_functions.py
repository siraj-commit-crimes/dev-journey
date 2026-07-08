# Lesson 4: functions

def greet(name):
    print(f"Hello, {name}!")


def greet_special(name):
    if name.lower() == "siraj":
        return "Welcome back, Siraj!"
    elif name.lower() == "najdi":
        return "Thanks for mentoring me, Najdi!"
    elif name.lower() == "jaafar":
        return "Glad you are here, Jaafar!"
    else:
        return f"Nice to meet you, {name}!"


def add(a, b):
    return a + b


print("=== basic function ===")
greet("Siraj")
greet("Najdi")

print("\n=== function with return ===")
message = greet_special("Jaafar")
print(message)

print("\n=== function with numbers ===")
total = add(5, 3)
print(f"5 + 3 = {total}")

print("\n=== using a function in a loop ===")
team = ["Siraj", "Najdi", "Jaafar"]
for person in team:
    print(greet_special(person))

print("\n=== my homework: skill function ===")


def show_skill(skill):
    return f"I learned {skill}!"


for item in ["Git", "Terminal", "Python"]:
    print(show_skill(item))
