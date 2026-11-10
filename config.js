/* =========================================================
   CORNER69 — boutique
   Configuration centrale : catalogue, themes, zone de livraison.
   Tout se regle ici, jamais dans le HTML.
   ========================================================= */

var BOUTIQUE = {

  nom: "CORNER69",
  slogan: "Coffee shop — torrefaction artisanale",
  baseline: "Ouvert 7j/7 — 24h/24",

  /* -------------------------------------------------------
     ZONE DE LIVRAISON
     Le commerce livre dans le Rhone : departement 69.
     Les suggestions d'adresse ne proposent QUE cette zone.
     ------------------------------------------------------- */
  zone: {
    nom: "le Rhône",
    departements: ["69"],
    toutes: false
  },

  /* -------------------------------------------------------
     APPARENCE — theme par defaut
     Modifiable ensuite depuis la page de gestion (#/gestion)
     ------------------------------------------------------- */
  theme: "nuit-acide",

  /* -------------------------------------------------------
     LIVRAISON — 5 etapes
     ------------------------------------------------------- */
  etapes: [
    { cle: "attente",  label: "Commande reçue",          emoji: "⏳", texte: "Nous avons bien reçu votre commande." },
    { cle: "preparee", label: "En préparation",          emoji: "🚀", texte: "Votre commande est en cours de préparation." },
    { cle: "tournee",  label: "En tournée de livraison", emoji: "🛵", texte: "Votre commande a quitté la boutique." },
    { cle: "route",    label: "En route vers vous",      emoji: "🎯", texte: "Le livreur arrive dans quelques minutes." },
    { cle: "livree",   label: "Livrée",                  emoji: "✅", texte: "Commande livrée. Merci !" }
  ],

  /* -------------------------------------------------------
     CATALOGUE — 5 produits pour commencer
     ------------------------------------------------------- */
  produits: [
    {
      id: "p1",
      nom: "Café de spécialité — Éthiopie",
      rayon: "Cafés",
      format: "250 g",
      prix: 14.50,
      stock: "disponible",
      badge: "",
      description: "Grains lavés, notes florales et fruitées. Torréfaction claire, idéale en filtre."
    },
    {
      id: "p2",
      nom: "Espresso maison — Assemblage",
      rayon: "Cafés",
      format: "1 kg",
      prix: 32.00,
      stock: "disponible",
      badge: "Nouveau",
      description: "Assemblage 70 % arabica, 30 % robusta. Corps franc, crema dense, parfait pour la machine du comptoir."
    },
    {
      id: "p3",
      nom: "Thé vert Sencha du Japon",
      rayon: "Thés",
      format: "100 g",
      prix: 18.00,
      stock: "disponible",
      badge: "",
      description: "Récolte de printemps, feuilles roulées à la main. Infusion végétale, légèrement umami."
    },
    {
      id: "p4",
      nom: "Mug CORNER69 en grès",
      rayon: "Accessoires",
      format: "35 cl",
      prix: 24.00,
      stock: "disponible",
      badge: "Limité",
      description: "Grès émaillé, tourné à la main. Passe au lave-vaisselle et au micro-ondes."
    },
    {
      id: "p5",
      nom: "Pack découverte — 3 origines",
      rayon: "Coffrets",
      format: "3 × 100 g",
      prix: 39.00,
      stock: "rupture",
      badge: "",
      description: "Trois cafés de trois pays, en format dégustation. Le meilleur moyen de trouver votre préféré."
    }
  ],

  /* -------------------------------------------------------
     PALETTES — préréglages de couleurs
     ------------------------------------------------------- */
  palettes: {
    "nuit-acide": {
      nom: "Nuit acide",
      fond: "#0a0a0f",
      carte: "#141419",
      texte: "#ffffff",
      doux: "#a9b0bd",
      accent: "#d4f24a",
      accentTexte: "#14170a",
      bordure: "rgba(255,255,255,.10)"
    },
    "bleu-nuit": {
      nom: "Bleu nuit",
      fond: "#080d18",
      carte: "#111a2b",
      texte: "#ffffff",
      doux: "#9aabc4",
      accent: "#5ab0ff",
      accentTexte: "#05101f",
      bordure: "rgba(255,255,255,.10)"
    },
    "terracotta": {
      nom: "Terracotta",
      fond: "#16100c",
      carte: "#241a14",
      texte: "#fff6ef",
      doux: "#c0a896",
      accent: "#e8763c",
      accentTexte: "#1a0d06",
      bordure: "rgba(255,255,255,.10)"
    },
    "foret": {
      nom: "Forêt",
      fond: "#0b1310",
      carte: "#14201b",
      texte: "#f2fbf6",
      doux: "#a3bcb0",
      accent: "#4fd18b",
      accentTexte: "#04140b",
      bordure: "rgba(255,255,255,.10)"
    },
    "sable": {
      nom: "Sable",
      fond: "#12100d",
      carte: "#1e1b16",
      texte: "#fdf9f1",
      doux: "#bdb2a0",
      accent: "#e2b23f",
      accentTexte: "#1a1408",
      bordure: "rgba(255,255,255,.10)"
    },
    "bordeaux": {
      nom: "Bordeaux",
      fond: "#150a0e",
      carte: "#241218",
      texte: "#fff3f6",
      doux: "#c19aa6",
      accent: "#e05575",
      accentTexte: "#1c060c",
      bordure: "rgba(255,255,255,.10)"
    }
  },

  /* -------------------------------------------------------
     SON — invisible pour le visiteur
     0 = muet · 0.05 = a peine perceptible · 0.3 = present
     ------------------------------------------------------- */
  son: {
    volume: 0.05,
    fichiers: ["ambiance.m4a", "ambiance.mp3"],
    actif: true
  },

  /* -------------------------------------------------------
     GESTION — protege la page #/gestion
     Changez ce mot de passe avant la mise en ligne.
     Ce n'est qu'une barriere visuelle : voir le README.
     ------------------------------------------------------- */
  adminMotDePasse: "corner69",

  /* -------------------------------------------------------
     TELEGRAM — notifications de commande (optionnel)
     Pour recevoir un message a chaque nouvelle commande :
     1. creez un bot avec @BotFather, il donne un jeton
     2. ecrivez-lui une fois, puis ouvrez
        api.telegram.org/bot<jeton>/getUpdates pour trouver
        votre identifiant de discussion (chat_id)
     3. collez les deux valeurs ci-dessous
     Laissez vide pour desactiver.
     ------------------------------------------------------- */
  telegram: {
    jeton: "",
    discussion: ""
  },

  /* -------------------------------------------------------
     LIVRAISON — frais et seuil
     ------------------------------------------------------- */
  livraison: {
    frais: 3.90,
    gratuiteAPartirDe: 40
  }
};
