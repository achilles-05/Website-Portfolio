// Smooth scroll (award-level feel)
const lenis = new Lenis({
  smooth: true,
  lerp: 0.08
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// GSAP
gsap.registerPlugin(ScrollTrigger);

// Cursor physics
const cursor = document.querySelector(".cursor");
document.addEventListener("mousemove", e => {
  gsap.to(cursor, {
    x: e.clientX - 9,
    y: e.clientY - 9,
    duration: 0.15,
    ease: "power3.out"
  });
});

// Section reveal
gsap.utils.toArray("section").forEach(section => {
  gsap.from(section, {
    opacity: 0,
    y: 120,
    duration: 1.4,
    ease: "power4.out",
    scrollTrigger: {
      trigger: section,
      start: "top 85%"
    }
  });
});

// Hero text stagger
gsap.from(".hero h1 span", {
  opacity: 0,
  y: 80,
  duration: 1.6,
  ease: "power4.out"
});
