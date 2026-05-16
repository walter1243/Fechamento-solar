import argparse
import importlib
import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path
import win32print

SERVICE_HOST = "127.0.0.1"
SERVICE_PORT = 8000
SERVICE_STATUS_URL = f"http://{SERVICE_HOST}:{SERVICE_PORT}/status_impressora"
PRINTER_NAME = os.getenv("FECHAMENTO_PRINTER", "Impressora_Caixa")
CHROME_CANDIDATES = [
    Path("C:/Program Files/Google/Chrome/Application/chrome.exe"),
    Path("C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"),
]


def _is_port_open(host: str, port: int, timeout: float = 0.5) -> bool:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        sock.connect((host, port))
        return True
    except OSError:
        return False
    finally:
        sock.close()


def _pause_if_console(message: str = "\nPressione Enter para sair...") -> None:
    # Evita RuntimeError (lost sys.stdin) quando executado com --noconsole.
    try:
        if sys.stdin is not None and sys.stdin.isatty():
            input(message)
    except Exception:
        pass


def _get_installed_printers() -> list[str]:
    printers = []
    try:
        for printer in win32print.EnumPrinters(2):
            name = printer[2]
            if name:
                printers.append(str(name))
    except Exception:
        pass
    return printers


def definir_impressora_padrao(nome_impressora: str) -> tuple[bool, str]:
    impressoras = _get_installed_printers()
    if not impressoras:
        return False, "Nenhuma impressora encontrada no Windows."

    # Tenta match exato primeiro.
    if nome_impressora in impressoras:
        win32print.SetDefaultPrinter(nome_impressora)
        return True, f"Impressora padrao definida: {nome_impressora}"

    # Fallback inteligente para Elgin/i9.
    target = None
    for p in impressoras:
        pl = p.lower()
        if "elgin" in pl or "i9" in pl:
            target = p
            break

    if target:
        win32print.SetDefaultPrinter(target)
        return True, f"Impressora padrao definida por fallback: {target}"

    return False, f"Impressora '{nome_impressora}' nao encontrada."


def instalar_impressora_rede(caminho_compartilhado: str) -> bool:
    try:
        result = subprocess.run(
            ["rundll32", "printui.dll,PrintUIEntry", "/in", "/n", caminho_compartilhado],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result.returncode == 0
    except Exception:
        return False


def abrir_no_chrome(url: str) -> bool:
    for chrome_path in CHROME_CANDIDATES:
        if chrome_path.exists():
            try:
                webbrowser.register("chrome", None, webbrowser.BackgroundBrowser(str(chrome_path)))
                webbrowser.get("chrome").open(url, new=2)
                return True
            except Exception:
                pass

    try:
        webbrowser.open(url, new=2)
        return True
    except Exception:
        return False


def configurar_ambiente(url: str, nome_impressora: str = PRINTER_NAME) -> dict:
    status = {
        "printer_ok": False,
        "printer_message": "",
        "browser_ok": False,
    }

    try:
        ok, msg = definir_impressora_padrao(nome_impressora)
        status["printer_ok"] = ok
        status["printer_message"] = msg
    except Exception as exc:
        status["printer_message"] = f"Falha ao configurar impressora: {exc}"

    status["browser_ok"] = abrir_no_chrome(url)
    return status


def _candidate_dirs() -> list[Path]:
    candidates = []
    exe_dir = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else Path(__file__).resolve().parent
    cwd = Path.cwd()

    candidates.extend([
        exe_dir,
        cwd,
        exe_dir / "app fechamento",
        cwd / "app fechamento",
        Path.home() / "Documents" / "app fechamento",
        Path.home() / "Desktop" / "app fechamento",
    ])

    for drive in "DEFGHIJKLMNOPQRSTUVWXYZ":
        candidates.append(Path(f"{drive}:/app fechamento"))
        candidates.append(Path(f"{drive}:/"))

    seen = set()
    unique = []
    for p in candidates:
        key = str(p).lower()
        if key not in seen:
            seen.add(key)
            unique.append(p)
    return unique


def _find_app_dir() -> Path | None:
    for base in _candidate_dirs():
        if (base / "index.html").exists() and (base / "requirements.txt").exists():
            return base

    for drive in "DEFGHIJKLMNOPQRSTUVWXYZ":
        root = Path(f"{drive}:/")
        if not root.exists():
            continue
        for name in ["app fechamento", "fechamento", "solar", "sistema fechamento"]:
            candidate = root / name
            if (candidate / "index.html").exists() and (candidate / "requirements.txt").exists():
                return candidate

    return None


def _python_command(app_dir: Path | None = None) -> list[str] | None:
    if app_dir:
        venv_python = app_dir / ".venv" / "Scripts" / "python.exe"
        if venv_python.exists():
            return [str(venv_python)]

    for cmd in (["py", "-3"], ["python"]):
        try:
            proc = subprocess.run(cmd + ["--version"], capture_output=True, text=True, timeout=4)
            if proc.returncode == 0:
                return cmd
        except Exception:
            continue
    return None


def _install_requirements(app_dir: Path, py_cmd: list[str]) -> tuple[bool, str]:
    if not py_cmd:
        return False, "Python nao encontrado para instalar dependencias."

    test_cmd = py_cmd + ["-c", "import fastapi, uvicorn, win32print; from PIL import Image"]
    test_proc = subprocess.run(test_cmd, capture_output=True, text=True)
    if test_proc.returncode == 0:
        return True, "Dependencias OK"

    install_cmd = py_cmd + ["-m", "pip", "install", "-r", str(app_dir / "requirements.txt")]
    install_proc = subprocess.run(install_cmd, capture_output=True, text=True)
    if install_proc.returncode != 0:
        details = install_proc.stderr.strip() or install_proc.stdout.strip() or "erro desconhecido"
        return False, f"Falha ao instalar dependencias: {details}"

    return True, "Dependencias instaladas"


def _service_status() -> tuple[bool, dict | None, str]:
    try:
        req = urllib.request.Request(SERVICE_STATUS_URL, method="GET")
        with urllib.request.urlopen(req, timeout=2) as resp:
            payload = resp.read().decode("utf-8", errors="replace")
            data = json.loads(payload)
            return True, data, "ok"
    except urllib.error.URLError as exc:
        return False, None, f"nao foi possivel consultar status: {exc}"
    except Exception as exc:
        return False, None, f"falha ao ler status: {exc}"


def _wait_service(seconds: int = 20) -> bool:
    deadline = time.time() + seconds
    while time.time() < deadline:
        if _is_port_open(SERVICE_HOST, SERVICE_PORT):
            return True
        time.sleep(1)
    return False


def _start_service_subprocess(app_dir: Path, py_cmd: list[str]) -> subprocess.Popen:
    args = py_cmd + [str(app_dir / "impressora_service.py")]
    return subprocess.Popen(args, cwd=str(app_dir), creationflags=subprocess.CREATE_NEW_CONSOLE)


def _run_service_mode(app_dir: Path):
    sys.path.insert(0, str(app_dir))

    try:
        module = importlib.import_module("impressora_service")
        app = getattr(module, "app", None)
    except Exception as exc:
        print(f"ERRO ao carregar servico de impressao: {exc}")
        sys.exit(1)

    if app is None:
        print("ERRO: modulo impressora_service sem objeto app.")
        sys.exit(1)

    try:
        import uvicorn
    except Exception as exc:
        print(f"ERRO: uvicorn nao disponivel: {exc}")
        sys.exit(1)

    uvicorn.run(app, host=SERVICE_HOST, port=SERVICE_PORT)


def _main_launcher():
    print("=" * 40)
    print("  FECHAMENTO SOLAR - EXECUTAVEL")
    print("=" * 40)
    print()

    app_dir = _find_app_dir()
    if not app_dir:
        print("ERRO: nao encontrei a pasta do sistema.")
        print("Copie o executavel para dentro da pasta do projeto")
        print("ou mantenha a pasta 'app fechamento' no pendrive/documentos.")
        _pause_if_console()
        return 1

    index_file = app_dir / "index.html"
    service_file = app_dir / "impressora_service.py"
    if not service_file.exists():
        print(f"ERRO: arquivo de impressao nao encontrado em {service_file}")
        _pause_if_console()
        return 1

    print(f"Pasta detectada: {app_dir}")

    py_cmd = _python_command(app_dir)
    if not py_cmd:
        print("ERRO: Python nao encontrado para iniciar o servico.")
        _pause_if_console()
        return 1

    ok, message = _install_requirements(app_dir, py_cmd)
    if not ok:
        print(f"ERRO: {message}")
        _pause_if_console()
        return 1

    if not _is_port_open(SERVICE_HOST, SERVICE_PORT):
        print("Iniciando servico local de impressao...")
        try:
            _start_service_subprocess(app_dir, py_cmd)
        except Exception as exc:
            print(f"ERRO ao iniciar servico: {exc}")
            _pause_if_console()
            return 1

    print("Aguardando servico responder...")
    if not _wait_service(20):
        print("AVISO: servico nao respondeu em 20s. O sistema sera aberto assim mesmo.")
    else:
        print("Servico online em http://127.0.0.1:8000")

    # 1) PRIORIDADE: abrir o navegador para o usuario, ANTES de qualquer
    #    checagem de impressora. Se nao houver impressora hoje, o caixa ainda
    #    consegue usar o sistema web e imprimir depois.
    print("Abrindo sistema no navegador...")
    try:
        printer_ok, printer_msg = definir_impressora_padrao(PRINTER_NAME)
        if printer_ok:
            print(printer_msg)
        else:
            print(f"AVISO: {printer_msg}")
    except Exception as exc:
        print(f"AVISO: nao foi possivel configurar impressora padrao: {exc}")

    browser_ok = False
    try:
        browser_ok = abrir_no_chrome(index_file.as_uri())
    except Exception as exc:
        print(f"AVISO: falha ao abrir navegador: {exc}")

    if browser_ok:
        print("Sistema aberto no navegador.")
    else:
        print("AVISO: nao foi possivel abrir o navegador automaticamente.")
        print(f"Acesse manualmente: {index_file.as_uri()}")

    # 2) Diagnostico da impressora (apenas informativo, nao bloqueia)
    status_ok, status_data, status_msg = _service_status()
    if status_ok and isinstance(status_data, dict):
        printers = status_data.get("printers") or []
        selected = status_data.get("printer")
        if printers:
            print(f"Impressora selecionada: {selected or 'nao definida'}")
            print(f"Impressoras visiveis: {', '.join([str(p) for p in printers])}")
        else:
            print("AVISO: nenhuma impressora detectada. Instale/ligue a Elgin i9 quando puder.")
    else:
        print(f"AVISO: nao foi possivel ler status da impressora ({status_msg}).")

    print("Mantenha a janela do servico aberta durante o uso.")
    _pause_if_console("\nPressione Enter para finalizar este launcher...")
    return 0


def main():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--service", action="store_true")
    parser.add_argument("--app-dir", default="")
    args, _ = parser.parse_known_args()

    if args.service:
        app_dir = Path(args.app_dir).resolve() if args.app_dir else Path.cwd().resolve()
        _run_service_mode(app_dir)
        return

    code = _main_launcher()
    raise SystemExit(code)


if __name__ == "__main__":
    main()
