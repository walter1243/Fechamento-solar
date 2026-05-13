from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image, ImageDraw, ImageFont
import io
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


class CupomImagem(BaseModel):
    linhas: list[str]


MAX_COLUNAS_BOBINA = 42


def ajustar_linha_bobina(texto: str) -> str:
    linha = (texto or "").strip()
    # Remove padding lateral para aproveitar toda a largura
    if len(linha) > MAX_COLUNAS_BOBINA:
        linha = linha[:MAX_COLUNAS_BOBINA]
    return linha


def escrever_linha_espacada(h_printer, texto: str):
    # Imprime uma linha e adiciona uma linha em branco entre cada item.
    payload = (texto + "\n\n").encode("cp850", errors="replace")
    win32print.WritePrinter(h_printer, payload)


def executar_corte(h_printer):
    # Avanço de papel antes do corte
    win32print.WritePrinter(h_printer, b"\x1b\x40")
    win32print.WritePrinter(h_printer, b"\x1b\x64\x08")
    win32print.WritePrinter(h_printer, b"\n\n\n\n\n\n")
    # Um único comando de corte - o mais confiável do padrão ESC/POS
    win32print.WritePrinter(h_printer, b"\x1d\x56\x00")


def _carregar_fonte(tamanho: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for nome in ["consola.ttf", "cour.ttf", "arial.ttf"]:
        try:
            return ImageFont.truetype(nome, tamanho)
        except OSError:
            continue
    return ImageFont.load_default()


def _medir_largura_texto(fonte, texto: str) -> int:
    if not texto:
        return 0
    caixa = fonte.getbbox(texto)
    return caixa[2] - caixa[0]


def _quebrar_linha_por_largura(texto: str, fonte, largura_util: int) -> list[str]:
    conteudo = str(texto or "").strip()
    if not conteudo:
        return [""]

    if _medir_largura_texto(fonte, conteudo) <= largura_util:
        return [conteudo]

    palavras = conteudo.split()
    linhas = []
    atual = ""

    for palavra in palavras:
        candidato = palavra if not atual else f"{atual} {palavra}"
        if _medir_largura_texto(fonte, candidato) <= largura_util:
            atual = candidato
            continue

        if atual:
            linhas.append(atual)
            atual = palavra
            continue

        bloco = ""
        for caractere in palavra:
            candidato_bloco = bloco + caractere
            if bloco and _medir_largura_texto(fonte, candidato_bloco) > largura_util:
                linhas.append(bloco)
                bloco = caractere
            else:
                bloco = candidato_bloco
        atual = bloco

    if atual:
        linhas.append(atual)

    return linhas or [conteudo]


@app.post("/imprimir_imagem")
def imprimir_imagem(cupom: CupomImagem):
    h_printer = None
    try:
        printer_name = win32print.GetDefaultPrinter()
        h_printer = win32print.OpenPrinter(printer_name)

        linhas = [str(linha or "") for linha in cupom.linhas]
        largura = 384
        margem_x = 8
        margem_y = 10
        largura_util = largura - (margem_x * 2)
        fonte = _carregar_fonte(12)
        altura_linha = 18

        linhas_formatadas = []
        for linha in linhas:
            linhas_formatadas.extend(_quebrar_linha_por_largura(linha, fonte, largura_util))

        altura = (altura_linha * max(len(linhas_formatadas), 1)) + (margem_y * 2)

        imagem = Image.new("1", (largura, altura), 1)
        draw = ImageDraw.Draw(imagem)

        y = margem_y
        for linha in linhas_formatadas:
            conteudo = linha.strip()
            if conteudo in ["SOLAR SUPERMERCADO", "FECHAMENTO PARCIAL", "FECHAMENTO FINAL", "TOTAL GERAL:"]:
                largura_texto = _medir_largura_texto(fonte, conteudo)
                pos_x = max(margem_x, (largura - largura_texto) // 2)
            else:
                pos_x = margem_x
            draw.text((pos_x, y), conteudo, font=fonte, fill=0)
            y += altura_linha

        imagem_bytes = _imagem_para_escpos(imagem)

        inicializar = b"\x1b\x40"
        avancar_papel = b"\x1b\x64\x05"
        comando_corte = b"\x1d\x56\x00"

        win32print.StartDocPrinter(h_printer, 1, ("Fechamento Solar Imagem", None, "RAW"))
        win32print.StartPagePrinter(h_printer)
        win32print.WritePrinter(h_printer, inicializar)
        win32print.WritePrinter(h_printer, imagem_bytes)
        win32print.WritePrinter(h_printer, avancar_papel)
        win32print.WritePrinter(h_printer, comando_corte)
        win32print.EndPagePrinter(h_printer)
        win32print.EndDocPrinter(h_printer)

        return {"status": "Impresso como imagem com sucesso", "printer": printer_name}
    except Exception as exc:
        return {"status": "Erro", "detalhes": str(exc)}
    finally:
        if h_printer is not None:
            try:
                win32print.ClosePrinter(h_printer)
            except Exception:
                pass


def _imagem_para_escpos(imagem: Image.Image) -> bytes:
    imagem = imagem.convert("1")
    largura, altura = imagem.size
    largura_bytes = (largura + 7) // 8
    raster = bytearray()
    raster.extend(b"\x1d\x76\x30\x00")
    raster.extend((largura_bytes & 0xFF, (largura_bytes >> 8) & 0xFF))
    raster.extend((altura & 0xFF, (altura >> 8) & 0xFF))

    pixels = imagem.load()
    for y in range(altura):
        for x_byte in range(largura_bytes):
            valor = 0
            for bit in range(8):
                x = (x_byte * 8) + bit
                if x < largura and pixels[x, y] == 0:
                    valor |= 1 << (7 - bit)
            raster.append(valor)

    return bytes(raster)


@app.post("/imprimir")
def imprimir_direto(cupom: Cupom):
    h_printer = None
    try:
        printer_name = win32print.GetDefaultPrinter()
        h_printer = win32print.OpenPrinter(printer_name)

        comando_corte = b"\x1d\x56\x00"
        avancar_papel = b"\x1b\x64\x05"
        inicializar = b"\x1b\x40"
        alinhar_centro = b"\x1b\x61\x01"
        alinhar_esquerda = b"\x1b\x61\x00"
        fonte_b_menor = b"\x1b\x4d\x01"  # Font B (12 cpi)
        fonte_a_normal = b"\x1b\x4d\x00"  # Font A (normal)
        condensado_on = b"\x0f"  # Condensed
        condensado_off = b"\x12"
        fonte_12cpi = b"\x1b\x21\x01"
        negrito_on = b"\x1b\x45\x01"
        negrito_off = b"\x1b\x45\x00"
        tamanho_titulo = b"\x1d\x21\x00"
        tamanho_normal = b"\x1d\x21\x00"
        espacamento_linha = b"\x1b\x33\x22"

        linhas = cupom.texto.splitlines()

        win32print.StartDocPrinter(h_printer, 1, ("Fechamento Solar", None, "RAW"))
        win32print.StartPagePrinter(h_printer)
        win32print.WritePrinter(h_printer, inicializar)
        win32print.WritePrinter(h_printer, espacamento_linha)
        win32print.WritePrinter(h_printer, fonte_b_menor)
        win32print.WritePrinter(h_printer, condensado_on)
        win32print.WritePrinter(h_printer, fonte_12cpi)

        for linha in linhas:
            l = ajustar_linha_bobina(linha)
            # Centralizar e destacar apenas o cabeçalho
            if l.upper() in ["SOLAR SUPERMERCADO", "FECHAMENTO FINAL"]:
                win32print.WritePrinter(h_printer, alinhar_centro)
                win32print.WritePrinter(h_printer, fonte_a_normal)
                win32print.WritePrinter(h_printer, negrito_on)
                escrever_linha_espacada(h_printer, l)
                win32print.WritePrinter(h_printer, negrito_off)
                win32print.WritePrinter(h_printer, fonte_b_menor)
                win32print.WritePrinter(h_printer, fonte_12cpi)
            elif l.upper().startswith("TOTAL GERAL"):
                win32print.WritePrinter(h_printer, alinhar_centro)
                win32print.WritePrinter(h_printer, fonte_a_normal)
                win32print.WritePrinter(h_printer, negrito_on)
                escrever_linha_espacada(h_printer, l)
                win32print.WritePrinter(h_printer, negrito_off)
                win32print.WritePrinter(h_printer, fonte_b_menor)
                win32print.WritePrinter(h_printer, fonte_12cpi)
            elif l.upper().startswith("R$"):
                win32print.WritePrinter(h_printer, alinhar_centro)
                win32print.WritePrinter(h_printer, fonte_a_normal)
                win32print.WritePrinter(h_printer, negrito_on)
                escrever_linha_espacada(h_printer, l)
                win32print.WritePrinter(h_printer, negrito_off)
                win32print.WritePrinter(h_printer, fonte_b_menor)
                win32print.WritePrinter(h_printer, fonte_12cpi)
            elif set(l.strip()) <= set("-=") and len(l.strip()) >= 10:
                win32print.WritePrinter(h_printer, alinhar_centro)
                escrever_linha_espacada(h_printer, l)
            elif not l.strip():
                win32print.WritePrinter(h_printer, alinhar_esquerda)
                win32print.WritePrinter(h_printer, b"\n")
            else:
                win32print.WritePrinter(h_printer, alinhar_esquerda)
                win32print.WritePrinter(h_printer, fonte_b_menor)
                win32print.WritePrinter(h_printer, fonte_12cpi)
                escrever_linha_espacada(h_printer, l)

        executar_corte(h_printer)
        win32print.WritePrinter(h_printer, condensado_off)
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
