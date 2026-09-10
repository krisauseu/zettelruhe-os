#!/bin/sh
# Ausschließlich der lokale Compose-Testbestand; ergänzt und entfernt Testrecords.
set -eu
cd "$(dirname "$0")/.."
case "${DOCKER_HOST:-unix://local}" in
  unix://*) ;;
  *) echo 'Abbruch: DOCKER_HOST darf nicht auf einen entfernten Host zeigen.' >&2; exit 1 ;;
esac
case "$(docker context inspect --format '{{.Endpoints.docker.Host}}')" in
  unix://*) ;;
  *) echo 'Abbruch: Docker muss einen lokalen Unix-Socket verwenden.' >&2; exit 1 ;;
esac
[ "$(docker inspect zettelruhe-next-1 --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}')" = "$(pwd)" ]
[ "$(docker inspect zettelruhe-caddy-1 --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}')" = "$(pwd)" ]
[ "$(docker inspect zettelruhe-pocketbase-1 --format '{{range .Mounts}}{{if eq .Destination "/pb_data"}}{{.Name}}{{end}}{{end}}')" = 'zettelruhe_pb_data' ]
docker exec -i zettelruhe-next-1 node < scripts/test-pocketbase-isolation.cjs
