// 3D primitives drawn into one shared WEBGL buffer per p5 instance, then composited onto the 2D canvas.
// The clip's 2D scale is folded into the 3D size so the result stays sharp instead of being bitmap-scaled.
(function () {
  const P5M = window.P5M;
  const { registerType, parseColor } = P5M;

  function buffer(p, W, H) {
    let g = p._p5m3d;
    if (!g || g.width !== W || g.height !== H) {
      if (g) g.remove();
      g = p._p5m3d = p.createGraphics(W, H, p.WEBGL);
      g.pixelDensity(1);
      g.setAttributes && g.setAttributes('alpha', true);
    }
    return g;
  }

  // p5 texture() needs a p5 object; wrap each image asset once in a 2D p5.Graphics
  const texCache = new WeakMap();
  function texture(p, img) {
    let per = texCache.get(p);
    if (!per) { per = new Map(); texCache.set(p, per); }
    let t = per.get(img);
    if (!t) {
      t = p.createGraphics(img.naturalWidth || img.width, img.naturalHeight || img.height);
      t.pixelDensity(1);
      t.drawingContext.drawImage(img, 0, 0);
      per.set(img, t);
    }
    return t;
  }

  function shape(g, kind, s, detail) {
    switch (kind) {
      case 'sphere': g.sphere(s / 2, detail, detail); break;
      case 'ellipsoid': g.ellipsoid(s / 2, s / 3, s / 2.6, detail, detail); break;
      case 'torus': g.torus(s / 2.8, s / 8, detail * 2, detail); break;
      case 'cone': g.cone(s / 2.4, s, detail, 1); break;
      case 'cylinder': g.cylinder(s / 2.4, s, detail, 1); break;
      case 'plane': g.plane(s, s); break;
      default: g.box(s);
    }
  }

  function draw(p, pr, env) {
    const W = env.W, H = env.H;
    const g = buffer(p, W, H);
    const kx = Math.abs(env.sx) || 1, ky = Math.abs(env.sy) || 1;
    const k = Math.max(kx, ky);
    const lt = env.lt;
    const [r, gg, b] = parseColor(pr.color);
    g.clear();
    g.reset();
    g.push();
    g.noStroke();
    const asset = pr.texture && env.project.assets[pr.texture];
    const img = asset ? P5M.assets.image(asset) : null;
    if (pr.material === 'normal') g.normalMaterial();
    else {
      g.ambientLight(pr.ambient * 255);
      g.directionalLight(255, 255, 255, -0.4, 0.5, -1);
      if (pr.material === 'wireframe') { g.noFill(); g.stroke(r, gg, b); g.strokeWeight(1.5); }
      else if (img) g.texture(texture(p, img));
      // specularMaterial only sets the highlight colour; the body colour comes from fill (default white)
      else if (pr.material === 'specular') { g.fill(r, gg, b); g.specularMaterial(255); g.shininess(40); g.pointLight(255, 255, 255, 200, -200, 400); }
      else { g.ambientMaterial(r, gg, b); g.fill(r, gg, b); }
    }
    const D = Math.PI / 180;
    g.rotateX((pr.tiltX + lt * pr.spinX) * D);
    g.rotateY((pr.tiltY + lt * pr.spinY) * D);
    g.rotateZ((pr.tiltZ + lt * pr.spinZ) * D);
    shape(g, pr.kind, pr.size * k, pr.detail);
    g.pop();
    const ctx = p.drawingContext;
    ctx.scale(1 / kx, 1 / ky);
    ctx.drawImage(g.elt, -W / 2, -H / 2, W, H);
  }

  registerType('shape3d', {
    label: '3D 物件', category: '3d',
    props: [
      { key: 'kind', label: '形狀', type: 'select', default: 'box', group: 'main', options: [
        ['box', '立方體'], ['sphere', '球體'], ['torus', '甜甜圈'], ['cone', '圓錐'], ['cylinder', '圓柱'], ['ellipsoid', '橢球'], ['plane', '平面卡片']] },
      { key: 'size', label: '尺寸', type: 'number', min: 1, step: 1, default: 220, group: 'main', anim: true },
      { key: 'color', label: '顏色', type: 'color', default: '#ff8a5c', group: 'main', anim: true },
      { key: 'material', label: '材質', type: 'select', default: 'lit', group: 'main', options: [
        ['lit', '霧面'], ['specular', '亮面'], ['normal', '彩虹法線'], ['wireframe', '線框']] },
      { key: 'texture', label: '貼圖', type: 'asset', accept: 'image', group: 'main', when: (pr) => pr.material === 'lit' },
      { key: 'ambient', label: '環境光', type: 'range', min: 0, max: 1, step: 0.01, default: 0.35, group: 'main', anim: true },
      { key: 'spinX', label: 'X 自轉（°/秒）', type: 'number', step: 1, default: 20, group: 'main', anim: true },
      { key: 'spinY', label: 'Y 自轉（°/秒）', type: 'number', step: 1, default: 40, group: 'main', anim: true },
      { key: 'spinZ', label: 'Z 自轉（°/秒）', type: 'number', step: 1, default: 0, group: 'main', anim: true },
      { key: 'tiltX', label: 'X 傾斜', type: 'number', step: 1, default: -20, unit: '°', group: 'main', anim: true },
      { key: 'tiltY', label: 'Y 傾斜', type: 'number', step: 1, default: 30, unit: '°', group: 'main', anim: true },
      { key: 'tiltZ', label: 'Z 傾斜', type: 'number', step: 1, default: 0, unit: '°', group: 'main', anim: true },
      { key: 'detail', label: '細緻度', type: 'number', min: 6, max: 48, step: 1, default: 24, group: 'main' },
    ],
    draw,
    bounds: (pr) => ({ w: pr.size * 1.4, h: pr.size * 1.4 }),
  });

  // Compile the default shaders once so the first 3D frame during playback does not stall (~115 ms measured)
  P5M.warm3d = function (p, W, H) {
    const g = buffer(p, W, H);
    g.clear(); g.push(); g.normalMaterial(); g.box(10);
    g.ambientLight(80); g.directionalLight(255, 255, 255, 0, 0, -1); g.ambientMaterial(200); g.sphere(10, 8, 8);
    g.specularMaterial(200); g.pointLight(255, 255, 255, 0, 0, 100); g.torus(10, 3, 8, 6); g.pop(); g.clear();
  };
})();
