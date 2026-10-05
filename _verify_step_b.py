import subprocess
result = subprocess.run(
    ["netstat", "-ano"],
    capture_output=True, text=True
)
lines = [l for l in result.stdout.splitlines() if ":8000 " in l]
if lines:
    for l in lines:
        print(l)
else:
    print("PORT 8000: FREE (no process found)")
