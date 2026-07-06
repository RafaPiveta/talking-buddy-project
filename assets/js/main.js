// Year
const year = document.getElementById('year');
if (year) {
  year.textContent = new Date().getFullYear();
}

// Remove cards/figures whose image file was deleted.
document.querySelectorAll('img').forEach((img) => {
  img.addEventListener('error', () => {
    const frame = img.closest('.carousel-slide') || img.closest('figure, article');
    if (frame) frame.remove();
  }, { once: true });
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Keep muted demo videos actually playing in browsers that require a scripted nudge after load.
const initAutoplayVideos = () => {
  const videos = Array.from(document.querySelectorAll('video[autoplay]'));
  if (!videos.length) return;

  const tryPlay = (video) => {
    video.muted = true;
    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => {});
    }
  };

  videos.forEach((video) => {
    video.loop = true;
    video.playsInline = true;
    if (video.readyState >= 2) {
      tryPlay(video);
    } else {
      video.addEventListener('canplay', () => tryPlay(video), { once: true });
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    videos.forEach((video) => {
      if (video.paused) tryPlay(video);
    });
  });
};

initAutoplayVideos();

// Technical term tooltips are rendered outside their section so they cannot be clipped by images or cards.
const initTermTooltips = () => {
  const terms = Array.from(document.querySelectorAll('.term[data-tip]'));
  if (!terms.length) return;

  const tooltip = document.createElement('div');
  tooltip.className = 'term-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  document.body.appendChild(tooltip);

  let activeTerm = null;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const positionTooltip = () => {
    if (!activeTerm || !tooltip.classList.contains('is-visible')) return;

    const termRect = activeTerm.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();
    const margin = 12;
    const gap = 10;
    const preferredTop = termRect.top - tipRect.height - gap;
    const fallbackTop = termRect.bottom + gap;
    const top = preferredTop >= margin ? preferredTop : fallbackTop;
    const left = clamp(
      termRect.left + termRect.width / 2 - tipRect.width / 2,
      margin,
      Math.max(margin, window.innerWidth - tipRect.width - margin)
    );

    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(clamp(top, margin, window.innerHeight - tipRect.height - margin))}px`;
  };

  const showTooltip = (term) => {
    const text = term.getAttribute('data-tip');
    if (!text) return;
    activeTerm = term;
    term.removeAttribute('title');
    tooltip.textContent = text;
    tooltip.classList.add('is-visible');
    requestAnimationFrame(positionTooltip);
  };

  const hideTooltip = (term) => {
    if (term && activeTerm && term !== activeTerm) return;
    activeTerm = null;
    tooltip.classList.remove('is-visible');
  };

  terms.forEach((term) => {
    term.removeAttribute('title');
    term.addEventListener('pointerenter', () => showTooltip(term));
    term.addEventListener('pointerleave', () => hideTooltip(term));
    term.addEventListener('focusin', () => showTooltip(term));
    term.addEventListener('focusout', () => hideTooltip(term));
  });

  window.addEventListener('scroll', positionTooltip, { passive: true });
  window.addEventListener('resize', positionTooltip);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideTooltip();
  });
  window.addEventListener('talkingbuddy:languagechange', () => {
    if (!activeTerm) return;
    tooltip.textContent = activeTerm.getAttribute('data-tip') || '';
    requestAnimationFrame(positionTooltip);
  });
};

initTermTooltips();

// Rotating hero promise.
const heroKeyword = document.getElementById('hero-keyword');
if (heroKeyword) {
  const heroWords = {
    pt: ['offline', 'localmente', 'com privacidade'],
    en: ['offline', 'locally', 'with privacy'],
    es: ['offline', 'localmente', 'con privacidad'],
  };
  let heroIndex = 0;
  let heroTimer = null;

  const currentLanguageKey = () => {
    const lang = document.documentElement.lang || 'pt-BR';
    if (lang.startsWith('en')) return 'en';
    if (lang.startsWith('es')) return 'es';
    return 'pt';
  };

  const setHeroWord = (word) => {
    heroKeyword.classList.add('is-swapping');
    window.setTimeout(() => {
      heroKeyword.textContent = word;
      heroKeyword.classList.remove('is-swapping');
    }, reduceMotion ? 0 : 180);
  };

  const renderHeroWord = () => {
    const words = heroWords[currentLanguageKey()];
    heroIndex %= words.length;
    setHeroWord(words[heroIndex]);
  };

  const startHeroRotation = () => {
    if (reduceMotion || heroTimer) return;
    heroTimer = window.setInterval(() => {
      const words = heroWords[currentLanguageKey()];
      heroIndex = (heroIndex + 1) % words.length;
      renderHeroWord();
    }, 2800);
  };

  window.addEventListener('talkingbuddy:languagechange', () => {
    heroIndex = 0;
    renderHeroWord();
  });

  renderHeroWord();
  startHeroRotation();
}

// Image lightbox for cropped thumbnails and gallery photos.
const lightbox = document.getElementById('image-lightbox');
if (lightbox) {
  const lightboxImage = lightbox.querySelector('img');
  const lightboxCaption = lightbox.querySelector('figcaption');
  const lightboxClose = lightbox.querySelector('.lightbox__close');
  let lastFocusedElement = null;

  const closeLightbox = () => {
    lightbox.hidden = true;
    document.body.classList.remove('lightbox-open');
    lightboxImage.removeAttribute('src');
    lightboxCaption.textContent = '';
    if (lastFocusedElement) lastFocusedElement.focus();
  };

  const getImageCaption = (img) => {
    const carouselCaption = img.closest('.carousel-slide')?.querySelector('.carousel-caption h3');
    const figureCaption = img.closest('figure')?.querySelector('figcaption');
    return carouselCaption?.textContent?.trim() || figureCaption?.textContent?.trim() || img.alt || '';
  };

  document.addEventListener('click', (event) => {
    const img = event.target.closest('img');
    if (!img || img.closest('.lightbox')) return;
    event.preventDefault();
    lastFocusedElement = document.activeElement;
    lightboxImage.src = img.currentSrc || img.src;
    lightboxImage.alt = img.alt || 'Imagem ampliada';
    lightboxCaption.textContent = getImageCaption(img);
    lightbox.hidden = false;
    document.body.classList.add('lightbox-open');
    lightboxClose.focus();
  });

  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !lightbox.hidden) closeLightbox();
  });
}

// Horizontal galleries with a centered active slide and faded neighbors.
document.querySelectorAll('[data-carousel]').forEach((carousel) => {
  const viewport = carousel.querySelector('.carousel-viewport');
  const track = carousel.querySelector('.carousel-track');
  const previousButton = carousel.querySelector('[data-carousel-prev]');
  const nextButton = carousel.querySelector('[data-carousel-next]');
  const counter = carousel.querySelector('.carousel-count');
  const originalSlides = Array.from(track?.querySelectorAll('.carousel-slide') || []);
  if (!viewport || !track || originalSlides.length === 0) return;

  const realCount = originalSlides.length;
  let slides = originalSlides;
  let activeIndex = realCount > 1 ? 1 : 0;
  let timerId = null;
  let transitionEnabled = true;

  if (realCount > 1) {
    const firstClone = originalSlides[0].cloneNode(true);
    const lastClone = originalSlides[realCount - 1].cloneNode(true);
    [...firstClone.querySelectorAll('img'), ...lastClone.querySelectorAll('img')].forEach((img) => {
      img.loading = 'eager';
    });
    firstClone.dataset.clone = 'first';
    lastClone.dataset.clone = 'last';
    firstClone.setAttribute('aria-hidden', 'true');
    lastClone.setAttribute('aria-hidden', 'true');
    track.insertBefore(lastClone, originalSlides[0]);
    track.appendChild(firstClone);
    slides = Array.from(track.querySelectorAll('.carousel-slide'));
  }

  const setTransition = (enabled) => {
    transitionEnabled = enabled;
    track.style.transition = enabled ? '' : 'none';
    track.classList.toggle('is-snapping', !enabled);
  };

  const realIndex = () => {
    if (realCount < 2) return 0;
    if (activeIndex === 0) return realCount - 1;
    if (activeIndex === realCount + 1) return 0;
    return activeIndex - 1;
  };

  const normalizeActiveIndex = () => {
    if (!slides.length) return;
    if (realCount < 2) {
      activeIndex = 0;
      return;
    }

    if (activeIndex < 0) activeIndex = realCount;
    if (activeIndex > realCount + 1) activeIndex = 1;
    if (activeIndex > slides.length - 1) activeIndex = slides.length - 1;
  };

  const render = () => {
    normalizeActiveIndex();

    slides.forEach((slide, index) => {
      slide.classList.toggle('is-active', index === activeIndex);
      slide.setAttribute('aria-hidden', index === activeIndex && !slide.dataset.clone ? 'false' : 'true');
    });

    const activeSlide = slides[activeIndex];
    if (!activeSlide) return;

    const viewportCenter = viewport.clientWidth / 2;
    const slideCenter = activeSlide.offsetLeft + activeSlide.offsetWidth / 2;
    track.style.transform = `translateX(${viewportCenter - slideCenter}px)`;

    if (counter) counter.textContent = `${realIndex() + 1} / ${realCount}`;
  };

  const goTo = (index) => {
    if (realCount < 2) return;
    if (!transitionEnabled) return;
    activeIndex = index;
    render();
  };

  const next = () => goTo(activeIndex + 1);
  const previous = () => goTo(activeIndex - 1);

  previousButton?.addEventListener('click', previous);
  nextButton?.addEventListener('click', next);

  track.addEventListener('transitionend', (event) => {
    if (event.target !== track || realCount < 2) return;

    if (activeIndex === 0 || activeIndex === realCount + 1) {
      setTransition(false);
      activeIndex = activeIndex === 0 ? realCount : 1;
      render();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setTransition(true));
      });
    }
  });

  const stopAutoplay = () => {
    if (!timerId) return;
    clearInterval(timerId);
    timerId = null;
  };

  const startAutoplay = () => {
    if (reduceMotion || carousel.dataset.autoplay !== 'true' || realCount < 2 || timerId) return;
    timerId = setInterval(next, 3400);
  };

  carousel.addEventListener('mouseenter', stopAutoplay);
  carousel.addEventListener('mouseleave', startAutoplay);
  carousel.addEventListener('focusin', stopAutoplay);
  carousel.addEventListener('focusout', startAutoplay);
  window.addEventListener('resize', render);

  render();
  startAutoplay();
});

// Count-up animation for result metrics.
const metricNumbers = Array.from(document.querySelectorAll('.metric__num[data-count]'));
if (metricNumbers.length) {
  const metricLocale = () => {
    const lang = document.documentElement.lang || 'pt-BR';
    if (lang.startsWith('en')) return 'en-US';
    if (lang.startsWith('es')) return 'es-ES';
    return 'pt-BR';
  };

  const renderMetric = (element, value) => {
    const prefix = element.dataset.prefix || '';
    const suffix = element.dataset.suffix || '';
    const decimals = Number(element.dataset.decimals || 0);
    const formatted = Number(value).toLocaleString(metricLocale(), {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    element.innerHTML = `${prefix}${formatted}${suffix ? `<small>${suffix}</small>` : ''}`;
  };

  const animateMetric = (element) => {
    if (element.dataset.animated === 'true') return;
    element.dataset.animated = 'true';

    const target = Number(element.dataset.count || 0);
    const duration = 1050;
    const startTime = performance.now();

    if (reduceMotion) {
      renderMetric(element, target);
      return;
    }

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      renderMetric(element, target * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };

    renderMetric(element, 0);
    requestAnimationFrame(tick);
  };

  if ('IntersectionObserver' in window) {
    const metricObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateMetric(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.35 });

    metricNumbers.forEach((element) => metricObserver.observe(element));
  } else {
    metricNumbers.forEach(animateMetric);
  }

  window.addEventListener('talkingbuddy:languagechange', () => {
    metricNumbers.forEach((element) => {
      if (element.dataset.animated === 'true') renderMetric(element, Number(element.dataset.count || 0));
    });
  });
}

// Lightweight scroll reveal. Only inner blocks animate, so anchor navigation never hides a full section.
if (!reduceMotion && 'IntersectionObserver' in window) {
  const motionTargets = document.querySelectorAll([
    '.hero__copy',
    '.hero__media',
    '.section__head',
    '.two-col > div',
    '.frame',
    '.doc-callout',
    '.card',
    '.photo-strip figure',
    '.step-card',
    '.pipeline li',
    '.software-copy',
    '.media-carousel',
    '.software-gallery figure',
    '.feature-card',
    '.exp__robot',
    '.exp__chat',
    '.metric',
    '.test-card',
    '.gallery-block',
    '.author-card'
  ].join(','));

  document.documentElement.classList.add('motion-ready');

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, {
    rootMargin: '0px 0px -8% 0px',
    threshold: 0.08
  });

  motionTargets.forEach((target, index) => {
    target.classList.add('motion-item');
    target.style.transitionDelay = `${Math.min(index % 6, 5) * 45}ms`;
    revealObserver.observe(target);
  });
}
