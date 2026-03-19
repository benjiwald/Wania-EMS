#!/usr/bin/env python3
"""
EMS Pi Poller
=============
- Liest Assets (Modbus-Geräte) aus Supabase DB
- Pollt jeden Asset per Modbus TCP
- Sendet Telemetrie per MQTT an Hetzner Broker
- Empfängt Kommandos vom Dashboard via MQTT
- Meldet eigenen Status (online/offline) per MQTT LWT
"""

import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any

import httpx
import paho.mqtt.client as mqtt
from pymodbus.client import ModbusTcpClient
from pymodbus.exceptions import ModbusException

# ── Konfiguration ──────────────────────────────────────────────────────────────

HARDWARE_ID      = os.environ["HARDWARE_ID"]
MQTT_BROKER      = os.environ["MQTT_BROKER"]
MQTT_PORT        = int(os.environ.get("MQTT_PORT", 1883))
MQTT_USER        = os.environ["MQTT_USER"]
MQTT_PASSWORD    = os.environ["MQTT_PASSWORD"]
SUPABASE_URL     = os.environ["SUPABASE_URL"]
SUPABASE_ANON    = os.environ["SUPABASE_ANON_KEY"]
POLL_INTERVAL    = int(os.environ.get("POLL_INTERVAL", 60))
TELEMETRY_INTERVAL = int(os.environ.get("TELEMETRY_INTERVAL", 60))
LOG_LEVEL        = os.environ.get("LOG_LEVEL", "INFO")

TOPIC_TELEMETRY  = f"ems/{HARDWARE_ID}/telemetry"
TOPIC_STATUS     = f"ems/{HARDWARE_ID}/status"
TOPIC_LOGS       = f"ems/{HARDWARE_ID}/logs"
TOPIC_COMMAND    = f"ems/{HARDWARE_ID}/command"
TOPIC_CONFIG     = f"ems/{HARDWARE_ID}/config"

# ── Logging ────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("ems")

# ── State ──────────────────────────────────────────────────────────────────────

assets: list[dict] = []
mqtt_client: mqtt.Client | None = None
last_asset_refresh = 0.0


# ── Supabase: Assets laden ─────────────────────────────────────────────────────

def fetch_assets() -> list[dict]:
    """Lädt alle aktiven Assets des eigenen Standorts aus Supabase."""
    global last_asset_refresh

    try:
        # Device → site_id ermitteln
        resp = httpx.get(
            f"{SUPABASE_URL}/rest/v1/devices",
            params={"hardware_id": f"eq.{HARDWARE_ID}", "select": "site_id"},
            headers={"apikey": SUPABASE_ANON, "Authorization": f"Bearer {SUPABASE_ANON}"},
            timeout=10,
        )
        resp.raise_for_status()
        devices = resp.json()
        if not devices:
            log.warning("Kein Device mit hardware_id=%s gefunden", HARDWARE_ID)
            return []

        site_id = devices[0]["site_id"]

        # Assets für diesen Standort laden
        resp = httpx.get(
            f"{SUPABASE_URL}/rest/v1/assets",
            params={
                "site_id": f"eq.{site_id}",
                "status": "eq.active",
                "connection_type": "eq.modbus_tcp",
                "select": "id,name,asset_type,connection_params,modbus_register_map",
            },
            headers={"apikey": SUPABASE_ANON, "Authorization": f"Bearer {SUPABASE_ANON}"},
            timeout=10,
        )
        resp.raise_for_status()
        result = resp.json()
        last_asset_refresh = time.time()
        log.info("Assets geladen: %d Geräte für site_id=%s", len(result), site_id)
        return result

    except Exception as e:
        log.error("Asset-Fetch fehlgeschlagen: %s", e)
        return assets  # alte Liste beibehalten


# ── Modbus: Register lesen ─────────────────────────────────────────────────────

def read_register(client: ModbusTcpClient, reg: dict) -> float | None:
    """Liest ein einzelnes Modbus-Register und wendet Scale an."""
    address  = reg["address"]
    reg_type = reg.get("type", "uint16")
    scale    = float(reg.get("scale", 1))
    unit_id  = reg.get("_unit_id", 1)  # wird vor dem Aufruf gesetzt

    try:
        count = 2 if reg_type in ("int32", "uint32") else 1

        result = client.read_holding_registers(address, count=count, slave=unit_id)
        if result.isError():
            return None

        regs = result.registers
        if reg_type == "int16":
            raw = regs[0] if regs[0] < 32768 else regs[0] - 65536
        elif reg_type == "uint16":
            raw = regs[0]
        elif reg_type == "int32":
            raw = (regs[0] << 16) | regs[1]
            if raw >= 2**31:
                raw -= 2**32
        elif reg_type == "uint32":
            raw = (regs[0] << 16) | regs[1]
        else:
            raw = regs[0]

        return round(raw * scale, 4)

    except Exception as e:
        log.debug("Register %d lesen fehlgeschlagen: %s", address, e)
        return None


def poll_asset(asset: dict) -> list[dict]:
    """Pollt alle Register eines Assets. Gibt Liste von Metriken zurück."""
    conn    = asset.get("connection_params", {})
    regmap  = asset.get("modbus_register_map", {})
    host    = conn.get("host", "")
    port    = int(conn.get("port", 502))
    unit_id = int(conn.get("unit_id", 1))
    timeout = int(conn.get("timeout_ms", 3000)) / 1000

    if not host or host.startswith("192.168.x"):
        log.debug("Asset %s: IP noch nicht konfiguriert (%s)", asset["name"], host)
        return []

    metrics = []

    try:
        client = ModbusTcpClient(host, port=port, timeout=timeout)
        if not client.connect():
            log.warning("Asset %s: Modbus Verbindung fehlgeschlagen (%s:%d)", asset["name"], host, port)
            return []

        try:
            for key, reg in regmap.items():
                reg["_unit_id"] = unit_id
                value = read_register(client, reg)
                if value is not None:
                    metrics.append({
                        "metric_type": reg.get("metric_key", key),
                        "value":       value,
                        "unit":        reg.get("unit", ""),
                    })
        finally:
            client.close()

        if metrics:
            log.debug("Asset %s: %d Metriken gelesen", asset["name"], len(metrics))
        else:
            log.warning("Asset %s: Keine Metriken gelesen (Timeout?)", asset["name"])

    except Exception as e:
        log.error("Asset %s: Fehler beim Polling: %s", asset["name"], e)

    return metrics


# ── MQTT ───────────────────────────────────────────────────────────────────────

def publish_telemetry(all_metrics: list[dict]) -> None:
    """Sendet Telemetrie-Payload an MQTT Broker."""
    if not all_metrics:
        return

    payload = json.dumps({
        "hardware_id": HARDWARE_ID,
        "ts":          datetime.now(timezone.utc).isoformat(),
        "metrics":     all_metrics,
    })

    result = mqtt_client.publish(TOPIC_TELEMETRY, payload, qos=1)
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        log.info("Telemetrie gesendet: %d Metriken", len(all_metrics))
    else:
        log.error("Telemetrie-Publish fehlgeschlagen: rc=%d", result.rc)


def publish_log(level: str, message: str, metadata: dict | None = None) -> None:
    """Sendet einen Log-Eintrag ans Dashboard."""
    payload = json.dumps({
        "level":    level,
        "message":  message,
        "metadata": metadata or {},
        "ts":       datetime.now(timezone.utc).isoformat(),
    })
    mqtt_client.publish(TOPIC_LOGS, payload, qos=0)


def on_connect(client: mqtt.Client, userdata: Any, flags: Any, rc: int) -> None:
    if rc == 0:
        log.info("MQTT verbunden mit %s:%d", MQTT_BROKER, MQTT_PORT)
        client.subscribe(TOPIC_COMMAND, qos=1)
        client.subscribe(TOPIC_CONFIG, qos=1)
        # Online-Status setzen
        client.publish(TOPIC_STATUS, json.dumps({
            "hardware_id": HARDWARE_ID,
            "status":      "online",
            "ts":          datetime.now(timezone.utc).isoformat(),
        }), qos=1, retain=True)
    else:
        log.error("MQTT Verbindung fehlgeschlagen: rc=%d", rc)


def on_disconnect(client: mqtt.Client, userdata: Any, rc: int) -> None:
    log.warning("MQTT getrennt: rc=%d — reconnect in 30s", rc)


def on_message(client: mqtt.Client, userdata: Any, msg: mqtt.MQTTMessage) -> None:
    """Verarbeitet eingehende Kommandos vom Dashboard."""
    try:
        payload = json.loads(msg.payload.decode())
        topic   = msg.topic
        log.info("Kommando empfangen [%s]: %s", topic, payload)

        if topic == TOPIC_COMMAND:
            handle_command(payload)
        elif topic == TOPIC_CONFIG:
            handle_config_update(payload)

    except json.JSONDecodeError:
        log.error("Ungültiges JSON in Nachricht: %s", msg.payload)
    except Exception as e:
        log.error("Fehler beim Verarbeiten der Nachricht: %s", e)


def handle_command(cmd: dict) -> None:
    """Verarbeitet Steuer-Kommandos."""
    action = cmd.get("action", "")

    if action == "reload_assets":
        global assets
        log.info("Kommando: Assets neu laden")
        assets = fetch_assets()
        publish_log("info", f"Assets neu geladen: {len(assets)} Geräte")

    elif action == "set_wallbox_current":
        # Beispiel: Wallbox-Strom setzen (zukünftig via Modbus Write)
        asset_id = cmd.get("asset_id")
        current  = cmd.get("current_a")
        log.info("Kommando: Wallbox %s → %sA", asset_id, current)
        publish_log("info", f"Wallbox-Strom gesetzt: {current}A", {"asset_id": asset_id})
        # TODO: Modbus Write implementieren

    elif action == "restart":
        log.info("Kommando: Neustart")
        publish_log("info", "Neustart auf Befehl")
        time.sleep(2)
        os.execv(sys.executable, [sys.executable] + sys.argv)

    elif action == "ping":
        publish_log("info", "pong", {"ts": datetime.now(timezone.utc).isoformat()})

    else:
        log.warning("Unbekanntes Kommando: %s", action)


def handle_config_update(config: dict) -> None:
    """Verarbeitet Konfig-Updates (poll_interval etc.)."""
    global POLL_INTERVAL, TELEMETRY_INTERVAL

    if "poll_interval_seconds" in config:
        POLL_INTERVAL = int(config["poll_interval_seconds"])
        log.info("Poll-Intervall auf %ds gesetzt", POLL_INTERVAL)

    if "telemetry_interval_seconds" in config:
        TELEMETRY_INTERVAL = int(config["telemetry_interval_seconds"])
        log.info("Telemetrie-Intervall auf %ds gesetzt", TELEMETRY_INTERVAL)


def setup_mqtt() -> mqtt.Client:
    """MQTT Client initialisieren."""
    client = mqtt.Client(client_id=HARDWARE_ID, clean_session=False)
    client.username_pw_set(MQTT_USER, MQTT_PASSWORD)

    # Last Will: offline-Status wenn Verbindung unerwartet abbricht
    client.will_set(TOPIC_STATUS, json.dumps({
        "hardware_id": HARDWARE_ID,
        "status":      "offline",
        "ts":          datetime.now(timezone.utc).isoformat(),
    }), qos=1, retain=True)

    client.on_connect    = on_connect
    client.on_disconnect = on_disconnect
    client.on_message    = on_message

    return client


# ── Hauptschleife ──────────────────────────────────────────────────────────────

def main() -> None:
    global assets, mqtt_client

    log.info("EMS Pi Poller gestartet — Hardware-ID: %s", HARDWARE_ID)

    # MQTT verbinden
    mqtt_client = setup_mqtt()
    try:
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
    except Exception as e:
        log.error("MQTT Verbindung fehlgeschlagen: %s", e)
        sys.exit(1)

    mqtt_client.loop_start()

    # Assets initial laden
    assets = fetch_assets()
    if not assets:
        log.warning("Keine Assets konfiguriert — warte auf Dashboard-Konfiguration")
        publish_log("warning", "Keine Modbus-Geräte konfiguriert. Bitte im Dashboard hinzufügen.")

    last_poll_time = 0.0

    while True:
        now = time.time()

        # Assets alle 5 Minuten neu laden (erkennt neue Geräte im Dashboard)
        if now - last_asset_refresh > 300:
            assets = fetch_assets()

        # Modbus pollen
        if now - last_poll_time >= POLL_INTERVAL:
            last_poll_time = now
            all_metrics = []

            for asset in assets:
                metrics = poll_asset(asset)
                all_metrics.extend(metrics)

            if all_metrics:
                publish_telemetry(all_metrics)
            elif assets:
                log.warning("Keine Metriken gesammelt (alle Geräte offline?)")

        time.sleep(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("EMS Poller beendet")
        if mqtt_client:
            mqtt_client.publish(TOPIC_STATUS, json.dumps({
                "hardware_id": HARDWARE_ID,
                "status":      "offline",
                "ts":          datetime.now(timezone.utc).isoformat(),
            }), qos=1, retain=True)
            mqtt_client.disconnect()
