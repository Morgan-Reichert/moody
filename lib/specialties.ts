// Comprehensive list of medical & therapy specialties (FR).
export interface Specialty { name: string; group: string; }

export const SPECIALTIES: Specialty[] = [
  // Médecine générale & interne
  { name: "Médecine générale", group: "Médecine générale" },
  { name: "Médecine interne", group: "Médecine générale" },
  { name: "Gériatrie", group: "Médecine générale" },
  { name: "Médecine d'urgence", group: "Médecine générale" },
  { name: "Médecine du travail", group: "Médecine générale" },
  { name: "Médecine physique et de réadaptation", group: "Médecine générale" },
  { name: "Médecine du sport", group: "Médecine générale" },
  { name: "Santé publique", group: "Médecine générale" },

  // Spécialités médicales
  { name: "Allergologie", group: "Spécialités médicales" },
  { name: "Cardiologie", group: "Spécialités médicales" },
  { name: "Dermatologie et vénéréologie", group: "Spécialités médicales" },
  { name: "Endocrinologie – diabétologie – nutrition", group: "Spécialités médicales" },
  { name: "Diabétologie", group: "Spécialités médicales" },
  { name: "Nutrition", group: "Spécialités médicales" },
  { name: "Gastro-entérologie et hépatologie", group: "Spécialités médicales" },
  { name: "Génétique médicale", group: "Spécialités médicales" },
  { name: "Hématologie", group: "Spécialités médicales" },
  { name: "Immunologie clinique", group: "Spécialités médicales" },
  { name: "Infectiologie (maladies infectieuses)", group: "Spécialités médicales" },
  { name: "Néphrologie", group: "Spécialités médicales" },
  { name: "Neurologie", group: "Spécialités médicales" },
  { name: "Oncologie médicale", group: "Spécialités médicales" },
  { name: "Radiothérapie (oncologie)", group: "Spécialités médicales" },
  { name: "Pneumologie", group: "Spécialités médicales" },
  { name: "Rhumatologie", group: "Spécialités médicales" },
  { name: "Médecine vasculaire", group: "Spécialités médicales" },
  { name: "Angiologie – phlébologie", group: "Spécialités médicales" },
  { name: "Algologie (médecine de la douleur)", group: "Spécialités médicales" },
  { name: "Addictologie", group: "Spécialités médicales" },
  { name: "Andrologie", group: "Spécialités médicales" },
  { name: "Sexologie", group: "Spécialités médicales" },
  { name: "Médecine nucléaire", group: "Spécialités médicales" },
  { name: "Anatomie et cytologie pathologiques", group: "Spécialités médicales" },
  { name: "Biologie médicale", group: "Spécialités médicales" },
  { name: "Anesthésie – réanimation", group: "Spécialités médicales" },
  { name: "Médecine intensive – réanimation", group: "Spécialités médicales" },
  { name: "Médecine légale", group: "Spécialités médicales" },

  // Imagerie
  { name: "Radiologie et imagerie médicale", group: "Imagerie" },
  { name: "Échographie", group: "Imagerie" },

  // Femme & enfant
  { name: "Gynécologie médicale", group: "Femme & enfant" },
  { name: "Gynécologie – obstétrique", group: "Femme & enfant" },
  { name: "Sage-femme", group: "Femme & enfant" },
  { name: "Pédiatrie", group: "Femme & enfant" },
  { name: "Néonatologie", group: "Femme & enfant" },
  { name: "Chirurgie pédiatrique", group: "Femme & enfant" },

  // Yeux, ORL, dents
  { name: "Ophtalmologie", group: "Yeux, ORL, dents" },
  { name: "Orthoptiste", group: "Yeux, ORL, dents" },
  { name: "Opticien-lunetier", group: "Yeux, ORL, dents" },
  { name: "ORL et chirurgie cervico-faciale", group: "Yeux, ORL, dents" },
  { name: "Audioprothésiste", group: "Yeux, ORL, dents" },
  { name: "Chirurgien-dentiste", group: "Yeux, ORL, dents" },
  { name: "Orthodontiste", group: "Yeux, ORL, dents" },
  { name: "Stomatologie", group: "Yeux, ORL, dents" },
  { name: "Chirurgie maxillo-faciale", group: "Yeux, ORL, dents" },

  // Chirurgie
  { name: "Chirurgie générale", group: "Chirurgie" },
  { name: "Chirurgie viscérale et digestive", group: "Chirurgie" },
  { name: "Chirurgie orthopédique et traumatologie", group: "Chirurgie" },
  { name: "Chirurgie plastique, reconstructrice et esthétique", group: "Chirurgie" },
  { name: "Chirurgie thoracique et cardiovasculaire", group: "Chirurgie" },
  { name: "Chirurgie vasculaire", group: "Chirurgie" },
  { name: "Neurochirurgie", group: "Chirurgie" },
  { name: "Urologie", group: "Chirurgie" },

  // Santé mentale
  { name: "Psychiatrie", group: "Santé mentale" },
  { name: "Pédopsychiatrie", group: "Santé mentale" },
  { name: "Psychologue", group: "Santé mentale" },
  { name: "Psychologue clinicien", group: "Santé mentale" },
  { name: "Neuropsychologue", group: "Santé mentale" },
  { name: "Psychothérapeute", group: "Santé mentale" },
  { name: "Psychanalyste", group: "Santé mentale" },
  { name: "Psychomotricien", group: "Santé mentale" },
  { name: "Thérapeute de couple / familial", group: "Santé mentale" },
  { name: "Sexothérapeute", group: "Santé mentale" },
  { name: "Conseiller conjugal", group: "Santé mentale" },

  // Paramédical & rééducation
  { name: "Masseur-kinésithérapeute", group: "Paramédical & rééducation" },
  { name: "Ostéopathe", group: "Paramédical & rééducation" },
  { name: "Chiropracteur", group: "Paramédical & rééducation" },
  { name: "Étiopathe", group: "Paramédical & rééducation" },
  { name: "Ergothérapeute", group: "Paramédical & rééducation" },
  { name: "Orthophoniste", group: "Paramédical & rééducation" },
  { name: "Pédicure-podologue", group: "Paramédical & rééducation" },
  { name: "Diététicien(ne)", group: "Paramédical & rééducation" },
  { name: "Infirmier(ère)", group: "Paramédical & rééducation" },
  { name: "Infirmier(ère) en pratique avancée", group: "Paramédical & rééducation" },
  { name: "Orthoprothésiste", group: "Paramédical & rééducation" },

  // Médecines complémentaires
  { name: "Acupuncteur", group: "Médecines complémentaires" },
  { name: "Homéopathe", group: "Médecines complémentaires" },
  { name: "Naturopathe", group: "Médecines complémentaires" },
  { name: "Sophrologue", group: "Médecines complémentaires" },
  { name: "Hypnothérapeute", group: "Médecines complémentaires" },
  { name: "Réflexologue", group: "Médecines complémentaires" },
  { name: "Aromathérapeute", group: "Médecines complémentaires" },
  { name: "Art-thérapeute", group: "Médecines complémentaires" },
  { name: "Musicothérapeute", group: "Médecines complémentaires" },
  { name: "Autre", group: "Autre" },
];

export function searchSpecialties(q: string): Specialty[] {
  const s = q.trim().toLowerCase();
  if (!s) return SPECIALTIES;
  return SPECIALTIES.filter((sp) => sp.name.toLowerCase().includes(s) || sp.group.toLowerCase().includes(s));
}
