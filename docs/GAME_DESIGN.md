# Game Design – PixelQuest

Document de référence pour le balancement et les règles. Toute valeur
est aussi présente en code (`Config.kt`, `engine.js`).

## Économie des pas

| Source                 | Récompense                                  |
|------------------------|---------------------------------------------|
| 1 pas                  | 1 XP, 0.05 🪙 (5 pour 100)                  |
| Seuil 8 000 pas/jour   | XP doublée pour le reste de la journée      |
| Météo Soleil           | × 1.05 XP                                   |
| Météo Pluie            | × 0.95 XP, × 1.10 🪙                        |
| Météo Orage            | × 1.15 XP, × 0.90 🪙                        |
| Météo Neige            | XP normale, × 1.05 🪙                       |
| Météo Brume            | × 1.10 XP                                   |
| Classe Rôdeur          | + 5 % 🪙                                    |
| Familier Foxy (éclos)  | + 2 % XP                                    |
| Familier Slimon (éclos)| + 1 🪙 / 100 pas                            |

## Courbe XP

`xpForLevel(N) = floor(100 × 1.18^(N-1))`. Donc :

| Niveau | XP requis pour passer | XP cumulé |
|--------|------------------------|-----------|
| 1→2    | 100                    | 0         |
| 2→3    | 118                    | 100       |
| 5→6    | 194                    | 540       |
| 10→11  | 446                    | 1 988     |
| 20→25  | environ × 5,2          | ~ 10 800  |
| 50→51  | 433 600                | ~ 1.79 M  |

Le cap interne est 999 (jamais censé être atteint).

## Encombrement

- `inventoryWeight = sum(qty)`.
- Soft cap : 25 → malus actif (110/100).
- Hard cap : 40 → impossible de ramasser ou acheter.

Le malus signifie qu'à inventaire saturé, **110 pas réels donnent
seulement l'équivalent d'XP de 100 pas effectifs** (et idem pour les
pièces). C'est ce qui pousse à la gestion d'inventaire et au passage
régulier à la Taverne.

## Anti-triche

Trois critères :

1. **Burst** : refuser tout lot > 500 pas en un seul appel.
2. **Cadence par minute** : > 220 pas/min sur fenêtre glissante 60 s.
3. **Cadence par seconde** : > 25 pas/s sur fenêtre 1 s.

Quand un critère est touché, on log un `CheatFlag` et on tronque
l'apport à ce qui aurait été possible humainement. On NE rejette pas
totalement, pour ne pas pénaliser un capteur à dérive.

## Boss hebdomadaire

- Génération déterministe à partir de la `weekKey` ISO.
- Trois boss en rotation : Dragon de Fer (75k), Liche (90k), Kraken (110k).
- 1 pas = 1 dégât.
- Vaincre avant `dimanche 23:59 UTC` → arme unique du boss
  (`epee_titan`, `sceptre_obscur`, `trident_dunes`).
- Achievement `tueur_boss` débloqué au premier kill.

## Familiers

- Achetés sous forme d'œuf (250 🪙). 1 seul œuf en couvée à la fois.
- Espèce déterministe selon le hash du moment d'achat.
- Éclosion en marchant : 3 000 → 20 000 pas selon la rareté.
- Trait d'éclos appliqué pour toute la suite du jeu.

## PNJ et quêtes

| PNJ               | Position carte | Spécialité                |
|-------------------|----------------|---------------------------|
| Hilda Taverniere  | (4,4)          | Tutoriels, marche courte  |
| Brom Forgeron     | (2,6)          | Quêtes de chasse          |
| Mira Sage         | (6,2)          | Pèlerinages, bonus seuil  |
| Pip Éleveur       | (7,7)          | Familiers                 |

## Achievements

`premiers_pas`, `marathonien`, `niveau_10`, `niveau_25`,
`collectionneur`, `eleveur`, `tueur_boss`, `riche`, `huit_mille`.

## Easter eggs

- **Konami** dans la preview web : ↑↑↓↓←→←→BA → +1000 🪙.
- Hilda mentionne « le ciel pleut des pièces au-delà de 10 000 pas » —
  ce n'est pas un mensonge, le bonus journalier explose ta croissance
  d'or à ce stade.
