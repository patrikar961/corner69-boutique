/* =========================================================
   CORNER69 — boutique
   Configuration centrale : catalogue, thèmes, réglages.
   Tout se règle ici, jamais dans le HTML.
   ========================================================= */

var BOUTIQUE = {

  nom: "CORNER69",

  /* Deposez votre logo sous le nom logo.png a la racine du depot.
     Tant qu'il est absent, le texte CORNER69 anime s'affiche. */
  logo: "logo.png",
  slogan: "Coffee shop — torréfaction artisanale",
  baseline: "Ouvert 7j/7 — 24h/24",

  /* -------------------------------------------------------
     ZONE DE LIVRAISON
     Le commerce livre dans le Rhone : departement 69.
     ------------------------------------------------------- */
  zone: {
    nom: "le Rhône",
    departements: ["69"],
    toutes: false
  },

  /* -------------------------------------------------------
     APPARENCE — thème par défaut
     Modifiable ensuite depuis l'interface /admin
     ------------------------------------------------------- */
  theme: "nuit-acide",

  /* -------------------------------------------------------
     LIVRAISON — 5 étapes, comme le modèle
     ------------------------------------------------------- */
  etapes: [
    { cle: "attente",   label: "Commande reçue",        emoji: "⏳", texte: "Nous avons bien reçu votre commande." },
    { cle: "preparee",  label: "En préparation",        emoji: "🚀", texte: "Votre commande est en cours de préparation." },
    { cle: "tournee",   label: "En tournée de livraison", emoji: "🛵", texte: "Votre commande a quitté la boutique." },
    { cle: "route",     label: "En route vers vous",    emoji: "🎯", texte: "Le livreur arrive dans quelques minutes." },
    { cle: "livree",    label: "Livrée",                emoji: "✅", texte: "Commande livrée. Merci !" }
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
      description: "Grains lavés, notes florales et fruitées. Torréfaction claire, idéale en filtre.",
      medias: [
        { type: "image", src: "media/p1-1.jpg", alt: "Café d'Éthiopie — sachet" },
        { type: "image", src: "media/p1-2.jpg", alt: "Café d'Éthiopie — grains" }
      ]
    },
    {
      id: "p2",
      medias: [{ type: "image", src: "media/p2-1.jpg", alt: "Espresso maison" }],
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
      medias: [{ type: "image", src: "media/p3-1.jpg", alt: "Thé Sencha" }],
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
      medias: [{ type: "image", src: "media/p4-1.jpg", alt: "Mug CORNER69" }],
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
      medias: [{ type: "image", src: "media/p5-1.jpg" }],
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
     L'interface /admin permet de les modifier et d'en créer.
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
     0 = muet · 0.05 = à peine perceptible · 0.3 = présent
     Le fichier doit s'appeler ambiance.mp3 (ou ambiance.m4a)
     ------------------------------------------------------- */
  son: {
    volume: 0.05,
    fichiers: ["p.m4a", "p.mp3", "ambiance.m4a", "ambiance.mp3"],
    actif: true
  },

  /* -------------------------------------------------------
     ADMIN — protège l'interface de personnalisation
     Changez ce mot de passe avant de mettre le site en ligne.
     ------------------------------------------------------- */
  adminMotDePasse: "corner69",

  /* -------------------------------------------------------
     LIVRAISON — frais et seuil
     ------------------------------------------------------- */
  livraison: {
    frais: 3.90,
    gratuiteAPartirDe: 40
  }
};
