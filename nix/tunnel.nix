# Live Pi only: the reusable image leaves this out, because the wifi-image key can't decrypt the tunnel secret
# and sops-nix installs no secrets at all (Wi-Fi included) when one fails.
{ config, ... }:
{
  # All *.diamondjdev.me traffic arrives here and goes to Traefik, which routes by Ingress host. Dials out only.
  # ponytail: one host service, one tunnel; move to a k8s Deployment with replicas once a second Pi joins.
  sops.secrets.cloudflared-tunnel = {
    sopsFile = ./tunnel-credentials.json;
    format = "binary";
  };
  services.cloudflared = {
    enable = true;
    tunnels."c316183f-58f5-4dc3-9046-bb258677cbbc" = {
      credentialsFile = config.sops.secrets.cloudflared-tunnel.path;
      ingress."*.diamondjdev.me" = "http://localhost:80";
      default = "http_status:404";
    };
  };
}
