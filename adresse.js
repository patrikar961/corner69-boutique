/* =========================================================
   CORNER69 — suggestions d'adresse
   Utilise l'API Adresse du gouvernement français :
   gratuite, sans clé, sans compte, données officielles.

   On tape « 12 rue de la » -> une liste apparaît,
   un clic remplit la rue, le code postal et la ville.
   ========================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     RÉGLAGES
     - limite : nombre de suggestions affichées.
     - pause : délai avant d'interroger le serveur (ms).
     - zoneSeule : false = toutes les adresses sont proposées.
     --------------------------------------------------------- */
  var REGLAGES = {
    limite: 8,
    pause: 220,
    zoneSeule: false     /* toutes les adresses sont proposees */
  };

  var zone = (typeof BOUTIQUE !== 'undefined' && BOUTIQUE.zone) ? BOUTIQUE.zone : null;
  var API = 'https://api-adresse.data.gouv.fr/search/?limit=20&q=';

  var champ = document.getElementById('cAdr');
  var liste = document.getElementById('cAdrListe');
  var cp = document.getElementById('cCp');
  var ville = document.getElementById('cVille');
  if (!champ || !liste) return;

  var minuteur = null;
  var requete = null;
  var resultats = [];
  var indexActif = -1;

  /* ---------------------------------------------------------
     LA ZONE : sans restriction, tout passe.
     --------------------------------------------------------- */
  function dansZone(cpTexte) {
    if (!zone || !zone.departements || !zone.departements.length) return true;
    if (zone.toutes) return true;
    if (!cpTexte) return false;
    return zone.departements.indexOf(String(cpTexte).substring(0, 2)) > -1;
  }

  /* ---------------------------------------------------------
     AFFICHAGE
     --------------------------------------------------------- */
  function fermer() {
    liste.hidden = true;
    liste.innerHTML = '';
    champ.setAttribute('aria-expanded', 'false');
    indexActif = -1;
    resultats = [];
  }

  function ouvrir(items) {
    if (!items.length) { fermer(); return; }
    resultats = items;

    liste.innerHTML = items.map(function (r, i) {
      return '<li role="option" data-index="' + i + '" class="suggestion">' +
        '<span class="suggestion__rue">' + r.rue + '</span>' +
        '<span class="suggestion__ville">' + r.cp + ' ' + r.ville + '</span>' +
      '</li>';
    }).join('');

    liste.hidden = false;
    champ.setAttribute('aria-expanded', 'true');
    indexActif = -1;
  }

  function surligne(n) {
    var li = liste.querySelectorAll('.suggestion');
    li.forEach(function (el, i) { el.classList.toggle('actif', i === n); });
    indexActif = n;
  }

  /* ---------------------------------------------------------
     CHOIX D'UNE SUGGESTION
     --------------------------------------------------------- */
  function choisir(r) {
    champ.value = r.rue;
    if (cp) cp.value = r.cp;
    if (ville) ville.value = r.ville;
    fermer();
    champ.focus();
  }

  /* ---------------------------------------------------------
     INTERROGATION DE L'API
     --------------------------------------------------------- */
  function chercher(texte) {
    if (requete) requete.abort();
    requete = new AbortController();

    var url = API + encodeURIComponent(texte);

    fetch(url, { signal: requete.signal })
      .then(function (r) {
        if (!r.ok) throw new Error('reponse ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var items = (data.features || []).map(function (f) {
          var p = f.properties;
          /* l'API renvoie le numero dans « name » et la voie dans
             « street » : on les assemble sans jamais repeter la voie */
          var numero = (p.housenumber || '').trim();
          var voie = (p.street || p.name || '').trim();
          var libelle = numero ? (numero + ' ' + voie) : voie;

          return {
            rue: libelle,
            cp: p.postcode || '',
            ville: p.city || p.municipality || '',
            zone: dansZone(p.postcode || '')
          };
        });

        /* ceinture et bretelles : on retire ce qui n'est pas dans la zone,
           seulement si une zone est declaree dans config.js */
        if (REGLAGES.zoneSeule) {
          items = items.filter(function (i) { return i.zone; });
        }
        /* on privilégie les vraies adresses, avec un numero */
        items.sort(function (a, b) {
          var na = /^\d/.test(a.rue) ? 0 : 1;
          var nb = /^\d/.test(b.rue) ? 0 : 1;
          return na - nb;
        });
        ouvrir(items.slice(0, REGLAGES.limite));
      })
      .catch(function (err) {
        /* service indisponible ou requête annulée :
           le visiteur remplit ses champs à la main */
        if (err && err.name === 'AbortError') return;
        fermer();
      });
  }

  /* ---------------------------------------------------------
     SAISIE
     --------------------------------------------------------- */
  champ.addEventListener('input', function () {
    var texte = champ.value.trim();
    clearTimeout(minuteur);

    if (texte.length < 3) { fermer(); return; }

    minuteur = setTimeout(function () { chercher(texte); }, REGLAGES.pause);
  });

  /* clavier : flèches, Entrée, Échap */
  champ.addEventListener('keydown', function (e) {
    if (liste.hidden) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      surligne(Math.min(indexActif + 1, resultats.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      surligne(Math.max(indexActif - 1, 0));
    } else if (e.key === 'Enter') {
      if (indexActif >= 0 && resultats[indexActif]) {
        e.preventDefault();
        choisir(resultats[indexActif]);
      } else {
        fermer();
      }
    } else if (e.key === 'Escape') {
      fermer();
    }
  });

  /* clic sur une suggestion */
  liste.addEventListener('click', function (e) {
    var li = e.target.closest('.suggestion');
    if (!li) return;
    var r = resultats[parseInt(li.getAttribute('data-index'), 10)];
    if (r) choisir(r);
  });

  /* fermeture au clic ailleurs */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.form__row--adresse')) fermer();
  });

  /* le formulaire envoyé referme la liste */
  var form = document.getElementById('formCommande');
  if (form) form.addEventListener('submit', fermer);
})();
