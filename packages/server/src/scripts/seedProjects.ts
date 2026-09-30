/**
 * Practice projects.
 *
 * Each project maps to real skills and has a step checklist. Completing a
 * project can raise a student's skill level, but only with explicit
 * student confirmation — SkillMap never inflates a level on its own.
 */

export interface ProjectSeed {
  slug: string;
  title: string;
  description: string;
  careerSlug: string | null;
  level: 'beginner' | 'intermediate' | 'advanced';
  estimatedHours: number;
  skillSlugs: string[];
  steps: { title: string; description: string; skillSlug?: string }[];
}

export const PROJECTS: ProjectSeed[] = [
  // ─── Data Analyst ──────────────────────────────────────────────────────
  {
    slug: 'bus-ridership-dashboard',
    title: 'City Bus Ridership Dashboard',
    description:
      'Take a public transport dataset, find the patterns that matter, and build a dashboard someone else can use without asking you a question.',
    careerSlug: 'data-analyst',
    level: 'beginner',
    estimatedHours: 20,
    skillSlugs: ['sql', 'data-cleaning', 'data-visualization', 'excel'],
    steps: [
      {
        title: 'Load and profile the data',
        description:
          'Import the dataset, count rows, list columns, and identify missing values and duplicates.',
        skillSlug: 'data-cleaning',
      },
      {
        title: 'Write the core queries',
        description: 'Build queries for ridership by route, by hour, and by day of week.',
        skillSlug: 'sql',
      },
      {
        title: 'Clean the inconsistencies',
        description: 'Standardise route names and dates before any analysis is built on them.',
        skillSlug: 'data-cleaning',
      },
      {
        title: 'Build the dashboard',
        description: 'Create a summary page, a route detail page, and a time-of-day heatmap.',
        skillSlug: 'data-visualization',
      },
      {
        title: 'Write the findings',
        description: 'State three findings, and for each one name the number that supports it.',
        skillSlug: 'communication',
      },
    ],
  },
  {
    slug: 'ecommerce-retention-analysis',
    title: 'E-commerce Retention Analysis',
    description:
      'Work out why customers stop buying, and quantify each factor rather than guessing.',
    careerSlug: 'data-analyst',
    level: 'intermediate',
    estimatedHours: 30,
    skillSlugs: ['sql', 'statistics', 'data-analysis', 'data-visualization'],
    steps: [
      {
        title: 'Define retention precisely',
        description: 'Write down exactly what "retained" means before writing any query.',
        skillSlug: 'critical-thinking',
      },
      {
        title: 'Cohort the data',
        description: 'Group customers by first purchase month and track each cohort forward.',
        skillSlug: 'sql',
      },
      {
        title: 'Test the candidate causes',
        description:
          'For each suspected cause, check whether it actually separates retained from churned customers.',
        skillSlug: 'statistics',
      },
      {
        title: 'Quantify the effect',
        description: "Report the size of each factor's association, not just whether it exists.",
        skillSlug: 'data-analysis',
      },
      {
        title: 'Present with honest uncertainty',
        description: 'Show what the analysis cannot rule out as well as what it found.',
        skillSlug: 'communication',
      },
    ],
  },
  {
    slug: 'sales-performance-report',
    title: 'Monthly Sales Performance Report',
    description:
      'Build a repeatable report that answers "how are we doing and why" without manual spreadsheet work.',
    careerSlug: 'data-analyst',
    level: 'beginner',
    estimatedHours: 15,
    skillSlugs: ['excel', 'power-bi', 'data-visualization'],
    steps: [
      {
        title: 'Set up the data model',
        description: 'Link the source tables correctly and check the grain of each one.',
        skillSlug: 'excel',
      },
      {
        title: 'Build the core measures',
        description: 'Create revenue, growth, and average order value measures.',
        skillSlug: 'power-bi',
      },
      {
        title: 'Design the report page',
        description: 'Lead with the question the report answers, then the detail behind it.',
        skillSlug: 'data-visualization',
      },
      {
        title: 'Validate the numbers',
        description: 'Reconcile the total against the source. Explain any difference.',
        skillSlug: 'attention-to-detail',
      },
    ],
  },

  // ─── Data Scientist ────────────────────────────────────────────────────
  {
    slug: 'house-price-prediction',
    title: 'House Price Prediction with Honest Evaluation',
    description:
      'Build a regression model, then spend most of your effort proving how well it actually generalises.',
    careerSlug: 'data-scientist',
    level: 'intermediate',
    estimatedHours: 40,
    skillSlugs: ['python', 'pandas', 'machine-learning', 'model-evaluation', 'statistics'],
    steps: [
      {
        title: 'Explore the dataset',
        description: 'Look for leakage, missing values, and features that leak the target.',
        skillSlug: 'data-cleaning',
      },
      {
        title: 'Establish a baseline',
        description: 'Predict the mean. Any model must beat this to be worth anything.',
        skillSlug: 'regression',
      },
      {
        title: 'Split the data correctly',
        description:
          'Fit scalers and encoders on training data only, then apply them to test data.',
        skillSlug: 'model-evaluation',
      },
      {
        title: 'Train and compare models',
        description: 'Compare a linear model against a tree ensemble on the same split.',
        skillSlug: 'machine-learning',
      },
      {
        title: 'Report honestly',
        description: 'State the error, the split, and the cases the model handles badly.',
        skillSlug: 'technical-writing',
      },
    ],
  },
  {
    slug: 'churn-classifier',
    title: 'Customer Churn Classifier',
    description:
      'Predict which customers are likely to leave, and examine which features actually drive the prediction.',
    careerSlug: 'data-scientist',
    level: 'intermediate',
    estimatedHours: 35,
    skillSlugs: [
      'python',
      'machine-learning',
      'model-evaluation',
      'classification',
      'critical-thinking',
    ],
    steps: [
      {
        title: 'Check the class balance',
        description: 'Determine the base rate before choosing an evaluation metric.',
        skillSlug: 'statistics',
      },
      {
        title: 'Build a pipeline',
        description: 'Put preprocessing inside the pipeline so cross-validation is honest.',
        skillSlug: 'machine-learning',
      },
      {
        title: 'Evaluate with the right metric',
        description: 'Explain why accuracy alone would mislead here.',
        skillSlug: 'model-evaluation',
      },
      {
        title: 'Inspect feature importance',
        description: 'Identify which features drive predictions and whether they make sense.',
        skillSlug: 'classification',
      },
      {
        title: 'Document limitations',
        description: 'Write down where the model should not be used.',
        skillSlug: 'communication',
      },
    ],
  },

  // ─── Software Engineer ─────────────────────────────────────────────────
  {
    slug: 'rest-api-with-tests',
    title: 'REST API with a Real Test Suite',
    description:
      'Build an API that another developer can use without asking you anything, with tests that catch regressions.',
    careerSlug: 'software-engineer',
    level: 'beginner',
    estimatedHours: 25,
    skillSlugs: ['javascript', 'nodejs', 'express', 'rest-api', 'testing', 'sql'],
    steps: [
      {
        title: 'Design the resource model',
        description: 'Write down the entities and their relationships before writing any handler.',
        skillSlug: 'data-modeling',
      },
      {
        title: 'Implement the endpoints',
        description: 'Build CRUD routes with consistent response shapes and status codes.',
        skillSlug: 'rest-api',
      },
      {
        title: 'Add input validation',
        description: 'Reject bad input at the boundary with clear, field-level errors.',
        skillSlug: 'web-security',
      },
      {
        title: 'Add a central error handler',
        description: 'Every failure returns a consistent shape and never leaks internals.',
        skillSlug: 'problem-solving',
      },
      {
        title: 'Write the test suite',
        description: 'Cover the happy path, validation failures, and the not-found case.',
        skillSlug: 'testing',
      },
      {
        title: 'Document the endpoints',
        description: 'Write a README another developer can follow without your help.',
        skillSlug: 'technical-writing',
      },
    ],
  },
  {
    slug: 'task-management-app',
    title: 'Full-Stack Task Management App',
    description:
      'A complete app with authentication and role-based access, deployed and usable on a phone.',
    careerSlug: 'software-engineer',
    level: 'intermediate',
    estimatedHours: 45,
    skillSlugs: [
      'javascript',
      'react',
      'nodejs',
      'mongodb',
      'rest-api',
      'testing',
      'accessibility',
    ],
    steps: [
      {
        title: 'Set up authentication',
        description: 'Register, login, and logout with hashed passwords and signed tokens.',
        skillSlug: 'web-security',
      },
      {
        title: 'Build the data layer',
        description: 'Define schemas and enforce uniqueness at the database level.',
        skillSlug: 'mongodb',
      },
      {
        title: 'Build the interface',
        description: 'Responsive layout with real loading, empty, and error states.',
        skillSlug: 'react',
      },
      {
        title: 'Add role-based access',
        description: 'Separate student and admin capabilities and test the boundary.',
        skillSlug: 'problem-solving',
      },
      {
        title: 'Make it accessible',
        description: 'Keyboard navigation, focus management, and labelled controls throughout.',
        skillSlug: 'accessibility',
      },
      {
        title: 'Deploy it',
        description: 'Get it running in a container on a public URL.',
        skillSlug: 'docker',
      },
    ],
  },

  // ─── Web Developer ─────────────────────────────────────────────────────
  {
    slug: 'accessible-dashboard',
    title: 'Accessible Analytics Dashboard',
    description:
      'Build a chart-heavy dashboard that a keyboard and screen-reader user can operate completely.',
    careerSlug: 'web-developer',
    level: 'intermediate',
    estimatedHours: 30,
    skillSlugs: ['html', 'css', 'javascript', 'react', 'accessibility', 'data-visualization'],
    steps: [
      {
        title: 'Build the data table first',
        description: 'Every chart must have a working table fallback before the chart exists.',
        skillSlug: 'data-visualization',
      },
      {
        title: 'Structure the page semantically',
        description: 'Use the correct elements and heading order before styling anything.',
        skillSlug: 'html',
      },
      {
        title: 'Add keyboard interaction',
        description: 'All controls reachable and operable by keyboard, with visible focus.',
        skillSlug: 'accessibility',
      },
      {
        title: 'Style for both themes',
        description: 'Meet WCAG AA contrast in light and dark mode.',
        skillSlug: 'css',
      },
      {
        title: 'Test with a screen reader',
        description: 'Verify the content order and announcements actually make sense.',
        skillSlug: 'accessibility',
      },
    ],
  },
  {
    slug: 'low-data-portfolio',
    title: 'Low-Data Performance Portfolio',
    description: 'A personal site that loads in under 200 KB and works on a slow 3G connection.',
    careerSlug: 'web-developer',
    level: 'beginner',
    estimatedHours: 20,
    skillSlugs: ['html', 'css', 'javascript', 'web-performance', 'responsive-design'],
    steps: [
      {
        title: 'Build semantic HTML first',
        description: 'Content should work with no CSS and no JavaScript at all.',
        skillSlug: 'html',
      },
      {
        title: 'Write minimal CSS',
        description: 'A single small stylesheet that handles layout without a framework.',
        skillSlug: 'css',
      },
      {
        title: 'Add only necessary JavaScript',
        description: 'Every kilobyte of JavaScript must earn its place.',
        skillSlug: 'javascript',
      },
      {
        title: 'Measure and optimise',
        description: 'Check bundle size and load time, then reduce both.',
        skillSlug: 'web-performance',
      },
      {
        title: 'Verify on a slow connection',
        description: 'Throttle to 3G and confirm the site is still usable.',
        skillSlug: 'responsive-design',
      },
    ],
  },

  // ─── Cybersecurity Analyst ─────────────────────────────────────────────
  {
    slug: 'home-lab-detection-project',
    title: 'Home Lab Detection Project',
    description:
      'Build a small lab, generate real attack traffic against it, and write detections for what you observe.',
    careerSlug: 'cybersecurity-analyst',
    level: 'intermediate',
    estimatedHours: 40,
    skillSlugs: [
      'linux',
      'networking',
      'threat-detection',
      'docker',
      'python',
      'technical-writing',
    ],
    steps: [
      {
        title: 'Build the lab',
        description: 'Create an isolated network with a target and a monitoring host.',
        skillSlug: 'docker',
      },
      {
        title: 'Generate traffic',
        description: 'Run known attack techniques against your own lab only.',
        skillSlug: 'threat-detection',
      },
      {
        title: 'Collect the logs',
        description: 'Gather the evidence a defender would actually have.',
        skillSlug: 'networking',
      },
      {
        title: 'Write the detections',
        description: 'Create rules that fire on the behaviour, not on one IP address.',
        skillSlug: 'python',
      },
      {
        title: 'Write it up',
        description: 'Document what you saw, what you detected, and what you missed.',
        skillSlug: 'technical-writing',
      },
    ],
  },
  {
    slug: 'log-analysis-investigation',
    title: 'Log Analysis Investigation',
    description: 'Practise finding a real intrusion hidden inside mostly-benign log noise.',
    careerSlug: 'cybersecurity-analyst',
    level: 'beginner',
    estimatedHours: 15,
    skillSlugs: ['linux', 'threat-detection', 'critical-thinking', 'data-analysis'],
    steps: [
      {
        title: 'Baseline normal activity',
        description: 'Establish what ordinary traffic looks like before hunting anomalies.',
        skillSlug: 'data-analysis',
      },
      {
        title: 'Hunt for outliers',
        description: 'Search for the events that do not belong to the pattern.',
        skillSlug: 'threat-detection',
      },
      {
        title: 'Build a timeline',
        description: 'Reconstruct the sequence of what happened and when.',
        skillSlug: 'critical-thinking',
      },
      {
        title: 'Write the report',
        description: 'State what happened, the evidence, and the recommended action.',
        skillSlug: 'technical-writing',
      },
    ],
  },

  // ─── UI/UX Designer ────────────────────────────────────────────────────
  {
    slug: 'redesign-government-form',
    title: 'Redesign a Public-Service Form',
    description:
      'Take a real long government form, simplify it, and test whether people can actually complete it.',
    careerSlug: 'ui-ux-designer',
    level: 'intermediate',
    estimatedHours: 30,
    skillSlugs: [
      'ux-design',
      'ui-design',
      'figma',
      'prototyping',
      'research-design',
      'accessibility',
    ],
    steps: [
      {
        title: 'Map the current experience',
        description: 'Document every step, field, and point of confusion in the existing form.',
        skillSlug: 'ux-design',
      },
      {
        title: 'Interview real users',
        description: 'Watch at least five people try to complete it. Do not help them.',
        skillSlug: 'research-design',
      },
      {
        title: 'Redesign the flow',
        description: 'Cut fields, reorder by importance, and explain why in writing.',
        skillSlug: 'ui-design',
      },
      {
        title: 'Build a clickable prototype',
        description: 'In Figma, with states for error, empty, and success.',
        skillSlug: 'figma',
      },
      {
        title: 'Test again',
        description: 'Run the same task with the redesign and compare completion rates.',
        skillSlug: 'prototyping',
      },
      {
        title: 'Check accessibility',
        description: 'Ensure the design is operable with a keyboard alone.',
        skillSlug: 'accessibility',
      },
    ],
  },
  {
    slug: 'design-system-starter',
    title: 'Design System Starter for a Small Product',
    description:
      'Define tokens, components, and states so a small team ships a consistent product.',
    careerSlug: 'ui-ux-designer',
    level: 'beginner',
    estimatedHours: 20,
    skillSlugs: ['figma', 'ui-design', 'accessibility', 'technical-writing'],
    steps: [
      {
        title: 'Define the tokens',
        description: 'Set colour, spacing, and type scales with contrast already checked.',
        skillSlug: 'ui-design',
      },
      {
        title: 'Build the components',
        description: 'Button, input, card, table, and modal, each with every state.',
        skillSlug: 'figma',
      },
      {
        title: 'Document the rules',
        description: 'When to use each component and when not to.',
        skillSlug: 'technical-writing',
      },
      {
        title: 'Make states explicit',
        description: 'Default, hover, focus, disabled, error, and loading for every component.',
        skillSlug: 'accessibility',
      },
    ],
  },

  // ─── Cloud Engineer ────────────────────────────────────────────────────
  {
    slug: 'containerised-service-deployment',
    title: 'Containerised Service with HTTPS',
    description:
      'Deploy a real service with a reverse proxy, TLS, health checks, and working backups.',
    careerSlug: 'cloud-engineer',
    level: 'intermediate',
    estimatedHours: 35,
    skillSlugs: ['docker', 'linux', 'aws', 'networking', 'monitoring', 'web-security'],
    steps: [
      {
        title: 'Containerise the service',
        description: 'Write a multi-stage Dockerfile that keeps the image small.',
        skillSlug: 'docker',
      },
      {
        title: 'Set up the reverse proxy',
        description: 'Terminate TLS, route traffic, and refuse plain HTTP.',
        skillSlug: 'networking',
      },
      {
        title: 'Add health checks',
        description: 'A real health endpoint, and monitoring that notices failure.',
        skillSlug: 'monitoring',
      },
      {
        title: 'Automate backups',
        description: 'Scheduled backups with a tested restore procedure.',
        skillSlug: 'linux',
      },
      {
        title: 'Harden access',
        description:
          'Least-privilege permissions, no default credentials, keys in environment only.',
        skillSlug: 'web-security',
      },
    ],
  },
  {
    slug: 'infrastructure-as-code-migration',
    title: 'Infrastructure as Code Migration',
    description: 'Take an environment built by hand and make it reproducible from code.',
    careerSlug: 'cloud-engineer',
    level: 'advanced',
    estimatedHours: 40,
    skillSlugs: ['terraform', 'aws', 'docker', 'ci-cd', 'technical-writing'],
    steps: [
      {
        title: 'Inventory the existing environment',
        description: 'Document every resource before changing anything.',
        skillSlug: 'problem-solving',
      },
      {
        title: 'Write the Terraform configuration',
        description: 'Express the same environment as code, module by module.',
        skillSlug: 'terraform',
      },
      {
        title: 'Plan and review before applying',
        description: 'Read the plan output carefully. Never apply blind.',
        skillSlug: 'attention-to-detail',
      },
      {
        title: 'Automate the deployment',
        description: 'Run the apply from CI, with state stored remotely.',
        skillSlug: 'ci-cd',
      },
      {
        title: 'Document and hand over',
        description: 'Write the runbook another engineer would need.',
        skillSlug: 'technical-writing',
      },
    ],
  },

  {
    slug: 'containerised-ml-serving',
    title: 'Model Serving Service with Monitoring',
    description:
      'Wrap a trained model in an API that stays reliable, and know when it silently stops working.',
    careerSlug: 'machine-learning-engineer',
    level: 'intermediate',
    estimatedHours: 30,
    skillSlugs: [
      'python',
      'machine-learning',
      'rest-api',
      'docker',
      'monitoring',
      'model-evaluation',
    ],
    steps: [
      {
        title: 'Wrap the model',
        description: 'Load the model once and expose predict and health endpoints.',
        skillSlug: 'rest-api',
      },
      {
        title: 'Containerise it',
        description: 'Keep the image small and the startup fast.',
        skillSlug: 'docker',
      },
      {
        title: 'Add request validation',
        description: 'Reject malformed input at the boundary rather than inside the model.',
        skillSlug: 'problem-solving',
      },
      {
        title: 'Measure latency',
        description: 'Record p50 and p95, not just the average.',
        skillSlug: 'monitoring',
      },
      {
        title: 'Detect drift',
        description: 'Alert when the input distribution changes enough to matter.',
        skillSlug: 'model-evaluation',
      },
    ],
  },

  // ─── Digital Marketing ─────────────────────────────────────────────────
  {
    slug: 'local-business-campaign',
    title: 'Local Business Marketing Campaign',
    description:
      'Run a real small campaign and report what actually happened, including what failed.',
    careerSlug: 'digital-marketing-specialist',
    level: 'intermediate',
    estimatedHours: 30,
    skillSlugs: [
      'seo',
      'content-strategy',
      'social-media',
      'google-analytics',
      'copywriting',
      'data-analysis',
    ],
    steps: [
      {
        title: 'Define the objective',
        description: 'One measurable goal, written down before anything is built.',
        skillSlug: 'research-design',
      },
      {
        title: 'Research the audience',
        description: 'Find out where this audience actually spends time.',
        skillSlug: 'content-strategy',
      },
      {
        title: 'Create the content',
        description: 'Write for one channel first rather than five poorly.',
        skillSlug: 'copywriting',
      },
      {
        title: 'Set up measurement',
        description: 'Install analytics and record the baseline before launch.',
        skillSlug: 'google-analytics',
      },
      {
        title: 'Run and adjust',
        description: 'Change one variable at a time so you know why results changed.',
        skillSlug: 'ab-testing',
      },
      {
        title: 'Report honestly',
        description: 'Include what did not work and what you would change.',
        skillSlug: 'communication',
      },
    ],
  },
  {
    slug: 'seo-content-audit',
    title: 'SEO Content Audit',
    description:
      'Audit a real website and prioritise fixes by impact and effort rather than by taste.',
    careerSlug: 'digital-marketing-specialist',
    level: 'beginner',
    estimatedHours: 15,
    skillSlugs: ['seo', 'content-strategy', 'data-analysis', 'technical-writing'],
    steps: [
      {
        title: 'Crawl and inventory',
        description: 'List every page, its title, meta description, and heading structure.',
        skillSlug: 'seo',
      },
      {
        title: 'Identify the real problems',
        description: 'Separate issues that block indexing from issues that merely annoy.',
        skillSlug: 'data-analysis',
      },
      {
        title: 'Prioritise',
        description: 'Rank fixes by expected impact divided by effort.',
        skillSlug: 'content-strategy',
      },
      {
        title: 'Write the report',
        description: 'Each finding needs evidence, a recommendation, and a priority.',
        skillSlug: 'technical-writing',
      },
    ],
  },

  // ─── Business Analyst ──────────────────────────────────────────────────
  {
    slug: 'process-improvement-case',
    title: 'Process Improvement Case Study',
    description:
      'Map a real process, find the actual bottleneck, and quantify a proposed change before building it.',
    careerSlug: 'business-analyst',
    level: 'intermediate',
    estimatedHours: 25,
    skillSlugs: [
      'requirements-gathering',
      'process-mapping',
      'data-analysis',
      'stakeholder-management',
      'presentation',
    ],
    steps: [
      {
        title: 'Map the current state',
        description: 'Document the process as it actually happens, not as it is supposed to.',
        skillSlug: 'process-mapping',
      },
      {
        title: 'Measure it',
        description: 'Collect data on time, volume, and error rates at each step.',
        skillSlug: 'data-analysis',
      },
      {
        title: 'Find the bottleneck',
        description: 'Identify the constraint, and quantify what it costs.',
        skillSlug: 'critical-thinking',
      },
      {
        title: 'Propose a change',
        description: 'Design the improvement and estimate the benefit honestly.',
        skillSlug: 'stakeholder-management',
      },
      {
        title: 'Present and defend it',
        description: 'Anticipate objections and answer them with the data.',
        skillSlug: 'presentation',
      },
    ],
  },
  {
    slug: 'requirements-specification',
    title: 'Complete System Specification',
    description:
      'Write a specification another developer could build from without asking you anything.',
    careerSlug: 'business-analyst',
    level: 'beginner',
    estimatedHours: 18,
    skillSlugs: [
      'requirements-gathering',
      'business-analysis',
      'technical-writing',
      'stakeholder-management',
    ],
    steps: [
      {
        title: 'Gather requirements',
        description: 'Interview stakeholders and write down what each one actually needs.',
        skillSlug: 'requirements-gathering',
      },
      {
        title: 'Separate need from solution',
        description: 'Document the problem, not the feature someone imagined.',
        skillSlug: 'business-analysis',
      },
      {
        title: 'Write acceptance criteria',
        description: 'Testable statements for every requirement.',
        skillSlug: 'technical-writing',
      },
      {
        title: 'Review with stakeholders',
        description: 'Get explicit agreement on scope and priorities.',
        skillSlug: 'stakeholder-management',
      },
    ],
  },
];
