# Lesson 6: dictionaries

team_info = {
    "siraj": "Learning Python and Git",
    "najdi": "Mentor",
    "jaafar": "Friend on the journey",
}

skills = {
    "Git": "done",
    "Terminal": "done",
    "Python": "in progress",
}


def describe_person(name):
    key = name.lower()
    if key in team_info:
        return f"{name}: {team_info[key]}"
    return f"{name}: not in the team yet"


print("=== read from a dictionary ===")
print(team_info["najdi"])

print("\n=== loop over dictionary ===")
for name, role in team_info.items():
    print(f"{name} -> {role}")

print("\n=== dictionary with a function ===")
print(describe_person("Siraj"))
print(describe_person("Alex"))

print("\n=== update a dictionary ===")
skills["Python"] = "lesson 6"
skills["Files"] = "done"
print(skills)

print("\n=== my homework: add myself to skills ===")
skills["Lesson 6"] = "done"
for skill, status in skills.items():
    print(f"{skill}: {status}")
