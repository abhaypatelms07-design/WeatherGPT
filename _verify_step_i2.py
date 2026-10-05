import subprocess, sys
result = subprocess.run(
    [sys.executable, "-m", "pytest", "tests/", "--tb=short", "-q"],
    capture_output=True, text=True
)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr[:500])
print("EXIT CODE:", result.returncode)
