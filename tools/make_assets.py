#!/usr/bin/env python3
"""Gera os ícones da extensão e as peças de divulgação da loja.

Uso:  python3 tools/make_assets.py
Saída: src/icons/icon{16,32,48,128}.png  e  store/promo/*.png

Dependência: Pillow (pip install pillow)
"""
from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS_DIR = os.path.join(ROOT, "src", "icons")
PROMO_DIR = os.path.join(ROOT, "store", "promo")

FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

BRAND = (23, 86, 111)      # #17566f
ACCENT = (43, 122, 155)    # #2b7a9b
INK = (28, 43, 54)         # #1c2b36
MUTED = (107, 124, 136)    # #6b7c88
LINE = (228, 234, 239)     # #e4eaef
SOFT = (241, 245, 248)     # #f1f5f8
WHITE = (255, 255, 255)

SS = 4  # fator de superamostragem para bordas suaves


# ---------------------------------------------------------------- utilidades
def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def linear_gradient(size: int, top: tuple, bottom: tuple) -> Image.Image:
    """Gradiente vertical simples."""
    grad = Image.new("RGB", (1, size))
    for y in range(size):
        t = y / max(size - 1, 1)
        grad.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return grad.resize((size, size))


def rounded_mask(size: int, radius: float) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def paste_rounded(canvas: Image.Image, layer: Image.Image, box, radius: float) -> None:
    x, y, w, h = box
    layer = layer.resize((w, h), Image.LANCZOS)
    mask = Image.new("L", (w * SS, h * SS), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w * SS - 1, h * SS - 1], radius=radius * SS, fill=255)
    mask = mask.resize((w, h), Image.LANCZOS)
    canvas.paste(layer, (x, y), mask)


def draw_rounded(draw: ImageDraw.ImageDraw, box, radius: float, **kwargs) -> None:
    draw.rounded_rectangle(box, radius=radius, **kwargs)


def fit_font(draw: ImageDraw.ImageDraw, text: str, max_width: float, base_size: int,
             path: str, min_size: int = 6) -> ImageFont.FreeTypeFont:
    """Reduz a fonte até o texto caber na largura disponível."""
    size = base_size
    while size > min_size:
        f = font(path, size)
        if draw.textlength(text, font=f) <= max_width:
            return f
        size -= 1
    return font(path, min_size)


# ------------------------------------------------------------------- ícones
def make_icon(size: int) -> Image.Image:
    n = size * SS
    canvas = Image.new("RGBA", (n, n), (0, 0, 0, 0))

    # fundo com gradiente
    bg = linear_gradient(n, (30, 96, 122), BRAND)
    layer = Image.new("RGBA", (n, n))
    layer.paste(bg, (0, 0))
    canvas = Image.alpha_composite(canvas, Image.composite(layer, layer, rounded_mask(n, n * 0.24)))

    draw = ImageDraw.Draw(canvas)

    # visto branco, centralizado e com espessura generosa (legível a 16px)
    stroke = max(2, int(round(n * 0.125)))
    draw.line(
        [(n * 0.255, n * 0.520), (n * 0.415, n * 0.690)],
        fill=WHITE + (255,),
        width=stroke,
        joint="curve",
    )
    draw.line(
        [(n * 0.415, n * 0.690), (n * 0.760, n * 0.340)],
        fill=WHITE + (255,),
        width=stroke,
        joint="curve",
    )

    return canvas.resize((size, size), Image.LANCZOS)


def build_icons() -> None:
    os.makedirs(ICONS_DIR, exist_ok=True)
    for size in (16, 32, 48, 128):
        make_icon(size).save(os.path.join(ICONS_DIR, f"icon{size}.png"))
        print(f"icone {size}x{size} ok")


# ------------------------------------------------------------- peças da loja
def mock_panel(w: int, h: int) -> Image.Image:
    """Recorte limpo do painel da extensão (ilustração, sem dados reais)."""
    n = 3
    card = Image.new("RGBA", (w * n, h * n), (0, 0, 0, 0))
    d = ImageDraw.Draw(card)
    w, h = w * n, h * n
    u = w / 100.0

    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=4 * u, fill=WHITE + (255,))
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=4 * u, outline=LINE + (255,), width=int(u * 0.7))

    f_title = font(FONT_BOLD, int(u * 7.2))
    f_label = font(FONT_REGULAR, int(u * 5.4))
    f_small = font(FONT_REGULAR, int(u * 5.0))
    f_btn = font(FONT_BOLD, int(u * 5.6))

    # cabeçalho
    d.ellipse([u * 5, u * 6.6, u * 5 + u * 3.2, u * 6.6 + u * 3.2], fill=ACCENT + (255,))
    d.text((u * 10.5, u * 5.6), "Optante Fácil", font=f_title, fill=INK + (255,))
    d.text((u * 5, u * 16.5), "Marcar linhas pendentes como", font=f_label, fill=MUTED + (255,))

    # segmentado
    seg_y, seg_h = u * 23.5, u * 11.5
    d.rounded_rectangle([u * 5, seg_y, w - u * 5, seg_y + seg_h], radius=u * 3.2, fill=SOFT + (255,))
    labels = ["Não Optante", "Optante SN", "Optante MEI"]
    col_w = (w - u * 10) / 3
    for i, label in enumerate(labels):
        x0 = u * 5 + i * col_w
        x1 = x0 + col_w - u * 0.9
        label_font = fit_font(d, label, col_w - u * 4.5, int(u * 5.2), FONT_BOLD)
        tw = d.textlength(label, font=label_font)
        tx = x0 + (col_w - u * 0.9 - tw) / 2 + u * 0.9
        if i == 1:
            d.rounded_rectangle([x0 + u * 0.9, seg_y + u * 1.1, x1, seg_y + seg_h - u * 1.1],
                                radius=u * 2.4, fill=WHITE + (255,))
            d.text((tx, seg_y + u * 3.2), label, font=label_font, fill=BRAND + (255,))
        else:
            d.text((tx, seg_y + u * 3.4), label, font=label_font, fill=(74, 91, 104, 255))

    # status
    d.text((u * 6, u * 40.5), "14 linhas pendentes de 48.", font=f_label, fill=INK + (255,))

    # barra de progresso
    d.rounded_rectangle([u * 5, u * 50, w - u * 5, u * 50 + u * 2.2], radius=u * 1.1, fill=(230, 237, 241, 255))
    d.rounded_rectangle([u * 5, u * 50, u * 5 + (w - u * 10) * 0.42, u * 50 + u * 2.2], radius=u * 1.1, fill=ACCENT + (255,))

    # botão principal
    btn_y = u * 58
    d.rounded_rectangle([u * 5, btn_y, w - u * 5, btn_y + u * 13], radius=u * 3, fill=BRAND + (255,))
    text = 'Aplicar "Optante SN" a 14 linhas'
    btn_font = fit_font(d, text, w - u * 14, int(u * 5.6), FONT_BOLD)
    tw = d.textlength(text, font=btn_font)
    d.text(((w - tw) / 2, btn_y + u * 4.0), text, font=btn_font, fill=WHITE + (255,))

    # rodapé
    d.line([u * 5, u * 76, w - u * 5, u * 76], fill=LINE + (255,), width=int(u * 0.6))
    d.text((u * 6, u * 81), "Velocidade", font=f_small, fill=MUTED + (255,))
    d.text((w - u * 6 - d.textlength("Normal", font=f_btn), u * 80.6), "Normal", font=f_btn, fill=ACCENT + (255,))

    return card.resize((w // n, h // n), Image.LANCZOS)


def background(size: tuple) -> Image.Image:
    w, h = size
    base = Image.new("RGB", (w, h), (247, 250, 252))
    d = ImageDraw.Draw(base)
    top = (255, 255, 255)
    bottom = (233, 242, 246)
    grad = linear_gradient(h, top, bottom).resize((w, h))
    base.paste(grad, (0, 0))

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse([-w * 0.25, -h * 0.85, w * 0.55, h * 0.35], fill=ACCENT + (26,))
    od.ellipse([w * 0.62, h * 0.45, w * 1.35, h * 1.35], fill=BRAND + (22,))
    return Image.alpha_composite(base.convert("RGBA"), overlay)


def build_small_promo() -> None:
    w, h = 440, 280
    canvas = background((w, h))
    d = ImageDraw.Draw(canvas)

    f_title = font(FONT_BOLD, 30)
    f_sub = font(FONT_REGULAR, 15)
    f_chip = font(FONT_BOLD, 12)

    d.text((32, 34), "Optante Fácil", font=f_title, fill=BRAND + (255,))
    y = 76
    for line in ["Preencha em lote o campo", "Simples Nacional/MEI na", "Declaração de Serviços", "Contratados do ISS.net."]:
        d.text((32, y), line, font=f_sub, fill=INK + (255,))
        y += 21

    chips = ["Não Optante", "Optante SN", "Optante MEI"]
    x, y_chip, limit = 32, 174, 258  # limite: o painel ilustrado começa em x=268
    for chip in chips:
        box_w = d.textlength(chip, font=f_chip) + 24
        if x + box_w > limit:
            x = 32
            y_chip += 32
        d.rounded_rectangle([x, y_chip, x + box_w, y_chip + 26], radius=13, fill=WHITE + (255,), outline=LINE + (255,), width=1)
        d.text((x + 12, y_chip + 6), chip, font=f_chip, fill=ACCENT + (255,))
        x += box_w + 8

    panel = mock_panel(150, 210)
    paste_rounded(canvas, panel, (268, 36, 150, 210), 10)
    canvas.convert("RGB").save(os.path.join(PROMO_DIR, "small-promo-440x280.png"))
    print("small-promo-440x280.png ok")


def build_marquee() -> None:
    w, h = 1400, 560
    canvas = background((w, h))
    d = ImageDraw.Draw(canvas)

    f_title = font(FONT_BOLD, 62)
    f_sub = font(FONT_REGULAR, 25)
    f_chip = font(FONT_BOLD, 19)
    f_note = font(FONT_REGULAR, 18)

    d.text((90, 150), "Optante Fácil", font=f_title, fill=BRAND + (255,))
    d.text((90, 232), "Marque Não Optante, Optante SN ou Optante MEI", font=f_sub, fill=INK + (255,))
    d.text((90, 268), "em todas as linhas pendentes de uma vez.", font=f_sub, fill=INK + (255,))

    chips = ["Rápido", "Funciona em segundo plano", "Sem sair do navegador"]
    x = 90
    for chip in chips:
        tw = d.textlength(chip, font=f_chip)
        d.rounded_rectangle([x, 320, x + tw + 40, 360], radius=20, fill=WHITE + (255,), outline=LINE + (255,), width=2)
        d.text((x + 20, 329), chip, font=f_chip, fill=ACCENT + (255,))
        x += tw + 60

    d.text((90, 392), "Extensão para Chrome e Edge · Não envia dados para fora do navegador", font=f_note, fill=MUTED + (255,))

    panel = mock_panel(330, 460)
    paste_rounded(canvas, panel, (930, 50, 330, 460), 14)
    canvas.convert("RGB").save(os.path.join(PROMO_DIR, "marquee-1400x560.png"))
    print("marquee-1400x560.png ok")


def main() -> None:
    os.makedirs(PROMO_DIR, exist_ok=True)
    build_icons()
    build_small_promo()
    build_marquee()


if __name__ == "__main__":
    main()
