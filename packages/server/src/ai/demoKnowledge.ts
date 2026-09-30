/**
 * Static knowledge used by DemoProvider and LocalProvider.
 *
 * Deliberately plain data with no model download, so demo mode is fully offline
 * and instant. The alias table is the spec's normalization requirement
 * ("MS Excel -> Excel", "Postgres -> PostgreSQL").
 */

export const KNOWN_SKILL_ALIASES: ReadonlyMap<string, readonly string[]> = new Map([
  // Data & analytics
  ['Python', ['python3', 'py', 'python programming']],
  ['SQL', ['sql', 'structured query language', 't-sql', 'pl/sql']],
  ['Excel', ['microsoft excel', 'ms excel', 'spreadsheets', 'google sheets']],
  ['Statistics', ['statistical analysis', 'stats', 'probability and statistics']],
  ['Data Cleaning', ['data wrangling', 'data cleansing', 'data cleaning']],
  ['Data Visualization', ['data viz', 'dataviz', 'charting', 'data visualization']],
  ['Power BI', ['powerbi', 'power bi', 'power-bi']],
  ['Tableau', ['tableau desktop', 'tableau']],
  ['Data Analysis', ['data analysis', 'analytical reporting']],
  ['Machine Learning', ['ml', 'machine learning', 'scikit-learn', 'sklearn']],
  ['Deep Learning', ['deep learning', 'neural networks', 'pytorch', 'tensorflow']],
  ['Pandas', ['pandas', 'numpy', 'dataframes']],
  ['ETL', ['etl', 'data pipelines', 'data pipeline']],
  ['A/B Testing', ['ab testing', 'a/b testing', 'split testing', 'experimentation']],
  ['Communication', ['communication skills', 'communication', 'presenting']],

  // Databases
  ['PostgreSQL', ['postgres', 'postgresql', 'psql']],
  ['MongoDB', ['mongo', 'mongodb', 'mongoose']],
  ['MySQL', ['mysql', 'mariadb']],
  ['SQLite', ['sqlite']],
  ['Database Design', ['db design', 'database design', 'normalization', 'data modeling']],

  // Software
  ['Git', ['github', 'gitlab', 'version control', 'git']],
  ['JavaScript', ['javascript', 'js', 'ecmascript']],
  ['TypeScript', ['typescript', 'ts']],
  ['React', ['react.js', 'reactjs', 'react']],
  ['Node.js', ['node', 'nodejs', 'node.js']],
  ['Express', ['express', 'expressjs', 'express.js']],
  ['HTML', ['html', 'html5']],
  ['CSS', ['css', 'css3']],
  ['REST API', ['rest', 'rest api', 'restful', 'restful api']],
  ['Testing', ['unit testing', 'jest', 'pytest', 'testing', 'test automation']],
  ['Docker', ['docker', 'containerization', 'containers']],
  ['CI/CD', ['ci/cd', 'cicd', 'github actions', 'continuous integration']],

  // Cloud & security
  ['AWS', ['amazon web services', 'aws']],
  ['Linux', ['unix', 'linux', 'bash']],
  ['Networking', ['networking', 'tcp/ip', 'network fundamentals']],
  ['Cybersecurity', ['infosec', 'information security', 'cybersecurity', 'security analysis']],
  ['Threat Detection', ['threat detection', 'soc', 'incident detection', 'siem']],

  // Design
  ['UI Design', ['ui design', 'user interface design', 'interface design']],
  ['UX Design', ['ux design', 'user experience design', 'usability']],
  ['Figma', ['figma', 'figma design']],
  ['Prototyping', ['prototyping', 'wireframing', 'mockups']],

  // Business
  ['Business Analysis', ['business analysis', 'business analyst', 'requirement gathering']],
  ['Digital Marketing', ['digital marketing', 'seo', 'sem', 'online marketing']],
  ['Project Management', ['project management', 'scrum', 'agile', 'kanban']],
  ['Requirements Gathering', ['requirement gathering', 'user research', 'stakeholder interviews']],
]);

/** Keyword patterns for soft skills, which are not in the alias table. */
export const SKILL_KEYWORD_PATTERNS: ReadonlyMap<string, readonly string[]> = new Map([
  ['Communication', ['communicat', 'presented to', 'public speaking', 'explained to']],
  [
    'Teamwork',
    ['teamwork', 'collaborat', 'worked with a team', 'cross-functional', 'group project'],
  ],
  ['Problem Solving', ['problem[- ]solving', 'problem solving', 'troubleshoot', 'debugg']],
  ['Leadership', ['led a team', 'leadership', 'team lead', 'managed a team', 'captain']],
  ['Time Management', ['time management', 'deadline', 'prioriti[sz]ed', 'on time']],
  ['Critical Thinking', ['critical thinking', 'analys[sz]ed', 'evaluated', 'reasoning']],
  ['Adaptability', ['adaptab', 'flexible', 'quick learner', 'learned quickly']],
  [
    'Attention to Detail',
    ['attention to detail', 'meticulous', 'detail-oriented', 'detail oriented'],
  ],
]);

/** Simple negation of a confident framing, used by safety checks in tests. */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;
