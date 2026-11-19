# Cluster traffic runs over Tailscale, so nodes need no fixed LAN addresses or open LAN ports.
{ config, ... }:
{
  # A node's Tailscale address is only known after login, so hand it to k3s through a config drop-in.
  # One try per start: the k3s module's Restart=always retries every 5s until Tailscale is up.
  systemd.services.k3s = {
    after = [ "tailscaled.service" ];
    wants = [ "tailscaled.service" ];
    path = [ config.services.tailscale.package ];
    preStart = ''
      address=$(tailscale ip -4 2>/dev/null) || address=
      if [ -z "$address" ]; then
        echo "No Tailscale address yet. If this node never logged in, run: sudo tailscale up" >&2
        exit 1
      fi
      mkdir -p /etc/rancher/k3s/config.yaml.d
      printf 'node-ip: %s\n' "$address" > /etc/rancher/k3s/config.yaml.d/10-node-ip.yaml
    '';
  };
}
