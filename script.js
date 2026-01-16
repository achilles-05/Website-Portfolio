// ============================================
// GSAP REGISTRATION
// ============================================
gsap.registerPlugin(ScrollTrigger, TextPlugin);

// ============================================
// ============================================
// SCIENTIFIC EARTH VISUALIZATION - OPTIMIZED NETWORK MODEL
// ============================================
let scene, camera, renderer, earthGroup;
let time = 0;

function initEarth() {
  const canvas = document.getElementById('earth-canvas');

  // Scene
  scene = new THREE.Scene();
  // Add some fog for depth fading
  scene.fog = new THREE.FogExp2(0x000000, 0.08);

  // Camera
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.z = 2.8;

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true, // Re-enable antialias as we are optimizing elsewhere
    powerPreference: "high-performance"
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Main structural group that controls rotation
  earthGroup = new THREE.Group();
  scene.add(earthGroup);

  // 1. EARTH SPHERE (Dark, Minimalist)
  const earthGeometry = new THREE.SphereGeometry(1, 64, 64);
  const earthMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x050505,       // Near black
    roughness: 0.8,
    metalness: 0.2,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  });
  const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
  earthGroup.add(earthMesh);

  // 1.5 ATMOSPHERE GLOW (Subtle rim light)
  const atmoGeometry = new THREE.SphereGeometry(1.0, 64, 64);
  const atmoMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 4.0);
        gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity * 0.8;
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true
  });
  const atmo = new THREE.Mesh(atmoGeometry, atmoMaterial);
  atmo.scale.set(1.2, 1.2, 1.2);
  scene.add(atmo); // Add to scene, not group, so it stays oriented to camera

  // 2. NETWORK NODES (Instanced Mesh for high performance)
  const nodeCount = 1200;
  const nodeGeometry = new THREE.SphereGeometry(0.006, 8, 8);
  const nodeMaterial = new THREE.MeshBasicMaterial({
    color: 0x4aa0ff,
  });
  const nodeMesh = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, nodeCount);

  const dummy = new THREE.Object3D();
  const nodePositions = []; // Store for line creation

  for (let i = 0; i < nodeCount; i++) {
    // Phi = acos(-1 to 1), Theta = 0 to 2PI
    const phi = Math.acos(-1 + (2 * i) / nodeCount);
    const theta = Math.sqrt(nodeCount * Math.PI) * phi;

    const r = 1.005; // Slightly above surface
    const x = r * Math.cos(theta) * Math.sin(phi);
    const y = r * Math.sin(theta) * Math.sin(phi);
    const z = r * Math.cos(phi);

    dummy.position.set(x, y, z);
    dummy.updateMatrix();
    nodeMesh.setMatrixAt(i, dummy.matrix);

    nodePositions.push(new THREE.Vector3(x, y, z));
  }

  earthGroup.add(nodeMesh);

  // 3. NETWORK CONNECTIONS (Static Lines)
  // We use LineSegments for batch rendering thousands of lines efficiently
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x245580,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending
  });

  const linePoints = [];
  // Connect close nodes
  for (let i = 0; i < nodeCount; i++) {
    const p1 = nodePositions[i];
    let connections = 0;

    // Check next few nodes (optimization based on index proximity often correlating with spatial for fibonacci sphere,
    // but brute force is fine for init only 1200^2 is too much, so we limit search window or just random sample)

    // Simple nearest neighbor approximate by checking random subset
    for (let j = 0; j < 30; j++) {
      const idx = (i + Math.floor(Math.random() * 200) - 100 + nodeCount) % nodeCount;
      if (i === idx) continue;

      const p2 = nodePositions[idx];
      const dist = p1.distanceTo(p2);

      if (dist < 0.35) { // Connection threshold
        linePoints.push(p1);
        linePoints.push(p2);
        connections++;
      }
      if (connections > 4) break; // Limit connections per node
    }
  }
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  earthGroup.add(lines);

  // 4. ACTIVE DATA ARCS (Dynamic animated glowing lines)
  const arcCount = 30;
  const arcLines = [];

  function createArc(p1, p2, color, altitude) {
    const points = [];
    const segments = 40;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      // Slerp-like interpolation for Great Circle
      const angle = p1.angleTo(p2);

      const v = new THREE.Vector3().copy(p1).lerp(p2, t).normalize();

      // Add height arc
      const height = 1.0 + altitude * Math.sin(t * Math.PI);
      v.multiplyScalar(height);

      points.push(v);
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.0,
      linewidth: 2 // Note: GL only renders width 1 usually
    });

    const mesh = new THREE.Line(geometry, material);
    mesh.userData = {
      phase: Math.random() * Math.PI * 2,
      speed: 0.002 + Math.random() * 0.003
    };
    return mesh;
  }

  // Create random long distance arcs
  for (let i = 0; i < arcCount; i++) {
    const i1 = Math.floor(Math.random() * nodeCount);
    const i2 = Math.floor(Math.random() * nodeCount);
    if (i1 !== i2) {
      const dist = nodePositions[i1].distanceTo(nodePositions[i2]);
      if (dist > 1.0) { // Only long arcs
        const arc = createArc(
          nodePositions[i1],
          nodePositions[i2],
          0x66ccff,
          0.1 + dist * 0.2
        );
        earthGroup.add(arc);
        arcLines.push(arc);
      }
    }
  }

  // 5. MOUSE INTERACTION STATE
  let targetRotationX = 0;
  let targetRotationY = 0;
  let mouseX = 0;
  let mouseY = 0;

  const windowHalfX = window.innerWidth / 2;
  const windowHalfY = window.innerHeight / 2;

  document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX - windowHalfX) * 0.001;
    mouseY = (event.clientY - windowHalfY) * 0.001;
  });

  // 6. STARS BACKGROUND (Interactive)
  const starsGeometry = new THREE.BufferGeometry();
  const starCount = 1500;
  const starsMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.025,
    transparent: true,
    opacity: 0.8, // More visible
    sizeAttenuation: true
  });

  const starsVertices = [];
  const starsInitialPositions = [];
  const starVelocities = [];

  for (let i = 0; i < starCount; i++) {
    const x = (Math.random() - 0.5) * 25;
    const y = (Math.random() - 0.5) * 25;
    const z = (Math.random() - 0.5) * 10 - 5; // Background layer
    starsVertices.push(x, y, z);
    starsInitialPositions.push({ x, y, z });
    starVelocities.push({ x: 0, y: 0, z: 0 });
  }

  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
  const stars = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(stars);

  // Minimal scientific lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambientLight);

  // ANIMATION LOOP
  function animate() {
    requestAnimationFrame(animate);

    time += 0.005;

    // 1. Rotation Interaction (Smooth lerp) - SLOWER
    targetRotationY += 0.0005; // Very slow auto rotation

    // Apply rotation to group - REDUCED SENSITIVITY
    earthGroup.rotation.y += 0.0008;
    earthGroup.rotation.y += (mouseX * 0.08); // Reduced from 0.5 to 0.08
    earthGroup.rotation.x += (mouseY * 0.05 - earthGroup.rotation.x) * 0.05;

    // 2. Pulse active arcs
    arcLines.forEach(line => {
      const pulse = Math.sin(time * 5 + line.userData.phase);
      line.material.opacity = Math.max(0, pulse);
    });

    // 3. Pulse network lines
    lineMaterial.opacity = 0.15 + Math.sin(time * 2) * 0.05;

    // 4. Star Ripple Effect
    const positions = stars.geometry.attributes.position.array;

    // Map mouse to world space roughly
    const cursorWorldX = mouseX * 15;
    const cursorWorldY = -mouseY * 10;

    for (let i = 0; i < starCount; i++) {
      const px = starsInitialPositions[i].x;
      const py = starsInitialPositions[i].y;

      // Calculate distance to cursor
      const dx = cursorWorldX - px;
      const dy = cursorWorldY - py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Ripple radius
      if (dist < 3.0) {
        const force = (3.0 - dist) * 0.02;
        starVelocities[i].x -= (dx / dist) * force;
        starVelocities[i].y -= (dy / dist) * force;
      }

      // Damping and Return
      starVelocities[i].x *= 0.95;
      starVelocities[i].y *= 0.95;

      const currentX = positions[i * 3];
      const currentY = positions[i * 3 + 1];

      positions[i * 3] += starVelocities[i].x + (starsInitialPositions[i].x - currentX) * 0.02;
      positions[i * 3 + 1] += starVelocities[i].y + (starsInitialPositions[i].y - currentY) * 0.02;
    }
    stars.geometry.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  }

  animate();

  // Resize Handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// Initialize when page loads
if (typeof THREE !== 'undefined') {
  initEarth();
} else {
  // Wait for Three.js to load if it hasn't yet
  window.addEventListener('load', () => {
    if (typeof THREE !== 'undefined') initEarth();
  });
}

// ============================================
// FLOWING DOTS CURSOR SYSTEM
// ============================================
const cursorDotsContainer = document.querySelector('.cursor-dots-container');
const cursorDot = document.querySelector('.cursor-dot');

let dots = [];
const dotCount = 12;
let mouseXPos = 0;
let mouseYPos = 0;
let dotXPos = 0;
let dotYPos = 0;

// Create flowing dots
for (let i = 0; i < dotCount; i++) {
  const dot = document.createElement('div');
  dot.className = 'cursor-dot-trail';
  // Maximum opacity and slower fade for better visibility
  dot.style.opacity = (dotCount - i) / dotCount * 1.0;
  // Add some scale variation
  dot.style.transform = `scale(${1 - (i / dotCount) * 0.5})`;
  cursorDotsContainer.appendChild(dot);
  dots.push({
    element: dot,
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0
  });
}

document.addEventListener('mousemove', (e) => {
  mouseXPos = e.clientX;
  mouseYPos = e.clientY;
});

document.addEventListener('mouseleave', () => {
  dots.forEach(dot => {
    dot.element.style.opacity = '0';
  });
});

function animateCursor() {
  // Main dot follows immediately
  dotXPos += (mouseXPos - dotXPos) * 0.3;
  dotYPos += (mouseYPos - dotYPos) * 0.3;
  cursorDot.style.left = dotXPos + 'px';
  cursorDot.style.top = dotYPos + 'px';

  // Flowing dots follow with delay
  dots.forEach((dot, index) => {
    if (index === 0) {
      dot.targetX = dotXPos;
      dot.targetY = dotYPos;
    } else {
      dot.targetX = dots[index - 1].x;
      dot.targetY = dots[index - 1].y;
    }

    dot.x += (dot.targetX - dot.x) * 0.2;
    dot.y += (dot.targetY - dot.y) * 0.2;

    dot.element.style.left = dot.x + 'px';
    dot.element.style.top = dot.y + 'px';
    dot.element.style.opacity = ((dotCount - index) / dotCount * 0.5).toString();
  });

  requestAnimationFrame(animateCursor);
}

animateCursor();

// Cursor hover effects
const interactiveElements = document.querySelectorAll('a, button, .btn, .project-card, .skill-category, .nav-link, input, textarea, .timeline-item, .achievement-card');

interactiveElements.forEach(el => {
  el.addEventListener('mouseenter', () => {
    document.body.classList.add('cursor-hover');
    dots.forEach(dot => {
      dot.element.style.opacity = '0.8';
    });
  });
  el.addEventListener('mouseleave', () => {
    document.body.classList.remove('cursor-hover');
    dots.forEach((dot, index) => {
      dot.element.style.opacity = ((dotCount - index) / dotCount * 0.5).toString();
    });
  });
});

// Text cursor
const textElements = document.querySelectorAll('input, textarea');
textElements.forEach(el => {
  el.addEventListener('focus', () => {
    document.body.classList.add('cursor-text');
  });
  el.addEventListener('blur', () => {
    document.body.classList.remove('cursor-text');
  });
});

document.addEventListener('mousedown', () => {
  document.body.classList.add('cursor-click');
});

document.addEventListener('mouseup', () => {
  document.body.classList.remove('cursor-click');
});

// ============================================
// NAVIGATION
// ============================================
const navbar = document.querySelector('.navbar');
const navLinks = document.querySelectorAll('.nav-link');
const hamburger = document.querySelector('.hamburger');
const navLinksContainer = document.querySelector('.nav-links');

// Navbar scroll effect
window.addEventListener('scroll', () => {
  if (window.scrollY > 100) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

// Active nav link on scroll
const sections = document.querySelectorAll('section[id]');

function setActiveNavLink() {
  const scrollY = window.pageYOffset;

  sections.forEach(section => {
    const sectionHeight = section.offsetHeight;
    const sectionTop = section.offsetTop - 100;
    const sectionId = section.getAttribute('id');

    if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${sectionId}`) {
          link.classList.add('active');
        }
      });
    }
  });
}

window.addEventListener('scroll', setActiveNavLink);

// Smooth scroll for nav links
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const targetId = link.getAttribute('href');
    const targetSection = document.querySelector(targetId);

    if (targetSection) {
      targetSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }

    navLinksContainer.classList.remove('active');
    hamburger.classList.remove('active');
  });
});

// Mobile menu toggle
hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  navLinksContainer.classList.toggle('active');
});

// ============================================
// HERO ANIMATIONS
// ============================================
const typingText = document.querySelector('.typing-text');
const typingWords = [
  'Aerospace Engineer',
  'CFD Specialist',
  'Robotics Enthusiast',
  'Research Scholar'
];
let wordIndex = 0;
let charIndex = 0;
let isDeleting = false;

function typeEffect() {
  const currentWord = typingWords[wordIndex];

  if (isDeleting) {
    typingText.textContent = currentWord.substring(0, charIndex - 1);
    charIndex--;
  } else {
    typingText.textContent = currentWord.substring(0, charIndex + 1);
    charIndex++;
  }

  let typeSpeed = isDeleting ? 50 : 100;

  if (!isDeleting && charIndex === currentWord.length) {
    typeSpeed = 2000;
    isDeleting = true;
  } else if (isDeleting && charIndex === 0) {
    isDeleting = false;
    wordIndex = (wordIndex + 1) % typingWords.length;
    typeSpeed = 500;
  }

  setTimeout(typeEffect, typeSpeed);
}

setTimeout(() => {
  typeEffect();
}, 2000);

// ============================================
// SCROLL ANIMATIONS WITH GSAP
// ============================================
gsap.utils.toArray('.section').forEach(section => {
  gsap.from(section, {
    opacity: 0,
    y: 80,
    duration: 1,
    scrollTrigger: {
      trigger: section,
      start: 'top 85%',
      end: 'bottom 20%',
      toggleActions: 'play none none reverse'
    }
  });
});

// Animate skill categories
gsap.utils.toArray('.skill-category').forEach((card, i) => {
  gsap.from(card, {
    opacity: 0,
    x: -50,
    duration: 0.8,
    delay: i * 0.1,
    scrollTrigger: {
      trigger: card,
      start: 'top 85%'
    }
  });
});

// Animate project cards with stagger
gsap.utils.toArray('.project-card').forEach((card, i) => {
  gsap.from(card, {
    opacity: 0,
    scale: 0.9,
    y: 50,
    duration: 0.8,
    delay: i * 0.1,
    scrollTrigger: {
      trigger: card,
      start: 'top 85%'
    }
  });
});

// Animate timeline items
gsap.utils.toArray('.timeline-item').forEach((item, i) => {
  gsap.from(item, {
    opacity: 0,
    x: -50,
    duration: 0.8,
    delay: i * 0.15,
    scrollTrigger: {
      trigger: item,
      start: 'top 85%'
    }
  });
});

// Animate achievement cards
gsap.utils.toArray('.achievement-card').forEach((card, i) => {
  gsap.from(card, {
    opacity: 0,
    y: 50,
    scale: 0.9,
    duration: 0.8,
    delay: i * 0.1,
    scrollTrigger: {
      trigger: card,
      start: 'top 85%'
    }
  });
});


// ============================================
// STAT COUNTER ANIMATION
// ============================================
const statNumbers = document.querySelectorAll('.stat-number');

function animateCounter(element) {
  const target = parseInt(element.getAttribute('data-target'));
  const duration = 2000;
  const increment = target / (duration / 16);
  let current = 0;

  const updateCounter = () => {
    current += increment;
    if (current < target) {
      element.textContent = Math.floor(current);
      requestAnimationFrame(updateCounter);
    } else {
      element.textContent = target;
    }
  };

  updateCounter();
}

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter(entry.target);
      statsObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

statNumbers.forEach(stat => {
  statsObserver.observe(stat);
});

// ============================================
// INTERACTIVE ELEMENTS
// ============================================
// Add hover effects to cards
document.querySelectorAll('.project-card, .achievement-card, .skill-category').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = (y - centerY) / 10;
    const rotateY = (centerX - x) / 10;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px)`;
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });
});

// Add ripple effect to buttons
document.querySelectorAll('.btn').forEach(btn => {
  btn.addEventListener('click', function (e) {
    const ripple = document.createElement('span');
    const rect = this.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple');

    this.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 600);
  });
});

// ============================================
// FORM HANDLING
// ============================================
const contactForm = document.querySelector('.contact-form');

contactForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const button = contactForm.querySelector('.btn');
  const originalText = button.querySelector('span').textContent;
  button.querySelector('span').textContent = 'Message Sent!';
  button.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';

  setTimeout(() => {
    button.querySelector('span').textContent = originalText;
    button.style.background = '';
    contactForm.reset();
  }, 3000);
});

// ============================================
// SMOOTH SCROLL FOR ALL ANCHOR LINKS
// ============================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href !== '#' && href.length > 1) {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }
  });
});

// ============================================
// PERFORMANCE OPTIMIZATION
// ============================================
let ticking = false;

function updateOnScroll() {
  setActiveNavLink();
  ticking = false;
}

window.addEventListener('scroll', () => {
  if (!ticking) {
    window.requestAnimationFrame(updateOnScroll);
    ticking = true;
  }
});

// ============================================
// INITIALIZE ON LOAD
// ============================================
window.addEventListener('load', () => {
  setActiveNavLink();

  // Hide cursor on mobile
  if (window.innerWidth <= 768) {
    cursorDot.style.display = 'none';
    cursorRing.style.display = 'none';
    cursorTrail.style.display = 'none';
    document.body.style.cursor = 'auto';
  }

  // Add loaded class for animations
  document.body.classList.add('loaded');
});

// ============================================
// KEYBOARD NAVIGATION
// ============================================
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    navLinksContainer.classList.remove('active');
    hamburger.classList.remove('active');
  }
});

// ============================================
// ADDITIONAL INTERACTIVE EFFECTS
// ============================================
// Magnetic effect for buttons
document.querySelectorAll('.btn, .social-link, .project-link').forEach(element => {
  element.addEventListener('mousemove', (e) => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    gsap.to(element, {
      x: x * 0.2,
      y: y * 0.2,
      duration: 0.3,
      ease: 'power2.out'
    });
  });

  element.addEventListener('mouseleave', () => {
    gsap.to(element, {
      x: 0,
      y: 0,
      duration: 0.3,
      ease: 'power2.out'
    });
  });
});

// Enhanced Earth texture loading with better fallback
function loadEarthTexture() {
  const loader = new THREE.TextureLoader();

  // Try to load Earth texture
  loader.load(
    'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
    (texture) => {
      if (earth && earth.material) {
        earth.material.map = texture;
        earth.material.needsUpdate = true;
      }
    },
    undefined,
    () => {
      // Fallback: Create procedural Earth
      console.log('Using procedural Earth');
      if (earth && earth.material) {
        earth.material.color.setHex(0x2233ff);
        earth.material.emissive.setHex(0x112244);
      }
    }
  );
}

// Call after Earth is created
if (typeof THREE !== 'undefined') {
  setTimeout(loadEarthTexture, 1000);
}
