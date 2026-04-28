/**
 * GDL Video Stories — Snippet Shopify
 *
 * A coller dans une section Custom Liquid sur la page produit.
 * Remplacer API_BASE par l'URL de l'app.
 *
 * Usage dans le theme :
 * <div id="gdl-stories" data-product-id="{{ product.id }}" style="margin: 16px 0;"></div>
 * <script src="https://gdl-sav.vercel.app/stories-snippet.js"></script>
 *
 * Ou copier le snippet inline depuis /videos/reglages
 */

(function () {
  'use strict';

  // ─── Configuration ───
  // Si charge via <script src>, detecte l'origine du script
  var scripts = document.getElementsByTagName('script');
  var currentScript = scripts[scripts.length - 1];
  var API = currentScript.src
    ? currentScript.src.replace(/\/stories-snippet\.js.*$/, '')
    : (window.GDL_STORIES_API || '');

  var container = document.getElementById('gdl-stories');
  if (!container) return;

  var productId = container.dataset.productId;
  if (!productId) return;

  // ─── Styles ───
  var style = document.createElement('style');
  style.textContent = [
    '.gdl-stories-row{display:flex;gap:12px;padding:16px 0;overflow-x:auto;scrollbar-width:none}',
    '.gdl-stories-row::-webkit-scrollbar{display:none}',
    '.gdl-story-circle{flex-shrink:0;cursor:pointer;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px}',
    '.gdl-story-ring{border-radius:50%;padding:3px;background:linear-gradient(135deg,#9333ea,#ec4899,#f97316)}',
    '.gdl-story-thumb{width:var(--gdl-circle-size,80px);height:var(--gdl-circle-size,80px);border-radius:50%;object-fit:cover;border:3px solid #fff;display:block;background:#f3f3f3}',
    '.gdl-story-label{font-size:11px;color:#666;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    // Player overlay
    '.gdl-player-overlay{position:fixed;bottom:20px;right:20px;z-index:99999;width:350px;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.3);background:#000;aspect-ratio:9/16}',
    '@media(max-width:768px){.gdl-player-overlay{position:fixed;inset:0;width:100%;height:100%;border-radius:0;bottom:auto;right:auto}}',
    '.gdl-player-video{width:100%;height:100%;object-fit:cover}',
    '.gdl-player-close{position:absolute;top:12px;right:12px;z-index:10;background:rgba(0,0,0,.5);border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center}',
    '.gdl-player-nav{position:absolute;top:0;bottom:0;width:40%;background:transparent;border:none;cursor:pointer;z-index:1}',
    '.gdl-player-prev{left:0}',
    '.gdl-player-next{right:0}',
    // Progress bars
    '.gdl-progress-bar{display:flex;gap:4px;position:absolute;top:8px;left:12px;right:12px;z-index:10}',
    '.gdl-progress-seg{flex:1;height:3px;background:rgba(255,255,255,.3);border-radius:2px;overflow:hidden}',
    '.gdl-progress-fill{height:100%;background:#fff;width:0%;transition:width .1s linear}',
    // Label + mute
    '.gdl-player-label{position:absolute;bottom:20px;left:16px;right:60px;color:#fff;font-size:14px;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,.5)}',
    '.gdl-player-mute{position:absolute;bottom:20px;right:16px;z-index:10;background:rgba(0,0,0,.5);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center}',
  ].join('\n');
  document.head.appendChild(style);

  // ─── Fetch videos ───
  fetch(API + '/api/videos/product/' + productId)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.videos || !data.videos.length) return;
      if (data.settings && data.settings.circle_size) {
        container.style.setProperty('--gdl-circle-size', data.settings.circle_size + 'px');
      }
      renderCircles(data.videos);
    })
    .catch(function (err) { console.warn('GDL Stories:', err); });

  // ─── Render circles ───
  function renderCircles(videos) {
    var row = document.createElement('div');
    row.className = 'gdl-stories-row';

    videos.forEach(function (video, i) {
      var circle = document.createElement('div');
      circle.className = 'gdl-story-circle';
      circle.innerHTML =
        '<div class="gdl-story-ring">' +
        '<img class="gdl-story-thumb" src="' + (video.thumbnail || '') + '" alt="' + video.label + '" onerror="this.style.background=\'#9333ea40\'">' +
        '</div>' +
        '<span class="gdl-story-label">' + (video.emoji || '') + ' ' + video.label + '</span>';
      circle.addEventListener('click', function () { openPlayer(videos, i); });
      row.appendChild(circle);
    });

    container.appendChild(row);
  }

  // ─── Player state ───
  var playerEl = null;
  var currentIndex = 0;
  var isMuted = true;
  var progressInterval = null;

  function openPlayer(videos, startIndex) {
    currentIndex = startIndex;
    if (playerEl) playerEl.remove();

    playerEl = document.createElement('div');
    playerEl.className = 'gdl-player-overlay';
    playerEl.innerHTML =
      '<div class="gdl-progress-bar">' +
      videos.map(function () { return '<div class="gdl-progress-seg"><div class="gdl-progress-fill"></div></div>'; }).join('') +
      '</div>' +
      '<video class="gdl-player-video" playsinline muted autoplay></video>' +
      '<button class="gdl-player-close">&times;</button>' +
      '<button class="gdl-player-nav gdl-player-prev"></button>' +
      '<button class="gdl-player-nav gdl-player-next"></button>' +
      '<div class="gdl-player-label"></div>' +
      '<button class="gdl-player-mute">\uD83D\uDD07</button>';

    document.body.appendChild(playerEl);

    var videoEl = playerEl.querySelector('.gdl-player-video');
    var label = playerEl.querySelector('.gdl-player-label');
    var muteBtn = playerEl.querySelector('.gdl-player-mute');
    var closeBtn = playerEl.querySelector('.gdl-player-close');
    var prevBtn = playerEl.querySelector('.gdl-player-prev');
    var nextBtn = playerEl.querySelector('.gdl-player-next');

    function loadVideo(index) {
      currentIndex = index;
      var v = videos[index];
      videoEl.src = v.url;
      videoEl.muted = isMuted;
      videoEl.play().catch(function () {});
      label.textContent = (v.emoji || '') + ' ' + v.label;
      updateProgress(videos.length, index);
    }

    function updateProgress(total, activeIdx) {
      var segments = playerEl.querySelectorAll('.gdl-progress-fill');
      segments.forEach(function (s, i) {
        s.style.width = i < activeIdx ? '100%' : '0%';
      });
      if (progressInterval) clearInterval(progressInterval);
      progressInterval = setInterval(function () {
        if (videoEl.duration) {
          var pct = (videoEl.currentTime / videoEl.duration) * 100;
          segments[activeIdx].style.width = pct + '%';
        }
      }, 100);
    }

    videoEl.addEventListener('ended', function () {
      if (currentIndex < videos.length - 1) loadVideo(currentIndex + 1);
      else closePlayer();
    });

    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      closePlayer();
    });

    prevBtn.addEventListener('click', function () {
      if (currentIndex > 0) loadVideo(currentIndex - 1);
    });

    nextBtn.addEventListener('click', function () {
      if (currentIndex < videos.length - 1) loadVideo(currentIndex + 1);
      else closePlayer();
    });

    muteBtn.addEventListener('click', function () {
      isMuted = !isMuted;
      videoEl.muted = isMuted;
      muteBtn.textContent = isMuted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
    });

    // Touch swipe
    var touchStartX = 0;
    playerEl.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });

    playerEl.addEventListener('touchend', function (e) {
      var diff = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(diff) > 50) {
        if (diff < 0 && currentIndex < videos.length - 1) loadVideo(currentIndex + 1);
        else if (diff > 0 && currentIndex > 0) loadVideo(currentIndex - 1);
      }
    }, { passive: true });

    document.addEventListener('keydown', handleEsc);
    loadVideo(startIndex);
  }

  function handleEsc(e) {
    if (e.key === 'Escape') closePlayer();
  }

  function closePlayer() {
    if (progressInterval) clearInterval(progressInterval);
    document.removeEventListener('keydown', handleEsc);
    if (playerEl) { playerEl.remove(); playerEl = null; }
  }
})();
