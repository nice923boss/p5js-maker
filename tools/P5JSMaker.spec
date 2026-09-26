# -*- mode: python ; coding: utf-8 -*-
# Build: python -m PyInstaller tools/P5JSMaker.spec --distpath dist --workpath build --noconfirm
# Output: dist/P5JSMaker.exe (windowed, one file). Serves the bundled editor on http://127.0.0.1:38920.
import os

ROOT = os.path.abspath(os.path.join(SPECPATH, os.pardir))

a = Analysis(
    [os.path.join(ROOT, 'tools', 'serve.py')],
    pathex=[],
    binaries=[],
    datas=[
        (os.path.join(ROOT, 'index.html'), '.'),
        (os.path.join(ROOT, 'css'), 'css'),
        (os.path.join(ROOT, 'js'), 'js'),
        (os.path.join(ROOT, 'runtime'), 'runtime'),
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='P5JSMaker',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
