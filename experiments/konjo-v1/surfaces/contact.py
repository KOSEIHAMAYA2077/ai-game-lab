"""Assemble captured browser screenshots; this does not generate the game artwork."""
from pathlib import Path
import json
import sys
from PIL import Image, ImageDraw

folder = Path(__file__).resolve().parent / (sys.argv[1] if len(sys.argv) > 1 else 'v2')
records = json.loads((folder / 'results.json').read_text())['records']
columns, width, height = 6, 300, 275
rows = (len(records) + columns - 1) // columns
sheet = Image.new('RGB', (columns * width, rows * height), '#151515')
draw = ImageDraw.Draw(sheet)
for n, record in enumerate(records):
    shape = record['shape']
    source = (folder.parent / sys.argv[2] / 'rose.png') if shape == 'rose' and len(sys.argv) > 2 else folder / f'{shape}.png'
    image = Image.open(source).crop((140, 60, 820, 710))
    image.thumbnail((300, 250))
    x, y = n % columns * width, n // columns * height
    sheet.paste(image, (x + (width-image.width)//2, y + 25))
    draw.text((x+10, y+5), shape, fill='white')
sheet.save(folder / ('contact-rose-revised.jpg' if len(sys.argv) > 2 else 'contact.jpg'))
