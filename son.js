/* =========================================================
   CORNER69 — fond sonore
   Aucune interface visible : le son demarre au premier clic.
   La piste joue UNE SEULE FOIS.
   Reglages dans config.js, section « son ».
   ========================================================= */
(function () {
  'use strict';

  var reglages = (typeof BOUTIQUE !== 'undefined' && BOUTIQUE.son) ? BOUTIQUE.son : {};

  var VOLUME  = typeof reglages.volume === 'number' ? reglages.volume : 0.05;
  var FICHIERS = reglages.fichiers || ['ambiance.m4a', 'ambiance.mp3'];

  if (reglages.actif === false) return;

  var audio = document.createElement('audio');
  audio.loop = false;
  audio.preload = 'none';
  audio.volume = VOLUME;

  FICHIERS.forEach(function (nom) {
    var s = document.createElement('source');
    s.src = nom;
    s.type = nom.indexOf('.m4a') > -1 ? 'audio/mp4' : 'audio/mpeg';
    audio.appendChild(s);
  });

  var termine = false;

  function demarrer() {
    if (termine) return;
    var p = audio.play();
    if (p && typeof p.catch === 'function') p.catch(function () {});
  }

  audio.addEventListener('ended', function () { termine = true; });

  function premierGeste() {
    demarrer();
    document.removeEventListener('click', premierGeste, true);
    document.removeEventListener('keydown', premierGeste, true);
    document.removeEventListener('touchstart', premierGeste, true);
  }

  document.addEventListener('click', premierGeste, true);
  document.addEventListener('keydown', premierGeste, true);
  document.addEventListener('touchstart', premierGeste, true);

  /* Le son se coupe quand l'onglet passe en arriere-plan
     et reprend la ou il en etait au retour. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (!audio.paused) { audio.setAttribute('data-reprise', '1'); audio.pause(); }
    } else if (audio.getAttribute('data-reprise') === '1') {
      audio.removeAttribute('data-reprise');
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
    }
  });

  window.addEventListener('blur', function () {
    if (!audio.paused) { audio.setAttribute('data-reprise', '1'); audio.pause(); }
  });

  window.addEventListener('focus', function () {
    if (audio.getAttribute('data-reprise') === '1') {
      audio.removeAttribute('data-reprise');
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
    }
  });
})();
