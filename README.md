# CORNER69 Boutique — Guide d'installation et de mise en ligne

Ce document explique comment fonctionne le site, comment le mettre en ligne,
et surtout comment le brancher sur une vraie base de données avec Supabase
pour que les commandes, les avis et le panier soient partagés entre tous les
visiteurs.

---

## Sommaire

1. [Ce que fait le site aujourd'hui](#1-ce-que-fait-le-site-aujourdhui)
2. [La limite actuelle : tout vit dans le navigateur](#2-la-limite-actuelle--tout-vit-dans-le-navigateur)
3. [Pourquoi il faut un serveur et une base de données](#3-pourquoi-il-faut-un-serveur-et-une-base-de-donnees)
4. [Les options possibles](#4-les-options-possibles)
5. [Supabase pas à pas](#5-supabase-pas-à-pas)
6. [Le mot de passe et la sécurité](#6-le-mot-de-passe-et-la-securite)
7. [Le RGPD](#7-le-rgpd)
8. [Mettre le site en ligne](#8-mettre-le-site-en-ligne)
9. [Modifier le catalogue, les prix, les couleurs](#9-modifier-le-catalogue-les-prix-les-couleurs)
10. [Dépannage](#10-depannage)

---

## 1. Ce que fait le site aujourd'hui

Une boutique en ligne sur une seule page, sans installation :

| Écran | Ce qu'il fait |
|---|---|
| Accueil | Explique la démonstration en cinq points |
| Catalogue | Liste les produits, filtrable par rayon |
| Fiche produit | Description, format, choix de la quantité |
| Panier | Ajout, retrait, quantités, frais de livraison |
| Commande | Nom, téléphone, adresse, paiement simulé |
| Suivi | Chronologie en 5 étapes de la commande |
| Avis | Note en étoiles et commentaire |
| Infos | Horaires, livraison, contact, mentions |
| Réglages | Thèmes, couleurs, image de fond (protégé) |

Le code est du HTML, du CSS et du JavaScript simples. Aucun framework,
aucune dépendance extérieure, hormis deux polices chargées depuis Google Fonts.

---

## 2. La limite actuelle : tout vit dans le navigateur

C'est le point le plus important à comprendre avant de vendre ce site.

Les données du site — panier, commande, avis — sont stockées dans le
**`localStorage`** du navigateur, c'est-à-dire en local, sur l'appareil du
visiteur. Cela veut dire concrètement :

- **Rien n'est partagé.** Une commande passée sur un téléphone est invisible
  depuis un ordinateur.
- **L'admin ne voit que ses propres commandes.** Le bouton « Avancer » de
  l'espace Réglages ne fait progresser que la commande créée sur ce même
  navigateur. Une commande d'un client, jamais.
- **Les avis ne sont pas publics.** Chaque visiteur a sa propre liste.
- **Vider le cache efface tout.** Le navigateur peut supprimer ces données
  à tout moment.

C'est le comportement d'une **démonstration**, et il est parfaitement adapté
pour montrer le site à un client, faire tester l'interface, ou travailler le
design. Ce n'est pas une boutique qui vend.

---

## 3. Pourquoi il faut un serveur et une base de données

Pour qu'un panier suive un visiteur d'un appareil à l'autre, qu'un avis soit
lu par tous, et que l'admin pilote de vraies commandes, il faut que les
données vivent **ailleurs que dans le navigateur**. Cet endroit, c'est une
base de données, et il faut un service capable de la lire et de l'écrire :
un serveur.

Trois rôles distincts, souvent confondus :

**L'hébergement du site** — GitHub Pages, Netlify. Sert les fichiers (HTML,
CSS, JavaScript) au visiteur.

**Le serveur** — la partie qui exécute du code en dehors du navigateur, garde
les secrets, vérifie les droits. C'est ce qui manque aujourd'hui.

**La base de données** — l'endroit où vivent les commandes, les produits, les
avis. C'est ce qui permet le partage entre visiteurs.

---

## 4. Les options possibles

### Supabase — recommandé

Base de données Postgres hébergée, avec une API prête à l'emploi. On crée un
projet, on reçoit une adresse et une clé publique, et le site lit et écrit
dedans directement en JavaScript — sans écrire une seule ligne de serveur.

- Palier gratuit très large pour une boutique de quartier
- Sécurité gérée **dans la base**, pas dans la page
- Code source ouvert, données exportables à tout moment

C'est le meilleur rapport effort/résultat, et c'est l'option détaillée plus bas.

### Firebase — l'équivalent chez Google

Même principe, autre écosystème. Base temps réel très confortable (une
commande change à l'écran sans rafraîchir), authentification intégrée.
Un peu moins agréable pour interroger finement les données. À choisir si
l'on préfère rester chez Google.

### Cloudflare Workers ou Netlify Functions

On garde le site statique et on ajoute quelques fonctions côté serveur qui
parlent à une base. Palier gratuit généreux, déploiement en une commande.
Plus de contrôle, plus de travail : la base et la logique sont à gérer.

### Un backend classique — Node, Python, un serveur dédié

La solution complète, sans aucune limite, mais c'est un autre métier :
administrer la machine, gérer les mises à jour et la sécurité, prévoir les
sauvegardes. À réserver à un vrai déploiement commercial.

---

## 5. Supabase pas à pas

### 5.1 Créer le projet

1. Aller sur **supabase.com** et créer un compte.
2. **New project** : nom du projet, mot de passe de base de données (à
   conserver), région **Europe (Paris ou Frankfurt)** pour la latence et le RGPD.
3. Attendre une minute que la base soit prête.

### 5.2 Récupérer les clés

Dans **Project Settings → API**, deux valeurs à copier :

- **Project URL** — ressemble à `https://xxxxx.supabase.co`
- **anon public key** — une longue chaîne

> La clé `anon` est **publique par nature** : elle est faite pour être dans la
> page. Ce n'est pas elle qui protège les données, ce sont les règles de
> sécurité de la base (voir section 6). Ne jamais copier la clé
> `service_role`, qui elle donne tous les droits et ne doit jamais quitter
> le serveur.

### 5.3 Créer les tables

Dans **SQL Editor**, coller et exécuter :

```sql
-- Produits
create table produits (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  rayon       text not null,
  format      text,
  prix        numeric(10,2) not null,
  stock       text default 'disponible',
  badge       text,
  description text,
  ordre       int default 0,
  cree_le     timestamptz default now()
);

-- Commandes
create table commandes (
  id        uuid primary key default gen_random_uuid(),
  ref       text unique not null,
  nom       text not null,
  telephone text,
  adresse   text,
  cp        text,
  ville     text,
  articles  jsonb not null,
  total     numeric(10,2) not null,
  etape     int default 0,
  cree_le   timestamptz default now()
);

-- Avis
create table avis (
  id      uuid primary key default gen_random_uuid(),
  nom     text not null,
  note    int check (note between 1 and 5),
  texte   text not null,
  publie  boolean default false,
  cree_le timestamptz default now()
);

-- Réglages d'apparence
create table reglages (
  cle    text primary key,
  valeur jsonb
);
```

### 5.4 Activer la sécurité

**C'est l'étape qui compte.** Sans elle, la base est ouverte à tous en lecture
comme en écriture. Dans **SQL Editor**, exécuter :

```sql
-- On active la sécurité sur chaque table
alter table produits  enable row level security;
alter table commandes enable row level security;
alter table avis      enable row level security;
alter table reglages  enable row level security;

-- Tout le monde peut LIRE le catalogue et les réglages
create policy "lecture publique produits"
  on produits for select using (true);

create policy "lecture publique reglages"
  on reglages for select using (true);

-- Tout le monde peut lire les avis publiés
create policy "lecture avis publies"
  on avis for select using (publie = true);

-- Tout le monde peut DÉPOSER un avis, mais uniquement non publié
create policy "depot avis"
  on avis for insert with check (publie = false);

-- Tout le monde peut CRÉER une commande
create policy "creation commande"
  on commandes for insert with check (true);

-- Personne ne peut lire ni modifier une commande sans être admin
-- (on ajoutera la règle admin à la section 6)
```

Ces règles disent : le catalogue est public, les avis se déposent librement
mais ne s'affichent qu'après validation, et une commande peut être créée mais
pas relue. C'est le socle.

### 5.5 Brancher le site

Ajouter dans le `<head>` de `index.html` :

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

Puis, à la fin du `<body>`, un fichier de connexion avant `app.js` :

```html
<script src="supabase.js"></script>
<script src="config.js"></script>
<script src="app.js"></script>
```

Contenu de `supabase.js` :

```js
/* Connexion à la base. La clé anon est publique : c'est normal. */
var SUPABASE_URL  = 'https://xxxxx.supabase.co';
var SUPABASE_KEY  = 'votre-cle-anon-publique';

var db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
```

À partir de là, `app.js` remplace ses lectures du `localStorage` par des
appels à la base. Par exemple, charger le catalogue :

```js
async function chargerProduits() {
  const { data, error } = await db
    .from('produits')
    .select('*')
    .order('ordre');

  if (error) { console.error(error); return []; }
  return data;
}
```

Enregistrer une commande :

```js
async function envoyerCommande(commande) {
  const { error } = await db.from('commandes').insert(commande);
  if (error) { console.error(error); return false; }
  return true;
}
```

Faire avancer une commande depuis l'admin :

```js
async function avancerCommande(ref, nouvelleEtape) {
  const { error } = await db
    .from('commandes')
    .update({ etape: nouvelleEtape })
    .eq('ref', ref);
  return !error;
}
```

Et pour que l'admin voie la commande d'un client en temps réel :

```js
db.channel('commandes')
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'commandes' },
      () => rafraichirCommandes())
  .subscribe();
```

---

## 6. Le mot de passe et la sécurité

### Ce que le mot de passe actuel vaut vraiment

Le mot de passe de l'espace Réglages est écrit en clair dans `config.js` :

```js
adminMotDePasse: "corner69"
```

Comme ce fichier est public — il est téléchargé par le navigateur de chaque
visiteur — **n'importe qui peut le lire**. Ce mot de passe n'est donc qu'une
barrière visuelle, pas une protection. Il empêche un curieux de tomber sur
les réglages par hasard. Il n'arrête personne de déterminé.

**Règle absolue : ne jamais mettre dans ce fichier un secret qui donne accès
à quelque chose.** Pas de mot de passe de messagerie, pas de clé d'API
privée, pas de coordonnées bancaires.

### La bonne façon de faire avec Supabase

On ne compare plus le mot de passe dans la page : on demande à la base.
Supabase gère les comptes utilisateurs, et les règles de sécurité vérifient
l'identité côté serveur.

```sql
-- Seul un utilisateur authentifié peut lire et modifier les commandes
create policy "admin lit commandes"
  on commandes for select
  to authenticated using (true);

create policy "admin modifie commandes"
  on commandes for update
  to authenticated using (true);
```

Puis, à la connexion :

```js
const { error } = await db.auth.signInWithPassword({
  email: 'vous@exemple.fr',
  password: 'votre-mot-de-passe'
});
```

À partir de là, le mot de passe ne transite jamais en clair dans un fichier
public : il est vérifié par la base, et les règles décident de ce que le
compte a le droit de faire. C'est la différence entre une barrière décorative
et une vraie protection.

### Le principe à retenir

**Toute vérification faite dans la page est contournable.** Le navigateur
appartient au visiteur, il peut modifier ce qu'il reçoit. Une décision de
sécurité doit toujours être prise par le serveur ou la base.

---

## 7. Le RGPD

Dès l'instant où le site stocke des données personnelles — un nom, un
téléphone, une adresse de livraison — le Règlement général sur la protection
des données s'applique. Sur une démonstration locale, la question ne se pose
pas : rien ne quitte l'appareil. Sur un site en ligne avec une base, oui.

Les obligations principales, en clair :

**Informer.** Une page doit dire quelles données sont collectées, pourquoi,
combien de temps elles sont gardées, et comment demander leur suppression.
La page « Infos & mentions » est faite pour ça.

**Ne collecter que le nécessaire.** Un nom, une adresse et un téléphone pour
livrer : oui. La date de naissance ou le revenu : non, ça n'a aucune raison
d'être là.

**Limiter la durée.** Une commande se conserve le temps de la comptabilité
(dix ans en France), mais pas indéfiniment sans raison. Prévoir une purge.

**Permettre la suppression.** Un client doit pouvoir demander l'effacement de
ses données, et il faut pouvoir le faire.

**Sécuriser.** Les règles de sécurité Supabase de la section 5.4 répondent à
cette partie : aucune commande n'est lisible sans être authentifié.

**Choisir une région européenne.** À la création du projet Supabase, la
région Paris ou Frankfurt évite les transferts de données hors Union
européenne, qui demandent des précautions supplémentaires.

Il existe des modèles de mentions légales et de politique de confidentialité
adaptés aux petites boutiques. Si le site devient réellement commercial,
faire relire ces pages par un professionnel est un investissement qui évite
beaucoup d'ennuis.

---

## 8. Mettre le site en ligne

### GitHub Pages

1. Pousser les fichiers sur la branche `main` du dépôt.
2. **Settings → Pages**
3. Source : **Deploy from a branch** — branche **main** — dossier **/ (root)**
4. **Save**

Le site est en ligne une minute plus tard à l'adresse
`https://<votre-compte>.github.io/<nom-du-depot>/`.

### Netlify

1. **Add new site → Import an existing project**
2. Choisir le dépôt GitHub
3. Aucun réglage de build à remplir (site statique), laisser vide
4. **Deploy**

Netlify donne une adresse en `.netlify.app` et permet d'y brancher un nom de
domaine propre.

### Fichiers à déposer à la main

Deux fichiers ne peuvent pas passer par l'interface GitHub depuis ce chat,
car seuls les fichiers texte sont transmissibles :

- **`bg.jpg`** — l'image de fond, à la racine du dépôt
- **`ambiance.m4a`** (ou `.mp3`) — la musique de fond, à la racine

Dépôt : **Add file → Upload files**, glisser, valider.

---

## 9. Modifier le catalogue, les prix, les couleurs

Tout se règle dans **`config.js`**, jamais dans le HTML.

### Le catalogue

```js
produits: [
  {
    id: "p1",
    nom: "Café de spécialité — Éthiopie",
    rayon: "Cafés",
    format: "250 g",
    prix: 14.50,
    stock: "disponible",       // ou "rupture"
    badge: "",                 // "Nouveau", "Limité"…
    description: "Grains lavés, notes florales et fruitées."
  }
]
```

Ajouter un produit : copier un bloc, changer l'`id` (il doit être unique),
enregistrer.

### Les frais de livraison

```js
livraison: {
  frais: 3.90,
  gratuiteAPartirDe: 40
}
```

### Les cinq étapes de suivi

```js
etapes: [
  { cle: "attente",  label: "Commande reçue", emoji: "⏳", texte: "Nous avons bien reçu votre commande." },
  { cle: "preparee", label: "En préparation", emoji: "🚀", texte: "Votre commande est en cours de préparation." },
  { cle: "tournee",  label: "En tournée de livraison", emoji: "🛵", texte: "Votre commande a quitté la boutique." },
  { cle: "route",    label: "En route vers vous", emoji: "🎯", texte: "Le livreur arrive dans quelques minutes." },
  { cle: "livree",   label: "Livrée", emoji: "✅", texte: "Commande livrée. Merci !" }
]
```

Pour une boutique en click and collect, on peut réduire à trois étapes : il
suffit d'enlever deux lignes.

### Le son

```js
son: {
  volume: 0.05,   // 0 = muet · 0.05 = à peine perceptible · 0.3 = présent
  fichiers: ["ambiance.m4a", "ambiance.mp3"],
  actif: true
}
```

### Les thèmes

Deux endroits pour changer les couleurs :

**Depuis le site** — onglet Réglages, mot de passe, puis choisir une palette
parmi les six proposées et ajuster chaque couleur. Le résultat est enregistré
dans le navigateur.

**Pour de bon, pour tous les visiteurs** — recopier les valeurs dans la
section `palettes` de `config.js`. C'est cette version qui s'appliquera à
tout le monde.

---

## 10. Dépannage

**Le fond ne s'affiche pas.** Le fichier doit s'appeler exactement `bg.jpg`,
à la racine du dépôt. Vérifier la casse : `bg.JPG` et `bg.jpg` sont deux noms
différents.

**Le son ne démarre pas.** C'est normal avant le premier clic : aucun
navigateur n'autorise la lecture automatique. Vérifier aussi que le fichier
`ambiance.m4a` existe, et que le volume de l'appareil n'est pas à zéro.

**Les modifications ne s'affichent pas.** Le navigateur garde les anciens
fichiers en mémoire. Forcer avec **Ctrl + Maj + R** (Cmd + Maj + R sur Mac),
ou ouvrir le site en navigation privée.

**Le mot de passe admin ne fonctionne pas.** Il est sensible à la casse
(« Corner69 » n'est pas « corner69 »). Vérifier dans `config.js`.

**Un produit n'apparaît pas dans le catalogue.** Vérifier que son `id` est
unique et que le `rayon` est bien écrit.

---

## Résumé des étapes pour passer en production

1. Créer un projet Supabase, région Europe
2. Créer les quatre tables (section 5.3)
3. Activer la sécurité et poser les règles (section 5.4)
4. Créer un compte admin et le brancher sur les règles `authenticated`
5. Copier l'URL et la clé `anon` dans `supabase.js`
6. Remplacer les lectures du `localStorage` par les appels à la base
7. Déposer `bg.jpg` et `ambiance.m4a`
8. Activer GitHub Pages ou Netlify
9. Rédiger les mentions légales et la politique de confidentialité
10. Tester sur un téléphone et un ordinateur, avec deux navigateurs différents

---

*© 2026 CORNER69 — Site de démonstration.*
