package com.pixelquest.shared

/** Classes jouables. */
data class GameClass(
    val id: String,
    val name: String,
    val description: String,
    val sprite: String,
)

/** PNJ. */
data class Npc(
    val id: String,
    val name: String,
    val sprite: String,
    val bio: String,
    val dialogues: List<String>,
)

/** Monstres. */
data class Monster(
    val id: String,
    val name: String,
    val hp: Int,
    val xp: Int,
    val loot: List<String>,
    val tier: Int,
    val sprite: String,
)

/** Boss de raid. */
data class RaidBoss(
    val id: String,
    val name: String,
    val hp: Int,
    val reward: String,
)

/** Item de boutique / inventaire. */
data class ShopItem(
    val id: String,
    val name: String,
    val price: Int,
    val type: String,
    val description: String,
)

/** Familier. */
data class Pet(
    val id: String,
    val name: String,
    val hatchSteps: Int,
    val sprite: String,
    val trait: String,
)

/** Type de quête. */
enum class QuestType { WALK, KILL, HATCH }

/** Modèle de quête. */
data class QuestTemplate(
    val id: String,
    val giverId: String,
    val name: String,
    val goal: Int,
    val rewardXp: Int,
    val rewardCoin: Int,
    val type: QuestType = QuestType.WALK,
    val target: String? = null,
)

/** Météo. */
data class Weather(
    val id: String,
    val name: String,
    val xpMultiplier: Double,
    val coinMultiplier: Double,
    val sprite: String,
)

/** Achievement. */
data class Achievement(
    val id: String,
    val name: String,
    val condition: (PlayerState) -> Boolean,
)

/**
 * Catalogues de données statiques. Tout est en mémoire, sans I/O,
 * pour que la logique reste portable (Android, Wear OS, JVM, tests).
 */
object Catalog {

    val classes: List<GameClass> = listOf(
        GameClass("guerrier", "Guerrier", "+10% PV, robuste", "hero_warrior"),
        GameClass("mage",     "Mage",     "+10% XP sur quêtes mentales", "hero_mage"),
        GameClass("rodeur",   "Rôdeur",   "+5% pièces par pas", "hero_ranger"),
        GameClass("barde",    "Barde",    "+1 dialogue easter egg", "hero_bard"),
    )

    val hairstyles: List<String> = listOf("short", "long", "mohawk", "ponytail", "bald", "curly")
    val skinTones: List<String> = listOf("#f4c79a", "#d39660", "#a06840", "#5c3a1e", "#f7d8b2", "#e8b27a")
    val hairColors: List<String> = listOf("#2a1a0d", "#8b4513", "#d4a017", "#c0392b", "#e8e8e8", "#5b2a83")

    val npcs: List<Npc> = listOf(
        Npc("taverniere", "Hilda la Taverniere", "npc_tavern",
            "Tient la Taverne du Pas-Vert. Achète vos objets, vous repose.",
            listOf(
                "Encore toi ? Marche un peu et reviens avec des sous !",
                "On dit qu'au-delà de 10 000 pas, le ciel pleut des pièces.",
                "Easter egg : tape « konami » dans la console pour un cadeau."
            )),
        Npc("forgeron", "Brom le Forgeron", "npc_smith",
            "Forge des armes à partir de minerais récoltés en marchant.",
            listOf(
                "Apporte-moi du minerai et je te ferai trembler les boss.",
                "Le Dragon de Fer ? Je l'ai vu une fois, j'ai couru."
            )),
        Npc("sage", "Mira la Sage", "npc_sage",
            "Donne les quêtes principales et les énigmes.",
            listOf(
                "Le vrai voyage, c'est celui des pas.",
                "Si tu marches sans bouger, le système le saura."
            )),
        Npc("eleveur", "Pip l'Éleveur", "npc_breeder",
            "Couve les œufs et apprivoise les familiers.",
            listOf(
                "Cet œuf éclora dans 5000 pas, sois patient.",
                "Mon cochon-licorne ? Une légende vivante."
            )),
    )

    val monsters: List<Monster> = listOf(
        Monster("slime",   "Slime baveux",     50,  20,  listOf("gel", "piece"),       1, "mob_slime"),
        Monster("gobelin", "Gobelin",          120, 60,  listOf("cuir", "piece"),      2, "mob_goblin"),
        Monster("loup",    "Loup d'ombre",     200, 110, listOf("croc", "fourrure"),   3, "mob_wolf"),
        Monster("golem",   "Golem de Pierre",  500, 300, listOf("minerai", "cristal"), 4, "mob_golem"),
    )

    val raidBosses: List<RaidBoss> = listOf(
        RaidBoss("dragon_fer", "Dragon de Fer",       75_000,  "epee_titan"),
        RaidBoss("liche",      "Liche du Crépuscule",  90_000, "sceptre_obscur"),
        RaidBoss("kraken",     "Kraken des Sables",   110_000, "trident_dunes"),
    )

    val shopItems: List<ShopItem> = listOf(
        ShopItem("potion_pv",     "Potion de Vie",            25,  "consumable", "Restaure 50 PV."),
        ShopItem("potion_xp",     "Élixir d'XP (+10%, 1h)",   120, "buff",       "Boost XP temporaire."),
        ShopItem("sac_grand",     "Grand Sac (+5 slots)",     400, "upgrade",    "Augmente l'inventaire."),
        ShopItem("oeuf_mystere",  "Œuf Mystère",              250, "pet",        "À couver en marchant."),
        ShopItem("epee_bois",     "Épée en Bois",              80, "weapon",     "+5 dégâts."),
        ShopItem("epee_fer",      "Épée en Fer",              350, "weapon",     "+15 dégâts."),
        ShopItem("baton_eclat",   "Bâton d'Éclat",            280, "weapon",     "+12 magie."),
        ShopItem("cape_voyageur", "Cape du Voyageur",         200, "armor",      "-1 encombrement."),
    )

    val pets: List<Pet> = listOf(
        Pet("slimon",  "Slimon",  3000,  "pet_slime",  "+1 pièce / 100 pas"),
        Pet("foxy",    "Foxy",    6000,  "pet_fox",    "+2% XP global"),
        Pet("griffon", "Griffon", 12000, "pet_griff",  "-5% encombrement"),
        Pet("pixiel",  "Pixiel",  20000, "pet_pixiel", "Détecte les easter eggs"),
    )

    val achievements: List<Achievement> = listOf(
        Achievement("premiers_pas",   "Premiers Pas")     { it.totalSteps >= 100 },
        Achievement("marathonien",    "Marathonien")      { it.totalSteps >= 42_195 },
        Achievement("niveau_10",      "Niveau 10")        { it.level >= 10 },
        Achievement("niveau_25",      "Maître Aventurier") { it.level >= 25 },
        Achievement("collectionneur", "Collectionneur")   { it.bestiary.size >= monsters.size },
        Achievement("eleveur",        "Éleveur Expert")   { it.pets.count { p -> p.hatched } >= 2 },
        Achievement("tueur_boss",     "Tueur de Boss")    { it.raidsWon >= 1 },
        Achievement("riche",          "Riche du Royaume") { it.coins >= 5000 },
        Achievement("huit_mille",     "Au-delà du Seuil") { it.dailyStepsBest >= Config.DAILY_BONUS_THRESHOLD },
    )

    val seasons: List<String> = listOf("printemps", "ete", "automne", "hiver")

    val weathers: List<Weather> = listOf(
        Weather("soleil", "Soleil", 1.05, 1.00, "wx_sun"),
        Weather("pluie",  "Pluie",  0.95, 1.10, "wx_rain"),
        Weather("orage",  "Orage",  1.15, 0.90, "wx_storm"),
        Weather("neige",  "Neige",  1.00, 1.05, "wx_snow"),
        Weather("brume",  "Brume",  1.10, 1.00, "wx_fog"),
    )

    val questTemplates: List<QuestTemplate> = listOf(
        QuestTemplate("q_walk_500",  "taverniere", "Petite balade",     500,   60, 30),
        QuestTemplate("q_walk_2000", "taverniere", "Tour du village",   2000,  250, 120),
        QuestTemplate("q_walk_5000", "sage",       "Pèlerinage",        5000,  700, 250),
        QuestTemplate("q_walk_8000", "sage",       "Au-delà du Seuil",  8000,  1500, 500),
        QuestTemplate("q_kill_slime","forgeron",   "Premier sang",      3,    200, 80, type = QuestType.KILL,  target = "slime"),
        QuestTemplate("q_hatch_pet", "eleveur",    "Premier familier",  1,    400, 150, type = QuestType.HATCH),
    )
}
