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
     Le bloc est sur la page catalogue : l'animation part
     a l'arrivee sur cette page, apres la visite.
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

    /* si l'image etait deja en cache, le load n'est pas relance */
    if (img.complete && img.naturalWidth > 0) {
      if (txt) txt.hidden = true;
      img.hidden = false;
    }
  }

  /* relance l'effet d'entree du logo, de bout en bout */
  function jouerLogo() {
    var hero = $('#logoHero');
    if (!hero) return;
    hero.classList.remove('logo-hero--joue');
    void hero.offsetWidth;   /* force le navigateur a recalculer */
    hero.classList.add('logo-hero--joue');
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
    if (r === '/gestion') rendreAdmin();

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
     VIGNETTE DE REMPLACEMENT
     Tant que la photo du produit n'existe pas, on affiche
     le nom du rayon tel qu'il est ecrit dans config.js.
     Emojis compris : « Cafés ☕ », « Thés 🍵 »...
     ------------------------------------------------------- */
  function vignette(p) {
    var premier = (p && p.medias && p.medias[0]) || null;
    if (premier && premier.type === 'image' && premier.src) {
      return '<img src="' + premier.src + '" alt="' + (p.nom || '') + '" loading="lazy">';
    }
    var texte = String((p && p.rayon) || '').trim();
    if (!texte) return '?';
    return texte.length > 14 ? texte.slice(0, 14) + '…' : texte;
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

  function rendreAvis() {
    rendreEtoiles();
    var ul = $('#avis');
    $('#avisCount').textContent = avis.length + (avis.length > 1 ? ' avis' : ' avis');

    if (!avis.length) {
      ul.innerHTML = '<li class="vide"><p>Aucun avis pour le moment. Soyez le premier.</p></li>';
      return;
    }
    ul.innerHTML = avis.map(function (a) {
      return '<li class="avis__item">' +
        '<div class="avis__head">' +
          '<span class="avis__nom">' + a.nom + '</span>' +
          '<span class="avis__note">' + '★'.repeat(a.note) + '</span>' +
        '</div>' +
        '<p class="avis__texte">' + a.texte + '</p>' +
      '</li>';
    }).join('');
  }

  function publierAvis(e) {
    e.preventDefault();
    var nom = $('#aNom').value.trim();
    var texte = $('#aTexte').value.trim();
    if (!nom || !texte) return;

    avis.unshift({ nom: nom, note: noteChoisie, texte: texte, date: new Date().toISOString() });
    ecrire('avis', avis);
    e.target.reset();
    noteChoisie = 5;
    rendreAvis();
  }

  /* =======================================================
     ADMIN — thèmes et réglages
     ======================================================= */
  function rendreAdmin() {
    var p = paletteActive();

    /* palettes */
    $('#palettes').innerHTML = Object.keys(BOUTIQUE.palettes).map(function (cle) {
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

    $$('[data-palette]').forEach(function (b) {
      b.addEventListener('click', function () {
        var cle = b.getAttribute('data-palette');
        theme = JSON.parse(JSON.stringify(BOUTIQUE.palettes[cle]));
        theme.cle = cle;
        appliquerTheme(theme);
        rendreAdmin();
      });
    });

    /* couleurs */
    var champs = [
      ['fond', 'Fond'], ['carte', 'Cartes'], ['texte', 'Texte'],
      ['doux', 'Texte secondaire'], ['accent', 'Accentuation'],
      ['accentTexte', 'Texte sur accent']
    ];
    $('#couleurs').innerHTML = champs.map(function (c) {
      return '<div class="couleur">' +
        '<label for="c-' + c[0] + '">' + c[1] + '</label>' +
        '<input type="color" id="c-' + c[0] + '" data-couleur="' + c[0] +
          '" value="' + (p[c[0]] || '#000000') + '">' +
      '</div>';
    }).join('');

    $$('[data-couleur]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        if (!theme) theme = JSON.parse(JSON.stringify(p));
        theme[inp.getAttribute('data-couleur')] = inp.value;
        appliquerTheme(theme);
      });
    });

    /* commandes en cours */
    var ul = $('#adminCommandes');
    if (!commande) {
      ul.innerHTML = '<li class="vide"><p>Aucune commande en cours.</p></li>';
    } else {
      ul.innerHTML = '<li class="admin-commande">' +
        '<span class="admin-commande__info">' + commande.ref + ' — étape <b>' +
          (commande.etape + 1) + '/' + BOUTIQUE.etapes.length + '</b><br>' +
          BOUTIQUE.etapes[commande.etape].label + '</span>' +
        '<span class="admin-commande__actions">' +
          '<button type="button" data-avance="-1"' +
            (commande.etape === 0 ? ' disabled' : '') + '>← Reculer</button>' +
          '<button type="button" data-avance="1"' +
            (commande.etape >= BOUTIQUE.etapes.length - 1 ? ' disabled' : '') + '>Avancer →</button>' +
        '</span>' +
      '</li>';
    }

    $$('[data-avance]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = parseInt(b.getAttribute('data-avance'), 10);
        commande.etape = Math.max(0, Math.min(BOUTIQUE.etapes.length - 1, commande.etape + d));
        ecrire('commande', commande);
        majBarreSuivi();
        rendreAdmin();
      });
    });
  }

  function deverrouiller(e) {
    e.preventDefault();
    var mdp = $('#mdp').value;
    var err = $('#verrouErreur');

    if (mdp === BOUTIQUE.adminMotDePasse) {
      err.hidden = true;
      $('#verrou').hidden = true;
      $('#reglages').hidden = false;
      rendreAdmin();
    } else {
      err.hidden = false;
      err.textContent = 'Mot de passe incorrect.';
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
      if (e.target.closest('#suiviAvancer')) avancerDepuisSuivi();
    });

    $('#versCommande').addEventListener('click', function () {
      if (!panier.length) return;
      location.hash = '#/commande';
    });

    /* menu mobile : le nav est déjà en bas, le burger reste un repère */
    $('#burger').addEventListener('click', function () {
      var ouvert = document.body.classList.toggle('menu-open');
      this.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
    });

    /* réglages : image de fond et thème */
    $('#fondFile').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var lecteur = new FileReader();
      lecteur.onload = function () {
        fondCustom = lecteur.result;
        ecrire('fond', fondCustom);
        $('#bgImage').src = fondCustom;
      };
      lecteur.readAsDataURL(f);
    });

    $('#fondReset').addEventListener('click', function () {
      fondCustom = null;
      effacer('fond');
      $('#bgImage').src = 'bg.PNG';
    });

    $('#themeSauver').addEventListener('click', function () {
      if (theme) ecrire('theme', theme);
    });

    $('#themeReset').addEventListener('click', function () {
      theme = null;
      effacer('theme');
      appliquerTheme(paletteActive());
      rendreAdmin();
    });

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
