// Marquesina: duplica los clips para lograr un loop infinito sin cortes.
// OJO: se usa cloneNode (no track.innerHTML += track.innerHTML), porque
// reasignar innerHTML obliga al navegador a destruir y re-crear TODOS los
// elementos <video> originales desde cero (re-descargando/re-decodificando
// los 10 clips), lo cual es muy costoso. cloneNode solo duplica el DOM,
// sin tocar los videos originales.
const track = document.getElementById('marqueeTrack');
if(track){
  const originalClips = [...track.children];
  const fragment = document.createDocumentFragment();
  originalClips.forEach(clip => fragment.appendChild(clip.cloneNode(true)));
  track.appendChild(fragment);
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------
// SCROLL: un solo listener (pasivo) para header + texto del hero,
// con el trabajo real hecho dentro de requestAnimationFrame para no
// disparar cálculos de layout en cada evento de scroll (más fluido).
// ---------------------------------------------------------------
const header = document.getElementById('siteHeader');
const heroCopy = document.getElementById('heroCopy');
let lastY = window.scrollY;
let scrollTicking = false;

// Cuánto hay que scrollear (en px) para que el texto del hero pase de
// visible del todo a invisible del todo. Al ser una función continua de
// la posición (no de la dirección), el desvanecido es gradual tanto al
// bajar como al subir: es simplemente proporcional a cuánto se ha scrolleado.
const HERO_FADE_RANGE = 320;

function handleScroll(){
  const y = window.scrollY;
  const goingDown = y > lastY;

  header.classList.toggle('scrolled', y > 40);
  if(goingDown && y > 120){
    header.classList.add('hide-nav');   // scrolling down -> ocultar header
  }else{
    header.classList.remove('hide-nav'); // scrolling up -> mostrar header
  }

  // Texto inicial del hero: se desvanece gradualmente al bajar y reaparece
  // gradualmente al subir, en proporción directa a la posición de scroll.
  if(heroCopy){
    if(prefersReducedMotion){
      heroCopy.style.opacity = 1;
    }else{
      const fade = 1 - Math.min(Math.max(y / HERO_FADE_RANGE, 0), 1);
      heroCopy.style.opacity = fade;
      heroCopy.style.pointerEvents = fade < 0.05 ? 'none' : 'auto';
    }
  }

  lastY = y;
  scrollTicking = false;
}

window.addEventListener('scroll', () => {
  if(!scrollTicking){
    requestAnimationFrame(handleScroll);
    scrollTicking = true;
  }
}, { passive:true });

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));

// Scroll reveal — además, la PRIMERA vez que un bloque entra en pantalla,
// dispara el efecto "máquina de escribir" en cualquier texto marcado con
// [data-tw] dentro de él (títulos de sección, labels, etc.), igual que en
// el hero. typewriterChars() está declarada más abajo pero funciona aquí por
// hoisting de funciones.
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if(e.isIntersecting){
      e.target.classList.add('in');
      e.target.querySelectorAll('[data-tw]').forEach(el => {
        if(!el.dataset.twDone){
          el.dataset.twDone = '1';
          typewriterChars(el, 16, 60);
        }
      });
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.15 });
revealEls.forEach(el => io.observe(el));

// ---------------------------------------------------------------
// EFECTO "MÁQUINA DE ESCRIBIR" — dos técnicas, cada una donde es segura.
//
// typewriterChars(): letra por letra con fade+translateY (.tw-c). Se usa
// en TODO el texto que NO tiene degradado (.eyebrow, y los demás títulos
// [data-tw] de la página). Es la animación "de siempre", suave y con
// cascada natural entre letras — nunca causó el bug, porque el bug solo
// aparecía al combinar esta animación con -webkit-background-clip:text.
//
// typewriterReveal(): SOLO para el wordmark ("SIAN T"), que sí tiene el
// degradado. En vez de tocar cada letra, envuelve todo el texto en un
// único <span class="tw-reveal"> y anima su "width" de 0 al ancho real
// (medido con scrollWidth) — el texto en sí (color, degradado,
// background-clip) nunca se anima, así que no puede volver a glitchear.
// Para que se sienta igual de suave que la versión letra por letra, usa
// una curva continua (no steps) y un fundido de borde definido en CSS
// (.tw-reveal, ver styles.css) para que el texto se vea "materializar"
// en vez de cortarse en seco.
// ---------------------------------------------------------------
function typewriterChars(el, charDelayMs, startDelayMs){
  if(!el) return startDelayMs;
  if(prefersReducedMotion) return startDelayMs;
  let i = 0;

  function wrapNode(node){
    if(node.nodeType === Node.TEXT_NODE){
      const frag = document.createDocumentFragment();
      for(const ch of node.textContent){
        const span = document.createElement('span');
        span.className = ch === ' ' ? 'tw-c tw-space' : 'tw-c';
        span.textContent = ch;
        span.style.animationDelay = `${startDelayMs + i * charDelayMs}ms`;
        frag.appendChild(span);
        if(ch !== ' ') i++;
      }
      node.replaceWith(frag);
    }else if(node.nodeType === Node.ELEMENT_NODE){
      [...node.childNodes].forEach(wrapNode);
    }
  }

  [...el.childNodes].forEach(wrapNode);
  return startDelayMs + i * charDelayMs;
}

function typewriterReveal(el, msPerChar, startDelayMs){
  if(!el) return startDelayMs;
  if(prefersReducedMotion) return startDelayMs;

  const reveal = document.createElement('span');
  reveal.className = 'tw-reveal';
  while(el.firstChild) reveal.appendChild(el.firstChild);
  el.appendChild(reveal);

  const charCount = Math.max(reveal.textContent.replace(/\s/g, '').length, 1);
  const duration = Math.min(Math.max(charCount * msPerChar, 220), 2200);
  const naturalWidth = reveal.scrollWidth;

  reveal.style.width = '0px';
  reveal.style.transitionProperty = 'width';
  reveal.style.transitionDuration = `${duration}ms`;
  reveal.style.transitionDelay = `${startDelayMs}ms`;
  // Curva continua (no steps): junto con el fundido de borde definido en
  // CSS, esto es lo que hace que el avance se sienta suave y no "a
  // saltos" duros de carácter.
  reveal.style.transitionTimingFunction = 'cubic-bezier(.45,.05,.35,1)';

  reveal.getBoundingClientRect(); // confirmar width:0px antes de animar
  requestAnimationFrame(() => {
    reveal.style.width = naturalWidth + 'px';
  });

  reveal.addEventListener('transitionend', function onEnd(e){
    if(e.propertyName !== 'width') return;
    reveal.removeEventListener('transitionend', onEnd);
    reveal.style.width = '';
    reveal.style.overflow = 'visible';
  });

  return startDelayMs + duration;
}

const eyebrowEl = document.querySelector('#heroCopy .eyebrow');
const wordmarkEl = document.querySelector('#heroCopy h1.wordmark');
const heroSubEl = document.querySelector('#heroCopy .hero-sub');
const heroCtasEl = document.querySelector('#heroCopy .hero-ctas');
const scrollCueEl = document.querySelector('#heroCopy .scroll-cue');

if(eyebrowEl && wordmarkEl){
  const afterEyebrow = typewriterChars(eyebrowEl, 14, 150);
  const afterWordmark = typewriterReveal(wordmarkEl, 55, afterEyebrow + 150);
  const revealDelay = afterWordmark + 250;

  if(heroSubEl)  heroSubEl.style.animationDelay  = `${revealDelay}ms`;
  if(heroCtasEl) heroCtasEl.style.animationDelay = `${revealDelay + 180}ms`;
  if(scrollCueEl) scrollCueEl.style.animationDelay = `${revealDelay + 340}ms`;
}

// ---------------------------------------------------------------
// RENDIMIENTO: solo reproduce los videos de fondo (hero flotante +
// marquesina) cuando están realmente visibles en pantalla. Esto evita
// que 20-30 videos intenten decodificarse a la vez y hagan lenta la web.
// Como además ya no tienen "autoplay" en el HTML (ver index.html), el
// navegador tampoco intenta cargarlos de entrada: solo se cargan y
// reproducen cuando este observer los detecta en pantalla.
// ---------------------------------------------------------------
const bgVideos = document.querySelectorAll('.hero-float video, .clip-pill video, #trabajos .card video.preview');
// OJO (arreglo de las trabas): antes se usaba threshold:0.15 sin rootMargin,
// así que cada clip de la marquesina (que se mueve todo el tiempo por la
// animación CSS) cruzaba el 15% de visibilidad muchas veces por minuto,
// disparando play()/pause() en cadena sobre 20+ videos a la vez. Cada
// play() en un <video preload="none"> obliga al navegador a pedir datos y
// re-iniciar el decodificador, así que ese "thrashing" era la causa real
// de que los clips se vieran trabados/entrecortados, no el loop en sí.
// rootMargin amplía el área de detección: el clip empieza a cargar/reproducir
// ANTES de entrar visualmente (mientras aún está detrás de la máscara de
// desvanecido) y solo se pausa bastante después de salir, así el video ya
// está fluyendo cuando se vuelve visible y no se pausa/reanuda a cada rato.
const playObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const vid = entry.target;
    if(entry.isIntersecting){
      vid.play().catch(() => {});
    }else{
      vid.pause();
    }
  });
}, { threshold: 0, rootMargin: '400px 200px' });
bgVideos.forEach(v => playObserver.observe(v));

// ---------------------------------------------------------------
// MODAL DE "MIS TRABAJOS": reproduce el video de YouTube correspondiente,
// con sonido y controles, dentro de la misma página (sin salir a youtube.com).
// ---------------------------------------------------------------
const videoModal = document.getElementById('videoModal');
const videoModalInner = document.getElementById('videoModalInner');
const modalPlayer = document.getElementById('modalPlayer');
const modalClose = document.getElementById('modalClose');

function openVideoModal(youtubeId, orientation){
  if(!youtubeId) return;
  videoModalInner.classList.toggle('is-vertical', orientation === 'v');

  const src = `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=0&rel=0&modestbranding=1&playsinline=1`;
  modalPlayer.innerHTML = `<iframe src="${src}" title="Video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;

  videoModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeVideoModal(){
  videoModal.classList.remove('open');
  document.body.style.overflow = '';
  modalPlayer.innerHTML = ''; // quitar el iframe detiene la reproducción
}

document.querySelectorAll('#trabajos .card[data-yt]').forEach(card => {
  card.addEventListener('click', () => {
    openVideoModal(card.dataset.yt, card.dataset.orientation);
  });
});

modalClose.addEventListener('click', closeVideoModal);
videoModal.addEventListener('click', (e) => {
  if(e.target === videoModal) closeVideoModal(); // click fuera del video cierra
});
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape') closeVideoModal();
});