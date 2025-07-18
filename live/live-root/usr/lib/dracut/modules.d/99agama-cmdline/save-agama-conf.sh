#! /bin/sh

[ -e /dracut-state.sh ] && . /dracut-state.sh

. /lib/dracut-lib.sh

if [ -e /etc/hostname ]; then
  cp /etc/hostname "$NEWROOT/etc/hostname"
fi

if getargbool 1 inst.copy_network; then
  # If there is some explicit network configuration provided through the ip= kernel cmdline option
  # then we set the config server configuration disabling the DHCP auto configuration for ethernet
  # devices and also copying the configuration persistently (bsc#1241224, bsc#122486, bsc#1239777,
  # bsc#1236885).
  if [ -e /run/agama/custom_dracut_network ]; then
    mkdir -p /run/NetworkManager/conf.d
    echo '[main]' >/run/NetworkManager/conf.d/00-agama-server.conf
    echo 'no-auto-default=*' >>/run/NetworkManager/conf.d/00-agama-server.conf
    echo 'ignore-carrier=*' >>/run/NetworkManager/conf.d/00-agama-server.conf

    mkdir -p "$NEWROOT/etc/NetworkManager/system-connections/"
    for _i in /run/NetworkManager/system-connections/*; do
      [ -f "$_i" ] || continue
      grep -q 'origin=nm-initrd-generator' "$_i" 2>/dev/null || continue

      mv "$_i" "$NEWROOT/etc/NetworkManager/system-connections/"
    done
  fi
else
  : >/run/agama/not_copy_network
fi
