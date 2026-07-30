// Catalogue de médicaments courants (FR) — résumé de notice indicatif, à compléter par la base complète.
export interface MedHighlights {
  molecule?: string;
  classe?: string;
  risques?: string[];       // précautions / contre-indications clés
  effets?: string[];        // effets indésirables fréquents
  conseils?: string[];      // à savoir
}
export interface CatalogMed { name: string; h: MedHighlights; }

export const MED_CATALOG: CatalogMed[] = [
  { name: "Doliprane", h: { molecule: "Paracétamol", classe: "Antalgique / antipyrétique", risques: ["Ne pas dépasser 3 g/j (4 g sur avis médical)", "Prudence en cas de maladie du foie ou d'alcoolisme"], effets: ["Rares aux doses usuelles", "Réactions allergiques cutanées possibles"], conseils: ["Espacer les prises d'au moins 4-6 h"] } },
  { name: "Efferalgan", h: { molecule: "Paracétamol", classe: "Antalgique / antipyrétique", risques: ["Max 3 g/j", "Attention au foie"], effets: ["Rares"], conseils: ["Ne pas cumuler avec d'autres produits contenant du paracétamol"] } },
  { name: "Dafalgan", h: { molecule: "Paracétamol", classe: "Antalgique", risques: ["Max 3 g/j"], effets: ["Rares"], conseils: ["Vérifier les autres médicaments pour éviter le surdosage"] } },
  { name: "Ibuprofène", h: { molecule: "Ibuprofène", classe: "Anti-inflammatoire (AINS)", risques: ["Éviter en cas d'ulcère, d'insuffisance rénale, à partir du 6e mois de grossesse", "Prudence avec anticoagulants"], effets: ["Maux d'estomac, nausées", "Vertiges"], conseils: ["À prendre au cours d'un repas", "Éviter l'usage prolongé sans avis"] } },
  { name: "Advil", h: { molecule: "Ibuprofène", classe: "AINS", risques: ["Contre-indiqué en fin de grossesse, ulcère"], effets: ["Troubles digestifs"], conseils: ["Pendant les repas"] } },
  { name: "Nurofen", h: { molecule: "Ibuprofène", classe: "AINS", risques: ["Ulcère, insuffisance rénale/cardiaque"], effets: ["Douleurs gastriques"], conseils: ["Dose minimale efficace, durée courte"] } },
  { name: "Aspirine", h: { molecule: "Acide acétylsalicylique", classe: "Antalgique / antiagrégant", risques: ["Risque de saignement", "Éviter avant 16 ans (sd de Reye)", "Fin de grossesse"], effets: ["Troubles digestifs, saignements"], conseils: ["Prudence avec les anticoagulants"] } },
  { name: "Spasfon", h: { molecule: "Phloroglucinol", classe: "Antispasmodique", risques: ["Peu de contre-indications"], effets: ["Rares réactions allergiques"], conseils: ["Contre les douleurs spasmodiques (ventre, règles)"] } },
  { name: "Smecta", h: { molecule: "Diosmectite", classe: "Antidiarrhéique", risques: ["Espacer des autres médicaments (2 h)"], effets: ["Constipation"], conseils: ["Bien s'hydrater"] } },
  { name: "Imodium", h: { molecule: "Lopéramide", classe: "Antidiarrhéique", risques: ["Ne pas utiliser si fièvre/sang dans les selles"], effets: ["Constipation, ballonnements"], conseils: ["Durée courte"] } },
  { name: "Gaviscon", h: { molecule: "Alginate / bicarbonate", classe: "Anti-reflux", risques: ["Espacer des autres médicaments"], effets: ["Rares"], conseils: ["Après les repas et au coucher"] } },
  { name: "Amoxicilline", h: { molecule: "Amoxicilline", classe: "Antibiotique (pénicilline)", risques: ["Allergie aux pénicillines = contre-indication"], effets: ["Diarrhée, nausées", "Éruptions cutanées"], conseils: ["Aller au bout du traitement même si amélioration"] } },
  { name: "Augmentin", h: { molecule: "Amoxicilline + acide clavulanique", classe: "Antibiotique", risques: ["Allergie pénicillines", "Prudence foie"], effets: ["Diarrhée fréquente, nausées"], conseils: ["Prendre en début de repas"] } },
  { name: "Sertraline", h: { molecule: "Sertraline", classe: "Antidépresseur (ISRS)", risques: ["Ne pas arrêter brutalement", "Surveillance en début de traitement (idées noires)"], effets: ["Nausées, troubles du sommeil, baisse de libido", "Fatigue au début"], conseils: ["Effet complet après 2-4 semaines"] } },
  { name: "Fluoxétine", h: { molecule: "Fluoxétine", classe: "Antidépresseur (ISRS)", risques: ["Arrêt progressif", "Interactions nombreuses"], effets: ["Insomnie, nausées, anxiété initiale"], conseils: ["Le matin de préférence"] } },
  { name: "Escitalopram", h: { molecule: "Escitalopram", classe: "Antidépresseur (ISRS)", risques: ["Arrêt progressif", "Surveillance cardiaque à forte dose"], effets: ["Nausées, somnolence, sueurs"], conseils: ["Patience : effet en quelques semaines"] } },
  { name: "Venlafaxine", h: { molecule: "Venlafaxine", classe: "Antidépresseur (IRSN)", risques: ["Arrêt très progressif", "Surveillance tension"], effets: ["Nausées, bouche sèche, transpiration"], conseils: ["Ne pas sauter de prises"] } },
  { name: "Paroxétine", h: { molecule: "Paroxétine", classe: "Antidépresseur (ISRS)", risques: ["Arrêt progressif (syndrome de sevrage)"], effets: ["Somnolence, prise de poids, libido"], conseils: [] } },
  { name: "Bromazépam", h: { molecule: "Bromazépam (Lexomil)", classe: "Anxiolytique (benzodiazépine)", risques: ["Dépendance", "Somnolence : éviter la conduite", "Pas d'alcool"], effets: ["Somnolence, troubles mémoire"], conseils: ["Durée la plus courte possible"] } },
  { name: "Alprazolam", h: { molecule: "Alprazolam (Xanax)", classe: "Anxiolytique (benzodiazépine)", risques: ["Dépendance, sevrage", "Pas d'alcool"], effets: ["Somnolence, vertiges"], conseils: ["Arrêt progressif"] } },
  { name: "Zolpidem", h: { molecule: "Zolpidem (Stilnox)", classe: "Hypnotique", risques: ["Dépendance", "Somnolence résiduelle"], effets: ["Troubles de mémoire, comportements automatiques"], conseils: ["Juste avant le coucher, durée courte"] } },
  { name: "Mélatonine", h: { molecule: "Mélatonine", classe: "Aide au sommeil", risques: ["Somnolence"], effets: ["Maux de tête, somnolence"], conseils: ["30-60 min avant le coucher"] } },
  { name: "Lévothyrox", h: { molecule: "Lévothyroxine", classe: "Hormone thyroïdienne", risques: ["Dose à ajuster (bilans sanguins)"], effets: ["Palpitations si dose trop forte"], conseils: ["À jeun, le matin, à heure fixe"] } },
  { name: "Metformine", h: { molecule: "Metformine", classe: "Antidiabétique", risques: ["Prudence reins", "Arrêt avant examens avec produit de contraste"], effets: ["Troubles digestifs, diarrhée"], conseils: ["Pendant/après les repas"] } },
  { name: "Kardegic", h: { molecule: "Acide acétylsalicylique (faible dose)", classe: "Antiagrégant plaquettaire", risques: ["Risque de saignement"], effets: ["Saignements, troubles digestifs"], conseils: ["Ne pas arrêter sans avis médical"] } },
  { name: "Ramipril", h: { molecule: "Ramipril", classe: "Antihypertenseur (IEC)", risques: ["Contre-indiqué en grossesse", "Surveillance reins/potassium"], effets: ["Toux sèche, vertiges"], conseils: [] } },
  { name: "Amlodipine", h: { molecule: "Amlodipine", classe: "Antihypertenseur", risques: [], effets: ["Œdèmes des chevilles, bouffées de chaleur"], conseils: [] } },
  { name: "Bisoprolol", h: { molecule: "Bisoprolol", classe: "Bêta-bloquant", risques: ["Ne pas arrêter brutalement", "Prudence asthme"], effets: ["Fatigue, extrémités froides, bradycardie"], conseils: [] } },
  { name: "Atorvastatine", h: { molecule: "Atorvastatine", classe: "Hypocholestérolémiant (statine)", risques: ["Signaler des douleurs musculaires"], effets: ["Douleurs musculaires, troubles digestifs"], conseils: ["Le soir souvent"] } },
  { name: "Oméprazole", h: { molecule: "Oméprazole", classe: "Anti-acide (IPP)", risques: ["Usage prolongé à réévaluer"], effets: ["Maux de tête, troubles digestifs"], conseils: ["Avant le repas"] } },
  { name: "Ventoline", h: { molecule: "Salbutamol", classe: "Bronchodilatateur", risques: [], effets: ["Tremblements, palpitations"], conseils: ["En cas de crise ; consulter si usage fréquent"] } },
  { name: "Prednisolone", h: { molecule: "Prednisolone", classe: "Corticoïde", risques: ["Ne pas arrêter brutalement", "Régime peu salé/sucré"], effets: ["Insomnie, appétit, rétention d'eau"], conseils: ["Le matin"] } },
  { name: "Cetirizine", h: { molecule: "Cétirizine", classe: "Antihistaminique", risques: ["Peut somnoler"], effets: ["Somnolence, bouche sèche"], conseils: ["Contre les allergies"] } },
  { name: "Vitamine D", h: { molecule: "Cholécalciférol", classe: "Vitamine", risques: ["Respecter la dose"], effets: ["Rares"], conseils: ["Souvent en une prise espacée"] } },
  { name: "Magnésium", h: { molecule: "Magnésium", classe: "Complément", risques: ["Prudence si insuffisance rénale"], effets: ["Diarrhée à forte dose"], conseils: [] } },
];

const NORM = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Noms additionnels courants (autocomplétion élargie, sans fiche détaillée)
export const MED_NAMES_EXTRA = [
  "Paracétamol", "Tramadol", "Codéine", "Morphine", "Lamaline", "Ixprim", "Lyrica", "Prégabaline",
  "Gabapentine", "Laroxyl", "Amitriptyline", "Mirtazapine", "Duloxétine", "Citalopram", "Bupropion",
  "Quétiapine", "Rispéridone", "Olanzapine", "Aripiprazole", "Lithium", "Lamotrigine", "Dépakine",
  "Diazépam", "Lorazépam", "Oxazépam", "Clonazépam", "Prazépam", "Hydroxyzine", "Atarax",
  "Loratadine", "Desloratadine", "Aerius", "Doliprane Codéine", "Toplexil", "Maalox", "Inexium",
  "Pantoprazole", "Lansoprazole", "Ésoméprazole", "Débridat", "Forlax", "Movicol", "Dulcolax",
  "Furosémide", "Lasilix", "Spironolactone", "Losartan", "Candésartan", "Valsartan", "Périndopril",
  "Enalapril", "Nébivolol", "Aténolol", "Propranolol", "Diltiazem", "Vérapamil", "Rosuvastatine",
  "Simvastatine", "Pravastatine", "Ezétimibe", "Clopidogrel", "Plavix", "Xarelto", "Eliquis",
  "Préviscan", "Coumadine", "Insuline", "Lantus", "Novorapid", "Gliclazide", "Sitagliptine",
  "Januvia", "Forxiga", "Jardiance", "Ozempic", "Trulicity", "Symbicort", "Seretide", "Spiriva",
  "Flixotide", "Singulair", "Montélukast", "Cortancyl", "Solupred", "Célestène", "Dexaméthasone",
  "Ciprofloxacine", "Ofloxacine", "Doxycycline", "Azithromycine", "Clarithromycine", "Métronidazole",
  "Flagyl", "Pyostacine", "Josacine", "Rodogyl", "Fucidine", "Daktarin", "Monazol", "Lamisil",
  "Bétadine", "Biseptine", "Ostéocalcium", "Fer", "Tardyferon", "Spécialfoldine", "Acide folique",
];

export interface MedSuggestion { name: string; h?: MedHighlights; }

export function searchCatalog(q: string, limit = 12): MedSuggestion[] {
  const n = NORM(q);
  if (!n) return [];
  const out: MedSuggestion[] = [];
  for (const m of MED_CATALOG) if (NORM(m.name).includes(n)) out.push({ name: m.name, h: m.h });
  for (const name of MED_NAMES_EXTRA) if (NORM(name).includes(n) && !out.some((o) => NORM(o.name) === NORM(name))) out.push({ name });
  // prefix matches first
  out.sort((a, b) => (NORM(a.name).startsWith(n) ? 0 : 1) - (NORM(b.name).startsWith(n) ? 0 : 1));
  return out.slice(0, limit);
}
export function catalogInfo(name: string): MedHighlights | undefined {
  const n = NORM(name);
  return MED_CATALOG.find((m) => NORM(m.name) === n || n.includes(NORM(m.name)) || NORM(m.name).includes(n))?.h;
}
