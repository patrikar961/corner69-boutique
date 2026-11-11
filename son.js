/* =========================================================
   CORNER69 — fond sonore
   Aucune interface visible : le son démarre au premier clic.
   La piste joue UNE SEULE FOIS.
   Réglages dans config.js, section « son ».
   ========================================================= */
(function () {
  'use strict';

  var reglages = (typeof BOUTIQUE !== 'undefined' && BOUTIQUE.son) ? BOUTIQUE.son : {};

  var VOLUME  = typeof reglages.volume === 'number' ? reglages.volume : 0.05;
  var FICHIERS = reglages.fichiers || ['ambiance.m4a', 'ambiance.mp3'];

  if (reglages.actif === false) return;

  var audio = document.createElement('audio');
  audio.loop = false;              /* une seule lecture */
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

  /* Le son se coupe quand l'onglet passe en arrière-plan,
     et reprend là où il en était au retour. */
  function piste() { return audio; }

  document.addEventListener('visibilitychange', function () {
    var a = piste();
    if (document.hidden) {
      if (!a.paused) { a.setAttribute('data-reprise', '1'); a.pause(); }
    } else if (a.getAttribute('data-reprise') === '1') {
      a.removeAttribute('data-reprise');
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    }
  });

  window.addEventListener('blur', function () {
    var a = piste();
    if (!a.paused) { a.setAttribute('data-reprise', '1'); a.pause(); }
  });

  window.addEventListener('focus', function () {
    var a = piste();
    if (a.getAttribute('data-reprise') === '1') {
      a.removeAttribute('data-reprise');
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    }
  });
})();
