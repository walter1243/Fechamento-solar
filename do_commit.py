import subprocess
import os

os.chdir(r"c:\Users\USER\Documents\app fechamento")
subprocess.run(["git", "add", "-A"])
subprocess.run(["git", "commit", "-m", "feat: implementar exclusao de operadores com validacao de senha solar013"])
subprocess.run(["git", "push"])
print("✓ Commit e push realizado com sucesso!")
