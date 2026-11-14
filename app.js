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
  var mesRefs = lire('mesRefs', []);       // references de MES commandes
  var maRef = lire('maRef', null);          // la plus recente

  /* la page de gestion est-elle ouverte dans cette visite ?
     remise a zero a chaque chargement : on se reverrouille en revenant */
  var adminOuvert = false;

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
    if (r === '/suivi') {
      rendreSuivi();
      rafraichirSuivi();
    }
    if (r === '/commande') majBandeauComplement();
    if (r === '/avis') rendreAvis();
    if (r === '/gestion') {
      if (adminOuvert) ouvrirAdministration();
    } else if (adminOuvert) {
      /* on quitte la gestion : le mot de passe quitte la memoire */
      adminOuvert = false;
      gestionMotDePasse = '';
      commandesDistantes = [];
      chiffreMois = [];
    }

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
  /* Le catalogue vient de la base. On garde celui de config.js
     comme secours : si la base ne repond pas, le site reste
     utilisable au lieu d'afficher une page vide. */
  var CATALOGUE = (BOUTIQUE.produits || []).slice();

  function catalogue() {
    return CATALOGUE.length ? CATALOGUE : (BOUTIQUE.produits || []);
  }

  function rayons() {
    var vus = [];
    catalogue().forEach(function (p) {
      if (p && p.rayon && vus.indexOf(p.rayon) === -1) vus.push(p.rayon);
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
    /* Les photos deposees depuis la page de gestion passent en premier. */
    if (p && p.photos && p.photos.length) {
      return '<img src="' + p.photos[0] + '" alt="' + (p.nom || '') + '" loading="lazy">';
    }

    /* sinon, les visuels declares dans config.js */
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
    if (choix) {
      var rempli = false;
      try { rempli = choix.options && choix.options.length > 0; } catch (e) { rempli = false; }
      if (!rempli) {
        choix.innerHTML = '<option value="">Tous les rayons</option>' +
          rayons().map(function (r) { return '<option>' + r + '</option>'; }).join('');
        choix.addEventListener('change', filtrer);
      }
    }
    filtrer();
  }

  function filtrer() {
    var r = '';
    var champ = $('#rayon');
    if (champ) { try { r = champ.value || ''; } catch (e) { r = ''; } }

    var liste = catalogue().filter(function (p) { return !r || p.rayon === r; });
    var ul = $('#produits');
    if (!ul) return;

    var cpt = $('#prodCount');
    if (cpt) cpt.textContent = (liste.length < 10 ? '0' : '') + liste.length + ' réf.';

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
    return catalogue().filter(function (p) { return p.id === id; })[0];
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
      (sectionActive('commentaires')
        ? '<p class="fiche__desc">' + p.description + '</p>'
        : '') +
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
  /* Une reference courte, facile a lire et a taper :
     #C69-4821 — quatre chiffres, pas de lettres qui se confondent. */
  function reference() {
    var n = Math.floor(1000 + Math.random() * 9000);
    return '#C69-' + n;
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

    /* si le client complete une commande en cours, on ajoute
       ses articles a celle-ci au lieu d'en creer une nouvelle */
    if (commandeEnCours) {
      var nvArticles = panier.slice();
      commande = {
        ref: commandeEnCours,
        date: new Date().toISOString(),
        adresse: {
          nom: f.nom.value.trim(),
          tel: f.tel.value.trim(),
          adresse: f.adresse.value.trim(),
          cp: f.cp.value.trim(),
          ville: f.ville.value.trim()
        },
        articles: nvArticles,
        total: sous + fraisLivraison(sous),
        etape: 0,
        telegram: (f.telegram && f.telegram.value) ? f.telegram.value.trim() : '',
        complement: true
      };
      ecrire('commande', commande);
      envoyerComplementSupabase(commande);
      commandeEnCours = null;
      ecrire('commandeEnCours', null);
      panier = [];
      ecrire('panier', panier);
      majPanierCount();
      suiviCherche = null;
      location.hash = '#/suivi';
      return;
    }

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
      etape: 0,
      ajouts: 0,
      telegram: (f.telegram && f.telegram.value) ? f.telegram.value.trim() : ''
    };
    ecrire('commande', commande);
    ecrire('maRef', commande.ref);   // pour retrouver la commande ensuite
    maRef = commande.ref;
    /* on garde TOUTES mes commandes, pas seulement la derniere */
    mesRefs = (mesRefs || []).filter(function (r) { return r !== commande.ref; });
    mesRefs.unshift(commande.ref);
    if (mesRefs.length > 10) mesRefs = mesRefs.slice(0, 10);
    ecrire('mesRefs', mesRefs);

    /* envoi vers Supabase : la commande part dans la base,
       et la fonction serveur previent Telegram. */
    envoyerVersSupabase(commande);

    panier = [];
    ecrire('panier', panier);
    majPanierCount();

    location.hash = '#/suivi';
  }

  /* -------------------------------------------------------
     SUPABASE — depot de la commande
     Seule l'adresse du projet et la cle publiable sont ici :
     ce sont des valeurs faites pour etre visibles. Le jeton
     Telegram, lui, vit dans Supabase, jamais dans ce fichier.
     ------------------------------------------------------- */
  var SUPABASE_URL = 'https://jmhtdfbqleivsvootvma.supabase.co';
  var SUPABASE_CLE = 'sb_publishable_ns_kx2n4WNuvmhFRE4Tg-Q_W4NTpCb1';

  /* -------------------------------------------------------
     JOURNAL DES ENVOIS RATES
     Quand Supabase refuse un envoi, on le note : tu pourras
     voir ce qui a rate depuis la page de gestion.
     Le client, lui, ne voit rien.
     ------------------------------------------------------- */
  var derniereErreur = null;

  /* -------------------------------------------------------
     LE CATALOGUE VIENT DE LA BASE

     Le site lit les produits dans la table, plus dans
     config.js. C'est ce qui permettra de les modifier depuis
     la page de gestion.

     Si la base ne repond pas, ou si la table est vide, on
     garde le catalogue de config.js : le client voit
     toujours des produits au lieu d'une page blanche.
     ------------------------------------------------------- */
  var CATALOGUE_CHARGE = false;

  /* -------------------------------------------------------
     LES REGLAGES DE LA BOUTIQUE, AU CHARGEMENT

     On lit la table « reglages » avec la cle publique. C'est
     ce qui permet au fond, au logo, au nom et aux infos
     choisis dans la gestion d'apparaitre CHEZ TOUS LES
     VISITEURS, et pas seulement dans l'onglet du patron.
     ------------------------------------------------------- */
  function chargerReglagesPublics(callback) {
    fetch(SUPABASE_URL + '/rest/v1/reglages?select=*&id=eq.boutique&limit=1', {
      headers: {
        'apikey': SUPABASE_CLE,
        'Authorization': 'Bearer ' + SUPABASE_CLE
      }
    })
      .then(function (r) {
        if (!r.ok) throw new Error('reglages refuses (' + r.status + ')');
        return r.json();
      })
      .then(function (liste) {
        if (Array.isArray(liste) && liste.length) {
          REGLAGES = liste[0];
          appliquerReglagesVisibles();
          appliquerSections();
          afficherReseaux();
        }
        if (callback) callback(REGLAGES);
      })
      .catch(function () {
        if (callback) callback(null);
      });
  }

  /* -------------------------------------------------------
     LES SECTIONS ACTIVEES

     Decocher « Avis clients » dans la gestion retire l'onglet
     du menu. Un interrupteur eteint cache la page.
     ------------------------------------------------------- */
  /* Un interrupteur est-il actif ? Par defaut, oui : une
     boutique neuve a toutes ses sections. */
  function sectionActive(nom) {
    var s = (REGLAGES && REGLAGES.sections) || {};
    return s[nom] === undefined ? true : !!s[nom];
  }

  /* -------------------------------------------------------
     LES RESEAUX SUR LA PAGE INFOS

     On remplit le bloc « Nous trouver » avec les reseaux
     actifs. Ceux qui sont decoches dans la gestion ne
     s'affichent pas.
     ------------------------------------------------------- */
  function afficherReseaux() {
    /* ------------------------------------------------
       OU POSER LES RESEAUX

       1. Si la page a un bloc #infoReseaux, on s'en sert.
       2. Sinon, on cree le bloc a la fin de la vue
          « /infos », quoi qu'il arrive.
       3. En dernier recours, on construit un bloc
          autonome, ajoute a la fin de la page.

       Aucune modification du HTML n'est necessaire.
       ------------------------------------------------ */
    var zone = document.getElementById('infoReseaux');

    if (!zone) {
      var vueInfos = document.querySelector('.vue[data-vue="/infos"]');

      if (vueInfos) {
        var titreNous = null;
        var h2s = vueInfos.querySelectorAll('h2');

        for (var i = 0; i < h2s.length; i++) {
          var t = (h2s[i].textContent || '').toLowerCase();
          if (t.indexOf('nous trouver') > -1) { titreNous = h2s[i]; break; }
        }

        zone = document.createElement('div');
        zone.className = 'liste';
        zone.id = 'infoReseaux';

        if (titreNous) {
          /* on se pose juste apres la liste qui suit ce titre */
          var suite = titreNous.nextElementSibling;
          while (suite && !suite.classList.contains('liste')) {
            suite = suite.nextElementSibling;
          }
          if (suite && suite.parentNode) {
            suite.parentNode.insertBefore(zone, suite.nextSibling);
          } else {
            titreNous.parentNode.insertBefore(zone, titreNous.nextSibling);
          }
        } else {
          /* pas de titre : on se pose a la fin de la vue infos */
          vueInfos.appendChild(zone);
        }

        console.log('[reseaux] bloc cree dans la vue infos');
      } else {
        console.log('[reseaux] vue infos absente');
      }
    }

    if (!zone) { console.log('[reseaux] aucun emplacement trouve'); return; }

    var R = REGLAGES || {};
    var s = R.sections || {};
    var inf = R.infos || {};

    /* un interrupteur absent vaut « actif » */
    function actif(cle) { return s[cle] === undefined ? true : !!s[cle]; }

    var morceaux = [];

    /* --- 1. les horaires --- */
    if (actif('horaires')) {
      morceaux.push(
        '<div class="liste__item">' +
          '<span class="liste__ico" aria-hidden="true">\u{1F552}</span>' +
          '<span class="liste__txt">Horaires</span>' +
          '<span class="liste__valeur">' + (inf.horaires || '7j/7 \u00b7 12h-00h') + '</span>' +
        '</div>'
      );
    }

    /* --- 2. le contact --- */
    if (actif('contact') && inf.contact) {
      morceaux.push(
        '<a class="liste__item liste__item--clic" href="mailto:' + String(inf.contact) + '">' +
          '<span class="liste__ico" aria-hidden="true">\u2709</span>' +
          '<span class="liste__txt">Contact</span>' +
          '<span class="liste__fleche" aria-hidden="true">\u203A</span>' +
        '</a>'
      );
    }

    /* --- 3. les reseaux --- */
    var liste = (R.reseaux || []).filter(function (x) {
      return x && x.url && x.actif !== false;
    });

    liste.forEach(function (x) {
      var r = reseauParCle(x.cle);
      var logo = (x.logo || r.logo)
        ? '<img src="' + (x.logo || r.logo) + '" alt="" width="22" height="22" ' +
          'loading="lazy" style="display:block">'
        : '<span style="font-size:1.1rem">' + (x.emoji || r.emoji || '🔗') + '</span>';

      morceaux.push(
        '<a class="liste__item liste__item--clic" href="' + String(x.url) + '" ' +
          'target="_blank" rel="noopener">' +
          '<span class="liste__ico">' + logo + '</span>' +
          '<span class="liste__txt">' + (x.nom || r.nom) + '</span>' +
          '<span class="liste__fleche" aria-hidden="true">\u203A</span>' +
        '</a>'
      );
    });

    /* --- 4. la liste d'origine du HTML est retiree --- */
    var vueInfos = document.querySelector('.vue[data-vue="/infos"]');
    if (vueInfos) {
      var ancienne = zone.previousElementSibling;
      if (ancienne && ancienne.classList.contains('liste') &&
          !ancienne.id && ancienne.querySelector('a[href^="mailto"]')) {
        ancienne.hidden = true;
      }
    }

    if (!morceaux.length) {
      zone.innerHTML = '';
      zone.hidden = true;
      return;
    }

    zone.hidden = false;
    zone.innerHTML = morceaux.join('');
  }

  function appliquerSections() {
    var s = (REGLAGES && REGLAGES.sections) || {};

    function actif(nom) {
      return s[nom] === undefined ? true : !!s[nom];
    }

    var routes = {
      avis:      '/avis',
      livraison: '/suivi',
      rayons:    '/'
    };

    $$('.nav__links a').forEach(function (a) {
      var r = a.getAttribute('data-route');
      var cle = null;
      if (r === '/avis') cle = 'avis';
      if (r === '/suivi') cle = 'livraison';
      if (cle && !actif(cle)) a.hidden = true;
      else a.hidden = false;
    });

    /* Le menu de rayons, sur le catalogue */
    var zone = document.querySelector('.rayons');
    if (zone) zone.hidden = !actif('rayons');

    /* Le lien « Mes commandes » de la page Infos */
    var lienSuivi = document.querySelector('.liste__item--clic[data-route="/suivi"]');
    if (lienSuivi) lienSuivi.hidden = !actif('livraison');
  }

  function chargerCatalogue(callback) {
    fetch(SUPABASE_URL + '/rest/v1/produits?select=*&actif=eq.true&masque=eq.false&order=position.asc', {
      headers: {
        'apikey': SUPABASE_CLE,
        'Authorization': 'Bearer ' + SUPABASE_CLE
      }
    })
      .then(function (r) {
        if (!r.ok) throw new Error('catalogue refuse (' + r.status + ')');
        return r.json();
      })
      .then(function (liste) {
        if (Array.isArray(liste) && liste.length) {
          CATALOGUE = liste.map(function (p) {
            return {
              id:          p.id,
              nom:         p.nom,
              rayon:       p.rayon || 'Divers',
              emoji:       p.emoji || '',
              format:      p.format || '',
              unite:       p.unite || '',
              prix:        Number(p.prix) || 0,
              stock:       p.stock || 'disponible',
              badge:       p.badge || '',
              description: p.description || '',
              medias:      p.medias || [],
              photos:      p.photos || []
            };
          });
        }
        CATALOGUE_CHARGE = true;
        if (callback) callback(CATALOGUE);
      })
      .catch(function () {
        CATALOGUE_CHARGE = true;
        if (callback) callback(CATALOGUE);
      });
  }

  /* -------------------------------------------------------
     JETON DE SUIVI
     Un identifiant opaque, cree au premier chargement et garde
     dans le navigateur. Il permet au client de lire SA commande,
     et a lui seul : sans lui, la base ne renvoie rien.
     ------------------------------------------------------- */
  function jetonSuivi() {
    var v = null;
    try { v = localStorage.getItem('corner69.suivi_jeton'); } catch (e) { v = null; }
    if (!v) {
      var octets = [];
      if (window.crypto && window.crypto.getRandomValues) {
        var t = new Uint8Array(16);
        window.crypto.getRandomValues(t);
        octets = Array.prototype.slice.call(t);
      } else {
        for (var i = 0; i < 16; i++) octets.push(Math.floor(Math.random() * 256));
      }
      v = octets.map(function (n) { return ('0' + n.toString(16)).slice(-2); }).join('');
      try { localStorage.setItem('corner69.suivi_jeton', v); } catch (e) {}
    }
    return v;
  }

  /* Banniere discrete : previent le visiteur sans casser la page. */
  /* -------------------------------------------------------
     BANDEAU D'ERREUR
     Toute erreur JavaScript s'affiche a l'ecran, au lieu de
     laisser la page muette. Utile quand on n'a pas d'outils
     de developpeur — et le bandeau se ferme d'un appui.
     ------------------------------------------------------- */
  function bandeauErreur(texte) {
    if (!texte) return;
    var z = document.getElementById('corner69Erreur');
    if (!z) {
      z = document.createElement('div');
      z.id = 'corner69Erreur';
      z.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;' +
        'background:#2a0d0d;color:#ffb4b4;border-top:3px solid #ff5c5c;' +
        'padding:14px 16px;font:12px/1.5 ui-monospace,Menlo,monospace;' +
        'white-space:pre-wrap;max-height:50vh;overflow:auto;' +
        '-webkit-user-select:text;user-select:text';
      z.addEventListener('click', function () {
        if (z.parentNode) z.parentNode.removeChild(z);
      });
      document.body.appendChild(z);
    }
    z.textContent += (z.textContent ? '\n\n' : '') +
      '⚠ ' + texte + '\n(appuyez ici pour fermer)';
  }

  /* Toute erreur non rattrapee s'affiche. */
  window.addEventListener('error', function (e) {
    bandeauErreur('Erreur : ' + (e.message || 'inconnue') +
      (e.filename ? '\nFichier : ' + String(e.filename).split('/').pop() +
        ' ligne ' + e.lineno : ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    bandeauErreur('Erreur : ' + ((r && (r.message || r)) || 'promesse rejetee'));
  });

  function afficherAlerte(texte) {
    if (!texte) return;
    var z = document.getElementById('corner69Alerte');
    if (!z) {
      z = document.createElement('div');
      z.id = 'corner69Alerte';
      z.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;' +
        'background:#22100e;color:#fff8f6;border:1px solid rgba(255,255,255,.18);' +
        'border-radius:12px;padding:12px 14px;font:14px/1.4 system-ui,sans-serif';
      document.body.appendChild(z);
    }
    z.textContent = texte;
    clearTimeout(z._t);
    z._t = setTimeout(function () { if (z.parentNode) z.parentNode.removeChild(z); }, 8000);
  }

  /* Appel d'une fonction ouverte au public : le jeton de suivi
     part dans les parametres, la base l'exige. */
  function appelPublic(nom, parametres, callback) {
    fetch(SUPABASE_URL + '/rest/v1/rpc/' + nom, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CLE,
        'Authorization': 'Bearer ' + SUPABASE_CLE,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(parametres || {})
    })
      .then(function (r) {
        return r.text().then(function (txt) {
          var data = null;
          try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
          if (!r.ok) {
            var msg = (data && (data.message || data.hint || data.error)) || ('erreur ' + r.status);
            throw new Error(String(msg));
          }
          return data;
        });
      })
      .then(function (data) { if (callback) callback(data, null); })
      .catch(function (e) { if (callback) callback(null, e); });
  }

  /* Appel d'une fonction de gestion : le mot de passe est
     verifie par la base a chaque appel. */
  function appelGestion(nom, parametres, callback) {
    return appelPublic(nom, parametres, callback);
  }

  /* Prevenir la boutique et le client sur Telegram.
     Les adresses viennent de config.js : aucun secret ici. */
  function prevenirNotifications(nom, donnees) {
    /* Si la boutique a desactive les notifications, on ne
       declenche aucun envoi — meme si le reste est en place. */
    if (!sectionActive('telegram')) return;

    var reglages = (nom === 'notifier-etape') ? BOUTIQUE.notifEtape : BOUTIQUE.notifications;
    if (!reglages || !reglages.active || !reglages.url) return;

    try {
      fetch(reglages.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donnees || {})
      }).catch(function () {});
    } catch (e) {}
  }

  function noterErreur(ref, champ, message, code) {
    derniereErreur = { ref: ref, champ: champ, message: message, quand: new Date() };
    try {
      fetch(SUPABASE_URL + '/rest/v1/envois_rates', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_CLE,
          'Authorization': 'Bearer ' + SUPABASE_CLE,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          ref: ref || '',
          champ: champ || '',
          message: message || '',
          code: code || 0
        })
      }).catch(function () {});
    } catch (e) {}
  }

  /* -------------------------------------------------------
     COMPLETER UNE COMMANDE
     On relit la commande dans la base, on fusionne les articles,
     puis on renvoie le tout. La fonction serveur previent la
     boutique de la commande mise a jour.
     ------------------------------------------------------- */
  function envoyerComplementSupabase(cmd) {
    if (!cmd || !cmd.ref) return;

    var nouveaux = (cmd.articles || []).map(function (l) {
      var p = produitDe(l.id);
      return {
        nom: p ? p.nom : l.id,
        format: p ? p.format : '',
        qte: l.qte,
        prix: p ? p.prix : 0,
        sousTotal: p ? (p.prix * l.qte) : 0
      };
    });

    appelPublic('lire_commande_ajout',
      { p_ref: cmd.ref, p_jeton: jetonSuivi() },
      function (data) {
        var c = (data && data.ok) ? data.commande : null;
        var anciens = (c && c.articles) || [];

        if (!c) {
          afficherAlerte('Votre commande n\u2019a pas pu etre retrouvee. Reessayez dans un instant.');
          return;
        }
        /* le total precedent n'est plus necessaire : il est recalcule
           juste en dessous, a partir des articles fusionnes. */

        /* on fusionne : meme produit = on additionne les quantites */
        var fusion = anciens.slice();
        nouveaux.forEach(function (nv) {
          var trouve = fusion.filter(function (a) {
            return a.nom === nv.nom && a.format === nv.format;
          })[0];
          if (trouve) {
            trouve.qte = (Number(trouve.qte) || 1) + nv.qte;
            trouve.sousTotal = (Number(trouve.prix) || 0) * trouve.qte;
          } else {
            fusion.push(nv);
          }
        });

        var total = fusion.reduce(function (t, a) {
          return t + (Number(a.sousTotal) || 0);
        }, 0);

        var nbAjouts = (c && Number(c.ajouts)) || 0;

        appelPublic('completer_commande', {
          p_ref:      cmd.ref,
          p_jeton:    jetonSuivi(),
          p_articles: fusion,
          p_total:    total,
          p_ajouts:   nbAjouts + 1,
          p_telegram: cmd.telegram || ''
        }, function (rep, err) {
          if (err || !rep || !rep.ok) {
            afficherAlerte('Vos articles n\u2019ont pas pu etre ajoutes a la commande.');
            return;
          }
          /* Le client a complete sa commande : la boutique ET le client
             sont prevenus, comme pour une commande neuve. Les articles
             fusionnes partent dans le message, pour que la boutique
             voie le panier a jour et non le seul ajout. */
          var corps = {
            ref:             cmd.ref,
            date:            new Date().toISOString(),
            nom:             c.nom || '',
            telephone:       c.telephone || '',
            adresse:         c.adresse || '',
            code_postal:     c.code_postal || '',
            ville:           c.ville || '',
            articles:        fusion,
            total:           total,
            etape:           Number(c.etape) || 0,
            telegram_client: cmd.telegram || c.telegram_client || '',
            ajout:           true
          };
          prevenirNotifications('notifier-commande', corps);
        });
      });
  }

  function envoyerVersSupabase(cmd) {
    if (!cmd) return;

    /* on enrichit chaque article avec ses details complets */
    var articles = (cmd.articles || []).map(function (l) {
      var p = produitDe(l.id);
      return {
        nom: p ? p.nom : l.id,
        format: p ? p.format : '',
        qte: l.qte,
        prix: p ? p.prix : 0,
        sousTotal: p ? (p.prix * l.qte) : 0
      };
    });

    var corps = {
      ref: cmd.ref,
      nom: cmd.adresse ? cmd.adresse.nom : '',
      telephone: cmd.adresse ? cmd.adresse.tel : '',
      adresse: cmd.adresse ? cmd.adresse.adresse : '',
      code_postal: cmd.adresse ? cmd.adresse.cp : '',
      ville: cmd.adresse ? cmd.adresse.ville : '',
      articles: articles,
      total: cmd.total || 0,
      etape: cmd.etape || 0,
      telegram_client: cmd.telegram || '',
      suivi_jeton: jetonSuivi()
    };

    /* On previent la boutique sur Telegram (et le client, s'il a
       laisse son identifiant). Le jeton du bot reste dans les
       secrets Supabase : rien de secret ne passe par ici. */
    prevenirNotifications('notifier-commande', corps);

    try {
      fetch(SUPABASE_URL + '/rest/v1/commandes', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_CLE,
          'Authorization': 'Bearer ' + SUPABASE_CLE,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(corps)
      }).then(function (r) {
        if (!r.ok) {
          /* l'envoi a ete refuse : on note pourquoi */
          return r.text().then(function (detail) {
            noterErreur(corps.ref, 'commande', detail, r.status);
            afficherAlerte('Votre commande n\u2019a pas pu etre transmise. Verifiez votre connexion et reessayez.');
          });
        }
      }).catch(function () {});
    } catch (e) {}
  }


  /* -------------------------------------------------------
     LECTURE DES COMMANDES — pour la page de gestion
     On va chercher les commandes reelles dans Supabase.
     Chaque ligne : reference, client, adresse, panier, total,
     etape. C'est ce qui remplace la commande locale.
     ------------------------------------------------------- */
  var commandesDistantes = [];
  var gestionMotDePasse = '';

  /* Reglages de la boutique, charges depuis la base */
  var REGLAGES = null;
  var CATEGORIES_GESTION = [];

  /* Gestion des produits : liste chargee, recherche, filtre */
  var PRODUITS_GESTION = [];
  var rechercheProduit = '';
  var filtreProduitRayon = '';

  /* -------------------------------------------------------
     CHARGER LES PRODUITS POUR LA GESTION

     La liste complete, produits masques compris : c'est ce
     qui permet de les remettre en vente.
     ------------------------------------------------------- */
  function chargerReglages(callback) {
    if (!gestionMotDePasse) { if (callback) callback(null); return; }
    appelGestion('gestion_reglages', { p_mot_de_passe: gestionMotDePasse }, function (data, err) {
      REGLAGES = (data && data.ok) ? data.reglages : null;
      if (callback) callback(REGLAGES);
    });
  }

  function chargerCategoriesGestion(callback) {
    if (!gestionMotDePasse) { CATEGORIES_GESTION = []; if (callback) callback([]); return; }
    appelGestion('gestion_categories', { p_mot_de_passe: gestionMotDePasse }, function (data, err) {
      CATEGORIES_GESTION = (data && data.ok && Array.isArray(data.categories)) ? data.categories : [];
      if (callback) callback(CATEGORIES_GESTION);
    });
  }

  function chargerProduitsGestion(callback) {
    if (!gestionMotDePasse) { PRODUITS_GESTION = []; if (callback) callback([]); return; }

    appelGestion('gestion_produits', { p_mot_de_passe: gestionMotDePasse }, function (data, err) {
      if (err || !data || !data.ok) {
        PRODUITS_GESTION = [];
        if (callback) callback([]);
        return;
      }
      PRODUITS_GESTION = Array.isArray(data.produits) ? data.produits : [];
      if (callback) callback(PRODUITS_GESTION);
    });
  }

  function chargerCommandes(callback) {
    if (!gestionMotDePasse) { commandesDistantes = []; if (callback) callback([]); return; }

    appelGestion('gestion_commandes', { p_mot_de_passe: gestionMotDePasse }, function (data, err) {
      if (err || !data || !data.ok) {
        commandesDistantes = [];
        if (callback) callback([]);
        return;
      }
      commandesDistantes = Array.isArray(data.commandes) ? data.commandes : [];
      if (callback) callback(commandesDistantes);
    });
  }

  /* le chiffre du jour, calcule sur les vraies commandes */
  /* -------------------------------------------------------
     LE CHIFFRE PAR MOIS
     On lit la vue « recap_mois » : un mois par ligne, avec le
     nombre de commandes, les livrees, les remboursees, les
     annulees, et le chiffre encaisse.
     ------------------------------------------------------- */
  var chiffreMois = [];

  function chargerChiffre(callback) {
    if (!gestionMotDePasse) { chiffreMois = []; if (callback) callback([]); return; }

    appelGestion('gestion_recap', { p_mot_de_passe: gestionMotDePasse }, function (data) {
      chiffreMois = (data && data.ok && Array.isArray(data.mois)) ? data.mois : [];
      if (callback) callback(chiffreMois);
    });
  }

  /* le total d'un mois donne (ou du mois en cours) */
  function moisDu(mois) {
    var trouve = chiffreMois.filter(function (m) { return m.mois === mois; })[0];
    return trouve || { mois: mois, total_commandes: 0, chiffre: 0, en_cours: 0, livrees: 0, remboursees: 0, annulees: 0 };
  }

  function cleMois(decalage) {
    var d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + decalage);
    var m = String(d.getMonth() + 1);
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m);
  }

  function nomMois(mois) {
    var parts = String(mois).split('-');
    var noms = ['janvier','fevrier','mars','avril','mai','juin',
                'juillet','aout','septembre','octobre','novembre','decembre'];
    var i = parseInt(parts[1], 10) - 1;
    return (noms[i] || parts[1]) + ' ' + parts[0];
  }

  function chiffreDuJour() {
    var debut = new Date();
    debut.setHours(0, 0, 0, 0);
    var total = 0;
    var nb = 0;
    commandesDistantes.forEach(function (cmd) {
      var quand = new Date(cmd.cree_le);
      if (quand >= debut) { total += Number(cmd.total) || 0; nb += 1; }
    });
    return { total: total, nb: nb };
  }

  function enCours() {
    return commandesDistantes.filter(function (cmd) {
      return (Number(cmd.etape) || 0) < BOUTIQUE.etapes.length - 1;
    }).length;
  }

  /* =======================================================
     SUIVI
     ======================================================= */
  /* -------------------------------------------------------
     SUIVI — le client retrouve sa commande par sa reference.
     On interroge Supabase : la commande suit donc son etat
     reel, meme depuis un autre appareil.
     ------------------------------------------------------- */
  var suiviCherche = null;   /* la commande trouvee dans la base */
  var commandeEnCours = lire('commandeEnCours', null);  /* commande a completer */

  function chercherCommande(ref, callback) {
    var propre = String(ref || '').trim().toUpperCase().replace(/^#/, '');
    if (propre.length < 4) { callback(null); return; }

    appelPublic('chercher_commande',
      { p_ref: propre, p_jeton: jetonSuivi() },
      function (data) {
        callback((data && data.ok) ? data.commande : null);
      });
  }

  /* on relit la commande dans Supabase : etape et statut reels */
  function rafraichirSuivi() {
    if (!maRef) return;
    chercherCommande(maRef, function (trouvee) {
      if (!trouvee) return;

      /* l'etape a-t-elle bouge depuis la derniere fois ? */
      var avant = suiviCherche ? Number(suiviCherche.etape) : null;
      suiviCherche = trouvee;
      majBarreSuivi();

      /* on previent le client sur la page, sans recharger
         toute la vue : le changement se voit tout de suite */
      if (route() === '/suivi') rendreSuivi();

      if (avant !== null && Number(trouvee.etape) !== avant) {
        suiviCherche = trouvee;
        rendreSuivi();
      }
    });
  }

  /* On peut encore completer la commande tant que la preparation
     n'a pas commence. Au dela, on passe une nouvelle commande. */
  function peutAjouter(cmd) {
    if (!cmd) return false;
    if (cmd.statut && cmd.statut !== 'en_cours') return false;
    return (Number(cmd.etape) || 0) < 2;
  }

  /* le bandeau, sur la page commande, quand on complete une commande */
  function majBandeauComplement() {
    var p = $('#formComplement');
    var r = $('#formComplementRef');
    if (!p) return;
    if (commandeEnCours) {
      p.hidden = false;
      if (r) r.textContent = commandeEnCours;
    } else {
      p.hidden = true;
    }
  }

  function rendreSuivi() {
    var box = $('#suivi');
    if (!box) return;

    /* s'il n'y a rien a suivre, on propose le champ de recherche
       et la liste de mes commandes deja passees */
    if (!commande && !suiviCherche) {
      var note1 = $('#suiviNote');
      if (note1) note1.hidden = true;
      box.innerHTML =
        '<div class="suivi__recherche">' +
          '<p class="suivi__intro">Entrez la reference de votre commande ' +
            'pour voir ou elle en est. Elle vous a ete donnee a la validation.</p>' +
          '<form class="suivi__form" id="formSuivi" novalidate>' +
            '<input id="suiviRefCherche" type="text" placeholder="#CMD-1234AB" ' +
              'autocomplete="off" autocapitalize="characters">' +
            '<button class="btn btn--accent" type="submit">Rechercher</button>' +
          '</form>' +
          '<p class="form__note" id="suiviErreur" hidden></p>' +
          (mesRefs && mesRefs.length
            ? '<div class="suivi__mes-commandes">' +
                '<span class="suivi__sous-titre">Mes commandes</span>' +
                '<div class="suivi__puce-liste">' +
                  mesRefs.map(function (r) {
                    return '<button type="button" class="suivi__puce" data-ref="' + r + '">' +
                      r + '</button>';
                  }).join('') +
                '</div>' +
              '</div>'
            : '') +
        '</div>';
      return;
    }

    /* la commande affichee : celle qu'on vient de trouver, sinon la locale */
    var note2 = $('#suiviNote');
    if (note2 && suiviCherche) note2.hidden = true;
    var cmd = suiviCherche || commande;
    var e = Math.min(Number(cmd.etape) || 0, BOUTIQUE.etapes.length - 1);
    var pct = Math.round(((e + 1) / BOUTIQUE.etapes.length) * 100);
    var courante = BOUTIQUE.etapes[e];

    var quand = new Date(cmd.cree_le || cmd.date);
    var dateTxt = 'Passee le ' + quand.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
                  ' a ' + quand.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    var articles = (cmd.articles || []).reduce(function (t, a) {
      return t + (Number(a.qte) || 1);
    }, 0);

    var close = cmd.statut && cmd.statut !== 'en_cours';
    var badgeClose = close
      ? '<span class="cmd-badge' +
          (cmd.statut === 'remboursee' ? ' cmd-badge--rembourse' : ' cmd-badge--annule') +
        '">' + (cmd.statut === 'remboursee' ? 'Remboursee' : 'Annulee') + '</span> '
      : '';

    box.innerHTML =
      '<div class="suivi__entete">' +
        '<div class="suivi__ring" style="--pct:' + (close ? 100 : pct) + '%"><span>' +
          (close
            ? (cmd.statut === 'remboursee' ? '💸' : '❌')
            : (e + 1)) + '</span>' +
          '<small>' + (close ? '' : '/' + BOUTIQUE.etapes.length) + '</small></div>' +
        '<div>' +
          '<div class="suivi__ref">' + badgeClose + (cmd.ref || '') + '</div>' +
          '<p class="suivi__etat">' +
            (close
              ? (cmd.statut === 'remboursee' ? '💸 Commande remboursee' : '❌ Commande annulee')
              : courante.label + ' ' + courante.emoji) + '</p>' +
          '<div class="suivi__date">' + dateTxt + '</div>' +
        '</div>' +
      '</div>' +

      '<ul class="jalons">' +
        BOUTIQUE.etapes.map(function (et, i) {
          var cls = close ? '' : (i < e ? 'fait' : (i === e ? 'encours' : ''));
          var point = close ? '\u2013' : (i < e ? '\u2713' : (i + 1));
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
        '<div class="recap__row"><span>Articles</span><span>' + articles + '</span></div>' +
        '<div class="recap__row"><span>Livrer a</span><span>' +
          (cmd.nom || (cmd.adresse && cmd.adresse.nom) || '') + ', ' +
          (cmd.ville || (cmd.adresse && cmd.adresse.ville) || '') + '</span></div>' +
        '<div class="recap__row recap__row--total"><span>Total paye</span><b>' +
          euros(Number(cmd.total) || 0) + '</b></div>' +
      '</aside>' +

      (peutAjouter(cmd)
        ? '<button class="btn btn--accent btn--large" id="suiviAjouter" type="button" ' +
            'data-ref="' + cmd.ref + '">Ajouter des articles a ma commande</button>'
        : '') +
      '<button class="retour" id="suiviAutre" type="button" ' +
        'style="margin-top:1.2rem">Chercher une autre commande</button>';
  }

  function majBarreSuivi() {
    var barre = $('#suiviBar');
    if (!barre) return;
    /* on affiche la commande trouvee dans la base si elle existe,
       sinon la commande locale */
    var c = suiviCherche || commande;
    if (!c) { barre.hidden = true; return; }
    /* le client l'a masquee avec la croix : elle ne revient pas */
    try {
      if (sessionStorage.getItem('corner69.suiviMasque') === '1') { barre.hidden = true; return; }
    } catch (err) {}
    barre.hidden = false;
    var e = Math.min(Number(c.etape) || 0, BOUTIQUE.etapes.length - 1);
    var pct = Math.round(((e + 1) / BOUTIQUE.etapes.length) * 100);
    var finie = c.statut && c.statut !== 'en_cours';
    var anneau = barre.querySelector('.suivi-carte__ring');
    var petit = anneau ? anneau.querySelector('small') : null;
    if ($('#suiviPct')) {
      $('#suiviPct').textContent = finie
        ? (c.statut === 'remboursee' ? '💸' : '❌')
        : (e + 1);
    }
    /* Sur une commande close, le « /5 » n'a plus de sens :
       on le retire et le symbole occupe tout l'anneau, donc
       il se centre tout seul. */
    if (petit) petit.hidden = !!finie;
    if ($('#suiviRef')) $('#suiviRef').textContent = c.ref || '';
    if ($('#suiviLabel')) {
      $('#suiviLabel').textContent = finie
        ? (c.statut === 'remboursee'
            ? '💸 Commande remboursee'
            : '❌ Commande annulee')
        : BOUTIQUE.etapes[e].label + ' ' + BOUTIQUE.etapes[e].emoji;
    }
    var badge = $('#suiviBadge');
    if (badge) {
      badge.textContent = finie
        ? (c.statut === 'remboursee' ? 'Remboursee' : 'Annulee')
        : 'Etape ' + (e + 1) + '/' + BOUTIQUE.etapes.length;
    }
    barre.querySelector('.suivi-carte__ring').style.setProperty('--pct', (finie ? 100 : pct) + '%');
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

    /* Le mot de passe est verifie par la BASE, pas ici :
       le code du site ne contient plus aucun mot de passe. */
    if (err) { err.hidden = true; }

    appelGestion('gestion_verifier', { p_mot_de_passe: mdp }, function (data) {
      if (!data || !data.ok) {
        if (err) { err.hidden = false; err.textContent = 'Mot de passe incorrect.'; }
        return;
      }
      gestionMotDePasse = mdp;
      adminOuvert = true;
      ouvrirAdministration();
      chargerChiffre(function () {
        chargerCommandes(function () { rendreAdministration(); });
      });
    });
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

    /* les chiffres viennent des vraies commandes de Supabase */
    var jour = chiffreDuJour();
    var cartes = [
      { ico: '\uD83D\uDED2', label: 'Commandes', valeur: String(jour.nb), note: 'Aujourd\u2019hui', cible: 'commandes' },
      { ico: '\u20AC',        label: 'Chiffre',   valeur: euros(jour.total), note: 'Aujourd\u2019hui', cible: 'commandes' },
      { ico: '\uD83D\uDCCB', label: 'En cours',  valeur: String(enCours()), note: '\u00C0 livrer', cible: 'commandes' },
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

    if (quoi === 'commandes') c.innerHTML = commandeOuverte
      ? detailCommande(commandeOuverte)
      : panneauCommandes();
    else if (quoi === 'produits') {
      c.innerHTML = panneauProduits();
      chargerProduitsGestion(function () {
        c.innerHTML = panneauProduits();
        cablerPanneau('produits');
      });
    }
    else if (quoi === 'categories') {
      c.innerHTML = panneauCategories();
      chargerCategoriesGestion(function () {
        c.innerHTML = panneauCategories();
        cablerPanneau('categories');
      });
    }
    else if (quoi === 'avis') c.innerHTML = panneauAvis();
    else if (quoi === 'erreurs') {
      c.innerHTML = panneauErreurs();
      chargerEnvoisRates(function () { c.innerHTML = panneauErreurs(); });
    }
    else if (quoi === 'chiffre') {
      c.innerHTML = panneauChiffre();
      chargerChiffre(function () { c.innerHTML = panneauChiffre(); });
    }
    else if (quoi === 'reglages') {
      c.innerHTML = panneauReglages();
      try { cablerReglages(); } catch (e) { /* l'ecran s'affiche quand meme */ }
    }

    cablerPanneau(quoi);
    p.hidden = false;
    p.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function fermerPanneau() {
    var p = $('#panneau');
    if (p) p.hidden = true;
  }

  /* -------------------------------------------------------
     LE DETAIL D'UNE COMMANDE
     Reference, etat, articles, totaux, puis les actions :
     avancer, reculer, rembourser, annuler. Le suivi s'affiche
     en dessous, comme sur la maquette.
     ------------------------------------------------------- */
  function detailCommande(ref) {
    var liste = BOUTIQUE.etapes;
    var cmd = commandesDistantes.filter(function (x) { return x.ref === ref; })[0];
    if (!cmd) return '<p class="vide">Commande introuvable.</p>';

    var e = Math.min(Number(cmd.etape) || 0, liste.length - 1);
    var pct = Math.round(((e + 1) / liste.length) * 100);
    var courante = liste[e];
    var derniere = e >= liste.length - 1;

    var quand = new Date(cmd.cree_le);
    var dateTxt = 'Passe le ' + quand.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
                  ' a ' + quand.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    var articles = (cmd.articles || []).map(function (a) {
      return '<li class="cmd-art">' +
        '<span class="cmd-art__img">' + (a.emoji || '\uD83D\uDCE6') + '</span>' +
        '<span class="cmd-art__txt">' +
          '<b>' + (a.nom || '?') + '</b>' +
          '<small>' + euros(Number(a.prix) || 0) + ' \u00B7 ' + (a.qte || 1) + ' \u00D7 ' +
            (a.format || '') + '</small>' +
        '</span>' +
        '<span class="cmd-art__qte">\u00D7 ' + (a.qte || 1) + '</span>' +
      '</li>';
    }).join('');

    var totalArticles = (cmd.articles || []).reduce(function (t, a) {
      return t + (Number(a.qte) || 1);
    }, 0);

    var jalons = liste.map(function (et, i) {
      var cls = i < e ? 'fait' : (i === e ? 'encours' : '');
      var point = i < e ? '\u2713' : (i + 1);
      var suite = i === e ? '<p class="jalon__txt">Etape en cours</p>' : '';
      return '<li class="jalon ' + cls + '">' +
        '<span class="jalon__point">' + point + '</span>' +
        '<div><p class="jalon__titre">' + et.label + ' ' + et.emoji + '</p>' + suite + '</div>' +
      '</li>';
    }).join('');

    return '' +
      '<header class="cmd-entete">' +
        '<button class="cmd-retour" type="button" data-liste="1" aria-label="Retour">\u2190</button>' +
        '<div>' +
          '<span class="cmd-surtitre">COMMANDE</span>' +
          '<h2 class="cmd-ref">' + (cmd.ref || '') + '</h2>' +
        '</div>' +
      '</header>' +

      '<div class="cmd-bandeau">' +
        '<div class="cmd-anneau" style="--pct:' + pct + '%">' +
          '<span>' + (e + 1) + '</span><small>/' + liste.length + '</small>' +
        '</div>' +
        '<div class="cmd-bandeau__txt">' +
          (Number(cmd.ajouts) > 0
            ? '<span class="cmd-badge cmd-badge--ajout">+ ' + cmd.ajouts +
              ' ajout' + (Number(cmd.ajouts) > 1 ? 's' : '') + '</span> '
            : '') +
          '<span class="cmd-badge' +
            (cmd.statut === 'remboursee' ? ' cmd-badge--rembourse' : '') +
            (cmd.statut === 'annulee' ? ' cmd-badge--annule' : '') + '">' +
            (cmd.statut === 'remboursee' ? 'Remboursee'
              : cmd.statut === 'annulee' ? 'Annulee'
              : 'Payee') + '</span>' +
          '<b>' + courante.label + ' ' + courante.emoji + '</b>' +
          '<small>' + dateTxt + '</small>' +
        '</div>' +
      '</div>' +

      (cmd.statut && cmd.statut !== 'en_cours'
        ? '<h3 class="cmd-titre">Actions</h3>' +
          '<p class="cmd-note">Cette commande est close : ' +
          (cmd.statut === 'remboursee' ? 'elle a ete remboursee.' : 'elle a ete annulee.') +
          '</p>' +
          '<button class="cmd-action" type="button" data-reouvrir="' + cmd.ref + '">' +
            '\u21A9 Remettre en cours</button>' +
          '<h3 class="cmd-titre">Suivi</h3>'
        : '<h3 class="cmd-titre">Actions</h3>' +
          '<button class="cmd-action cmd-action--principale" type="button" data-avancer="' + cmd.ref + '"' +
            (derniere ? ' disabled' : '') + '>' +
            (derniere ? 'Commande livree' : 'Passer a : ' + liste[e + 1].label + ' ' +
              liste[e + 1].emoji + ' \u2192') +
          '</button>' +
          '<button class="cmd-action" type="button" data-reculer="' + cmd.ref + '"' +
            (e === 0 ? ' disabled' : '') + '>\u21A9 Revenir a l\u2019etape ' + e + '</button>' +
          '<div class="cmd-action__duo">' +
            '<button class="cmd-action cmd-action--doux" type="button" data-rembourser="' + cmd.ref + '">' +
              '\u21A9 Remboursee</button>' +
            '<button class="cmd-action cmd-action--danger" type="button" data-annuler="' + cmd.ref + '">' +
              '\u2298 Annuler</button>' +
          '</div>' +
          '<p class="cmd-note">Le client est notifie sur Telegram a chaque changement d\u2019etape.</p>' +
          '<h3 class="cmd-titre">Suivi</h3>') +
      '<button class="cmd-action cmd-action--principale" type="button" data-avancer="' + cmd.ref + '"' +
        (derniere ? ' disabled' : '') + '>' +
        (derniere ? 'Commande livree' : 'Passer a : ' + liste[e + 1].label + ' ' +
          liste[e + 1].emoji + ' \u2192') +
      '</button>' +
      '<button class="cmd-action" type="button" data-reculer="' + cmd.ref + '"' +
        (e === 0 ? ' disabled' : '') + '>\u21A9 Revenir a l\u2019etape ' + e + '</button>' +
      '<div class="cmd-action__duo">' +
        '<button class="cmd-action cmd-action--doux" type="button" data-rembourser="' + cmd.ref + '">' +
          '\u21A9 Remboursee</button>' +
        '<button class="cmd-action cmd-action--danger" type="button" data-annuler="' + cmd.ref + '">' +
          '\u2298 Annuler</button>' +
      '</div>' +
      '<p class="cmd-note">Le client est notifie sur Telegram a chaque changement d\u2019etape.</p>' +

      (Number(cmd.ajouts) > 0 && cmd.dernier_ajout
        ? '<p class="cmd-ajout-note">\u2795 Commande completee ' +
          Number(cmd.ajouts) + ' fois \u00B7 dernier ajout le ' +
          new Date(cmd.dernier_ajout).toLocaleDateString('fr-FR',
            { day: 'numeric', month: 'short' }) + ' a ' +
          new Date(cmd.dernier_ajout).toLocaleTimeString('fr-FR',
            { hour: '2-digit', minute: '2-digit' }) + '</p>'
        : '') +
      '<h3 class="cmd-titre">Livraison en cours</h3>' +
      '<div class="cmd-livreur">' +
        '<span class="cmd-livreur__label">Vehicule</span>' +
        '<div class="cmd-vehicules">' +
          vehiculeBouton(cmd, 'trottinette', '\U0001F6F4', 'Trottinette') +
          vehiculeBouton(cmd, 'scooter', '\U0001F6F5', 'Scooter') +
          vehiculeBouton(cmd, 'voiture', '\U0001F697', 'Voiture') +
          vehiculeBouton(cmd, 'velo', '\U0001F6B2', 'Velo') +
        '</div>' +
        '<span class="cmd-livreur__label">Mot pour le client</span>' +
        '<div class="cmd-message">' +
          '<input id="cmdMessage" type="text" placeholder="Ex : je pars dans 20 minutes"' +
            ' value="' + (cmd.message_livreur || '').replace(/"/g, '&quot;') + '">' +
          '<button type="button" data-message="' + cmd.ref + '">Envoyer</button>' +
        '</div>' +
        '<p class="cmd-note">Le client recoit ce message avec la prochaine etape.</p>' +
      '</div>' +

      '<h3 class="cmd-titre">Suivi</h3>' +
      '<ul class="jalons">' + jalons + '</ul>' +

      '<h3 class="cmd-titre">Articles <span class="cmd-compte">' +
        (totalArticles < 10 ? '0' : '') + totalArticles + ' art.</span></h3>' +
      '<ul class="cmd-articles">' + articles + '</ul>' +

      '<aside class="recap" style="margin-top:1rem">' +
        '<div class="recap__row"><span>Sous-total</span><span>' +
          euros(Number(cmd.total) || 0) + '</span></div>' +
        '<div class="recap__row"><span>Livraison</span><span>Offerte</span></div>' +
        '<div class="recap__row recap__row--total"><span>Total paye</span><b>' +
          euros(Number(cmd.total) || 0) + '</b></div>' +
      '</aside>' +

      '<h3 class="cmd-titre">Livraison</h3>' +
      '<div class="liste">' +
        '<div class="liste__item">' +
          '<span class="liste__ico">\uD83D\uDC64</span>' +
          '<span class="liste__txt">' + (cmd.nom || '') + '</span>' +
          '<span class="liste__valeur">' + (cmd.telephone || '') + '</span>' +
        '</div>' +
        '<div class="liste__item">' +
          '<span class="liste__ico">\uD83D\uDCCD</span>' +
          '<span class="liste__txt">' + (cmd.adresse || '') + '</span>' +
          '<span class="liste__valeur">' + (cmd.code_postal || '') + ' ' + (cmd.ville || '') + '</span>' +
        '</div>' +
      '</div>';
  }

  /* le filtre choisi dans la liste des commandes */
  var filtreStatut = 'a_traiter';

  function commandesFiltrees() {
    return commandesDistantes.filter(function (cmd) {
      var st = cmd.statut || 'en_cours';
      var e = Number(cmd.etape) || 0;
      var max = BOUTIQUE.etapes.length - 1;

      if (filtreStatut === 'a_traiter')  return st === 'en_cours' && e < max;
      if (filtreStatut === 'livrees')    return st === 'en_cours' && e >= max;
      if (filtreStatut === 'annulees')   return st === 'annulee';
      if (filtreStatut === 'remboursees')return st === 'remboursee';
      return true;   /* toutes */
    });
  }

  function ongletsStatut() {
    var tous = commandesDistantes.length;
    var aTraiter = commandesFiltreesAvec('a_traiter').length;
    var livrees = commandesFiltreesAvec('livrees').length;
    var annulees = commandesFiltreesAvec('annulees').length;
    var remboursees = commandesFiltreesAvec('remboursees').length;

    function onglet(cle, label, n) {
      return '<button type="button" class="cmd-onglet' +
        (filtreStatut === cle ? ' actif' : '') + '" data-filtre="' + cle + '">' +
        label + ' <small>' + n + '</small></button>';
    }

    return '<div class="cmd-onglets">' +
      onglet('a_traiter', 'A traiter', aTraiter) +
      onglet('livrees', 'Livrees', livrees) +
      onglet('annulees', 'Annulees', annulees) +
      onglet('remboursees', 'Remboursees', remboursees) +
      onglet('toutes', 'Toutes', tous) +
    '</div>';
  }

  /* le meme filtre, pour une cle donnee (sert aux compteurs) */
  function commandesFiltreesAvec(cle) {
    return commandesDistantes.filter(function (cmd) {
      var st = cmd.statut || 'en_cours';
      var e = Number(cmd.etape) || 0;
      var max = BOUTIQUE.etapes.length - 1;
      if (cle === 'a_traiter')   return st === 'en_cours' && e < max;
      if (cle === 'livrees')     return st === 'en_cours' && e >= max;
      if (cle === 'annulees')    return st === 'annulee';
      if (cle === 'remboursees') return st === 'remboursee';
      return true;
    });
  }

  /* un bouton par vehicule : celui qui est choisi est en accent */
  function vehiculeBouton(cmd, cle, emoji, label) {
    var choisi = (cmd.vehicule || 'scooter') === cle;
    return '<button type="button" class="cmd-vehicule' +
      (choisi ? ' actif' : '') + '" data-vehicule="' + cmd.ref + '" data-valeur="' + cle + '">' +
      '<span aria-hidden="true">' + emoji + '</span>' + label +
    '</button>';
  }

  /* Enregistre une suppression : on garde la trace locale
     pour que la boutique se rafraichisse immediatement. */
  function apresSuppression(message) {
    chargerCommandes(function () {
      var c = $('#panneauContenu');
      if (c) { c.innerHTML = panneauCommandes(); cablerPanneau('commandes'); }
      rendreAdministration();
      if (message) afficherAlerte(message);
    });
  }

  /* Supprimer une commande precise. */
  function supprimerCommande(ref) {
    if (!confirm('Supprimer definitivement la commande ' + ref + ' ?\n\n' +
                 'Cette action est irreversible.')) return;

    appelGestion('gestion_supprimer_commande',
      { p_mot_de_passe: gestionMotDePasse, p_ref: ref },
      function (rep, err) {
        if (err || !rep || !rep.ok) {
          afficherAlerte((err && err.message) ? err.message : 'Suppression impossible.');
          return;
        }
        apresSuppression('Commande ' + ref + ' supprimee.');
      });
  }

  /* Tout effacer : on demande de taper SUPPRIMER. */
  function purgerCommandes() {
    var saisie = prompt(
      'Effacer TOUTES les commandes ?\n\n' +
      'Cette action est irreversible. Elle sert a retirer vos commandes de test ' +
      'avant d\u2019ouvrir aux vrais clients.\n\n' +
      'Pour confirmer, tapez : SUPPRIMER');
    if (saisie === null) return;

    /* On accepte « SUPPRIMER » quelle que soit la casse ou les espaces :
       le clavier du telephone met souvent une majuscule automatique. */
    var normalise = String(saisie).trim().toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (normalise !== 'SUPPRIMER') {
      afficherAlerte('Purge annulee : il fallait taper SUPPRIMER.');
      return;
    }

    /* On envoie la forme normalisee, pour que la base l'accepte aussi. */
    saisie = 'SUPPRIMER';

    appelGestion('gestion_purger_commandes',
      { p_mot_de_passe: gestionMotDePasse, p_confirmation: saisie },
      function (rep, err) {
        if (err || !rep || !rep.ok) {
          afficherAlerte((err && err.message) ? err.message : 'Purge annulee.');
          return;
        }
        apresSuppression((rep.supprimees || 0) + ' commande(s) supprimee(s).');
      });
  }

  function panneauCommandes() {
    var barreOutils =
      '<div class="cmd-outils">' +
        '<button class="btn btn--ghost" type="button" id="cmdPurger">' +
          'Effacer toutes les commandes' + '</button>' +
        '<p class="fond__hint">' +
          'Sert a retirer vos commandes de test. L\u2019action demande une confirmation.' +
        '</p>' +
      '</div>';

    if (!commandesDistantes.length) {
      return '<h2 class="admin__sous-titre">Commandes</h2>' + barreOutils +
             '<p class="vide">Aucune commande enregistree pour le moment.</p>';
    }

    var liste = commandesFiltrees();

    return barreOutils + ongletsStatut() +
      (liste.length
        ? '<ul class="admin-commandes">' + liste.map(function (cmd) {
      var liste = BOUTIQUE.etapes;
      var e = Math.min(Number(cmd.etape) || 0, liste.length - 1);
      var quand = new Date(cmd.cree_le);
      var dateTxt = quand.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
                    ' a ' + quand.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      var nbAj = Number(cmd.ajouts) || 0;
      var boutonSup = '<button class="admin-liste__sup" type="button" ' +
        'data-supprimer="' + cmd.ref + '">Supprimer</button>';

      var marque = nbAj
        ? '<span class="admin-commande__ajout">+ ' + nbAj + ' ajout' +
          (nbAj > 1 ? 's' : '') + '</span>'
        : '';

      return '<li class="admin-commande" data-ouvrir="' + cmd.ref + '">' +
        '<span class="admin-commande__ico">' + liste[e].emoji + '</span>' +
        '<span class="admin-commande__txt">' +
          '<b>' + (cmd.ref || '') + ' \u00B7 ' + (cmd.nom || '') + marque + '</b>' +
          '<small>' + dateTxt + ' \u00B7 ' + liste[e].label + '</small>' +
        '</span>' +
        '<span class="admin-commande__prix">' + euros(Number(cmd.total) || 0) + '</span>' +
        boutonSup +
        '<span class="admin-commande__fleche">\u203A</span>' +
      '</li>';
    }).join('') + '</ul>'
        : '<p class="vide">Aucune commande dans cette categorie.</p>');
  }

  /* -------------------------------------------------------
     LE PANNEAU DU CHIFFRE D'AFFAIRES
     Aujourd'hui, ce mois, le mois dernier, puis le detail
     mois par mois, du plus recent au plus ancien.
     ------------------------------------------------------- */
  /* -------------------------------------------------------
     LES ENVOIS RATES
     On lit le journal : ce qui a ete refuse par Supabase.
     Personne d'autre que toi ne voit cette page.
     ------------------------------------------------------- */
  var envoisRates = [];

  function chargerEnvoisRates(callback) {
    fetch(SUPABASE_URL + '/rest/v1/envois_rates?select=*&order=cree_le.desc&limit=50', {
      headers: {
        'apikey': SUPABASE_CLE,
        'Authorization': 'Bearer ' + SUPABASE_CLE
      }
    })
      .then(function (r) {
        if (!r.ok) throw new Error('lecture refusee (' + r.status + ')');
        return r.json();
      })
      .then(function (liste) {
        envoisRates = Array.isArray(liste) ? liste : [];
        if (callback) callback(envoisRates);
      })
      .catch(function () {
        envoisRates = [];
        if (callback) callback([]);
      });
  }

  function panneauErreurs() {
    if (!envoisRates.length) {
      return '<h2 class="admin__sous-titre">Envois rates</h2>' +
        '<p class="vide">Aucun envoi refuse. Tout va bien.</p>';
    }

    return '<h2 class="admin__sous-titre">Envois rates</h2>' +
      '<p class="fond__hint" style="margin-bottom:1rem">' +
        envoisRates.length + ' envoi' + (envoisRates.length > 1 ? 's' : '') +
        ' refuse' + (envoisRates.length > 1 ? 's' : '') +
        ' par Supabase. Ces commandes ne sont pas arrivees.</p>' +
      '<ul class="admin-liste">' + envoisRates.map(function (e) {
        var quand = new Date(e.cree_le);
        var dateTxt = quand.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
                      ' a ' + quand.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return '<li class="admin-liste__item">' +
          '<span class="admin-liste__txt">' +
            '<b>' + (e.ref || 'sans reference') + '</b>' +
            '<small>' + dateTxt + ' \u00B7 code ' + (e.code || '?') + '</small>' +
            '<small>' + String(e.message || '').substring(0, 120) + '</small>' +
          '</span>' +
        '</li>';
      }).join('') + '</ul>';
  }

  function panneauChiffre() {
    var ceMois = cleMois(0);
    var moisDernier = cleMois(-1);

    var jour = chiffreDuJour();
    var mCourant = moisDu(ceMois);
    var mPrecedent = moisDu(moisDernier);

    /* la comparaison avec le mois dernier */
    var actuel = Number(mCourant.chiffre) || 0;
    var avant = Number(mPrecedent.chiffre) || 0;
    var evolution = '';
    if (avant > 0) {
      var pct = Math.round(((actuel - avant) / avant) * 100);
      evolution = (pct >= 0 ? '+' : '') + pct + ' % vs mois dernier';
    } else if (actuel > 0) {
      evolution = 'Premier mois d\u2019activite';
    }

    var html =
      '<h2 class="admin__sous-titre">Chiffre d\u2019affaires</h2>' +

      '<div class="tuiles">' +
        '<div class="tuile">' +
          '<span class="tuile__label">Aujourd\u2019hui</span>' +
          '<span class="tuile__valeur tuile__valeur--accent">' + euros(jour.total) + '</span>' +
          '<span class="tuile__note">' + jour.nb + ' commande' + (jour.nb > 1 ? 's' : '') + '</span>' +
        '</div>' +
        '<div class="tuile">' +
          '<span class="tuile__label">Ce mois</span>' +
          '<span class="tuile__valeur tuile__valeur--accent">' + euros(actuel) + '</span>' +
          '<span class="tuile__note">' + (mCourant.total_commandes || 0) + ' commande' +
            ((mCourant.total_commandes || 0) > 1 ? 's' : '') +
            (evolution ? ' \u00B7 ' + evolution : '') + '</span>' +
        '</div>' +
      '</div>' +

      '<h3 class="admin__bloc">Ce mois en detail</h3>' +
      '<div class="liste">' +
        ligneCompte('Commandes recues', mCourant.total_commandes) +
        ligneCompte('Livrees', mCourant.livrees) +
        ligneCompte('En cours', mCourant.en_cours) +
        ligneCompte('Remboursees', mCourant.remboursees) +
        ligneCompte('Annulees', mCourant.annulees) +
      '</div>' +

      '<h3 class="admin__bloc">Mois par mois</h3>';

    if (!chiffreMois.length) {
      html += '<p class="vide">Aucun chiffre enregistre pour le moment.</p>';
      return html;
    }

    html += '<ul class="admin-liste">' + chiffreMois.map(function (m) {
      var c = Number(m.chiffre) || 0;
      return '<li class="admin-liste__item">' +
        '<span class="admin-liste__txt">' +
          '<b>' + nomMois(m.mois) + '</b>' +
          '<small>' + m.total_commandes + ' commande' +
            (m.total_commandes > 1 ? 's' : '') +
            (Number(m.remboursees) ? ' \u00B7 ' + m.remboursees + ' remboursee' +
              (m.remboursees > 1 ? 's' : '') : '') +
            (Number(m.annulees) ? ' \u00B7 ' + m.annulees + ' annulee' +
              (m.annulees > 1 ? 's' : '') : '') +
          '</small>' +
        '</span>' +
        '<span class="admin-liste__ok">' + euros(c) + '</span>' +
      '</li>';
    }).join('') + '</ul>';

    html += '<p class="fond__hint" style="margin-top:1rem">' +
      'Seules les commandes en cours sont comptees. ' +
      'Une commande remboursee ou annulee ne fait pas de chiffre.</p>';

    return html;
  }

  function ligneCompte(label, valeur) {
    return '<div class="liste__item">' +
      '<span class="liste__txt">' + label + '</span>' +
      '<span class="liste__valeur">' + (Number(valeur) || 0) + '</span>' +
    '</div>';
  }

  function panneauProduits() {
    if (!gestionMotDePasse) {
      return '<h2 class="admin__sous-titre">Produits</h2>' +
        '<p class="fond__hint">Entrez le mot de passe pour gerer le catalogue.</p>';
    }

    var liste = PRODUITS_GESTION.length ? PRODUITS_GESTION : catalogue();

    /* --- la barre d'outils : recherche, rayon, ajouter --- */
    var rayonsGestion = [];
    liste.forEach(function (p) {
      if (p.rayon && rayonsGestion.indexOf(p.rayon) === -1) rayonsGestion.push(p.rayon);
    });
    rayonsGestion.sort();

    var outils =
      '<div class="prod-outils">' +
        '<input id="prodRecherche" type="text" placeholder="Rechercher un produit..." ' +
          'autocomplete="off" value="' + (rechercheProduit || '').replace(/"/g, '&quot;') + '">' +
        '<select id="prodRayon">' +
          '<option value="">Tous les rayons</option>' +
          rayonsGestion.map(function (r) {
            return '<option' + (r === filtreProduitRayon ? ' selected' : '') + '>' + r + '</option>';
          }).join('') +
        '</select>' +
        '<button class="btn btn--accent" type="button" id="prodAjouter">+ Ajouter</button>' +
      '</div>';

    /* --- on filtre --- */
    var q = String(rechercheProduit || '').toLowerCase();
    var filtres = liste.filter(function (p) {
      var okRayon = !filtreProduitRayon || p.rayon === filtreProduitRayon;
      var okTexte = !q ||
        String(p.nom || '').toLowerCase().indexOf(q) > -1 ||
        String(p.description || '').toLowerCase().indexOf(q) > -1;
      return okRayon && okTexte;
    });

    var compte =
      '<p class="fond__hint" style="margin:1rem 0">' +
        filtres.length + ' produit' + (filtres.length > 1 ? 's' : '') +
        (liste.length !== filtres.length ? ' sur ' + liste.length : '') +
      '</p>';

    /* --- la liste --- */
    var contenu;
    if (!filtres.length) {
      contenu = '<p class="fond__hint">Aucun produit ne correspond. ' +
        'Appuyez sur « + Ajouter » pour en creer un.</p>';
    } else {
      contenu = '<ul class="admin-liste">' + filtres.map(function (p) {
        var photo = (p.photos && p.photos[0]) || (p.medias && p.medias[0] && p.medias[0].src) || '';
        var vign = photo
          ? '<img src="' + photo + '" alt="" loading="lazy">'
          : (p.emoji || String(p.nom || '?').charAt(0));
        var masque = p.masque ? ' <small>(masque)</small>' : '';
        return '<li class="admin-liste__item">' +
          '<span class="admin-liste__img">' + vign + '</span>' +
          '<span class="admin-liste__txt">' +
            '<b>' + (p.nom || 'Sans nom') + '</b>' + masque +
            '<small>' + (p.rayon || 'Divers') + ' \u00B7 ' +
              (p.format || '') + ' \u00B7 ' + euros(Number(p.prix) || 0) + '</small>' +
          '</span>' +
          '<span class="' + (p.stock === 'rupture' ? 'admin-liste__rupture' : 'admin-liste__ok') + '">' +
            (p.stock === 'rupture' ? 'Rupture' : 'En stock') +
          '</span>' +
          '<button class="btn btn--ghost" type="button" data-prod-edit="' + p.id + '">Modifier</button>' +
        '</li>';
      }).join('') + '</ul>';
    }

    return '<h2 class="admin__sous-titre">Produits</h2>' + outils + compte + contenu;
  }

  /* =======================================================
     LA FICHE PRODUIT
     Un seul ecran pour creer et pour modifier : quand l'id
     est vide, c'est un nouveau produit.
     ======================================================= */
  var produitEnCours = null;

  function ouvrirFicheProduit(id) {
    produitEnCours = id;
    var c = $('#panneauContenu');
    if (!c) return;

    if (!id) {
      /* nouveau produit : on prepare une fiche vide */
      c.innerHTML = ficheProduit(null);
      cablerFicheProduit(null);
      return;
    }

    /* produit existant : on le lit dans la liste deja chargee */
    var p = PRODUITS_GESTION.filter(function (x) { return x.id === id; })[0];
    if (!p) {
      appelGestion('gestion_produit_lire',
        { p_mot_de_passe: gestionMotDePasse, p_id: id },
        function (data) {
          var prod = (data && data.ok) ? data.produit : null;
          c.innerHTML = ficheProduit(prod);
          cablerFicheProduit(prod);
        });
      return;
    }

    c.innerHTML = ficheProduit(p);
    cablerFicheProduit(p);
  }

  function ficheProduit(p) {
    p = p || {};
    var nouveau = !p.id;
    var rayonsGestion = [];
    PRODUITS_GESTION.forEach(function (x) {
      if (x.rayon && rayonsGestion.indexOf(x.rayon) === -1) rayonsGestion.push(x.rayon);
    });
    rayonsGestion.sort();

    function val(nom, defaut) {
      var v = p[nom];
      if (v === undefined || v === null) v = defaut;
      return String(v).replace(/"/g, '&quot;');
    }

    return '<h2 class="admin__sous-titre">' +
        (nouveau ? 'Nouveau produit' : 'Modifier le produit') + '</h2>' +

      '<button class="retour" type="button" id="prodRetour">Retour aux produits</button>' +

      '<div class="fiche-prod">' +

        '<label class="fiche-prod__label">Nom du produit *</label>' +
        '<input id="fNom" type="text" value="' + val('nom', '') + '" ' +
          'placeholder="Cafe de specialite — Ethiopie">' +

        '<label class="fiche-prod__label">Rayon</label>' +
        '<input id="fRayon" type="text" list="listeRayons" value="' + val('rayon', '') + '" ' +
          'placeholder="Cafes">' +
        '<datalist id="listeRayons">' +
          rayonsGestion.map(function (r) { return '<option value="' + r + '">'; }).join('') +
        '</datalist>' +

        '<div class="fiche-prod__2">' +
          '<div>' +
            '<label class="fiche-prod__label">Prix (\u20AC)</label>' +
            '<input id="fPrix" type="number" step="0.01" min="0" ' +
              'value="' + val('prix', '') + '" placeholder="14.50">' +
          '</div>' +
          '<div>' +
            '<label class="fiche-prod__label">Format</label>' +
            '<input id="fFormat" type="text" value="' + val('format', '') + '" ' +
              'placeholder="250 g">' +
          '</div>' +
        '</div>' +

        '<div class="fiche-prod__2">' +
          '<div>' +
            '<label class="fiche-prod__label">Emoji (vignette)</label>' +
            '<input id="fEmoji" type="text" value="' + val('emoji', '') + '" ' +
              'placeholder="\u2615" maxlength="4">' +
          '</div>' +
          '<div>' +
            '<label class="fiche-prod__label">Badge</label>' +
            '<input id="fBadge" type="text" value="' + val('badge', '') + '" ' +
              'placeholder="Nouveau, Limite...">' +
          '</div>' +
        '</div>' +

        '<label class="fiche-prod__label">Description</label>' +
        '<textarea id="fDescription" rows="4" ' +
          'placeholder="Grains laves, notes florales et fruitees...">' +
          String(p.description || '') + '</textarea>' +

        '<label class="fiche-prod__label">Photos du produit</label>' +
        '<div class="fiche-prod__photos" id="fPhotos">' + photosFiche(p) + '</div>' +
        '<input id="fPhotoFichier" type="file" accept="image/*" multiple hidden>' +
        '<button class="btn btn--ghost" type="button" id="fPhotoAjouter">' +
          'Ajouter une photo' + '</button>' +
        '<p class="fond__hint" style="margin-top:.4rem">' +
          'JPG, PNG ou WebP \u00B7 5 Mo maximum par image. ' +
          'L\u2019emoji sert de vignette tant qu\u2019il n\u2019y a pas de photo.' +
        '</p>' +

        '<label class="fiche-prod__label">Stock</label>' +
        '<select id="fStock">' +
          '<option value="disponible"' + (p.stock !== 'rupture' ? ' selected' : '') + '>' +
            'Disponible</option>' +
          '<option value="rupture"' + (p.stock === 'rupture' ? ' selected' : '') + '>' +
            'Rupture de stock</option>' +
        '</select>' +

        '<label class="fiche-prod__label">' +
          '<input id="fMasque" type="checkbox"' + (p.masque ? ' checked' : '') + '> ' +
          'Masquer ce produit (il n\u2019apparait plus sur la boutique)' +
        '</label>' +

        '<p class="form__note" id="prodErreur" hidden></p>' +

        '<div class="fiche-prod__actions">' +
          '<button class="btn btn--accent btn--large" type="button" id="prodEnregistrer">' +
            (nouveau ? 'Creer le produit' : 'Enregistrer') + '</button>' +
          (nouveau ? '' :
            '<button class="btn btn--ghost" type="button" id="prodMasquer">' +
              (p.masque ? 'Remettre en vente' : 'Masquer') + '</button>' +
            '<button class="btn btn--ghost" type="button" id="prodSupprimer">Supprimer</button>') +
        '</div>' +

      '</div>';
  }

  /* -------------------------------------------------------
     LES PHOTOS DU PRODUIT

     Le client choisit une image sur son telephone, elle part
     dans le stockage Supabase, et l'adresse est enregistree
     sur le produit. Il ne touche jamais a GitHub.
     ------------------------------------------------------- */

  /* Les vignettes deja enregistrees, avec leur bouton retirer. */
  function photosFiche(p) {
    var liste = (p && p.photos) || [];
    if (!liste.length) {
      return '<p class="fond__hint">Aucune photo pour le moment.</p>';
    }
    return liste.map(function (url, i) {
      return '<span class="fiche-prod__vignette">' +
        '<img src="' + url + '" alt="" loading="lazy">' +
        '<button type="button" data-photo-retirer="' + i + '" ' +
          'aria-label="Retirer cette photo">&#10005;</button>' +
      '</span>';
    }).join('');
  }

  /* On garde les adresses en memoire pendant l'edition. */
  var photosEnCours = [];

  /* Envoie une image dans le stockage et renvoie son adresse. */
  function envoyerPhoto(fichier, callback) {
    var nom = 'p' + Date.now().toString(36) +
      '-' + Math.random().toString(36).slice(2, 7) +
      '.' + (fichier.name.split('.').pop() || 'jpg').toLowerCase();

    fetch(SUPABASE_URL + '/storage/v1/object/produits/' + nom, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CLE,
        'Authorization': 'Bearer ' + SUPABASE_CLE,
        'Content-Type': fichier.type || 'image/jpeg',
        'x-upsert': 'true'
      },
      body: fichier
    })
      .then(function (r) {
        if (!r.ok) throw new Error('envoi refuse (' + r.status + ')');
        return r.json();
      })
      .then(function () {
        callback(SUPABASE_URL + '/storage/v1/object/public/produits/' + nom, null);
      })
      .catch(function (e) { callback(null, e); });
  }

  function cablerFicheProduit(p) {
    var c = $('#panneauContenu');
    if (!c) return;

    var retour = $('#prodRetour', c);
    if (retour) retour.addEventListener('click', function () {
      c.innerHTML = panneauProduits();
      cablerPanneau('produits');
    });

    /* --- les photos : on initialise la liste en memoire --- */
    photosEnCours = ((p && p.photos) ? p.photos.slice() : []);

    var boutonPhoto = $('#fPhotoAjouter', c);
    var champPhoto = $('#fPhotoFichier', c);
    if (boutonPhoto && champPhoto) {
      boutonPhoto.addEventListener('click', function () { champPhoto.click(); });

      champPhoto.addEventListener('change', function () {
        var fichiers = Array.prototype.slice.call(champPhoto.files || []);
        if (!fichiers.length) return;

        var restants = fichiers.length;
        fichiers.forEach(function (f) {
          if (f.size > 5 * 1024 * 1024) {
            var note = $('#prodErreur', c);
            if (note) {
              note.hidden = false;
              note.textContent = '« ' + f.name + ' » depasse 5 Mo : choisissez une image plus legere.';
            }
            restants -= 1;
            return;
          }
          envoyerPhoto(f, function (url, err) {
            var note = $('#prodErreur', c);
            if (err || !url) {
              if (note) {
                note.hidden = false;
                note.textContent = 'La photo « ' + f.name + ' » n\u2019a pas pu etre envoyee.';
              }
            } else {
              photosEnCours.push(url);
            }
            restants -= 1;
            if (restants <= 0) {
              var zone = $('#fPhotos', c);
              if (zone) zone.innerHTML = photosFiche({ photos: photosEnCours });
              cablerVignettes(c);
            }
          });
        });
        champPhoto.value = '';
      });
    }
    cablerVignettes(c);

    var enr = $('#prodEnregistrer', c);
    if (enr) enr.addEventListener('click', function () { enregistrerProduit(p); });

    var mas = $('#prodMasquer', c);
    if (mas) mas.addEventListener('click', function () {
      if (!p) return;
      appelGestion('gestion_produit_masquer',
        { p_mot_de_passe: gestionMotDePasse, p_id: p.id, p_masque: !p.masque },
        function () { chargerProduitsGestion(function () {
          c.innerHTML = panneauProduits();
          cablerPanneau('produits');
        }); });
    });

    var sup = $('#prodSupprimer', c);
    if (sup) sup.addEventListener('click', function () {
      if (!p) return;
      if (!confirm('Supprimer definitivement « ' + p.nom + ' » ?\n\n' +
                   'Si ce produit a deja ete vendu, la suppression sera refusee : masquez-le.')) return;
      appelGestion('gestion_supprimer_produit',
        { p_mot_de_passe: gestionMotDePasse, p_id: p.id },
        function (rep, err) {
          var note = $('#prodErreur', c);
          if (err || !rep || !rep.ok) {
            if (note) {
              note.hidden = false;
              note.textContent = (err && err.message) ? err.message :
                'Suppression refusee : masquez le produit a la place.';
            }
            return;
          }
          chargerProduitsGestion(function () {
            c.innerHTML = panneauProduits();
            cablerPanneau('produits');
          });
        });
    });
  }

  /* Les croix pour retirer une photo de la liste. */
  function cablerVignettes(c) {
    var zone = $('#fPhotos', c);
    if (!zone) return;
    $$('[data-photo-retirer]', zone).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = parseInt(b.getAttribute('data-photo-retirer'), 10);
        photosEnCours.splice(i, 1);
        zone.innerHTML = photosFiche({ photos: photosEnCours });
        cablerVignettes(c);
      });
    });
  }

  function enregistrerProduit(p) {
    var c = $('#panneauContenu');
    var note = $('#prodErreur', c);
    if (note) note.hidden = true;

    var nom = $('#fNom', c).value.trim();
    if (!nom) {
      if (note) { note.hidden = false; note.textContent = 'Le nom du produit est obligatoire.'; }
      return;
    }

    var prix = parseFloat(String($('#fPrix', c).value).replace(',', '.'));
    if (isNaN(prix)) prix = 0;

    /* Un identifiant lisible, a partir du nom, si c'est un nouveau produit. */
    var id = (p && p.id) ? p.id : 'p' + Date.now().toString(36);

    appelGestion('gestion_produit', {
      p_mot_de_passe: gestionMotDePasse,
      p_id:           id,
      p_nom:          nom,
      p_rayon:        $('#fRayon', c).value.trim() || 'Divers',
      p_prix:         prix,
      p_format:       $('#fFormat', c).value.trim(),
      p_emoji:        $('#fEmoji', c).value.trim(),
      p_description:  $('#fDescription', c).value.trim(),
      p_stock:        $('#fStock', c).value,
      p_badge:        $('#fBadge', c).value.trim(),
      p_unite:        '',
      p_masque:       $('#fMasque', c).checked,
      p_position:     (p && p.position) ? p.position : 0
    }, function (rep, err) {
      if (err || !rep || !rep.ok) {
        if (note) {
          note.hidden = false;
          note.textContent = (err && err.message) ? err.message : 'Enregistrement impossible.';
        }
        return;
      }
      /* Le produit est enregistre : on lui attache ses photos. */
      if (photosEnCours.length) {
        appelGestion('gestion_produit_photos', {
          p_mot_de_passe: gestionMotDePasse,
          p_id:           id,
          p_photos:       photosEnCours
        }, function () {
          photosEnCours = [];
          chargerProduitsGestion(function () {
            c.innerHTML = panneauProduits();
            cablerPanneau('produits');
          });
        });
        return;
      }

      chargerProduitsGestion(function () {
        c.innerHTML = panneauProduits();
        cablerPanneau('produits');
      });
    });
  }

  function panneauCategories() {
    if (!gestionMotDePasse) {
      return '<h2 class="admin__sous-titre">Catégories</h2>' +
        '<p class="fond__hint">Entrez le mot de passe pour gérer les rayons.</p>';
    }

    var liste = CATEGORIES_GESTION.length ? CATEGORIES_GESTION : [];

    var outils =
      '<div class="prod-outils">' +
        '<button class="btn btn--accent" type="button" id="catAjouter">+ Nouveau rayon</button>' +
        '<button class="btn btn--ghost" type="button" id="catImporter">' +
          'Reprendre mes rayons existants' + '</button>' +
      '</div>' +
      '<p class="fond__hint" style="margin:.7rem 0 1rem">' +
        'Renommer un rayon met à jour les produits qui le portent. ' +
        'Retirer un rayon ne supprime aucun produit : ils passent en « Divers ».' +
      '</p>';

    var contenu;
    if (!liste.length) {
      contenu = '<p class="vide">Aucun rayon enregistré. ' +
        'Appuyez sur « Reprendre mes rayons existants » pour partir de votre catalogue, ' +
        'ou créez-en un.</p>';
    } else {
      contenu = '<ul class="admin-liste">' + liste.map(function (c) {
        var n = Number(c.nb) || 0;
        return '<li class="admin-liste__item">' +
          '<span class="admin-liste__img">' + (c.emoji || '\uD83C\uDFF7') + '</span>' +
          '<span class="admin-liste__txt">' +
            '<b>' + (c.nom || 'Sans nom') + '</b>' +
            '<small>' + n + ' produit' + (n > 1 ? 's' : '') + '</small>' +
          '</span>' +
          '<button class="admin-liste__sup" type="button" data-cat-edit="' + c.id + '">' +
            'Modifier</button>' +
          '<button class="admin-liste__sup" type="button" data-cat-sup="' + c.id + '">' +
            'Retirer</button>' +
        '</li>';
      }).join('') + '</ul>';
    }

    return '<h2 class="admin__sous-titre">Catégories</h2>' + outils + contenu;
  }

  /* -------------------------------------------------------
     LA FICHE D'UN RAYON
     Un seul formulaire pour créer et pour renommer.
     ------------------------------------------------------- */
  function ouvrirFicheCategorie(id) {
    var c = $('#panneauContenu');
    if (!c) return;

    var cat = id
      ? CATEGORIES_GESTION.filter(function (x) { return x.id === id; })[0]
      : null;

    if (id && !cat) {                                   /* on relit en base */
      chargerCategoriesGestion(function () {
        ouvrirFicheCategorie(id);
      });
      return;
    }

    var nouveau = !cat;
    function val(nom, defaut) {
      var v = cat ? cat[nom] : undefined;
      if (v === undefined || v === null) v = defaut;
      return String(v).replace(/"/g, '&quot;');
    }

    c.innerHTML =
      '<h2 class="admin__sous-titre">' +
        (nouveau ? 'Nouveau rayon' : 'Modifier le rayon') + '</h2>' +

      '<button class="retour" type="button" id="catRetour">Retour aux catégories</button>' +

      '<div class="reglages-bloc">' +
        '<label class="fiche-prod__label">Nom du rayon *</label>' +
        '<input id="catNom" type="text" value="' + val('nom', '') + '" ' +
          'placeholder="Boissons chaudes">' +

        '<label class="fiche-prod__label">Emoji</label>' +
        '<input id="catEmoji" type="text" value="' + val('emoji', '') + '" ' +
          'placeholder="\u2615" maxlength="4">' +

        '<label class="fiche-prod__label">Ordre d\u2019affichage</label>' +
        '<input id="catPosition" type="number" min="0" step="1" ' +
          'value="' + val('position', 0) + '">' +

        '<p class="form__note" id="catErreur" hidden></p>' +

        '<div class="fiche-prod__actions">' +
          '<button class="btn btn--accent btn--large" type="button" id="catEnregistrer">' +
            (nouveau ? 'Créer le rayon' : 'Enregistrer') + '</button>' +
        '</div>' +
      '</div>';

    var retour = $('#catRetour', c);
    if (retour) retour.addEventListener('click', function () {
      c.innerHTML = panneauCategories();
      cablerPanneau('categories');
    });

    var enr = $('#catEnregistrer', c);
    if (enr) enr.addEventListener('click', function () { enregistrerCategorie(cat); });
  }

  function enregistrerCategorie(cat) {
    var c = $('#panneauContenu');
    var note = $('#catErreur', c);
    if (note) note.hidden = true;

    var nom = $('#catNom', c).value.trim();
    if (!nom) {
      if (note) { note.hidden = false; note.textContent = 'Le nom du rayon est obligatoire.'; }
      return;
    }

    var id = (cat && cat.id) ? cat.id : 'c' + Date.now().toString(36);
    var pos = parseInt($('#catPosition', c).value, 10);

    appelGestion('gestion_categorie', {
      p_mot_de_passe: gestionMotDePasse,
      p_id:           id,
      p_nom:          nom,
      p_emoji:        $('#catEmoji', c).value.trim(),
      p_position:     isNaN(pos) ? 0 : pos
    }, function (rep, err) {
      if (err || !rep || !rep.ok) {
        if (note) {
          note.hidden = false;
          note.textContent = (err && err.message) ? err.message : 'Enregistrement impossible.';
        }
        return;
      }
      chargerCategoriesGestion(function () {
        c.innerHTML = panneauCategories();
        cablerPanneau('categories');
      });
    });
  }

  function retirerCategorie(id) {
    var cat = CATEGORIES_GESTION.filter(function (x) { return x.id === id; })[0];
    var nom = cat ? cat.nom : 'ce rayon';
    if (!confirm('Retirer le rayon « ' + nom + ' » ?\n\n' +
                 'Aucun produit ne sera supprimé : ils passeront en « Divers ».')) return;

    appelGestion('gestion_categorie_supprimer',
      { p_mot_de_passe: gestionMotDePasse, p_id: id },
      function (rep, err) {
        if (err || !rep || !rep.ok) {
          afficherAlerte((err && err.message) ? err.message : 'Retrait impossible.');
          return;
        }
        var n = rep.produits_deplaces || 0;
        chargerCategoriesGestion(function () {
          var c = $('#panneauContenu');
          if (c) { c.innerHTML = panneauCategories(); cablerPanneau('categories'); }
          afficherAlerte(n ? n + ' produit(s) deplaces en « Divers ».' : 'Rayon retire.');
        });
      });
  }

  function importerCategories() {
    appelGestion('gestion_categories_importer',
      { p_mot_de_passe: gestionMotDePasse },
      function (rep, err) {
        if (err || !rep || !rep.ok) {
          afficherAlerte((err && err.message) ? err.message : 'Import impossible.');
          return;
        }
        chargerCategoriesGestion(function () {
          var c = $('#panneauContenu');
          if (c) { c.innerHTML = panneauCategories(); cablerPanneau('categories'); }
          afficherAlerte((rep.ajoutees || 0) + ' rayon(s) repris de votre catalogue.');
        });
      });
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

  /* -------------------------------------------------------
     LES RESEAUX SOCIAUX ET LEURS LOGOS

     Les logos viennent de Simple Icons, une bibliotheque
     publique et gratuite : les marques y publient leurs
     propres dessins. On les charge en ligne, donc rien a
     heberger et ils restent a jour.

     Chaque reseau a sa couleur officielle, pour que le logo
     soit reconnaissable au premier regard.
     ------------------------------------------------------- */
  var RESEAUX_CONNUS = [
    { cle: 'instagram', nom: 'Instagram',  emoji: '📸',
      logo: 'https://cdn.simpleicons.org/instagram/E4405F' },
    { cle: 'tiktok',    nom: 'TikTok',     emoji: '🎵',
      logo: 'https://cdn.simpleicons.org/tiktok/FFFFFF' },
    { cle: 'telegram',  nom: 'Telegram',   emoji: '✈️',
      logo: 'https://cdn.simpleicons.org/telegram/26A5E4' },
    { cle: 'whatsapp',  nom: 'WhatsApp',   emoji: '💬',
      logo: 'https://cdn.simpleicons.org/whatsapp/25D366' },
    { cle: 'signal',    nom: 'Signal',     emoji: '🔒',
      logo: 'https://cdn.simpleicons.org/signal/3A76F0' },
    { cle: 'session',   nom: 'Session',    emoji: '🔐',
      logo: 'https://cdn.simpleicons.org/session/00FF9D' },
    { cle: 'tato',      nom: 'Tato Talk',  emoji: '💬',
      logo: 'tato.PNG' },
    { cle: 'linktree',  nom: 'Linktree',   emoji: '🌳',
      logo: 'https://cdn.simpleicons.org/linktree/43E660' },
    { cle: 'snapchat',  nom: 'Snapchat',   emoji: '👻',
      logo: 'https://cdn.simpleicons.org/snapchat/FFFC00' },
    { cle: 'facebook',  nom: 'Facebook',   emoji: '📘',
      logo: 'https://cdn.simpleicons.org/facebook/0866FF' },
    { cle: 'x',         nom: 'X',          emoji: '✖️',
      logo: 'https://cdn.simpleicons.org/x/FFFFFF' },
    { cle: 'youtube',   nom: 'YouTube',    emoji: '▶️',
      logo: 'https://cdn.simpleicons.org/youtube/FF0000' },
    { cle: 'site',      nom: 'Site web',   emoji: '🌐', logo: '' }
  ];

  /* Retrouve un reseau par sa cle. */
  function reseauParCle(cle) {
    var r = RESEAUX_CONNUS.filter(function (x) { return x.cle === cle; })[0];
    return r || RESEAUX_CONNUS[RESEAUX_CONNUS.length - 1];
  }

  /* Le logo, ou l'emoji si le reseau n'en a pas. */
  function logoReseau(x) {
    var r = reseauParCle(x && x.cle);
    if (r.logo) {
      return '<img src="' + r.logo + '" alt="" width="22" height="22" ' +
        'loading="lazy" style="display:block">';
    }
    return '<span style="font-size:1.1rem">' + (r.emoji || '🔗') + '</span>';
  }

  /* Une ligne de reseau : le reseau choisi, son adresse,
     et un interrupteur pour l'afficher ou non. */
  function ligneReseau(x, i) {
    x = x || {};
    function v(nom) {
      return String(x[nom] === undefined ? '' : x[nom]).replace(/"/g, '&quot;');
    }
    var actif = x.actif === undefined ? true : !!x.actif;

    var options = RESEAUX_CONNUS.map(function (r) {
      return '<option value="' + r.cle + '"' +
        (r.cle === (x.cle || 'site') ? ' selected' : '') + '>' + r.nom + '</option>';
    }).join('');

    return '<div class="reseau-ligne" data-reseau="' + i + '">' +
      '<span class="reseau-ligne__logo" data-r-logo>' + logoReseau(x) + '</span>' +

      '<select data-r-cle class="reseau-ligne__choix">' + options + '</select>' +

      '<input type="text" data-r-url value="' + v('url') + '" ' +
        'placeholder="https://..." class="reseau-ligne__url">' +

      '<label class="reseau-ligne__switch" title="Afficher sur la page Infos">' +
        '<input type="checkbox" data-r-actif' + (actif ? ' checked' : '') + '>' +
      '</label>' +

      '<button class="admin-liste__sup" type="button" data-r-sup="' + i + '">' +
        'Retirer' + '</button>' +
    '</div>';
  }


  function panneauReglages() {
    if (!gestionMotDePasse) {
      return '<h2 class="admin__sous-titre">Réglages</h2>' +
        '<p class="fond__hint">Entrez le mot de passe pour modifier la boutique.</p>';
    }

    var R = REGLAGES || {};
    var pal = R.theme || BOUTIQUE.theme;
    var liv = R.livraison || {};
    var infos = R.infos || {};
    var sect = R.sections || {};

    function esc(v) {
      return String(v === undefined || v === null ? '' : v).replace(/"/g, '&quot;');
    }

    /* --- 1. L'identite --- */
    var identite =
      '<h3 class="admin__bloc">Identité de la boutique</h3>' +
      '<div class="reglages-bloc">' +
        '<label class="fiche-prod__label">Nom</label>' +
        '<input id="rNom" type="text" value="' + esc(R.nom || BOUTIQUE.nom) + '">' +
        '<label class="fiche-prod__label">Slogan</label>' +
        '<input id="rSlogan" type="text" value="' + esc(R.slogan) + '">' +
        '<label class="fiche-prod__label">Sous-titre</label>' +
        '<input id="rBaseline" type="text" value="' + esc(R.baseline) + '">' +
        '<label class="fiche-prod__label">Contact affiché</label>' +
        '<input id="rContact" type="text" value="' + esc(R.contact) + '" ' +
          'placeholder="telephone, email, adresse">' +
      '</div>';

    /* --- 2. L'apparence --- */
    var palettes = Object.keys(BOUTIQUE.palettes).map(function (cle) {
      var pa = BOUTIQUE.palettes[cle];
      return '<button type="button" class="palette' + (cle === pal ? ' actif' : '') +
        '" data-palette="' + cle + '">' +
        '<span class="palette__nom">' + pa.nom + '</span>' +
        '<span class="palette__dots">' +
          '<i style="background:' + pa.fond + '"></i>' +
          '<i style="background:' + pa.carte + '"></i>' +
          '<i style="background:' + pa.accent + '"></i>' +
        '</span>' +
      '</button>';
    }).join('');

    var apparence =
      '<h3 class="admin__bloc">Apparence</h3>' +
      '<div class="reglages-bloc">' +
        '<label class="fiche-prod__label">Image de fond</label>' +
        '<div class="reglages-apercu" id="rFondApercu">' +
          (R.fond
            ? '<span class="fiche-prod__vignette reglages-apercu--large">' +
                '<img src="' + R.fond + '" alt="">' +
                '<button type="button" id="rFondRetirer" aria-label="Retirer">&#10005;</button>' +
              '</span>'
            : '<p class="fond__hint">Aucune image : fond uni.</p>') +
        '</div>' +
        '<input id="rFondFichier" type="file" accept="image/*" hidden>' +
        '<button class="btn btn--ghost" type="button" id="rFondAjouter">' +
          'Choisir une image' + '</button>' +
        '<p class="fond__hint">JPG, PNG ou WebP \u00B7 3 Mo maximum. ' +
          'L\u2019image est visible par tous vos visiteurs.</p>' +

        '<label class="fiche-prod__label">Voile sombre ' +
          '<span id="rFlouVal">' + (R.fond_flou === undefined ? 72 : R.fond_flou) + '</span> %</label>' +
        '<input id="rFlou" type="range" min="0" max="92" step="4" ' +
          'value="' + (R.fond_flou === undefined ? 72 : R.fond_flou) + '">' +
        '<p class="fond__hint">Plus le voile est sombre, plus le texte reste lisible ' +
          'sur une photo claire.</p>' +

        '<label class="fiche-prod__label">Thème</label>' +
        '<div class="palettes">' + palettes + '</div>' +
      '</div>';

    /* --- 3. Les infos « En bref » --- */
    var infoBre =
      '<h3 class="admin__bloc">Infos « En bref »</h3>' +
      '<div class="reglages-bloc">' +
        '<div class="fiche-prod__2">' +
          '<div>' +
            '<label class="fiche-prod__label">Frais de livraison (\u20AC)</label>' +
            '<input id="rFrais" type="number" step="0.10" min="0" ' +
              'value="' + esc(liv.frais === undefined ? 3.90 : liv.frais) + '">' +
          '</div>' +
          '<div>' +
            '<label class="fiche-prod__label">Livraison offerte dès (\u20AC)</label>' +
            '<input id="rSeuil" type="number" step="1" min="0" ' +
              'value="' + esc(liv.gratuiteAPartirDe === undefined ? 40 : liv.gratuiteAPartirDe) + '">' +
          '</div>' +
        '</div>' +
        '<label class="fiche-prod__label">Minimum de commande (\u20AC)</label>' +
        '<input id="rMinimum" type="number" step="1" min="0" ' +
          'value="' + esc(liv.minimum === undefined ? 0 : liv.minimum) + '">' +
        '<label class="fiche-prod__label">Horaires</label>' +
        '<input id="rHoraires" type="text" value="' + esc(infos.horaires) + '" ' +
          'placeholder="7j/7 \u00B7 12h-00h">' +
        '<label class="fiche-prod__label">Paiement</label>' +
        '<input id="rPaiement" type="text" value="' + esc(infos.paiement) + '" ' +
          'placeholder="Especes a la livraison">' +
        '<label class="fiche-prod__label">Zone desservie</label>' +
        '<label class="fiche-prod__label">Adresse de contact</label>' +
        '<input id="rContact" type="text" value="' + esc(infos.contact) + '" ' +
          'placeholder="contact@votre-boutique.fr">' +
        '<label class="fiche-prod__label">Zone desservie</label>' +
        '<input id="rZone" type="text" value="' + esc(infos.zone) + '" ' +
          'placeholder="le Rhone">' +
      '</div>';

    /* --- 3b. Les reseaux sociaux --- */
    var reseaux = (R.reseaux || []);
    var blocReseaux =
      '<h3 class="admin__bloc">Réseaux sociaux</h3>' +
      '<p class="fond__hint" style="margin-bottom:.8rem">' +
        'Ces liens apparaissent sur la page Infos, sous « Nous trouver ». ' +
        'Laissez vide pour n\u2019en afficher aucun.</p>' +
      '<div class="reglages-bloc" id="rReseaux">' +
        (reseaux.length
          ? reseaux.map(function (x, i) { return ligneReseau(x, i); }).join('')
          : '<p class="fond__hint">Aucun réseau pour le moment.</p>') +
      '</div>' +
      '<div class="prod-outils" style="margin-top:.6rem">' +
        '<button class="btn btn--ghost" type="button" id="rReseauAjouter">' +
          '+ Ajouter un réseau' + '</button>' +
      '</div>';

    /* --- 4. Les sections activables --- */
    var listeSections = [
      ['avis',      'Avis clients',            'La page d\u2019avis et sa note moyenne'],
      ['livraison', 'Suivi de commande',        'L\u2019onglet Suivi pour vos clients'],
      ['telegram',  'Notifications Telegram',   'Vous prevenir a chaque commande'],
      ['rayons',    'Filtre par rayon',         'Le menu de rayons sur le catalogue'],
      ['commentaires', 'Description longue',    'Le texte descriptif sur la fiche produit'],
      ['horaires',  'Ligne Horaires',           'Les horaires sur la page Infos'],
      ['contact',   'Ligne Contact',            'Votre adresse de contact sur la page Infos']
    ];

    var sections =
      '<h3 class="admin__bloc">Sections de la boutique</h3>' +
      '<p class="fond__hint" style="margin-bottom:.8rem">' +
        'Désactivez ce dont votre commerce n\u2019a pas besoin : la page disparaît du menu.</p>' +
      '<div class="reglages-bloc">' +
        listeSections.map(function (x) {
          var actif = sect[x[0]] === undefined ? true : !!sect[x[0]];
          return '<label class="reglages-switch">' +
            '<input type="checkbox" data-section="' + x[0] + '"' + (actif ? ' checked' : '') + '>' +
            '<span class="reglages-switch__txt">' +
              '<b>' + x[1] + '</b><small>' + x[2] + '</small>' +
            '</span>' +
          '</label>';
        }).join('') +
      '</div>';

    /* --- 5. Le mot de passe de gestion --- */
    var motDePasse =
      '<h3 class="admin__bloc">Mot de passe de gestion</h3>' +
      '<p class="fond__hint" style="margin-bottom:.8rem">' +
        'Ce mot de passe ouvre cette page. Changez-le quand vous voulez — ' +
        'personne d\u2019autre que vous n\u2019y a accès.</p>' +
      '<div class="reglages-bloc">' +
        '<label class="fiche-prod__label">Mot de passe actuel</label>' +
        '<input id="mActuel" type="password" autocomplete="current-password">' +
        '<label class="fiche-prod__label">Nouveau mot de passe</label>' +
        '<input id="mNouveau" type="password" autocomplete="new-password">' +
        '<p class="fond__hint">8 caractères minimum.</p>' +
        '<label class="fiche-prod__label">Confirmez le nouveau</label>' +
        '<input id="mConfirme" type="password" autocomplete="new-password">' +
        '<p class="form__note" id="mErreur" hidden></p>' +
        '<button class="btn btn--ghost" type="button" id="mChanger" ' +
          'style="margin-top:.8rem">Changer le mot de passe</button>' +
      '</div>';

    /* Style de secours : pose directement par le script, pour que
       les interrupteurs soient utilisables meme si style.css n'a
       pas encore les regles .reglages-switch. */
    if (!document.getElementById('reglagesStyle')) {
      var st = document.createElement('style');
      st.id = 'reglagesStyle';
      st.textContent =
        '.reglages-bloc{display:flex;flex-direction:column;gap:.2rem;' +
          'padding:1.3rem;background:var(--carte);border:1px solid var(--bordure);' +
          'border-radius:20px;margin-bottom:1rem}' +
        '.reglages-bloc input[type=text],.reglages-bloc input[type=number]{' +
          'display:block;width:100%;padding:.85rem .95rem;border:1px solid var(--bordure);' +
          'border-radius:12px;background:rgba(0,0,0,.35);color:var(--texte);' +
          'font:inherit;font-size:.92rem}' +
        '.reglages-bloc input[type=range]{width:100%;margin:.3rem 0 .8rem;accent-color:var(--accent)}' +
        '.reglages-apercu{display:flex;flex-wrap:wrap;gap:.6rem;margin-bottom:.6rem}' +
        '.reglages-apercu--large{width:100%;height:140px}' +
        '.reglages-switch{display:flex!important;align-items:flex-start;gap:.8rem;' +
          'padding:.9rem .2rem;border-bottom:1px solid var(--bordure);cursor:pointer}' +
        '.reglages-switch:last-child{border-bottom:0}' +
        '.reglages-switch input[type=checkbox]{flex:0 0 auto;width:22px;height:22px;' +
          'margin-top:.15rem;accent-color:var(--accent)}' +
        '.reglages-switch__txt{display:flex!important;flex-direction:column;gap:.2rem;' +
          'min-width:0;text-align:left}' +
        '.reglages-switch__txt b{font-size:.92rem;font-weight:600;display:block}' +
        '.reglages-switch__txt small{font-size:.8rem;color:var(--doux);display:block}';
      document.head.appendChild(st);
    }

    return '<h2 class="admin__sous-titre">Réglages</h2>' +
      identite + apparence + infoBre + blocReseaux + sections + motDePasse +
      '<p class="form__note" id="rErreur" hidden></p>' +
      '<div class="reglages__actions">' +
        '<button class="btn btn--accent btn--large" id="rEnregistrer" type="button">' +
          'Enregistrer' + '</button>' +
      '</div>';
  }

  /* -------------------------------------------------------
     CABLAGE des boutons des panneaux
     ------------------------------------------------------- */
  /* -------------------------------------------------------
     FAIRE AVANCER UNE COMMANDE PRECISE
     On met a jour la ligne dans Supabase, puis on recharge
     la liste : le client verra son suivi bouger.
     ------------------------------------------------------- */
  function allerEtape(ref, nouvelle, forcer) {
    var cmd = commandesDistantes.filter(function (x) { return x.ref === ref; })[0];
    if (!cmd) return;
    var max = BOUTIQUE.etapes.length - 1;
    nouvelle = Math.max(0, Math.min(max, nouvelle));
    if (!forcer && nouvelle === Number(cmd.etape)) return;

    appelGestion('gestion_etape',
      { p_mot_de_passe: gestionMotDePasse, p_ref: ref, p_etape: nouvelle },
      function (rep, err) {
        if (err || !rep || !rep.ok) {
          afficherAlerte('Le changement d\u2019etape n\u2019a pas pu etre enregistre.');
          return;
        }
        /* le client est prevenu sur Telegram */
        prevenirNotifications('notifier-etape', {
          ref: ref,
          etape: nouvelle,
          statut: 'en_cours',
          telegram_client: cmd.telegram_client || '',
          vehicule: cmd.vehicule || '',
          message_livreur: cmd.message_livreur || ''
        });
        chargerCommandes(function () {
          ouvrirPanneau('commandes');
          rendreAdministration();
        });
      });
  }

  /* -------------------------------------------------------
     CHANGER LE STATUT D'UNE COMMANDE
     « en_cours », « remboursee » ou « annulee ». La fonction
     serveur de Supabase previent Telegram du changement.
     ------------------------------------------------------- */
  /* -------------------------------------------------------
     ECRIRE UN OU DEUX CHAMPS SUR UNE COMMANDE
     Sert au vehicule et au message du livreur. On n'envoie que
     ce qui change : la fonction serveur ne renvoie donc pas la
     commande complete.
     ------------------------------------------------------- */
  function changerChamp(ref, champs) {
    var noms = Object.keys(champs || {});
    if (!noms.length) return;

    var restants = noms.length;
    var boucle = function () {
      restants -= 1;
      if (restants === 0) chargerCommandes(function () { ouvrirPanneau('commandes'); });
    };

    noms.forEach(function (nom) {
      appelGestion('gestion_champ', {
        p_mot_de_passe: gestionMotDePasse,
        p_ref: ref,
        p_champ: nom,
        p_valeur: String(champs[nom])
      }, function (rep, err) {
        if (err || !rep || !rep.ok) {
          afficherAlerte('Le champ « ' + nom + ' » n\u2019a pas pu etre enregistre.');
        } else if (nom === 'message_livreur') {
          /* le mot du livreur part tout de suite au client */
          var c = commandesDistantes.filter(function (x) { return x.ref === ref; })[0];
          prevenirNotifications('notifier-etape', {
            ref: ref,
            etape: c ? (Number(c.etape) || 0) : 0,
            statut: c ? (c.statut || 'en_cours') : 'en_cours',
            telegram_client: c ? (c.telegram_client || '') : '',
            vehicule: c ? (c.vehicule || '') : '',
            message_livreur: String(champs[nom])
          });
        }
        boucle();
      });
    });
  }

  function changerStatut(ref, statut) {
    appelGestion('gestion_statut',
      { p_mot_de_passe: gestionMotDePasse, p_ref: ref, p_statut: statut },
      function (rep, err) {
        if (err || !rep || !rep.ok) {
          afficherAlerte('Le changement de statut n\u2019a pas pu etre enregistre.');
          return;
        }
        /* On recharge la liste D'ABORD : le statut et les infos du
           client viennent d'etre modifies en base, et c'est cette
           version-la qu'il faut pour prevenir le client. */
        chargerCommandes(function () {
          var c = commandesDistantes.filter(function (x) { return x.ref === ref; })[0];

          prevenirNotifications('notifier-etape', {
            ref: ref,
            etape: c ? (Number(c.etape) || 0) : 0,
            statut: statut,
            telegram_client: c ? (c.telegram_client || '') : '',
            vehicule: c ? (c.vehicule || '') : '',
            message_livreur: c ? (c.message_livreur || '') : ''
          });

          ouvrirPanneau('commandes');
          rendreAdministration();
          /* si c'est la commande suivie par le client, on la relit */
          if (suiviCherche && suiviCherche.ref === ref) {
            chercherCommande(ref, function (trouvee) {
              if (trouvee) { suiviCherche = trouvee; majBarreSuivi(); rendreSuivi(); }
            });
          }
        });
      });
  }

  function avancerCommande(ref, delta) {
    var cmd = commandesDistantes.filter(function (x) { return x.ref === ref; })[0];
    if (!cmd) return;
    allerEtape(ref, (Number(cmd.etape) || 0) + delta, false);
  }

  /* la commande ouverte en detail dans la page de gestion */
  var commandeOuverte = null;

  function cablerPanneau(quoi) {
    /* --- les categories --- */
    var catAj = $('#catAjouter');
    if (catAj) catAj.addEventListener('click', function () { ouvrirFicheCategorie(null); });

    var catImp = $('#catImporter');
    if (catImp) catImp.addEventListener('click', importerCategories);

    $$('[data-cat-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        ouvrirFicheCategorie(b.getAttribute('data-cat-edit'));
      });
    });

    $$('[data-cat-sup]').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        retirerCategorie(b.getAttribute('data-cat-sup'));
      });
    });

    /* effacer toutes les commandes */
    var btnPurger = $('#cmdPurger');
    if (btnPurger) btnPurger.addEventListener('click', purgerCommandes);

    /* supprimer une commande precise */
    $$('[data-supprimer]').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        supprimerCommande(b.getAttribute('data-supprimer'));
      });
    });

    /* rechercher un produit */
    var rec = $('#prodRecherche');
    if (rec) {
      rec.addEventListener('input', function () {
        rechercheProduit = rec.value;
        c.innerHTML = panneauProduits();
        cablerPanneau('produits');
        var r2 = $('#prodRecherche');
        if (r2) { r2.focus(); }
      });
    }

    /* filtrer par rayon */
    var sel = $('#prodRayon');
    if (sel) {
      sel.addEventListener('change', function () {
        filtreProduitRayon = sel.value;
        c.innerHTML = panneauProduits();
        cablerPanneau('produits');
      });
    }

    /* ajouter un produit */
    var ajout = $('#prodAjouter');
    if (ajout) {
      ajout.addEventListener('click', function () {
        ouvrirFicheProduit(null);
      });
    }

    /* modifier un produit */
    $$('[data-prod-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        ouvrirFicheProduit(b.getAttribute('data-prod-edit'));
      });
    });

    /* changer de filtre */
    $$('[data-filtre]').forEach(function (b) {
      b.addEventListener('click', function () {
        filtreStatut = b.getAttribute('data-filtre');
        commandeOuverte = null;
        ouvrirPanneau('commandes');
      });
    });

    /* ouvrir le detail d'une commande */
    $$('[data-ouvrir]').forEach(function (li) {
      li.addEventListener('click', function () {
        commandeOuverte = li.getAttribute('data-ouvrir');
        ouvrirPanneau('commandes');
      });
    });

    /* revenir a la liste */
    $$('[data-liste]').forEach(function (b) {
      b.addEventListener('click', function () {
        commandeOuverte = null;
        ouvrirPanneau('commandes');
      });
    });

    /* rembourser : la commande porte le statut « remboursee » */
    $$('[data-rembourser]').forEach(function (b) {
      b.addEventListener('click', function () {
        changerStatut(b.getAttribute('data-rembourser'), 'remboursee');
      });
    });

    /* annuler : la commande porte le statut « annulee » */
    $$('[data-annuler]').forEach(function (b) {
      b.addEventListener('click', function () {
        changerStatut(b.getAttribute('data-annuler'), 'annulee');
      });
    });

    /* choisir le vehicule de livraison */
    $$('[data-vehicule]').forEach(function (b) {
      b.addEventListener('click', function () {
        changerChamp(b.getAttribute('data-vehicule'), {
          vehicule: b.getAttribute('data-valeur')
        });
      });
    });

    /* envoyer un mot au client */
    $$('[data-message]').forEach(function (b) {
      b.addEventListener('click', function () {
        var champ = $('#cmdMessage');
        changerChamp(b.getAttribute('data-message'), {
          message_livreur: champ ? champ.value.trim() : ''
        });
      });
    });

    /* remettre une commande close en cours */
    $$('[data-reouvrir]').forEach(function (b) {
      b.addEventListener('click', function () {
        changerStatut(b.getAttribute('data-reouvrir'), 'en_cours');
      });
    });

    $$('[data-avancer]').forEach(function (b) {
      b.addEventListener('click', function () {
        avancerCommande(b.getAttribute('data-avancer'), 1);
      });
    });

    $$('[data-reculer]').forEach(function (b) {
      b.addEventListener('click', function () {
        avancerCommande(b.getAttribute('data-reculer'), -1);
      });
    });

    $$('[data-avance]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = parseInt(b.getAttribute('data-avance'), 10);
        avancerDuCoteBoutique(d);
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

  /* Les reglages de theme et de fond ne sont plus dans la page :
     chaque acces est protege, pour qu'aucun ne casse le reste. */
  /* Ce qu'on prepare avant d'enregistrer */
  var fondEnCours = null;
  var themeEnCours = null;
  var sectionsEnCours = null;

  /* Envoie une image dans le bac de la boutique. */
  function envoyerPhotoBoutique(fichier, callback) {
    var nom = 'fond-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 7) + '.' +
      (fichier.name.split('.').pop() || 'jpg').toLowerCase();

    fetch(SUPABASE_URL + '/storage/v1/object/boutique/' + nom, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CLE,
        'Authorization': 'Bearer ' + SUPABASE_CLE,
        'Content-Type': fichier.type || 'image/jpeg',
        'x-upsert': 'true'
      },
      body: fichier
    })
      .then(function (r) {
        if (!r.ok) throw new Error('envoi refuse (' + r.status + ')');
        return r.json();
      })
      .then(function () {
        callback(SUPABASE_URL + '/storage/v1/object/public/boutique/' + nom, null);
      })
      .catch(function (e) { callback(null, e); });
  }

  function cablerRetraitFond(c) {
    var b = $('#rFondRetirer', c);
    if (!b) return;
    b.addEventListener('click', function () {
      fondEnCours = '';
      var zone = $('#rFondApercu', c);
      if (zone) zone.innerHTML = '<p class="fond__hint">Aucune image : fond uni.</p>';
    });
  }

  /* Enregistre tout ce qui a ete modifie. */
  function enregistrerReglages() {
    var c = $('#panneauContenu');
    var note = $('#rErreur', c);
    if (note) note.hidden = true;

    function nombre(id, defaut) {
      var v = parseFloat(String($(id, c).value).replace(',', '.'));
      return isNaN(v) ? defaut : v;
    }

    function texte(id) {
      var el = $(id, c);
      return el ? String(el.value || '').trim() : '';
    }

    var livraison = {
      frais:              nombre('#rFrais', 3.90),
      gratuiteAPartirDe:  nombre('#rSeuil', 40),
      minimum:            nombre('#rMinimum', 0)
    };

    var infos = {
      horaires: texte('#rHoraires'),
      paiement: texte('#rPaiement'),
      zone:     texte('#rZone')
    };

    var arg = {
      p_mot_de_passe: gestionMotDePasse,
      p_nom:          texte('#rNom'),
      p_slogan:       texte('#rSlogan'),
      p_baseline:     texte('#rBaseline'),
      p_contact:      texte('#rContact'),
      p_livraison:    livraison,
      p_infos:        infos
    };

    arg.p_reseaux = lireReseaux(c);

    if (themeEnCours) arg.p_theme = themeEnCours;
    if (sectionsEnCours) arg.p_sections = sectionsEnCours;
    if (fondEnCours !== null) arg.p_fond = fondEnCours;
    if ($('#rFlou', c)) arg.p_fond_flou = parseInt($('#rFlou', c).value, 10);

    appelGestion('gestion_reglages_ecrire', arg, function (rep, err) {
      if (err || !rep || !rep.ok) {
        if (note) {
          note.hidden = false;
          note.textContent = (err && err.message) ? err.message : 'Enregistrement impossible.';
        }
        return;
      }
      fondEnCours = null;
      themeEnCours = null;
      sectionsEnCours = null;
      chargerReglages(function () {
        appliquerReglagesVisibles();
        afficherReseaux();
        c.innerHTML = panneauReglages();
        cablerReglages();
        afficherAlerte('Réglages enregistrés.');
      });
    });
  }

  /* Applique le fond et le voile choisis par la boutique. */
  function appliquerReglagesVisibles() {
    if (!REGLAGES) return;
    if (REGLAGES.fond) {
      var bg = $('#bgImage');
      if (bg) bg.src = REGLAGES.fond;
    }
    if (REGLAGES.fond_flou !== undefined && REGLAGES.fond_flou !== null) {
      var v = document.querySelector('.veil');
      if (v) v.style.background = 'rgba(10,10,15,' + (Number(REGLAGES.fond_flou) / 100) + ')';
    }
    if (REGLAGES.logo) {
      var img = $('#logoImage');
      if (img) img.src = REGLAGES.logo;
    }
  }

  /* Les boutons « Retirer » de chaque ligne de réseau. */
  function cablerReseaux(c) {
    var zone = $('#rReseaux', c);
    if (!zone) return;

    /* quand on change de reseau, le logo suit */
    $$('[data-r-cle]', zone).forEach(function (sel) {
      sel.addEventListener('change', function () {
        var ligne = sel.closest('[data-reseau]');
        var emplacement = ligne ? $('[data-r-logo]', ligne) : null;
        if (emplacement) emplacement.innerHTML = logoReseau({ cle: sel.value });
      });
    });

    $$('[data-r-sup]', zone).forEach(function (b) {
      b.addEventListener('click', function () {
        var ligne = b.closest('[data-reseau]');
        if (ligne) ligne.remove();
        if (!zone.querySelector('[data-reseau]')) {
          zone.innerHTML = '<p class="fond__hint">Aucun réseau pour le moment.</p>';
        }
      });
    });
  }

  /* On lit les reseaux saisis dans le formulaire. */
  function lireReseaux(c) {
    var zone = $('#rReseaux', c);
    if (!zone) return [];
    var out = [];
    $$('[data-reseau]', zone).forEach(function (l) {
      var url = $('[data-r-url]', l).value.trim();
      if (!url) return;                    /* ligne vide : on l'ignore */
      var cle = $('[data-r-cle]', l).value;
      var r = reseauParCle(cle);
      out.push({
        cle:   cle,
        nom:   r.nom,
        emoji: r.emoji,
        logo:  r.logo,
        url:   url,
        actif: $('[data-r-actif]', l).checked
      });
    });
    return out;
  }

  function cablerReglages() {
    /* On cherche le conteneur, et s'il n'a pas encore d'id on prend
       le panneau lui-meme : l'ecran doit rester utilisable. */
    var c = $('#panneauContenu') || $('#panneau') || document;
    if (!c) return;

    /* --- le curseur du voile sombre --- */
    var flou = $('#rFlou', c);
    var flouVal = $('#rFlouVal', c);
    if (flou) {
      flou.addEventListener('input', function () {
        if (flouVal) flouVal.textContent = flou.value;
        var v = document.querySelector('.veil');
        if (v) v.style.background = 'rgba(10,10,15,' + (Number(flou.value) / 100) + ')';
      });
    }

    /* --- choisir une image de fond --- */
    var boutonFond = $('#rFondAjouter', c);
    var champFond = $('#rFondFichier', c);
    if (boutonFond && champFond) {
      boutonFond.addEventListener('click', function () { champFond.click(); });
      champFond.addEventListener('change', function () {
        var f = (champFond.files || [])[0];
        if (!f) return;
        if (f.size > 3 * 1024 * 1024) {
          var note = $('#rErreur', c);
          if (note) { note.hidden = false; note.textContent = 'Image trop lourde : 3 Mo maximum.'; }
          return;
        }
        envoyerPhotoBoutique(f, function (url, err) {
          if (err || !url) {
            var n2 = $('#rErreur', c);
            if (n2) { n2.hidden = false; n2.textContent = 'L\u2019image n\u2019a pas pu etre envoyee.'; }
            return;
          }
          fondEnCours = url;
          var zone = $('#rFondApercu', c);
          if (zone) {
            zone.innerHTML = '<span class="fiche-prod__vignette reglages-apercu--large">' +
              '<img src="' + url + '" alt="">' +
              '<button type="button" id="rFondRetirer" aria-label="Retirer">&#10005;</button>' +
              '</span>';
            cablerRetraitFond(c);
          }
        });
      });
    }
    cablerRetraitFond(c);

    /* --- choisir un theme --- */
    $$('[data-palette]', c).forEach(function (b) {
      b.addEventListener('click', function () {
        var cle = b.getAttribute('data-palette');
        themeEnCours = cle;
        var pa = BOUTIQUE.palettes[cle];
        appliquerTheme(pa);
        $$('[data-palette]', c).forEach(function (x) {
          x.classList.toggle('actif', x === b);
        });
      });
    });

    /* --- les reseaux sociaux : ajouter, retirer --- */
    var rAjout = $('#rReseauAjouter', c);
    if (rAjout) {
      rAjout.addEventListener('click', function () {
        var zone = $('#rReseaux', c);
        if (!zone) return;
        var i = zone.querySelectorAll('[data-reseau]').length;
        var vide = zone.querySelector('.fond__hint');
        if (vide) vide.remove();
        zone.insertAdjacentHTML('beforeend', ligneReseau({}, i));
        cablerReseaux(c);
      });
    }
    cablerReseaux(c);

    /* --- les interrupteurs de sections ---
       On cable le label ENTIER : cliquer n'importe ou sur la ligne
       coche la case, meme si la feuille de style n'est pas chargee. */
    $$('[data-section]', c).forEach(function (i) {
      i.addEventListener('change', function () {
        if (!sectionsEnCours) sectionsEnCours = {};
        sectionsEnCours[i.getAttribute('data-section')] = i.checked;
      });
      var ligne = i.closest('label');
      if (ligne) {
        ligne.style.cursor = 'pointer';
        ligne.addEventListener('click', function (ev) {
          if (ev.target === i) return;   /* la case gere deja son clic */
          ev.preventDefault();
          i.checked = !i.checked;
          if (!sectionsEnCours) sectionsEnCours = {};
          sectionsEnCours[i.getAttribute('data-section')] = i.checked;
        });
      }
    });

    /* --- changer le mot de passe --- */
    var mBtn = $('#mChanger', c);
    if (mBtn) {
      mBtn.addEventListener('click', function () {
        var note = $('#mErreur', c);
        if (note) note.hidden = true;

        var actuel = $('#mActuel', c).value;
        var nouveau = $('#mNouveau', c).value;
        var confirme = $('#mConfirme', c).value;

        function refus(texte) {
          if (note) { note.hidden = false; note.textContent = texte; }
        }

        if (!actuel) return refus('Entrez votre mot de passe actuel.');
        if (nouveau.length < 8) return refus('Le nouveau doit faire au moins 8 caractères.');
        if (nouveau !== confirme) return refus('Les deux nouveaux mots de passe ne correspondent pas.');

        appelGestion('gestion_changer_mot_de_passe',
          { p_ancien: actuel, p_nouveau: nouveau },
          function (rep, err) {
            if (err || !rep || !rep.ok) {
              return refus((err && err.message) ? err.message : 'Changement impossible.');
            }
            gestionMotDePasse = nouveau;
            ['#mActuel', '#mNouveau', '#mConfirme'].forEach(function (id) {
              var el = $(id, c);
              if (el) el.value = '';
            });
            afficherAlerte('Mot de passe changé. Il est actif tout de suite.');
          });
      });
    }

    /* --- enregistrer --- */
    var enr = $('#rEnregistrer', c);
    if (enr) enr.addEventListener('click', function () { enregistrerReglages(); });


    var r = $('#fondReset');
    if (r) {
      r.addEventListener('click', function () {
        fondCustom = null;
        effacer('fond');
        var bg = $('#bgImage');
        if (bg) bg.src = 'bg.PNG';
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
  /* La boutique fait avancer une commande : on met a jour la
     copie locale (pour l'affichage) et la ligne dans Supabase
     (pour que le client, lui, voie l'etape avancer). */
  function avancerDuCoteBoutique(delta) {
    if (!commande) return;
    var max = BOUTIQUE.etapes.length - 1;
    var nouvelle = Math.max(0, Math.min(max, commande.etape + delta));
    if (nouvelle === commande.etape) return;

    commande.etape = nouvelle;
    ecrire('commande', commande);
    majBarreSuivi();
    rendreSuivi();

    fetch(SUPABASE_URL + '/rest/v1/commandes?ref=eq.' +
          encodeURIComponent(commande.ref), {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_CLE,
        'Authorization': 'Bearer ' + SUPABASE_CLE,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ etape: nouvelle })
    }).catch(function () {});
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
  /* -------------------------------------------------------
     BRANCHER — attache un evenement sans jamais casser le reste.
     Si l'element n'existe pas dans la page, on passe au suivant
     au lieu d'arreter tout le demarrage.
     ------------------------------------------------------- */
  function brancher(sel, evenement, action) {
    var el = $(sel);
    if (!el) return;
    el.addEventListener(evenement, action);
  }

  function init() {
    appliquerTheme(paletteActive());

    /* écran de chargement puis accueil explicatif */
    var loader = $('#loader');
    setTimeout(function () {
      if (loader) { loader.classList.add('is-off'); setTimeout(function () { loader.style.display = 'none'; }, 600); }
    }, 1400);

    brancher('#introGo', 'click', function () {
      $('#intro').hidden = true;
      $('#nav').hidden = false;
      $('#vues').hidden = false;
      $('#foot').hidden = false;
      appliquerFond();
      afficher();
      /* l'animation du logo se joue ici, en arrivant sur le catalogue */
      jouerLogo();
    });

    /* navigation et formulaires.
       Chaque branchement est protege : si un element manque dans la
       page, les suivants sont quand meme branches. */
    brancher('#formCommande', 'submit', validerCommande);
    brancher('#formAvis', 'submit', publierAvis);
    brancher('#formVerrou', 'submit', deverrouiller);
    brancher('#suiviVoir', 'click', function () { location.hash = '#/suivi'; });

    /* bouton d'avancement de la page de suivi (demonstration) */
    document.addEventListener('click', function (e) {
      if (e.target.closest('#suiviFermer')) {
        var b = $('#suiviBar');
        if (b) b.hidden = true;
        try { sessionStorage.setItem('corner69.suiviMasque', '1'); } catch (err) {}
        return;
      }
    });

    /* administration : menu, panneau, verrouillage */
    document.addEventListener('click', function (e) {
      var item = e.target.closest('[data-admin]');
      if (item) {
        try {
          ouvrirPanneau(item.getAttribute('data-admin'));
        } catch (err) {
          bandeauErreur('Le panneau « ' + item.getAttribute('data-admin') +
            ' » n\u2019a pas pu s\u2019ouvrir.\n' + (err && err.message ? err.message : ''));
        }
        return;
      }

      if (e.target.closest('#panneauRetour')) { fermerPanneau(); return; }
      if (e.target.closest('#adminQuitter')) { verrouillerAdministration(); return; }
    });

    brancher('#versCommande', 'click', function () {
      if (!panier.length) return;
      location.hash = '#/commande';
    });

    /* suivi : recherche de la commande par sa reference */
    document.addEventListener('submit', function (e) {
      if (e.target && e.target.id === 'formSuivi') {
        e.preventDefault();
        var champ = $('#suiviRefCherche');
        var err = $('#suiviErreur');
        var ref = champ ? champ.value : '';
        if (err) err.hidden = true;

        chercherCommande(ref, function (trouvee) {
          if (!trouvee) {
            if (err) {
              err.hidden = false;
              err.textContent = 'Aucune commande avec cette reference. ' +
                                'Verifiez le numero, il ressemble a #CMD-1234AB.';
            }
            return;
          }
          suiviCherche = trouvee;
          majBarreSuivi();
          rendreSuivi();
        });
      }
    });

    /* completer une commande en cours : on garde sa reference
       et on renvoie le client au catalogue */
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('#suiviAjouter') : null;
      if (!b) return;
      commandeEnCours = b.getAttribute('data-ref');
      ecrire('commandeEnCours', commandeEnCours);
      panier = [];               /* on repart d'un panier vide */
      ecrire('panier', panier);
      majPanierCount();
      location.hash = '#/';
    });

    /* cliquer sur une de mes commandes */
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-ref]') : null;
      if (!b) return;
      chercherCommande(b.getAttribute('data-ref'), function (trouvee) {
        if (trouvee) { suiviCherche = trouvee; majBarreSuivi(); rendreSuivi(); }
      });
    });

    /* revenir au champ de recherche : on vide la commande affichee */
    document.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('#suiviAutre')) {
        suiviCherche = null;
        maRef = null;
        ecrire('maRef', null);
        rendreSuivi();
      }
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
    /* état initial : on charge le catalogue depuis la base,
       puis on affiche. Si la base ne repond pas, le secours
       de config.js joue et le site reste utilisable. */
    /* On charge d'abord les reglages (fond, logo, nom, sections),
       puis le catalogue : le client voit la boutique telle qu'elle
       a ete reglee, des son premier affichage. */
    chargerReglagesPublics(function () {
      chargerCatalogue(function () {
        rendreCatalogue();
        majPanierCount();
      });
    });
    majBarreSuivi();
    rafraichirSuivi();
    afficherLogo();
    rendreDeplacable();
  }

  /* -------------------------------------------------------
     BANDEAU DE SUIVI DEPLACABLE
     On le saisit et on le pose ou on veut. La position est
     memorisee pour la visite (sessionStorage), pas au-dela :
     au retour, il reprend sa place en haut.
     ------------------------------------------------------- */
  function rendreDeplacable() {
    var barre = $('#suiviBar');
    if (!barre) return;

    /* on repart de la position memorisee si elle existe */
    var memo = null;
    try {
      var raw = sessionStorage.getItem('corner69.suiviPos');
      if (raw) memo = JSON.parse(raw);
    } catch (err) { memo = null; }

    if (memo && typeof memo.left === 'number' && typeof memo.top === 'number') {
      poser(memo.left, memo.top);
    }

    function poser(x, y) {
      var l = Math.max(4, Math.min(x, window.innerWidth - barre.offsetWidth - 4));
      var t = Math.max(4, Math.min(y, window.innerHeight - barre.offsetHeight - 4));
      barre.classList.add('deplace');
      barre.style.left = l + 'px';
      barre.style.top = t + 'px';
      barre.style.bottom = 'auto';
      barre.style.transform = 'none';
    }

    var saisie = false, dx = 0, dy = 0;

    function debut(e) {
      /* la croix et le bouton Voir gardent leur role : on ne glisse pas dessus */
      if (e.target && e.target.closest && (e.target.closest('#suiviFermer') || e.target.closest('#suiviVoir'))) return;
      saisie = true;
      var r = barre.getBoundingClientRect();
      var p = point(e);
      dx = p.x - r.left;
      dy = p.y - r.top;
      barre.classList.add('deplace');
      e.preventDefault();
    }

    function bouge(e) {
      if (!saisie) return;
      var p = point(e);
      poser(p.x - dx, p.y - dy);
      e.preventDefault();
    }

    function fin() {
      if (!saisie) return;
      saisie = false;
      try {
        sessionStorage.setItem('corner69.suiviPos', JSON.stringify({
          left: parseInt(barre.style.left, 10) || 0,
          top: parseInt(barre.style.top, 10) || 0
        }));
      } catch (err) {}
    }

    function point(e) {
      if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      return { x: e.clientX, y: e.clientY };
    }

    barre.addEventListener('mousedown', debut);
    document.addEventListener('mousemove', bouge);
    document.addEventListener('mouseup', fin);
    barre.addEventListener('touchstart', debut, { passive: false });
    document.addEventListener('touchmove', bouge, { passive: false });
    document.addEventListener('touchend', fin);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();