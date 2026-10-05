"""Run the full test suite and save output to pytest_final_out.txt."""
import subprocess, sys, pathlib

result = subprocess.run(
    [sys.executable, "-m", "pytest", "tests/", "-v", "--tb=short"],
    capture_output=True,
)

# Write raw bytes — avoids any encoding mismatch with pytest's UTF-16 LE output
pathlib.Path("pytest_final_out.txt").write_bytes(result.stdout)

# Also decode for terminal display (replace bad chars)
text = result.stdout.decode("utf-16-le", errors="replace")
print(text)
if result.stderr:
    err = result.stderr.decode("utf-16-le", errors="replace")
    print("STDERR:", err[:500])
print(f"EXIT CODE: {result.returncode}")
sys.exit(result.returncode)
