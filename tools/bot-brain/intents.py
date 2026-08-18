# -*- coding: utf-8 -*-
"""Cerveau Moody — lexique d'intentions. Itéré en boucle jusqu'à convergence."""
import unicodedata, re

def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("\u2019", "").replace("'", "")
    return re.sub(r"[^a-z0-9 ]", " ", s)

# intent -> [(pattern, poids)] ; pattern = sous-chaîne normalisée
LEXICON = {
    # ── CRISES (priorité absolue) ─────────────────────────────────────────
    "crisis_suicide": [
        ("ne plus etre la", 9), ("plus simple de ne plus", 7), ("me faire mal", 8), ("envie de me faire mal", 9),
        ("me supprimer", 10), ("idees noires", 8), ("me suis coupe", 9), ("me suis coupee", 9), ("me couper", 7), ("si je disparaissais", 8), ("me pendre", 10), ("plus despoir", 7), ("plus aucun espoir", 8), ("tout arreter definitivement", 7),
        ("jen peux plus de cette vie", 9), ("plus la force de vivre", 9), ("envie de disparaitre", 8),
        ("envie de mourir", 10), ("me suicider", 10), ("suicidaire", 10), ("en finir", 8),
        ("plus envie de vivre", 10), ("me faire du mal", 8), ("me scarifier", 9), ("me tailler", 8),
        ("disparaitre pour toujours", 8), ("vous seriez mieux sans moi", 9), ("je suis un fardeau", 8),
        ("a quoi bon continuer", 8), ("a quoi bon vivre", 9), ("mettre fin a mes jours", 10),
        ("je veux mourir", 10), ("marre de vivre", 8), ("me foutre en l'air", 9), ("me jeter", 6),
        ("plus de raison de vivre", 9), ("tout le monde s'en fiche de moi", 5), ("j'en peux plus de cette vie", 7),
    ],
    "crisis_panic": [
        ("respiration coupee", 8), ("coeur a fond", 6), ("je fais une attaque", 8), ("fais une crise la", 7),
        ("peur de mourir la", 8), ("hyperventile", 9), ("coeur bat a", 6), ("palpitations dangoisse", 9), ("malaise dangoisse", 8), ("tetanisee", 6), ("crise dangoisse", 10),
        ("crise de panique", 10), ("crise d'angoisse", 10), ("je panique", 9), ("coeur qui s'emballe", 7),
        ("je tremble et j'etouffe", 9), ("j'arrive plus a respirer tellement je stresse", 9),
        ("je vais faire un malaise", 7), ("tout tourne", 5), ("je perds le controle", 7),
        ("j'ai une attaque de panique", 10), ("je suffoque d'angoisse", 9),
    ],
    "crisis_violence": [
        ("pousse contre", 7), ("poussee contre", 8), ("casse des objets", 6), ("jai peur de lui", 8), ("jai peur delle", 8), ("sous emprise", 8), ("crie sur moi", 6), ("controle tout ce que je fais", 7), ("jai peur quand il", 7),
        ("me frappe", 9), ("me bat ", 8), ("recois des coups", 8),
        ("il me frappe", 10), ("elle me frappe", 10), ("me tape dessus", 9), ("il me tape", 9), ("elle me tape", 9), ("violent avec moi", 10),
        ("violence conjugale", 10), ("j'ai peur de mon mari", 9), ("j'ai peur de mon copain", 9),
        ("j'ai peur de rentrer chez moi", 8), ("il me menace", 9), ("me harcele", 8), ("m'insulte tous les jours", 7),
    ],
    "crisis_medical": [
        ("douleur dans le bras gauche", 10), ("bras gauche et la machoire", 10), ("douleur dans le bras", 7), ("la machoire", 5),
        ("serre dans la poitrine", 10), ("douleur qui serre", 9), ("ne peut plus bouger son bras", 10), ("ne peut plus parler", 8), ("levres bleues", 9), ("douleur et je transpire", 7),
        ("douleur dans la poitrine", 10), ("perdu connaissance", 9), ("mal a la poitrine", 8),
        ("douleur poitrine", 10), ("douleur thoracique", 10), ("oppression poitrine", 10),
        ("bras gauche engourdi", 10), ("n'arrive plus a respirer", 10), ("j'etouffe", 8),
        ("visage paralyse", 10), ("bouche deviee", 10), ("trouble de la parole soudain", 10),
        ("perte de connaissance", 9), ("convulsions", 9), ("saigne beaucoup", 8),
    ],
    # ── ÉMOTIONS ──────────────────────────────────────────────────────────
    "emo_sad": [
        (" naze ", 5), ("sans envie", 7), ("morne", 5), ("moral en berne", 8),
        ("deprime", 7), ("morose", 6), ("pas la joie", 6), ("triste", 5), ("blues", 6), ("noir total", 6), ("envie de rien", 7), ("plus gout a rien", 8),
        ("trop triste", 8), (" triste ", 6), ("moral est a zero", 9), ("le seum", 6), ("cafard", 7), ("melancolie", 7),
        ("je suis triste", 8), ("j'ai le cafard", 8), ("gros coup de blues", 8), ("je deprime", 8),
        ("moral a zero", 9), ("moral dans les chaussettes", 9), ("envie de pleurer", 8), ("je pleure", 7),
        ("je me sens mal", 6), ("ca va pas du tout", 6), ("ca va pas fort", 6), ("je vais mal", 7),
        ("journee pourrie", 6), ("je suis au fond du trou", 9), ("je broie du noir", 8), ("j'ai le seum", 5),
        ("pas le moral", 8), ("demoralisee", 8), ("demoralise", 8), ("abattu", 7), ("abattue", 7),
    ],
    "emo_anxious": [
        ("morte de peur", 8), ("mort de peur", 8), ("stress me bouffe", 9), (" le stress ", 5), ("trouille", 7), ("paniquee pour", 6), ("panique pour", 6), ("stress", 4), ("crispee", 6),
        ("stressee", 6), (" stresse ", 5), ("inquiete", 6), (" inquiet ", 6),
        ("je suis stresse", 8), ("je suis stressee", 8), ("je stresse", 8), ("angoisse", 7),
        ("je suis angoissee", 9), ("anxieuse", 8), ("anxieux", 8), ("je rumine", 7), ("je cogite trop", 7),
        ("boule au ventre", 9), ("je flippe", 7), ("j'apprehende", 7), ("peur de demain", 6),
        ("je n'arrete pas de penser", 6), ("tendu comme un arc", 7), ("nerveuse", 6), ("sous pression", 6),
    ],
    "emo_angry": [
        ("me prend la tete", 7), ("prennent la tete", 6), ("me prend le chou", 7), ("saoulant", 5),
        ("les nerfs", 7), ("je bous", 7), ("petage de plombs", 8), ("plein le dos", 7), ("ras le bol", 7), ("enerve", 5), ("enervee", 5), ("furax", 7), ("agacee", 6),
        ("je suis enervee", 8), ("je suis enerve", 8), ("ca m'enerve", 7), ("je suis furieuse", 9),
        ("en colere", 8), ("je rage", 7), ("ca me saoule", 6), ("ca me gonfle", 6), ("je suis a cran", 8),
        ("envie de tout casser", 8), ("hors de moi", 8), ("ca m'agace", 6), ("insupportable aujourd'hui", 5),
    ],
    "emo_lonely": [
        ("toute seule", 6), ("tout seul", 6), ("soirees sont longues", 7), ("seule chez moi", 7),
        ("quelquun pense a moi", 7), ("seule encore", 7), ("seul encore", 7), ("me sens exclue", 8), ("delaissee", 7), ("personne ne mappelle", 8), ("seule ce week end", 8), ("seule encore une fois", 9),
        ("tellement seule", 9), ("tellement seul", 9), (" seule ce soir", 7), ("isolee", 7), (" isole ", 6),
        ("je me sens seule", 9), ("je me sens seul", 9), ("personne ne m'ecoute", 8), ("tout le monde s'en fiche", 7),
        ("personne a qui parler", 9), ("je suis isolee", 8), ("abandonnee", 7), ("personne ne me comprend", 8),
        ("je n'ai pas d'amis", 8), ("solitude", 7),
    ],
    "emo_tired": [
        ("epuis", 6), ("quand meme epuisee", 8), ("dors trop et", 5), ("dormir tout le temps", 6),
        ("tiens plus debout", 9), ("fatiguee", 5), (" fatigue ", 4), ("extenuee", 8), ("harassee", 7), ("videe", 6), ("plus de batterie", 5), ("cerne", 4),
        ("je suis epuisee", 8), ("je suis epuise", 8), ("creve", 6), ("crevee", 6), ("a bout de forces", 9),
        ("plus d'energie", 7), ("je n'en peux plus", 7), ("vide", 4), ("lessivee", 8), ("lessive", 5),
        ("au bout du rouleau", 9), ("fatiguee de tout", 8), ("burn out", 8), ("surmenee", 8), ("je sature", 7),
    ],
    "emo_guilt": [
        ("toujours moi le probleme", 8), ("je gache tout", 8), ("je merite pas", 7), ("je sers a rien", 8),
        ("de ma faute", 8), ("men veux", 9),
        ("je culpabilise", 9), ("c'est de ma faute", 8), ("je m'en veux", 9), ("honte de moi", 9),
        ("je suis nulle", 8), ("je suis nul", 8), ("bonne a rien", 9), ("bon a rien", 9), ("je rate tout", 8),
        ("je me deteste", 9), ("je ne vaux rien", 9),
    ],
    "emo_joy": [
        ("grosse peche", 7), ("la peche", 6), ("tout roule", 6), ("nickel aujourdhui", 6),
        ("rayonnante", 7), ("rayonnant", 7), ("de bonne humeur", 7), ("au top", 6), ("motivee a fond", 7), ("journee parfaite", 8), ("trop bien aujourdhui", 7),
        ("je suis heureuse", 8), ("je suis heureux", 8), ("super journee", 8), ("trop contente", 8),
        ("trop content", 8), ("je petille", 7), ("en pleine forme", 8), ("je vais tres bien", 7),
        ("excellente nouvelle", 7), ("je suis fiere de moi", 9), ("je suis fier de moi", 9), ("ca va super", 7),
    ],
    "emo_heartbreak": [
        ("quon sest quittes", 8), ("on sest quitte", 8), ("sest quittes", 8), ("me remets pas de lui", 8), ("me remets pas delle", 8),
        ("separes", 6), ("separee", 6), ("mon ex", 5), ("divorce", 6), ("quittes avec", 6), ("plus ensemble", 5),
        ("rupture", 7), ("il m'a quittee", 9), ("elle m'a quitte", 9), ("coeur brise", 9), ("chagrin d'amour", 9),
        ("je pense encore a mon ex", 8), ("largue", 6), ("larguee", 6), ("separation difficile", 8),
    ],
    "emo_grief": [
        ("la mort de maman", 10), ("la mort de papa", 10), ("anniversaire de la mort", 9), ("la mort de mon", 7), ("la mort de ma", 7),
        ("nous a quittes", 8), ("nous a quittee", 8), ("funerailles", 7), ("obseques", 7), ("disparu il y a", 5), ("perdu mon", 5), ("perdu ma", 5),
        ("deuil", 8), ("est decede", 8), ("est decedee", 8), ("est mort", 6), ("est morte", 6),
        ("j'ai perdu ma mere", 10), ("j'ai perdu mon pere", 10), ("perdu un proche", 9), ("enterrement", 7),
    ],
    # ── ACTIONS SUR L'APP ────────────────────────────────────────────────
    "act_water": [
        (" deau ", 5), ("litre deau", 8), ("bouteille deau", 7),
        ("marquer deux verres", 6), ("marque un verre", 6), ("bue", 3),
        ("j'ai bu", 3), (" eau ", 5), ("verres d'eau", 8), ("verre d'eau", 8), ("note de l'eau", 8), ("ajoute de l'eau", 8),
        ("hydratation", 5), ("bu de l'eau", 8),
    ],
    "act_conso": [
        ("monster", 7), (" bieres ", 6), ("kro ", 5), ("pinte", 6), ("expresso", 6), ("capsule de cafe", 6), ("deuxieme cafe", 7), ("troisieme clope", 8),
        ("clope", 6), ("cigarette", 5), ("mon cafe", 5), ("un cafe", 5), ("troisieme cafe", 7), ("redbull", 7), ("energy drink", 7), ("un joint", 8), ("de lalcool", 6),
        (" biere ", 8), (" vin ", 6), (" the ", 4), ("nicotine", 6),
        ("j'ai fume", 8), ("j'ai pris un cafe", 8), ("note un cafe", 8), ("canette", 6), ("un monster", 7),
        ("une clope", 8), ("une cigarette", 8), ("un verre d'alcool", 8), ("une biere", 7), ("note ma conso", 8),
    ],
    "act_hygiene": [
        ("douche du soir", 7), ("douche du matin", 7), (" lave ", 3), ("brossage", 6),
        ("douche faite", 9), ("dents lavees", 9), ("lave les dents", 8), ("brossage fait", 8), ("douchee ce", 7),
        ("j'ai pris ma douche", 9), ("douche prise", 9), ("je me suis douchee", 9), ("je me suis douche", 9),
        ("dents brossees", 9), ("je me suis brosse les dents", 9), ("brosse les dents", 8),
    ],
    "act_mood_log": [
        ("sur 10", 5), ("mets moi", 4), ("note moi a", 7), ("mets 7", 6), ("mets 6", 6), ("mets 8", 6),
        ("note mon humeur a", 9), ("mon humeur est a", 8), ("humeur a 7", 8), ("je me sens a 8", 6),
        ("enregistre mon humeur", 9), ("note 7 sur 10", 7),
    ],
    "act_med_taken": [
        (" avales ", 6), ("medicaments du soir avales", 10), ("pris mes medocs", 9), ("medocs pris", 9),
        ("avale mes cachets", 9), ("pris mes cachets", 9), ("cachets pris", 9), ("traitement pris", 9), ("avale mon cachet", 9), ("pris ma dose", 8),
        ("j'ai pris mon medicament", 9), ("j'ai pris mes medicaments", 9), ("medicament pris", 9),
        ("j'ai pris mon traitement", 9), ("valide ma prise", 9), ("j'ai pris mon cachet", 9),
    ],
    "act_side_effect": [
        ("depuis le nouveau traitement", 9), ("tete qui tourne depuis", 9), ("depuis mon nouveau medicament", 9), ("bizarre depuis que je prends", 9),
        ("vertiges depuis", 8), ("nausees depuis", 8), ("mal depuis que je prends", 8), ("supporte mal mon", 7),
        ("effet secondaire", 9), ("me donne des nausees", 8), ("me donne mal a la tete", 7),
        ("me donne des vertiges", 8), ("depuis que je prends", 7), ("mal supporte", 6),
    ],
    "act_open_report": [
        ("fais voir le rapport", 10), ("voir le rapport", 9),
        ("affiche le rapport", 10), ("mon rapport", 7), ("le rapport stp", 9), ("rapport pour mon medecin", 9),
        ("ouvre le rapport", 10), ("montre le rapport", 9), ("voir mon rapport", 9), ("mon bilan du mois", 7),
        ("rapport medecin", 8), ("genere le rapport", 9),
    ],
    "act_open_settings": [
        ("alarmes de medicaments", 8), ("regler mes alarmes", 8), ("mes rappels", 6), ("regler les rappels", 8), ("parametrer", 6),
        ("ouvre les reglages", 10), ("les parametres", 7), ("ajouter un medicament", 8), ("nouveau medicament", 8),
        ("changer mes rappels", 8), ("modifier mes horaires", 7),
    ],
    "act_start_bilan": [
        ("fait le point", 8), ("on fait le point", 9), ("le point moody", 9),
        ("bilan", 8), ("faire le point", 8), ("on fait mon bilan", 9), ("check in", 6), ("questionnaire", 6),
    ],
    "act_add_product": [
        ("suivre un produit", 9), ("nouvelle addiction", 8), ("suivre ma conso de", 9), ("track mes cafes", 7),
    ],
    # ── QUESTIONS DONNÉES ────────────────────────────────────────────────
    "q_mood_avg": [
        ("sest ameliore", 8), ("mon moral sest", 8), ("ameliore ou pas", 8), ("va mieux ou pas", 7),
        ("ca donne quoi mon humeur", 10), ("humeur ces derniers jours", 9), ("mon humeur recemment", 8), ("evolution de mon moral", 8),
        ("moyenne d'humeur", 10), ("ma moyenne", 8), ("mon humeur cette semaine", 8), ("moral ce mois", 7),
        ("comment evolue mon humeur", 9), ("tendance de mon humeur", 9), ("stats d'humeur", 8),
    ],
    "q_sleep": [
        ("manque de sommeil", 9), ("assez dormi en ce moment", 8),
        ("mes nuits sont comment", 9), ("je dors comment", 8), ("mon temps de sommeil", 8),
        ("combien j'ai dormi", 10), ("mon sommeil", 7), ("mes nuits", 7), ("moyenne de sommeil", 9),
        ("je dors combien", 9), ("bien dormi ces derniers temps", 7),
    ],
    "q_meds": [
        ("medocs du soir", 8), ("medocs du matin", 8), ("quoi prendre ce soir", 7), ("rappelle moi mes medocs", 9),
        ("mes medicaments", 8), ("mon traitement", 7), ("quelles prises aujourd'hui", 8),
        ("j'ai pris quoi aujourd'hui", 7), ("liste de mes medocs", 9), ("mes medocs", 8),
    ],
    "q_conso_stats": [
        ("combien de bieres", 12), ("combien de monster", 12), ("combien de joints", 12),
        ("jen suis a combien", 9), ("combien jai fume", 10), ("combien jai bu de cafes", 10), ("ma conso de la semaine", 9),
        ("combien de cigarettes", 12), ("combien de cafes", 12), ("combien de clopes", 12), ("jai fume combien", 11),
        ("combien de cafes", 8), ("combien de cigarettes", 8), ("ma conso", 7), ("combien de monster", 8),
        ("consommation cette semaine", 8),
    ],
    "q_water": [("combien d'eau", 9), ("j'ai bu combien", 8), ("mon hydratation", 8)],
    "q_weather": [
        ("il caille", 9), ("il gele", 9), ("canicule", 8), ("il fait combien dehors", 9),
        ("quel temps", 8), ("temps dehors", 8), ("fait beau", 7), ("fait froid", 6), ("fait chaud", 6), ("la meteo", 9), ("degres dehors", 8),
        ("meteo", 9), ("le temps qu'il fait", 9), ("il pleut", 7), ("il va pleuvoir", 8),
        ("temperature dehors", 8), ("beau dehors", 7), ("prendre un parapluie", 8),
    ],
    "q_date": [
        ("le combien aujourdhui", 9), ("on est le combien", 9), ("quel jour sommes nous", 9), ("la date du jour", 9),
        ("quel jour", 9), ("quelle date", 9), ("la date d'aujourd'hui", 9), ("quelle heure", 9),
        ("on est quel jour", 9), ("il est quelle heure", 9),
    ],
    "q_drug": [
        (" dangereux", 5), ("sans danger", 6), ("compatible avec", 5), ("interaction", 7),
        ("c'est quoi le", 6), ("c'est quoi la", 6), ("a quoi sert", 7), ("effets du", 6), ("effets de la", 6),
        ("info sur le medicament", 9), ("posologie", 7), ("notice du", 7), ("generique de", 7),
    ],
    "q_specialist": [
        ("je vais voir qui", 10), ("voir qui pour", 9), ("adresser a qui", 9),
        ("je vois qui", 8), ("je consulte qui", 9), ("quel doc ", 6), ("aller voir qui", 8), ("quel genre de medecin", 9),
        ("quel specialiste", 10), ("quel medecin", 9), ("qui consulter", 10), ("vers qui me tourner", 8),
        ("dois je voir un medecin", 8), ("besoin d'un docteur", 7), ("oriente moi", 7),
    ],
    "q_advice": [
        ("aide moi a", 7), ("moins stresser", 7), ("mieux dormir", 7), ("me detendre", 7),
        ("un tips", 7), ("tips pour", 7), ("mendormir", 6), ("comment faire pour dormir", 8), ("des conseils", 7), ("recommandes quoi", 7),
        ("un conseil", 8), ("une astuce", 8), ("aide moi a dormir", 8), ("comment mieux dormir", 8),
        ("comment gerer mon stress", 8), ("comment aller mieux", 7), ("des idees pour", 5), ("motive moi", 7),
    ],
    # ── SOCIAL ───────────────────────────────────────────────────────────
    "s_greeting": [
        ("bonjour", 8), ("salut", 8), ("coucou", 8), ("bonsoir", 8), ("hello", 7), ("yo moody", 8), ("cc", 4),
    ],
    "s_thanks": [("merci", 8), ("t'es genial", 7), ("tu m'aides beaucoup", 8), ("t'es top", 7)],
    "s_bye": [("au revoir", 8), ("bonne nuit", 8), ("a demain", 8), ("je te laisse", 7), ("a plus", 6), ("bye", 6)],
    "s_how_are_you": [("comment vas tu", 9), ("comment tu vas", 9), ("ca va toi", 8), ("tu vas bien", 8)],
    "s_who": [
        ("qui es tu", 9), ("t'es qui", 9), ("tu es quoi", 8), ("que sais tu faire", 9), ("tes capacites", 8),
        ("comment tu marches", 7), ("tu peux faire quoi", 9),
    ],
}

PRIORITY = ["crisis_suicide", "crisis_medical", "crisis_violence", "crisis_panic"]

_NORMED = None
def _lex():
    global _NORMED
    if _NORMED is None:
        _NORMED = {i: [((pt if pt.startswith(" ") or pt.endswith(" ") else norm(pt)), w) for pt, w in pats]
                   for i, pats in LEXICON.items()}
    return _NORMED

def classify(text):
    t = " " + norm(text) + " "
    scores = {}
    for intent, pats in _lex().items():
        sc = 0
        for pat, w in pats:
            if pat in t:
                sc += w
        if sc:
            scores[intent] = sc
    if not scores:
        return None, 0
    crises = [(c, scores[c]) for c in PRIORITY if c in scores and scores[c] >= 6]
    if crises:
        top = max(s for _, s in crises)
        for c in PRIORITY:  # à score égal, l'ordre de gravité tranche
            if scores.get(c) == top:
                return c, top
    best = max(scores.items(), key=lambda kv: kv[1])
    return best if best[1] >= 5 else (None, best[1])
