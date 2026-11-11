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
  function euros(n) { return n.toFixed(2).replace('.', ',') + ' €'; }
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
  var commande = lire('commande', null);    // {ref, date, adresse, total, etape}
  var avis = lire('avis', []);
  var avisAttente = lire('avisAttente', []);   /* avis en attente de validation */
  var theme = lire('theme', null);          // palette personnalisée
  var fondCustom = lire('fond', null);      // image de fond en base64

  /* =======================================================
     THÈME
     ======================================================= */
  function paletteActive() {
    if (theme) return theme;
    return BOUTIQUE.palettes[BOUTIQUE.theme] || BOUTIQUE.palettes[Object.keys(BOUTIQUE.palettes)[0]];
  }

  function appliquerTheme(p) {
    var r = document.documentElement.style;
    r.setProperty('--fond', p.fond);
    r.setProperty('--carte', p.carte);
    r.setProperty('--texte', p.texte);
    r.setProperty('--doux', p.doux);
    r.setProperty('--accent', p.accent);
    r.setProperty('--accent-texte', p.accentTexte);
    r.setProperty('--bordure', p.bordure || 'rgba(255,255,255,.10)');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', p.fond);
  }

  /* -------------------------------------------------------
     LOGO — si logo.png existe, on l'affiche a la place du
     texte. Sinon, le texte anime reste en place.
     ------------------------------------------------------- */
  function afficherLogo() {
    var img = $('#logoImage');
    var txt = $('#logoTexte');
    if (!img) return;

    img.addEventListener('load', function () {
      /* l'image est la : on masque le texte */
      if (txt) txt.hidden = true;
      img.hidden = false;
    });
    img.addEventListener('error', function () {
      /* pas d'image : on garde le texte */
      img.hidden = true;
      if (txt) txt.hidden = false;
    });
  }

  function appliquerFond() {
    var img = $('#bgImage');
    if (img && fondCustom) img.src = fondCustom;
  }

  /* =======================================================
     ROUTAGE
     ======================================================= */
  function route() {
    var h = (location.hash || '#/').replace('#', '');
    if (h.indexOf('/produit/') === 0) return '/produit';
    return h || '/';
  }

  function afficher() {
    var r = route();
    $$('.vue').forEach(function (v) {
      v.classList.toggle('actif', v.getAttribute('data-vue') === r);
    });
    $$('.nav__links a').forEach(function (a) {
      a.classList.toggle('actif', a.getAttribute('data-route') === r);
    });

    if (r === '/produit') rendreFiche();
    if (r === '/panier') rendrePanier();
    if (r === '/suivi') rendreSuivi();
    if (r === '/avis') rendreAvis();
    if (r === '/gestion' && adminOuvert) ouvrirAdministration();

    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-route]');
    if (!a) return;
    var cible = a.getAttribute('data-route');
    // un produit ouvre sa fiche
    var id = a.getAttribute('data-produit');
    if (id) { location.hash = '#/produit/' + id; }
    else { location.hash = '#' + cible; }
    e.preventDefault();
  });

  window.addEventListener('hashchange', afficher);

  /* =======================================================
     CATALOGUE
     ======================================================= */
  function rayons() {
    var vus = [];
    BOUTIQUE.produits.forEach(function (p) {
      if (vus.indexOf(p.rayon) === -1) vus.push(p.rayon);
    });
    return vus;
  }

  /* -------------------------------------------------------
     Initiale d'un produit, pour la vignette de remplacement
     quand la photo du produit n'existe pas encore.
     Les accents sont conserves : É reste É, pas de trou.
     ------------------------------------------------------- */
  /* -------------------------------------------------------
     Vignette de remplacement : le nom du rayon du produit,
     utilisé tant que la photo n'existe pas encore.
     Les emojis sont conservés tels quels.

     Le rayon vient de config.js, champ « rayon ». On peut y
     mettre ce qu'on veut : « Cafe », « Café », « Cafe ☕ »,
     « Thes 🍵 »... Le texte est repris tel quel.
     ------------------------------------------------------- */
  function vignette(p) {
    /* si l'image du produit existe, c'est elle qui s'affiche */
    var premier = (p && p.medias && p.medias[0]) || null;
    if (premier && premier.type === 'image' && premier.src) {
      return '<img src="' + premier.src + '" alt="' + (p.nom || '') + '" loading="lazy">';
    }

    /* sinon l'emoji du produit : champ « emoji » dans config.js,
       ou a defaut celui du rayon */
    var emoji = String((p && p.emoji) || '').trim();
    if (emoji) return '<span class="vignette__emoji">' + emoji + '</span>';

    var secours = String((p && p.rayon) || '').trim();
    return secours || '?';
  }

  function rendreCatalogue() {
    var choix = $('#rayon');
    if (choix && !choix.options.length) {
      choix.innerHTML = '<option value="">Tous les rayons</option>' +
        rayons().map(function (r) { return '<option>' + r + '</option>'; }).join('');
      choix.addEventListener('change', filtrer);
    }
    filtrer();
  }

  function filtrer() {
    var r = $('#rayon') ? $('#rayon').value : '';
    var liste = BOUTIQUE.produits.filter(function (p) { return !r || p.rayon === r; });
    var ul = $('#produits');

    $('#prodCount').textContent = (liste.length < 10 ? '0' : '') + liste.length + ' réf.';

    ul.innerHTML = liste.map(function (p) {
      var rupture = p.stock === 'rupture';
      return '<li class="produit" data-route="/produit" data-produit="' + p.id + '">' +
        '<span class="produit__img">' + vignette(p) + '</span>' +
        '<div class="produit__corps">' +
          '<span class="produit__meta">' + p.rayon + ' · ' + p.format + '</span>' +
          '<h3 class="produit__nom">' + p.nom +
            (p.badge ? '<span class="produit__badge">' + p.badge + '</span>' : '') +
          '</h3>' +
          (rupture
            ? '<span class="produit__rupture">Rupture de stock</span>'
            : '<span class="produit__prix">' + euros(p.prix) + '</span>') +
        '</div>' +
        '<span aria-hidden="true">›</span>' +
      '</li>';
    }).join('');
  }

  /* =======================================================
     FICHE PRODUIT
     ======================================================= */
  var qteFiche = 1;

  function produitDe(id) {
    return BOUTIQUE.produits.filter(function (p) { return p.id === id; })[0];
  }

  function rendreFiche() {
    var id = (location.hash.split('/produit/')[1] || '').trim();
    var p = produitDe(id);
    var box = $('#fiche');
    if (!p) { box.innerHTML = '<p>Produit introuvable.</p>'; return; }
    if (qteFiche < 1) qteFiche = 1;

    var rupture = p.stock === 'rupture';
    box.innerHTML =
      '<div class="fiche__visuel">' + vignette(p) + '</div>' +
      '<span class="fiche__rayon">' + p.rayon + ' · ' + p.format + '</span>' +
      '<h2 class="fiche__nom">' + p.nom + '</h2>' +
      '<p class="fiche__desc">' + p.description + '</p>' +
      '<span class="fiche__prix">' + euros(p.prix) + '</span>' +
      (rupture
        ? '<p class="produit__rupture" style="margin-top:1.2rem">Produit momentanément indisponible.</p>'
        : '<div class="fiche__ligne">' +
            '<span class="fiche__label">Quantité</span>' +
            '<div class="qte">' +
              '<button type="button" data-q="-1" aria-label="Moins">−</button>' +
              '<span id="qteVal">' + qteFiche + '</span>' +
              '<button type="button" data-q="1" aria-label="Plus">+</button>' +
            '</div>' +
          '</div>' +
          '<button class="btn btn--accent btn--large" id="ajouter" type="button">Ajouter au panier — ' +
            euros(p.prix * qteFiche) + '</button>');

    $$('[data-q]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        qteFiche = Math.max(1, Math.min(20, qteFiche + parseInt(b.getAttribute('data-q'), 10)));
        rendreFiche();
      });
    });

    var aj = $('#ajouter', box);
    if (aj) {
      aj.addEventListener('click', function () {
        ajouterAuPanier(p.id, qteFiche);
        qteFiche = 1;
        location.hash = '#/panier';
      });
    }

    /* le carrousel du produit, sous la description */
    var zone = document.createElement('div');
    zone.id = 'carrousel';
    zone.className = 'carrousel';
    box.insertBefore(zone, box.firstChild.nextSibling);

    /* on previent le carrousel : il affiche les visuels du produit */
    document.dispatchEvent(new CustomEvent('corner69:produit', { detail: p }));
  }

  /* =======================================================
     PANIER
     ======================================================= */
  function ajouterAuPanier(id, qte) {
    var l = panier.filter(function (x) { return x.id === id; })[0];
    if (l) l.qte = Math.min(20, l.qte + qte);
    else panier.push({ id: id, qte: qte });
    ecrire('panier', panier);
    majPanierCount();
  }

  function totalPanier() {
    return panier.reduce(function (t, l) {
      var p = produitDe(l.id);
      return t + (p ? p.prix * l.qte : 0);
    }, 0);
  }

  function fraisLivraison(sous) {
    if (sous >= BOUTIQUE.livraison.gratuiteAPartirDe) return 0;
    return sous > 0 ? BOUTIQUE.livraison.frais : 0;
  }

  function majPanierCount() {
    var n = panier.reduce(function (t, l) { return t + l.qte; }, 0);
    var el = $('#panierCount');
    if (el) el.textContent = n;
  }

  function rendrePanier() {
    var plein = panier.length > 0;
    $('#panierVide').hidden = plein;
    $('#panierPlein').hidden = !plein;
    if (!plein) return;

    $('#lignes').innerHTML = panier.map(function (l) {
      var p = produitDe(l.id);
      if (!p) return '';
      return '<li class="ligne">' +
        '<div>' +
          '<div class="ligne__nom">' + p.nom + '</div>' +
          '<div class="ligne__meta">' + p.format + ' · ' + euros(p.prix) +
            ' × ' + l.qte + '</div>' +
        '</div>' +
        '<div class="qte">' +
          '<button type="button" data-moins="' + p.id + '" aria-label="Moins">−</button>' +
          '<span>' + l.qte + '</span>' +
          '<button type="button" data-plus="' + p.id + '" aria-label="Plus">+</button>' +
        '</div>' +
        '<span class="ligne__prix">' + euros(p.prix * l.qte) + '</span>' +
      '</li>';
    }).join('');

    var sous = totalPanier();
    var frais = fraisLivraison(sous);

    $('#recap').innerHTML =
      '<div class="recap__row"><span>Sous-total</span><span>' + euros(sous) + '</span></div>' +
      '<div class="recap__row"><span>Livraison</span><span>' +
        (frais === 0 ? 'Offerte' : euros(frais)) + '</span></div>' +
      '<div class="recap__row recap__row--total"><span>Total</span><b>' +
        euros(sous + frais) + '</b></div>';

    $$('[data-plus]', $('#lignes')).forEach(function (b) {
      b.addEventListener('click', function () { changerQte(b.getAttribute('data-plus'), 1); });
    });
    $$('[data-moins]', $('#lignes')).forEach(function (b) {
      b.addEventListener('click', function () { changerQte(b.getAttribute('data-moins'), -1); });
    });
  }

  function changerQte(id, delta) {
    var l = panier.filter(function (x) { return x.id === id; })[0];
    if (!l) return;
    l.qte += delta;
    if (l.qte < 1) panier = panier.filter(function (x) { return x.id !== id; });
    ecrire('panier', panier);
    majPanierCount();
    rendrePanier();
  }

  /* =======================================================
     COMMANDE — 5 étapes
     ======================================================= */
  function reference() {
    var lettres = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    var s = '';
    for (var i = 0; i < 4; i++) s += lettres.charAt(Math.floor(Math.random() * lettres.length));
    var n = Math.floor(1000 + Math.random() * 9000);
    return '#CMD-' + n + s.charAt(0) + s.charAt(1);
  }

  function validerCommande(e) {
    e.preventDefault();
    var f = e.target;
    var champs = ['nom', 'tel', 'adresse', 'cp', 'ville'];
    var manque = champs.filter(function (n) { return !f[n].value.trim(); });
    var note = $('#formErreur');

    if (manque.length) {
      note.hidden = false;
      note.textContent = 'Merci de remplir tous les champs.';
      return;
    }
    note.hidden = true;

    var sous = totalPanier();
    commande = {
      ref: reference(),
      date: new Date().toISOString(),
      adresse: {
        nom: f.nom.value.trim(),
        tel: f.tel.value.trim(),
        adresse: f.adresse.value.trim(),
        cp: f.cp.value.trim(),
        ville: f.ville.value.trim()
      },
      articles: panier.slice(),
      total: sous + fraisLivraison(sous),
      etape: 0
    };
    ecrire('commande', commande);

    panier = [];
    ecrire('panier', panier);
    majPanierCount();

    location.hash = '#/suivi';
  }

  /* =======================================================
     SUIVI
     ======================================================= */
  function rendreSuivi() {
    var box = $('#suivi');
    if (!commande) {
      var a0 = $('#suiviActions');
      if (a0) a0.hidden = true;
      box.innerHTML = '<div class="vide"><p>Aucune commande en cours.</p>' +
        '<button class="btn btn--accent" type="button" data-route="/">Voir le catalogue</button></div>';
      return;
    }

    var e = commande.etape;
    var pct = Math.round(((e + 1) / BOUTIQUE.etapes.length) * 100);
    var courante = BOUTIQUE.etapes[e];

    /* le bouton d'avancement disparait une fois la commande livree */
    var actions = $('#suiviActions');
    if (actions) actions.hidden = (e >= BOUTIQUE.etapes.length - 1);

    var quand = new Date(commande.date);
    var dateTxt = 'Passée le ' + quand.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
                  ' à ' + quand.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    box.innerHTML =
      '<div class="suivi__entete">' +
        '<div class="suivi__ring" style="--pct:' + pct + '%"><span>' + (e + 1) + '</span>' +
          '<small>/' + BOUTIQUE.etapes.length + '</small></div>' +
        '<div>' +
          '<div class="suivi__ref">' + commande.ref + '</div>' +
          '<p class="suivi__etat">' + courante.label + ' ' + courante.emoji + '</p>' +
          '<div class="suivi__date">' + dateTxt + '</div>' +
        '</div>' +
      '</div>' +

      '<ul class="jalons">' +
        BOUTIQUE.etapes.map(function (et, i) {
          var cls = i < e ? 'fait' : (i === e ? 'encours' : '');
          var point = i < e ? '✓' : (i + 1);
          return '<li class="jalon ' + cls + '">' +
            '<span class="jalon__point">' + point + '</span>' +
            '<div>' +
              '<p class="jalon__titre">' + et.label + ' ' + et.emoji + '</p>' +
              '<p class="jalon__txt">' + et.texte + '</p>' +
            '</div>' +
          '</li>';
        }).join('') +
      '</ul>' +

      '<aside class="recap" style="margin-top:1.5rem">' +
        '<div class="recap__row"><span>Articles</span><span>' +
          commande.articles.reduce(function (t, a) { return t + a.qte; }, 0) + '</span></div>' +
        '<div class="recap__row"><span>Livré à</span><span>' +
          commande.adresse.nom + ', ' + commande.adresse.ville + '</span></div>' +
        '<div class="recap__row recap__row--total"><span>Total payé</span><b>' +
          euros(commande.total) + '</b></div>' +
      '</aside>';
  }

  function majBarreSuivi() {
    var barre = $('#suiviBar');
    if (!barre) return;
    if (!commande) { barre.hidden = true; return; }
    /* le client l'a masquee avec la croix : elle ne revient pas */
    try {
      if (sessionStorage.getItem('corner69.suiviMasque') === '1') { barre.hidden = true; return; }
    } catch (err) {}
    barre.hidden = false;
    var e = commande.etape;
    var pct = Math.round(((e + 1) / BOUTIQUE.etapes.length) * 100);
    $('#suiviPct').textContent = e + 1;
    $('#suiviRef').textContent = commande.ref;
    $('#suiviLabel').textContent = BOUTIQUE.etapes[e].label + ' ' + BOUTIQUE.etapes[e].emoji;
    var badge = $('#suiviBadge');
    if (badge) badge.textContent = 'Étape ' + (e + 1) + '/' + BOUTIQUE.etapes.length;
    barre.querySelector('.suivi-carte__ring').style.setProperty('--pct', pct + '%');
    var jauge = $('#suiviJauge');
    if (jauge) jauge.style.width = pct + '%';
  }

  /* =======================================================
     AVIS
     ======================================================= */
  var noteChoisie = 5;

  function rendreEtoiles() {
    var box = $('#etoiles');
    box.innerHTML = [1, 2, 3, 4, 5].map(function (n) {
      return '<button type="button" role="radio" aria-checked="' + (n === noteChoisie) +
        '" class="' + (n <= noteChoisie ? 'on' : '') + '" data-note="' + n + '">★</button>';
    }).join('');
    $$('[data-note]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        noteChoisie = parseInt(b.getAttribute('data-note'), 10);
        rendreEtoiles();
      });
    });
  }

  function moyenneAvis() {
    if (!avis.length) return 0;
    var t = avis.reduce(function (s, a) { return s + a.note; }, 0);
    return t / avis.length;
  }

  function etoilesTexte(n) {
    var plein = Math.round(n);
    return new Array(plein + 1).join('&#9733;') + new Array(5 - plein + 1).join('&#9734;');
  }

  function rendreAvis() {
    rendreEtoiles();

    var moy = moyenneAvis();
    var m = $('#avisMoyenne');
    if (m) m.textContent = (avis.length ? moy.toFixed(1).replace('.', ',') : '0') + ' / 5';
    var me = $('#avisMoyenneEtoiles');
    if (me) me.innerHTML = etoilesTexte(moy);
    var t = $('#avisTotal');
    if (t) t.textContent = avis.length;
    var c = $('#avisCount');
    if (c) c.textContent = (avis.length < 10 ? '0' : '') + avis.length;

    var ul = $('#avis');
    if (!ul) return;
    if (!avis.length) {
      ul.innerHTML = '<li class="avis__item"><p class="avis__texte">Aucun avis publie pour le moment.</p></li>';
      return;
    }

    ul.innerHTML = avis.map(function (a) {
      var quand = '';
      try {
        var dt = new Date(a.date);
        quand = dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
                ' a ' + dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      } catch (e) { quand = ''; }
      return '<li class="avis__item">' +
        '<div class="avis__head">' +
          '<span class="avis__nom">' + a.nom + '</span>' +
          '<span class="avis__note">' + etoilesTexte(a.note) + '</span>' +
        '</div>' +
        '<p class="avis__texte">' + a.texte + '</p>' +
        (quand ? '<span class="avis__date">' + quand + '</span>' : '') +
      '</li>';
    }).join('');
  }

  function publierAvis(e) {
    e.preventDefault();
    var nom = $('#aNom').value.trim();
    var texte = $('#aTexte').value.trim();
    var err = $('#avisErreur');
    var ok = $('#avisEnAttente');

    if (err) err.hidden = true;
    if (ok) ok.hidden = true;

    if (!nom || !texte) {
      if (err) { err.hidden = false; err.textContent = 'Merci de mettre une note, un message et votre nom.'; }
      return;
    }

    /* l'avis part en attente : la boutique le valide avant publication */
    avisAttente.unshift({ nom: nom, note: noteChoisie, texte: texte, date: new Date().toISOString() });
    ecrire('avisAttente', avisAttente);

    e.target.reset();
    noteChoisie = 5;
    rendreEtoiles();
    if (ok) ok.hidden = false;
    rendreAdministration();
  }


  function deverrouiller(e) {
    if (e) e.preventDefault();
    var mdp = $('#mdp') ? $('#mdp').value : '';
    var err = $('#verrouErreur');

    if (mdp !== BOUTIQUE.adminMotDePasse) {
      if (err) { err.hidden = false; err.textContent = 'Mot de passe incorrect.'; }
      return;
    }

    if (err) err.hidden = true;
    adminOuvert = true;
    ouvrirAdministration();
  }

  function ouvrirAdministration() {
    var v = $('#verrou');
    var a = $('#administration');
    if (v) v.hidden = true;
    if (a) a.hidden = false;
    fermerPanneau();
    rendreAdministration();
  }

  function verrouillerAdministration() {
    adminOuvert = false;
    var v = $('#verrou');
    var a = $('#administration');
    if (a) a.hidden = true;
    if (v) v.hidden = false;
    var mdp = $('#mdp');
    if (mdp) mdp.value = '';
    fermerPanneau();
  }

  /* -------------------------------------------------------
     TABLEAU DE BORD — les chiffres du jour
     ------------------------------------------------------- */
  function rendreAdministration() {
    var box = $('#tuiles');
    if (!box) return;

    var nbCommandes = commande ? 1 : 0;
    var chiffre = commande ? commande.total : 0;
    var enCours = commande ? 1 : 0;
    var avisEnAttente = avis.length;

    var cartes = [
      { ico: '\uD83D\uDED2', label: 'Commandes', valeur: String(nbCommandes), note: '', cible: 'commandes' },
      { ico: '\u20AC',        label: 'Chiffre',   valeur: euros(chiffre),      note: '', cible: 'commandes' },
      { ico: '\uD83D\uDCCB', label: 'En cours',  valeur: String(enCours),     note: 'Pay\u00E9es, \u00E0 livrer', cible: 'commandes' },
      { ico: '\u2B50',        label: 'Avis',      valeur: String(avisAttente.length), note: 'En attente', cible: 'avis' }
    ];

    box.innerHTML = cartes.map(function (c) {
      return '<button class="tuile" type="button" data-admin="' + c.cible + '">' +
        '<span class="tuile__haut">' +
          '<span class="tuile__ico">' + c.ico + '</span>' +
          '<span class="tuile__label">' + c.label + '</span>' +
        '</span>' +
        '<span class="tuile__valeur">' + c.valeur + '</span>' +
        (c.note ? '<span class="tuile__note">' + c.note + '</span>' : '') +
      '</button>';
    }).join('');
  }

  /* -------------------------------------------------------
     PANNEAUX — ce qu'ouvrent les entrees du menu
     ------------------------------------------------------- */
  function ouvrirPanneau(quoi) {
    var p = $('#panneau');
    var c = $('#panneauContenu');
    if (!p || !c) return;

    if (quoi === 'commandes') c.innerHTML = panneauCommandes();
    else if (quoi === 'produits') c.innerHTML = panneauProduits();
    else if (quoi === 'categories') c.innerHTML = panneauCategories();
    else if (quoi === 'avis') c.innerHTML = panneauAvis();
    else if (quoi === 'reglages') { c.innerHTML = panneauReglages(); cablerReglages(); }

    cablerPanneau(quoi);
    p.hidden = false;
    p.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function fermerPanneau() {
    var p = $('#panneau');
    if (p) p.hidden = true;
  }

  function panneauCommandes() {
    var liste = etapes();
    if (!commande) {
      return '<h2 class="admin__sous-titre">Commandes</h2>' +
             '<p class="vide">Aucune commande enregistr\u00E9e pour le moment.</p>';
    }
    var i = Math.min(commande.etape, liste.length - 1);
    return '<h2 class="admin__sous-titre">Commandes</h2>' +
      '<div class="admin-commande">' +
        '<span class="admin-commande__info">' + commande.ref +
          ' \u2014 \u00E9tape <b>' + (i + 1) + '/' + liste.length + '</b><br>' +
          liste[i].label + '<br>' +
          '<small>' + (commande.adresse ? commande.adresse.nom + ', ' + commande.adresse.ville : '') + '</small></span>' +
        '<span class="admin-commande__actions">' +
          '<button type="button" data-avance="-1"' + (i === 0 ? ' disabled' : '') + '>\u2190 Reculer</button>' +
          '<button type="button" data-avance="1"' + (i >= liste.length - 1 ? ' disabled' : '') + '>Avancer \u2192</button>' +
        '</span>' +
      '</div>' +
      '<div class="recap" style="margin-top:1rem">' +
        '<div class="recap__row"><span>Articles</span><span>' +
          commande.articles.reduce(function (t, a) { return t + a.qte; }, 0) + '</span></div>' +
        '<div class="recap__row recap__row--total"><span>Total</span><b>' + euros(commande.total) + '</b></div>' +
      '</div>';
  }

  function panneauProduits() {
    return '<h2 class="admin__sous-titre">Produits</h2>' +
      '<p class="fond__hint" style="margin-bottom:1rem">' +
        'Le catalogue se modifie dans <b>config.js</b>, section <b>produits</b> : ' +
        'nom, rayon, prix, stock, badge et la liste des photos.' +
      '</p>' +
      '<ul class="admin-liste">' + BOUTIQUE.produits.map(function (p) {
        return '<li class="admin-liste__item">' +
          '<span class="admin-liste__img">' +
            (p.emoji ? p.emoji : (p.nom || '?').charAt(0)) +
          '</span>' +
          '<span class="admin-liste__txt">' +
            '<b>' + p.nom + '</b>' +
            '<small>' + p.rayon + ' \u00B7 ' + p.format + ' \u00B7 ' + euros(p.prix) + '</small>' +
          '</span>' +
          '<span class="' + (p.stock === 'rupture' ? 'admin-liste__rupture' : 'admin-liste__ok') + '">' +
            (p.stock === 'rupture' ? 'Rupture' : 'En stock') +
          '</span>' +
        '</li>';
      }).join('') + '</ul>';
  }

  function panneauCategories() {
    var liste = rayons();
    return '<h2 class="admin__sous-titre">Cat\u00E9gories</h2>' +
      '<ul class="admin-liste">' + liste.map(function (r) {
        var n = BOUTIQUE.produits.filter(function (p) { return p.rayon === r; }).length;
        return '<li class="admin-liste__item">' +
          '<span class="admin-liste__txt"><b>' + r + '</b>' +
          '<small>' + n + ' produit' + (n > 1 ? 's' : '') + '</small></span>' +
        '</li>';
      }).join('') + '</ul>';
  }

  function panneauAvis() {
    var html = '<h2 class="admin__sous-titre">Avis a valider</h2>';

    if (!avisAttente.length) {
      html += '<p class="vide">Aucun avis en attente.</p>';
    } else {
      html += '<ul class="admin-liste">' + avisAttente.map(function (a, i) {
        return '<li class="admin-liste__item">' +
          '<span class="admin-liste__txt"><b>' + a.nom + '</b>' +
            '<small>' + etoilesTexte(a.note) + ' - ' + a.texte + '</small></span>' +
          '<span class="admin-liste__actions">' +
            '<button class="admin-liste__ok-btn" type="button" data-valider="' + i + '">Valider</button>' +
            '<button class="admin-liste__sup" type="button" data-refuser="' + i + '">Refuser</button>' +
          '</span>' +
        '</li>';
      }).join('') + '</ul>';
    }

    html += '<h2 class="admin__sous-titre">Avis publies</h2>';
    if (!avis.length) {
      html += '<p class="vide">Aucun avis publie.</p>';
    } else {
      html += '<ul class="admin-liste">' + avis.map(function (a, i) {
        return '<li class="admin-liste__item">' +
          '<span class="admin-liste__txt"><b>' + a.nom + '</b>' +
            '<small>' + etoilesTexte(a.note) + ' - ' + a.texte + '</small></span>' +
          '<button class="admin-liste__sup" type="button" data-avis="' + i + '">Supprimer</button>' +
        '</li>';
      }).join('') + '</ul>';
    }

    return html;
  }

  function panneauReglages() {
    var p = paletteActive();
    var palettes = Object.keys(BOUTIQUE.palettes).map(function (cle) {
      var pa = BOUTIQUE.palettes[cle];
      return '<button type="button" class="palette" data-palette="' + cle + '">' +
        '<span class="palette__nom">' + pa.nom + '</span>' +
        '<span class="palette__dots">' +
          '<i style="background:' + pa.fond + '"></i>' +
          '<i style="background:' + pa.carte + '"></i>' +
          '<i style="background:' + pa.accent + '"></i>' +
        '</span>' +
      '</button>';
    }).join('');

    var champs = [
      ['fond', 'Fond'], ['carte', 'Cartes'], ['texte', 'Texte'],
      ['doux', 'Texte secondaire'], ['accent', 'Accentuation'],
      ['accentTexte', 'Texte sur accent']
    ];
    var couleurs = champs.map(function (c) {
      return '<div class="couleur">' +
        '<label for="c-' + c[0] + '">' + c[1] + '</label>' +
        '<input type="color" id="c-' + c[0] + '" data-couleur="' + c[0] +
          '" value="' + (p[c[0]] || '#000000') + '">' +
      '</div>';
    }).join('');

    return '<h2 class="admin__sous-titre">R\u00E9glages</h2>' +
      '<h3 class="admin__bloc">Palettes</h3>' +
      '<div class="palettes">' + palettes + '</div>' +
      '<h3 class="admin__bloc">Couleurs</h3>' +
      '<div class="couleurs">' + couleurs + '</div>' +
      '<h3 class="admin__bloc">Image de fond</h3>' +
      '<div class="fond">' +
        '<p class="fond__hint">D\u00E9posez une image : elle sera appliqu\u00E9e dans ce navigateur. ' +
        'Pour tous les visiteurs, d\u00E9posez-la \u00E0 la racine du d\u00E9p\u00F4t sous le nom <b>bg.PNG</b>.</p>' +
        '<input type="file" id="fondFile" accept="image/*">' +
        '<button class="btn btn--ghost" id="fondReset" type="button">Revenir au fond du d\u00E9p\u00F4t</button>' +
      '</div>' +
      '<div class="reglages__actions">' +
        '<button class="btn btn--accent" id="themeSauver" type="button">Enregistrer le th\u00E8me</button>' +
        '<button class="btn btn--ghost" id="themeReset" type="button">R\u00E9initialiser</button>' +
      '</div>' +
      '<p class="fond__hint">L\u2019enregistrement conserve le th\u00E8me dans ce navigateur. ' +
      'Pour le figer pour tous, recopiez les valeurs dans <b>config.js</b>, section <b>palettes</b>.</p>';
  }

  /* -------------------------------------------------------
     CABLAGE des boutons des panneaux
     ------------------------------------------------------- */
  function cablerPanneau(quoi) {
    $$('[data-avance]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = parseInt(b.getAttribute('data-avance'), 10);
        if (!commande) return;
        commande.etape = Math.max(0, Math.min(BOUTIQUE.etapes.length - 1, commande.etape + d));
        ecrire('commande', commande);
        majBarreSuivi();
        ouvrirPanneau('commandes');
      });
    });

    $$('[data-avis]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = parseInt(b.getAttribute('data-avis'), 10);
        avis.splice(i, 1);
        ecrire('avis', avis);
        ouvrirPanneau('avis');
        rendreAdministration();
      });
    });

    /* valider un avis en attente : il devient public */
    $$('[data-valider]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = avisAttente.splice(parseInt(b.getAttribute('data-valider'), 10), 1)[0];
        if (!a) return;
        avis.unshift(a);
        ecrire('avisAttente', avisAttente);
        ecrire('avis', avis);
        rendreAvis();
        ouvrirPanneau('avis');
        rendreAdministration();
      });
    });

    /* refuser : l'avis est supprime sans etre publie */
    $$('[data-refuser]').forEach(function (b) {
      b.addEventListener('click', function () {
        avisAttente.splice(parseInt(b.getAttribute('data-refuser'), 10), 1);
        ecrire('avisAttente', avisAttente);
        ouvrirPanneau('avis');
        rendreAdministration();
      });
    });

    $$('[data-palette]').forEach(function (b) {
      b.addEventListener('click', function () {
        var cle = b.getAttribute('data-palette');
        theme = JSON.parse(JSON.stringify(BOUTIQUE.palettes[cle]));
        theme.cle = cle;
        appliquerTheme(theme);
        ouvrirPanneau('reglages');
      });
    });

    $$('[data-couleur]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        if (!theme) theme = JSON.parse(JSON.stringify(paletteActive()));
        theme[inp.getAttribute('data-couleur')] = inp.value;
        appliquerTheme(theme);
      });
    });
  }

  function cablerReglages() {
    var f = $('#fondFile');
    if (f) {
      f.addEventListener('change', function (e) {
        var fichier = e.target.files[0];
        if (!fichier) return;
        var lecteur = new FileReader();
        lecteur.onload = function () {
          fondCustom = lecteur.result;
          ecrire('fond', fondCustom);
          $('#bgImage').src = fondCustom;
        };
        lecteur.readAsDataURL(fichier);
      });
    }

    var r = $('#fondReset');
    if (r) {
      r.addEventListener('click', function () {
        fondCustom = null;
        effacer('fond');
        $('#bgImage').src = 'bg.PNG';
      });
    }

    var s = $('#themeSauver');
    if (s) {
      s.addEventListener('click', function () { if (theme) ecrire('theme', theme); });
    }

    var t = $('#themeReset');
    if (t) {
      t.addEventListener('click', function () {
        theme = null;
        effacer('theme');
        appliquerTheme(paletteActive());
        ouvrirPanneau('reglages');
      });
    }
  }

  /* =======================================================
     AVANCEMENT DE LA COMMANDE
     Le bouton de la page de suivi sert a la demonstration.
     Le reglage reel se fait depuis la page de gestion,
     protegee par mot de passe.
     ======================================================= */
  function avancerDepuisSuivi() {
    if (!commande) return;
    if (commande.etape >= BOUTIQUE.etapes.length - 1) return;
    commande.etape += 1;
    ecrire('commande', commande);
    majBarreSuivi();
    rendreSuivi();
  }

  /* -------------------------------------------------------
     LOGO — rejoue l'effet d'entree.
     Appelee a l'arrivee sur le catalogue : on retire la
     classe, on force un reflow, puis on la remet pour que
     l'animation reparte de zero.
     ------------------------------------------------------- */
  function jouerLogo() {
    var hero = $('#logoHero');
    if (!hero) return;
    hero.style.animation = 'none';
    void hero.offsetWidth;          /* force le navigateur a recalculer */
    hero.style.animation = '';
    hero.classList.remove('logo-hero--joue');
    void hero.offsetWidth;
    hero.classList.add('logo-hero--joue');
  }

  /* =======================================================
     DÉMARRAGE
     ======================================================= */
  function init() {
    appliquerTheme(paletteActive());

    /* écran de chargement puis accueil explicatif */
    var loader = $('#loader');
    setTimeout(function () {
      if (loader) { loader.classList.add('is-off'); setTimeout(function () { loader.style.display = 'none'; }, 600); }
    }, 1400);

    $('#introGo').addEventListener('click', function () {
      $('#intro').hidden = true;
      $('#nav').hidden = false;
      $('#vues').hidden = false;
      $('#foot').hidden = false;
      appliquerFond();
      afficher();
      /* l'animation du logo se joue ici, en arrivant sur le catalogue */
      jouerLogo();
    });

    /* navigation et formulaires */
    $('#formCommande').addEventListener('submit', validerCommande);
    $('#formAvis').addEventListener('submit', publierAvis);
    $('#formVerrou').addEventListener('submit', deverrouiller);
    $('#suiviVoir').addEventListener('click', function () { location.hash = '#/suivi'; });

    /* bouton d'avancement de la page de suivi (demonstration) */
    document.addEventListener('click', function (e) {
      if (e.target.closest('#suiviFermer')) {
        var b = $('#suiviBar');
        if (b) b.hidden = true;
        try { sessionStorage.setItem('corner69.suiviMasque', '1'); } catch (err) {}
        return;
      }
      if (e.target.closest('#suiviAvancer')) avancerDepuisSuivi();
    });

    /* administration : menu, panneau, verrouillage */
    document.addEventListener('click', function (e) {
      var item = e.target.closest('[data-admin]');
      if (item) { ouvrirPanneau(item.getAttribute('data-admin')); return; }

      if (e.target.closest('#panneauRetour')) { fermerPanneau(); return; }
      if (e.target.closest('#adminQuitter')) { verrouillerAdministration(); return; }
    });

    $('#versCommande').addEventListener('click', function () {
      if (!panier.length) return;
      location.hash = '#/commande';
    });

    /* menu mobile : le nav est deja en bas, le burger reste un repere */
    var burger = $('#burger');
    if (burger) {
      burger.addEventListener('click', function () {
        var ouvert = document.body.classList.toggle('menu-open');
        this.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
      });
    }

    /* réglages : image de fond et thème */
    /* état initial */
    rendreCatalogue();
    majPanierCount();
    majBarreSuivi();
    afficherLogo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
