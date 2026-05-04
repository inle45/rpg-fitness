# Architecture

## Vue d'ensemble

```
┌────────────────────────────────────────────────────────────────────┐
│                      Module Kotlin "shared"                         │
│  ┌──────────────┐ ┌────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ Config.kt    │ │ Catalog.kt │ │ GameEngine.kt│ │ Invariants.kt│ │
│  └──────────────┘ └────────────┘ └──────────────┘ └──────────────┘ │
│        │                │                │                  │      │
│  ┌─────┴────────────────┴────────────────┴──────────────────┴────┐ │
│  │                    PlayerState (sérialisable JSON)             │ │
│  └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
         ▲                                                ▲
         │                                                │
┌────────┴───────────┐                          ┌─────────┴─────────┐
│   Module :phone    │                          │   Module :wear    │
│ (Compose Material3)│ ◄──── Wearable ────────► │ (Wear Compose)    │
│ AndroidStateRepo   │     Data Layer API       │ WearSync          │
│ WearSyncBridge     │   (/pixelquest/state)    │                   │
└────────────────────┘                          └───────────────────┘
```

Le module `shared` contient TOUTE la logique de jeu. Les modules `phone`
et `wear` ne font qu'afficher l'état et déclencher des mutations.

## Sync Phone ↔ Wear OS

Approche : un seul `DataItem` JSON sur le path `/pixelquest/state`.

- À chaque mutation (côté qui agit), on sérialise `PlayerState` et on
  pousse via `Wearable.getDataClient(ctx).putDataItem(...)` en mode
  `setUrgent()`.
- L'autre côté reçoit via `OnDataChangedListener`, désérialise,
  applique `Invariants.autoFix`, et met à jour son UI.
- Le **dernier writer gagne**. C'est volontaire : pour cet usage solo,
  les divergences sont rares et la simplicité prime.

> Si plus tard tu veux une vraie résolution de conflit, ajoute un
> compteur `lifetimeSteps` ; le state avec le `lifetimeSteps` le plus
> élevé gagne (toujours croissant, donc monotone).

## Persistance

- Phone : SharedPreferences clé `state` → JSON brut. Charge ↔
  désérialise ↔ `Invariants.autoFix`.
- Wear : à brancher sur le même mécanisme (DataStore Preferences
  recommandé).
- Preview JS : `localStorage.pixelquest_state_v1`.

## Capteurs

- **Phone** : `Sensor.TYPE_STEP_COUNTER` (déjà déclaré dans
  l'AndroidManifest), valeur cumulative depuis le boot. À chaque tick
  on calcule `delta` puis on appelle `vm.ingestSteps(delta)`.
- **Wear** : `androidx.health.services.client` + `DataType.STEPS_DAILY`.
  Permet de remonter les pas même hors-app.

## Cycle de vie d'un pas (parcours complet)

1. Capteur émet `n` pas.
2. `GameViewModel.ingestSteps(n)`.
3. → `GameEngine.ingestSteps(state, n, now)` :
   - `validateSteps` (anti-triche)
   - rotation jour/semaine/météo si nécessaire
   - calcul XP + pièces (avec multiplicateurs météo, classe, pet)
   - mise à jour quêtes, raid, œuf, carte
   - `refreshAchievements`
4. → `Invariants.autoFix(state)` (filet de sécurité).
5. → `repo.save(state)` (persiste).
6. → `sync.publish(state)` (DataLayer).
7. → recompose Compose, montre rerender.

## Génération pixel art

- Preview : pure Canvas 2D, dessin par grille de caractères + palette
  (cf. `js/sprites.js`). Aucun asset binaire.
- Android : à porter en `androidx.compose.ui.graphics.Canvas` avec la
  même grille (la donnée est triviale à embarquer comme `String[]`).

## Tests & boucle auto-correctif

- `Invariants.autoFix` corrige l'état corrompu sans intervention
  utilisateur.
- `scripts/debug-loop.sh` exécute toute la batterie de tests JS + JVM
  et retourne un statut machine-lisible.
- Pour Claude/un agent IA : le format de sortie de `debug-loop.sh`
  liste les noms de tests/invariants en échec, suffisant pour
  itérer.

## Conventions de code

- Aucun emoji dans le code source.
- Commentaires en français quand ils éclairent l'intention métier.
- Pas de logique métier dans les ViewModels ni dans les `@Composable` :
  tout passe par `GameEngine.*` afin d'être testé sur la JVM.
