(() => {
  'use strict';

  const add = (a, b) => a.map((value, i) => value + b[i]);
  const sub = (a, b) => a.map((value, i) => value - b[i]);
  const mul = (vector, scalar) => vector.map(value => value * scalar);
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const unit = vector => mul(vector, 1 / (Math.hypot(...vector) || 1));
  const mix = (a, b, amount) => a.map((value, i) => value + (b[i] - value) * amount);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const average = vectors => mul(vectors.reduce(add, [0, 0, 0]), 1 / vectors.length);
  const padColor = channels => 'rgb(' + channels.map(value => Math.round(clamp(value, 0, 255))).join(',') + ')';
  const parseHex = (value, fallback) => {
    const hex = (value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(hex)
      ? [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16))
      : fallback;
  };

  const boxSizes = {
    base: [1.58, .805, 1.14],
    lid: [1.65, .115, 1.21],
  };
  const top = .955;
  const bottom = -.92;
  const rim = .701;
  const light = unit([-.58, .86, .66]);
  const reflectionLight = unit(add(light, [0, .13, 1]));
  const insertStyles = {
    'book-case': {
      felt: '#BDA68F', tissue: '#E0CAAF',
      contacts: [[-.075, -.06, .76, .26]],
    },
    coffee: {
      felt: '#AA9383', tissue: '#D7BCA6',
      contacts: [[-.385, -.145, .28, .30], [.438, .104, .20, .21]],
    },
    sketchbook: {
      felt: '#C6AA88', tissue: '#E4CCAB',
      contacts: [[-.15, -.125, .67, .54], [.74, -.08, .16, .44]],
    },
    passport: {
      felt: '#C3A09D', tissue: '#E4CABD',
      contacts: [[-.22, -.04, .48, .25], [.35, -.25, .22, .23]],
    },
    'herb-kit': {
      felt: '#AF9F79', tissue: '#D4C4A2',
      contacts: [[-.581, -.144, .153, .153], [.032, .127, .153, .153], [.599, -.235, .153, .153]],
    },
    'bike-kit': {
      felt: '#A3A49A', tissue: '#C6C5B2',
      contacts: [[-.32, -.13, .63, .33], [.70, -.08, .24, .39]],
    },
  };

  function makeBox(half, center, radius, tone) {
    const geometry = [];
    const bands = half.map(size => [-size, -size + radius * .40, -size + radius, size - radius, size - radius * .40, size]);
    const inner = half.map(size => size - radius);

    for (let axis = 0; axis < 3; axis += 1) {
      const u = (axis + 1) % 3;
      const v = (axis + 2) % 3;
      for (const side of [-1, 1]) {
        function point(a, b) {
          const position = [0, 0, 0];
          position[axis] = side * half[axis];
          position[u] = a;
          position[v] = b;
          const core = position.map((value, index) => clamp(value, -inner[index], inner[index]));
          const normal = unit(sub(position, core));
          return {
            position: add(center, add(core, mul(normal, radius))),
            normal,
          };
        }

        for (let j = 0; j < 5; j += 1) {
          for (let i = 0; i < 5; i += 1) {
            const vertices = [
              point(bands[u][i], bands[v][j]),
              point(bands[u][i + 1], bands[v][j]),
              point(bands[u][i + 1], bands[v][j + 1]),
              point(bands[u][i], bands[v][j + 1]),
            ];
            geometry.push({
              points: vertices.map(vertex => vertex.position),
              normal: unit(average(vertices.map(vertex => vertex.normal))),
              main: i === 2 && j === 2,
              upper: axis === 1 && side === 1,
              tone,
            });
          }
        }
      }
    }
    return geometry;
  }

  function makeCrossRibbon(axis, extent, innerExtent, offset = 0) {
    const path = [
      [-extent + .09, top + offset],
      [extent - .08, top + offset],
      [extent - .035, top + offset - .008],
      [extent - .009, top + offset - .033],
      [extent + .006, top + offset - .075],
      [extent + .006, .747],
      [innerExtent + .014, .701],
      [innerExtent + .014, -.856],
      [innerExtent - .025, bottom],
    ];
    const crossAxis = axis === 0 ? 2 : 0;
    const strips = [];
    const across = [-.164, -.153, -.112, -.050, .020, .090, .151, .167];
    const weave = [.74, .97, .89, 1.09, 1.15, .96, .89];
    function point(pathIndex, crossIndex) {
      const position = [0, path[pathIndex][1], 0];
      position[axis] = path[pathIndex][0];
      position[crossAxis] = across[crossIndex];
      return position;
    }
    for (let i = 0; i < path.length - 1; i += 1) {
      const delta = sub(point(i + 1, 0), point(i, 0));
      const normal = [0, delta[axis], 0];
      normal[axis] = -delta[1];
      for (let j = 0; j < across.length - 1; j += 1) {
        strips.push({
          points: [point(i, j), point(i + 1, j), point(i + 1, j + 1), point(i, j + 1)],
          normal: unit(normal),
          tone: weave[j],
          onLid: i < 5,
          seam: i === 5,
        });
      }
    }
    return strips;
  }

  function rectangle(x, z, y) {
    return [[-x, y, -z], [x, y, -z], [x, y, z], [-x, y, z]];
  }

  function makeInterior() {
    const outer = rectangle(1.529, 1.089, rim);
    const opening = rectangle(1.395, .953, rim);
    const floor = rectangle(1.367, .927, -.668);
    const inward = [[0, 0, 1], [-1, 0, 0], [0, 0, -1], [1, 0, 0]];
    const facing = [0, 1, 0];
    const edges = opening.map((corner, i) => {
      const next = (i + 1) % opening.length;
      return { points: [corner, opening[next], outer[next], outer[i]], normal: facing, tone: .91 };
    });
    const walls = opening.map((corner, i) => {
      const next = (i + 1) % opening.length;
      return { points: [corner, opening[next], floor[next], floor[i]], normal: inward[i], tone: .62 };
    });
    return {
      opening,
      edges,
      faces: [...walls, {points: floor, normal: facing, tone: .37, main: true}],
    };
  }

  function makeInsert(model, palette) {
    const points = model.flatMap(face => face.points);
    const levels = points.map(point => point[1]);
    const lowest = levels.length ? Math.min(...levels) : 0;
    const highest = levels.length ? Math.max(...levels) : 0;
    const felt = parseHex(palette.felt, [186, 160, 145]);
    const tissue = parseHex(palette.tissue, [216, 190, 166]);
    const tray = makeBox([1.36, .117, .928], [0, -.117, 0], .046, .985)
      .map(face => ({...face, color: face.upper ? felt : mul(felt, .78)}));
    const folds = [];

    function paperPanel(vertices, tone) {
      const normal = unit(cross(sub(vertices[1], vertices[0]), sub(vertices[2], vertices[0])));
      folds.push({
        points: vertices,
        normal: normal[1] < 0 ? mul(normal, -1) : normal,
        color: tissue,
        tone,
        doubleSided: true,
      });
    }

    const spans = [-1.35, -1.02, -.73, -.40, -.11, .18, .49, .78, 1.08, 1.35];
    const pleats = [.17, .24, .20, .29, .21, .27, .19, .26, .21, .16];
    const edge = spans.map((x, i) => [x, .012, -.46 - .091 * (i % 2)]);
    const crease = spans.map((x, i) => [x + (i % 2 ? .018 : -.015), pleats[i], -.775 - .037 * (i % 2)]);
    const paperBack = spans.map((x, i) => [x, .065 + .015 * (i % 2), -.913]);
    for (let i = 0; i < spans.length - 1; i += 1) {
      paperPanel([edge[i], edge[i + 1], crease[i + 1]], i % 2 ? .984 : .932);
      paperPanel([edge[i], crease[i + 1], crease[i]], i % 2 ? 1.005 : .952);
      paperPanel([crease[i], crease[i + 1], paperBack[i + 1], paperBack[i]], .83 + .05 * (i % 2));
    }

    for (const side of [-1, 1]) {
      const joins = [-.78, -.50, -.22, .04, .36, .63, .81];
      for (let i = 0; i < joins.length - 1; i += 1) {
        const inside = index => [side * (1.02 + .055 * (index % 2)), .008, joins[index]];
        const outside = index => [side * (1.29 + .034 * (index % 2)), .14 - .014 * index, joins[index]];
        paperPanel([inside(i), inside(i + 1), outside(i + 1)], i % 2 ? .94 : .98);
        paperPanel([inside(i), outside(i + 1), outside(i)], i % 2 ? .89 : .96);
      }
    }

    const contacts = palette.contacts.map(([x, z, halfX, halfZ]) => {
      const enclosed = points.filter(point => Math.abs(point[0] - x) <= halfX && Math.abs(point[2] - z) <= halfZ);
      const level = enclosed.length ? Math.min(...enclosed.map(point => point[1])) - lowest : 0;
      const raised = clamp(level, 0, .16);
      if (raised > .016) {
        const pad = makeBox([halfX * .83, raised / 2, halfZ * .77], [x, raised / 2, z], Math.min(raised / 3, .027), .948);
        tray.push(...pad.map(face => ({...face, color: felt})));
      }
      return {x, z, halfX, halfZ, raised};
    });
    return {tray, folds, contacts, lowest, depth: highest - lowest};
  }

  const cubic = (points, t) => {
    const s = 1 - t;
    return points[0].map((value, axis) =>
      s * s * s * value + 3 * s * s * t * points[1][axis] + 3 * s * t * t * points[2][axis] + t * t * t * points[3][axis]
    );
  };

  const loops = [
    {
      curves: [
        [[-.03, 1.076, .006], [-.35, 1.25, -.075], [-1.02, 1.55, -.36], [-1.12, 1.405, -.22]],
        [[-1.12, 1.405, -.22], [-1.25, 1.22, -.044], [-.55, 1.12, .148], [-.07, 1.11, .042]],
      ],
      direction: [-.15, .27, 1],
      twist: .45,
      radius: .22,
    },
    {
      curves: [
        [[.038, 1.108, -.05], [.30, 1.46, -.15], [.96, 1.62, -.45], [1.025, 1.415, -.35]],
        [[1.025, 1.415, -.35], [1.1, 1.20, -.18], [.37, 1.095, .10], [.06, 1.095, .036]],
      ],
      direction: [.1, .49, 1],
      twist: -.61,
      radius: .232,
    },
    {
      curves: [[[-.06, 1.092, .076], [-.33, 1.074, .26], [-.72, 1.017, .55], [-1.37, .978, .69]]],
      direction: [-.25, -.12, 1],
      twist: .35,
      radius: .165,
      tail: true,
    },
    {
      curves: [[[.066, 1.104, .053], [.22, 1.129, .15], [.59, 1.024, .50], [.87, 1.008, .96]]],
      direction: [-1, .16, .5],
      twist: -.39,
      radius: .174,
      tail: true,
    },
  ];

  function makeBow(sway) {
    const geometry = [];
    const divisions = 17;
    const weave = [0.79, 0.94, 1.12, 1.04, .91, .81];
    const across = [-1, -.83, -.47, 0, .49, .86, 1];
    const ridges = [-.006, -.003, .014, .019, .008, -.004, -.009];

    for (const strip of loops) {
      const rows = strip.curves.flatMap((curve, piece) => Array.from({ length: divisions + 1 }, (_, index) => {
        const t = index / divisions;
        const passage = (piece + t) / strip.curves.length;
        const center = cubic(curve, t);
        const tangent = unit(sub(cubic(curve, Math.min(1, t + .018)), cubic(curve, Math.max(0, t - .018))));
        const perpendicular = unit(sub(strip.direction, mul(tangent, dot(strip.direction, tangent))));
        const bank = unit(cross(tangent, perpendicular));
        const tilt = strip.twist * Math.sin(Math.PI * passage);
        const lateral = add(mul(perpendicular, Math.cos(tilt)), mul(bank, Math.sin(tilt)));
        const normal = unit(cross(tangent, lateral));
        const gather = strip.tail ? .55 + .45 * Math.min(1, t * 4) : .47 + .53 * Math.sin(Math.PI * passage) ** .48;
        center[1] += sway * (strip.tail ? passage * .45 : Math.sin(Math.PI * passage));
        return across.map((width, j) => {
          const notch = strip.tail && index === divisions ? mul(tangent, -.074 * (1 - Math.abs(width))) : [0, 0, 0];
          return add(add(center, mul(lateral, width * gather * strip.radius)), add(mul(normal, ridges[j] * gather), notch));
        });
      }).slice(piece === 0 ? 0 : 1));

      for (let i = 0; i < rows.length - 1; i += 1) {
        for (let j = 0; j < across.length - 1; j += 1) {
          const points = [rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]];
          geometry.push({
            points,
            normal: unit(cross(sub(points[1], points[0]), sub(points[3], points[0]))),
            tone: weave[j],
            doubleSided: true,
          });
        }
      }
    }

    return geometry;
  }

  function makeKnot() {
    const geometry = [];
    const center = [0, 1.099, .038];
    const shape = [.205, .108, .169];
    const steps = 12;
    const rings = 8;
    function normal(row, column) {
      const tilt = (row / rings - .5) * Math.PI;
      const angle = column / steps * Math.PI * 2;
      return [Math.cos(angle) * Math.cos(tilt), Math.sin(tilt), Math.sin(angle) * Math.cos(tilt)];
    }
    for (let row = 0; row < rings; row += 1) {
      for (let column = 0; column < steps; column += 1) {
        const normals = [normal(row, column), normal(row + 1, column), normal(row + 1, column + 1), normal(row, column + 1)];
        geometry.push({
          points: normals.map(n => add(center, n.map((value, axis) => value * shape[axis]))),
          normal: unit(average(normals).map((value, axis) => value / shape[axis])),
          tone: 1.03 + Math.cos(column * 2) * .042,
        });
      }
    }
    return geometry;
  }

  function makeTexture() {
    const bitmap = document.createElement('canvas');
    bitmap.width = bitmap.height = 150;
    const context = bitmap.getContext('2d');
    let seed = 49913;
    function noise() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    for (let grain = 0; grain < 6300; grain += 1) {
      const x = noise() * 150;
      const y = noise() * 150;
      const bright = noise() > .54;
      const opacity = .025 + noise() * .14;
      context.fillStyle = bright ? 'rgba(255,252,245,' + opacity + ')' : 'rgba(108,77,50,' + opacity + ')';
      context.fillRect(x, y, .30 + noise() * .59, .29 + noise() * .54);
    }
    return bitmap;
  }

  function mountImennoScene(canvas, options = {}) {
    const screen = canvas.getContext('2d', { alpha: true });
    const layer = document.createElement('canvas');
    const ctx = layer.getContext('2d', { alpha: true });
    const paperFallback = parseHex(options.paper, [243, 238, 230]);
    const ribbonFallback = parseHex(options.ribbon, [111, 36, 52]);
    const tagFallback = parseHex(options.tag, [243, 238, 230]);
    const ink = parseHex(options.ink, [45, 33, 28]);
    const tagFont = options.tagFont || 'Georgia, serif';
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduceMotion = () => query.matches || Boolean(options.reducedMotion);
    const paperTexture = makeTexture();
    const pattern = ctx.createPattern(paperTexture, 'repeat');
    const interior = makeInterior();
    const base = makeBox(boxSizes.base, [0, rim - boxSizes.base[1], 0], .051, .967)
      .filter(face => !face.main || !face.upper);
    const lid = makeBox(boxSizes.lid, [0, .829, 0], .043, 1.010);
    const lining = {
      points: rectangle(1.48, 1.04, .712),
      normal: [0, -1, 0],
      tone: 1.08,
      main: true,
    };
    const wrap = [
      ...makeCrossRibbon(0, boxSizes.lid[0], boxSizes.base[0]),
      ...makeCrossRibbon(2, boxSizes.lid[2], boxSizes.base[2], .006),
    ];
    const lidRibbon = wrap.filter(face => face.onLid);
    const baseRibbon = wrap.filter(face => !face.onLid && !face.seam);
    const seamRibbon = wrap.filter(face => face.seam);
    const knot = makeKnot();
    const restingBow = makeBow(0);
    let w = 0;
    let h = 0;
    let px = 1;
    let raf = 0;
    let idleFrame = 0;
    let lastIdlePaint;
    let idleTime = 0;
    let idleStrength = 0;
    let idlePose = { lift: 0, yaw: 0, pitch: 0, roll: 0 };
    let inView = false;
    let destroyed = false;
    let position = 0;
    let resolveMotion;
    let finishMotion;
    let sceneX = 0;
    let sceneOpacity = 1;
    let paper;
    let ribbon;
    let tag;
    let tagGraphic;
    let label;
    let gift;
    let giftMesh;
    let giftInsert;
    applyGift(options.gift || {});

    function applyGift(nextGift) {
      gift = nextGift;
      paper = parseHex(gift.paper, paperFallback);
      ribbon = parseHex(gift.ribbon, ribbonFallback);
      tag = parseHex(gift.tag, tagFallback);
      const name = typeof gift.name === 'string' ? gift.name.trim() : '';
      label = !name || /^для\s/i.test(name) ? name || 'Для Маши' : 'Для ' + name;
      tagGraphic = makeTagGraphic();
      const model = window.imennoGiftMeshes?.[gift.model] || [];
      giftMesh = model.map(face => ({
        ...face,
        normal: face.normal || unit(cross(sub(face.points[1], face.points[0]), sub(face.points[2], face.points[0]))),
        color: Array.isArray(face.color) ? face.color : parseHex(face.color, tagFallback),
        tone: face.tone ?? 1,
      }));
      giftInsert = makeInsert(giftMesh, insertStyles[gift.model] || {contacts: []});
    }

    function makeTagGraphic() {
      const bitmap = document.createElement('canvas');
      bitmap.width = 660;
      bitmap.height = 270;
      const brush = bitmap.getContext('2d');
      brush.beginPath();
      brush.moveTo(0, 72);
      brush.lineTo(66, 5);
      brush.quadraticCurveTo(70, 1, 80, 1);
      brush.lineTo(646, 1);
      brush.quadraticCurveTo(659, 1, 659, 15);
      brush.lineTo(659, 255);
      brush.quadraticCurveTo(659, 269, 646, 269);
      brush.lineTo(80, 269);
      brush.quadraticCurveTo(70, 269, 66, 265);
      brush.lineTo(0, 199);
      brush.closePath();
      brush.clip();

      const fill = brush.createLinearGradient(0, 0, 530, 270);
      fill.addColorStop(0, padColor(mix(tag, [255, 252, 245], .53)));
      fill.addColorStop(.66, padColor(mix(tag, [255, 252, 245], .13)));
      fill.addColorStop(1, padColor(mul(tag, .926)));
      brush.fillStyle = fill;
      brush.fillRect(0, 0, 660, 270);
      brush.fillStyle = brush.createPattern(paperTexture, 'repeat');
      brush.fillRect(0, 0, 660, 270);
      brush.fillStyle = padColor(dot(tag, [.213, .715, .072]) > 152 ? ink : [250, 244, 235]);
      brush.font = '106px ' + tagFont;
      brush.textAlign = 'center';
      brush.textBaseline = 'middle';
      brush.fillText(label, 368, 137, 495);

      brush.beginPath();
      brush.ellipse(91, 133, 16, 17, -.18, 0, Math.PI * 2);
      brush.fillStyle = '#83695b';
      brush.fill();
      brush.beginPath();
      brush.ellipse(90, 135, 12.5, 13, -.18, 0, Math.PI * 2);
      brush.fillStyle = '#48312b';
      brush.fill();
      return bitmap;
    }

    function draw(open, sway = 0) {
      if (!w || !h || destroyed) return;
      const yaw = -.35 + open * .13 + idlePose.yaw * idleStrength;
      const pitch = .435 + open * .027 + idlePose.pitch * idleStrength;
      const roll = idlePose.roll * idleStrength;
      const sinYaw = Math.sin(yaw);
      const cosYaw = Math.cos(yaw);
      const sinPitch = Math.sin(pitch);
      const cosPitch = Math.cos(pitch);
      const sinRoll = Math.sin(roll);
      const cosRoll = Math.cos(roll);
      const scale = Math.min(w / 5.22, h / (4.32 + open * .43)) * (1 - open * .30);
      const elevation = idlePose.lift * idleStrength;
      const screenLift = elevation * clamp(scale * .072, 5, 10);
      const distance = 13;
      const center = [w * (.504 + open * .017), h * (.54 + open * .074)];
      const lidHeight = 2.03 * open;
      const lidDepth = -.27 * Math.max(0, (open - .58) / .42) ** 2;
      const lidOffset = [0, lidHeight, lidDepth];
      const lift = point => add(point, lidOffset);
      function moveMesh(faces, offset) {
        return faces.map(face => ({
          ...face,
          points: face.points.map(point => add(point, offset)),
        }));
      }

      function orient([x, y, z]) {
        const sideways = x * cosYaw + z * sinYaw;
        const forwards = -x * sinYaw + z * cosYaw;
        const upright = y * cosPitch - forwards * sinPitch;
        return [sideways * cosRoll - upright * sinRoll, sideways * sinRoll + upright * cosRoll,
          y * sinPitch + forwards * cosPitch];
      }

      function projectPoint(point, verticalOffset) {
        const [x, y, z] = orient(point);
        const size = scale * distance / (distance - z);
        return [center[0] + x * size, center[1] - y * size - verticalOffset, z];
      }

      const project = point => projectPoint(point, screenLift);

      function outline(points) {
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
        ctx.closePath();
      }

      function painter(faces, kind) {
        const visible = [];
        for (const face of faces) {
          const cameraNormal = orient(face.normal);
          const cameraPoint = orient(average(face.points));
          const stance = dot(cameraNormal, sub([0, 0, distance], cameraPoint));
          if (stance <= 0 && !face.doubleSided) continue;
          visible.push({ face, stance, depth: cameraPoint[2] + (face.bias || 0) });
        }
        visible.sort((a, b) => a.depth - b.depth);
        for (const { face, stance } of visible) {
          const normal = stance >= 0 ? face.normal : mul(face.normal, -1);
          const vertices = face.points.map(project);
          outline(vertices);

          if (kind !== 'ribbon') {
            const brightness = (.683 + .335 * Math.max(0, dot(normal, light))) * face.tone;
            const surface = kind === 'paper' ? paper : face.color;
            const glint = kind === 'gift' ? .045 * Math.max(0, dot(normal, reflectionLight)) ** 12 : 0;
            const base = mix(mul(surface, brightness), [252, 203, 161], glint);
            ctx.fillStyle = padColor(base);
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineJoin = 'round';
            ctx.lineWidth = .68;
            ctx.stroke();

            if (face.main) {
              const xs = vertices.map(p => p[0]);
              const ys = vertices.map(p => p[1]);
              const sheen = ctx.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
              sheen.addColorStop(0, padColor(mul(base, 1.049)));
              sheen.addColorStop(.45, padColor(base));
              sheen.addColorStop(1, padColor(mul(base, .938)));
              ctx.fillStyle = sheen;
            }

            ctx.fill();
            if (face.main) {
              ctx.fillStyle = pattern;
              ctx.fill();
            }
          } else {
            const reflection = Math.max(0, dot(normal, reflectionLight));
            const glow = .061 * reflection ** 9 + .17 * reflection ** 27;
            const frontal = .49 + .69 * Math.max(0, dot(normal, light));
            const interior = stance >= 0 ? 1 : .84;
            const tone = mix(mul(ribbon, frontal * face.tone * interior), [240, 154, 146], glow);
            ctx.fillStyle = padColor(tone);
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = .62;
            ctx.lineJoin = 'round';
            ctx.stroke();
            ctx.fill();
          }
        }
      }

      function shadow(position, rx, ry, opacity, rotation) {
        const [x, y] = projectPoint(position, 0);
        const strength = opacity * (1 - elevation * .14);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.scale(rx * scale, ry * scale);
        const soften = ctx.createRadialGradient(0, 0, .11, 0, 0, 1);
        soften.addColorStop(0, 'rgba(12,7,6,' + strength + ')');
        soften.addColorStop(.54, 'rgba(16,9,6,' + (strength * .62) + ')');
        soften.addColorStop(1, 'rgba(16,9,6,0)');
        ctx.fillStyle = soften;
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
      }

      function drawTag() {
        const tagSwing = open * .06 + sway * 2;
        const angle = -.134 + tagSwing;
        const attachment = lift([.31, .966, 1.083]);
        const left = add(attachment, [-.06, -.541 + sway * .36, .152 + open * .046]);
        const width = 1.37;
        const height = .56;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        function actual(u, v) {
          const x = u * width - .19;
          const y = (.50 - v) * height;
          return add(left, [cos * x - sin * y, sin * x + cos * y, u * (.095 + tagSwing * .21)]);
        }
        const corners = [actual(0, 0), actual(1, 0), actual(1, 1), actual(0, 1)].map(project);
        const shape = [[0, .265], [.105, .004], [1, .004], [1, 1], [.105, 1], [0, .73]];
        const shadowCoords = shape.map(([u, v]) => project(add(actual(u, v), [.014, -.021, -.046])));
        ctx.save();
        ctx.filter = 'blur(' + Math.max(1, 3.8 * scale / 136) + 'px)';
        ctx.fillStyle = 'rgba(40,25,23,.32)';
        outline(shadowCoords);
        ctx.fill();
        ctx.restore();

        const origin = corners[0];
        const right = sub(corners[1], origin);
        const down = sub(corners[3], origin);
        ctx.save();
        ctx.transform(right[0] / 660, right[1] / 660, down[0] / 270, down[1] / 270, origin[0], origin[1]);
        ctx.drawImage(tagGraphic, 0, 0);
        ctx.restore();

        const eyelet = actual(.14, .495);
        const topCord = [[.034, 1.16, .185], [.13, 1.075, .39], [.25, .985, .752], [.31, .966, 1.083]].map(lift);
        const cord = [
          topCord,
          [attachment, add(attachment, [.041, -.072, .206]), add(eyelet, [.048, .236, .021]), eyelet],
        ];
        function drawCord(color, thickness, offset) {
          ctx.beginPath();
          for (const curve of cord) {
            const start = project(add(curve[0], offset));
            ctx.moveTo(start[0], start[1]);
            for (let step = 1; step < 14; step += 1) {
              const point = project(add(cubic(curve, step / 13), offset));
              ctx.lineTo(point[0], point[1]);
            }
          }
          ctx.strokeStyle = color;
          ctx.lineWidth = thickness * scale;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
        drawCord('rgba(41,22,14,.46)', .017, [.013, -.018, -.006]);
        drawCord('#79514b', .014, [0, 0, 0]);
        drawCord('rgba(195,139,119,.70)', .0045, [-.003, .003, .001]);
      }

      function drawInterior() {
        const aperture = interior.opening.map(project);
        ctx.save();
        outline(aperture);
        ctx.clip();
        painter(interior.faces, 'paper');
        const shade = ctx.createLinearGradient(...aperture[0].slice(0, 2), ...aperture[2].slice(0, 2));
        shade.addColorStop(0, 'rgba(47,25,23,.38)');
        shade.addColorStop(.68, 'rgba(47,25,23,.13)');
        shade.addColorStop(1, 'rgba(47,25,23,.32)');
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      function drawContactShadow(contact, trayHeight) {
        const {x, z, halfX, halfZ, raised} = contact;
        const height = trayHeight + raised + .005;
        const [cx, cy] = project([x + .026, height, z + .013]);
        const [rightX, rightY] = project([x + halfX * 1.17, height, z]);
        const [frontX, frontY] = project([x, height, z + halfZ * 1.18]);
        ctx.save();
        ctx.transform(rightX - cx, rightY - cy, frontX - cx, frontY - cy, cx, cy);
        const contactShade = ctx.createRadialGradient(0, 0, .04, 0, 0, 1);
        contactShade.addColorStop(0, 'rgba(44,28,25,.54)');
        contactShade.addColorStop(.51, 'rgba(44,28,25,.35)');
        contactShade.addColorStop(1, 'rgba(57,34,27,0)');
        ctx.fillStyle = contactShade;
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
      }

      function drawGift() {
        if (!giftMesh.length || open <= .08) return;
        const rise = clamp((open - .08) / .86, 0, 1);
        const closedTray = Math.min(-.17, .625 - giftInsert.depth);
        const trayHeight = closedTray + (.714 - closedTray) * rise * (2 - rise);
        const trayOffset = [0, trayHeight, 0];
        const foreground = [
          [-1.395, rim, .953], [1.395, rim, .953], [1.395, rim, -.953],
          [1.59, bottom, -1.15], [1.59, bottom, 1.15], [-1.59, bottom, 1.15],
        ].map(project);
        ctx.save();
        outline(foreground);
        ctx.rect(0, 0, w, h);
        ctx.clip('evenodd');
        painter(moveMesh(giftInsert.tray, trayOffset), 'insert');
        painter(moveMesh(giftInsert.folds, trayOffset), 'insert');
        for (const contact of giftInsert.contacts) drawContactShadow(contact, trayHeight);
        painter(moveMesh(giftMesh, [0, trayHeight - giftInsert.lowest, 0]), 'gift');
        ctx.restore();
      }

      ctx.setTransform(px, 0, 0, px, 0, 0);
      ctx.clearRect(0, 0, w, h);
      shadow([.26, bottom, .04], 2.40, .45, .67, .10);
      shadow([.09, bottom, .21], 1.88, .218, .72, .10);
      shadow([.05, bottom, .5], 1.48, .077, .48, .14);
      painter([...base, ...interior.edges], 'paper');
      drawInterior();
      drawGift();
      painter(baseRibbon, 'ribbon');
      if (open < .01) painter(seamRibbon, 'ribbon');
      painter(moveMesh(lid, lidOffset), 'paper');
      painter(moveMesh([lining], lidOffset), 'paper');
      painter(moveMesh(lidRibbon, lidOffset), 'ribbon');
      painter(moveMesh([...(sway === 0 ? restingBow : makeBow(sway)), ...knot], lidOffset), 'ribbon');
      drawTag();

      screen.setTransform(px, 0, 0, px, 0, 0);
      screen.clearRect(0, 0, w, h);
      screen.globalAlpha = sceneOpacity;
      screen.drawImage(layer, sceneX * w, 0, w, h);
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      px = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(w * px));
      const height = Math.max(1, Math.round(h * px));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        layer.width = width;
        layer.height = height;
      }
      draw(position);
    }

    function stopMotion(settled) {
      cancelAnimationFrame(raf);
      raf = 0;
      resolveMotion?.(settled);
      resolveMotion = undefined;
      finishMotion = undefined;
    }

    function canFloat() {
      return !destroyed && inView && !document.hidden && !reduceMotion() && position === 0 && !raf;
    }

    function pauseFloat() {
      cancelAnimationFrame(idleFrame);
      idleFrame = 0;
      lastIdlePaint = undefined;
    }

    function float(now) {
      idleFrame = 0;
      if (!canFloat()) return;
      lastIdlePaint ??= now - 33;
      const elapsed = now - lastIdlePaint;
      if (elapsed >= 32) {
        lastIdlePaint = now;
        const advance = Math.min(elapsed, 65);
        idleTime += advance;
        idleStrength = Math.min(1, idleStrength + advance / 750);
        idlePose = {
          lift: .53 + .32 * Math.sin(idleTime * .0011 - .55) + .14 * Math.sin(idleTime * .00222 + .4),
          yaw: .021 * Math.sin(idleTime * .00105 + .6),
          pitch: .017 * Math.sin(idleTime * .00141 - .4),
          roll: .012 * Math.sin(idleTime * .00086 + .35),
        };
        draw(0);
      }
      idleFrame = requestAnimationFrame(float);
    }

    function syncFloat() {
      if (!canFloat()) pauseFloat();
      else if (!idleFrame) idleFrame = requestAnimationFrame(float);
    }

    function animate(duration, update, settle) {
      let start;
      return new Promise(resolve => {
        resolveMotion = resolve;
        finishMotion = settle;
        function frame(now) {
          start ??= now;
          const t = clamp((now - start) / duration, 0, 1);
          if (t < 1) {
            update(t);
            raf = requestAnimationFrame(frame);
          } else {
            settle();
            stopMotion(true);
            syncFloat();
          }
        }
        raf = requestAnimationFrame(frame);
      });
    }

    function setOpen(open, { immediate = false } = {}) {
      if (destroyed) return Promise.resolve(false);
      pauseFloat();
      stopMotion(false);
      sceneX = 0;
      sceneOpacity = 1;
      const goal = open ? 1 : 0;
      const from = position;
      const strengthAtStart = idleStrength;
      const settle = () => {
        position = goal;
        idleStrength = 0;
        draw(position);
      };
      if (immediate || reduceMotion() || goal === from) {
        settle();
        syncFloat();
        return Promise.resolve(true);
      }
      const direction = goal - from;
      const duration = (open ? 670 : 515) * Math.max(.32, Math.abs(direction));
      return animate(duration, t => {
        const ease = open ? t * t * (3 - 2 * t) : 1 - (1 - t) ** 2.5;
        position = from + direction * ease;
        idleStrength = strengthAtStart * (1 - Math.min(1, t * 2.8)) ** 2;
        const sway = Math.sin(t * Math.PI * 2) * (1 - t) * .067 * direction;
        draw(position, sway);
      }, settle);
    }

    function setGift(nextGift, { immediate = false, direction = 1 } = {}) {
      if (destroyed) return Promise.resolve(false);
      pauseFloat();
      stopMotion(false);
      position = 0;
      idleStrength = 0;
      const sign = direction < 0 ? -1 : 1;
      let swapped = false;
      function swap() {
        if (swapped) return;
        applyGift(nextGift || {});
        swapped = true;
      }
      function settle() {
        swap();
        sceneX = 0;
        sceneOpacity = 1;
        draw(0);
      }
      if (immediate || reduceMotion()) {
        settle();
        syncFloat();
        return Promise.resolve(true);
      }
      const fromX = sceneX;
      const fromOpacity = sceneOpacity;
      return animate(490, t => {
        const cutoff = .47;
        if (t < cutoff) {
          const out = (t / cutoff) ** 1.8;
          sceneX = fromX * (1 - out) - .19 * sign * out;
          sceneOpacity = fromOpacity * (1 - out);
        } else {
          swap();
          const incoming = 1 - (1 - (t - cutoff) / (1 - cutoff)) ** 2.8;
          sceneX = .19 * sign * (1 - incoming);
          sceneOpacity = incoming;
        }
        draw(0);
      }, settle);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      inView = entry.intersectionRatio >= .12;
      syncFloat();
    }, { threshold: .12 });
    visibilityObserver.observe(canvas);
    document.addEventListener('visibilitychange', syncFloat);
    const onMotionChange = () => {
      if (reduceMotion()) {
        finishMotion?.();
        stopMotion(true);
        idleStrength = 0;
        draw(position);
      }
      syncFloat();
    };
    query.addEventListener('change', onMotionChange);

    resize();
    if (document.fonts) document.fonts.ready.then(() => {
      if (destroyed) return;
      tagGraphic = makeTagGraphic();
      draw(position);
    });

    return {
      setOpen,
      setGift,
      destroy() {
        destroyed = true;
        pauseFloat();
        stopMotion(false);
        resizeObserver.disconnect();
        visibilityObserver.disconnect();
        document.removeEventListener('visibilitychange', syncFloat);
        query.removeEventListener('change', onMotionChange);
      },
    };
  }

  window.mountImennoScene = mountImennoScene;
})();
