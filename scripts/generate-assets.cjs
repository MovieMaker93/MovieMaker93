// Generates the animated SVGs for the profile README.
// Usage: node scripts/generate-assets.cjs  -> writes assets/header.svg, assets/terminal.svg, assets/pipeline.svg
// Pure SVG + SMIL/CSS animations (no JS) so they render inside GitHub's <img> sandbox.
const fs = require("fs");
const path = require("path");

const C = {
  bg0: "#0d1117", bg1: "#16161e", bg2: "#1a1b27", panel: "#1f2335",
  fg: "#c0caf5", dim: "#565f89", blue: "#7aa2f7", cyan: "#7dcfff",
  purple: "#bb9af7", green: "#9ece6a", orange: "#ff9e64", red: "#f7768e",
  yellow: "#e0af68", k8s: "#326CE5",
};
const MONO = "'JetBrains Mono','Fira Code',SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace";
const SANS = "'Segoe UI',Ubuntu,'Helvetica Neue',Helvetica,Arial,sans-serif";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f = (n) => +n.toFixed(4);

// deterministic PRNG so regenerating gives the same output
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// ---------- Kubernetes helm wheel ----------
function helm(cx, cy, R) {
  const ang = [...Array(7)].map((_, k) => ((-90 + (k * 360) / 7) * Math.PI) / 180);
  const hept = ang.map((a) => `${f(cx + R * Math.cos(a))},${f(cy + R * Math.sin(a))}`).join(" ");
  const spokes = ang
    .map((a) => `<line x1="${f(cx + R * 0.16 * Math.cos(a))}" y1="${f(cy + R * 0.16 * Math.sin(a))}" x2="${f(cx + R * 0.66 * Math.cos(a))}" y2="${f(cy + R * 0.66 * Math.sin(a))}"/>`)
    .join("");
  return `<polygon points="${hept}" fill="${C.k8s}" stroke="${C.k8s}" stroke-width="${R * 0.18}" stroke-linejoin="round"/>
    <g stroke="#fff" stroke-linecap="round" fill="none">
      <circle cx="${cx}" cy="${cy}" r="${R * 0.44}" stroke-width="${R * 0.1}"/>
      <g stroke-width="${R * 0.09}">${spokes}</g>
    </g>
    <circle cx="${cx}" cy="${cy}" r="${R * 0.14}" fill="#fff"/>`;
}

// ---------- 1. Header ----------
function header() {
  const W = 1000, H = 280;
  const roles = [
    ["DevSecOps Engineer", C.blue],
    ["Kubernetes wrangler", C.cyan],
    ["Homelab tinkerer", C.green],
    ["Local LLM benchmarker", C.purple],
    ["Neovim nerd (btw)", C.orange],
  ];
  const slot = 3, cycle = slot * roles.length;
  const CH = 12; // approx mono char width at 20px

  const particles = [...Array(26)].map(() => {
    const x = f(rnd() * W), y = f(H * 0.4 + rnd() * H * 0.7), r = f(0.8 + rnd() * 1.8);
    const d = f(6 + rnd() * 8), delay = f(-rnd() * d);
    const col = [C.blue, C.cyan, C.purple][Math.floor(rnd() * 3)];
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}">
      <animate attributeName="cy" values="${y};${f(y - 160)}" dur="${d}s" begin="${delay}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;.9;0" dur="${d}s" begin="${delay}s" repeatCount="indefinite"/></circle>`;
  }).join("\n    ");

  // SMIL (not CSS) so the cycling survives GitHub's <img> rendering
  const roleEls = roles.map(([t, col], i) => {
    const a = i * slot, k = (x) => f(x / cycle);
    const kts = `0;${k(a) || 0.0001};${k(a + 0.35)};${k(a + slot - 0.35)};${k(a + slot)};1`;
    return `<g opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="${kts}" dur="${cycle}s" repeatCount="indefinite"/>
      <animateTransform attributeName="transform" type="translate" values="0 12;0 12;0 0;0 0;0 -12;0 -12" keyTimes="${kts}" dur="${cycle}s" repeatCount="indefinite"/>
      <text x="88" y="190" fill="${col}" textLength="${t.length * CH}" lengthAdjust="spacing">${esc(t)}</text>
      <rect class="cur" x="${88 + t.length * CH + 4}" y="174" width="11" height="21" fill="${col}"/></g>`;
  }).join("\n    ");

  const certs = ["CKA", "CKAD", "KCNA", "KCSA"];
  let cx = 60;
  const chips = certs.map((c, i) => {
    const w = c.length * 9.5 + 26;
    const el = `<g>
      <rect x="${cx}" y="216" width="${w}" height="28" rx="14" fill="${C.k8s}" fill-opacity=".15" stroke="${C.k8s}" stroke-opacity=".7"/>
      <text x="${cx + w / 2}" y="235" text-anchor="middle" fill="${C.fg}">${c}</text></g>`;
    cx += w + 10;
    return el;
  }).join("\n    ");

  const ox = 820, oy = 140;
  const pods = [
    [92, 9, C.green, 0], [92, 9, C.cyan, -3], [92, 9, C.purple, -6],
    [120, 14, C.orange, 0], [120, 14, C.blue, -7],
  ].map(([r, d, col, b]) => `<g><animateTransform attributeName="transform" type="rotate" from="0 ${ox} ${oy}" to="360 ${ox} ${oy}" dur="${d}s" begin="${b}s" repeatCount="indefinite"/>
      <rect x="${ox + r - 7}" y="${oy - 7}" width="14" height="14" rx="3" fill="${col}" filter="url(#glow)"/></g>`).join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Alfonso Fortunato — DevSecOps Engineer">
  <title>Alfonso Fortunato — DevSecOps Engineer</title>
  <style>
    .cur{animation:blink 1s steps(1) infinite}
    @keyframes blink{50%{opacity:0}}
  </style>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.bg0}"/><stop offset=".6" stop-color="${C.bg1}"/><stop offset="1" stop-color="${C.bg2}"/></linearGradient>
    <radialGradient id="g1"><stop offset="0" stop-color="${C.blue}" stop-opacity=".35"/><stop offset="1" stop-color="${C.blue}" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2"><stop offset="0" stop-color="${C.purple}" stop-opacity=".3"/><stop offset="1" stop-color="${C.purple}" stop-opacity="0"/></radialGradient>
    <linearGradient id="name" x1="0" y1="0" x2="1" y2="0" spreadMethod="reflect">
      <stop offset="0" stop-color="${C.blue}"/><stop offset=".5" stop-color="${C.purple}"/><stop offset="1" stop-color="${C.cyan}"/>
      <animateTransform attributeName="gradientTransform" type="translate" values="0;1;0" dur="8s" repeatCount="indefinite"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="${C.blue}" stroke-opacity=".07"/>
      <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="40 40" dur="5s" repeatCount="indefinite"/>
    </pattern>
    <linearGradient id="gridfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff"/></linearGradient>
    <mask id="gm"><rect width="${W}" height="${H}" fill="url(#gridfade)"/></mask>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <clipPath id="card"><rect width="${W}" height="${H}" rx="18"/></clipPath>
  </defs>
  <g clip-path="url(#card)">
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect width="${W}" height="${H}" fill="url(#grid)" mask="url(#gm)"/>
    <ellipse cx="200" cy="60" rx="320" ry="200" fill="url(#g1)"><animate attributeName="cx" values="160;300;160" dur="14s" repeatCount="indefinite"/></ellipse>
    <ellipse cx="820" cy="150" rx="260" ry="220" fill="url(#g2)"><animate attributeName="opacity" values=".6;1;.6" dur="5s" repeatCount="indefinite"/></ellipse>
    ${particles}
  </g>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="17" fill="none" stroke="${C.blue}" stroke-opacity=".18"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="17" fill="none" stroke="url(#name)" stroke-width="2.5" pathLength="1000" stroke-dasharray="140 860" stroke-linecap="round" filter="url(#glow)">
    <animate attributeName="stroke-dashoffset" from="1000" to="0" dur="7s" repeatCount="indefinite"/>
  </rect>

  <g font-family="${MONO}">
    <text x="60" y="76" font-size="15" fill="${C.dim}"><tspan fill="${C.green}">alfonso@lugano</tspan>:<tspan fill="${C.blue}">~</tspan>$ whoami</text>
  </g>
  <text x="56" y="138" font-family="${SANS}" font-size="54" font-weight="800" fill="url(#name)" letter-spacing="-1">Alfonso Fortunato</text>
  <g font-family="${MONO}" font-size="20">
    <text x="60" y="190" fill="${C.dim}">&gt;</text>
    ${roleEls}
  </g>
  <g font-family="${MONO}" font-size="13" font-weight="700">
    ${chips}
  </g>

  <g>
    <circle cx="${ox}" cy="${oy}" r="92" fill="none" stroke="${C.dim}" stroke-opacity=".5" stroke-dasharray="3 7">
      <animateTransform attributeName="transform" type="rotate" from="0 ${ox} ${oy}" to="-360 ${ox} ${oy}" dur="40s" repeatCount="indefinite"/></circle>
    <circle cx="${ox}" cy="${oy}" r="120" fill="none" stroke="${C.dim}" stroke-opacity=".3" stroke-dasharray="1 9"/>
    <circle cx="${ox}" cy="${oy}" r="62" fill="${C.k8s}" opacity=".35" filter="url(#glow)">
      <animate attributeName="r" values="58;70;58" dur="3s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values=".25;.5;.25" dur="3s" repeatCount="indefinite"/></circle>
    <g><animateTransform attributeName="transform" type="rotate" from="0 ${ox} ${oy}" to="360 ${ox} ${oy}" dur="18s" repeatCount="indefinite"/>
      ${helm(ox, oy, 56)}
    </g>
    ${pods}
  </g>
</svg>
`;
}

// ---------- 2. Terminal ----------
function terminal() {
  const W = 1000, LH = 23, FS = 15, CW = 9.03, PAD = 28, TOP = 64, T = 18;
  const k = (s) => [s, C.blue], v = (s) => [s, C.green], p = (s) => [s, C.fg], cm = (s) => [s, C.dim];
  const n = (s) => [s, C.orange], o = (s) => [s, C.purple];
  const lines = [
    [k("apiVersion"), p(": "), v("human.io/v1")],
    [k("kind"), p(": "), o("DevSecOpsEngineer")],
    [k("metadata"), p(":")],
    [p("  "), k("name"), p(": "), v("alfonso-fortunato")],
    [p("  "), k("labels"), p(": { "), k("region"), p(": "), v("lugano-ch"), p(", "), k("timezone"), p(": "), v("europe/zurich"), p(" }")],
    [k("spec"), p(":")],
    [p("  "), k("certifications"), p(": ["), v("CKA"), p(", "), v("CKAD"), p(", "), v("KCNA"), p(", "), v("KCSA"), p("]")],
    [p("  "), k("stack"), p(": ["), v("kubernetes"), p(", "), v("terraform"), p(", "), v("go"), p(", "), v("vault"), p(", "), v("dagger"), p("]")],
    [p("  "), k("homelab"), p(": "), v("k8s cluster"), p("            "), cm("# mistakes are the curriculum")],
    [p("  "), k("ai"), p(": ["), v("claude"), p(", "), v("llama.cpp"), p(", "), v("ollama"), p(", "), v("dgx-spark"), p("]")],
    [p("  "), k("editor"), p(": "), v("neovim"), p("                  "), cm("# btw")],
    [k("status"), p(":")],
    [p("  "), k("phase"), p(": "), [ "Running", C.green ]],
    [p("  "), k("curiosity"), p(": "), n("unlimited")],
    [p("  "), k("coffee"), p(": "), n("☕ ") , n("x4")],
  ];
  const H = TOP + (lines.length + 3) * LH + 18;
  const kt = (t) => f(t / T);
  const END = T - 0.6;

  const prompt = (y) => `<tspan fill="${C.green}">alfonso@lugano</tspan><tspan fill="${C.fg}">:</tspan><tspan fill="${C.blue}">~/homelab</tspan><tspan fill="${C.fg}">$</tspan>`;
  const promptLen = "alfonso@lugano:~/homelab$ ".length;
  const cmd = "kubectl get engineer alfonso -o yaml";
  const x0 = PAD + promptLen * CW, y0 = TOP;
  const tStart = 0.8, dt = 0.07;

  // typing: discrete reveal of the command, char by char
  const kts = [0], ws = [0], xs = [x0];
  for (let i = 1; i <= cmd.length; i++) { kts.push(kt(tStart + i * dt)); ws.push(f(i * CW + 1)); xs.push(f(x0 + i * CW)); }
  kts.push(kt(END)); ws.push(0); xs.push(x0);
  const tEnter = tStart + cmd.length * dt + 0.35;

  const out = lines.map((segs, i) => {
    const t = tEnter + 0.25 + i * 0.09;
    let indent = 0;
    if (segs[0][0].trim() === "") indent = segs.shift()[0].length;
    const spans = segs.map(([s, col]) => col === C.dim && s.startsWith("#")
      ? `<tspan x="${f(PAD + 46 * CW)}" fill="${col}">${esc(s)}</tspan>`
      : s.trim() === "" ? "" : `<tspan fill="${col}">${esc(s)}</tspan>`).join("");
    return `<text x="${f(PAD + indent * CW)}" y="${y0 + (i + 1) * LH}" opacity="0"><animate attributeName="opacity" values="0;1;0" keyTimes="0;${kt(t)};${kt(END)}" calcMode="discrete" dur="${T}s" repeatCount="indefinite"/>${spans}</text>`;
  }).join("\n    ");
  const tDone = tEnter + 0.25 + lines.length * 0.09 + 0.2;
  const yLast = y0 + (lines.length + 1) * LH;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="kubectl get engineer alfonso -o yaml">
  <title>kubectl get engineer alfonso -o yaml</title>
  <style>.blink{animation:b 1s steps(1) infinite}@keyframes b{50%{opacity:0}}</style>
  <defs>
    <clipPath id="typed"><rect x="${x0}" y="${y0 - 18}" height="26" width="0">
      <animate attributeName="width" values="${ws.join(";")}" keyTimes="${kts.join(";")}" calcMode="discrete" dur="${T}s" repeatCount="indefinite"/></rect></clipPath>
    <linearGradient id="bar" x1="0" x2="1"><stop offset="0" stop-color="${C.blue}"/><stop offset=".5" stop-color="${C.purple}"/><stop offset="1" stop-color="${C.cyan}"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="14" fill="${C.bg2}"/>
  <rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="13.5" fill="none" stroke="${C.dim}" stroke-opacity=".45"/>
  <path d="M14 0H${W - 14}a14 14 0 0 1 14 14V36H0V14A14 14 0 0 1 14 0Z" fill="${C.panel}"/>
  <rect y="35" width="${W}" height="2" fill="url(#bar)" opacity=".8"/>
  <circle cx="24" cy="18" r="6.5" fill="${C.red}"/><circle cx="46" cy="18" r="6.5" fill="${C.yellow}"/><circle cx="68" cy="18" r="6.5" fill="${C.green}"/>
  <text x="${W / 2}" y="23" text-anchor="middle" font-family="${MONO}" font-size="13" fill="${C.dim}">alfonso@lugano — zsh — 120×${lines.length + 3}</text>

  <g font-family="${MONO}" font-size="${FS}" xml:space="preserve" style="white-space:pre">
    <text x="${PAD}" y="${y0}" textLength="${f((promptLen - 1) * CW)}" lengthAdjust="spacing">${prompt()}</text>
    <text x="${x0}" y="${y0}" fill="${C.fg}" clip-path="url(#typed)" textLength="${f(cmd.length * CW)}" lengthAdjust="spacing">${esc(cmd)}</text>
    <g><animate attributeName="opacity" values="1;0;1" keyTimes="0;${kt(tEnter)};${kt(END)}" calcMode="discrete" dur="${T}s" repeatCount="indefinite"/>
      <rect class="blink" y="${y0 - 15}" width="9" height="19" fill="${C.fg}" x="${x0}">
        <animate attributeName="x" values="${xs.join(";")}" keyTimes="${kts.join(";")}" calcMode="discrete" dur="${T}s" repeatCount="indefinite"/></rect></g>
    ${out}
    <g opacity="0"><animate attributeName="opacity" values="0;1;0" keyTimes="0;${kt(tDone)};${kt(END)}" calcMode="discrete" dur="${T}s" repeatCount="indefinite"/>
      <text x="${PAD}" y="${yLast + LH}" textLength="${f((promptLen - 1) * CW)}" lengthAdjust="spacing">${prompt()}</text>
      <rect class="blink" x="${x0}" y="${yLast + LH - 15}" width="9" height="19" fill="${C.fg}"/></g>
  </g>
</svg>
`;
}

// ---------- 3. Pipeline ----------
function pipeline() {
  const W = 1000, H = 190, Y = 92, T = 9;
  const stages = ["git push", "build", "test", "trivy scan", "cosign sign", "argocd sync", "running"];
  const x1 = 80, x2 = 920, step = (x2 - x1) / (stages.length - 1);
  const tA = 0.6, tB = 6.2, END = T - 0.5;
  const kt = (t) => f(t / T);
  const at = (i) => tA + ((tB - tA) * i) / (stages.length - 1);

  const nodes = stages.map((s, i) => {
    const x = f(x1 + i * step), t = at(i), last = i === stages.length - 1;
    const col = last ? C.cyan : C.green;
    return `<g>
      <circle cx="${x}" cy="${Y}" r="20" fill="${col}" opacity="0">
        <animate attributeName="r" values="20;20;40;40" keyTimes="0;${kt(t)};${kt(t + 0.8)};1" dur="${T}s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0;0;.45;0;0" keyTimes="0;${kt(t)};${kt(t + 0.02)};${kt(t + 0.8)};1" dur="${T}s" repeatCount="indefinite"/></circle>
      <circle cx="${x}" cy="${Y}" r="20" fill="${C.bg2}" stroke="${C.dim}" stroke-width="2.5">
        <animate attributeName="stroke" values="${C.dim};${col};${C.dim}" keyTimes="0;${kt(t)};${kt(END)}" calcMode="discrete" dur="${T}s" repeatCount="indefinite"/></circle>
      <circle cx="${x}" cy="${Y}" r="4" fill="${C.dim}">
        <animate attributeName="opacity" values="1;0;1" keyTimes="0;${kt(t)};${kt(END)}" calcMode="discrete" dur="${T}s" repeatCount="indefinite"/></circle>
      <path d="M${x - 8} ${Y}l5.5 5.5 10.5-11" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0">
        <animate attributeName="opacity" values="0;1;0" keyTimes="0;${kt(t)};${kt(END)}" calcMode="discrete" dur="${T}s" repeatCount="indefinite"/></path>
      <text x="${x}" y="${Y + 44}" text-anchor="middle" fill="${C.dim}">${esc(s)}
        <animate attributeName="fill" values="${C.dim};${C.fg};${C.dim}" keyTimes="0;${kt(t)};${kt(END)}" calcMode="discrete" dur="${T}s" repeatCount="indefinite"/></text>
    </g>`;
  }).join("\n    ");

  const move = (attr, a, b) => `<animate attributeName="${attr}" values="${a};${a};${b};${b};${a}" keyTimes="0;${kt(tA)};${kt(tB)};${kt(END)};1" dur="${T}s" repeatCount="indefinite"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="DevSecOps pipeline: push, build, test, scan, sign, sync, running">
  <title>My DevSecOps pipeline</title>
  <defs>
    <linearGradient id="prog" gradientUnits="userSpaceOnUse" x1="${x1}" y1="0" x2="${x2}" y2="0"><stop offset="0" stop-color="${C.green}"/><stop offset="1" stop-color="${C.cyan}"/></linearGradient>
    <filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="${W}" height="${H}" rx="14" fill="${C.bg2}"/>
  <rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="13.5" fill="none" stroke="${C.dim}" stroke-opacity=".45"/>
  <g font-family="${MONO}" font-size="13">
    <text x="24" y="30" fill="${C.dim}">$ <tspan fill="${C.fg}">git push origin main</tspan>  <tspan fill="${C.dim}"># how I ship</tspan></text>
    <g opacity="0"><animate attributeName="opacity" values="0;1;0" keyTimes="0;${kt(tB + 0.3)};${kt(END)}" calcMode="discrete" dur="${T}s" repeatCount="indefinite"/>
      <rect x="${W - 196}" y="14" width="172" height="24" rx="12" fill="${C.green}" fill-opacity=".15" stroke="${C.green}" stroke-opacity=".6"/>
      <text x="${W - 110}" y="31" text-anchor="middle" fill="${C.green}">✓ deployed to prod</text></g>
    <g><animate attributeName="opacity" values="1;0;1" keyTimes="0;${kt(tB + 0.3)};${kt(END)}" calcMode="discrete" dur="${T}s" repeatCount="indefinite"/>
      <text x="${W - 24}" y="31" text-anchor="end" fill="${C.yellow}">● running<animate attributeName="opacity" values="1;.3;1" dur="1s" repeatCount="indefinite"/></text></g>
  </g>
  <line x1="${x1}" y1="${Y}" x2="${x2}" y2="${Y}" stroke="${C.dim}" stroke-opacity=".35" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 8"/>
  <line x1="${x1}" y1="${Y}" x2="${x1}" y2="${Y}" stroke="url(#prog)" stroke-width="4" stroke-linecap="round">${move("x2", x1, x2)}</line>
  <g font-family="${MONO}" font-size="13">
    ${nodes}
  </g>
  <circle cx="${x1}" cy="${Y}" r="7" fill="#fff" filter="url(#glow)">${move("cx", x1, x2)}
    <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;${kt(tA)};${kt(tB)};${kt(tB + 0.2)};1" dur="${T}s" repeatCount="indefinite"/></circle>
</svg>
`;
}

const out = path.join(__dirname, "..", "assets");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "header.svg"), header());
fs.writeFileSync(path.join(out, "terminal.svg"), terminal());
fs.writeFileSync(path.join(out, "pipeline.svg"), pipeline());
console.log("wrote assets/header.svg, assets/terminal.svg, assets/pipeline.svg");
