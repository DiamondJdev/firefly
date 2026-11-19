# The only k3s server. SQLite is the default datastore, so there is no etcd.
{ controlPlaneIp }:
{
  imports = [ ./k3s-tailscale.nix ];
  services.k3s = {
    enable = true;
    role = "server";
    # Pin IPv4: if IPv6 comes up first at boot, k3s otherwise creates a permanent IPv6-only cluster.
    extraFlags = [
      "--write-kubeconfig-mode=0600"
      "--secrets-encryption"
      "--cluster-cidr=10.42.0.0/16"
      "--service-cidr=10.43.0.0/16"
      "--flannel-iface=tailscale0"
      "--advertise-address=${controlPlaneIp}"
      "--tls-san=${controlPlaneIp}"
      "--node-label=role=control"
    ];
  };
}
