{
  description = "Phoenix Firefly nodes";

  # Prebuilt Pi kernel/firmware, so nothing big compiles locally.
  nixConfig = {
    extra-substituters = [ "https://nixos-raspberrypi.cachix.org" ];
    extra-trusted-public-keys = [
      "nixos-raspberrypi.cachix.org-1:4iMO9LXa8BqhU+Rpg6LQKiGa2lsNh/j2oiYLNOQ5sPI="
    ];
  };

  # Keep nixos-raspberrypi's own nixpkgs pin: overriding it misses the binary cache.
  # flake.lock pins that nixpkgs, which pins the k3s version.
  inputs.nixos-raspberrypi.url = "github:nvmd/nixos-raspberrypi/main";
  inputs.sops-nix = {
    url = "github:Mic92/sops-nix";
    inputs.nixpkgs.follows = "nixos-raspberrypi/nixpkgs";
  };

  outputs =
    { nixos-raspberrypi, sops-nix, ... }:
    {
      packages.aarch64-linux.image-tools =
        let
          pkgs = nixos-raspberrypi.inputs.nixpkgs.legacyPackages.aarch64-linux;
        in
        pkgs.buildEnv {
          name = "firefly-image-tools";
          paths = with pkgs; [
            python3
            e2fsprogs
            util-linux
            zstd
            sops
            age
          ];
        };

      # Flashable image: bash nix/build-image.sh, which builds firefly-pi-image.
      # Never flash firefly-pi: a fresh card can't decrypt the tunnel secret, so it boots without Wi-Fi.
      nixosConfigurations =
        let
          # Pi #1's Tailscale address. It stays the same unless the node is removed from the tailnet.
          controlPlaneIp = "100.79.119.115";
          host =
            hostName: modules:
            nixos-raspberrypi.lib.nixosSystem {
              modules = [
                nixos-raspberrypi.nixosModules.raspberry-pi-5.base
                nixos-raspberrypi.nixosModules.sd-image
                sops-nix.nixosModules.sops
                ./pi.nix
                { networking.hostName = hostName; }
              ]
              ++ modules;
            };
          agent = args: import ./k3s-agent.nix ({ inherit controlPlaneIp; } // args);
          worker = agent { labels = [ "serve=true" ]; };
        in
        {
          firefly-pi = host "firefly-pi" [
            ./tunnel.nix
            (import ./k3s-server.nix { inherit controlPlaneIp; })
          ];
          firefly-pi-2 = host "firefly-pi-2" [ worker ];
          firefly-pi-3 = host "firefly-pi-3" [ worker ];
          firefly-pi-4 = host "firefly-pi-4" [ worker ];
          firefly-pi-5 = host "firefly-pi-5" [
            (agent {
              labels = [ "role=builder" ];
              taints = [ "builder=true:NoSchedule" ];
            })
          ];
          # Reusable Wi-Fi image: no k3s, and only secrets the wifi-image key can decrypt.
          firefly-pi-image = host "firefly-new" [ ];
        };
    };
}
