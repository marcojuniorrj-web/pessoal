"""Gera os ícones do PWA (monograma "J" num círculo âmbar). Uso: python3 scripts/gerar-icones.py"""
from PIL import Image, ImageDraw, ImageFont
import glob, os

FUNDO, AMBAR, TINTA = (15, 17, 21), (242, 178, 92), (26, 19, 6)
fontes = glob.glob('/usr/share/fonts/opentype/inter/Inter-Bold.otf') + ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']
fonte = next(f for f in fontes if os.path.exists(f))
saida = os.path.join(os.path.dirname(__file__), '..', 'app', 'public')

def icone(tam, raio_rel, nome, fundo_cheio):
    img = Image.new('RGBA', (tam, tam), FUNDO + (255,) if fundo_cheio else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = tam * raio_rel
    c = tam / 2
    d.ellipse((c - r, c - r, c + r, c + r), fill=AMBAR)
    f = ImageFont.truetype(fonte, int(r * 1.35))
    d.text((c, c), 'J', font=f, fill=TINTA, anchor='mm')
    img.save(os.path.join(saida, nome))

icone(192, 0.46, 'icone-192.png', False)
icone(512, 0.46, 'icone-512.png', False)
icone(512, 0.34, 'icone-maskable-512.png', True)   # zona segura do maskable
icone(180, 0.46, 'apple-touch-icon.png', True)      # iOS não aceita transparência
