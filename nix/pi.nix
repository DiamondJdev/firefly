# Single Pi 5 demo node: WiFi, SSH, Tailscale, single-node k3s.
{ lib, ... }:
{
  imports = [ ./wifi.nix ]; # gitignored: networking.wireless.networks."SSID".psk = "...";

  networking.hostName = "firefly-pi";
  boot.supportedFilesystems.zfs = lib.mkForce false; # sd-image base enables ZFS; skip compiling it for the Pi kernel
  networking.wireless.enable = true;

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

  system.stateVersion = "26.05";
}
