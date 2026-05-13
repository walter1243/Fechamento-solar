from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import win32print


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Cupom(BaseModel):
    texto: str


@app.post("/imprimir")
def imprimir_direto(cupom: Cupom):
    h_printer = None
    try:
        printer_name = win32print.GetDefaultPrinter()
        h_printer = win32print.OpenPrinter(printer_name)

        comando_corte = b"\x1d\x56\x00"
        avancar_papel = b"\x1b\x64\x05"

        # ESC/POS: fonte mais alta e maior espacamento para melhorar leitura
        inicializar = b"\x1b\x40"
        alinhar_esquerda = b"\x1b\x61\x00"
        tamanho_fonte = b"\x1d\x21\x10"  # altura 2x, largura normal
        espacamento_linha = b"\x1b\x33\x28"  # 40 dots
        restaurar_padrao = b"\x1d\x21\x00\x1b\x32"

        win32print.StartDocPrinter(h_printer, 1, ("Fechamento Solar", None, "RAW"))
        win32print.StartPagePrinter(h_printer)
        win32print.WritePrinter(h_printer, inicializar)
        win32print.WritePrinter(h_printer, alinhar_esquerda)
        win32print.WritePrinter(h_printer, tamanho_fonte)
        win32print.WritePrinter(h_printer, espacamento_linha)
        win32print.WritePrinter(h_printer, cupom.texto.encode("cp850", errors="replace"))
        win32print.WritePrinter(h_printer, restaurar_padrao)
        win32print.WritePrinter(h_printer, avancar_papel)
        win32print.WritePrinter(h_printer, comando_corte)
        win32print.EndPagePrinter(h_printer)
        win32print.EndDocPrinter(h_printer)

        return {"status": "Impresso com sucesso", "printer": printer_name}
    except Exception as exc:
        return {"status": "Erro", "detalhes": str(exc)}
    finally:
        if h_printer is not None:
            try:
                win32print.ClosePrinter(h_printer)
            except Exception:
                pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
