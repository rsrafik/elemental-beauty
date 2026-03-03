export type SiteLab = {
  id: string;
  title: string;
  date: string;
  img: string;
  tags: string[];
  difficulty: string;
  time: string;
  description: string;
  visibility: 'Public' | 'Members Only';
  overview: string;
  formulationNotes: string[];
  keyFocus: string[];
};

export const siteLabs: SiteLab[] = [
  {
    id: '1',
    title: 'Vitamin C Serum',
    date: 'Feb 15, 2024',
    img: 'https://picsum.photos/seed/serum-vogue/800/600',
    tags: ['Antioxidant', 'Formulation'],
    difficulty: 'Intermediate',
    time: '2 hours',
    description: 'A stable, high-potency Vitamin C serum formulation using L-Ascorbic Acid and Ferulic Acid.',
    visibility: 'Public',
    overview:
      'This report studies stability, oxidation control, and texture balance in a water-based vitamin C system designed for visible brightness and barrier support.',
    formulationNotes: [
      'Balanced acid strength against usability and oxidation risk.',
      'Tested texture adjustments to keep the serum light instead of sticky.',
      'Used antioxidant support ingredients to protect the formula profile.',
    ],
    keyFocus: ['Stability testing', 'Oxidation control', 'Texture refinement'],
  },
  {
    id: '2',
    title: 'Hydrating Mist',
    date: 'Jan 28, 2024',
    img: 'https://picsum.photos/seed/mist-vogue/800/600',
    tags: ['Hydration', 'Botanical'],
    difficulty: 'Beginner',
    time: '1 hour',
    description: 'Refreshing facial mist with rose water, glycerin, and hyaluronic acid for instant hydration.',
    visibility: 'Public',
    overview:
      'This lab focused on lightweight hydration delivery and how to keep a mist refreshing without feeling sugary or leaving residue on the skin.',
    formulationNotes: [
      'Compared humectant levels for comfort versus tackiness.',
      'Refined botanical ratios to keep scent and skin feel balanced.',
      'Reviewed packaging considerations for repeated daily use.',
    ],
    keyFocus: ['Humectant balance', 'Botanical ratios', 'Packaging behavior'],
  },
  {
    id: '3',
    title: 'Mineral Sunscreen',
    date: 'Dec 12, 2023',
    img: 'https://picsum.photos/seed/sun-vogue/800/600',
    tags: ['SPF', 'Physical Filter'],
    difficulty: 'Advanced',
    time: '3 hours',
    description: 'Broad-spectrum SPF 30 formulation using non-nano Zinc Oxide and skin-soothing botanicals.',
    visibility: 'Members Only',
    overview:
      'A member-only advanced lab focused on dispersion, cast reduction, and sensory improvements in a mineral-first sunscreen base.',
    formulationNotes: [
      'Reviewed pigment dispersion challenges with mineral filters.',
      'Compared finish profiles across richer and lighter base systems.',
      'Tracked white-cast reduction strategies without overstating protection.',
    ],
    keyFocus: ['Dispersion', 'Finish optimization', 'Cast reduction'],
  },
  {
    id: '4',
    title: 'Gentle Cleanser',
    date: 'Nov 05, 2023',
    img: 'https://picsum.photos/seed/clean-vogue/800/600',
    tags: ['Cleansing', 'pH Balanced'],
    difficulty: 'Beginner',
    time: '1.5 hours',
    description: 'A non-foaming, pH-balanced cream cleanser designed for sensitive skin barriers.',
    visibility: 'Public',
    overview:
      'This report explored how to build a cleanser that feels gentle and substantial while respecting barrier health and rinse-off comfort.',
    formulationNotes: [
      'Adjusted surfactant levels to reduce harshness.',
      'Reviewed cream structure for slip and rinse profile.',
      'Checked pH range for sensitive-skin compatibility.',
    ],
    keyFocus: ['Mild cleansing', 'Cream texture', 'Barrier support'],
  },
];

export function getSiteLabById(id: string) {
  return siteLabs.find((lab) => lab.id === id);
}
