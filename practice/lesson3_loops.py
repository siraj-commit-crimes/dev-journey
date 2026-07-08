# Lesson 3: loops

team = ["Siraj", "Najdi", "Jaafar"]

print("=== for loop: greet each person ===")
for person in team:
    print(f"Hello, {person}!")

print("\n=== for loop with range: count 1 to 5 ===")
for number in range(1, 6):
    print(f"Count: {number}")

print("\n=== while loop: countdown ===")
count = 3
while count > 0:
    print(f"T-minus {count}...")
    count = count - 1

print("Go! Start coding.")

print("\n==== my homework: skills list ===")

skills = ["Git", "Terminal", "Python"]
for skill in skills:
    print(f"I learned {skill}!")

