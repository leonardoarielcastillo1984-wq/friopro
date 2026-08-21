from pathlib import Path
from PIL import Image,ImageDraw
files=sorted(Path('outputs/sg-chat-work/render_changed').glob('*/page-*.png'));out=Path('outputs/sg-chat-work/contacts');out.mkdir(exist_ok=True)
thumbs=[]
for p in files:
 im=Image.open(p).convert('RGB');im.thumbnail((180,235));c=Image.new('RGB',(190,260),'white');c.paste(im,((190-im.width)//2,20));ImageDraw.Draw(c).text((4,3),p.parent.name[:25]+' '+p.stem,fill='black');thumbs.append(c)
for n in range(0,len(thumbs),30):
 b=thumbs[n:n+30];s=Image.new('RGB',(190*6,260*5),'white')
 for i,im in enumerate(b):s.paste(im,((i%6)*190,(i//6)*260))
 s.save(out/f'contact-{n//30+1:02d}.png')
print(len(files),len(list(out.glob('*.png'))))
