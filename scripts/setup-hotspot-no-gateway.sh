#!/bin/bash
set -e

echo "🧰 Instalando dependencias..."
apt update
apt install -y hostapd dnsmasq

echo "📶 Configurando red estática en wlan0..."

cat <<EOF > /etc/network/interfaces.d/wlan0
auto wlan0
iface wlan0 inet static
    address 192.168.4.1
    netmask 255.255.255.0
EOF

echo "🔌 Reiniciando red..."
ifdown wlan0 || true
ifup wlan0

echo "📡 Configurando hostapd..."
mkdir -p /etc/hostapd
cat <<EOF > /etc/hostapd/hostapd.conf
interface=wlan0
driver=nl80211
ssid=HotspotLocalPi
hw_mode=g
channel=6
wmm_enabled=0
auth_algs=1
wpa=2
wpa_passphrase=clave1234
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
EOF

sed -i 's|#DAEMON_CONF=.*|DAEMON_CONF="/etc/hostapd/hostapd.conf"|' /etc/default/hostapd

echo "🔧 Configurando dnsmasq..."
mv /etc/dnsmasq.conf /etc/dnsmasq.conf.orig || true
cat <<EOF > /etc/dnsmasq.conf
interface=wlan0
dhcp-range=192.168.4.10,192.168.4.50,255.255.255.0,24h
dhcp-option=3       # Sin gateway
dhcp-option=6       # Sin DNS
EOF

echo "🚀 Habilitando y reiniciando servicios..."
systemctl unmask hostapd
systemctl enable hostapd
systemctl restart hostapd
systemctl restart dnsmasq

echo ""
echo "✅ Hotspot creado correctamente en wlan0"
echo "SSID: HotspotLocalPi"
echo "Clave: clave1234"
echo "IP local de la Pi: 192.168.4.1"