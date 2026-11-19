#!/bin/bash
# Publica un taller de talleres/<nombre>/ en https://holos.team/<nombre>/
# Uso (en el servidor, como root): pulso <nombre>
set -e
SLUG="$1"
[ -n "$SLUG" ] || { echo "Uso: pulso <nombre-del-taller>"; ls /home/agdesign/repos/pulso-holos/talleres; exit 1; }
[[ "$SLUG" =~ ^[a-z0-9-]+$ ]] || { echo "Nombre no válido: solo minúsculas, números y guiones."; exit 1; }
[ "$SLUG" = "emprende" ] && { echo "emprende se publica con holos, no con pulso."; exit 1; }
REPO=/home/agdesign/repos/pulso-holos
WEB=/home/agdesign/public_html/holos.team
DEST=$WEB/$SLUG
DATA=/home/agdesign/secure_data/$SLUG
cd "$REPO" && git fetch -q origin main && git reset -q --hard origin/main
[ -d "talleres/$SLUG" ] || { echo "No existe talleres/$SLUG en el repositorio."; exit 1; }
mkdir -p "$DEST" "$DATA/live"
cp -a kit/. "$DEST/"
cp -a "talleres/$SLUG/." "$DEST/"
# api.php: se copia una sola vez del de emprende (misma clave), con su propia carpeta de datos
if [ ! -f "$DEST/api.php" ]; then
  sed -E "s#const DATA_DIR\s*=\s*'[^']*'#const DATA_DIR = '$DATA'#" "$WEB/emprende/api.php" > "$DEST/api.php"
fi
chown -R agdesign:agdesign "$DEST" "$DATA"
echo "$(date '+%F %T') $SLUG $(git rev-parse --short HEAD)" >> /home/agdesign/repos/pulso.log
echo "Listo: https://holos.team/$SLUG/presenta/"
