#!/usr/bin/env python3
"""Собирает golos/index.html из ../index.html (меню глав берётся с основного сайта).
Запускать после каждого изменения index.html:  python3 golos/make.py"""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
h = (root / 'index.html').read_text(encoding='utf-8')
h = h.replace('<title>Мишна Брура — русское издание</title>', '<title>Озвучка · Мишна Брура</title>')
h = h.replace('<head>', '<head>\n  <meta name="robots" content="noindex"><script>window.MB_RECORDER=true</script>', 1)
h = re.sub(r'<meta name="description"[^>]*>', '', h, count=1)
h = h.replace('href="icon.svg"', 'href="../icon.svg"')
h = h.replace('href="manifest.webmanifest"', 'href="manifest.webmanifest"')
h = re.sub(r'href="style\.css', 'href="../style.css', h)
h = re.sub(r'src="(ru-hyphenation\.js|app\.js|voice\.js)', r'src="../\1', h)
h = re.sub(r'\s*<script src="donate\.js[^>]*></script>', '', h)
h = h.replace('РУССКОЕ ИЗДАНИЕ', 'ОЗВУЧКА · ТОЛЬКО ДЛЯ АВТОРА', 1)
h = h.replace('</head>', '<style>#donateBtn{display:none!important}</style></head>', 1)
(root / 'golos' / 'index.html').write_text(h, encoding='utf-8')
print('golos/index.html собран,', len(h), 'байт')
