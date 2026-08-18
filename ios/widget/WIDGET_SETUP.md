# Widget écran d'accueil iOS — mise en place (~10 min dans Xcode)

Le côté app est déjà fait : Moody écrit un résumé (humeur, prochain médoc, observance,
brossage, eau) dans un **App Group** partagé et rafraîchit le widget à chaque changement.
Il reste 4 étapes GUI dans Xcode (impossibles en ligne de commande).

App Group utilisé partout : **`group.tech.stariax.moodyapp`**

## 1. Activer l'App Group sur l'app
- Ouvre `ios/App/App.xcworkspace`
- Cible **App** → onglet **Signing & Capabilities** → **＋ Capability** → **App Groups**
- Clique **＋** sous App Groups → ajoute `group.tech.stariax.moodyapp` (coché)

## 2. Créer l'extension Widget
- Menu **File → New → Target…**
- Choisis **Widget Extension** → Next
- Product Name : **MoodyWidget**
- **Décoche** « Include Configuration Intent » (on utilise un widget statique)
- Finish → si Xcode propose **Activate** le scheme, clique **Activate**

## 3. Activer le même App Group sur le widget
- Cible **MoodyWidgetExtension** → **Signing & Capabilities** → **＋ Capability** → **App Groups**
- Coche/ajoute le **même** `group.tech.stariax.moodyapp`
- Vérifie que la **Team** est ton organisation payante (comme l'app)

## 4. Coller le code des widgets (2 fichiers)
Le dossier `ios/widget/` contient **deux** fichiers à recopier :
- **`MoodyWidget.swift`** → les 3 widgets (Médicaments, Humeur, Aujourd'hui), **sans** `@main`.
- **`MoodyWidgetBundle.swift`** → le **seul** `@main`, qui liste les 3 widgets.

Dans le dossier **MoodyWidget** généré par Xcode :
- Ouvre le `MoodyWidget.swift` généré → remplace **tout** son contenu par le mien.
- Ouvre le `MoodyWidgetBundle.swift` généré → remplace **tout** son contenu par le mien.
  (Si Xcode n'a pas créé de `MoodyWidgetBundle.swift`, fais **File → New → File → Swift File**,
   nomme-le `MoodyWidgetBundle`, coche la cible **MoodyWidgetExtension**, et colle mon contenu.)

Règle d'or : il ne doit y avoir **qu'un seul `@main`** dans la cible widget (celui du Bundle).
Erreur « 'main' attribute can only apply to one type » = tu as deux `@main` → enlève tous
les `@main` sauf celui de `MoodyWidgetBundle.swift`.

Une fois lancé, un appui long sur l'écran d'accueil → ＋ → **Moody** te proposera les **3 widgets**.

## 5. Lancer
- Sélectionne le scheme **App** (pas le widget) → **▶ Run** sur ton iPhone
- Ouvre l'app une fois (elle écrit les données), puis sur l'écran d'accueil :
  appui long → **＋** → cherche **Moody** → ajoute le widget (petit ou moyen)

Le widget se met à jour tout seul quand tu notes ton humeur, prends un médicament, etc.
(iOS limite la fréquence de rafraîchissement, mais l'app force un reload à chaque changement).

## Dépannage
- Widget vide / « Pas encore noté » : ouvre l'app une fois pour initialiser les données.
- Rien ne s'affiche : vérifie que l'App Group est **identique** et coché sur les **deux** cibles.
- Erreur de build « multiple @main » : garde uniquement le `@main` de MoodyWidget.swift.
