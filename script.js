// ============================================
// GSAP REGISTRATION
// ============================================
gsap.registerPlugin(ScrollTrigger, TextPlugin);

// ============================================
// SCIENTIFIC EARTH VISUALIZATION - CFD + NETWORK MODEL
// ============================================
let scene, camera, renderer, earth, dataNodes = [], connections = [], flowLines = [], orbitalRings = [];
let time = 0;

function initEarth() {
  const canvas = document.getElementById('earth-canvas');
  
  // Scene
  scene = new THREE.Scene();
  
  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 2.5;
  
  // Renderer - HEAVILY OPTIMIZED
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: false, // Disable antialiasing for performance
    powerPreference: "high-performance",
    logarithmicDepthBuffer: false
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Further cap pixel ratio
  renderer.sortObjects = false; // Disable sorting for performance
  
  // Matte dark Earth sphere - no texture, pure mathematical representation - HEAVILY OPTIMIZED
  const earthGeometry = new THREE.SphereGeometry(1, 32, 32); // Further reduced for performance
  const earthMaterial = new THREE.MeshStandardMaterial({
    color: '#0a0f1a',
    metalness: 0.0,
    roughness: 1.0,
    emissive: '#000000',
    emissiveIntensity: 0
  });
  
  earth = new THREE.Mesh(earthGeometry, earthMaterial);
  scene.add(earth);
  
  // Create data nodes on sphere surface - Network nodes
  const nodeCount = 600; // Increased for better network coverage
  const nodeGeometry = new THREE.SphereGeometry(0.01, 6, 6);
  const nodeMaterial = new THREE.MeshBasicMaterial({
    color: '#2c5f8d',
    emissive: '#4a7ba7',
    emissiveIntensity: 1.5
  });
  
  // Use instanced rendering for performance
  const nodeInstances = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, nodeCount);
  const nodeMatrix = new THREE.Matrix4();
  const nodePositions = [];
  
  for (let i = 0; i < nodeCount; i++) {
    // Uniform distribution on sphere surface
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const radius = 1.005; // Slightly above surface
    
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    
    nodeMatrix.setPosition(x, y, z);
    nodeInstances.setMatrixAt(i, nodeMatrix);
    
    nodePositions.push({
      basePosition: new THREE.Vector3(x, y, z),
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.3 + Math.random() * 0.4,
      index: i
    });
  }
  nodeInstances.instanceMatrix.needsUpdate = true;
  scene.add(nodeInstances);
  
  // Store node data
  dataNodes.push({ mesh: nodeInstances, positions: nodePositions });
  
  // Create connections - bright glowing lines wrapping smoothly along sphere
  const connectionMaterial = new THREE.LineBasicMaterial({
    color: '#4a7ba7',
    transparent: true,
    opacity: 0.6, // Much brighter for visibility
    linewidth: 1
  });
  
  // Connect nearby nodes with curved geodesic paths - Network connections
  const maxConnections = 800; // Increased for better network appearance
  let connectionCount = 0;
  
  for (let i = 0; i < nodePositions.length && connectionCount < maxConnections; i++) {
    for (let j = i + 1; j < nodePositions.length && connectionCount < maxConnections; j++) {
      const pos1 = nodePositions[i].basePosition;
      const pos2 = nodePositions[j].basePosition;
      const distance = pos1.distanceTo(pos2);
      
      // Connect nodes within certain distance - create dense network
      if (distance < 0.5 && Math.random() > 0.85) { // More connections
        // Create smooth curved path along sphere surface (great circle arc)
        const points = [];
        const steps = 15; // Smooth curves
        
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          // Interpolate along great circle for smooth wrapping
          const angle = Math.acos(pos1.dot(pos2));
          const sinAngle = Math.sin(angle);
          if (sinAngle < 0.001) continue;
          
          const a = Math.sin((1 - t) * angle) / sinAngle;
          const b = Math.sin(t * angle) / sinAngle;
          const point = new THREE.Vector3()
            .addScaledVector(pos1, a)
            .addScaledVector(pos2, b)
            .normalize()
            .multiplyScalar(1.004); // Slightly above surface
          
          points.push(point);
        }
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, connectionMaterial.clone());
        line.userData = {
          node1: i,
          node2: j,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.5 + Math.random() * 0.5
        };
        scene.add(line);
        connections.push(line);
        connectionCount++;
      }
    }
  }
  
  // Add long-distance curved arcs connecting distant regions (intercontinental links)
  const longArcMaterial = new THREE.LineBasicMaterial({
    color: '#6b9bd1',
    transparent: true,
    opacity: 0.7,
    linewidth: 1.5
  });
  
  const longArcCount = 20;
  for (let i = 0; i < longArcCount; i++) {
    // Pick two distant nodes
    const idx1 = Math.floor(Math.random() * nodePositions.length);
    let idx2 = Math.floor(Math.random() * nodePositions.length);
    let attempts = 0;
    
    // Ensure they're far apart (intercontinental distance)
    while (nodePositions[idx1].basePosition.distanceTo(nodePositions[idx2].basePosition) < 1.2 && attempts < 10) {
      idx2 = Math.floor(Math.random() * nodePositions.length);
      attempts++;
    }
    
    const pos1 = nodePositions[idx1].basePosition;
    const pos2 = nodePositions[idx2].basePosition;
    
    // Create smooth long arc
    const arcPoints = [];
    const arcSteps = 25;
    
    for (let k = 0; k <= arcSteps; k++) {
      const t = k / arcSteps;
      const angle = Math.acos(pos1.dot(pos2));
      const sinAngle = Math.sin(angle);
      if (sinAngle < 0.001) continue;
      
      const a = Math.sin((1 - t) * angle) / sinAngle;
      const b = Math.sin(t * angle) / sinAngle;
      const point = new THREE.Vector3()
        .addScaledVector(pos1, a)
        .addScaledVector(pos2, b)
        .normalize()
        .multiplyScalar(1.006); // Further above surface for visibility
      
      arcPoints.push(point);
    }
    
    const arcGeometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
    const arcLine = new THREE.Line(arcGeometry, longArcMaterial.clone());
    arcLine.userData = {
      node1: idx1,
      node2: idx2,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.3 + Math.random() * 0.4,
      isLongArc: true
    };
    scene.add(arcLine);
    connections.push(arcLine);
  }
  
  // Create flowing network lines (CFD-like streamlines) - Bright flowing lines
  const flowCount = 15; // Network flow lines
  const flowMaterial = new THREE.LineBasicMaterial({
    color: '#6b9bd1',
    transparent: true,
    opacity: 0.4,
    linewidth: 1
  });
  
  for (let i = 0; i < flowCount; i++) {
    const points = [];
    const startTheta = Math.random() * Math.PI * 2;
    const startPhi = Math.acos(Math.random() * 2 - 1);
    let x = Math.sin(startPhi) * Math.cos(startTheta);
    let y = Math.sin(startPhi) * Math.sin(startTheta);
    let z = Math.cos(startPhi);
    
    // Create smooth flowing path along sphere
    const steps = 40; // Smooth long flowing lines
    for (let j = 0; j < steps; j++) {
      points.push(new THREE.Vector3(x, y, z).multiplyScalar(1.003));
      
      // Calculate flow direction (tangential to sphere, following velocity field)
      const normal = new THREE.Vector3(x, y, z).normalize();
      
      // Simulate velocity field for flowing network lines
      const u = Math.sin(startPhi + j * 0.08) * 0.4; // Longitudinal component
      const v = Math.cos(startTheta + j * 0.08) * 0.4; // Latitudinal component
      
      // Create tangent vectors
      const thetaVec = new THREE.Vector3(-Math.sin(startTheta), Math.cos(startTheta), 0);
      const phiVec = new THREE.Vector3(
        Math.cos(startPhi) * Math.cos(startTheta),
        Math.cos(startPhi) * Math.sin(startTheta),
        -Math.sin(startPhi)
      );
      
      const flowDir = new THREE.Vector3()
        .addScaledVector(thetaVec, u)
        .addScaledVector(phiVec, v)
        .normalize();
      
      // Project onto sphere surface
      const step = 0.025;
      x += flowDir.x * step;
      y += flowDir.y * step;
      z += flowDir.z * step;
      
      // Project back to unit sphere
      const length = Math.sqrt(x * x + y * y + z * z);
      if (length > 0.001) {
        x /= length;
        y /= length;
        z /= length;
      }
    }
    
    const flowGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const flowLine = new THREE.Line(flowGeometry, flowMaterial.clone());
    flowLine.userData = {
      pulsePhase: Math.random() * Math.PI * 2,
      points: points,
      speed: 0.5 + Math.random() * 0.5,
      pulseSpeed: 0.4 + Math.random() * 0.4
    };
    scene.add(flowLine);
    flowLines.push(flowLine);
  }
  
  // Create faint orbital rings with moving dots (satellite systems) - REDUCED for performance
  const ringCount = 2; // Reduced from 3
  const ringMaterial = new THREE.LineBasicMaterial({
    color: '#2c5f8d',
    transparent: true,
    opacity: 0.1,
    linewidth: 1
  });
  
  for (let r = 0; r < ringCount; r++) {
    const ringRadius = 1.3 + r * 0.2;
    const ringPoints = [];
    const ringSegments = 64;
    
    for (let i = 0; i <= ringSegments; i++) {
      const angle = (i / ringSegments) * Math.PI * 2;
      const inclination = (r - 1) * Math.PI * 0.15; // Different inclinations
      const x = Math.cos(angle) * ringRadius;
      const y = Math.sin(angle) * Math.cos(inclination) * ringRadius;
      const z = Math.sin(angle) * Math.sin(inclination) * ringRadius;
      ringPoints.push(new THREE.Vector3(x, y, z));
    }
    
    const ringGeometry = new THREE.BufferGeometry().setFromPoints(ringPoints);
    const ring = new THREE.Line(ringGeometry, ringMaterial.clone());
    scene.add(ring);
    orbitalRings.push(ring);
    
    // Add moving dots on ring - REDUCED for performance
    const dotCount = 4 + r * 1; // Reduced from 8 + r * 2
    const dotGeometry = new THREE.SphereGeometry(0.012, 6, 6);
    const dotMaterial = new THREE.MeshBasicMaterial({
      color: '#4a7ba7',
      emissive: '#4a7ba7',
      emissiveIntensity: 1.2
    });
    
    for (let d = 0; d < dotCount; d++) {
      const dot = new THREE.Mesh(dotGeometry, dotMaterial.clone());
      dot.userData = {
        ringIndex: r,
        angle: (d / dotCount) * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.2,
        inclination: (r - 1) * Math.PI * 0.15
      };
      scene.add(dot);
      dataNodes.push({ mesh: dot, isSatellite: true });
    }
  }
  
  // Stars background
  const starsGeometry = new THREE.BufferGeometry();
  const starsMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.03,
    transparent: true,
    opacity: 0.4
  });
  
  const starsVertices = [];
  for (let i = 0; i < 3000; i++) { // Reduced from 5000 for better performance
    const x = (Math.random() - 0.5) * 2000;
    const y = (Math.random() - 0.5) * 2000;
    const z = (Math.random() - 0.5) * 2000;
    starsVertices.push(x, y, z);
  }
  
  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
  const stars = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(stars);
  
  // Minimal scientific lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambientLight);
  
  // REMOVED mouse interaction - Earth rotates on its own
  
  // Animation loop - HEAVILY OPTIMIZED
  let frameCount = 0;
  function animate() {
    requestAnimationFrame(animate);
    frameCount++;
    time += 0.01;
    
    // Auto-rotate Earth only - no cursor interaction
    earth.rotation.y += 0.002; // Smooth auto-rotation
    
    // Update data nodes (instanced) - Soft pulsing nodes
    if (dataNodes[0] && dataNodes[0].mesh) {
      const nodeInstances = dataNodes[0].mesh;
      const positions = dataNodes[0].positions;
      const matrix = new THREE.Matrix4();
      const updatePulse = frameCount % 2 === 0; // Update pulse every other frame
      
      positions.forEach((nodeData, i) => {
        // Rotate with Earth
        const pos = nodeData.basePosition.clone();
        pos.applyAxisAngle(new THREE.Vector3(0, 1, 0), earth.rotation.y);
        
        // Soft pulse - nodes fade in and out
        const pulse = updatePulse 
          ? (Math.sin(time * nodeData.pulseSpeed + nodeData.pulsePhase) * 0.4 + 0.6) 
          : 1.0;
        const scale = 0.01 * pulse;
        
        matrix.makeScale(scale, scale, scale);
        matrix.setPosition(pos);
        nodeInstances.setMatrixAt(i, matrix);
      });
      nodeInstances.instanceMatrix.needsUpdate = true;
      
      // Update emissive intensity for pulse effect
      if (updatePulse) {
        const globalPulse = Math.sin(time * 0.8) * 0.3 + 0.7;
        nodeInstances.material.emissiveIntensity = 1.5 * globalPulse;
      }
    }
    
    // Update satellite dots on orbital rings - OPTIMIZED: update less frequently
    if (frameCount % 2 === 0) { // Update every other frame
      dataNodes.forEach(node => {
        if (node.isSatellite && node.mesh.userData.ringIndex !== undefined) {
          const dot = node.mesh;
          dot.userData.angle += dot.userData.speed * 0.01;
          
          const x = Math.cos(dot.userData.angle) * (1.3 + dot.userData.ringIndex * 0.2);
          const y = Math.sin(dot.userData.angle) * Math.cos(dot.userData.inclination) * (1.3 + dot.userData.ringIndex * 0.2);
          const z = Math.sin(dot.userData.angle) * Math.sin(dot.userData.inclination) * (1.3 + dot.userData.ringIndex * 0.2);
          
          dot.position.set(x, y, z);
          
          // Fixed intensity - no pulse calculation
          dot.material.emissiveIntensity = 1.2;
        }
      });
    }
    
    // Update connection opacity - Soft pulsing lines, fade in and out
    if (frameCount % 2 === 0) { // Update every other frame
      connections.forEach(conn => {
        const pulseSpeed = conn.userData.pulseSpeed || 0.8;
        const pulse = Math.sin(time * pulseSpeed + conn.userData.pulsePhase) * 0.25 + 0.6;
        conn.material.opacity = pulse; // Soft pulse between 0.35 and 0.85
      });
    }
    
    // Update curved line positions - Flowing network lines
    if (frameCount % 3 === 0 && dataNodes[0] && dataNodes[0].positions) { // Update every 3 frames
      connections.forEach(conn => {
        const pos1 = dataNodes[0].positions[conn.userData.node1].basePosition.clone();
        const pos2 = dataNodes[0].positions[conn.userData.node2].basePosition.clone();
        
        pos1.applyAxisAngle(new THREE.Vector3(0, 1, 0), earth.rotation.y);
        pos2.applyAxisAngle(new THREE.Vector3(0, 1, 0), earth.rotation.y);
        
        // Recalculate smooth curved path wrapping along sphere
        const points = [];
        const steps = 12; // Smooth curves
        const radiusMultiplier = conn.userData.isLongArc ? 1.006 : 1.004;
        
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          const angle = Math.acos(pos1.dot(pos2));
          const sinAngle = Math.sin(angle);
          if (sinAngle > 0.001) {
            const a = Math.sin((1 - t) * angle) / sinAngle;
            const b = Math.sin(t * angle) / sinAngle;
            const point = new THREE.Vector3()
              .addScaledVector(pos1, a)
              .addScaledVector(pos2, b)
              .normalize()
              .multiplyScalar(radiusMultiplier);
            points.push(point);
          }
        }
        conn.geometry.setFromPoints(points);
      });
    }
    
    // Update flow lines - Soft pulsing, fade in and out
    if (frameCount % 3 === 0) { // Update every 3 frames
      flowLines.forEach(flow => {
        const pulseSpeed = flow.userData.pulseSpeed || 0.6;
        const pulse = Math.sin(time * pulseSpeed + flow.userData.pulsePhase) * 0.2 + 0.4;
        flow.material.opacity = pulse; // Pulse between 0.2 and 0.6
      });
    }
    
    // Rotate stars slowly - OPTIMIZED: update less frequently
    if (frameCount % 3 === 0) {
      stars.rotation.y += 0.00015; // Faster rotation, less frequent updates
    }
    
    // Fixed camera
    camera.position.z = 2.5;
    
    renderer.render(scene, camera);
  }
  
  animate();
  
  // Handle resize
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
  console.warn('Three.js not loaded');
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
  dot.style.opacity = (dotCount - i) / dotCount * 0.6;
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
  btn.addEventListener('click', function(e) {
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
