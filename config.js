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
    nom: "la France",
    departements: [],
    toutes: true
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
    { cle: "tournee",   label: "En tournée de livraison", emoji: "🛵", texte: "Votre commande a quitté le plug." },
    { cle: "route",     label: "En route vers vous",    emoji: "🎯", texte: "Le livreur arrive dans quelques minutes." },
    { cle: "livree",    label: "Livrée",                emoji: "✅", texte: "Commande livrée. Merci !" }
  ],

  /* -------------------------------------------------------
     CATALOGUE — 5 produits pour commencer
     ------------------------------------------------------- */
  produits: [
    {
      id: "p1",
      nom: "Écaille — Colombie",
      rayon: "Neige",
      emoji: "❄️",
      format: "1 g",
      prix: 60.,
      stock: "disponible",
      badge: "❄️",
      description: "écaille de poisson, top qualité 🇨🇴✅",
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
      emoji: "🫘",
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
      emoji: "🍵",
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
      emoji: "🏺",
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
      emoji: "🎁",
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
    "vert-fluo": {
      nom: "Vert fluo",
      fond: "#06120a",
      carte: "#0f1d14",
      texte: "#ffffff",
      doux: "#9dc4ab",
      accent: "#39ff88",
      accentTexte: "#04170b",
      bordure: "rgba(255,255,255,.10)"
    },
    "rose-neon": {
      nom: "Rose neon",
      fond: "#12060f",
      carte: "#200d1a",
      texte: "#ffffff",
      doux: "#c9a2bd",
      accent: "#ff4fb8",
      accentTexte: "#1c0413",
      bordure: "rgba(255,255,255,.10)"
    },
    "cyan-electrique": {
      nom: "Cyan electrique",
      fond: "#04121a",
      carte: "#0c1f2b",
      texte: "#ffffff",
      doux: "#93bfd1",
      accent: "#22e8ff",
      accentTexte: "#02161d",
      bordure: "rgba(255,255,255,.10)"
    },
    "violet-neon": {
      nom: "Violet neon",
      fond: "#0e0618",
      carte: "#1a0f29",
      texte: "#ffffff",
      doux: "#b6a3cf",
      accent: "#a855ff",
      accentTexte: "#150526",
      bordure: "rgba(255,255,255,.10)"
    },
    "orange-brule": {
      nom: "Orange brule",
      fond: "#140902",
      carte: "#22130a",
      texte: "#fff7f0",
      doux: "#cdab93",
      accent: "#ff7a1a",
      accentTexte: "#1d0c02",
      bordure: "rgba(255,255,255,.10)"
    },
    "jaune-cyber": {
      nom: "Jaune cyber",
      fond: "#12110a",
      carte: "#1e1c10",
      texte: "#ffffff",
      doux: "#c9c395",
      accent: "#ffe600",
      accentTexte: "#1a1804",
      bordure: "rgba(255,255,255,.10)"
    },
    "rouge-neon": {
      nom: "Rouge neon",
      fond: "#130306",
      carte: "#210a0f",
      texte: "#ffffff",
      doux: "#cfa2a9",
      accent: "#ff2e4d",
      accentTexte: "#1c0308",
      bordure: "rgba(255,255,255,.10)"
    },
    "turquoise": {
      nom: "Turquoise",
      fond: "#03130f",
      carte: "#0a2019",
      texte: "#ffffff",
      doux: "#93c6b8",
      accent: "#00ffc8",
      accentTexte: "#02170f",
      bordure: "rgba(255,255,255,.10)"
    },
    "magenta": {
      nom: "Magenta",
      fond: "#12040e",
      carte: "#20091a",
      texte: "#ffffff",
      doux: "#c99cbe",
      accent: "#ff00a0",
      accentTexte: "#1b0314",
      bordure: "rgba(255,255,255,.10)"
    },
    "bleu-electrique": {
      nom: "Bleu electrique",
      fond: "#050a1a",
      carte: "#0d1529",
      texte: "#ffffff",
      doux: "#9aa9c9",
      accent: "#2f6dff",
      accentTexte: "#030818",
      bordure: "rgba(255,255,255,.10)"
    },
    "vert-lime": {
      nom: "Vert lime",
      fond: "#0b1204",
      carte: "#151f0a",
      texte: "#ffffff",
      doux: "#b3c68f",
      accent: "#b6ff00",
      accentTexte: "#101704",
      bordure: "rgba(255,255,255,.10)"
    },
    "corail-neon": {
      nom: "Corail neon",
      fond: "#140706",
      carte: "#22100e",
      texte: "#fff8f6",
      doux: "#cfaca7",
      accent: "#ff5c3d",
      accentTexte: "#1d0603",
      bordure: "rgba(255,255,255,.10)"
    },
    "parme": {
      nom: "Parme",
      fond: "#0c0714",
      carte: "#171021",
      texte: "#ffffff",
      doux: "#ada2c4",
      accent: "#c77dff",
      accentTexte: "#120821",
      bordure: "rgba(255,255,255,.10)"
    },
    "azur": {
      nom: "Azur",
      fond: "#03101f",
      carte: "#0a1b2e",
      texte: "#ffffff",
      doux: "#95b0c9",
      accent: "#00b3ff",
      accentTexte: "#02111f",
      bordure: "rgba(255,255,255,.10)"
    },
    "pistache": {
      nom: "Pistache",
      fond: "#0d1206",
      carte: "#181f0c",
      texte: "#ffffff",
      doux: "#b8c69d",
      accent: "#9fff3d",
      accentTexte: "#111607",
      bordure: "rgba(255,255,255,.10)"
    },
    "fuchsia": {
      nom: "Fuchsia",
      fond: "#14030c",
      carte: "#220817",
      texte: "#ffffff",
      doux: "#cb9cba",
      accent: "#ff1f8f",
      accentTexte: "#1d0310",
      bordure: "rgba(255,255,255,.10)"
    },
    "or-neon": {
      nom: "Or neon",
      fond: "#12100a",
      carte: "#1f1c11",
      texte: "#fffdf5",
      doux: "#cbc196",
      accent: "#ffd400",
      accentTexte: "#1a1604",
      bordure: "rgba(255,255,255,.10)"
    },
    "menthe": {
      nom: "Menthe",
      fond: "#04120d",
      carte: "#0a1e16",
      texte: "#ffffff",
      doux: "#94c7b6",
      accent: "#00ffa3",
      accentTexte: "#03180f",
      bordure: "rgba(255,255,255,.10)"
    },
    "indigo": {
      nom: "Indigo",
      fond: "#070718",
      carte: "#101026",
      texte: "#ffffff",
      doux: "#9d9dc9",
      accent: "#5a5aff",
      accentTexte: "#05051a",
      bordure: "rgba(255,255,255,.10)"
    },
    "framboise": {
      nom: "Framboise",
      fond: "#130408",
      carte: "#210a12",
      texte: "#fff6f9",
      doux: "#ce9caa",
      accent: "#ff3d7f",
      accentTexte: "#1c0308",
      bordure: "rgba(255,255,255,.10)"
    },
    "citron": {
      nom: "Citron",
      fond: "#10120a",
      carte: "#1c1f10",
      texte: "#ffffff",
      doux: "#c6c795",
      accent: "#eaff00",
      accentTexte: "#181a04",
      bordure: "rgba(255,255,255,.10)"
    },
    "sarcelle": {
      nom: "Sarcelle",
      fond: "#031210",
      carte: "#0a1f1c",
      texte: "#ffffff",
      doux: "#93c6c1",
      accent: "#00ffd5",
      accentTexte: "#021715",
      bordure: "rgba(255,255,255,.10)"
    },
    "prune": {
      nom: "Prune",
      fond: "#0f0613",
      carte: "#1b0e20",
      texte: "#ffffff",
      doux: "#b8a2c4",
      accent: "#b14fff",
      accentTexte: "#160822",
      bordure: "rgba(255,255,255,.10)"
    },
    "cuivre": {
      nom: "Cuivre",
      fond: "#140b06",
      carte: "#22150e",
      texte: "#fff9f4",
      doux: "#cfb0a0",
      accent: "#ff9a3d",
      accentTexte: "#1d0f05",
      bordure: "rgba(255,255,255,.10)"
    },
    "bleu-glace": {
      nom: "Bleu glace",
      fond: "#061018",
      carte: "#0d1c28",
      texte: "#ffffff",
      doux: "#9db8c7",
      accent: "#3ddbff",
      accentTexte: "#04141d",
      bordure: "rgba(255,255,255,.10)"
    },
    "vert-jade": {
      nom: "Vert jade",
      fond: "#04120c",
      carte: "#0a1e15",
      texte: "#ffffff",
      doux: "#96c7b2",
      accent: "#00e676",
      accentTexte: "#03170f",
      bordure: "rgba(255,255,255,.10)"
    },
    "rose-bonbon": {
      nom: "Rose bonbon",
      fond: "#140611",
      carte: "#220f1d",
      texte: "#ffffff",
      doux: "#ca9dbd",
      accent: "#ff69b4",
      accentTexte: "#1d0617",
      bordure: "rgba(255,255,255,.10)"
    },
    "laser": {
      nom: "Laser",
      fond: "#0a0412",
      carte: "#150a1f",
      texte: "#ffffff",
      doux: "#a89dc4",
      accent: "#ff00ff",
      accentTexte: "#100520",
      bordure: "rgba(255,255,255,.10)"
    },
    "ultra-violet": {
      nom: "Ultra violet",
      fond: "#080414",
      carte: "#120b22",
      texte: "#ffffff",
      doux: "#a49dc9",
      accent: "#8b00ff",
      accentTexte: "#0d051d",
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
  ,

  /* -------------------------------------------------------
     LIVRAISON — frais et seuil
     ------------------------------------------------------- */
  livraison: {
    frais: 10 ,
    gratuiteAPartirDe: 100
  }
};
