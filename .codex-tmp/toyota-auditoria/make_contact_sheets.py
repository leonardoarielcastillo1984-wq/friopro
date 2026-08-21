from pathlib import Path
from PIL import Image, ImageDraw

folder = Path('/Users/leonardocastillo/Desktop/APP/SGI respaldo 360/outputs/toyota-auditoria-2026/docx-render')
pages = sorted(folder.glob('page-*.png'), key=lambda p: int(p.stem.split('-')[-1]))
for batch_idx in range(0, len(pages), 20):
    batch = pages[batch_idx:batch_idx+20]
    thumb_w, thumb_h = 255, 330
    canvas = Image.new('RGB', (thumb_w*5, thumb_h*4), 'white')
    draw = ImageDraw.Draw(canvas)
    for idx, path in enumerate(batch):
        img = Image.open(path).convert('RGB')
        img.thumbnail((thumb_w-10, thumb_h-25))
        x = (idx % 5) * thumb_w + (thumb_w-img.width)//2
        y = (idx // 5) * thumb_h + 18
        canvas.paste(img, (x, y))
        draw.text(((idx % 5)*thumb_w+8, (idx//5)*thumb_h+3), path.stem, fill='black')
    canvas.save(folder / f'contact-{batch_idx//20+1}.png')
