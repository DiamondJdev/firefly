# Cluster traffic runs over Tailscale, so nodes need no fixed LAN addresses or open LAN ports.
{ config, pkgs, ... }:
{
  # A node's Tailscale address is only known after login, so hand it to k3s through a config drop-in.
  systemd.services.k3s-node-ip = {
    description = "Give k3s this node's Tailscale address";
    after = [ "tailscaled.service" ];
    wants = [ "tailscaled.service" ];
    before = [ "k3s.service" ];
    path = [
      config.services.tailscale.package
      pkgs.coreutils
    ];
    serviceConfig = {
      Type = "oneshot";
      RemainAfterExit = true;
    };
    script = ''
      for _ in $(seq 30); do
        if address=$(tailscale ip -4 2>/dev/null) && [ -n "$address" ]; then
          mkdir -p /etc/rancher/k3s/config.yaml.d
          printf 'node-ip: %s\n' "$address" > /etc/rancher/k3s/config.yaml.d/10-node-ip.yaml
          exit 0
        fi
        sleep 2
      done
      echo "No Tailscale address. Run: sudo tailscale up" >&2
      exit 1
    '';
  };
  systemd.services.k3s = {
    after = [ "k3s-node-ip.service" ];
    requires = [ "k3s-node-ip.service" ];
  };
}
