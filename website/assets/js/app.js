/* 《光锥之外》官网交互脚本：双语切换、观测语法演示、预留接口与环境自检 */
(function () {
  // Reserved integration hooks for M3/M4 backend & app store release
  window.__STARS_ENDPOINTS__ = window.__STARS_ENDPOINTS__ || {
    authOidcGoogle: '/auth/oidc/google',
    authOidcApple: '/auth/oidc/apple',
    authLogin: '/auth/login',
    authRegister: '/auth/register',
    wsGateway: 'wss://gateway.beyondlightcone.org/ws',
    webClientDev: 'http://127.0.0.1:5178',
    webClientDist: '../apps/web-client/dist/',
    iosAppStore: null,
    iosTestFlight: null,
    androidPlay: null,
    androidApk: null
  };

  function initCleanRoutes() {
    if (!/^https?:$/i.test(window.location.protocol)) return;
    const { pathname, search, hash } = window.location;
    if (/\/index\.html$/i.test(pathname)) {
      const cleanPath = pathname.replace(/index\.html$/i, '') || '/';
      window.history.replaceState(null, '', cleanPath + search + hash);
    }
  }

  function initHeaderAndLang() {
    if (window.StarsI18n) {
      window.StarsI18n.applyTranslations();
    }

    document.querySelectorAll('[data-lang-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (window.StarsI18n) window.StarsI18n.toggleLocale();
      });
    });

    const menuBtn = document.getElementById('menu-toggle');
    const drawer = document.getElementById('mobile-drawer');
    if (menuBtn && drawer) {
      menuBtn.addEventListener('click', () => {
        const open = drawer.classList.toggle('is-open');
        menuBtn.setAttribute('aria-expanded', String(open));
      });
      drawer.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
          drawer.classList.remove('is-open');
          menuBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  function initPureSkyToggle() {
    const btn = document.getElementById('pure-sky-btn');
    const hero = document.getElementById('hero-stage');
    if (!btn || !hero || !window.StarsI18n) return;

    const updateBtn = () => {
      const active = hero.classList.contains('is-pure-sky');
      btn.setAttribute('aria-pressed', String(active));
      btn.textContent = window.StarsI18n.t(active ? 'hero.puresky.exit' : 'hero.puresky');
    };

    btn.addEventListener('click', () => {
      hero.classList.toggle('is-pure-sky');
      updateBtn();
    });
    document.addEventListener('stars:localechange', updateBtn);
    updateBtn();
  }

  function initGrammarExplorer() {
    const svg = document.getElementById('grammar-svg');
    const logEl = document.getElementById('grammar-log');
    const metaEl = document.getElementById('grammar-meta');
    if (!svg || !logEl || !metaEl) return;

    let stage = 1;
    let view = 'bubble';

    function renderDiagram() {
      const t = window.StarsI18n ? window.StarsI18n.t : (k) => k;
      const isCelestial = view === 'celestial';

      let content = '';
      if (isCelestial) {
        // Spherical graticule lines for Celestial Sphere mode
        content += `
          <g stroke="#24344A" stroke-width="0.9" fill="none" opacity="0.65">
            <ellipse cx="260" cy="85" rx="220" ry="70"/>
            <line x1="20" y1="85" x2="500" y2="85" stroke-dasharray="3 4"/>
            <line x1="260" y1="8" x2="260" y2="162"/>
            <path d="M120 14 Q170 85 120 156"/>
            <path d="M400 14 Q350 85 400 156"/>
          </g>
          <text x="16" y="22" fill="#5C6B7D" font-family="JetBrains Mono, monospace" font-size="10">SKY VIEW · FOV 78°</text>
        `;
      } else {
        // Polar rings for 3D Star Map mode
        content += `
          <g stroke="#24344A" stroke-width="0.9" fill="none" opacity="0.75">
            <ellipse cx="110" cy="105" rx="90" ry="34"/>
            <ellipse cx="110" cy="105" rx="180" ry="64"/>
            <line x1="20" y1="105" x2="490" y2="105"/>
          </g>
          <circle cx="110" cy="105" r="3" fill="#FFF4E8"/>
          <circle cx="110" cy="105" r="11" fill="none" stroke="#6FE3FF" stroke-width="1.3"/>
          <text x="16" y="22" fill="#5C6B7D" font-family="JetBrains Mono, monospace" font-size="10">STAR MAP · 3D VIEW</text>
        `;
      }

      if (stage === 1) {
        if (isCelestial) {
          content += `
            <defs>
              <radialGradient id="mistBlob"><stop offset="0" stop-color="#78C2FF" stop-opacity="0.34"/><stop offset="1" stop-color="#78C2FF" stop-opacity="0"/></radialGradient>
            </defs>
            <ellipse cx="330" cy="70" rx="58" ry="34" fill="url(#mistBlob)" transform="rotate(-18 330 70)"/>
            <circle cx="330" cy="70" r="46" fill="none" stroke="#9AA9BA" stroke-opacity="0.5" stroke-dasharray="3 5"/>
            <text x="330" y="135" text-anchor="middle" fill="#78C2FF" font-family="JetBrains Mono, monospace" font-size="10">FAINT SIGNAL</text>
          `;
        } else {
          content += `
            <path d="M110 105 L430 28 A120 120 0 0 1 452 92 Z" fill="#78C2FF" fill-opacity="0.08" stroke="#78C2FF" stroke-opacity="0.45" stroke-dasharray="3 5"/>
            <text x="355" y="45" fill="#78C2FF" font-family="JetBrains Mono, monospace" font-size="10">ROUGH SECTOR</text>
          `;
        }
        logEl.textContent = t('obs.s1.log');
        metaEl.textContent = t('obs.s1.meta');
      } else if (stage === 2) {
        if (isCelestial) {
          content += `
            <g transform="translate(335,72)" stroke="#EAF2FF" stroke-width="1.3" fill="none">
              <circle r="11"/>
              <circle r="24" stroke="#9AA9BA" stroke-opacity="0.5" stroke-dasharray="2 4"/>
              <line x1="15" y1="0" x2="32" y2="0"/><line x1="-15" y1="0" x2="-32" y2="0"/>
              <line x1="0" y1="15" x2="0" y2="32"/><line x1="0" y1="-15" x2="0" y2="-32"/>
            </g>
            <text x="335" y="124" text-anchor="middle" fill="#EAF2FF" font-family="JetBrains Mono, monospace" font-size="10">DIRECTION LOCKED</text>
          `;
        } else {
          content += `
            <defs>
              <linearGradient id="infRay" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color="#EAF2FF" stop-opacity="0.95"/>
                <stop offset="1" stop-color="#EAF2FF" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <line x1="115" y1="103" x2="480" y2="32" stroke="url(#infRay)" stroke-width="1.6"/>
            <text x="330" y="46" fill="#EAF2FF" font-family="JetBrains Mono, monospace" font-size="10">DIRECTION KNOWN · RANGE UNKNOWN</text>
          `;
        }
        logEl.textContent = t('obs.s2.log');
        metaEl.textContent = t('obs.s2.meta');
      } else {
        if (isCelestial) {
          content += `
            <g transform="translate(335,72)" stroke="#A98BFF" stroke-width="1.2" fill="none">
              <ellipse rx="28" ry="12" transform="rotate(-16)" fill="#A98BFF" fill-opacity="0.08"/>
              <circle r="3" fill="#EAF2FF" stroke="none"/>
              <line x1="-18" y1="0" x2="18" y2="0" stroke="#EAF2FF"/>
              <line x1="0" y1="-18" x2="0" y2="18" stroke="#EAF2FF"/>
            </g>
            <text x="335" y="124" text-anchor="middle" fill="#A98BFF" font-family="JetBrains Mono, monospace" font-size="10">20.3 ± 0.4 LY</text>
          `;
        } else {
          content += `
            <circle cx="84" cy="128" r="2.8" fill="#6FE3FF"/>
            <circle cx="152" cy="82" r="2.8" fill="#6FE3FF"/>
            <line x1="110" y1="105" x2="84" y2="128" stroke="#2C7F99" stroke-width="1"/>
            <line x1="110" y1="105" x2="152" y2="82" stroke="#2C7F99" stroke-width="1"/>
            <line x1="110" y1="105" x2="392" y2="56" stroke="#A98BFF" stroke-opacity="0.45" stroke-dasharray="3 4"/>
            <line x1="84" y1="128" x2="392" y2="56" stroke="#A98BFF" stroke-opacity="0.45" stroke-dasharray="3 4"/>
            <line x1="152" y1="82" x2="392" y2="56" stroke="#A98BFF" stroke-opacity="0.45" stroke-dasharray="3 4"/>
            <g transform="translate(392,56)">
              <ellipse rx="24" ry="10" transform="rotate(-18)" fill="#A98BFF" fill-opacity="0.10" stroke="#A98BFF" stroke-width="1.2"/>
              <circle r="3" fill="#EAF2FF"/>
            </g>
            <text x="392" y="92" text-anchor="middle" fill="#A98BFF" font-family="JetBrains Mono, monospace" font-size="10">POSITION LOCKED · 20.3 LY</text>
          `;
        }
        logEl.textContent = t('obs.s3.log');
        metaEl.textContent = t('obs.s3.meta');
      }

      svg.innerHTML = content;
    }

    document.querySelectorAll('[data-grammar-stage]').forEach((btn) => {
      btn.addEventListener('click', () => {
        stage = Number(btn.getAttribute('data-grammar-stage'));
        document.querySelectorAll('[data-grammar-stage]').forEach((b) => {
          b.setAttribute('aria-selected', String(b === btn));
        });
        renderDiagram();
      });
    });

    document.querySelectorAll('[data-grammar-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        view = btn.getAttribute('data-grammar-view') || 'bubble';
        document.querySelectorAll('[data-grammar-view]').forEach((b) => {
          b.setAttribute('aria-selected', String(b === btn));
        });
        renderDiagram();
      });
    });

    document.addEventListener('stars:localechange', renderDiagram);
    renderDiagram();
  }

  function initRelayToggles() {
    document.querySelectorAll('.relay-mode-btn').forEach((btn) => {
      const updateText = () => {
        const mode = btn.getAttribute('data-mode') || 'offline';
        if (window.StarsI18n) {
          btn.textContent = window.StarsI18n.t(mode === 'offline' ? 'off.l1.mode.offline' : 'off.l1.mode.always');
        }
      };
      btn.addEventListener('click', () => {
        const next = btn.getAttribute('data-mode') === 'offline' ? 'always' : 'offline';
        btn.setAttribute('data-mode', next);
        updateText();
      });
      document.addEventListener('stars:localechange', updateText);
      updateText();
    });
  }

  function setStatus(el, msg, variant) {
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('is-active', 'is-warn');
    if (variant) el.classList.add(variant);
  }

  function initAuthPages() {
    const loginStatus = document.getElementById('login-status');
    const regStatus = document.getElementById('register-status');

    document.querySelectorAll('[data-oauth-provider]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const provider = btn.getAttribute('data-oauth-provider');
        const target = loginStatus || regStatus;
        if (target && window.StarsI18n) {
          setStatus(target, window.StarsI18n.t('login.status.oauth', { provider }), 'is-active');
        }
      });
    });

    const loginForm = document.getElementById('login-form');
    if (loginForm && loginStatus) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = (document.getElementById('login-email')?.value || '').trim();
        const pass = (document.getElementById('login-pass')?.value || '').trim();
        if (!email || !email.includes('@') || pass.length < 4) {
          setStatus(loginStatus, window.StarsI18n.t('login.status.invalid'), 'is-warn');
          return;
        }
        setStatus(loginStatus, window.StarsI18n.t('login.status.form', { email }), 'is-active');
      });
    }

    const regForm = document.getElementById('register-form');
    if (regForm && regStatus) {
      regForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const callsign = (document.getElementById('reg-callsign')?.value || '').trim();
        const email = (document.getElementById('reg-email')?.value || '').trim();
        const pass = (document.getElementById('reg-pass')?.value || '').trim();
        const agree = Boolean(document.getElementById('reg-agree')?.checked);
        const zoneInput = regForm.querySelector('input[name="birth_zone"]:checked');
        const zone = zoneInput ? zoneInput.value : 'spiral_arm';
        if (!callsign || !email.includes('@') || pass.length < 8 || !agree) {
          setStatus(regStatus, window.StarsI18n.t('reg.status.err'), 'is-warn');
          return;
        }
        setStatus(regStatus, window.StarsI18n.t('reg.status.ok', { callsign, zone }), 'is-active');
      });
    }
  }

  function initPlayPage() {
    const gatewayBtn = document.getElementById('probe-gateway-btn');
    const gatewayStatus = document.getElementById('gateway-status');
    if (gatewayBtn && gatewayStatus) {
      gatewayBtn.addEventListener('click', () => {
        setStatus(gatewayStatus, window.StarsI18n.t('play.online.status.checked'), 'is-active');
      });
    }

    const urlInput = document.getElementById('web-client-url');
    const launchBtn = document.getElementById('launch-web-client');
    if (urlInput && launchBtn) {
      try {
        const saved = localStorage.getItem('stars.website.clientUrl');
        if (saved) urlInput.value = saved;
      } catch (_) {}

      const syncLaunchHref = () => {
        const val = urlInput.value.trim() || window.__STARS_ENDPOINTS__.webClientDev;
        launchBtn.setAttribute('href', val);
        try {
          localStorage.setItem('stars.website.clientUrl', val);
        } catch (_) {}
      };

      urlInput.addEventListener('input', syncLaunchHref);
      document.querySelectorAll('[data-client-preset]').forEach((btn) => {
        btn.addEventListener('click', () => {
          urlInput.value = btn.getAttribute('data-client-preset') || '';
          syncLaunchHref();
        });
      });
      syncLaunchHref();
    }

    // Real Browser Diagnostics
    const diagWebgl = document.getElementById('diag-webgl2');
    const diagAudio = document.getElementById('diag-audio');
    const diagIdb = document.getElementById('diag-idb');
    const diagView = document.getElementById('diag-viewport');
    if (diagWebgl && diagAudio && diagIdb && diagView) {
      const renderDiag = () => {
        const t = window.StarsI18n ? window.StarsI18n.t : (k) => k;
        let hasWebgl2 = false;
        try {
          const c = document.createElement('canvas');
          hasWebgl2 = Boolean(c.getContext('webgl2'));
        } catch (_) {}

        const hasAudio = Boolean(window.AudioContext || window.webkitAudioContext);
        const hasIdb = Boolean(window.indexedDB);
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const profile = vw < 800 ? 'MOBILE PORTRAIT / COMPACT' : 'DESKTOP WIDESCREEN';

        diagWebgl.textContent = t(hasWebgl2 ? 'play.diag.ok' : 'play.diag.no');
        diagWebgl.className = 'chip ' + (hasWebgl2 ? 'chip-self' : 'chip-alert');

        diagAudio.textContent = t(hasAudio ? 'play.diag.ok' : 'play.diag.no');
        diagAudio.className = 'chip ' + (hasAudio ? 'chip-self' : 'chip-alert');

        diagIdb.textContent = t(hasIdb ? 'play.diag.ok' : 'play.diag.no');
        diagIdb.className = 'chip ' + (hasIdb ? 'chip-self' : 'chip-alert');

        diagView.textContent = `${vw} × ${vh} · ${profile}`;
      };
      renderDiag();
      window.addEventListener('resize', renderDiag, { passive: true });
      document.addEventListener('stars:localechange', renderDiag);
    }
  }

  function initDownloadPage() {
    const dlStatus = document.getElementById('download-status');
    if (!dlStatus) return;
    document.querySelectorAll('[data-download-channel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const channel = btn.getAttribute('data-download-channel') || 'unknown';
        setStatus(dlStatus, window.StarsI18n.t('dl.status.clicked', { channel }), 'is-active');
      });
    });
  }

  function initSectionNavSync() {
    const sections = [
      { hash: '#cosmos', el: document.getElementById('cosmos') },
      { hash: '#features', el: document.getElementById('features') }
    ].filter((item) => Boolean(item.el));

    if (!sections.length) return;

    const trackedHashes = sections.map((item) => item.hash);
    const navLinks = Array.from(
      document.querySelectorAll('.nav-links a.nav-link, .mobile-drawer-nav a.nav-link')
    ).filter((link) => {
      const href = link.getAttribute('href');
      return link.getAttribute('data-i18n') === 'nav.home' || trackedHashes.includes(href);
    });

    if (!navLinks.length) return;

    let activeKey = '';
    let lockedKey = null;
    let lockTimer = null;
    let rafPending = false;

    const setActiveKey = (targetKey) => {
      if (activeKey === targetKey) return;
      activeKey = targetKey;
      navLinks.forEach((link) => {
        const key = link.getAttribute('data-i18n') === 'nav.home' ? 'home' : link.getAttribute('href');
        if (key === targetKey) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    };

    const resolveScrollKey = () => {
      const header = document.querySelector('.site-header');
      const headerHeight = header ? header.offsetHeight : 68;
      const triggerY = headerHeight + Math.min(180, window.innerHeight * 0.24);
      const scrollBottom = window.scrollY + window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      if (scrollBottom >= docHeight - 36) {
        const lastSection = sections[sections.length - 1];
        if (lastSection.el.getBoundingClientRect().top < window.innerHeight * 0.85) {
          return lastSection.hash;
        }
      }

      let resolved = 'home';
      for (const section of sections) {
        if (section.el.getBoundingClientRect().top <= triggerY) {
          resolved = section.hash;
        }
      }
      return resolved;
    };

    const syncFromScroll = () => {
      if (lockedKey) return;
      setActiveKey(resolveScrollKey());
    };

    const lockTarget = (targetKey) => {
      lockedKey = targetKey;
      setActiveKey(targetKey);
      if (lockTimer) clearTimeout(lockTimer);
      lockTimer = setTimeout(() => {
        lockedKey = null;
        lockTimer = null;
        syncFromScroll();
      }, 950);
    };

    const scheduleScrollSync = () => {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        syncFromScroll();
      });
    };

    const cancelLockOnManualInput = () => {
      if (!lockedKey) return;
      lockedKey = null;
      if (lockTimer) {
        clearTimeout(lockTimer);
        lockTimer = null;
      }
      scheduleScrollSync();
    };

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!trackedHashes.includes(href)) return;
      link.addEventListener('click', () => {
        lockTarget(href);
      });
    });

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash;
      if (trackedHashes.includes(hash)) {
        lockTarget(hash);
      } else if (!hash) {
        lockTarget('home');
      }
    });

    window.addEventListener('scroll', scheduleScrollSync, { passive: true });
    window.addEventListener('wheel', cancelLockOnManualInput, { passive: true });
    window.addEventListener('touchmove', cancelLockOnManualInput, { passive: true });

    if (trackedHashes.includes(window.location.hash)) {
      lockTarget(window.location.hash);
    } else {
      syncFromScroll();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initCleanRoutes();
    initHeaderAndLang();
    initSectionNavSync();
    initPureSkyToggle();
    initGrammarExplorer();
    initRelayToggles();
    initAuthPages();
    initPlayPage();
    initDownloadPage();
  });
})();
