/* ==========================================================================
   MARISCOS EL MUELLE  |  app.js
   --------------------------------------------------------------------------
   Sin dependencias. Sin listeners de "scroll": el revelado usa
   IntersectionObserver y el parallax/progreso usan CSS scroll-driven
   animations (mejora progresiva). Todo respeta prefers-reduced-motion.
   ========================================================================== */
(() => {
    'use strict';

    const doc = document.documentElement;
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    /* Configuración del negocio: cambia solo este número si cambia el WhatsApp */
    const WA_NUMBER = '524521557950';
    const waUrl = (text) => `https://wa.me/${WA_NUMBER}` + (text ? `?text=${encodeURIComponent(text)}` : '');

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const canObserve = 'IntersectionObserver' in window;

    /* ----------------------------------------------------------------------
       1. Enlaces de WhatsApp con mensaje prellenado
       ---------------------------------------------------------------------- */
    function initWhatsAppLinks() {
        $$('[data-wa]').forEach((a) => { a.href = waUrl(a.dataset.wa); });
    }

    /* ----------------------------------------------------------------------
       2. Loader: progreso simulado que espera a la carga real de la página
       ---------------------------------------------------------------------- */
    function initLoader(onDone) {
        const loader = $('#loader');
        if (!loader) { doc.classList.add('is-ready'); onDone(); return; }

        const bar = $('.loader__bar span', loader);
        const pct = $('.loader__pct', loader);
        const MIN_TIME = reduceMotion.matches ? 250 : 1700;
        const t0 = performance.now();

        let pageLoaded = document.readyState === 'complete';
        let fontsReady = !(document.fonts && document.fonts.ready);
        let shown = 0;
        let lastPct = -1;
        let finished = false;

        doc.classList.add('is-loading');
        if (!pageLoaded) window.addEventListener('load', () => { pageLoaded = true; }, { once: true });
        if (!fontsReady) document.fonts.ready.then(() => { fontsReady = true; });

        const finish = () => {
            if (finished) return;
            finished = true;
            loader.classList.add('is-done');
            loader.setAttribute('aria-hidden', 'true');
            doc.classList.remove('is-loading');
            doc.classList.add('is-ready');
            onDone();
        };

        const tick = (now) => {
            const t = Math.min(1, (now - t0) / MIN_TIME);
            const eased = 1 - Math.pow(1 - t, 3);
            const ready = pageLoaded && fontsReady;
            /* Avanza hasta 92% mientras carga; completa al 100% cuando todo está listo */
            const target = ready ? eased : Math.min(eased, 0.92);
            shown += (target - shown) * 0.35;
            if (ready && t >= 1 && shown > 0.995) shown = 1;

            bar.style.setProperty('--p', shown.toFixed(3));
            const p = Math.round(shown * 100);
            if (p !== lastPct) { pct.textContent = `${p}%`; lastPct = p; }

            if (shown >= 1) { setTimeout(finish, 260); return; }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);

        /* Red de seguridad: nunca dejar al usuario atrapado en el loader */
        setTimeout(finish, 6000);
    }

    /* ----------------------------------------------------------------------
       3. Tema claro / oscuro
       ---------------------------------------------------------------------- */
    function initTheme() {
        const btn = $('#theme-toggle');
        if (!btn) return;
        const KEY = 'muelle-theme';
        const stored = () => { try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch (e) { return null; } };

        const apply = (theme, persist) => {
            doc.setAttribute('data-theme', theme);
            btn.setAttribute('aria-label', theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
            if (persist) { try { localStorage.setItem(KEY, theme); } catch (e) { /* almacenamiento bloqueado */ } }
        };

        apply(doc.getAttribute('data-theme') || 'light', false);
        btn.addEventListener('click', () => apply(doc.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true));

        /* Si la persona no eligió tema, seguir los cambios del sistema */
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        if (mq.addEventListener) mq.addEventListener('change', (e) => { if (!stored()) apply(e.matches ? 'dark' : 'light', false); });
    }

    /* ----------------------------------------------------------------------
       4. Header (estado al hacer scroll, enlace activo, menú móvil)
       ---------------------------------------------------------------------- */
    function initHeader() {
        const header = $('#header');
        const sentinel = $('#sentinel');
        if (canObserve && header && sentinel) {
            new IntersectionObserver(([entry]) => {
                header.classList.toggle('is-stuck', !entry.isIntersecting);
            }).observe(sentinel);
        }

        /* Enlace activo según la sección visible */
        const links = $$('.nav__links a');
        if (canObserve && links.length) {
            const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
            const spy = new IntersectionObserver((entries) => {
                entries.forEach((e) => {
                    const link = map.get(e.target.id);
                    if (!link) return;
                    if (e.isIntersecting) {
                        links.forEach((l) => l.removeAttribute('aria-current'));
                        link.setAttribute('aria-current', 'true');
                    } else {
                        link.removeAttribute('aria-current');
                    }
                });
            }, { rootMargin: '-40% 0px -55% 0px' });
            map.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
        }

        /* Menú móvil */
        const burger = $('#burger');
        const mnav = $('#mnav');
        if (!burger || !mnav) return;

        const setMenu = (open) => {
            doc.classList.toggle('menu-open', open);
            burger.setAttribute('aria-expanded', String(open));
            burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
            mnav.inert = !open;
            /* Con el menú abierto, el contenido de fondo no debe recibir foco */
            $$('#contenido, .site-footer, .fab').forEach((el) => { el.inert = open; });
        };
        burger.addEventListener('click', () => setMenu(!doc.classList.contains('menu-open')));
        $$('a', mnav).forEach((a) => a.addEventListener('click', () => setMenu(false)));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && doc.classList.contains('menu-open')) { setMenu(false); burger.focus(); }
        });
        window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
    }

    /* ----------------------------------------------------------------------
       5. Revelado al hacer scroll (con escalonado por lotes)
       ---------------------------------------------------------------------- */
    function initReveal() {
        const items = $$('[data-reveal]');
        if (!canObserve || reduceMotion.matches) { items.forEach((el) => el.classList.add('is-in')); return; }

        const io = new IntersectionObserver((entries) => {
            entries.filter((e) => e.isIntersecting).forEach((e, i) => {
                /* Respeta un --i definido en el HTML; si no hay, escalona por orden de aparición */
                if (!e.target.style.getPropertyValue('--i')) e.target.style.setProperty('--i', i);
                e.target.classList.add('is-in');
                io.unobserve(e.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

        items.forEach((el) => io.observe(el));
    }

    /* ----------------------------------------------------------------------
       6. Texto que se enciende palabra por palabra (solo si hay scroll-driven CSS)
       ---------------------------------------------------------------------- */
    function initSplitText() {
        const supported = window.CSS && CSS.supports && CSS.supports('animation-timeline: view()');
        if (!supported || reduceMotion.matches) return;

        $$('[data-split]').forEach((el) => {
            const words = el.textContent.trim().split(/\s+/);
            el.textContent = '';
            words.forEach((word, i) => {
                const span = document.createElement('span');
                span.className = 'w';
                span.textContent = word;
                el.append(span);
                if (i < words.length - 1) el.append(' ');
            });
        });
    }

    /* ----------------------------------------------------------------------
       7. Parallax suave de la foto del hero con el puntero (la foto se mueve en
          sentido contrario al mouse; el CSS la mantiene ampliada para no mostrar bordes)
       ---------------------------------------------------------------------- */
    function initHeroParallax() {
        const hero = $('#inicio');
        const bg = $('.hero__bg');
        if (!hero || !bg || !finePointer.matches || reduceMotion.matches) return;

        let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
        const RANGE = 18;

        const loop = () => {
            cx += (tx - cx) * 0.06;
            cy += (ty - cy) * 0.06;
            bg.style.setProperty('--mx', (cx * RANGE).toFixed(2));
            bg.style.setProperty('--my', (cy * RANGE).toFixed(2));
            raf = (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) ? requestAnimationFrame(loop) : 0;
        };
        const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

        hero.addEventListener('pointermove', (e) => {
            const r = hero.getBoundingClientRect();
            tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
            ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
            kick();
        });
        hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
    }

    /* ----------------------------------------------------------------------
       8. Botones magnéticos del hero
       ---------------------------------------------------------------------- */
    function initMagnetic() {
        if (!finePointer.matches || reduceMotion.matches) return;
        $$('.hero__cta .btn').forEach((btn) => {
            btn.addEventListener('pointermove', (e) => {
                const r = btn.getBoundingClientRect();
                const x = (e.clientX - r.left - r.width / 2) * 0.2;
                const y = (e.clientY - r.top - r.height / 2) * 0.32;
                btn.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
            });
            btn.addEventListener('pointerleave', () => { btn.style.translate = ''; });
        });
    }

    /* ----------------------------------------------------------------------
       9. Video del molcajete: reproduce solo cuando está visible
       ---------------------------------------------------------------------- */
    function initVideo() {
        const video = $('.media--video video');
        const btn = $('.media__toggle');
        if (!video || !btn) return;

        let visible = false;
        let userPaused = reduceMotion.matches;

        const sync = () => {
            if (visible && !userPaused) { const p = video.play(); if (p && p.catch) p.catch(() => {}); }
            else video.pause();
            btn.dataset.paused = String(userPaused);
            btn.setAttribute('aria-label', userPaused ? 'Reproducir video' : 'Pausar video');
        };

        btn.addEventListener('click', () => { userPaused = !userPaused; sync(); });

        if (canObserve) {
            new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0.35 }).observe(video);
        }
        sync();
    }

    /* ----------------------------------------------------------------------
       10. Formulario: valida y abre WhatsApp con el pedido armado
       ---------------------------------------------------------------------- */
    function initForm() {
        const form = $('#order-form');
        if (!form) return;

        const name = $('#f-name');
        const mode = $('#f-mode');
        const people = $('#f-people');
        const msg = $('#f-msg');
        const submit = $('#form-submit');
        const label = $('span', submit);
        const status = $('#form-status');
        const errName = $('#f-name-err');
        const errMsg = $('#f-msg-err');
        const defaultNote = status.textContent;
        const defaultLabel = label.textContent;

        const setError = (input, box, text) => {
            box.textContent = text;
            if (text) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
        };
        name.addEventListener('input', () => { if (name.value.trim().length >= 2) setError(name, errName, ''); });
        msg.addEventListener('input', () => { if (msg.value.trim().length >= 3) setError(msg, errMsg, ''); });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const n = name.value.trim();
            const m = msg.value.trim();
            let firstInvalid = null;

            if (n.length < 2) { setError(name, errName, 'Escribe tu nombre para saber cómo llamarte.'); firstInvalid = name; }
            else setError(name, errName, '');
            if (m.length < 3) { setError(msg, errMsg, 'Cuéntanos qué se te antoja para preparar tu pedido.'); firstInvalid = firstInvalid || msg; }
            else setError(msg, errMsg, '');
            if (firstInvalid) { firstInvalid.focus(); return; }

            const text = `Hola, soy ${n}. Quiero hacer un pedido ${mode.value}. Somos ${people.value}.\n\nMi pedido: ${m}`;
            const url = waUrl(text);

            submit.disabled = true;
            label.textContent = 'Abriendo WhatsApp...';
            window.open(url, '_blank', 'noopener');

            /* Respaldo por si el navegador bloquea la ventana nueva */
            const fallback = document.createElement('a');
            fallback.href = url; fallback.target = '_blank'; fallback.rel = 'noopener noreferrer';
            fallback.textContent = 'toca aquí para continuar';
            status.textContent = 'Listo. Si WhatsApp no se abrió, ';
            status.append(fallback, '.');

            setTimeout(() => {
                submit.disabled = false;
                label.textContent = defaultLabel;
            }, 2500);
            setTimeout(() => { status.textContent = defaultNote; }, 20000);
        });
    }

    /* ----------------------------------------------------------------------
       11. Año del pie de página
       ---------------------------------------------------------------------- */
    function initYear() {
        const y = $('#year');
        if (y) y.textContent = new Date().getFullYear();
    }

    /* ---------- Arranque ---------- */
    initWhatsAppLinks();
    initTheme();
    initHeader();
    initSplitText();
    initVideo();
    initForm();
    initHeroParallax();
    initMagnetic();
    initYear();
    initLoader(initReveal);
})();
