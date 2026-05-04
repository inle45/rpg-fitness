#!/usr/bin/env python3
"""Construit preview/standalone.html : un fichier HTML autocontenu où
les CSS et JS sont inlinés. Utile pour tester depuis un téléphone via
htmlpreview.github.io (qui sert le HTML mais pas les assets relatifs)
ou simplement pour partager un fichier unique.
"""
import os, re

ROOT = os.path.join(os.path.dirname(__file__), '..', 'preview')


def read(path: str) -> str:
    with open(os.path.join(ROOT, path), 'r', encoding='utf-8') as f:
        return f.read()


def main():
    html = read('index.html')
    css = read('css/styles.css')
    js_files = ['js/engine.js', 'js/sprites.js', 'js/tests.js', 'js/sync.js', 'js/ui.js']
    js_combined = '\n\n;//=== %s ===\n%s' % ('boundary', '')
    js_blocks = []
    for f in js_files:
        js_blocks.append('// === %s ===\n' % f + read(f))
    js_combined = '\n\n'.join(js_blocks)

    # IMPORTANT : on ne passe JAMAIS le contenu inliné comme replacement string
    # à re.sub, car re.sub interprète les `\\n`, `\\1`, etc. À la place on
    # utilise des lambdas (qui retournent la string telle quelle, sans
    # interpréter les backreferences).

    # 1. Remplacer le link CSS externe par <style> inline
    css_block = '<style>\n' + css + '\n</style>'
    html = re.sub(
        r'<link rel="stylesheet" href="css/styles.css"\s*/?>',
        lambda m: css_block,
        html,
    )
    # 2. Retirer le manifest et icônes (le standalone est offline pur)
    html = re.sub(r'<link rel="manifest"[^>]*>\s*', '', html)
    html = re.sub(r'<link rel="icon"[^>]*>\s*', '', html)
    html = re.sub(r'<link rel="apple-touch-icon"[^>]*>\s*', '', html)

    # 3. Remplacer les <script src=...> par un seul script inline
    js_block = '\n<script>\n' + js_combined + '\n</script>\n'
    html = re.sub(
        r'(\s*<script src="js/[^"]+"></script>\s*)+',
        lambda m: js_block,
        html,
        count=1,
    )
    # Et virer le snippet d'enregistrement du SW (inutile dans un fichier seul).
    html = re.sub(
        r"<script>\s*if \('serviceWorker'.*?</script>",
        '',
        html,
        flags=re.S,
    )

    out = os.path.join(ROOT, 'standalone.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    print('wrote', out, '(%.1f KB)' % (os.path.getsize(out) / 1024.0))


if __name__ == '__main__':
    main()
