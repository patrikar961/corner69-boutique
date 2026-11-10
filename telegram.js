/* =========================================================
   CORNER69 — notifications Telegram
   Optionnel : si le jeton et l'identifiant de discussion sont
   renseignes dans config.js, chaque commande est annoncee
   sur Telegram. Sinon, le module ne fait rien.
   ========================================================= */
(function () {
  'use strict';

  var reg = (typeof BOUTIQUE !== 'undefined' && BOUTIQUE.telegram) ? BOUTIQUE.telegram : null;
  if (!reg || !reg.jeton || !reg.discussion) return;

  function euros(n) { return n.toFixed(2).replace('.', ',') + ' €'; }

  /* ---------------------------------------------------------
     On ecoute le formulaire de commande. Quand il est valide,
     on envoie un message au commercant.
     --------------------------------------------------------- */
  var form = document.getElementById('formCommande');
  if (!form) return;

  form.addEventListener('submit', function () {
    /* la commande est ecrite par app.js juste apres :
       on laisse le temps a l'enregistrement, puis on lit */
    setTimeout(function () {
      var brut = null;
      try { brut = localStorage.getItem('corner69.commande'); } catch (e) { return; }
      if (!brut) return;

      var c;
      try { c = JSON.parse(brut); } catch (e) { return; }
      if (!c || !c.ref) return;

      /* on ne notifie qu'une fois par commande */
      var derniere = localStorage.getItem('corner69.notifiee');
      if (derniere === c.ref) return;

      var texte =
        '\u{1F4E6} Nouvelle commande ' + c.ref + '\n' +
        c.adresse.nom + ' — ' + c.adresse.tel + '\n' +
        c.adresse.adresse + '\n' +
        c.adresse.cp + ' ' + c.adresse.ville + '\n' +
        'Total : ' + euros(c.total) + '\n' +
        'Etape : ' + c.etape + '/5';

      var url = 'https://api.telegram.org/bot' + reg.jeton + '/sendMessage';

      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: reg.discussion, text: texte })
      })
        .then(function () {
          try { localStorage.setItem('corner69.notifiee', c.ref); } catch (e) {}
        })
        .catch(function () {
          /* pas de reseau, ou jeton invalide : on n'interrompt rien */
        });
    }, 400);
  });
})();
