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
      /* on quitte la gestion : on efface le mot de passe de la memoire */
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
  function rayons() {
    var vus = [];
    BOUTIQUE.produits.forEach(function (p) {
      if (vus.indexOf(p.rayon) === -1) vus.push(p.rayon);
    });
    return vus;
  }

  function vignette(p) {
    /* si l'image du produit existe, c'est elle qui s'affiche */
    var premier = (p && p.medias && p.medias[0]) || null;
    if (premier && premier.type === 'image' && premier.src) {
      return '<img src="' + premier.src + '" alt="' + (p.nom || '') + '" loading="lazy">';
    }

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

    if (!BOUTIQUE || !BOUTIQUE.produits) return;
    var liste = BOUTIQUE.produits.filter(function (p) { return !r || p.rayon === r; });
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

    var zone = document.createElement('div');
    zone.id = 'carrousel';
    zone.className = 'carrousel';
    box.insertBefore(zone, box.firstChild.nextSibling);

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

  var derniereErreur = null;

  /* Banniere discrete : previent le visiteur sans casser la page. */
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

  /* Appel d'une fonction ouverte au public (sans mot de passe).
     Le jeton de suivi part dans les parametres : la base l'exige. */
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
     On relit la commande par la fonction serveur, on fusionne
     les articles, puis on renvoie le tout.
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
        }, function (rep) {
          if (!rep || !rep.ok) {
            afficherAlerte('Le complément de commande n\u2019a pas pu être enregistré.');
          }
        });
      });
  }

  function envoyerVersSupabase(cmd) {
    if (!cmd) return;

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
          return r.text().then(function (detail) {
            noterErreur(corps.ref, 'commande', detail, r.status);
            afficherAlerte('Votre commande n\u2019a pas pu être transmise. Vérifiez votre connexion et réessayez.');
          });
        }
      }).catch(function () {});
    } catch (e) {}
  }

  /* -------------------------------------------------------
     LECTURE DES COMMANDES — pour la page de gestion
     ------------------------------------------------------- */
  var commandesDistantes = [];

  /* Le mot de passe de la boutique, garde en memoire pour la
     duree de la visite. Il n'est jamais ecrit dans le navigateur :
     c'est la base qui le verifie a chaque appel. */
  var gestionMotDePasse = '';

  function appelGestion(nom, parametres, callback) {
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
  var chiffreMois = [];

  function chargerChiffre(callback) {
    if (!gestionMotDePasse) { chiffreMois = []; if (callback) callback([]); return; }

    appelGestion('gestion_recap', { p_mot_de_passe: gestionMotDePasse }, function (data) {
      chiffreMois = (data && data.ok && Array.isArray(data.mois)) ? data.mois : [];
      if (callback) callback(chiffreMois);
    });
  }

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
      if (!isNaN(quand.getTime()) && quand >= debut) {
        total += Number(cmd.total) || 0;
        nb += 1;
      }
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

      var avant = suiviCherche ? Number(suiviCherche.etape) : null;
      suiviCherche = trouvee;
      majBarreSuivi();

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

  /* =======================================================
     ADMINISTRATION
     ======================================================= */
  function deverrouiller(e) {
    if (e) e.preventDefault();
    var mdp = $('#mdp') ? $('#mdp').value : '';
    var err = $('#verrouErreur');

    /* le mot de passe est verifie par la BASE, pas ici :
       le code du site ne contient plus aucun mot de passe. */
    if (err) { err.hidden = true; }

    fetch(SUPABASE_URL + '/rest/v1/rpc/gestion_verifier', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CLE,
        'Authorization': 'Bearer ' + SUPABASE_CLE,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_mot_de_passe: mdp })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
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
      })
      .catch(function () {
        if (err) {
          err.hidden = false;
          err.textContent = 'Connexion impossible. Vérifiez votre réseau.';
        }
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
    gestionMotDePasse = '';
    var v = $('#verrou');
    var a = $('#administration');
    if (a) a.hidden = true;
    if (v) v.hidden = false;
    var mdp = $('#mdp');
    if (mdp) mdp.value = '';
    fermerPanneau();
  }

  function changerStatut(ref, statut) {
    appelGestion('gestion_statut',
      { p_mot_de_passe: gestionMotDePasse, p_ref: ref, p_statut: statut },
      function () {
        chargerCommandes(function () {
          ouvrirPanneau('commandes');
          rendreAdministration();
          if (suiviCherche && suiviCherche.ref === ref) {
            chercherCommande(ref, function (trouvee) {
              if (trouvee) { suiviCherche = trouvee; majBarreSuivi(); rendreSuivi(); }
            });
          }
        });
      });
  }

  function allerEtape(ref, nouvelle, forcer) {
    var cmd = commandesDistantes.filter(function (x) { return x.ref === ref; })[0];
    if (!cmd) return;
    var max = BOUTIQUE.etapes.length - 1;
    nouvelle = Math.max(0, Math.min(max, nouvelle));
    if (!forcer && nouvelle === Number(cmd.etape)) return;

    appelGestion('gestion_etape',
      { p_mot_de_passe: gestionMotDePasse, p_ref: ref, p_etape: nouvelle },
      function () {
        chargerCommandes(function () {
          ouvrirPanneau('commandes');
          rendreAdministration();
          if (maRef && maRef === ref) rafraichirSuivi();
        });
      });
  }

  function avancerCommande(ref, delta) {
    var cmd = commandesDistantes.filter(function (x) { return x.ref === ref; })[0];
    if (!cmd) return;
    allerEtape(ref, (Number(cmd.etape) || 0) + delta, false);
  }

  function changerChamp(ref, champs) {
    var noms = Object.keys(champs || {});
    if (!noms.length) return;

    var envois = noms.map(function (nom) {
      return new Promise(function (resoudre) {
        appelGestion('gestion_champ',
          { p_mot_de_passe: gestionMotDePasse, p_ref: ref, p_champ: nom, p_valeur: String(champs[nom]) },
          function () { resoudre(); });
      });
    });

    Promise.all(envois).then(function () {
      chargerCommandes(function () { ouvrirPanneau('commandes'); });
    });
  }

  /* =======================================================
     DÉMARRAGE
     ======================================================= */
  function init() {
    appliquerTheme(paletteActive());
    afficherLogo();
    appliquerFond();
    rendreCatalogue();
    majPanierCount();
    afficher();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
