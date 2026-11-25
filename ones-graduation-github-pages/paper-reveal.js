const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const smoothstep = (value) => value * value * (3 - 2 * value);

function createPaperRenderer(canvas, image) {
  const context = canvas.getContext('2d');
  if (!context) return null;
  const input = document.createElement('canvas');
  input.width = 512;
  input.height = Math.round(input.width * image.naturalHeight / image.naturalWidth);
  const texture = input.getContext('2d', { willReadFrequently: true });
  if (!texture) return null;
  texture.drawImage(image, 0, 0, input.width, input.height);
  const pixels = texture.getImageData(0, 0, input.width, input.height).data;

  const across = 31;
  const down = 39;
  const aspect = image.naturalHeight / image.naturalWidth;
  const vertices = [];
  const triangles = [];
  for (let row = 0; row <= down; row += 1) {
    for (let column = 0; column <= across; column += 1) {
      const shiftX = column > 0 && column < across ? Math.sin(column * 8.97 + row * 4.2) * 0.23 : 0;
      const shiftY = row > 0 && row < down ? Math.sin(row * 9.39 - column * 3.7) * 0.23 : 0;
      const u = (column + shiftX) / across;
      const v = (row + shiftY) / down;
      const x = u - 0.5;
      const y = (0.5 - v) * aspect;

      vertices.push({
        u, v,
        flatX: x, flatY: y,
        offset: (u * 0.35 + v * 0.65) * 0.19,
        foldedX: x * 0.19 + 0.048 * Math.sin(y * 32 + x * 16) + 0.025 * Math.sin(y * 53 - x * 38),
        foldedY: y * 0.16 + 0.037 * Math.sin(x * 42 + y * 21) - 0.026 * Math.sin(y * 39 + x * 10),
        foldedZ: 0.071 * Math.sin(x * 26 + y * 14) * Math.cos(y * 32 - x * 12) + 0.037 * Math.sin(x * 43 + y * 35),
        bend: 0.055 * Math.sin(y * 13 - x * 5) + 0.027 * Math.sin(x * 20 + y * 17),
        lift: 0.042 * Math.cos(x * 16 + y * 9),
      });
      if (row < down && column < across) {
        const top = row * (across + 1) + column;
        const bottom = top + across + 1;
        triangles.push(top, bottom, top + 1, top + 1, bottom, bottom + 1);
      }
    }
  }

  let buffer;
  let depth;
  const backColor = [240, 232, 220];

  function project(vertex, progress, width, height) {
    const unfold = smoothstep(clamp((progress - vertex.offset) / (1 - vertex.offset), 0, 1));
    const fold = 1 - unfold;
    const ripple = Math.sin(unfold * Math.PI);
    const x = vertex.foldedX * fold + vertex.flatX * unfold;
    const y = vertex.foldedY * fold + vertex.flatY * unfold + vertex.lift * ripple;
    const angle = -0.23 * fold + ripple * 0.07;
    vertex.x = x * Math.cos(angle) - y * Math.sin(angle);
    vertex.y = x * Math.sin(angle) + y * Math.cos(angle);
    vertex.z = vertex.foldedZ * fold + vertex.bend * ripple;

    const perspective = 1 - vertex.z * 0.45;
    vertex.screenX = width * (0.5 + vertex.x / perspective);
    vertex.screenY = height * (0.5 - vertex.y / (aspect * perspective));
  }

  function drawTriangle(a, b, c, strength, width, height) {
    const bx = b.screenX - a.screenX;
    const by = b.screenY - a.screenY;
    const cx = c.screenX - a.screenX;
    const cy = c.screenY - a.screenY;
    const area = bx * cy - by * cx;
    if (Math.abs(area) < 0.001) return;

    const left = Math.max(0, Math.floor(Math.min(a.screenX, b.screenX, c.screenX)));
    const right = Math.min(width - 1, Math.ceil(Math.max(a.screenX, b.screenX, c.screenX)));
    const top = Math.max(0, Math.floor(Math.min(a.screenY, b.screenY, c.screenY)));
    const bottom = Math.min(height - 1, Math.ceil(Math.max(a.screenY, b.screenY, c.screenY)));
    const normalX = (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y);
    const normalY = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
    const normalZ = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const normalLength = Math.hypot(normalX, normalY, normalZ) || 1;
    const front = area < 0;
    const facing = front ? 1 : -1;
    const lamp = Math.max(0, (-0.47 * normalX + 0.58 * normalY + 0.68 * normalZ) * facing / normalLength);
    const lighting = 1 + (0.51 + lamp * 0.54 - 1) * strength;
    const ink = front ? lighting : 0.37 * lighting;
    const paper = front ? 0 : 0.63 * lighting;
    const stepB = cy / area;
    const stepC = -by / area;

    for (let y = top; y <= bottom; y += 1) {
      const row = y + 0.5 - a.screenY;
      const first = left + 0.5 - a.screenX;
      let weightB = (first * cy - row * cx) / area;
      let weightC = (bx * row - by * first) / area;
      for (let x = left; x <= right; x += 1, weightB += stepB, weightC += stepC) {
        const weightA = 1 - weightB - weightC;
        if (Math.min(weightA, weightB, weightC) < -0.00009) continue;
        const point = y * width + x;
        const z = weightA * a.z + weightB * b.z + weightC * c.z;
        if (z < depth[point]) continue;
        depth[point] = z;

        const u = clamp(Math.round((weightA * a.u + weightB * b.u + weightC * c.u) * (input.width - 1)), 0, input.width - 1);
        const v = clamp(Math.round((weightA * a.v + weightB * b.v + weightC * c.v) * (input.height - 1)), 0, input.height - 1);
        const pixel = (v * input.width + u) * 4;
        const target = point * 4;
        buffer.data[target] = pixels[pixel] * ink + backColor[0] * paper;
        buffer.data[target + 1] = pixels[pixel + 1] * ink + backColor[1] * paper;
        buffer.data[target + 2] = pixels[pixel + 2] * ink + backColor[2] * paper;
        buffer.data[target + 3] = 255;
      }
    }
  }

  return {
    draw(progress) {
      const { width, height } = canvas;
      if (!buffer || buffer.width !== width || buffer.height !== height) {
        buffer = context.createImageData(width, height);
        depth = new Float32Array(width * height);
      }
      buffer.data.fill(0);
      depth.fill(-Infinity);
      vertices.forEach((vertex) => project(vertex, progress, width, height));
      const strength = 1 - smoothstep(clamp((progress - 0.53) / 0.47, 0, 1));
      for (let index = 0; index < triangles.length; index += 3) {
        drawTriangle(vertices[triangles[index]], vertices[triangles[index + 1]], vertices[triangles[index + 2]], strength, width, height);
      }
      context.putImageData(buffer, 0, 0);
    },
    dispose() {
      canvas.width = 1;
      canvas.height = 1;
    },
  };
}

export function initPaperReveal(stage, motionPreference) {
  if (motionPreference.matches) return;

  const image = stage.querySelector('.letter-stage__image');
  const canvas = stage.querySelector('canvas');
  const trigger = stage.querySelector('.letter-stage__trigger');
  let entered = false;
  let ready = false;
  let finished = false;
  let renderer;
  let frame;
  let value = 0;

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    stage.dataset.paperState = 'open';
    resize.disconnect();
    prepareObserver.disconnect();
    revealObserver.disconnect();
    renderer?.dispose();
  }

  function sizeCanvas() {
    const ratio = Math.min(1, 470 / Math.max(stage.clientWidth, 1));
    canvas.width = Math.max(1, Math.round(stage.clientWidth * ratio));
    canvas.height = Math.max(1, Math.round(stage.clientHeight * ratio));
    renderer?.draw(value);
  }

  function unfold() {
    if (!entered || !ready || finished || stage.dataset.paperState === 'unfolding') return;
    stage.dataset.paperState = 'unfolding';
    if (!renderer) {
      window.setTimeout(finish, 1580);
      return;
    }

    let started;
    let lastFrame = 0;
    function step(now) {
      started ??= now;
      value = Math.min(1, Math.max(0, (now - started - 140) / 1420));
      if (!lastFrame || now - lastFrame >= 28 || value === 1) {
        renderer.draw(value);
        lastFrame = now;
      }
      if (value === 1) finish();
      else frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
  }

  async function prepare() {
    try {
      await image.decode();
    } catch {
      finish();
      return;
    }
    if (finished) return;
    try {
      renderer = createPaperRenderer(canvas, image);
    } catch {
      renderer = null;
    }
    stage.dataset.paperMode = renderer ? 'mesh' : 'css';
    stage.dataset.paperState = 'crumpled';
    if (renderer) {
      resize.observe(stage);
      sizeCanvas();
    }
    ready = true;
    unfold();
  }

  const resize = new ResizeObserver(sizeCanvas);
  const prepareObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    prepareObserver.disconnect();
    prepare();
  }, { rootMargin: '650px 0px' });
  const revealObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    entered = true;
    revealObserver.disconnect();
    unfold();
  }, { rootMargin: '0px 0px -11% 0px' });
  prepareObserver.observe(stage);
  revealObserver.observe(trigger);
  motionPreference.addEventListener('change', () => {
    if (motionPreference.matches) finish();
  });
}
