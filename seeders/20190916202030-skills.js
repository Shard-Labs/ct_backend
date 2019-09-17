'use strict';

const categories = [
  'accounting & consulting',
  'admin support',
  'customer service',
  'data science & analytics',
  'design & creative',
  'engineering & architecture',
  'IT & networking',
  'legal',
  'sales & marketing',
  'translation',
  'web, mobile & software dev',
  'writing',
];

const skills = {
  'accounting & consulting': [
    'accounting',
    'bookkeeping',
    'business analysis',
    'financial analysis & modeling',
    'financial management/CFO',
    'HR administration',
    'instructional design',
    'management consulting',
    'recruiting',
    'tax preparation',
    'training & development',
  ],

  'admin support': [
    'data entry',
    'online research',
    'order processing',
    'project management',
    'transcription',
    'virtual / administrative assistance',
  ],

  'customer service': [
    'customer service',
    'tech support',
  ],

  'data science & analytics': [
    'A/B testing',
    'bandits',
    'data analytics',
    'data engineering',
    'data extraction',
    'data mining',
    'data processing',
    'data visualization',
    'deep learning',
    'experimentation & testing',
    'knowledge representation',
    'machine learning',
  ],

  'design & creative': [
    '2D animation',
    '3D animation',
    'actor',
    'art direction',
    'audio editing',
    'audio production',
    'brand identity design',
    'brand strategy',
    'cartoonist',
    'creative direction',
    'editorial design',
    'exhibit design',
    'fashion design',
    'graphic design',
    'illustration',
    'image editing/retouching',
    'jewelry design',
    'motion graphics design',
    'music composition',
    'music production',
    'musician',
    'photography',
    'presentation design',
    'scriptwriting',
    'social media strategy',
    'store design',
    'video editing',
    'videographer',
    'vocalist',
    'voice talent',
    'VR & AR design',
  ],

  'engineering & architecture': [
    '3D modeling',
    '3D rendering',
    '3D visualization',
    'architecture',
    'BIM modeling',
    'biology',
    'CAD',
    'chemical engineering',
    'chemistry',
    'civil engineering',
    'electrical engineering',
    'electronic engineering',
    'energy management',
    'engineering tutoring',
    'HVAC & MEP design',
    'hydraulics engineering',
    'industrial design',
    'interior design',
    'landscape design',
    'logistics & supply chain management',
    'mathematics',
    'mechanical engineering',
    'oil & gas engineering',
    'PCB design',
    'physics',
    'process engineering',
    'product design',
    'quantity surveying',
    'science tutoring',
    'solar energy',
    'sourcing & procurement',
    'structural engineering',
    'wind energy',
  ],

  'IT & networking': [
    'database administration',
    'devops engineering',
    'information security',
    'network administration',
    'network security',
    'solutions architecture',
    'system administration',
    'systems architecture',
    'systems compliance',
    'systems engineering',
  ],

  'legal': [
    'business & corporate law',
    'general counsel',
    'immigration law',
    'intellectual property law',
    'international law',
    'labor & employment law',
    'paralegal',
    'regulatory law',
    'securities & finance law',
    'tax law',
  ],

  'sales & marketing': [
    'business development',
    'campaign management',
    'community management',
    'content strategy',
    'digital marketing',
    'email marketing',
    'lead generation',
    'market research',
    'marketing automation',
    'marketing strategy',
    'public relations',
    'search engine marketing',
    'search engine optimization',
    'social media marketing',
    'telemarketing',
  ],

  'translation': [
    'language localization',
    'language tutoring',
    'legal translation',
    'medical translation',
    'technical translation',
    'translation',
  ]
};

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const categoriesToInsert = categories.map(l => ({
      name: l,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await queryInterface.bulkInsert('categories', categoriesToInsert, {});

    const categoriesInDb = await queryInterface.sequelize.query(
        `SELECT id, name from categories;`
    );

    categoriesInDb[0].forEach(async (c) => {
      if (skills[c.name]) {
        const skillsToInsert = skills[c.name].map(s => ({
          name: s,
          categoryId: c.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        await queryInterface.bulkInsert('skills', skillsToInsert, {});
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('categories', null, {});
    await queryInterface.bulkDelete('skills', null, {});
  }
};
