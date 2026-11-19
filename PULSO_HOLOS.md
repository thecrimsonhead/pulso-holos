# Pulso HOLOS · guía para crear talleres y demos

Pulso es el sistema propio de HOLOS para dar talleres y demos con preguntas en vivo: el presentador avanza su presentación y los participantes contestan desde su celular (encuestas, nube de palabras, quiz con ranking, Wordle, matriz de Eisenhower, etc.). Cada taller o demo es distinto y usa solo las funciones que necesita.

## Dónde vive

- **Repositorio:** `github.com/thecrimsonhead/pulso-holos` (debe ser privado).
  - `kit/`: motor compartido (`presenta/deck.js`, `presenta/deck.css`, `pulso.html`, `remote.php`, logos). Todas las funciones viven aquí.
  - `talleres/<nombre>/presenta/*.html`: cada taller o demo, con su propia estructura.
  - `talleres/catalogo/presenta/catalogo.html`: una diapositiva por cada función disponible. Es el menú y la referencia de campos.
  - `deploy/publicar.sh`: publica un taller.
- **Publicar:** en el servidor, como root: `pulso <nombre>` → queda en `https://holos.team/<nombre>/presenta/`.
  - Participantes: `https://holos.team/<nombre>/pulso` (sale también como QR en cada pregunta).
  - Notas en el celular del presentador: `.../presenta/<sesion>.html?movil`.
- **Datos:** cada taller tiene su carpeta en `/home/agdesign/secure_data/<nombre>/`. El `api.php` no está en el repositorio; se copia del de emprende (misma clave) la primera vez que se publica.
- El Taller Emprende (EBC) vive aparte en el repositorio `holos-emprende` y se publica con `holos`.

## Cómo pedirle a Claude un taller o demo nuevo

1. Dale el contexto: cliente, objetivo, duración, número de personas, modalidad (remoto o presencial), temas y dinámicas que quieres.
2. Claude propone la estructura (bloques, tiempos, qué función usa cada momento) y **tú la apruebas antes de construir**.
3. Claude crea `talleres/<nombre>/`, prueba todo en local con un celular simulado y hace push.
4. Tú corres `pulso <nombre>` y abres el link.

Si se necesita una función nueva, se agrega al `kit/` (para todos los talleres) y una diapositiva de ejemplo al catálogo.

## Formato de una sesión

Cada sesión es un `.html` que define `window.SESSION = { id, title, minutes, lang?, slides:[...] }` y carga `deck.css` y `deck.js` (copiar la cabecera de `catalogo.html`). Cada diapositiva lleva `type`, `time:"Min a a b"` y `notes` (HTML para las notas del presentador).

### Diapositivas de contenido

| type | uso | campos |
| --- | --- | --- |
| cover | portada | eyebrow, title (`<em>` = lima), lead, meta [[etiqueta, valor]] |
| statement | idea grande | eyebrow, title, lead, size |
| stat | un dato | num, label, src (fuente obligatoria) |
| cards | tarjetas | title, cols 2-5, cards [{k,h,p,cls g/y/r}] |
| list | lista numerada | title, items [[num, texto, subtexto]] |
| rules | 4 reglas grandes | title, items [[marca, título, texto]] |
| versus | comparar 2-3 cosas | title, cols [{k,q,p,tone lo/hi}], small |
| beforeafter | antes/después con conteo de palabras | title, rows [{biz, antes, despues}] |
| circle | círculo dorado por pasos | title, rows [{id what/how/why, k, p}] |
| brand | una marca por dentro, por pasos | name, lead, what, how, why, note |
| matrix | matriz con celdas de texto | cols, rows, cells |
| activity | ejercicio con temporizador | title, steps, where, minutes, push opcional |
| dash | dashboard incrustado (solo emprende) | tab, only |
| ranking | tabla de posiciones de los quiz | title, lead, prize, polls (opcional), top |

### Preguntas en vivo (`type:"poll"`)

`poll:{ id, type, q, options, correct, why, min, max, minLbl, maxLbl, max_len }`. Los id son únicos, en minúsculas con guiones.

| tipo | qué ve el participante | qué sale en pantalla |
| --- | --- | --- |
| choice | opciones | barras |
| quiz | opciones | barras; R revela la correcta y el porqué; suma al ranking |
| scale | escala | promedio y distribución; `compare:"otro-id"` muestra antes y después |
| words | palabra libre | nube de palabras |
| text | texto libre | muro de respuestas |
| choice/quiz + `quad:{x:[..,..], y:[..,..]}` | 4 opciones | matriz 2x2 (Eisenhower) con % por cuadrante |
| choice + `names:"opción"` | opciones | lista de nombres en orden de quién se apuntó (voluntarios) |
| text + `options:["@rate"]` | nombre, lo que recuerda, 1 a 5, mejora | promedio y tarjetas (calificación entre parejas) |
| text + `options:["@survey", p1, p2, p3]` | 3 calificaciones + comentario | solo el contador (privado para Alan) |
| text + `options:["@wordle", palabra, pista, ...]` | Wordle en el celular | podio por palabras, intentos y tiempo |

Palabras del Wordle: en base64 y al revés (ej. PORQUE → `RVVRUk9Q`).

### Lo que se manda al celular sin pregunta (`push` en una diapositiva)

- `{ type:"copy", text:"https://..." }`: un link con botón Abrir, o un texto para copiar.
- `{ type:"text", options:["@info", paso1, paso2...] }`: instrucciones (para salas de Zoom).
- `{ type:"text", options:["@secret", carta1, carta2...] }`: a cada participante le llega una carta distinta al azar (juegos de roles).

### Ranking

Suma todos los quiz que tienen `correct`. Acierto inmediato = 1000 puntos; baja 10 por segundo; mínimo 500. Empates: gana el más rápido. Se identifica a la persona por el nombre que escribe en Pulso, así que hay que pedir nombre y apellido.

## Teclas del presentador

→ / espacio siguiente · ← anterior · N notas · F pantalla completa · T temporizador · 0 reiniciarlo · R revelar quiz · L limpiar respuestas (siguiente participante, también reinicia el reloj) · S reiniciar reloj de sesión · H ayuda. La presentación debe tener el foco (clic sobre ella) para que funcionen las teclas.

## Reglas de contenido

- Español de México, de tú, frases cortas, sin guiones largos ni emojis. Textos naturales, que no suenen a IA.
- Nivel profesional: nada de ejemplos infantiles; casos reales del cliente o del sector.
- Preguntas neutras (ninguna opción suena a correcta, salvo en quiz). El quiz que verifica un concepto va antes del ejercicio que lo aplica.
- Pocos pulsos y que valgan: cada interacción debe enseñar algo o generar conversación.
- Todo lo que se vea en el celular cabe en una pantalla.
- Marca HOLOS: navy #071b4a, lima #c2f970, texto #e8ecf4, Outfit; logo siempre con "unleashing greatness".
- Probar todo antes de la sesión: presentación en vivo + celular simulado + captura de cada diapositiva.
