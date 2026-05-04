# PixelQuest – RPG Pixel des Pas

Une appli de sport personnelle, RPG-pixel, pour **téléphone Android + Wear OS**, avec :

- 🎮 Création de personnage (classe, coiffure, peau, cheveux, nom)
- 👣 1 pas = 1 XP de base, **bonus x2 à partir de 8 000 pas/jour**
- 🪙 Pièces (5 / 100 pas) avec boutique aux prix équilibrés
- 🤝 4 PNJ donneurs de quêtes, dialogues et easter eggs (Konami)
- ⚔️ Quêtes de marche, de chasse, d'éclosion ; courbe d'XP exponentielle (×1.18)
- 🛡️ Anti-triche : caps de cadence, détection de bursts, journalisation
- 🎒 Encombrement : 110 pas pour 100 XP si inventaire saturé → on doit
  passer à la Taverne
- 🐉 **Raid hebdomadaire** : Boss à 75 000 PV (Dragon de Fer / Liche /
  Kraken). Chaque pas = 1 dégât. Vaincu avant dimanche soir = arme
  unique
- 🥚 Système d'incubation de familiers (Slimon, Foxy, Griffon, Pixiel)
- 🦂 Bestiaire avec slime, gobelin, loup, golem
- 🌦️ Cycle météo (5 types, modifie XP/pièces) + saisons dynamiques
- 🏆 9 succès, événements saisonniers
- 🗺️ Carte du monde 9×9 traversée en marchant (50 pas = 1 tuile)
- 🔄 Sync **Phone ↔ Wear OS** via Wearable Data Layer
- 🎨 Sprites pixel art **générés en code** (zéro asset binaire)
- 🛠️ **Debugger auto-correctif** : invariants + auto-fix runtime + tests CI

## Tester tout de suite (sans Android Studio)

La prévisualisation web reproduit fidèlement le téléphone et la montre
côte à côte avec toute la logique de jeu. Elle marche dans n'importe
quel navigateur récent, **y compris Chrome sur ton Android**.

```bash
bash scripts/serve.sh
# puis ouvre http://localhost:8080/
# (ou http://<ip-du-pc>:8080/ depuis ton téléphone connecté au même Wi-Fi)
```

Tu obtiens :

- À gauche : maquette téléphone (8 onglets : Carte, Quêtes, Boutique,
  Bestiaire, Familiers, Raid, Personnage, Succès)
- Au centre : maquette montre Wear OS (4 vues : Profil, Quête, Raid,
  Familier)
- À droite : panneau debug + bouton « Lancer tests » + « Auto-fix »
- Boutons en haut pour simuler des pas (10–500 par lot, ou tick auto
  toutes les 5 s)

L'état est persisté dans le `localStorage` du navigateur. Le bouton
**Réinitialiser** repart de zéro.

### Easter egg

Tape la séquence Konami au clavier (↑ ↑ ↓ ↓ ← → ← → B A) → +1000 🪙.

## Lancer la batterie de tests

```bash
bash scripts/debug-loop.sh
```

Vérifie en parallèle :

- les **tests fonctionnels JS** de la preview (11 tests : courbe XP,
  anti-triche, doublement, encombrement, achat/vente, raid, quêtes…)
- les **invariants** sur l'état neuf (15 contrôles)
- les **tests JUnit** du module Kotlin partagé (le moteur de prod)

## Build Android

Le projet Gradle est dans `android/` et comporte trois modules :

| Module      | Rôle                                                             |
|-------------|------------------------------------------------------------------|
| `:shared`   | Logique de jeu pure (Kotlin/JVM, testable). Source de vérité     |
| `:phone`    | App téléphone Jetpack Compose Material 3                         |
| `:wear`     | App Wear OS Compose                                              |

Pré-requis : **Android Studio Hedgehog ou plus**, **JDK 17+**, **Android
SDK 34**, et brancher le SDK Android dans `local.properties`
(`sdk.dir=/chemin/vers/Android/Sdk`).

```bash
cd android
./gradlew :shared:test       # ✅ déjà vérifié dans la VM
./gradlew :phone:assembleDebug
./gradlew :wear:assembleDebug
```

À ouvrir dans Android Studio : `File > Open > android/`. Configurer un
émulateur **téléphone** et un émulateur **Wear OS**, les apparier
(Companion App), puis Run. La synchro Phone ↔ Wear se fait via la
Wearable Data Layer (path `/pixelquest/state`).

### Pas réels (capteurs)

L'intégration capteur est prête côté manifests :

- Phone : `ACTIVITY_RECOGNITION` + `Sensor.TYPE_STEP_COUNTER`
- Wear : `BODY_SENSORS` + Health Services Client

Il reste à brancher le `StepCounterService` à `vm.ingestSteps(n)` dans
ton parcours d'initialisation. Comme `GameEngine.validateSteps`
applique l'anti-triche en amont, tu peux nourrir le moteur sans crainte.

## Architecture

```
preview/                ← Démo web fonctionnelle (offline-capable)
  index.html
  css/styles.css
  js/
    engine.js           ← moteur de jeu (1:1 avec Kotlin shared)
    sprites.js          ← générateur pixel art procédural
    sync.js             ← bus de sync Phone↔Watch (preview)
    tests.js            ← harnais tests + auto-fix
    ui.js               ← UI (téléphone + montre + debug)
android/
  shared/               ← moteur Kotlin commun
    src/main/kotlin/com/pixelquest/shared/
      Config.kt         ← constantes de game design
      Catalog.kt        ← données (classes, NPC, monstres, items, pets…)
      PlayerState.kt    ← modèle d'état (sérialisable)
      GameEngine.kt     ← logique (XP, raid, quêtes, fight, shop)
      Invariants.kt     ← debugger auto-correctif
    src/test/           ← 19 tests JUnit, 100 % verts
  phone/                ← App téléphone (Compose Material 3)
  wear/                 ← App Wear OS (Compose Wear)
scripts/
  serve.sh              ← lance la preview web
  debug-loop.sh         ← pipeline de tests + auto-fix
```

## Le « debugger auto-correctif »

Trois étages :

1. **Invariants runtime** (`Invariants.autoFix`) : appelé après chaque
   mutation et après chaque chargement disque. Si l'état est corrompu
   (xp négatif, niveau 0, inventaire au-delà du cap, météo inconnue,
   doublons de quêtes…), il est automatiquement réparé sans perte de
   progression légitime.
2. **Tests fonctionnels** (Kotlin + JS) : 26 cas qui couvrent les
   formules, l'anti-triche, l'économie, la météo, le raid, les quêtes,
   les achievements.
3. **Pipeline de debug** (`scripts/debug-loop.sh`) : à brancher en
   pré-commit ou en CI. Renvoie un code 0/1 et un diagnostic compact.

Si tu veux que l'agent (Cursor/Claude) corrige des bugs automatiquement
en boucle, exécute `scripts/debug-loop.sh` et nourris-lui la sortie :
les noms d'invariants ratés et les noms de tests cassés sont stables,
nommés explicitement (`xp_curve_growth`, `antifraud_burst`, …) ce qui
permet une boucle de réparation.

## Game design – chiffres clés

| Paramètre                       | Valeur     |
|---------------------------------|------------|
| XP par pas (base)               | 1          |
| Courbe XP                       | 100 × 1.18^(N-1) |
| Pièces / 100 pas                | 5          |
| Seuil bonus journalier          | 8 000 pas  |
| Multiplicateur seuil            | × 2.0      |
| Cap doux inventaire             | 25 objets  |
| Cap dur inventaire              | 40 objets  |
| Malus encombrement              | × 1.10     |
| Cap cadence anti-triche         | 220 pas/min|
| Burst suspect                   | > 500 pas/coup |
| PV boss hebdo (base)            | 75 000     |

Tous ces nombres sont centralisés dans `Config.kt` / `engine.js`.
