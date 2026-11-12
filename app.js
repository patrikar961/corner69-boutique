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

    fetch(SUPABASE_URL + '/rest/v1/commandes?ref=eq.' + encodeURIComponent(cmd.ref) +
          '&select=articles,total,etape', {
      headers: {
        'apikey': SUPABASE_CLE,
        'Authorization': 'Bearer ' + SUPABASE_CLE
      }
    })
      .then(function (r) { return r.json(); })
      .then(function (liste) {
        var anciens = (liste && liste[0] && liste[0].articles) || [];
        var totalAncien = (liste && liste[0] && Number(liste[0].total)) || 0;

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

        var etapeActuelle = (liste && liste[0] && Number(liste[0].etape)) || 0;

        var corps = {
          articles: fusion,
          total: total,
          /* on NE remet pas l'etape a zero : on garde celle en cours,
             sinon la fonction serveur croit que rien n'a change */
          etape: etapeActuelle,
          statut: 'en_cours'
        };
        if (cmd.telegram) corps.telegram_client = cmd.telegram;

        fetch(SUPABASE_URL + '/rest/v1/commandes?ref=eq.' + encodeURIComponent(cmd.ref), {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_CLE,
            'Authorization': 'Bearer ' + SUPABASE_CLE,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(corps)
        }).then(function (r) {
          if (!r.ok) {
            return r.text().then(function (d) { noterErreur(cmd.ref, 'complement', d, r.status); });
          }
        }).catch(function () {});
      })
      .catch(function () {});
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
      telegram_client: cmd.telegram || ''
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
          /* l'envoi a ete refuse : on note pourquoi */
          return r.text().then(function (detail) {
            noterErreur(corps.ref, 'commande', detail, r.status);
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

  function chargerCommandes(callback) {
    fetch(SUPABASE_URL + '/rest/v1/commandes?select=*&order=cree_le.desc&limit=200', {
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
        commandesDistantes = Array.isArray(liste) ? liste : [];
        if (callback) callback(commandesDistantes);
      })
      .catch(function () {
        commandesDistantes = [];
        if (callback) callback([]);
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
    fetch(SUPABASE_URL + '/rest/v1/recap_mois?select=*&order=debut_mois.desc&limit=36', {
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
        chiffreMois = Array.isArray(liste) ? liste : [];
        if (callback) callback(chiffreMois);
      })
      .catch(function () {
        chiffreMois = [];
        if (callback) callback([]);
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

    fetch(SUPABASE_URL + '/rest/v1/commandes?ref=ilike.' +
          encodeURIComponent('%' + propre + '%') + '&limit=1', {
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
        callback(Array.isArray(liste) && liste.length ? liste[0] : null);
      })
      .catch(function () { callback(null); });
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
        '<div class="suivi__ring" style="--pct:' + pct + '%"><span>' + (e + 1) + '</span>' +
          '<small>/' + BOUTIQUE.etapes.length + '</small></div>' +
        '<div>' +
          '<div class="suivi__ref">' + badgeClose + (cmd.ref || '') + '</div>' +
          '<p class="suivi__etat">' +
            (close
              ? (cmd.statut === 'remboursee' ? 'Commande remboursee' : 'Commande annulee')
              : courante.label + ' ' + courante.emoji) + '</p>' +
          '<div class="suivi__date">' + dateTxt + '</div>' +
        '</div>' +
      '</div>' +

      '<ul class="jalons">' +
        BOUTIQUE.etapes.map(function (et, i) {
          var cls = i < e ? 'fait' : (i === e ? 'encours' : '');
          var point = i < e ? '\u2713' : (i + 1);
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
    if ($('#suiviPct')) $('#suiviPct').textContent = finie ? '!' : (e + 1);
    if ($('#suiviRef')) $('#suiviRef').textContent = c.ref || '';
    if ($('#suiviLabel')) {
      $('#suiviLabel').textContent = finie
        ? (c.statut === 'remboursee' ? 'Commande remboursee' : 'Commande annulee')
        : BOUTIQUE.etapes[e].label + ' ' + BOUTIQUE.etapes[e].emoji;
    }
    var badge = $('#suiviBadge');
    if (badge) {
      badge.textContent = finie
        ? (c.statut === 'remboursee' ? 'Remboursee' : 'Annulee')
        : 'Etape ' + (e + 1) + '/' + BOUTIQUE.etapes.length;
    }
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
    /* on va chercher les vraies commandes dans Supabase */
    chargerCommandes(function () { rendreAdministration(); });
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
    else if (quoi === 'produits') c.innerHTML = panneauProduits();
    else if (quoi === 'categories') c.innerHTML = panneauCategories();
    else if (quoi === 'avis') c.innerHTML = panneauAvis();
    else if (quoi === 'erreurs') {
      c.innerHTML = panneauErreurs();
      chargerEnvoisRates(function () { c.innerHTML = panneauErreurs(); });
    }
    else if (quoi === 'chiffre') {
      c.innerHTML = panneauChiffre();
      chargerChiffre(function () { c.innerHTML = panneauChiffre(); });
    }
    else if (quoi === 'reglages') { c.innerHTML = panneauReglages(); cablerReglages(); }

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

  function panneauCommandes() {
    if (!commandesDistantes.length) {
      return '<h2 class="admin__sous-titre">Commandes</h2>' +
             '<p class="vide">Aucune commande enregistree pour le moment.</p>';
    }

    var liste = commandesFiltrees();

    return ongletsStatut() +
      (liste.length
        ? '<ul class="admin-commandes">' + liste.map(function (cmd) {
      var liste = BOUTIQUE.etapes;
      var e = Math.min(Number(cmd.etape) || 0, liste.length - 1);
      var quand = new Date(cmd.cree_le);
      var dateTxt = quand.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
                    ' a ' + quand.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      return '<li class="admin-commande" data-ouvrir="' + cmd.ref + '">' +
        '<span class="admin-commande__ico">' + liste[e].emoji + '</span>' +
        '<span class="admin-commande__txt">' +
          '<b>' + (cmd.ref || '') + ' \u00B7 ' + (cmd.nom || '') + '</b>' +
          '<small>' + dateTxt + ' \u00B7 ' + liste[e].label + '</small>' +
        '</span>' +
        '<span class="admin-commande__prix">' + euros(Number(cmd.total) || 0) + '</span>' +
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

    fetch(SUPABASE_URL + '/rest/v1/commandes?ref=eq.' + encodeURIComponent(ref), {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_CLE,
        'Authorization': 'Bearer ' + SUPABASE_CLE,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      /* on n'envoie QUE l'etape : le statut n'a pas bouge,
         donc la fonction serveur ne renverra pas la commande */
      body: JSON.stringify({ etape: nouvelle })
    })
      .then(function () {
        chargerCommandes(function () {
          ouvrirPanneau('commandes');
          rendreAdministration();
        });
      })
      .catch(function () {});
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
    fetch(SUPABASE_URL + '/rest/v1/commandes?ref=eq.' + encodeURIComponent(ref), {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_CLE,
        'Authorization': 'Bearer ' + SUPABASE_CLE,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(champs)
    })
      .then(function () {
        chargerCommandes(function () { ouvrirPanneau('commandes'); });
      })
      .catch(function () {});
  }

  function changerStatut(ref, statut) {
    fetch(SUPABASE_URL + '/rest/v1/commandes?ref=eq.' + encodeURIComponent(ref), {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_CLE,
        'Authorization': 'Bearer ' + SUPABASE_CLE,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ statut: statut })
    })
      .then(function () {
        chargerCommandes(function () {
          ouvrirPanneau('commandes');
          rendreAdministration();
          /* si c'est la commande suivie par le client, on la relit */
          if (suiviCherche && suiviCherche.ref === ref) {
            chercherCommande(ref, function (trouvee) {
              if (trouvee) { suiviCherche = trouvee; majBarreSuivi(); rendreSuivi(); }
            });
          }
        });
      })
      .catch(function () {});
  }

  function avancerCommande(ref, delta) {
    var cmd = commandesDistantes.filter(function (x) { return x.ref === ref; })[0];
    if (!cmd) return;
    allerEtape(ref, (Number(cmd.etape) || 0) + delta, false);
  }

  /* la commande ouverte en detail dans la page de gestion */
  var commandeOuverte = null;

  function cablerPanneau(quoi) {
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
          var bg = $('#bgImage');
          if (bg) bg.src = fondCustom;
        };
        lecteur.readAsDataURL(fichier);
      });
    }

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
      if (item) { ouvrirPanneau(item.getAttribute('data-admin')); return; }

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
    /* état initial */
    rendreCatalogue();
    majPanierCount();
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
