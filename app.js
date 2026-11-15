/* =========================================================
   CORNER69 — boutique
   Logique : catalogue, panier, commande, suivi, avis,
   thèmes et réglages.
   ========================================================= */
(function () {
  'use strict';

  /* =======================================================
     OUTILS
     ======================================================= */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function euros(n) {
    /* tolere une valeur manquante : un prix absent ne doit pas
       faire planter tout l'affichage du site. */
    var v = Number(n);
    if (!isFinite(v)) v = 0;
    return v.toFixed(2).replace('.', ',') + ' €';
  }
  function lire(cle, defaut) {
    try {
      var v = localStorage.getItem('corner69.' + cle);
      return v === null ? defaut : JSON.parse(v);
    } catch (e) { return defaut; }
  }
  function ecrire(cle, valeur) {
    try { localStorage.setItem('corner69.' + cle, JSON.stringify(valeur)); } catch (e) {}
  }
  function effacer(cle) {
    try { localStorage.removeItem('corner69.' + cle); } catch (e) {}
  }

  /* =======================================================
     ÉTAT
     ======================================================= */
  var panier = lire('panier', []);          // [{id, qte}]
  var variantesSaisie = [];   /* formats en cours de saisie dans la gestion */
  var commande = lire('commande', null);    // {ref, date, adresse, total, etape}
  var avis = lire('avis', []);
  var avisAttente = lire('avisAttente', []);   /* avis en attente de validation */
  var theme = lire('theme', null);          // palette personnalisée
  var fondCustom = lire('fond', null);      // image de fond en base64
  var mesRefs = lire('mesRefs', []);       // references de MES commandes
  var maRef = lire('maRef', null);          // la plus recente

  /* la page de gestion est-elle ouverte dans cette visite ?
     remise a zero a chaque chargement : on se reverrouille en revenant */
  var adminOuvert = false;
