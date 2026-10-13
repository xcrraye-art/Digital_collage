"""Rebuild the self-contained HTML, including the local gemstone atlas."""
from pathlib import Path
import base64

root = Path(__file__).resolve().parent.parent
front = root / 'frontend'
html = (front / 'index.html').read_text()
css = (front / 'style.css').read_text()
js = (front / 'app.js').read_text()
atlas = base64.b64encode((front / 'assets/gemstones.png').read_bytes()).decode('ascii')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>')
script = '<script>window.GEM_ATLAS_DATA="data:image/png;base64,' + atlas + '";</script>'
html = html.replace('<script src="app.js"></script>', script + '<script>\n' + js + '\n</script>')
html = html.replace('href="./"', 'href="#"')
(front / 'gem-garden.html').write_text(html)
print('Built frontend/gem-garden.html with embedded gem textures')
