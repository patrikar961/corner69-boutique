/* =========================================================
   CORNER69 — carrousel de la fiche produit
   Bande qui defile, points, fleches. Accepte images et video.

   OU DEPOSER VOS FICHIERS : deux possibilites
     - depuis la page de gestion (#/gestion) : le fichier est
       envoye dans le stockage Supabase et range dans la colonne
       « photos » du produit.
     - a la main : dossier media/ a la racine du depot, puis
       declared dans config.js, champ « medias » du produit.

   Le type (image ou video) est reconnu tout seul d'apres
   l'extension. Si un fichier manque, un emplacement vide
   s'affiche : le site ne casse pas.
   ========================================================= */
(function () {
  'use strict';

  var piste = null;
  var index = 0;
  var total = 0;

  function $(s) { return document.querySelector(s); }

  var VIDEO = /\.(mp4|webm|mov|m4v)(\?|$)/i;

  /* Les visuels d'un produit viennent de deux endroits :
     - « medias » : liste declaree dans config.js, avec type/source
     - « photos » : fichiers deposes depuis la page de gestion
     On prend medias s'il existe, sinon photos. Dans les deux cas
     on devine le type d'apres l'extension, pour qu'une video
     deposee depuis la gestion soit lue comme une video. */
  function mediasDe(p) {
    if (p && p.medias && p.medias.length) {
      return p.medias.map(function (m) {
        if (typeof m === 'string') {
          return { type: VIDEO.test(m) ? 'video' : 'image', src: m };
        }
        if (m && m.src && !m.type) {
          m = { type: VIDEO.test(m.src) ? 'video' : 'image', src: m.src, alt: m.alt };
        }
        return m;
      }).filter(function (m) { return m && m.src; });
    }

    if (p && p.photos && p.photos.length) {
      return p.photos.map(function (src, i) {
        if (typeof src === 'object' && src && src.src) return src;
        return {
          type: VIDEO.test(String(src)) ? 'video' : 'image',
          src: src,
          alt: (p.nom || '') + ' ' + (i + 1)
        };
      }).filter(function (m) { return m && m.src; });
    }

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
        'Ajoutez des photos ou une video depuis la page de gestion, ' +
        'ou declarez-les dans <b>config.js</b>, champ « medias ».' +
      '</div>';
      return;
    }

    var items = medias.map(function (m) {
      if (m.type === 'video') {
        /* playsinline : la video reste dans la page, elle ne
           s'ouvre pas en plein ecran sur iPhone. */
        return '<div class="carrousel__item">' +
          '<video src="' + m.src + '" controls playsinline preload="metadata"></video>' +
        '</div>';
      }
      return '<div class="carrousel__item">' +
        '<img src="' + m.src + '" alt="' + (m.alt || p.nom || '') + '" loading="lazy">' +
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
