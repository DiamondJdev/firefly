# Single Pi 5 demo node: WiFi, SSH, Tailscale, single-node k3s.
{ config, lib, ... }:
{
  sops.defaultSopsFile = ./secrets.yaml;
  sops.age.keyFile = "/var/lib/firefly/wifi.agekey";
  sops.age.generateKey = true;
  sops.age.sshKeyPaths = [ "/etc/ssh/ssh_host_ed25519_key" ];
  sops.secrets.wireless_env = {
    owner = "wpa_supplicant";
    restartUnits = [ "wpa_supplicant.service" ];
  };

  networking.hostName = "firefly-pi";
  boot.supportedFilesystems.zfs = lib.mkForce false; # sd-image base enables ZFS; skip compiling it for the Pi kernel
  networking.wireless.enable = true;
  networking.wireless.secretsFile = config.sops.secrets.wireless_env.path;
  networking.wireless.networks."FBI Surveillance Van".pskRaw = "ext:psk_home";

  # ponytail: no user password, so no console login; SSH key only. Add one if you need the HDMI console.
  users.users.diamondjdev = {
    isNormalUser = true;
    extraGroups = [ "wheel" ];
    openssh.authorizedKeys.keys = [ "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJiSCGJgwYLRkQ1ChiLNmYI2innNQ838QGIl/zEHLRWB" ];
  };
  security.sudo.wheelNeedsPassword = false;
  nix.settings.trusted-users = [ "@wheel" ]; # allows nixos-rebuild --target-host from the Mac

  services.openssh = {
    enable = true;
    settings.PasswordAuthentication = false;
    settings.PermitRootLogin = "no";
  };

  # First SSH via firefly-pi.local, before Tailscale is logged in.
  services.avahi = {
    enable = true;
    nssmdns4 = true;
    publish = {
      enable = true;
      addresses = true;
    };
  };

  # Log in once with `sudo tailscale up`; no auth key stored in config.
  services.tailscale.enable = true;

  services.k3s = {
    enable = true;
    role = "server";
    # Pin IPv4: if IPv6 comes up first at boot, k3s otherwise creates a permanent IPv6-only cluster.
    extraFlags = [
      "--write-kubeconfig-mode=0644"
      "--cluster-cidr=10.42.0.0/16"
      "--service-cidr=10.43.0.0/16"
    ];
  };
  # Pi kernels ship with the memory cgroup off; k3s won't start without it.
  boot.kernelParams = [
    "cgroup_enable=cpuset"
    "cgroup_enable=memory"
    "cgroup_memory=1"
  ];
  # k3s API and apps reachable only over Tailscale; cni0 lets pods reach the API. LAN gets SSH only.
  networking.firewall.trustedInterfaces = [
    "tailscale0"
    "cni0"
  ];

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

  system.stateVersion = "26.05";
}
