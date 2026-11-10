/* =========================================================
   CORNER69 - boutique
   Logique : catalogue, panier, commande, suivi, avis, administration.
   ========================================================= */
(function () {
  'use strict';

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function euros(n) { return Number(n).toFixed(2).replace('.', ',') + ' EUR'; }
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

  var panier = lire('panier', []);
  var commande = lire('commande', null);
  var avis = lire('avis', []);
  var avisAttente = lire('avisAttente', []);
  var theme = lire('theme', null);
  var fondCustom = lire('fond', null);

  function paletteActive() {
    if (theme) return theme;
    return BOUTIQUE.palettes[BOUTIQUE.theme] || BOUTIQUE.palettes[Object.keys(BOUTIQUE.palettes)[0]];
  }

  function appliquerTheme(p) {
    if (!p) return;
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

  function afficherLogo() {
    var img = $('#logoImage');
    var txt = $('#logoTexte');
    if (!img) return;
    img.addEventListener('load', function () {
      if (txt) txt.hidden = true;
      img.hidden = false;
    });
    img.addEventListener('error', function () {
      img.hidden = true;
      if (txt) txt.hidden = false;
    });
    if (img.complete && img.naturalWidth > 0) {
      if (txt) txt.hidden = true;
      img.hidden = false;
    }
  }

  function jouerLogo() {
    var hero = $('#logoHero');
    if (!hero) return;
    hero.classList.remove('logo-hero--joue');
    void hero.offsetWidth;
    hero.classList.add('logo-hero--joue');
  }

  function appliquerFond() {
    var img = $('#bgImage');
    if (img && fondCustom) img.src = fondCustom;
  }

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
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-route]');
    if (!a) return;
    var cible = a.getAttribute('data-route');
    var id = a.getAttribute('data-produit');
    if (id) { location.hash = '#/produit/' + id; }
    else { location.hash = '#' + cible; }
    e.preventDefault();
  });

  window.addEventListener('hashchange', afficher);

  function rayons() {
    var vus = [];
    BOUTIQUE.produits.forEach(function (p) {
      if (vus.indexOf(p.rayon) === -1) vus.push(p.rayon);
    });
    return vus;
  }

  function vignette(p) {
    var premier = (p && p.medias && p.medias[0]) || null;
    if (premier && premier.type === 'image' && premier.src) {
      return '<img src="' + premier.src + '" alt="' + (p.nom || '') + '" loading="lazy">';
    }
    var emoji = String((p && p.emoji) || '').trim();
    if (emoji) return '<span class="vignette__emoji">' + emoji + '</span>';
    return String((p && p.rayon) || '').trim() || '?';
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
    if (!ul) return;
    var cpt = $('#prodCount');
    if (cpt) cpt.textContent = (liste.length < 10 ? '0' : '') + liste.length + ' ref.';

    ul.innerHTML = liste.map(function (p) {
      var rupture = p.stock === 'rupture';
      return '<li class="produit" data-route="/produit" data-produit="' + p.id + '">' +
        '<span class="produit__img">' + vignette(p) + '</span>' +
        '<div class="produit__corps">' +
          '<span class="produit__meta">' + p.rayon + ' - ' + p.format + '</span>' +
          '<h3 class="produit__nom">' + p.nom +
            (p.badge ? '<span class="produit__badge">' + p.badge + '</span>' : '') +
          '</h3>' +
          (rupture
            ? '<span class="produit__rupture">Rupture de stock</span>'
            : '<span class="produit__prix">' + euros(p.prix) + '</span>') +
        '</div>' +
        '<span aria-hidden="true">&#8250;</span>' +
      '</li>';
    }).join('');
  }

  var qteFiche = 1;

  function produitDe(id) {
    return BOUTIQUE.produits.filter(function (p) { return p.id === id; })[0];
  }

  function rendreFiche() {
    var id = (location.hash.split('/produit/')[1] || '').trim();
    var p = produitDe(id);
    var box = $('#fiche');
    if (!box) return;
    if (!p) { box.innerHTML = '<p>Produit introuvable.</p>'; return; }
    if (qteFiche < 1) qteFiche = 1;

    var rupture = p.stock === 'rupture';
    box.innerHTML =
      '<div class="fiche__visuel">' + vignette(p) + '</div>' +
      '<span class="fiche__rayon">' + p.rayon + ' - ' + p.format + '</span>' +
      '<h2 class="fiche__nom">' + p.nom + '</h2>' +
      '<p class="fiche__desc">' + p.description + '</p>' +
      '<span class="fiche__prix">' + euros(p.prix) + '</span>' +
      (rupture
        ? '<p class="produit__rupture" style="margin-top:1.2rem">Produit momentanement indisponible.</p>'
        : '<div class="fiche__ligne">' +
            '<span class="fiche__label">Quantite</span>' +
            '<div class="qte">' +
              '<button type="button" data-q="-1">-</button>' +
              '<span id="qteVal">' + qteFiche + '</span>' +
              '<button type="button" data-q="1">+</button>' +
            '</div>' +
          '</div>' +
          '<button class="btn btn--accent btn--large" id="ajouter" type="button">Ajouter au panier - ' +
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
    if (box.firstChild && box.firstChild.nextSibling) {
      box.insertBefore(zone, box.firstChild.nextSibling);
    } else {
      box.appendChild(zone);
    }
    document.dispatchEvent(new CustomEvent('corner69:produit', { detail: p }));
  }

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
    var vide = $('#panierVide');
    var plein = $('#panierPlein');
    var box = $('#lignes');
    if (!box) return;
    var aDu = panier.length > 0;
    if (vide) vide.hidden = aDu;
    if (plein) plein.hidden = !aDu;
    if (!aDu) return;

    box.innerHTML = panier.map(function (l) {
      var p = produitDe(l.id);
      if (!p) return '';
      return '<li class="ligne">' +
        '<div>' +
          '<div class="ligne__nom">' + p.nom + '</div>' +
          '<div class="ligne__meta">' + p.format + ' - ' + euros(p.prix) + ' x ' + l.qte + '</div>' +
        '</div>' +
        '<div class="qte">' +
          '<button type="button" data-moins="' + p.id + '">-</button>' +
          '<span>' + l.qte + '</span>' +
          '<button type="button" data-plus="' + p.id + '">+</button>' +
        '</div>' +
        '<span class="ligne__prix">' + euros(p.prix * l.qte) + '</span>' +
      '</li>';
    }).join('');

    var sous = totalPanier();
    var frais = fraisLivraison(sous);
    var recap = $('#recap');
    if (recap) {
      recap.innerHTML =
        '<div class="recap__row"><span>Sous-total</span><span>' + euros(sous) + '</span></div>' +
        '<div class="recap__row"><span>Livraison</span><span>' +
          (frais === 0 ? 'Offerte' : euros(frais)) + '</span></div>' +
        '<div class="recap__row recap__row--total"><span>Total</span><b>' +
          euros(sous + frais) + '</b></div>';
    }

    $$('[data-plus]', box).forEach(function (b) {
      b.addEventListener('click', function () { changerQte(b.getAttribute('data-plus'), 1); });
    });
    $$('[data-moins]', box).forEach(function (b) {
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

  function reference() {
    var lettres = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    var s = '';
    for (var i = 0; i < 4; i++) s += lettres.charAt(Math.floor(Math.random() * lettres.length));
    return '#CMD-' + Math.floor(1000 + Math.random() * 9000) + s.charAt(0) + s.charAt(1);
  }

  function validerCommande(e) {
    e.preventDefault();
    var f = e.target;
    var champs = ['nom', 'tel', 'adresse', 'cp', 'ville'];
    var manque = champs.filter(function (n) { return f[n] && !f[n].value.trim(); });
    var note = $('#formErreur');
    if (manque.length) {
      if (note) { note.hidden = false; note.textContent = 'Merci de remplir tous les champs.'; }
      return;
    }
    if (note) note.hidden = true;

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

  function etapes() { return BOUTIQUE.etapes; }

  function rendreSuivi() {
    var box = $('#suivi');
    if (!box) return;
    if (!commande) {
      var a0 = $('#suiviActions');
      if (a0) a0.hidden = true;
      box.innerHTML = '<div class="vide"><p>Aucune commande en cours.</p>' +
        '<button class="btn btn--accent" type="button" data-route="/">Voir le catalogue</button></div>';
      return;
    }

    var liste = etapes();
    var e = Math.min(commande.etape, liste.length - 1);
    var pct = Math.round(((e + 1) / liste.length) * 100);
    var actions = $('#suiviActions');
    if (actions) actions.hidden = (e >= liste.length - 1);

    var quand = new Date(commande.date);
    var dateTxt = 'Passee le ' + quand.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
                  ' a ' + quand.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    box.innerHTML =
      '<div class="suivi__entete">' +
        '<div class="suivi__ring" style="--pct:' + pct + '%"><span>' + (e + 1) + '</span>' +
          '<small>/' + liste.length + '</small></div>' +
        '<div>' +
          '<div class="suivi__ref">' + commande.ref + '</div>' +
          '<p class="suivi__etat">' + liste[e].label + ' ' + liste[e].emoji + '</p>' +
          '<div class="suivi__date">' + dateTxt + '</div>' +
        '</div>' +
      '</div>' +
      '<ul class="jalons">' +
        liste.map(function (et, i) {
          var cls = i < e ? 'fait' : (i === e ? 'encours' : '');
          var point = i < e ? '&#10003;' : (i + 1);
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
        '<div class="recap__row recap__row--total"><span>Total paye</span><b>' +
          euros(commande.total) + '</b></div>' +
      '</aside>';
  }

  function majBarreSuivi() {
    var barre = $('#suiviBar');
    if (!barre) return;
    if (!commande) { barre.hidden = true; return; }
    barre.hidden = false;
    var liste = etapes();
    var e = Math.min(commande.etape, liste.length - 1);
    var pct = Math.round(((e + 1) / liste.length) * 100);
    if ($('#suiviPct')) $('#suiviPct').textContent = e + 1;
    if ($('#suiviRef')) $('#suiviRef').textContent = commande.ref;
    if ($('#suiviLabel')) $('#suiviLabel').textContent = liste[e].label + ' ' + liste[e].emoji;
    if ($('#suiviBadge')) $('#suiviBadge').textContent = 'Etape ' + (e + 1) + '/' + liste.length;
    var ring = barre.querySelector('.suivi-carte__ring');
    if (ring) ring.style.setProperty('--pct', pct + '%');
    if ($('#suiviJauge')) $('#suiviJauge').style.width = pct + '%';
  }

  var noteChoisie = 5;

  function etoilesTexte(n) {
    var plein = Math.round(n);
    return new Array(plein + 1).join('&#9733;') + new Array(5 - plein + 1).join('&#9734;');
  }

  function rendreEtoiles() {
    var box = $('#etoiles');
    if (!box) return;
    box.innerHTML = [1, 2, 3, 4, 5].map(function (n) {
      return '<button type="button" class="' + (n <= noteChoisie ? 'on' : '') +
        '" data-note="' + n + '">&#9733;</button>';
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

  function rendreAvis() {
    rendreEtoiles();
    var moy = moyenneAvis();
    if ($('#avisMoyenne')) {
      $('#avisMoyenne').textContent = (avis.length ? moy.toFixed(1).replace('.', ',') : '0') + ' / 5';
    }
    if ($('#avisMoyenneEtoiles')) $('#avisMoyenneEtoiles').innerHTML = etoilesTexte(moy);
    if ($('#avisTotal')) $('#avisTotal').textContent = avis.length;
    if ($('#avisCount')) $('#avisCount').textContent = (avis.length < 10 ? '0' : '') + avis.length;

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
    var nom = $('#aNom') ? $('#aNom').value.trim() : '';
    var texte = $('#aTexte') ? $('#aTexte').value.trim() : '';
    var err = $('#avisErreur');
    var ok = $('#avisEnAttente');
    if (err) err.hidden = true;
    if (ok) ok.hidden = true;

    if (!nom || !texte) {
      if (err) { err.hidden = false; err.textContent = 'Merci de mettre une note, un message et votre nom.'; }
      return;
    }

    avisAttente.unshift({ nom: nom, note: noteChoisie, texte: texte, date: new Date().toISOString() });
    ecrire('avisAttente', avisAttente);
    e.target.reset();
    noteChoisie = 5;
    rendreEtoiles();
    if (ok) ok.hidden = false;
    rendreAdministration();
  }

  var adminOuvert = false;

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
    if ($('#mdp')) $('#mdp').value = '';
    fermerPanneau();
  }

  function rendreAdministration() {
    var box = $('#tuiles');
    if (box) {
      var cartes = [
        { ico: '&#128722;', label: 'Commandes', valeur: String(commande ? 1 : 0), note: '', cible: 'commandes' },
        { ico: '&#8364;', label: 'Chiffre', valeur: euros(commande ? commande.total : 0), note: '', cible: 'commandes' },
        { ico: '&#128203;', label: 'En cours', valeur: String(commande ? 1 : 0), note: 'Payees, a livrer', cible: 'commandes' },
        { ico: '&#11088;', label: 'Avis', valeur: String(avisAttente.length), note: 'En attente', cible: 'avis' }
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
    cablerPanneau();
  }

  function ouvrirPanneau(quoi) {
    var p = $('#panneau');
    var c = $('#panneauContenu');
    if (!p || !c) return;
    if (quoi === 'commandes') c.innerHTML = panneauCommandes();
    else if (quoi === 'produits') c.innerHTML = panneauProduits();
    else if (quoi === 'categories') c.innerHTML = panneauCategories();
    else if (quoi === 'avis') c.innerHTML = panneauAvis();
    else if (quoi === 'reglages') c.innerHTML = panneauReglages();
    cablerPanneau();
    p.hidden = false;
  }

  function fermerPanneau() {
    var p = $('#panneau');
    if (p) p.hidden = true;
  }

  function panneauCommandes() {
    var liste = etapes();
    if (!commande) {
      return '<h2 class="admin__sous-titre">Commandes</h2>' +
             '<p class="vide">Aucune commande enregistree pour le moment.</p>';
    }
    var i = Math.min(commande.etape, liste.length - 1);
    return '<h2 class="admin__sous-titre">Commandes</h2>' +
      '<div class="admin-commande">' +
        '<span class="admin-commande__info">' + commande.ref +
          ' - etape <b>' + (i + 1) + '/' + liste.length + '</b><br>' + liste[i].label +
        '</span>' +
        '<span class="admin-commande__actions">' +
          '<button type="button" data-avance="-1"' + (i === 0 ? ' disabled' : '') + '>Reculer</button>' +
          '<button type="button" data-avance="1"' + (i >= liste.length - 1 ? ' disabled' : '') + '>Avancer</button>' +
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
      '<p class="fond__hint" style="margin-bottom:1rem">Le catalogue se modifie dans <b>config.js</b>, section <b>produits</b>.</p>' +
      '<ul class="admin-liste">' + BOUTIQUE.produits.map(function (p) {
        return '<li class="admin-liste__item">' +
          '<span class="admin-liste__img">' + (p.emoji || (p.nom || '?').charAt(0)) + '</span>' +
          '<span class="admin-liste__txt"><b>' + p.nom + '</b>' +
            '<small>' + p.rayon + ' - ' + p.format + ' - ' + euros(p.prix) + '</small></span>' +
          '<span class="' + (p.stock === 'rupture' ? 'admin-liste__rupture' : 'admin-liste__ok') + '">' +
            (p.stock === 'rupture' ? 'Rupture' : 'En stock') + '</span>' +
        '</li>';
      }).join('') + '</ul>';
  }

  function panneauCategories() {
    return '<h2 class="admin__sous-titre">Categories</h2>' +
      '<ul class="admin-liste">' + rayons().map(function (r) {
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
        '</span></button>';
    }).join('');
    var champs = [
      ['fond', 'Fond'], ['carte', 'Cartes'], ['texte', 'Texte'],
      ['doux', 'Texte secondaire'], ['accent', 'Accentuation'], ['accentTexte', 'Texte sur accent']
    ];
    var couleurs = champs.map(function (c) {
      return '<div class="couleur"><label for="c-' + c[0] + '">' + c[1] + '</label>' +
        '<input type="color" id="c-' + c[0] + '" data-couleur="' + c[0] + '" value="' +
        (p[c[0]] || '#000000') + '"></div>';
    }).join('');
    return '<h2 class="admin__sous-titre">Reglages</h2>' +
      '<h3 class="admin__bloc">Palettes</h3><div class="palettes">' + palettes + '</div>' +
      '<h3 class="admin__bloc">Couleurs</h3><div class="couleurs">' + couleurs + '</div>' +
      '<h3 class="admin__bloc">Image de fond</h3>' +
      '<div class="fond">' +
        '<p class="fond__hint">Deposez une image : elle sera appliquee dans ce navigateur. Pour tous les visiteurs, deposez-la a la racine du depot sous le nom <b>bg.PNG</b>.</p>' +
        '<input type="file" id="fondFile" accept="image/*">' +
        '<button class="btn btn--ghost" id="fondReset" type="button">Revenir au fond du depot</button>' +
      '</div>' +
      '<div class="reglages__actions">' +
        '<button class="btn btn--accent" id="themeSauver" type="button">Enregistrer le theme</button>' +
        '<button class="btn btn--ghost" id="themeReset" type="button">Reinitialiser</button>' +
      '</div>';
  }

  function cablerPanneau() {
    $$('[data-avance]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!commande) return;
        var d = parseInt(b.getAttribute('data-avance'), 10);
        commande.etape = Math.max(0, Math.min(etapes().length - 1, commande.etape + d));
        ecrire('commande', commande);
        majBarreSuivi();
        ouvrirPanneau('commandes');
      });
    });
    $$('[data-avis]').forEach(function (b) {
      b.addEventListener('click', function () {
        avis.splice(parseInt(b.getAttribute('data-avis'), 10), 1);
        ecrire('avis', avis);
        ouvrirPanneau('avis');
        rendreAdministration();
      });
    });
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
    if ($('#fondFile')) {
      $('#fondFile').addEventListener('change', function (e) {
        var fichier = e.target.files[0];
        if (!fichier) return;
        var lecteur = new FileReader();
        lecteur.onload = function () {
          fondCustom = lecteur.result;
          ecrire('fond', fondCustom);
          if ($('#bgImage')) $('#bgImage').src = fondCustom;
        };
        lecteur.readAsDataURL(fichier);
      });
    }
    if ($('#fondReset')) {
      $('#fondReset').addEventListener('click', function () {
        fondCustom = null;
        effacer('fond');
        if ($('#bgImage')) $('#bgImage').src = 'bg.PNG';
      });
    }
    if ($('#themeSauver')) {
      $('#themeSauver').addEventListener('click', function () {
        if (theme) ecrire('theme', theme);
      });
    }
    if ($('#themeReset')) {
      $('#themeReset').addEventListener('click', function () {
        theme = null;
        effacer('theme');
        appliquerTheme(paletteActive());
        ouvrirPanneau('reglages');
      });
    }
  }

  function init() {
    appliquerTheme(paletteActive());

    var loader = $('#loader');
    setTimeout(function () {
      if (loader) {
        loader.classList.add('is-off');
        setTimeout(function () { loader.style.display = 'none'; }, 600);
      }
    }, 1400);

    if ($('#introGo')) {
      $('#introGo').addEventListener('click', function () {
        if ($('#intro')) $('#intro').hidden = true;
        if ($('#nav')) $('#nav').hidden = false;
        if ($('#vues')) $('#vues').hidden = false;
        if ($('#foot')) $('#foot').hidden = false;
        appliquerFond();
        afficher();
        jouerLogo();
      });
    }

    if ($('#formCommande')) $('#formCommande').addEventListener('submit', validerCommande);
    if ($('#formAvis')) $('#formAvis').addEventListener('submit', publierAvis);
    if ($('#formVerrou')) $('#formVerrou').addEventListener('submit', deverrouiller);
    if ($('#suiviVoir')) $('#suiviVoir').addEventListener('click', function () { location.hash = '#/suivi'; });
    if ($('#versCommande')) {
      $('#versCommande').addEventListener('click', function () {
        if (!panier.length) return;
        location.hash = '#/commande';
      });
    }

    document.addEventListener('click', function (e) {
      if (e.target.closest('#suiviAvancer')) {
        if (!commande || commande.etape >= etapes().length - 1) return;
        commande.etape += 1;
        ecrire('commande', commande);
        majBarreSuivi();
        rendreSuivi();
        return;
      }
      var item = e.target.closest('[data-admin]');
      if (item) { ouvrirPanneau(item.getAttribute('data-admin')); return; }
      if (e.target.closest('#panneauRetour')) { fermerPanneau(); return; }
      if (e.target.closest('#adminQuitter')) { verrouillerAdministration(); return; }
    });

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
