"""Rebuild the self-contained HTML, including the local gemstone atlas."""
from pathlib import Path
import base64
import json

root = Path(__file__).resolve().parent.parent
front = root / 'frontend'
html = (front / 'index.html').read_text()
css = (front / 'style.css').read_text()
js = (front / 'app.js').read_text()
atlas = base64.b64encode((front / 'assets/polished-gems.png').read_bytes()).decode('ascii')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>')
geometry = (front / 'assets/geometry.json').read_text().strip()
materials = (front / 'assets/polished-atlas.json').read_text().strip()
script = '<script>window.GEM_MATERIALS=' + materials + ';window.GEM_GEOMETRY=' + geometry + ';window.GEM_ATLAS_DATA="data:image/png;base64,' + atlas + '";</script>'
html = html.replace('<script src="app.js"></script>', script + '<script>\n' + js + '\n</script>')
html = html.replace('href="./"', 'href="#"')
(front / 'gem-garden.html').write_text(html)
print('Built frontend/gem-garden.html with embedded gem textures')
