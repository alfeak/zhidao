import socket
import io
import base64
import os
import qrcode

def get_local_ip() -> str:
    """Find local LAN IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def get_server_url() -> str:
    """Get server external/internal URL."""
    configured = os.getenv("SERVER_URL", "").strip()
    if configured:
        return configured
    ip = get_local_ip()
    port = os.getenv("PORT", "8000")
    return f"http://{ip}:{port}"

def generate_qr_data_url(data_str: str) -> str:
    """Generate base64 PNG data URL for a QR code."""
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=6, border=2)
    qr.add_data(data_str)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0f172a", back_color="#ffffff")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

def print_startup_qr():
    """Print ASCII QR Code to terminal log on server startup."""
    url = get_server_url()
    try:
        qr = qrcode.QRCode(version=1, box_size=1, border=1)
        qr.add_data(url)
        qr.make(fit=True)
        print("\n" + "=" * 54)
        print(f"🚀 ZHIDAO SERVER RUNNING AT: {url}")
        print("📱 APP BINDING QR CODE (Scan to connect Mobile App):")
        print("=" * 54)
        qr.print_ascii(invert=True)
        print("=" * 54 + "\n", flush=True)
    except Exception as e:
        print(f"🚀 ZHIDAO SERVER RUNNING AT: {url} (QR Print Error: {e})", flush=True)

def get_server_info_dict():
    """Return dict with server URL, IP, and QR code data URL."""
    url = get_server_url()
    return {
        "serverUrl": url,
        "localIp": get_local_ip(),
        "qrCodeDataUrl": generate_qr_data_url(url),
    }
