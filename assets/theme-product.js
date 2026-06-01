/**
 * Anand Rasa — production ambient audio manager (singleton, vanilla JS).
 * Loads only on pages that render #ar-ambient (whitelisted products / metafield).
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'ar_ambient_v1';
  var DEFAULT_VOLUME = 0.55;
  var FADE_IN_MS = 1100;
  var FADE_OUT_MS = 850;
  var VISIBILITY_DEBOUNCE_MS = 160;

  var STATES = {
    IDLE: 'idle',
    LOADING: 'loading',
    PLAYING: 'playing',
    PAUSED: 'paused',
  };

  var root = document.getElementById('ar-ambient');
  if (!root) return;

  var trackUrl = root.getAttribute('data-track');
  if (!trackUrl) return;

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** @param {number} t 0..1 */
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function clampVolume(v) {
    return Math.min(1, Math.max(0, v));
  }

  function readPrefs() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { enabled: false, volume: DEFAULT_VOLUME };
      var parsed = JSON.parse(raw);
      return {
        enabled: parsed.enabled === true,
        volume: clampVolume(typeof parsed.volume === 'number' ? parsed.volume : DEFAULT_VOLUME),
      };
    } catch (_err) {
      return { enabled: false, volume: DEFAULT_VOLUME };
    }
  }

  function writePrefs(prefs) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          enabled: prefs.enabled === true,
          volume: clampVolume(prefs.volume),
        })
      );
    } catch (_err) {
      /* quota / private mode — silent */
    }
  }

  /** RAF volume fader — single active loop, no setInterval */
  function createFader() {
    var rafId = 0;

    return {
      cancel: function () {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      },
      to: function (audio, target, durationMs, done) {
        this.cancel();
        if (!audio) {
          if (done) done();
          return;
        }

        var targetVol = clampVolume(target);
        if (reducedMotion || durationMs <= 0) {
          audio.volume = targetVol;
          if (done) done();
          return;
        }

        var startVol = audio.volume;
        var delta = targetVol - startVol;
        if (Math.abs(delta) < 0.001) {
          audio.volume = targetVol;
          if (done) done();
          return;
        }

        var start = performance.now();

        function tick(now) {
          var progress = Math.min(1, (now - start) / durationMs);
          audio.volume = startVol + delta * easeOutCubic(progress);
          if (progress < 1) {
            rafId = requestAnimationFrame(tick);
          } else {
            rafId = 0;
            audio.volume = targetVol;
            if (done) done();
          }
        }

        rafId = requestAnimationFrame(tick);
      },
    };
  }

  /** Singleton manager — reused if script re-evaluates in same document */
  var Manager = window.__AR_AMBIENT_MANAGER__;

  if (!Manager) {
    Manager = {
      root: null,
      fab: null,
      audio: null,
      live: null,
      trackUrl: null,
      state: STATES.IDLE,
      prefs: readPrefs(),
      fader: createFader(),
      audioReady: false,
      playToken: 0,
      playLock: false,
      resumeOnVisible: false,
      visibilityTimer: 0,
      icons: null,
      bound: {},

      mount: function (mountRoot) {
        if (this.root && this.root !== mountRoot) {
          this.destroy({ resetTime: false });
        }

        this.root = mountRoot;
        this.trackUrl = trackUrl;
        this.fab = mountRoot.querySelector('[data-ar-ambient-toggle]');
        this.audio = mountRoot.querySelector('.ar-ambient__audio');
        this.live = mountRoot.querySelector('[data-ar-ambient-live]');
        this.icons = {
          play: mountRoot.querySelector('[data-icon="play"]'),
          pause: mountRoot.querySelector('[data-icon="pause"]'),
          loader: mountRoot.querySelector('[data-icon="loader"]'),
        };

        if (!this.fab || !this.audio) return false;

        this.prefs = readPrefs();
        this.audioReady = false;
        this.resumeOnVisible = false;
        this.bindEvents();
        requestAnimationFrame(this.revealFab.bind(this));

        if (this.prefs.enabled) {
          this.play({ autoplay: true, persist: false });
        } else {
          this.setState(STATES.IDLE);
        }

        return true;
      },

      revealFab: function () {
        if (this.fab) this.fab.classList.add('is-visible');
      },

      bindEvents: function () {
        if (this.bound._active) return;
        var self = this;

        this.bound.onFabClick = function () {
          self.toggle();
        };
        this.bound.onFabKeydown = function (e) {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            self.toggle();
          }
        };
        this.bound.onVisibility = function () {
          self.handleVisibility();
        };
        this.bound.onPageHide = function () {
          self.destroy({ resetTime: true });
        };
        this.bound.onCanPlay = function () {
          self.audioReady = true;
        };

        this.bound.onPointerDown = function () {
          self.fab.classList.add('is-pressed');
        };
        this.bound.onPointerUp = function () {
          self.fab.classList.remove('is-pressed');
        };

        this.fab.addEventListener('click', this.bound.onFabClick);
        this.fab.addEventListener('keydown', this.bound.onFabKeydown);
        this.fab.addEventListener('pointerdown', this.bound.onPointerDown, { passive: true });
        this.fab.addEventListener('pointerup', this.bound.onPointerUp, { passive: true });
        this.fab.addEventListener('pointercancel', this.bound.onPointerUp, { passive: true });
        this.fab.addEventListener('pointerleave', this.bound.onPointerUp, { passive: true });
        document.addEventListener('visibilitychange', this.bound.onVisibility, { passive: true });
        window.addEventListener('pagehide', this.bound.onPageHide, { passive: true });
        this.audio.addEventListener('canplaythrough', this.bound.onCanPlay, { once: true, passive: true });
        this.bound._active = true;
      },

      unbindEvents: function () {
        if (!this.fab || !this.bound._active) return;
        this.fab.removeEventListener('click', this.bound.onFabClick);
        this.fab.removeEventListener('keydown', this.bound.onFabKeydown);
        this.fab.removeEventListener('pointerdown', this.bound.onPointerDown);
        this.fab.removeEventListener('pointerup', this.bound.onPointerUp);
        this.fab.removeEventListener('pointercancel', this.bound.onPointerUp);
        this.fab.removeEventListener('pointerleave', this.bound.onPointerUp);
        document.removeEventListener('visibilitychange', this.bound.onVisibility);
        window.removeEventListener('pagehide', this.bound.onPageHide);
        if (this.audio && this.bound.onCanPlay) {
          this.audio.removeEventListener('canplaythrough', this.bound.onCanPlay);
        }
        this.bound._active = false;
      },

      ensureAudioSource: function () {
        if (!this.audio || this.audio.src) return;
        this.audio.preload = 'metadata';
        this.audio.loop = true;
        this.audio.playsInline = true;
        this.audio.src = this.trackUrl;
        this.audio.load();
      },

      targetVolume: function () {
        return clampVolume(this.prefs.volume || DEFAULT_VOLUME);
      },

      announce: function (message) {
        if (this.live) this.live.textContent = message;
      },

      setIcon: function (active) {
        if (!this.icons) return;
        var keys = ['play', 'pause', 'loader'];
        for (var i = 0; i < keys.length; i += 1) {
          var key = keys[i];
          var icon = this.icons[key];
          if (icon) icon.classList.toggle('is-active', key === active);
        }
      },

      setState: function (next) {
        this.state = next;
        if (!this.fab) return;

        this.fab.classList.remove('is-idle', 'is-loading', 'is-playing', 'is-paused');
        this.fab.classList.add('is-' + next);

        var labels = {
          idle: 'Play ambient sound',
          loading: 'Loading ambient sound',
          playing: 'Pause ambient sound',
          paused: 'Play ambient sound',
        };

        var pressed = next === STATES.PLAYING || next === STATES.LOADING;
        this.fab.setAttribute('aria-label', labels[next] || labels.paused);
        this.fab.setAttribute('aria-pressed', pressed ? 'true' : 'false');
        this.fab.disabled = next === STATES.LOADING;

        if (next === STATES.LOADING) {
          this.setIcon('loader');
        } else if (next === STATES.PLAYING) {
          this.setIcon('pause');
        } else {
          this.setIcon('play');
        }

        if (next === STATES.PLAYING) {
          this.announce('Ambient sound playing');
        } else if (next === STATES.PAUSED) {
          this.announce('Ambient sound paused');
        }
      },

      toggle: function () {
        if (this.state === STATES.LOADING || this.playLock) return;
        if (this.state === STATES.PLAYING) {
          this.pause({ persist: true });
        } else {
          this.play({ autoplay: false, persist: true });
        }
      },

      play: function (options) {
        var self = this;
        var opts = options || {};
        if (this.playLock) return;

        this.playLock = true;
        this.ensureAudioSource();
        this.setState(STATES.LOADING);

        var token = ++this.playToken;
        this.audio.muted = false;
        this.audio.volume = 0;

        var playResult;
        try {
          playResult = this.audio.play();
        } catch (_err) {
          this.playLock = false;
          this.setState(STATES.PAUSED);
          return;
        }

        function onStarted() {
          if (token !== self.playToken) return;
          self.fader.to(self.audio, self.targetVolume(), FADE_IN_MS, function () {
            if (token !== self.playToken) return;
            self.playLock = false;
            self.setState(STATES.PLAYING);
            if (opts.persist !== false) {
              self.prefs.enabled = true;
              self.prefs.volume = self.targetVolume();
              writePrefs(self.prefs);
            }
          });
        }

        function onFailed() {
          if (token !== self.playToken) return;
          self.playLock = false;
          self.fader.cancel();
          self.setState(STATES.PAUSED);
          if (!opts.autoplay) {
            self.announce('Unable to play ambient sound');
          }
        }

        if (playResult && typeof playResult.then === 'function') {
          playResult.then(onStarted).catch(onFailed);
        } else {
          onStarted();
        }
      },

      pause: function (options) {
        var self = this;
        var opts = options || {};
        this.playToken += 1;
        this.playLock = false;

        if (!this.audio || this.audio.paused) {
          this.setState(STATES.PAUSED);
          if (opts.persist) {
            this.prefs.enabled = false;
            writePrefs(this.prefs);
          }
          return;
        }

        this.fader.cancel();
        this.fader.to(this.audio, 0, FADE_OUT_MS, function () {
          self.audio.pause();
          self.setState(STATES.PAUSED);
          if (opts.persist) {
            self.prefs.enabled = false;
            writePrefs(self.prefs);
          }
        });
      },

      handleVisibility: function () {
        var self = this;
        if (this.visibilityTimer) {
          clearTimeout(this.visibilityTimer);
        }
        this.visibilityTimer = window.setTimeout(function () {
          self.visibilityTimer = 0;
          if (document.hidden) {
            if (self.state === STATES.PLAYING) {
              self.resumeOnVisible = true;
              self.pause({ persist: false });
            }
            return;
          }
          if (self.resumeOnVisible && self.prefs.enabled) {
            self.resumeOnVisible = false;
            self.play({ autoplay: true, persist: false });
          }
        }, VISIBILITY_DEBOUNCE_MS);
      },

      destroy: function (options) {
        var opts = options || {};
        this.playToken += 1;
        this.playLock = false;
        this.fader.cancel();
        if (this.visibilityTimer) {
          clearTimeout(this.visibilityTimer);
          this.visibilityTimer = 0;
        }
        if (this.audio) {
          this.audio.pause();
          if (opts.resetTime) this.audio.currentTime = 0;
        }
        this.unbindEvents();
      },
    };

    window.__AR_AMBIENT_MANAGER__ = Manager;
  }

  Manager.mount(root);
})();
