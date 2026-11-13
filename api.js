/* =========================================================
   CORNER69 — branchement Supabase
   Version sans dependance : aucun CDN, aucun import.
   Ce fichier s'ajoute comme les autres scripts du site.

   DEJA REMPLI pour CORNER69 :
     URL_BASE      = https://jmhtdfbqleivsvootvma.supabase.co
     CLE_PUBLIQUE  = la cle publique du projet (sb_publishable_...)

   Ces deux valeurs sont PUBLIQUES par nature : elles sont
   faites pour vivre dans un site. Ce qui doit rester secret,
   c'est la cle "secret" / "service_role" du projet (elle
   commence par sb_secret_ ou eyJ... en role service_role).
   Elle ne doit JAMAIS figurer ici.

   QUELLE CLE UTILISER :
     La cle "anon" est faite pour etre publique : elle est
     concue pour vivre dans un site. Les regles RLS limitent
     ce qu'elle peut faire (lire le catalogue, appeler les
     fonctions).
     La cle "service_role" ne doit JAMAIS figurer ici : elle
     contourne toutes les regles de securite.

   Ce fichier ne contient aucun secret.
   ========================================================= */

var CORNER69_API = (function () {
  'use strict';

  /* -------------------------------------------------------
     IDENTIFIANTS DU PROJET (deja remplis)
     ------------------------------------------------------- */
  var URL_BASE = 'https://jmhtdfbqleivsvootvma.supabase.co';
  var CLE_PUBLIQUE = 'sb_publishable_ns_kx2n4WNuvmhFRE4Tg-Q_W4NTpCb1';

  /* -------------------------------------------------------
     OUTILS INTERNES
     ------------------------------------------------------- */

  function configure() {
    /* Les identifiants sont remplis : on verifie qu'ils ont
       la bonne forme, pour signaler clairement une valeur
       tronquee ou mal collee plutot que d'echouer en silence. */
    return URL_BASE.indexOf('supabase.co') > -1 &&
           CLE_PUBLIQUE.length > 20;
  }

  function entetes(extra) {
    var h = {
      'apikey': CLE_PUBLIQUE,
      'Authorization': 'Bearer ' + CLE_PUBLIQUE,
      'Content-Type': 'application/json'
    };
    if (extra) {
      Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
    }
    return h;
  }

  /* Un appel en echec ne doit jamais casser le site :
     on renvoie toujours un objet, jamais une exception. */
  function appel(chemin, options) {
    if (!configure()) {
      return Promise.resolve({
        ok: false,
        erreur: 'La boutique n\'est pas reliée à sa base de données. Vérifiez les identifiants dans api.js.'
      });
    }

    var opt = options || {};
    var url = URL_BASE.replace(/\/+$/, '') + chemin;

    return fetch(url, {
      method: opt.methode || 'GET',
      headers: entetes(opt.entetes),
      body: opt.corps ? JSON.stringify(opt.corps) : undefined
    })
      .then(function (r) {
        return r.text().then(function (texte) {
          var data = null;
          try { data = texte ? JSON.parse(texte) : null; } catch (e) { data = texte; }

          if (!r.ok) {
            /* Les fonctions PostgreSQL renvoient leur message
               dans data.message : c'est ce texte qui est utile
               a l'utilisateur, pas le code HTTP. */
            var msg = (data && (data.message || data.hint || data.error)) || ('erreur ' + r.status);
            return { ok: false, erreur: String(msg), statut: r.status };
          }
          return { ok: true, data: data };
        });
      })
      .catch(function () {
        return {
          ok: false,
          erreur: 'Connexion impossible. Vérifiez votre réseau, puis réessayez.'
        };
      });
  }

  /* Appel d'une fonction RPC (les fonctions SQL).
     Les parametres nommes vont dans le corps, pas en query string. */
  function rpc(nom, parametres) {
    return appel('/rest/v1/rpc/' + nom, {
      methode: 'POST',
      corps: parametres || {}
    });
  }

  /* Lecture d'une table (soumise aux regles RLS). */
  function table(nom, query) {
    return appel('/rest/v1/' + nom + (query ? '?' + query : ''), { methode: 'GET' });
  }

  /* -------------------------------------------------------
     IDENTIFIANT DE SUIVI DU CLIENT

     Un identifiant opaque, genere au premier chargement et
     conserve dans le navigateur. Il permet au client de
     retrouver SES commandes — et a lui seul.

     Ce n'est pas un secret : c'est une poignee. Sans elle,
     il ne peut rien lire ; avec elle, il ne lit que les
     commandes qui portent la meme.
     ------------------------------------------------------- */
  var CLE_SUIVI = 'corner69.suivi_id';

  function suiviId() {
    var v = null;
    try { v = localStorage.getItem(CLE_SUIVI); } catch (e) { v = null; }

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
      try { localStorage.setItem(CLE_SUIVI, v); } catch (e) {}
    }

    return v;
  }

  /* -------------------------------------------------------
     ACTIONS — ce que le site appelle
     ------------------------------------------------------- */

  /* Le catalogue. */
  function catalogue() {
    return table('produits', 'select=*&actif=eq.true&order=position.asc');
  }

  /* Les reglages de la boutique. */
  function reglages() {
    return table('reglages', 'select=*&id=eq.boutique&limit=1');
  }

  /* Les avis publies. */
  function avis() {
    return table('avis', 'select=*&publie=eq.true&order=cree_le.desc&limit=50');
  }

  /* Enregistrer une commande. C'est LE point qui manquait :
     la commande part en base, donc la boutique la voit. */
  function creerCommande(commande) {
    return rpc('creer_commande', {
      p_suivi_id:    suiviId(),
      p_client_nom:  commande.nom,
      p_client_tel:  commande.tel,
      p_adresse:     commande.adresse,
      p_code_postal: commande.cp,
      p_ville:       commande.ville,
      p_articles:    commande.articles,
      p_sous_total:  commande.sousTotal,
      p_frais:       commande.frais,
      p_telegram:    commande.telegram || ''
    });
  }

  /* Suivre la derniere commande de ce navigateur. */
  function suivre() {
    return rpc('suivre_commande', { p_suivi_id: suiviId() });
  }

  /* Lire une commande precise (reference + identifiant). */
  function lire(ref) {
    return rpc('lire_commande', { p_ref: ref, p_suivi_id: suiviId() });
  }

  /* Laisser un avis. */
  function laisserAvis(note, auteur, texte) {
    return rpc('laisser_avis', { p_note: note, p_auteur: auteur, p_texte: texte });
  }

  /* -------------------------------------------------------
     COTE BOUTIQUE (page #/gestion)

     Le mot de passe est transmis a chaque appel et verifie
     par la base. Il n'est jamais stocke en clair ici.
     ------------------------------------------------------- */

  function adminVerifier(motDePasse) {
    return rpc('admin_verifier', { p_mot_de_passe: motDePasse });
  }

  function adminCommandes(motDePasse) {
    return rpc('admin_commandes', { p_mot_de_passe: motDePasse });
  }

  function adminAvancer(motDePasse, ref, sens) {
    return rpc('admin_avancer', {
      p_mot_de_passe: motDePasse,
      p_ref: ref,
      p_sens: sens
    });
  }

  function adminProduit(motDePasse, produit) {
    return rpc('admin_produit', {
      p_mot_de_passe: motDePasse,
      p_id:          produit.id,
      p_nom:         produit.nom,
      p_rayon:       produit.rayon,
      p_prix:        produit.prix,
      p_stock:       produit.stock,
      p_format:      produit.format || '',
      p_emoji:       produit.emoji || '',
      p_description: produit.description || ''
    });
  }

  /* -------------------------------------------------------
     EXPORT
     ------------------------------------------------------- */
  return {
    configure: configure,
    suiviId: suiviId,
    catalogue: catalogue,
    reglages: reglages,
    avis: avis,
    creerCommande: creerCommande,
    suivre: suivre,
    lire: lire,
    laisserAvis: laisserAvis,
    adminVerifier: adminVerifier,
    adminCommandes: adminCommandes,
    adminAvancer: adminAvancer,
    adminProduit: adminProduit
  };
})();
