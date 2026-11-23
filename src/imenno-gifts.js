(() => {
  'use strict';

  const add = (a, b) => a.map((value, index) => value + b[index]);
  const subtract = (a, b) => a.map((value, index) => value - b[index]);
  const scale = (vector, amount) => vector.map(value => value * amount);
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const unit = vector => scale(vector, 1 / (Math.hypot(...vector) || 1));
  const TAU = Math.PI * 2;
  const colors = {
    ivory: '#EDE1CA',
    paper: '#F2E7D0',
    chocolate: '#50392F',
    blue: '#8396A2',
    blueSeam: '#596F7E',
    terracotta: '#B76549',
    ochre: '#C39859',
    burgundy: '#773848',
    burgundySeam: '#5F2C38',
  };

  function face(mesh, points, color, normal, tone = 1, doubleSided = false) {
    mesh.push({
      points,
      normal: normal || unit(cross(subtract(points[1], points[0]), subtract(points[2], points[0]))),
      color,
      tone,
      doubleSided,
    });
  }

  function roundedFootprint(width, depth, radius, steps = 3) {
    const r = Math.min(radius, width / 3, depth / 3);
    return Array.from({length: 4}, (_, corner) => {
      const base = corner * Math.PI / 2;
      const centerX = (corner === 0 || corner === 3 ? 1 : -1) * (width / 2 - r);
      const centerZ = (corner < 2 ? 1 : -1) * (depth / 2 - r);
      return Array.from({length: steps + 1}, (_, step) => {
        const angle = base + step * Math.PI / (2 * steps);
        return [centerX + Math.cos(angle) * r, centerZ + Math.sin(angle) * r];
      });
    }).flat();
  }

  function beveled(mesh, center, size, radius, color, bevel = .015) {
    const [width, height, depth] = size;
    const edge = Math.min(bevel, height / 4, radius / 2);
    const ring = (inset, y) => roundedFootprint(width - inset * 2, depth - inset * 2, radius - inset / 2)
      .map(([x, z]) => add(center, [x, y, z]));
    const rings = [
      ring(edge, -height / 2),
      ring(0, -height / 2 + edge),
      ring(0, height / 2 - edge),
      ring(edge, height / 2),
    ];
    face(mesh, [...rings[3]].reverse(), color, [0, 1, 0]);
    face(mesh, rings[0], color, [0, -1, 0]);
    for (let band = 0; band < rings.length - 1; band += 1) {
      for (let i = 0; i < rings[band].length; i += 1) {
        const next = (i + 1) % rings[band].length;
        const points = [rings[band][i], rings[band + 1][i], rings[band + 1][next], rings[band][next]];
        face(mesh, points, color);
      }
    }
  }

  function disc(center, radius, sides, y) {
    return Array.from({length: sides}, (_, index) => {
      const angle = TAU * index / sides;
      return [center[0] + Math.cos(angle) * radius, y, center[1] + Math.sin(angle) * radius];
    });
  }

  function vessel(mesh, center, profile, sides = 22) {
    const rings = profile.map(({radius, y}) => disc(center, radius, sides, y));
    for (let band = 0; band < rings.length - 1; band += 1) {
      for (let i = 0; i < sides; i += 1) {
        const next = (i + 1) % sides;
        const points = [rings[band][i], rings[band + 1][i], rings[band + 1][next], rings[band][next]];
        face(mesh, points, profile[band].color, null, profile[band].tone ?? 1);
      }
    }
  }

  function tube(mesh, nodes, radius, color, sides = 8) {
    const rings = nodes.map((node, index) => {
      const tangent = unit(subtract(nodes[Math.min(nodes.length - 1, index + 1)], nodes[Math.max(0, index - 1)]));
      const across = unit(cross(tangent, Math.abs(tangent[2]) < .87 ? [0, 0, 1] : [0, 1, 0]));
      const around = unit(cross(tangent, across));
      return Array.from({length: sides}, (_, facet) => {
        const angle = TAU * facet / sides;
        const normal = add(scale(across, Math.cos(angle)), scale(around, Math.sin(angle)));
        const point = add(node, scale(normal, Array.isArray(radius) ? radius[index] : radius));
        return {point, normal};
      });
    });
    for (let band = 0; band < rings.length - 1; band += 1) {
      for (let i = 0; i < sides; i += 1) {
        const next = (i + 1) % sides;
        const verts = [rings[band][i], rings[band + 1][i], rings[band + 1][next], rings[band][next]];
        face(mesh, verts.map(({point}) => point), color, unit(verts.map(({normal}) => normal).reduce(add)));
      }
    }
    const last = rings.length - 1;
    face(mesh, rings[0].map(({point}) => point), color, unit(subtract(nodes[0], nodes[1])));
    face(mesh, rings[last].map(({point}) => point), color, unit(subtract(nodes[last], nodes[last - 1])));
  }

  function place(mesh, part, offset, {yaw = 0, pitch = 0, turn = 0} = {}) {
    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    const sp = Math.sin(pitch);
    const cp = Math.cos(pitch);
    const st = Math.sin(turn);
    const ct = Math.cos(turn);
    function rotate([x, y, z]) {
      const tiltedY = y * cp - z * sp;
      const tiltedZ = y * sp + z * cp;
      const worldX = x * cy + tiltedZ * sy;
      const worldZ = -x * sy + tiltedZ * cy;
      return [worldX * ct - tiltedY * st, worldX * st + tiltedY * ct, worldZ];
    }
    part.forEach(panel => mesh.push({
      ...panel,
      normal: rotate(panel.normal),
      points: panel.points.map(point => add(offset, rotate(point))),
    }));
  }

  function stitch(mesh, x0, x1, y, z, length, step, color) {
    for (let x = x0; x + length < x1; x += step) {
      face(mesh, [[x, y, z], [x + length, y, z], [x + length, y + .009, z], [x, y + .009, z]], color, [0, 0, 1]);
    }
  }

  function makeBookSleeve() {
    const mesh = [];
    const sleeve = [];
    beveled(sleeve, [0, -.055, 0], [1.45, .613, .27], .079, colors.blue, .024);
    beveled(sleeve, [0, .279, -.020], [1.245, .092, .177], .028, colors.paper);
    beveled(sleeve, [0, .335, -.02], [1.27, .031, .202], .035, '#A1947F');
    beveled(sleeve, [0, .227, .124], [1.359, .065, .034], .018, '#99A8AD');
    stitch(sleeve, -.64, .657, .199, .147, .026, .051, '#D3D5CE');
    stitch(sleeve, -.64, .657, -.302, .136, .023, .050, '#C3CDC6');
    beveled(sleeve, [.432, -.191, .132], [.22, .133, .038], .036, '#A5785A');
    stitch(sleeve, .352, .521, -.209, .152, .018, .037, '#D7AC81');
    const bookmark = [[-.287,.353,.063],[-.219,.353,.063],[-.209,.245,.157],[-.237,.266,.165],[-.278,.245,.156]];
    face(sleeve, bookmark, '#9A483A', [0, .22, .98], 1, true);
    place(mesh, sleeve, [-.045, .845, -.06], {yaw: -.18, pitch: -.22, turn: -.105});
    return mesh;
  }

  function makeCoffeeSet() {
    const mesh = [];
    const dark = '#3C3932';
    const steel = '#A69B89';
    const press = [-.385, -.145];
    vessel(mesh, press, [
      {radius: .243, y: .47, color: dark},
      {radius: .288, y: .50, color: dark},
      {radius: .282, y: .567, color: '#80604B'},
      {radius: .268, y: .604, color: '#86654A'},
      {radius: .269, y: 1.023, color: '#6D5340'},
      {radius: .282, y: 1.07, color: steel},
      {radius: .295, y: 1.11, color: steel},
      {radius: .265, y: 1.145, color: steel},
      {radius: .034, y: 1.147, color: dark},
      {radius: .037, y: 1.194, color: dark},
      {radius: .095, y: 1.202, color: dark},
      {radius: .104, y: 1.231, color: dark},
      {radius: .083, y: 1.25, color: dark},
    ]);
    face(mesh, disc(press, .083, 22, 1.25).reverse(), dark, [0, 1, 0]);
    tube(mesh, [[-.623,.977,-.016],[-.785,.964,-.018],[-.855,.892,-.015],[-.856,.701,.004],[-.797,.632,.021],[-.636,.628,.029]], .041, dark);
    const cup = [.438, .104];
    vessel(mesh, cup, [
      {radius: .181, y: .474, color: '#B39D82'},
      {radius: .207, y: .504, color: '#D5BE9E'},
      {radius: .227, y: .643, color: '#D5BE9E'},
      {radius: .254, y: .766, color: '#F0DFC3'},
      {radius: .253, y: .792, color: '#EFE0C7'},
      {radius: .221, y: .793, color: '#B79976'},
      {radius: .196, y: .628, color: '#8F6A53'},
      {radius: .159, y: .535, color: '#916D53'},
    ], 24);
    face(mesh, disc(cup, .207, 24, .688).reverse(), '#543727', [0, 1, 0]);
    tube(mesh, [[.650,.737,.106],[.787,.746,.107],[.851,.693,.104],[.855,.623,.098],[.799,.566,.095],[.652,.559,.093]], .038, '#D9BF9C');
    return mesh;
  }

  function makeSketchbook() {
    const mesh = [];
    const book = [];
    const cover = '#B56952';
    beveled(book, [0, 0, 0], [1.306, .106, .883], .048, colors.paper);
    beveled(book, [0, .067, 0], [1.359, .036, .933], .055, cover);
    beveled(book, [0, -.064, 0], [1.355, .029, .932], .047, '#92503F');
    beveled(book, [-.654, .006, 0], [.085, .138, .921], .044, '#9B5743');
    beveled(book, [-.098, .087, -.093], [.626, .011, .073], .020, '#E2A382', .002);
    beveled(book, [-.219, .088, .016], [.385, .013, .029], .011, '#99513E', .003);
    beveled(book, [-.23, .088, .079], [.325, .009, .016], .008, '#99513E', .002);
    beveled(book, [.485, .088, -.002], [.054, .017, .935], .021, '#793E36');
    place(mesh, book, [-.157, .682, -.125], {yaw: -.265, pitch: .26, turn: .075});
    const pencil = [];
    tube(pencil, [[0,0,-.346],[0,0,.319]], .041, '#D5AF6D', 6);
    tube(pencil, [[0,0,.318],[0,0,.399]], [.041,.012], '#E8C897', 6);
    tube(pencil, [[0,0,.398],[0,0,.433]], [.012,.003], '#4A3C34', 6);
    tube(pencil, [[0,0,-.422],[0,0,-.348]], .039, '#A45E5D', 8);
    tube(pencil, [[0,0,-.366],[0,0,-.341]], .043, '#B9A187', 8);
    place(mesh, pencil, [.758, .563, -.087], {yaw: -.307, pitch: -.13});
    return mesh;
  }

  function makePassport() {
    const mesh = [];
    const passport = [];
    const leather = '#793D4B';
    beveled(passport, [0, 0, 0], [.87, .638, .16], .045, '#DCD0AE');
    beveled(passport, [0, 0, .084], [.927, .695, .065], .032, leather, .007);
    beveled(passport, [0, 0, -.087], [.924, .694, .046], .031, '#663743');
    beveled(passport, [-.435, .004, -.006], [.087, .686, .218], .032, '#67333E');
    stitch(passport, -.405, .421, -.286, .123, .012, .035, '#C18B79');
    const gilt = '#CAA16A';
    const emblem = (rx, ry) => Array.from({length: 17}, (_, index) => {
      const a = TAU * index / 16;
      return [.027 + Math.cos(a) * rx, .058 + Math.sin(a) * ry, .123];
    });
    tube(passport, emblem(.114, .102), .005, gilt, 5);
    tube(passport, emblem(.049, .099), .004, gilt, 5);
    tube(passport, [[-.085,.058,.123],[.14,.058,.123]], .005, gilt, 6);
    tube(passport, [[-.060,.002,.123],[.112,.002,.123]], .004, gilt, 6);
    tube(passport, [[-.011,-.148,.123],[.067,-.148,.123]], .005, gilt, 6);
    const ticket = [];
    beveled(ticket, [0, 0, 0], [.61, .493, .027], .013, '#E9D7B3', .003);
    for (const y of [-.11, -.155]) {
      face(ticket, [[-.184,y,.015],[.243,y,.015],[.243,y+.012,.015],[-.184,y+.012,.015]], '#9C7962', [0,0,1]);
    }
    face(ticket, [[-.266,.129,.016],[.272,.129,.016],[.272,.175,.016],[-.266,.175,.016]], '#A5654D', [0,0,1]);
    place(mesh, ticket, [.302, .793, -.223], {yaw: -.256, pitch: -.29, turn: -.305});
    place(mesh, passport, [-.232, .842, -.054], {yaw: -.225, pitch: -.21, turn: .116});
    return mesh;
  }

  function leaf(mesh, base, tip, width, color) {
    const vector = subtract(tip, base);
    const lateral = unit(cross(vector, [0, .13, 1]));
    const middle = add(base, scale(vector, .53));
    const ridge = add(middle, [0, .017, .022]);
    const left = add(middle, scale(lateral, width));
    const right = add(middle, scale(lateral, -width));
    face(mesh, [base, left, tip, ridge], color, null, .9, true);
    face(mesh, [base, ridge, tip, right], color, null, 1.05, true);
  }

  function makeHerbKit() {
    const mesh = [];
    const pots = [
      {x: -.581, z: -.144, y: .482, pot: '#C08A69', leaf: '#778957', height: .521, lean: -.065},
      {x:  .032, z:  .127, y: .460, pot: '#D9C1AA', leaf: '#617C57', height: .385, lean: .045},
      {x:  .599, z: -.235, y: .499, pot: '#9E5545', leaf: '#72844F', height: .458, lean: .084},
    ];
    pots.forEach(({x,z,y,pot,leaf:green,height,lean}, number) => {
      vessel(mesh, [x,z], [
        {radius:.134,y,color:pot,tone:.87},
        {radius:.153,y:y+.023,color:pot},
        {radius:.205,y:y+.242,color:pot},
        {radius:.226,y:y+.255,color:pot},
        {radius:.232,y:y+.286,color:pot,tone:1.08},
        {radius:.215,y:y+.299,color:pot},
        {radius:.186,y:y+.300,color:pot,tone:.79},
        {radius:.173,y:y+.245,color:'#6A4E3D'},
      ], 18);
      face(mesh, disc([x,z], .185, 18, y+.258).reverse(), '#63513B', [0,1,0]);
      const stemStart = [x,y+.263,z];
      const middle = [x+lean*.43,y+.263+height*.49,z-.032];
      const top = [x+lean,y+.263+height,z-.076];
      tube(mesh, [stemStart,middle,top], [.017,.013,.007], '#6B744A', 6);
      for (let level = 0; level < 3; level += 1) {
        const amount = .27 + level * .225;
        const from = add(stemStart, scale(subtract(top, stemStart), amount));
        [-1, 1].forEach(direction => {
          const spread = (number === 1 ? .135 : .18) * (1 - level * .13);
          const end = add(from, [spread * direction, .077 + (direction === 1 ? .019 : 0), .061 + (level % 2 ? -.034 : .024)]);
          leaf(mesh, from, end, (number === 2 ? .036 : .05) * (1 - level * .11), green);
        });
      }
      leaf(mesh, add(top, [0,-.111,.015]), top, .037, '#84915E');
    });
    return mesh;
  }

  function makeBikeKit() {
    const mesh = [];
    const pouch = [];
    const waxed = '#53605E';
    beveled(pouch, [-.045, .002, -.016], [1.27, .476, .394], .151, waxed, .052);
    beveled(pouch, [-.045, .079, .176], [1.16, .286, .045], .055, '#677370', .012);
    beveled(pouch, [-.061, .193, .173], [1.144, .047, .059], .031, '#343E3C');
    stitch(pouch, -.582, .478, .192, .205, .018, .029, '#BDB6A0');
    stitch(pouch, -.57, .478, -.168, .185, .017, .035, '#8D9993');
    beveled(pouch, [.351, .171, .213], [.087, .065, .032], .021, '#917B64');
    tube(pouch, [[.35,.169,.223],[.412,.142,.24],[.418,.095,.244],[.37,.099,.243],[.359,.152,.226]], .010, '#C2A98A', 6);
    beveled(pouch, [-.241, -.038, .200], [.24, .112, .020], .025, '#9A6A52', .003);
    stitch(pouch, -.318, -.138, -.038, .213, .014, .028, '#CC9E7B');
    place(mesh, pouch, [-.291, .726, -.138], {yaw: -.21, pitch: -.18, turn: -.06});

    const levers = [];
    beveled(levers, [.024,.007,-.029], [.107,.045,.602], .039, '#B2644B');
    beveled(levers, [.024,.019,.282], [.151,.069,.101], .039, '#B2644B');
    beveled(levers, [.157,-.008,-.018], [.096,.038,.534], .034, '#D9AE68');
    beveled(levers, [.156,.011,.243], [.127,.065,.091], .037, '#D9AE68');
    place(mesh, levers, [.621,.537,-.03], {yaw: -.36, pitch: -.21, turn: -.02});
    tube(mesh, [[.674,.588,-.384],[.802,.608,-.366],[.913,.639,-.051]], .028, '#ACAB9C', 7);
    tube(mesh, [[.752,.593,-.441],[.884,.613,-.405],[.967,.639,-.171]], .021, '#8D8E83', 7);
    return mesh;
  }

  window.imennoGiftMeshes = {
    'book-case': makeBookSleeve(),
    coffee: makeCoffeeSet(),
    sketchbook: makeSketchbook(),
    passport: makePassport(),
    'herb-kit': makeHerbKit(),
    'bike-kit': makeBikeKit(),
  };
})();
