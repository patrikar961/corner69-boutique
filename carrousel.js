/* =========================================================
   CORNER69 — carrousel de la fiche produit
   Bande qui defile, points, fleches. Accepte images et video.

   OU DEPOSER VOS FICHIERS : dossier media/ a la racine du depot
       media/p1-1.jpg      premiere image du produit p1
       media/p1-2.jpg      deuxieme image
       media/p1.mp4        video (optionnelle)

   La liste se regle dans config.js, champ « medias » de chaque
   produit. Si un fichier manque, l'emplacement reste vide :
   le site ne casse pas.
   ========================================================= */
(function () {
  'use strict';

  var piste = null;
  var index = 0;
  var total = 0;

  function mediasDe(p) {
    if (p && p.medias && p.medias.length) return p.medias;
    return [];
  }

  function construire(p) {
    var box = document.getElementById('carrousel');
    if (!box) return;

    var medias = mediasDe(p);
    total = medias.length;

    if (!medias.length) {
      box.innerHTML = '<div class="carrousel__vide">' +
        '<b>Aucun visuel pour ce produit</b>' +
        'Déposez vos images dans le dossier <b>media/</b> puis déclarez-les ' +
        'dans <b>config.js</b>, champ « medias » du produit.' +
      '</div>';
      return;
    }

    var items = medias.map(function (m) {
      if (m.type === 'video') {
        return '<div class="carrousel__item">' +
          '<video src="' + m.src + '" controls playsinline preload="metadata"></video>' +
        '</div>';
      }
      return '<div class="carrousel__item">' +
        '<img src="' + m.src + '" alt="' + (m.alt || p.nom) + '" loading="lazy">' +
      '</div>';
    }).join('');

    var points = medias.map(function (m, i) {
      return '<button type="button" data-point="' + i + '"' +
        (i === 0 ? ' class="actif"' : '') +
        ' aria-label="Visuel ' + (i + 1) + '"></button>';
    }).join('');

    box.innerHTML =
      '<div class="carrousel__piste" id="carrouselPiste">' + items + '</div>' +
      '<div class="carrousel__points" id="carrouselPoints">' + points + '</div>' +
      '<div class="carrousel__fleches">' +
        '<button type="button" id="carrouselPrec" aria-label="Précédent">←</button>' +
        '<button type="button" id="carrouselSuiv" aria-label="Suivant">→</button>' +
      '</div>';

    piste = document.getElementById('carrouselPiste');

    piste.addEventListener('scroll', function () {
      var largeur = piste.clientWidth;
      if (!largeur) return;
      var i = Math.round(piste.scrollLeft / largeur);
      if (i !== index) majPoints(i);
    });

    document.getElementById('carrouselPrec').addEventListener('click', function () {
      aller(index - 1);
    });
    document.getElementById('carrouselSuiv').addEventListener('click', function () {
      aller(index + 1);
    });

    document.getElementById('carrouselPoints').addEventListener('click', function (e) {
      var b = e.target.closest('[data-point]');
      if (!b) return;
      aller(parseInt(b.getAttribute('data-point'), 10));
    });

    index = 0;
  }

  function aller(i) {
    if (!piste || !total) return;
    if (i < 0) i = total - 1;
    if (i >= total) i = 0;
    piste.scrollTo({ left: i * piste.clientWidth, behavior: 'smooth' });
    majPoints(i);
  }

  function majPoints(i) {
    index = i;
    var pts = document.querySelectorAll('[data-point]');
    pts.forEach(function (b, n) {
      b.classList.toggle('actif', n === i);
    });
  }

  /* app.js signale le produit ouvert */
  document.addEventListener('corner69:produit', function (e) {
    construire(e.detail);
  });
})();
