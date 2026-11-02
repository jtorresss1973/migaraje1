#!/usr/bin/env python3
"""
Garaje · Arranque local + generación de iconos PWA.
Uso:  python setup.py
"""
import os, sys, zlib, struct, socket, threading, time, webbrowser
import http.server, socketserver

ROOT = os.path.dirname(os.path.abspath(__file__))
ICONS = os.path.join(ROOT, "icons")
DEFAULT_PORT = 8080

# ----------------------------------------------------------------------------
# Generación de iconos PNG sin dependencias externas
# ----------------------------------------------------------------------------
def _png_chunk(typ: bytes, data: bytes) -> bytes:
    c = typ + data
    return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)

def _make_png(path: str, size: int, maskable: bool = False) -> None:
    """Genera un PNG RGBA con un gradiente azul→violeta y una silueta de coche."""
    raw = bytearray()
    pad = int(size * 0.14) if maskable else 0
    inner = size - 2 * pad

    for y in range(size):
        raw.append(0)  # filtro None
        for x in range(size):
            # Fondo con gradiente diagonal
            t = (x + y) / (2 * (size - 1) if size > 1 else 1)
            r = int(37 + t * (124 - 37))
            g = int(99 + t * (58 - 99))
            b = int(235 + t * (237 - 235))

            # Silueta de coche (zona central clara)
            if pad <= x < size - pad and pad <= y < size - pad:
                ix, iy = (x - pad) / inner, (y - pad) / inner
                # cuerpo (banda horizontal) + cabina (trapecio)
                body = 0.58 <= iy <= 0.78 and 0.14 <= ix <= 0.86
                cabin = 0.36 <= iy <= 0.58 and 0.26 <= ix <= 0.74
                wheel_l = ((ix - 0.30) ** 2 + (iy - 0.78) ** 2) < 0.0018
                wheel_r = ((ix - 0.70) ** 2 + (iy - 0.78) ** 2) < 0.0018
                if body or cabin or wheel_l or wheel_r:
                    r, g, b = 255, 255, 255

            raw.extend((r, g, b, 255))

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)

    with open(path, "wb") as f:
        f.write(sig)
        f.write(_png_chunk(b"IHDR", ihdr))
        f.write(_png_chunk(b"IDAT", idat))
        f.write(_png_chunk(b"IEND", b""))

SVG_ICON = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#7c3aed"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <g fill="none" stroke="#ffffff" stroke-width="22" stroke-linecap="round" stroke-linejoin="round">
    <path d="M112 288 144 192a48 48 0 0 1 45-32h134a48 48 0 0 1 45 32l32 96"/>
    <rect x="80" y="288" width="352" height="112" rx="24"/>
    <path d="M144 400v32M368 400v32"/>
  </g>
  <g fill="#2563eb"><circle cx="168" cy="352" r="18"/><circle cx="344" cy="352" r="18"/></g>
</svg>"""

def ensure_assets() -> None:
    os.makedirs(ICONS, exist_ok=True)
    svg_path = os.path.join(ICONS, "icon.svg")
    if not os.path.exists(svg_path):
        with open(svg_path, "w", encoding="utf-8") as f:
            f.write(SVG_ICON)
        print("  · generado icons/icon.svg")

    for name, size, mask in (
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-512.png", 512, True),
    ):
        target = os.path.join(ICONS, name)
        if not os.path.exists(target):
            _make_png(target, size, maskable=mask)
            print(f"  · generado icons/{name}")

# ----------------------------------------------------------------------------
# Servidor local
# ----------------------------------------------------------------------------
def _free_port(start: int) -> int:
    for p in range(start, start + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", p))
                return p
            except OSError:
                continue
    return start

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".json":        "application/json",
        ".webmanifest": "application/manifest+json",
        ".js":          "text/javascript",
        ".svg":         "image/svg+xml",
        ".png":         "image/png",
    }
    def log_message(self, fmt, *args):
        sys.stderr.write("  %s\n" % (fmt % args))

def serve() -> None:
    os.chdir(ROOT)
    port = _free_port(DEFAULT_PORT)
    with socketserver.TCPServer(("127.0.0.1", port), Handler) as httpd:
        url = f"http://localhost:{port}/index.html"
        print()
        print("  Garaje · Gestión de vehículos")
        print(f"  → {url}")
        print("  → Pulsa Ctrl+C para detener el servidor")
        print()
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Servidor detenido.")

# ----------------------------------------------------------------------------
if __name__ == "__main__":
    print("Preparando la aplicación…")
    ensure_assets()
    print("Listo.\n")
    serve()