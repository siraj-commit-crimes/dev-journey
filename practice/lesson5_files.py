# Lesson 5: reading and writing files

def read_file(path):
    with open(path, "r", encoding="utf-8") as file:
        return file.read()


def write_line(path, text):
    with open(path, "a", encoding="utf-8") as file:
        file.write(text + "\n")


print("=== read a file ===")
hello_text = read_file("practice/hello.txt")
print(hello_text)

print("=== write to a log file ===")
write_line("practice/learning_log.txt", "Day 2: started Python lesson 5")
write_line("practice/learning_log.txt", "Learned: open(), read(), write()")

print("=== read the log back ===")
log_text = read_file("practice/learning_log.txt")
print(log_text)

print("=== loop over lines ===")
for line in log_text.splitlines():
    print(f"Log entry: {line}")
print("\n=== my homework: add my own log entry ===")
write_line("practice/learning_log.txt", "Siraj finished lesson 5 homework")
homework_log = read_file("practice/learning_log.txt")
print(homework_log)
