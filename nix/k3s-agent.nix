# A stateless k3s agent. Its host key must be a recipient of k3s-agent-token.json before the first deploy.
{
  controlPlaneIp,
  labels,
  taints ? [ ],
}:
{ config, ... }:
{
  imports = [ ./k3s-tailscale.nix ];
  sops.secrets.k3s-agent-token = {
    sopsFile = ./k3s-agent-token.json;
    format = "binary";
    restartUnits = [ "k3s.service" ];
  };
  services.k3s = {
    enable = true;
    role = "agent";
    serverAddr = "https://${controlPlaneIp}:6443";
    tokenFile = config.sops.secrets.k3s-agent-token.path;
    extraFlags = [
      "--flannel-iface=tailscale0"
    ]
    ++ map (label: "--node-label=${label}") labels
    ++ map (taint: "--node-taint=${taint}") taints;
  };
}
