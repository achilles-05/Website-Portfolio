gsap.registerPlugin(ScrollTrigger);

// Reveal sections
gsap.utils.toArray(".section").forEach(section => {
  gsap.from(section, {
    opacity: 0,
    y: 80,
    duration: 1,
    scrollTrigger: {
      trigger: section,
      start: "top 80%"
    }
  });
});
