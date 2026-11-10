# CORNER69 — Guide d'utilisation

Boutique en ligne prête à personnaliser. Ce guide explique **pas à pas** comment
mettre votre logo, vos photos de produits, votre musique, et comment gérer les
commandes de vos clients.

Aucune connaissance technique n'est nécessaire. Tout se fait depuis le site
GitHub, avec des clics.

---

## Sommaire

1. [Les 4 fichiers à déposer](#1-les-4-fichiers-à-déposer)
2. [Mettre votre logo](#2-mettre-votre-logo)
3. [Mettre les photos de vos produits](#3-mettre-les-photos-de-vos-produits)
4. [Mettre une vidéo sur un produit](#4-mettre-une-vidéo-sur-un-produit)
5. [Mettre votre musique](#5-mettre-votre-musique)
6. [Gérer le suivi des commandes](#6-gérer-le-suivi-des-commandes)
7. [Changer les couleurs](#7-changer-les-couleurs)
8. [Recevoir les commandes sur Telegram](#8-recevoir-les-commandes-sur-telegram)
9. [Modifier les produits et les prix](#9-modifier-les-produits-et-les-prix)
10. [Questions fréquentes](#10-questions-fréquentes)

---

## 1. Les 4 fichiers à déposer

Votre site attend quatre choses. Tant qu'elles ne sont pas là, il fonctionne
quand même — mais avec des remplacements.

| Ce que vous déposez | Nom exact | Où | Ce qui se passe si absent |
|---|---|---|---|
| Votre logo | `logo.png` | racine | Le texte CORNER69 s'affiche |
| Une image de fond | `bg.jpg` | racine | Fond noir uni |
| Votre musique | `ambiance.m4a` | racine | Pas de son |
| Vos photos produits | dans `media/` | dossier media | Emplacement vide |

### Comment déposer un fichier sur GitHub

La manipulation est toujours la même :

1. Ouvrez **https://github.com/patrikar961/corner69-boutique**
2. Cliquez sur le bouton **Add file** (en haut à droite)
3. Choisissez **Upload files**
4. **Glissez votre fichier** dans la zone, ou cliquez pour le choisir
5. En bas de page, cliquez sur le bouton vert **Commit changes**

C'est fini. Le site se met à jour tout seul dans la minute.

> **Le nom compte.** Le site cherche des noms exacts : `logo.png`, `bg.jpg`,
> `ambiance.m4a`. Si votre fichier s'appelle `Logo Final.png`, **renommez-le
> avant de le déposer**. Sur GitHub, les majuscules et les minuscules sont
> différentes : `bg.jpg` et `bg.JPG` ne sont pas le même fichier.

---

## 2. Mettre votre logo

Votre logo apparaît **au centre de la page d'accueil**, au-dessus du titre.
Il arrive en tournant sur lui-même et s'illumine — l'effet est déjà en place,
vous n'avez rien à régler.

### Marche à suivre

1. Renommez votre image en **`logo.png`**
2. Déposez-la à la racine du dépôt (voir section 1)

C'est tout. Le texte CORNER69 disparaît automatiquement et votre logo prend
sa place, avec le même effet d'animation.

### Conseils pour un beau logo

- **Format carré** ou légèrement rectangulaire : c'est ce qui rend le mieux
- **Taille** : entre 400 × 400 et 1000 × 1000 pixels
- **Poids** : moins de 500 Ko, pour que le site reste rapide
- **Fond** : évitez le blanc pur, préférez le noir ou transparent

Si votre logo fait plus de 500 Ko, ouvrez-le dans n'importe quel outil d'image
et réduisez ses dimensions. L'effet sera identique, le site plus rapide.

---

## 3. Mettre les photos de vos produits

Chaque produit peut avoir **une ou deux photos**, ou plus si vous voulez.
Elles défilent dans un carrousel sur la fiche du produit.

### Étape 1 — déposer les photos

1. Ouvrez le dépôt, cliquez sur **Add file → Upload files**
2. Dans le champ du nom, **tapez `media/` avant le nom du fichier** :
   par exemple `media/p1-1.jpg`

   > Plus simple : créez d'abord le dossier. Sur la page du dépôt, cliquez sur
   > **Add file → Create new file**, tapez `media/photo.jpg` dans le nom, et
   > validez. Le dossier est créé. Ensuite, les envois normaux le proposeront.

3. Nommez vos photos selon le produit :

| Produit | Photo 1 | Photo 2 |
|---|---|---|
| Produit 1 — Café d'Éthiopie | `media/p1-1.jpg` | `media/p1-2.jpg` |
| Produit 2 — Espresso maison | `media/p2-1.jpg` | `media/p2-2.jpg` |
| Produit 3 — Thé Sencha | `media/p3-1.jpg` | `media/p3-2.jpg` |
| Produit 4 — Mug | `media/p4-1.jpg` | `media/p4-2.jpg` |
| Produit 5 — Coffret | `media/p5-1.jpg` | `media/p5-2.jpg` |

Vous pouvez mettre `.jpg`, `.png` ou `.webp` — mais alors il faudra aussi
changer le nom dans `config.js` (section 9).

### Étape 2 — vérifier

Ouvrez votre site, cliquez sur un produit. Le carrousel s'affiche avec vos
photos, les points de navigation en dessous et les deux flèches.

Vous pouvez :
- **Faire glisser** la bande avec le doigt ou la souris
- **Cliquer sur les points** pour aller à une photo précise
- **Cliquer sur les flèches** ← et → pour passer d'une photo à l'autre

### Conseils pour des belles photos

- **Format** : paysage (plus large que haut), idéalement 4:3
- **Taille** : 800 × 600 à 1600 × 1200 pixels
- **Poids** : moins de 300 Ko par photo
- **Cohérence** : toutes vos photos dans le même style font plus professionnel

---

## 4. Mettre une vidéo sur un produit

Une vidéo est possible, sur autant de produits que vous voulez.

### Déposer la vidéo

Déposez votre fichier dans `media/` comme une photo, par exemple
`media/p1.mp4`.

> **Attention au poids.** Une vidéo de 30 secondes peut peser 20 Mo, ce qui
> ralentit beaucoup le site. Restez sous **5 Mo**, en format `.mp4` et en
> définition 720p. Si votre vidéo est plus lourde, compressez-la d'abord —
> il existe des outils gratuits en ligne pour ça.

### L'afficher dans le carrousel

La vidéo doit être déclarée dans `config.js` (section 9). Ouvrez ce fichier,
trouvez le produit, et ajoutez une ligne dans `medias` :

```js
medias: [
  { type: "image", src: "media/p1-1.jpg", alt: "Sachet de café" },
  { type: "video", src: "media/p1.mp4" }        // ← votre vidéo ici
]
```

La vidéo apparaît comme un élément du carrousel, après les photos. Le visiteur
peut la lancer avec le bouton de lecture, et la mettre en pause.

---

## 5. Mettre votre musique

Le site joue une musique de fond, **très discrète** (5 % du volume) et
**une seule fois** — elle ne tourne pas en boucle.

### Marche à suivre

1. Renommez votre fichier en **`ambiance.m4a`**
2. Déposez-le à la racine du dépôt

Si vous n'avez qu'un fichier `.mp3`, renommez-le `ambiance.mp3` — le site
essaie les deux formats, l'un après l'autre.

### Ce qu'il faut savoir sur le son

- La musique **ne démarre jamais toute seule**. Le visiteur doit cliquer
  une fois sur la page — c'est une règle des navigateurs, impossible à
  contourner.
- Elle **se coupe** quand le visiteur va sur un autre onglet, et **reprend**
  quand il revient.
- Une fois terminée, elle **ne se relance pas**. Le visiteur aura l'ambiance
  une fois.

### Changer le volume

Ouvrez `config.js`, section `son` :

```js
son: {
  volume: 0.05,     // 0.05 = à peine perceptible
  ...
}
```

Remplacez `0.05` par la valeur voulue :

| Valeur | Effet |
|---|---|
| `0` | Muet |
| `0.05` | À peine perceptible — valeur actuelle |
| `0.15` | Discret |
| `0.3` | Présent |
| `0.5` | Bien audible |

Gagnez du temps : **éditez directement sur GitHub**. Cliquez sur `config.js`,
puis sur l'icône crayon en haut à droite, changez la valeur, et
**Commit changes**.

> **Musique libre de droits obligatoire.** Une musique sous copyright sur un
> site public peut vous valoir des poursuites. Cherchez « musique libre de
> droits » ou « royalty free music ».

---

## 6. Gérer le suivi des commandes

Quand un client commande, sa commande arrive en cinq étapes. Vous les faites
avancer une par une.

### Les cinq étapes

```
1. Commande reçue        ⏳
2. En préparation        🚀
3. En tournée de livraison 🛵
4. En route vers vous    🎯
5. Livrée                ✅
```

### Où se passe la gestion

Sur une **page réservée**, que vos clients ne voient jamais. Elle n'est pas
dans le menu du bas, il faut taper son adresse.

**L'adresse** : ajoutez `#/gestion` à la fin de l'adresse de votre site.

Par exemple :
```
https://patrikar961.github.io/corner69-boutique/#/gestion
```

### Le mot de passe

À l'ouverture, la page demande un mot de passe. Par défaut :

```
corner69
```

**Changez-le avant de vendre un site.** Ouvrez `config.js`, cherchez
`adminMotDePasse`, et remplacez la valeur :

```js
adminMotDePasse: "VotreMotDePasseSecret",
```

### Faire avancer une commande

Une fois déverrouillée, la page affiche la commande en cours, avec son numéro
et son étape. Deux boutons :

- **Avancer →** fait passer à l'étape suivante
- **← Reculer** revient à l'étape précédente, en cas d'erreur

Le client voit le changement **immédiatement** dans son suivi, et la jauge
de progression se met à jour.

### Ce que voit le client

Sur la page **Suivi**, votre client voit :

- Un **anneau de progression** avec le numéro de l'étape (par exemple `3/5`)
- La **référence de sa commande**
- Le **statut en cours** avec son icône
- La **chronologie complète** des cinq étapes, celles passées cochées,
  celle en cours entourée
- Le **récapitulatif** : articles, adresse de livraison, total payé

Et sur toutes les pages, une **carte de suivi** flottante en haut rappelle
la commande en cours et son avancement.

### Un bouton de démonstration

Sur la page Suivi, un bouton « Faire avancer la commande → » permet de
montrer le fonctionnement à un client sans passer par la page de gestion.
**Dites-lui de ne pas l'utiliser une fois le site en service** — c'est
prévu pour la démonstration.

### La limite à connaître

Le suivi **ne partage pas les commandes entre appareils**. Une commande
passée sur le téléphone d'un client n'apparaîtra pas sur le vôtre.

**Pourquoi ?** Le site n'a pas de base de données. Tout est enregistré dans
le navigateur du visiteur. C'est parfait pour une démonstration, mais pour
un vrai commerce il faut une base de données — la marche à suivre complète
est dans le README technique.

**En pratique** : testez la commande sur votre propre navigateur, puis
gérez l'avancement dessus. Vos clients, eux, voient leur propre suivi évoluer
si vous leur donnez l'avancement — ou plus simplement, si vous activez les
notifications Telegram (section 8).

---

## 7. Changer les couleurs

Deux façons de faire.

### Depuis le site (le plus simple)

1. Allez sur `#/gestion`
2. Entrez le mot de passe
3. Dans **Palettes**, cliquez sur un thème : le site entier change
   instantanément de couleurs

Six thèmes sont proposés : Nuit acide, Bleu nuit, Terracotta, Forêt, Sable,
Bordeaux.

Pour ajuster finement, utilisez les **sélecteurs de couleur** en dessous :
fond, cartes, texte, accent. Cliquez sur un carré de couleur, choisissez-en
une — le site se met à jour en direct.

Cliquez sur **Enregistrer le thème** pour le conserver.

### Pour tous les visiteurs

Le réglage précédent ne s'applique qu'à **votre** navigateur. Pour que vos
visiteurs voient le même thème, ouvrez `config.js`, section `palettes`, et
reportez les valeurs du thème choisi dans la section `theme` :

```js
theme: "nuit-acide",     // remplacez par le nom du thème voulu
```

---

## 8. Recevoir les commandes sur Telegram

Optionnel, mais pratique : chaque nouvelle commande vous est annoncée sur
votre téléphone, avec le nom du client, son adresse et le total.

### Créer votre bot

1. Dans Telegram, cherchez **@BotFather**
2. Envoyez-lui `/newbot`
3. Il vous demande un nom, puis un identifiant terminant par `bot`
4. Il vous donne une longue chaîne du genre `7123456789:AAH...` — **c'est votre jeton**

### Trouver votre identifiant

1. Cherchez votre bot dans Telegram et envoyez-lui un message : `bonjour`
2. Ouvrez cette adresse dans votre navigateur, en remplaçant le jeton :
   `https://api.telegram.org/bot<votre-jeton>/getUpdates`
3. Cherchez `"chat":{"id":` — le nombre qui suit est **votre identifiant**

### Brancher le site

Ouvrez `config.js`, section `telegram` :

```js
telegram: {
  jeton: "7123456789:AAH...",     // le jeton de BotFather
  discussion: "123456789"          // votre identifiant
}
```

Validez. À la prochaine commande, vous recevez le message.

> **Sécurité** : ce jeton est visible par qui lit le code du site. Il permet
> d'envoyer des messages, pas de lire vos conversations. Si vous constatez
> des envois indésirables, demandez un nouveau jeton à BotFather.

---

## 9. Modifier les produits et les prix

Tout le catalogue est dans **`config.js`**. Ouvrez ce fichier sur GitHub
(cliquez dessus, puis sur le crayon), et modifiez.

### Un produit, ligne par ligne

```js
{
  id: "p1",                                    // identifiant unique, ne pas réutiliser
  nom: "Café de spécialité — Éthiopie",        // le nom affiché
  rayon: "Cafés",                              // la catégorie
  format: "250 g",                             // le format
  prix: 14.50,                                 // le prix, avec un point
  stock: "disponible",                         // ou "rupture"
  badge: "",                                   // ou "Nouveau", "Limité"
  description: "Grains lavés, notes florales.",
  medias: [
    { type: "image", src: "media/p1-1.jpg", alt: "Sachet de café" },
    { type: "image", src: "media/p1-2.jpg", alt: "Grains" }
  ]
}
```

**Pour ajouter un produit** : copiez tout un bloc `{ ... }`, collez-le juste
après, et changez au minimum l'`id` (par exemple `p6`). Le reste peut être
modifié ensuite.

**Pour retirer un produit** : supprimez le bloc entier, de l'accolade
ouvrante à l'accolade fermante, sans oublier la virgule qui suit.

### Les autres réglages de config.js

| Réglage | Ce qu'il fait |
|---|---|
| `zone.departements` | Les départements livrés. `["69"]` = Rhône uniquement |
| `livraison.frais` | Les frais de port (3.90 = 3,90 €) |
| `livraison.gratuiteAPartirDe` | Le seuil de livraison offerte |
| `etapes` | Les cinq étapes du suivi, leurs noms et leurs icônes |
| `son.volume` | Le volume de la musique |

> **Toujours vérifier après modification** : ouvrez votre site et
> rafraîchissez avec **Ctrl + Maj + R** (Cmd + Maj + R sur Mac). Si quelque
> chose ne s'affiche plus, c'est qu'une virgule ou un guillemet manque.
> Recopiez le fichier depuis cette page et recommencez.

---

## 10. Questions fréquentes

**Mon changement ne s'affiche pas.**
Le navigateur garde les anciennes versions. Forcez avec **Ctrl + Maj + R**,
ou ouvrez le site en **navigation privée**.

**J'ai déposé mon logo mais il ne s'affiche pas.**
Vérifiez trois choses : le nom exact est `logo.png` (minuscules), le fichier
est à la racine du dépôt (pas dans un sous-dossier), et vous avez bien cliqué
sur **Commit changes**.

**Mes photos produits ne s'affichent pas.**
Vérifiez que les noms dans `config.js` correspondent exactement aux fichiers
déposés, y compris le dossier `media/`. `media/p1-1.jpg` et `P1-1.jpg` ne
sont pas la même chose.

**Comment savoir si une commande est passée ?**
Activez Telegram (section 8) : vous serez prévenu à chaque commande. Sans
Telegram, la commande n'existe que dans le navigateur du client.

**Le mot de passe de gestion ne marche pas.**
Il est sensible aux majuscules : `Corner69` n'est pas `corner69`. Vérifiez
la valeur dans `config.js`.

**Puis-je mettre plus de 2 photos par produit ?**
Oui, autant que vous voulez. Ajoutez simplement d'autres lignes dans `medias`.

**Le site peut-il vendre pour de vrai ?**
En l'état, non : aucun paiement n'est réel, et les commandes ne sont pas
partagées entre appareils. Pour du vrai commerce, il faut une base de données
et un système de paiement. Un second guide technique explique comment
brancher Supabase.

---

## Récapitulatif — les noms de fichiers

```
corner69-boutique/
├── index.html          la page (ne pas modifier)
├── style.css           l'apparence (ne pas modifier)
├── app.js              le fonctionnement (ne pas modifier)
├── config.js           ← VOS RÉGLAGES ICI
├── logo.png            ← VOTRE LOGO
├── bg.jpg              ← VOTRE IMAGE DE FOND
├── ambiance.m4a        ← VOTRE MUSIQUE
└── media/
    ├── p1-1.jpg        ← VOS PHOTOS PRODUITS
    ├── p1-2.jpg
    ├── p2-1.jpg
    └── ...
```

---

*© 2026 CORNER69 — Guide d'utilisation.*
