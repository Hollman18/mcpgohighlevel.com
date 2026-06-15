#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Hollman18/Go-High-Level-MCP-2026-Complete.git}"
BRANCH="${BRANCH:-main}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/ghl-mcp}"
ENV_SOURCE="${ENV_SOURCE:-/tmp/ghl-mcp.env}"
MCP_DOMAIN="${MCP_DOMAIN:-}"
MCP_SITE_DOMAIN="${MCP_SITE_DOMAIN:-}"
CADDY_EMAIL="${CADDY_EMAIL:-}"

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

run_apt() {
  if [ -n "$SUDO" ]; then
    $SUDO env DEBIAN_FRONTEND=noninteractive apt-get "$@"
  else
    DEBIAN_FRONTEND=noninteractive apt-get "$@"
  fi
}

ensure_base_packages() {
  run_apt update
  run_apt install -y ca-certificates curl git gnupg ufw
}

ensure_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return
  fi

  . /etc/os-release
  case "${ID:-}" in
    ubuntu)
      docker_os="ubuntu"
      docker_codename="${UBUNTU_CODENAME:-$VERSION_CODENAME}"
      ;;
    debian)
      docker_os="debian"
      docker_codename="$VERSION_CODENAME"
      ;;
    *)
      echo "Unsupported OS for automatic Docker install: ${ID:-unknown}" >&2
      exit 1
      ;;
  esac

  $SUDO install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$docker_os/gpg" | $SUDO tee /etc/apt/keyrings/docker.asc >/dev/null
  $SUDO chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$docker_os $docker_codename stable" | $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null

  run_apt update
  run_apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  $SUDO systemctl enable --now docker
}

has_traefik() {
  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi

  $SUDO docker ps --format '{{.Names}}' | grep -qi 'traefik'
}

ensure_caddy() {
  if [ -z "$MCP_DOMAIN" ] || has_traefik || command -v caddy >/dev/null 2>&1; then
    return
  fi

  run_apt install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | $SUDO gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | $SUDO tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  $SUDO chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  run_apt update
  run_apt install -y caddy
}

configure_firewall() {
  if ! command -v ufw >/dev/null 2>&1; then
    return
  fi

  $SUDO ufw allow OpenSSH >/dev/null || true
  $SUDO ufw allow 80/tcp >/dev/null || true
  $SUDO ufw allow 443/tcp >/dev/null || true
  $SUDO ufw deny 8000/tcp >/dev/null || true
  $SUDO ufw --force enable >/dev/null || true
}

sync_repo() {
  $SUDO mkdir -p "$DEPLOY_PATH"
  if [ ! -d "$DEPLOY_PATH/.git" ]; then
    $SUDO git clone --branch "$BRANCH" "$REPO_URL" "$DEPLOY_PATH"
  else
    $SUDO git -C "$DEPLOY_PATH" remote set-url origin "$REPO_URL"
    $SUDO git -C "$DEPLOY_PATH" fetch origin "$BRANCH"
    $SUDO git -C "$DEPLOY_PATH" reset --hard "origin/$BRANCH"
  fi
}

prepare_persistent_data() {
  $SUDO mkdir -p "$DEPLOY_PATH/data"
  $SUDO chown 1000:1000 "$DEPLOY_PATH/data"
  $SUDO chmod 700 "$DEPLOY_PATH/data"
}

install_env_file() {
  if [ ! -f "$ENV_SOURCE" ]; then
    echo "Missing env file at $ENV_SOURCE" >&2
    exit 1
  fi

  $SUDO cp "$ENV_SOURCE" "$DEPLOY_PATH/.env"
  $SUDO chmod 600 "$DEPLOY_PATH/.env"

  {
    printf '\n'
    printf 'MCP_DOMAIN=%s\n' "$MCP_DOMAIN"
    printf 'MCP_SITE_DOMAIN=%s\n' "$MCP_SITE_DOMAIN"
    if [ -n "$MCP_DOMAIN" ] && has_traefik; then
      printf 'TRAEFIK_ENABLE=%s\n' "${TRAEFIK_ENABLE:-true}"
      printf 'TRAEFIK_CERT_RESOLVER=%s\n' "${TRAEFIK_CERT_RESOLVER:-letsencrypt}"
    fi
  } | $SUDO tee -a "$DEPLOY_PATH/.env" >/dev/null
}

configure_caddy() {
  if [ -z "$MCP_DOMAIN" ]; then
    return
  fi

  if has_traefik; then
    echo "Traefik detected; using Docker labels and skipping Caddy."
    if command -v caddy >/dev/null 2>&1; then
      $SUDO systemctl disable --now caddy >/dev/null 2>&1 || true
    fi
    return
  fi

  global_block=""
  if [ -n "$CADDY_EMAIL" ]; then
    global_block="{
    email $CADDY_EMAIL
}

"
  fi

  tmpfile="$(mktemp)"
  caddy_domains="$MCP_DOMAIN"
  if [ -n "$MCP_SITE_DOMAIN" ] && [ "$MCP_SITE_DOMAIN" != "$MCP_DOMAIN" ]; then
    caddy_domains="$caddy_domains, $MCP_SITE_DOMAIN"
  fi

  cat > "$tmpfile" <<EOF
${global_block}${caddy_domains} {
    encode gzip
    reverse_proxy 127.0.0.1:8000
}
EOF

  $SUDO cp "$tmpfile" /etc/caddy/Caddyfile
  rm -f "$tmpfile"
  $SUDO caddy validate --config /etc/caddy/Caddyfile
  $SUDO systemctl enable --now caddy
  $SUDO systemctl reload caddy || $SUDO systemctl restart caddy
}

deploy_compose() {
  if [ -n "$MCP_DOMAIN" ] && has_traefik; then
    export TRAEFIK_ENABLE="${TRAEFIK_ENABLE:-true}"
    export TRAEFIK_CERT_RESOLVER="${TRAEFIK_CERT_RESOLVER:-letsencrypt}"
  fi

  cd "$DEPLOY_PATH"
  $SUDO docker compose up -d --force-recreate --build --remove-orphans
  $SUDO docker compose ps
}

ensure_base_packages
ensure_docker
ensure_caddy
configure_firewall
sync_repo
prepare_persistent_data
install_env_file
deploy_compose
configure_caddy

echo "Deployment complete."
if [ -n "$MCP_DOMAIN" ]; then
  echo "MCP endpoint: https://$MCP_DOMAIN/mcp"
else
  echo "MCP endpoint is available behind your reverse proxy at /mcp."
fi
