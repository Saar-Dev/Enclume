#Bug #1
Contexte

Les beta-testeurs ont signalé l'absence d'explications globales dans le Wizard de création de personnage. Il ne s'agit pas de tooltips (infobulles ponctuelles, déjà existantes) mais d'un texte de tutoriel affiché en haut de chaque étape, expliquant ce que le joueur va faire.

Les textes ont été rédigés par Saar en s'inspirant du Livre de Base Polaris (pages 116-131). Ils doivent être intégrés dans les composants d'étape du Wizard.
Textes à intégrer (validés par Saar)

Step 0 — Méthode de création

    Vous allez créer votre personnage. Vous disposez de 20 Points de Création (PC) à répartir entre toutes les étapes. Vous pouvez vous inspirer des archétypes proposés ou répartir librement vos points selon le concept de votre personnage. Chaque PC dépensé améliore un aspect : attributs, années d'expérience, avantages... Les Désavantages, eux, rapportent des PC supplémentaires.

Step 1 — Capacités de base

    Définissez les aptitudes physiques et mentales essentielles de votre personnage : ses Attributs. Le score de base de chaque Attribut est de 7. Vous disposez d'une réserve de points d'Attributs pour les améliorer. Vous pouvez aussi dépenser des PC pour obtenir plus de points d'Attributs (1 PC = +2 points) mais attention, les PCs sont communs à toutes les étapes de création et les niveaux 16 à 20 coûtent de plus en plus cher.

Step 2 — Type génétique

    Choisissez la nature génétique de votre personnage. Par défaut, vous êtes un humain normal (gratuit, sans modificateurs). Vous pouvez aussi choisir un type Hybride (naturel, géno-hybride ou techno-hybride), capable de survivre sous l'eau, mais cela coûte des PC et modifie vos Attributs. Certains Hybrides subissent des Désavantages importants. Le MJ peut déconseiller les Hybrides aux joueurs débutants.

Step 3 — Capacités spéciales

    Votre personnage possède-t-il des particularités hors du commun ? Cette étape concerne les Mutations (avantageuses, neutres ou désavantageuses) et la maîtrise de la Force Polaris. Deux méthodes : acheter les mutations souhaitées avec des PC, ou effectuer un tirage aléatoire gratuit (résultat imprévisible). Vous pouvez aussi n'acheter aucune mutation.

Step 4 — Expérience préliminaire

    Vous allez définir le passé de votre personnage : son âge de départ, ses origines (géographique, sociale), sa formation, puis une ou plusieurs Professions. Chaque année d'expérience professionnelle coûte 1 PC et donne 10 points de Compétence à répartir, des avantages, et des économies. L'âge final dépendra du nombre d'années passées dans ces professions.

Step 5 — Avantages et Désavantages

    Complétez votre personnage avec des Avantages (capacités innées, ressources, bonus divers) et/ou des Désavantages (défauts handicapants). Les Avantages coûtent des PC. Les Désavantages en rapportent. Certains sont uniques, d'autres cumulables. Attention à ne pas surcharger le personnage en Désavantages, au risque de le rendre injouable.

Step 6 — Récapitulatif

    Vérifiez l'ensemble de votre fiche de personnage avant de terminer. Tous vos choix sont affichés ici : Attributs, Génotype, Mutations, Professions, Compétences, Avantages et Économies. Vous pouvez revenir en arrière pour modifier ce qui ne vous convient pas. Quand tout est prêt, verrouillez votre fiche pour commencer à jouer.

Contraintes techniques

    Internationalisation (i18n). Les textes doivent être placés dans les fichiers de traduction fr.json et en.json du namespace creation. Chaque clé suivra le format stepN.tutorial. Exemple : "step1.tutorial": "Définissez les aptitudes...". Ne pas utiliser fr.json global mais bien les fichiers dédiés au wizard.

    Emplacement dans l'interface. Chaque composant d'étape doit afficher le tutoriel en haut de l'étape, entre la barre de navigation et le contenu spécifique. Il doit être visible immédiatement, sans action de l'utilisateur.

    Style. Le texte doit être présenté dans un bandeau discret mais lisible, avec une couleur de fond légèrement contrastée par rapport au fond du wizard. Police de taille ~13px, couleur de texte douce (ex. #9090c8 ou #c0c0d0), avec une icône ℹ️ ou un petit séparateur visuel pour le distinguer du contenu interactif.

    Pas de duplication. Créer un composant réutilisable <StepTutorial text={t('stepN.tutorial')} /> plutôt que de copier-coller le même markup dans chaque étape.

    Ne pas toucher au guideModeActive du store. Ce mode n'est pas lié aux tutoriels (il concerne l'assistance MJ/Joueur en mode collaboratif). Les tutoriels sont permanents pour toutes les créations.

    Aucune modification fonctionnelle. L'ajout des tutoriels ne doit rien changer au comportement du wizard (validation, navigation, données).

Fichiers concernés
Fichier	Action
client/src/locales/creation.fr.json	Ajouter les 7 clés stepN.tutorial
client/src/locales/creation.en.json	Ajouter les 7 clés stepN.tutorial
client/src/components/creation/StepTutorial.jsx	Nouveau — composant réutilisable
client/src/components/creation/WizardCreation.jsx	Intégrer <StepTutorial> dans chaque rendu d'étape (ou dans chaque composant d'étape si le tutoriel est spécifique)
client/src/components/creation/Step0Method.jsx	Ajouter le tutoriel
client/src/components/creation/Step1Attributes.jsx	Ajouter le tutoriel
client/src/components/creation/Step2Genotype.jsx	Ajouter le tutoriel
client/src/components/creation/Step3Mutations.jsx	Ajouter le tutoriel
client/src/components/creation/Step4Experience.jsx	Ajouter le tutoriel
client/src/components/creation/Step5Advantages.jsx	Ajouter le tutoriel
client/src/components/WizardReview.jsx (ou composant Step 6)	Ajouter le tutoriel
Tests

    Vérifier que chaque étape affiche son tutoriel au chargement.

    Vérifier que le tutoriel est masqué proprement si l'étape ne le nécessite pas (ex. sous-étapes de l'étape 4 — le tutoriel doit rester visible même en naviguant entre les sous-étapes).

    Vérifier l'affichage responsive (le bandeau ne doit pas déborder sur mobile).

    Vérifier que les textes apparaissent correctement en français et en anglais.
---
#BUG #2