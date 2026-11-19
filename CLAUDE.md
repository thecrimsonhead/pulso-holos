# Pulso HOLOS: cómo trabajar en este repositorio

- Un taller o demo nuevo = una carpeta nueva en `talleres/<nombre>/presenta/` con uno o más `.html` que definen `window.SESSION` y cargan `deck.css` y `deck.js` (copia la cabecera de `talleres/catalogo/presenta/catalogo.html`).
- Las funciones disponibles están todas en `talleres/catalogo/presenta/catalogo.html`. Úsalas como referencia de campos; no inventes tipos que no existan en `kit/presenta/deck.js`.
- Si un taller necesita una función nueva, agrégala al `kit/` (para que la tengan todos) y una diapositiva de ejemplo al catálogo.
- No subas `api.php` ni datos de participantes. El repositorio debe ser privado si contiene contenido de clientes.
- Antes de entregar: probar en local con `php -S` y un `api.php` de prueba, con un celular simulado (Playwright, `executablePath: '/opt/pw-browsers/chromium'`), y revisar cada diapositiva en captura.
- Contenido: español de México, de tú, sin guiones largos; nivel profesional (nada de ejemplos infantiles); proponer la estructura a Alan y que la apruebe antes de construir.
- Publicar: Alan corre `pulso <nombre>` en el servidor.
