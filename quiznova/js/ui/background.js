

const CANVAS_SELECTOR = ".ambient-bg__canvas";


const PARTICLE_COLORS = ["167, 139, 250", "34, 211, 238"]; 

const TAU = Math.PI * 2;
const MAX_DEVICE_PIXEL_RATIO = 2; 
const MAX_FRAME_SECONDS = 0.05; 
const RESIZE_DELAY_MS = 150; 
const EDGE_MARGIN = 20; 
const HALO_SCALE = 4; 


let activeBackground = null;

function getParticleCount(viewportWidth) {
  if (viewportWidth < 640) return 22; 
  if (viewportWidth < 1024) return 36; 
  return 50; 
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function createParticle(width, height) {
  const color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
  const alpha = randomBetween(0.4, 0.85);

  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: randomBetween(-12, 12), 
    vy: randomBetween(-34, -10), 
    radius: randomBetween(1, 2.8),
    swayAmount: randomBetween(6, 22), 
    swaySpeed: randomBetween(0.3, 0.9), 
    phase: Math.random() * TAU, 
    coreFill: `rgba(${color}, ${alpha.toFixed(2)})`,
    haloFill: `rgba(${color}, ${(alpha * 0.16).toFixed(3)})`,
  };
}

export function initBackground() {
  if (activeBackground) return true;

  const canvas = document.querySelector(CANVAS_SELECTOR);
  if (!canvas) return false;

  const ctx = canvas.getContext("2d");
  if (!ctx) return false; 
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  let particles = [];
  let width = 0;
  let height = 0;
  let frameId = null;
  let lastTime = 0;
  let elapsed = 0; 
  let resizeTimeoutId = null;


  function shouldAnimate() {
    return !document.hidden && !motionQuery.matches;
  }

  

  function syncParticleCount() {
    const target = getParticleCount(window.innerWidth);

    if (particles.length > target) {
      particles.length = target; 
    }
    while (particles.length < target) {
      particles.push(createParticle(width, height));
    }


    for (const particle of particles) {
      if (particle.x > width) particle.x = Math.random() * width;
      if (particle.y > height) particle.y = Math.random() * height;
    }
  }

  function resizeCanvas() {
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);

    width = canvas.clientWidth; 
    height = canvas.clientHeight;

      canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    syncParticleCount();
  }

 
  function update(deltaSeconds) {
    elapsed += deltaSeconds;

    for (const particle of particles) {
      particle.x += particle.vx * deltaSeconds;
      particle.y += particle.vy * deltaSeconds;

      if (particle.x < -EDGE_MARGIN) particle.x = width + EDGE_MARGIN;
      else if (particle.x > width + EDGE_MARGIN) particle.x = -EDGE_MARGIN;

      if (particle.y < -EDGE_MARGIN) particle.y = height + EDGE_MARGIN;
      else if (particle.y > height + EDGE_MARGIN) particle.y = -EDGE_MARGIN;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    for (const particle of particles) {
  
      const x = particle.x + Math.sin(elapsed * particle.swaySpeed + particle.phase) * particle.swayAmount;
      const y = particle.y;

      // Soft halo first (larger and very faint), then the bright core on top
      ctx.fillStyle = particle.haloFill;
      ctx.beginPath();
      ctx.arc(x, y, particle.radius * HALO_SCALE, 0, TAU);
      ctx.fill();

      ctx.fillStyle = particle.coreFill;
      ctx.beginPath();
      ctx.arc(x, y, particle.radius, 0, TAU);
      ctx.fill();
    }
  }


  function frame(now) {
 
    const deltaSeconds = Math.min((now - lastTime) / 1000, MAX_FRAME_SECONDS);
    lastTime = now;

    update(deltaSeconds);
    draw();

    frameId = requestAnimationFrame(frame); 
  }

  function start() {
    if (frameId !== null || !shouldAnimate()) return; 
    frameId = requestAnimationFrame(frame);
  }

  function stop() {
    if (frameId === null) return;
    cancelAnimationFrame(frameId);
    frameId = null;
  }

  

  function handleVisibilityChange() {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  }

  function handleMotionPreferenceChange() {
    if (motionQuery.matches) {
      stop();
      ctx.clearRect(0, 0, width, height); // reduced motion: no particles at all
    } else {
      start();
    }
  }

  function handleResize() {
    window.clearTimeout(resizeTimeoutId);
    resizeTimeoutId = window.setTimeout(resizeCanvas, RESIZE_DELAY_MS);
  }



  function destroy() {
    stop();
    window.clearTimeout(resizeTimeoutId);
    window.removeEventListener("resize", handleResize);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    motionQuery.removeEventListener("change", handleMotionPreferenceChange);
    ctx.clearRect(0, 0, width, height);
    activeBackground = null;
  }



  window.addEventListener("resize", handleResize);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  motionQuery.addEventListener("change", handleMotionPreferenceChange);

  resizeCanvas();
  start(); 
  activeBackground = { destroy };
  return true;
}

export function destroyBackground() {
  if (activeBackground) activeBackground.destroy();
}