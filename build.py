#!/usr/bin/env python3
"""Inline src/ and vendor/ into a single self-contained dist/index.html."""
import pathlib, sys
root = pathlib.Path(__file__).parent
shell = (root/'src/shell.html').read_text(encoding='utf-8')
parts = {
    '__MAPLIBRE_CSS__': (root/'vendor/maplibre-gl.css').read_text(encoding='utf-8'),
    '__CSS__':          (root/'src/style.css').read_text(encoding='utf-8'),
    '__MAPLIBRE_JS__':  '/* MapLibre GL JS 5.24.0 (BSD-3-Clause) */\n'
                        + (root/'vendor/maplibre-gl.js').read_text(encoding='utf-8'),
    '__APP__':          (root/'src/app.js').read_text(encoding='utf-8'),
}
for token, value in parts.items():
    if token not in shell:
        sys.exit('missing placeholder: ' + token)
    shell = shell.replace(token, value.replace('</script', '<\\/script'))
out = root/'dist/index.html'
out.parent.mkdir(exist_ok=True)
out.write_text(shell, encoding='utf-8')
print('built', out, round(len(shell)/1024), 'KB')
