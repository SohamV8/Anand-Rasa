/**
 * Luxury gold confetti — lazy-loaded canvas burst (no external deps).
 */
(function (global) {
  'use strict';

  var COLORS = ['#d4ab5a', '#b8943a', '#f5efe6', '#fffdf8', '#e8dcc8'];
  var loaded = false;

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function burst(options) {
    if (prefersReducedMotion()) return;

    var root = options && options.root;
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = (canvas.width = window.innerWidth * dpr);
    var h = (canvas.height = window.innerHeight * dpr);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.scale(dpr, dpr);

    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var originX = vw * 0.5;
    var originY = vh * 0.72;

    if (root) {
      var rect = root.getBoundingClientRect();
      originX = rect.left + rect.width * 0.5;
      originY = rect.top + rect.height * 0.35;
    }

    var count = Math.min(72, Math.floor((vw * vh) / 18000));
    var particles = [];

    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      var speed = 2.2 + Math.random() * 4.5;
      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5,
        w: 3 + Math.random() * 5,
        h: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.18,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: 1,
        decay: 0.008 + Math.random() * 0.01,
      });
    }

    var start = performance.now();
    var duration = 2200;

    function frame(now) {
      var elapsed = now - start;
      ctx.clearRect(0, 0, vw, vh);

      var alive = false;
      for (var j = 0; j < particles.length; j++) {
        var p = particles[j];
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.vx *= 0.99;
        p.life -= p.decay;
        p.rot += p.vr;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w * 0.5, -p.h * 0.5, p.w, p.h);
        ctx.restore();
      }

      if (alive && elapsed < duration) {
        requestAnimationFrame(frame);
      } else {
        canvas.remove();
      }
    }

    requestAnimationFrame(frame);
  }

  global.BuildBoxConfetti = {
    fire: burst,
    load: function (cb) {
      loaded = true;
      if (cb) cb(burst);
    },
    ready: function () {
      return loaded;
    },
  };
})(typeof window !== 'undefined' ? window : this);
