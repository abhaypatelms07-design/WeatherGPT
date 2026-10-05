"""Run only the chat-related tests and save output."""
import subprocess, sys, pathlib

result = subprocess.run(
    [sys.executable, "-m", "pytest",
     "tests/test_chat.py", "tests/test_modes.py", "tests/test_language.py",
     "-v", "--tb=short"],
    capture_output=True,
)

out = result.stdout
pathlib.Path("chat_tests_diag_out.txt").write_bytes(out)
print(out.decode("utf-16-le", errors="replace"))
if result.stderr.strip():
    print("STDERR:", result.stderr.decode("utf-16-le", errors="replace")[:500])
print(f"\nEXIT CODE: {result.returncode}")
sys.exit(result.returncode)
