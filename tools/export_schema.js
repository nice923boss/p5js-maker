// Export the runtime type registry to plain JSON for tools that cannot run a browser
// (the HoloTeam skill's standard-library CLI reads it to validate and build projects).
// Usage: node tools/export_schema.js [out.json]
// Default output: skill/p5js-maker-holoteam/reference/schema.json
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(ROOT, 'skill/p5js-maker-holoteam/reference/schema.json'));

// Minimal browser stubs: registry files only touch these at load time
const anything = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : anything()), apply: () => anything() });
const element = () => ({ getContext: () => anything(), style: {}, appendChild() {}, setAttribute() {} });
const sandbox = {
  console,
  document: {
    createElement: element,
    head: element(), body: element(),
    fonts: { addEventListener() {}, load: () => Promise.resolve() },
  },
  DOMMatrix: function () {},
};
sandbox.window = sandbox;
vm.createContext(sandbox);

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'runtime/manifest.json'), 'utf8'));
const files = (manifest.runtime || manifest.files || []).filter((f) => !/recorder|player/.test(f));
for (const f of files) {
  const file = path.join(ROOT, 'runtime', path.basename(f));
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}
const P5M = sandbox.P5M;

const COMMON = ['x', 'y', 'scale', 'rotation', 'opacity', 'blur', 'brightness', 'contrast', 'saturate', 'hue'];
function prop(pd) {
  const o = { key: pd.key, label: pd.label, type: pd.type };
  if (typeof pd.default === 'function') o.default = '$' + (pd.default({ width: 'width', height: 'height' }));
  else if (pd.default !== undefined) o.default = pd.default;
  for (const k of ['min', 'max', 'step', 'unit', 'accept']) if (pd[k] !== undefined) o[k] = pd[k];
  if (pd.options) o.options = pd.options.map((x) => (Array.isArray(x) ? { value: x[0], label: x[1] } : { value: x, label: String(x) }));
  if (pd.anim) o.anim = true;
  if (pd.when) {
    const src = pd.when.toString();
    o.when = src.includes('.uses.') ? 'preset-uses' : src.replace(/^\(pr\)\s*=>\s*/, '');
  }
  return o;
}
const types = {};
for (const d of Object.values(P5M.types)) {
  types[d.name] = {
    label: d.label, category: d.category || '',
    kind: d.screen ? 'screen' : d.audio ? 'audio' : 'visual',
    props: d.props.filter((pd) => !(d.screen || d.audio) || !COMMON.includes(pd.key)).map(prop),
  };
}
const presetTable = (t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { label: v.label, uses: v.uses || null, d: v.d || null, dur: v.dur ?? null, text: !!v.text }]));

const schema = {
  generated: 'tools/export_schema.js',
  version: P5M.VERSION,
  p5: manifest.p5 || null,
  common: COMMON,
  camera: ['x', 'y', 'zoom', 'rotation', 'shake'],
  blends: [['source-over', '一般'], ['multiply', '色彩增值'], ['screen', '濾色'], ['overlay', '覆蓋'], ['soft-light', '柔光'], ['lighter', '相加發光'], ['difference', '差異']],
  ease: P5M.EASE_LABELS,
  fonts: P5M.assets.FONTS.map((f) => ({ family: f.family, label: f.label })),
  anim: { in: presetTable(P5M.presets.IN), out: presetTable(P5M.presets.OUT), loop: presetTable(P5M.presets.LOOP) },
  particlePresets: presetTable(P5M.particlePresets),
  genPresets: presetTable(P5M.genPresets),
  sfx: Object.fromEntries(Object.entries(P5M.sfxCatalog).map(([k, v]) => [k, { label: v.label, dur: v.dur }])),
  types,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(schema, null, 1) + '\n', 'utf8');
console.log(`schema: ${Object.keys(types).length} types -> ${out}`);
