/* HOLOS · motor de presentación con encuestas en vivo
   Teclas: → / espacio / PageDown siguiente · ← / PageUp anterior · N notas · F pantalla completa
           T iniciar o pausar temporizador · 0 reiniciarlo · R revelar respuesta del quiz
           L limpiar respuestas (siguiente participante) · S reiniciar reloj de sesión · H ayuda */
(function(){
const S = window.SESSION, slides = S.slides;
const API = new URL("../api.php", location.href).href;
const JOIN = new URL(S.join || "../pulso/", location.href);
const EN = S.lang === "en", tr = (es, en) => EN ? en : es;
const DASH = new URL("../dashboard.html", location.href).href;
const JOIN_TXT = (JOIN.host + JOIN.pathname).replace(/\/$/, "");
const NOTES = new URLSearchParams(location.search).has("notas");
const MOVIL = new URLSearchParams(location.search).has("movil");
const TODO = new URLSearchParams(location.search).has("todo");
const PROMPT = new URLSearchParams(location.search).has("prompter");
const TELE = new URLSearchParams(location.search).has("tele");
const REMOTE = new URL("../remote.php", location.href).href;
const ch = ("BroadcastChannel" in window) ? new BroadcastChannel("holos-deck-" + S.id) : null;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $ = s => document.querySelector(s);
let KEY = ""; try { KEY = sessionStorage.getItem("emp_key") || ""; } catch(e){}
let cur = 0, live = false, resTimer = null, reveal = {}, t0 = null, clockId = null;
const timers = {};
let LOGO = "", FOOT = "";

/* ---------- logo ---------- */
function svgFrom(t, cls){ const d = new DOMParser().parseFromString(t, "image/svg+xml").documentElement; d.setAttribute("class", cls); d.querySelector("path").setAttribute("fill","currentColor"); return d.outerHTML; }
const logos = Promise.all([
  fetch("../logo/holos-logo.svg").then(r => r.text()).then(t => LOGO = svgFrom(t, "logo")).catch(() => {}),
  fetch("../logo/holos-logo.svg").then(r => r.text()).then(t => FOOT = svgFrom(t, "mark")).catch(() => {})
]);

/* ---------- títulos para notas ---------- */
function titleOf(s){ return s.poll ? s.poll.q : (s.title || s.label || s.eyebrow || "").replace(/<[^>]+>/g, ""); }

/* ---------- render de diapositivas ---------- */
function html(s, i){
  const ey = s.eyebrow ? `<div class="eyebrow">${s.eyebrow}</div>` : "";
  switch (s.type){
    case "cover": return `<div class="mid">${LOGO}${ey}<h1>${s.title}</h1>${s.lead ? `<p class="lead">${s.lead}</p>` : ""}
      ${s.meta ? `<div class="meta">${s.meta.map(m => `<span>${m[0]} <b>${m[1]}</b></span>`).join("")}</div>` : ""}</div>`;
    case "statement": return `<div class="mid">${ey}<h2 style="font-size:${s.size||64}px">${s.title}</h2>${s.lead ? `<p class="lead">${s.lead}</p>` : ""}</div>` + (s.src ? `<div class="src">${s.src}</div>` : "");
    case "stat": return `<div class="mid">${ey}<div class="num">${s.num}</div><div class="lbl">${s.label}</div></div>${s.src ? `<div class="src">${tr("Fuente","Source")}: ${s.src}</div>` : ""}`;
    case "html": return s.html;
    case "cards": return `${ey}<h2>${s.title}</h2>${s.lead ? `<p class="lead">${s.lead}</p>` : ""}
      <div class="cards c${s.cols || s.cards.length}${s.tight ? " tight" : ""}${s.big ? " big" : ""}">${s.cards.map(c => `<div class="card ${c.cls||""}">${c.cls && "gyr".includes(c.cls) ? `<div class="dot"></div>` : ""}${c.k ? `<div class="k">${c.k}</div>` : ""}${c.h ? `<h3>${c.h}</h3>` : ""}${c.p ? `<p>${c.p}</p>` : ""}</div>`).join("")}</div>`;
    case "list": return `${ey}<h2>${s.title}</h2><div class="list">${s.items.map(it => `<div class="it"><i class="nb">${it[0]}</i><span>${it[1]}${it[2] ? `<small>${it[2]}</small>` : ""}</span></div>`).join("")}</div>`;
    case "activity": return `${ey}<h2>${s.title}</h2><div class="act"><div class="list" style="margin-top:6px">${s.steps.map((st,j) => `<div class="it"><i class="nb">${String(j+1).padStart(2,"0")}</i><span>${st}</span></div>`).join("")}
      ${s.where ? `<p class="where">${s.where}</p>` : ""}</div>
      ${timerHTML(s,i)}</div>`;
    case "dash": return `<div class="dash-h">${ey}<div class="dash-row"><h2>${s.title}</h2><a class="dash-open" href="${esc(DASH)}" target="_blank" rel="noopener">Abrir dashboard ↗</a></div></div>
      <div class="dash-frame" data-src="${esc(DASH + "?embed=1&tab=" + (s.tab||"registro") + (s.only ? "&only=" + s.only : ""))}"></div>`;
    case "matrix": return `${ey}<h2>${s.title}</h2><div class="mx">
      <div></div>${s.cols.map(c => `<div class="mx-ch">${c}</div>`).join("")}
      ${s.rows.map((r,ri) => `<div class="mx-rh"><span>${r}</span></div>` + s.cells[ri].map(c => `<div class="mx-c ${c.tone||""}"><div class="mx-l">${c.l}</div><div class="mx-b"><h3>${c.h}</h3><div class="mx-src">${c.src}</div><p>${c.p}</p></div></div>`).join("")).join("")}</div>`;
    case "canvas": {
      const POS = { aliados:"1/1/3/3", actividades:"1/3/2/5", recursos:"2/3/3/5", propuesta:"1/5/3/7", relacion:"1/7/2/9", canales:"2/7/3/9", clientes:"1/9/3/11", costos:"3/1/4/6", ingresos:"3/6/4/11" };
      return `${ey}<h2>${s.title}</h2>${s.lead ? `<p class="lead">${s.lead}</p>` : ""}<div class="cv">${s.cells.map(c => `<div class="cv-c ${c.tone||""}" style="grid-area:${POS[c.id]}">${c.n ? `<span class="cv-n">${c.n}</span>` : ""}<h3>${c.h}</h3>${c.p ? `<p>${c.p}</p>` : ""}</div>`).join("")}</div>`;
    }
    case "story": return `<div class="mid">${ey}<h2>${s.title}</h2>${s.lead ? `<p class="lead">${s.lead}</p>` : ""}<div class="beats">${(s.beats||[]).map(b => `<span class="${b.startsWith("*") ? "s" : ""}">${b.replace(/^\*/,"")}</span>`).join("")}</div></div>`;
    case "ranking": return `${ey}<h2>${s.title || tr("Tabla de posiciones","Leaderboard")}</h2>${s.lead ? `<p class="lead">${s.lead}</p>` : ""}<div class="rk-wrap" id="rk${i}"><p class="empty">${tr("Calculando...","Calculating...")}</p></div>${s.prize ? `<div class="rk-prize">${s.prize}</div>` : ""}`;
    case "circle": {
      const f = s.focus || "";
      const B = { what:1, how:2, why:3 };
      const ring = (r, id, lbl, y) => `<g data-b="${B[id]}"><circle cx="210" cy="210" r="${r}" class="ring ${id}${f && f !== id ? " dim" : ""}"/><text x="210" y="${y}" class="rl ${id}${f && f !== id ? " dim" : ""}">${lbl}</text></g>`;
      return `${ey}<h2>${s.title}</h2><div class="gc"><svg viewBox="0 0 420 420" class="gcs">${ring(200,"what","QUÉ",52)}${ring(132,"how","CÓMO",120)}${ring(66,"why","POR QUÉ",218)}</svg>
        <div class="gct">${(s.rows||[]).map(r => `<div class="gr ${r.id}${f && f !== r.id ? " dim" : ""}" data-b="${B[r.id]}"><div class="gk">${r.k}</div><p>${r.p}</p></div>`).join("")}</div></div>`;
    }
    case "brand": return `<div class="br"><div class="bn"><div class="eyebrow">${s.eyebrow || "Por dentro"}</div><div class="bname">${s.name}</div>${s.lead ? `<p class="lead">${s.lead}</p>` : ""}</div>
      <div class="bl">${[["what","Qué",s.what,1],["how","Cómo",s.how,2],["why","Por qué",s.why,3]].map(r => `<div class="gr ${r[0]}" data-b="${r[3]}"><div class="gk">${r[1]}</div><p>${r[2]}</p></div>`).join("")}${s.note ? `<p class="bnote" data-b="3">${s.note}</p>` : ""}</div></div>`;
    case "rules": return `${ey}<h2>${s.title}</h2><div class="rules">${s.items.map(r => `<div class="rule"><div class="rn">${r[0]}</div><div><h3>${r[1]}</h3><p>${r[2]}</p></div></div>`).join("")}</div>`;
    case "versus": return `${ey}<h2>${s.title}</h2><div class="vs c${s.cols.length}${s.small ? " sm" : ""}">${s.cols.map(c => `<div class="vc ${c.tone||""}"><div class="vk">${c.k}</div><blockquote>${c.q}</blockquote>${c.p ? `<p>${c.p}</p>` : ""}</div>`).join("")}</div>`;
    case "beforeafter": {
      const wc = t => t.replace(/<[^>]+>/g,"").trim().split(/\s+/).length;
      return `${ey}<h2>${s.title}</h2><div class="ba">${s.rows.map(r => `<div class="bar-r"><div class="bb">${r.biz}</div>
        <div class="bx old"><span class="wc bad">${wc(r.antes)} palabras</span><p>${r.antes}</p></div><div class="arrow">→</div>
        <div class="bx new"><span class="wc ${wc(r.despues) <= 12 ? "good" : "bad"}">${wc(r.despues)} palabras</span><p>${r.despues}</p></div></div>`).join("")}</div>`;
    }
    case "poll": {
      const p = s.poll;
      return `<div class="poll"><div style="min-width:0;display:flex;flex-direction:column">${ey || `<div class="eyebrow">${p.type === "quiz" ? "Quiz" : "Pulso"}</div>`}<h2>${esc(p.q)}</h2><div class="res" id="res${i}"><p class="empty">${live ? tr("Esperando respuestas...","Waiting for answers...") : tr("Encuestas apagadas (modo ensayo).","Polls off (rehearsal mode).")}</p></div></div>
        <div class="join"><div class="brand">Pulso</div><div class="qr" id="qr${i}"></div><div class="url">${esc(JOIN_TXT)}</div><div class="n"><b id="n${i}">0</b> ${tr("respuestas","answers")}</div>${s.minutes ? timerHTML(s,i,true) : ""}${s.clear ? `<div class="h small">Tecla L: siguiente participante</div>` : ""}</div></div>`;
    }
  }
  return "";
}
function timerHTML(s, i, sm){ return `<div class="timer${sm ? " sm" : ""}" data-i="${i}"><div class="t">${fmt(s.minutes*60)}</div><div class="tbar"><i></i></div><div class="h">${s.minutes} min · tecla T</div></div>`; }
const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s/60) + ":" + String(s%60).padStart(2,"0"); };

function build(){
  const st = $("#stage");
  st.innerHTML = slides.map((s,i) => `<section class="slide t-${s.type}${s.center ? " center" : ""}" id="s${i}">${html(s,i)}</section>`).join("") +
    `<div class="chrome">${FOOT}<span>${esc(S.title)}</span><span class="sp"></span><span id="livei"></span><span class="clock" id="clock" title="Tiempo de sesión (S reinicia)">0:00</span><span id="pg"></span><div class="bar"><i id="pbar"></i></div></div>`;
  slides.forEach((s,i) => { if (s.type === "poll" && window.QRCode){ new QRCode(document.getElementById("qr"+i), { text: JOIN.href, width:160, height:160, colorDark:"#071b4a", colorLight:"#ffffff" }); } });
}

function fit(){ const st = $("#stage"), k = Math.min(innerWidth/1280, innerHeight/720); st.style.transform = `translate(-50%,-50%) scale(${k})`; }

/* ---------- en vivo ---------- */
async function api(params, method){
  const opt = { headers:{ "X-Key": KEY }, cache:"no-store" };
  let url = API;
  if (method === "POST"){ const fd = new FormData(); Object.entries(params).forEach(([k,v]) => fd.append(k,v)); opt.method = "POST"; opt.body = fd; }
  else url += "?" + new URLSearchParams(params) + "&_=" + Date.now();
  const j = await (await fetch(url, opt)).json(); if (!j.ok) throw new Error(j.error || "Error"); return j;
}
const OPEN = (() => { try { return JSON.parse(sessionStorage.getItem("open_" + S.id) || "{}"); } catch(e){ return {}; } })();
function setLive(poll){ if (!live) return; api({ action:"live_set", poll: JSON.stringify(poll ? Object.assign({}, poll, { correct: undefined }) : null) }, "POST")
  .then(j => { if (poll && j && j.v && !OPEN[poll.id]){ OPEN[poll.id] = j.v; try { sessionStorage.setItem("open_" + S.id, JSON.stringify(OPEN)); } catch(e){} } }).catch(e => console.warn(e)); }

/* ---------- ranking de quizzes: aciertos y velocidad ---------- */
const QUIZZES = () => slides.filter(x => x.poll && x.poll.type === "quiz" && x.poll.correct).map(x => x.poll);
async function ranking(i){
  const s = slides[i], box = document.getElementById("rk"+i); if (!live || !box) return;
  const qs = (s.polls ? QUIZZES().filter(q => s.polls.includes(q.id)) : QUIZZES());
  const P = {};
  for (const q of qs){
    let vs = []; try { vs = (await api({ action:"live_results", poll:q.id })).votes; } catch(e){ continue; }
    if (!vs.length) continue;
    const open = OPEN[q.id] || Math.min(...vs.map(v => v.t));
    vs.forEach(v => {
      const k = (v.n || "Sin nombre").trim(), me = P[k] || (P[k] = { n:k, pts:0, ok:0, secs:0 });
      if (v.a === q.correct){ const sec = Math.max(0, v.t - open); me.ok++; me.secs += sec; me.pts += Math.round(1000 - Math.min(500, sec * 10)); }
    });
  }
  const top = Object.values(P).sort((a,b) => b.pts - a.pts || a.secs - b.secs).slice(0, s.top || 10);
  document.getElementById("n"+i) && (document.getElementById("n"+i).textContent = Object.keys(P).length);
  if (!top.length){ box.innerHTML = `<p class="empty">${tr("Aún no hay respuestas de quiz.","No quiz answers yet.")}</p>`; return; }
  box.innerHTML = `<div class="rk">${top.map((r,k) => `<div class="rk-r${k < 3 ? " top t" + (k+1) : ""}"><span class="rk-p">${k+1}</span><span class="rk-n">${esc(r.n)}</span><span class="rk-ok">${r.ok}/${qs.length} ${tr("correctas","correct")}</span><span class="rk-s">${r.pts.toLocaleString("es-MX")} pts</span></div>`).join("")}</div>`;
}

/* ---------- control remoto (notas en el celular) ---------- */
async function remote(params, method){
  const opt = { headers:{ "X-Key": KEY }, cache:"no-store" };
  let url = REMOTE;
  params = Object.assign({ deck: S.id }, params);
  if (method === "POST"){ const fd = new FormData(); Object.entries(params).forEach(([k,v]) => fd.append(k,v)); opt.method = "POST"; opt.body = fd; }
  else url += "?" + new URLSearchParams(params) + "&_=" + Date.now();
  const j = await (await fetch(url, opt)).json(); if (!j.ok) throw new Error(j.error || "Error"); return j;
}
let posTimer = null;
function pushPos(){ if (!live) return; clearTimeout(posTimer); posTimer = setTimeout(() => remote({ a:"pos", i:cur, n:slides.length, t0: t0 || 0 }, "POST").catch(() => {}), 150); }
async function listenRemote(){
  if (!live) return;
  let last = null, since = 0;
  try { const j = await remote({ a:"get" }); last = j.cmd && j.cmd.id; since = j.now; } catch(e){ return; }
  setInterval(async () => {
    try {
      const j = await remote({ a:"get" }), c = j.cmd;
      if (!c || c.id === last) return;
      last = c.id; if (c.t < since) return;
      if (c.c === "next") next(); else if (c.c === "prev") prev(); else if (c.c === "go") go(c.i);
    } catch(e){}
  }, 1000);
}

function countBy(vs){ const m = new Map(); vs.forEach(v => m.set(v.a, (m.get(v.a)||0) + 1)); return m; }
async function results(i){
  const s = slides[i], p = s.poll, box = document.getElementById("res"+i);
  if (!live || !box) return;
  try {
    const vs = (await api({ action:"live_results", poll:p.id })).votes;
    document.getElementById("n"+i).textContent = vs.length;
    if (!vs.length){ box.innerHTML = `<p class="empty">${tr("Esperando respuestas...","Waiting for answers...")}</p>`; return; }
    const kind = p.type === "text" && (p.options||[])[0];
    if (s.quad && (p.type === "choice" || p.type === "quiz")){
      const n = p.options.map(o => vs.filter(v => v.a === o).length), tot = vs.length || 1, mx = Math.max(...n);
      const rv = p.type !== "quiz" || reveal[p.id];
      box.innerHTML = `<div class="qd"><div></div><div class="qd-h">${s.quad.x[0]}</div><div class="qd-h">${s.quad.x[1]}</div>
        ${[0,1].map(r => `<div class="qd-v"><span>${s.quad.y[r]}</span></div>` + [0,1].map(c => { const k = r*2 + c, pc = Math.round(n[k]/tot*100);
          return `<div class="qd-c${n[k] === mx && n[k] ? " hi" : ""}${p.type === "quiz" && rv && p.options[k] === p.correct ? " ok" : ""}" style="--p:${pc}%"><b>${pc}%</b><span>${esc(p.options[k])}</span><em>${n[k]}</em></div>`; }).join("")).join("")}</div>
        ${p.type === "quiz" && rv && p.why ? `<p class="why">${p.why}</p>` : ""}`;
      return;
    }
    if (kind === "@rate"){
      const rs = vs.map(v => { try { return Object.assign(JSON.parse(v.a), { by: v.n }); } catch(e){ return null; } }).filter(Boolean);
      const avg = rs.reduce((a,r) => a + (+r.s||0), 0) / (rs.length || 1);
      const cnt = [1,2,3,4,5].map(n => rs.filter(r => +r.s === n).length), mx = Math.max(...cnt, 1);
      const show = rs.slice().reverse().slice(0, 12), pages = 1, pg = 0;
      box.innerHTML = `<div class="rt-top"><div class="rt-avg">${avg.toFixed(1)}<small>de 5</small></div>
        <div class="rt-h">${cnt.map((c,k) => `<div><b>${k+1}</b><span><i style="width:${c/mx*100}%"></i></span><em>${c}</em></div>`).join("")}</div></div>
        <div class="rt-cards${show.length > 6 ? " many" : ""}">${show.map(r => `<div class="rt-c"><div class="rt-n">Para ${esc(r.p)} <b>${esc(r.s)}</b></div><q>${esc(r.f)}</q>${r.m ? `<p>${esc(r.m)}</p>` : ""}</div>`).join("")}</div>
        ${pages > 1 ? `<div class="rt-pg">${pg+1} / ${pages}</div>` : ""}`;
      return;
    }
    if (kind === "@survey"){
      box.innerHTML = `<div class="big-avg"><div class="a">${vs.length}</div><div class="c">opiniones recibidas<br><b>Privadas:</b> solo las ve Alan.</div></div>`;
      return;
    }
    if (kind === "@wordle"){
      const rs = vs.map(v => { try { return Object.assign(JSON.parse(v.a), { n: v.n }); } catch(e){ return null; } }).filter(Boolean)
        .sort((a,b) => b.r - a.r || a.i - b.i || a.s - b.s);
      const total = (p.options.length - 1) / 2, all = rs.filter(r => r.r === total).length;
      const t = x => Math.floor(x/60) + ":" + String(x%60).padStart(2,"0");
      box.innerHTML = `<p class="wd-sum"><b>${all}</b> de ${rs.length} sacaron las ${total} palabras.</p><div class="pod">${rs.slice(0,8).map((r,k) => `<div class="pr${k < 3 ? " top" : ""}"><span class="ps">${k+1}</span><span class="pn">${esc(r.n || "Anónimo")}</span><span class="pw">${r.r}/${total}</span><span class="pi">${r.i} intentos</span><span class="pt">${t(r.s)}</span></div>`).join("")}</div>`;
      return;
    }
    if (p.type === "choice" || p.type === "quiz"){
      const m = countBy(vs), tot = vs.length, rv = reveal[p.id];
      box.innerHTML = p.options.map(o => { const n = m.get(o)||0, cls = rv ? (o === p.correct ? " ok" : " dim") : "";
        return `<div class="rb${cls}"><div class="l">${esc(o)}</div><div class="tr"><i style="width:${Math.round(n/tot*100)}%"></i></div><div class="v">${n} · ${Math.round(n/tot*100)}%</div></div>`; }).join("") +
        (s.names ? `<div class="namelist">${vs.filter(v => v.a === s.names).sort((x,y) => x.t - y.t).map((v,k) => `<span><b>${k+1}</b>${esc(v.n || "Sin nombre")}</span>`).join("")}</div>` : "") +
        (p.type === "quiz" ? (rv ? `<p class="verdict"><b>${Math.round((m.get(p.correct)||0)/tot*100)}%</b> acertó. ${p.why ? esc(p.why) : ""}</p>` : `<p class="small">Tecla R para revelar la respuesta.</p>`) : "");
    } else if (p.type === "scale"){
      const nums = vs.map(v => +v.a), avg = nums.reduce((a,b) => a+b, 0)/nums.length;
      let cmp = "";
      if (s.compare){ try { const c = (await api({ action:"live_results", poll:s.compare })).votes.map(v => +v.a); if (c.length){ const ca = c.reduce((a,b)=>a+b,0)/c.length; cmp = `Al inicio: <b>${ca.toFixed(1)}</b><br>Ahora: <b>${avg.toFixed(1)}</b>`; } } catch(e){} }
      let hist = ""; const mx = Math.max(...Array.from({length:p.max-p.min+1}, (_,k) => nums.filter(n => n === p.min+k).length), 1);
      for (let n = p.min; n <= p.max; n++){ const c = nums.filter(x => x === n).length; hist += `<div><i style="height:${c/mx*100}%"></i>${n}</div>`; }
      box.innerHTML = `<div class="big-avg"><div class="a">${avg.toFixed(1)}</div><div class="c">${cmp || `promedio de ${nums.length}<br>${esc(p.minLbl)} ${p.min} · ${esc(p.maxLbl)} ${p.max}`}</div></div><div class="hist">${hist}</div>`;
    } else if (p.type === "words"){
      const m = new Map(); vs.forEach(v => { const w = v.a.trim().toLowerCase().replace(/[.!¡?¿,]/g,""); if (w) m.set(w, (m.get(w)||0)+1); });
      const arr = [...m.entries()].sort((a,b) => b[1]-a[1]).slice(0, 40), mx = arr[0][1];
      box.innerHTML = `<div class="cloud">${arr.map(([w,n]) => `<span style="font-size:${Math.round(22 + (n/mx)*50)}px">${esc(w)}</span>`).join("")}</div>`;
    } else {
      box.innerHTML = `<div class="wall">${vs.slice(-10).reverse().map(v => `<div>${esc(v.a)}</div>`).join("")}</div>`;
    }
  } catch(e){ box.innerHTML = `<p class="empty">No pude leer resultados: ${esc(e.message)}</p>`; }
}

/* ---------- navegación con apariciones (data-b) ---------- */
let step = 0;
const stepsOf = i => { const el = document.getElementById("s"+i); let m = 0; if (el) el.querySelectorAll("[data-b]").forEach(x => m = Math.max(m, +x.dataset.b)); return m; };
function paintSteps(){ const el = document.getElementById("s"+cur); if (el) el.querySelectorAll("[data-b]").forEach(x => x.classList.toggle("shown", +x.dataset.b <= step)); }
function next(){ if (step < stepsOf(cur)){ step++; paintSteps(); } else go(cur+1); }
function prev(){ if (step > 1){ step--; paintSteps(); } else go(cur-1, false, true); }
function go(i, silent, back){
  i = Math.max(0, Math.min(slides.length - 1, i));
  const prev = slides[cur], next = slides[i];
  document.querySelectorAll(".slide.on").forEach(x => x.classList.remove("on"));
  $("#s"+i).classList.add("on");
  cur = i;
  step = back ? stepsOf(i) : (stepsOf(i) ? 1 : 0); paintSteps();
  $("#pg").textContent = `${i+1} / ${slides.length}`;
  $("#pbar").style.width = Math.round((i+1)/slides.length*100) + "%";
  clearInterval(resTimer);
  if (i > 0 && t0 === null) startClock();
  if (next.type === "dash"){ const f = document.querySelector(`#s${i} .dash-frame`); if (f && !f.querySelector("iframe")) f.innerHTML = `<iframe src="${f.dataset.src}" title="Dashboard"></iframe>`; else if (f) f.querySelector("iframe").contentWindow.postMessage("refresh", "*"); }
  if (next.push){ setLive(next.push); $("#livei").innerHTML = live ? `<span class="live-dot">En Pulso</span>` : ""; }
  else if (next.type === "poll"){ setLive(next.poll); $("#livei").innerHTML = live ? `<span class="live-dot">${tr("En vivo","Live")}</span>` : ""; results(i); resTimer = setInterval(() => results(cur), 2000); }
  else { if (prev && (prev.type === "poll" || prev.push) && prev !== next) setLive(null); $("#livei").innerHTML = ""; }
  if (next.type === "ranking"){ ranking(i); resTimer = setInterval(() => ranking(cur), 3000); }
  try { history.replaceState(null, "", "#" + (i+1)); } catch(e){}
  if (!silent && ch) ch.postMessage({ i });
  pushPos();
}

/* ---------- reloj de la sesión y ritmo contra el plan ---------- */
function planEnd(s){ const m = String(s.time||"").match(/(\d+)\s*$/); return m ? +m[1] : null; }
function startClock(){ t0 = Date.now(); try { sessionStorage.setItem("clk_" + S.id, t0); } catch(e){} pushPos(); tickClock(); clearInterval(clockId); clockId = setInterval(tickClock, 1000); }
function tickClock(){
  const el = document.getElementById("clock"); if (!el || t0 === null) return;
  const sec = (Date.now() - t0)/1000, plan = planEnd(slides[cur]);
  let pace = ""; if (plan !== null){ const d = Math.round(sec/60 - plan); if (d >= 2) pace = ` · +${d} min`; }
  el.textContent = fmt(sec) + " / " + (S.minutes || 60) + ":00" + pace;
  el.classList.toggle("late", pace !== "");
  if (ch) ch.postMessage({ clock: el.textContent, late: pace !== "" });
}

/* ---------- temporizador ---------- */
function timer(i, cmd){
  const s = slides[i]; if (!s.minutes) return;
  const el = document.querySelector(`.timer[data-i="${i}"]`), total = s.minutes*60;
  const T = timers[i] = timers[i] || { left: total, run:false, id:null };
  const paint = () => { el.querySelector(".t").textContent = fmt(T.left); el.querySelector(".t").classList.toggle("end", T.left <= 0); el.querySelector(".tbar i").style.width = (T.left/total*100) + "%"; };
  if (cmd === "reset"){ clearInterval(T.id); T.run = false; T.left = total; paint(); return; }
  if (T.run){ clearInterval(T.id); T.run = false; return; }
  T.run = true; T.id = setInterval(() => { T.left--; paint(); if (T.left <= 0){ clearInterval(T.id); T.run = false; } }, 1000);
}

/* ---------- ventana de notas ---------- */
function notesView(rm){
  document.body.classList.add("notes"); if (rm) document.body.classList.add("movil");
  let send = () => {};
  const root = document.createElement("div"); root.className = "nw"; document.body.appendChild(root);
  const draw = i => {
    const s = slides[i], n = slides[i+1];
    root.innerHTML = `<div class="top"><b>${esc(S.title)} · ${i+1} / ${slides.length}</b><span class="clock" id="clk"></span>
      <div class="btns"><button id="pv">← Anterior</button><button id="nx">Siguiente →</button></div></div>
      <div class="ttl">${esc(titleOf(s))}</div>${s.time ? `<div class="tm">${esc(s.time)}</div>` : ""}
      <div class="body">${s.notes || "<p>Sin notas.</p>"}</div>
      ${n ? `<div class="next">Sigue: ${esc(titleOf(n))}</div>` : ""}`;
    root.querySelector("#pv").onclick = () => rm ? send("prev") : ch && ch.postMessage({ cmd:"prev" });
    root.querySelector("#nx").onclick = () => rm ? send("next") : ch && ch.postMessage({ cmd:"next" });
    root.scrollTop = 0;
  };
  if (rm){
    let shown = -1, rt0 = 0, ok = true;
    send = c => { remote({ a:"cmd", c }, "POST").then(() => setTimeout(poll, 250)).catch(() => {}); };
    const paintClock = () => {
      const c = document.getElementById("clk"); if (!c) return;
      if (!ok){ c.textContent = "Sin conexión"; c.style.color = "#ef8a8a"; return; }
      if (!rt0){ c.textContent = ""; return; }
      const sec = (Date.now() - rt0)/1000, plan = planEnd(slides[Math.max(shown,0)]);
      let pace = ""; if (plan !== null){ const d = Math.round(sec/60 - plan); if (d >= 2) pace = ` · +${d} min`; }
      c.textContent = fmt(sec) + " / " + (S.minutes || 60) + ":00" + pace; c.style.color = pace ? "#ef8a8a" : "";
    };
    const poll = async () => {
      try { const j = await remote({ a:"get" }); ok = true; const p = j.pos;
        if (p){ rt0 = p.t0 || 0; if (p.i !== shown && p.i < slides.length){ shown = p.i; draw(shown); } } }
      catch(e){ ok = false; }
      paintClock();
    };
    draw(0); shown = 0; poll(); setInterval(poll, 1000); setInterval(paintClock, 1000);
    return;
  }
  if (ch) ch.onmessage = e => { if (typeof e.data.i === "number") draw(e.data.i); if (e.data.clock){ const c = document.getElementById("clk"); if (c){ c.textContent = e.data.clock; c.style.color = e.data.late ? "#ef8a8a" : ""; } } };
  if (ch) ch.postMessage({ cmd:"hello" });
  draw(0);

  document.addEventListener("keydown", e => { if (["ArrowRight","PageDown"," "].includes(e.key)){ e.preventDefault(); ch && ch.postMessage({ cmd:"next" }); } if (["ArrowLeft","PageUp"].includes(e.key)){ e.preventDefault(); ch && ch.postMessage({ cmd:"prev" }); } });
}

/* ---------- teleprompter (tecla P) ---------- */
async function openPrompter(){
  const url = location.pathname + "?prompter";
  if (window.documentPictureInPicture){
    try {
      const w = await documentPictureInPicture.requestWindow({ width: 680, height: 300 });
      w.document.body.style.cssText = "margin:0;background:#000;overflow:hidden";
      const f = w.document.createElement("iframe"); f.src = url; f.style.cssText = "border:0;width:100vw;height:100vh;display:block";
      w.document.body.append(f); return;
    } catch(e){}
  }
  window.open(url, "prompter-" + S.id, "width=680,height=300,top=0,left=" + Math.max(0, Math.round((screen.width - 680)/2)));
}
function prompterView(rm){
  document.body.classList.add("notes", "prompt");
  const root = document.createElement("div"); root.className = "tp";
  root.innerHTML = `<div class="tp-bar"><span id="pi"></span><span class="tp-h">Espacio: avanza o pausa · ↑ ↓ velocidad · → ← diapositiva</span></div><div class="tp-txt" id="pt"></div><div class="tp-mark"></div>
    <div class="tp-ctl"><button data-a="prev">◀ Diap.</button><button data-a="slow">−</button><button data-a="play" id="pp">▶ Iniciar</button><button data-a="fast">+</button><button data-a="next">Diap. ▶</button></div>`;
  document.body.appendChild(root);
  const pt = root.querySelector("#pt"), pi = root.querySelector("#pi");
  let speed = 45, play = false, cur = 0, last = 0, acc = 0;
  const pp = root.querySelector("#pp");
  const bar = () => { pi.textContent = `${cur+1} / ${slides.length} · ${play ? "▶" : "❚❚"} ${speed}`; pp.textContent = play ? "❚❚ Pausa" : "▶ Iniciar"; };
  const cmd = c => { if (rm) remote({ a:"cmd", c }, "POST").catch(() => {}); else if (ch) ch.postMessage({ cmd:c }); };
  const draw = i => { cur = i; const s = slides[i]; pt.innerHTML = `<div class="tp-t">${esc(titleOf(s))}</div>` + (s.notes || ""); pt.scrollTop = 0; acc = 0; bar(); };
  const loop = t => { if (play && last){ acc += speed * (t - last) / 1000; const st = Math.floor(acc); if (st){ pt.scrollTop += st; acc -= st; } } last = t; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  document.addEventListener("keydown", e => {
    if (e.key === " "){ e.preventDefault(); play = !play; bar(); }
    else if (e.key === "ArrowUp"){ e.preventDefault(); speed = Math.min(200, speed + 5); bar(); }
    else if (e.key === "ArrowDown"){ e.preventDefault(); speed = Math.max(5, speed - 5); bar(); }
    else if (e.key === "ArrowRight" || e.key === "PageDown"){ e.preventDefault(); cmd("next"); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp"){ e.preventDefault(); cmd("prev"); }
  });
  pt.addEventListener("click", () => { play = !play; bar(); });
  root.querySelector(".tp-ctl").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; const k = b.dataset.a;
    if (k === "play"){ play = !play; bar(); } else if (k === "slow"){ speed = Math.max(5, speed - 5); bar(); } else if (k === "fast"){ speed = Math.min(200, speed + 5); bar(); } else cmd(k); });
  draw(0);
  if (rm){
    const poll = async () => { try { const j = await remote({ a:"get" }); root.classList.remove("off"); if (j.pos && j.pos.i !== cur && j.pos.i < slides.length) draw(j.pos.i); } catch(e){ root.classList.add("off"); } };
    poll(); setInterval(poll, 1000);
  } else if (ch){ ch.onmessage = e => { if (typeof e.data.i === "number" && e.data.i !== cur) draw(e.data.i); }; ch.postMessage({ cmd:"hello" }); }
}

/* ---------- clave ---------- */
function gate(movil){
  return new Promise(res => {
    const g = document.createElement("div"); g.id = "gate";
    g.innerHTML = `<form><h3>${esc(S.title)}</h3><p>${movil ? "Notas en tu celular. Escribe tu clave; la presentación en la laptop debe estar en vivo con la misma clave." : "Escribe tu clave para activar Pulso (las preguntas en vivo) y el dashboard dentro de la presentación."}</p>
      <input type="password" id="gk" placeholder="Clave" autocomplete="current-password" value="${esc(KEY)}"><div class="e" id="ge"></div>
      <button type="submit">${movil ? "Ver notas" : "Presentar en vivo"}</button>${movil ? "" : `<button type="button" class="gh" id="gs">Ensayar sin encuestas</button>`}</form>`;
    document.body.appendChild(g);
    g.querySelector("form").onsubmit = async e => {
      e.preventDefault(); KEY = g.querySelector("#gk").value.trim();
      try { await api({ action:"live_results", poll:"ping" }); live = true; try { sessionStorage.setItem("emp_key", KEY); } catch(_){} g.remove(); res(); }
      catch(err){ g.querySelector("#ge").textContent = err.message === "Clave incorrecta" ? "Clave incorrecta." : "No me pude conectar: " + err.message; }
    };
    if (!movil) g.querySelector("#gs").onclick = () => { live = false; g.remove(); res(); };
    g.querySelector("#gk").focus();
  });
}

/* ---------- arranque ---------- */
async function start(){
  if (TELE){ document.body.classList.add("movil"); await gate(true); prompterView(true); return; }
  if (PROMPT){ prompterView(); return; }
  if (TODO){ document.body.classList.add("notes","movil"); const r = document.createElement("div"); r.className = "nw todo";
    r.innerHTML = `<div class="top"><b>${esc(S.title)} · notas completas</b></div>` + slides.map((s,i) => `<section><div class="ttl">${i+1}. ${esc(titleOf(s))}</div>${s.time ? `<div class="tm">${esc(s.time)}</div>` : ""}<div class="body">${s.notes || ""}</div></section>`).join("");
    document.body.appendChild(r); return; }
  if (MOVIL){ document.body.classList.add("movil"); await gate(true); notesView(true); return; }
  if (NOTES){ notesView(); return; }
  await logos;
  await gate();
  build(); fit(); addEventListener("resize", fit);
  try { const saved = +sessionStorage.getItem("clk_" + S.id); if (saved && Date.now() - saved < 3*3600e3){ t0 = saved; clockId = setInterval(tickClock, 1000); } } catch(e){}
  const h = parseInt(location.hash.slice(1), 10);
  go(h > 0 ? h-1 : 0);
  document.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT") return;
    const k = e.key;
    if (["ArrowRight","PageDown"," ","Enter"].includes(k)){ e.preventDefault(); next(); }
    else if (["ArrowLeft","PageUp","Backspace"].includes(k)){ e.preventDefault(); prev(); }
    else if (k === "Home") go(0);
    else if (k === "End") go(slides.length-1);
    else if (k === "p" || k === "P") openPrompter();
    else if (k === "n" || k === "N") window.open(location.pathname + "?notas", "notas-" + S.id, "width=920,height=820");
    else if (k === "f" || k === "F"){ if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen(); }
    else if (k === "t" || k === "T") timer(cur);
    else if (k === "0") timer(cur, "reset");
    else if ((k === "r" || k === "R") && slides[cur].poll && slides[cur].poll.type === "quiz"){ reveal[slides[cur].poll.id] = !reveal[slides[cur].poll.id]; results(cur); }
    else if (k === "h" || k === "H") $("#help").classList.toggle("show");
    else if ((k === "l" || k === "L") && slides[cur].poll && live){ api({ action:"live_clear", poll: slides[cur].poll.id }, "POST").then(() => results(cur)).catch(() => {}); timer(cur, "reset"); }
    else if (k === "s" || k === "S") startClock();
  });
  document.addEventListener("click", e => { if (e.target.closest("a,button,input,#gate")) return; const r = document.getElementById("stage").getBoundingClientRect(); const x = (e.clientX - r.left) / (r.width || innerWidth); if (x < 0.5) prev(); else next(); });
  let tx = null, ty = null;
  document.addEventListener("touchstart", e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive:true });
  document.addEventListener("touchend", e => { if (tx === null) return; const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; tx = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)){ e.preventDefault(); dx < 0 ? next() : prev(); } }, { passive:false });
  if (ch) ch.onmessage = e => { const c = e.data.cmd; if (c === "next") next(); else if (c === "prev") prev(); else if (c === "hello") ch.postMessage({ i: cur }); };
  listenRemote();
  addEventListener("beforeunload", () => { if (slides[cur].type === "poll") setLive(null); });
}
start();
})();
