# Pulso HOLOS

Motor de presentaciones con preguntas en vivo para talleres y demos de HOLOS.

- `kit/` es el motor compartido: `presenta/deck.js`, `presenta/deck.css`, `pulso.html` (lo que ven los participantes en su celular), `remote.php` (notas en el celular) y los logos. Se copia igual a cada taller.
- `talleres/<nombre>/` es cada taller o demo, con sus propias sesiones en `presenta/`. Se publica en `https://holos.team/<nombre>/`.
- `talleres/catalogo/` muestra todas las funciones disponibles, una por diapositiva. Es la referencia para armar talleres nuevos.
- `deploy/publicar.sh` publica un taller en el servidor (`pulso <nombre>`).

Cada taller tiene su propia carpeta de datos en `/home/agdesign/secure_data/<nombre>/`. El `api.php` no vive en el repositorio: se copia del de emprende la primera vez que se publica.
