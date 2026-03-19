#!/usr/bin/env bash
# ============================================================
# EMS Pi — Zero-Touch Install
# ============================================================
#
# Einzeiler:
#   curl -fsSL https://raw.githubusercontent.com/benjiwald/Wania-EMS/main/pi/install.sh | sudo bash
#
# ============================================================

set -euo pipefail

PROVISION_URL="https://grdpcosbrvxuzgqigdwc.supabase.co/functions/v1/provision"
POLLER_URL="https://raw.githubusercontent.com/benjiwald/Wania-EMS/main/pi/poller.py"
INSTALL_DIR="/opt/ems"
SERVICE_NAME="ems-poller"

# ── Farben ────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
info() { echo -e "${BLUE}→${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*"; exit 1; }

[ "$EUID" -eq 0 ] || err "Bitte als root ausführen: sudo bash install.sh"

echo ""
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo -e "${BOLD}   EMS Pi — Inbetriebnahme             ${NC}"
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo ""

# ── 1. Hardware-ID aus MAC ─────────────────────────────────────
info "Hardware-ID wird ermittelt..."
MAC=""
for iface in eth0 wlan0 enp0s3 ens3; do
    MAC_PATH="/sys/class/net/${iface}/address"
    if [ -f "$MAC_PATH" ]; then
        MAC=$(cat "$MAC_PATH" | tr -d ':')
        IFACE=$iface
        break
    fi
done
[ -z "$MAC" ] && MAC=$(ip link show | awk '/ether/ {print $2}' | head -1 | tr -d ':') && IFACE="auto"
[ -z "$MAC" ] && err "Konnte MAC-Adresse nicht lesen!"

HARDWARE_ID="ems-${MAC}"
ok "Hardware-ID: ${BOLD}${HARDWARE_ID}${NC} (${IFACE})"

SW_VERSION="0.1.0"

# ── 2. Join Code eingeben ──────────────────────────────────────
echo ""
echo -e "${BOLD}Join Code eingeben:${NC}"
echo -e "  Den Code findest du im EMS Dashboard unter"
echo -e "  Standorte → Neuen Pi hinzufügen"
echo ""
read -r -p "  Join Code (6 Zeichen): " JOIN_CODE
JOIN_CODE=$(echo "$JOIN_CODE" | tr '[:lower:]' '[:upper:]' | tr -d ' ')
[ ${#JOIN_CODE} -eq 6 ] || err "Join Code muss genau 6 Zeichen haben"
echo ""

# ── 3. Provision ───────────────────────────────────────────────
info "Verbinde mit EMS Server..."
PROVISION_RESPONSE=$(curl -sf -X POST "$PROVISION_URL" \
    -H "Content-Type: application/json" \
    -d "{\"hardware_id\":\"${HARDWARE_ID}\",\"join_code\":\"${JOIN_CODE}\",\"device_type\":\"raspberry_pi_3b_plus\",\"sw_version\":\"${SW_VERSION}\"}" 2>&1) \
    || err "Provision-Endpoint nicht erreichbar. Internet vorhanden?"

if echo "$PROVISION_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if 'data' in d else 1)" 2>/dev/null; then
    ok "Provisioning erfolgreich!"
else
    ERROR=$(echo "$PROVISION_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error','Unbekannter Fehler'))" 2>/dev/null || echo "$PROVISION_RESPONSE")
    err "Provisioning fehlgeschlagen: ${ERROR}"
fi

extract() { echo "$PROVISION_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['$1'])"; }
MQTT_USER=$(extract mqtt_user)
MQTT_PASSWORD=$(extract mqtt_password)
MQTT_BROKER=$(extract mqtt_broker)
MQTT_PORT=$(extract mqtt_port)
SUPABASE_URL=$(extract supabase_url)
ANON_KEY=$(extract anon_key)
SITE_ID=$(extract site_id)
DEVICE_ID=$(extract device_id)

# ── 4. Abhängigkeiten ─────────────────────────────────────────
info "Pakete installieren..."
apt-get update -qq
apt-get install -y -qq python3 python3-pip python3-venv curl mosquitto-clients

info "Python-Pakete installieren..."
mkdir -p "$INSTALL_DIR"
python3 -m venv "$INSTALL_DIR/venv"
"$INSTALL_DIR/venv/bin/pip" install -q paho-mqtt pymodbus httpx python-dotenv
ok "Pakete installiert"

# ── 5. .env schreiben ─────────────────────────────────────────
info "Konfiguration speichern..."
cat > "$INSTALL_DIR/.env" <<EOF
HARDWARE_ID=${HARDWARE_ID}
DEVICE_ID=${DEVICE_ID}
SITE_ID=${SITE_ID}
MQTT_BROKER=${MQTT_BROKER}
MQTT_PORT=${MQTT_PORT}
MQTT_USER=${MQTT_USER}
MQTT_PASSWORD=${MQTT_PASSWORD}
MQTT_TLS=false
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_ANON_KEY=${ANON_KEY}
POLL_INTERVAL=60
TELEMETRY_INTERVAL=60
LOG_LEVEL=INFO
EOF
chmod 600 "$INSTALL_DIR/.env"
ok "Konfiguration gespeichert"

# ── 6. poller.py herunterladen ────────────────────────────────
info "Poller Script herunterladen..."
curl -fsSL "$POLLER_URL" -o "$INSTALL_DIR/poller.py" || err "Konnte poller.py nicht herunterladen"
chmod +x "$INSTALL_DIR/poller.py"
ok "poller.py installiert"

# ── 7. systemd Service ────────────────────────────────────────
info "Systemd Service installieren..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=EMS Pi Poller
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${INSTALL_DIR}/venv/bin/python3 ${INSTALL_DIR}/poller.py
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env
Restart=always
RestartSec=30
User=root
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ems-poller

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"
ok "Service gestartet!"

# ── 8. Zusammenfassung ────────────────────────────────────────
echo ""
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}   ✓ EMS Pi erfolgreich eingerichtet!  ${NC}"
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo ""
echo -e "  Hardware-ID:  ${BOLD}${HARDWARE_ID}${NC}"
echo -e "  Standort-ID:  ${SITE_ID}"
echo -e "  MQTT Broker:  ${MQTT_BROKER}:${MQTT_PORT}"
echo ""
echo -e "  Logs:  ${BOLD}journalctl -u ${SERVICE_NAME} -f${NC}"
echo ""
echo -e "  Gerät erscheint jetzt im EMS Dashboard."
echo ""
