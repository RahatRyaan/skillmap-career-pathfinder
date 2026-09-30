/**
 * Career-discovery quiz questions and achievement definitions.
 *
 * The quiz is deterministic: each option carries a career slug, and scores are
 * counted per slug. That keeps the suggestion honest and reproducible rather
 * than dependent on a model.
 */

export interface QuizOptionSeed {
  text: string;
  careerSlug: string | null;
}

export interface QuizQuestionSeed {
  order: number;
  prompt: string;
  options: QuizOptionSeed[];
}

export const QUIZ_QUESTIONS: QuizQuestionSeed[] = [
  {
    order: 1,
    prompt: 'When you get a dataset, what do you want to do first?',
    options: [
      { text: 'Understand the numbers and what they mean', careerSlug: 'data-analyst' },
      { text: 'Build a model that predicts something', careerSlug: 'data-scientist' },
      { text: 'Build a page or feature people can use', careerSlug: 'web-developer' },
      { text: 'Work out how the system should be designed', careerSlug: 'software-engineer' },
      { text: 'Decide how the user should experience it', careerSlug: 'ui-ux-designer' },
    ],
  },
  {
    order: 2,
    prompt: 'Which of these problems sounds most interesting to you?',
    options: [
      { text: 'Two reports disagree and you have to find out why', careerSlug: 'data-analyst' },
      {
        text: 'A model is accurate on test data but wrong in production',
        careerSlug: 'machine-learning-engineer',
      },
      { text: 'A login form is confusing and unsafe', careerSlug: 'cybersecurity-analyst' },
      { text: 'A deployment is slow and unreliable', careerSlug: 'cloud-engineer' },
      { text: 'Nobody can complete an application form', careerSlug: 'ui-ux-designer' },
    ],
  },
  {
    order: 3,
    prompt: 'How do you prefer to spend a working day?',
    options: [
      { text: 'Deep, quiet analysis with clear goals', careerSlug: 'data-scientist' },
      { text: 'Writing and refining code in short cycles', careerSlug: 'software-engineer' },
      { text: 'Talking to people and aligning them', careerSlug: 'business-analyst' },
      { text: 'Configuring systems and watching them run', careerSlug: 'cloud-engineer' },
      { text: 'Investigating alerts and incidents', careerSlug: 'cybersecurity-analyst' },
    ],
  },
  {
    order: 4,
    prompt: 'What would you rather be responsible for?',
    options: [
      { text: 'A dashboard leadership actually uses', careerSlug: 'data-analyst' },
      { text: 'A model that improves a real decision', careerSlug: 'data-scientist' },
      { text: 'An interface that feels obvious to use', careerSlug: 'ui-ux-designer' },
      { text: 'A campaign with measurable results', careerSlug: 'digital-marketing-specialist' },
      { text: 'A specification everyone agrees on', careerSlug: 'business-analyst' },
    ],
  },
  {
    order: 5,
    prompt: 'Which statement is closest to how you think?',
    options: [
      { text: 'I want evidence before I believe something', careerSlug: 'data-analyst' },
      {
        text: 'I want to understand why it works, not just that it does',
        careerSlug: 'data-scientist',
      },
      {
        text: 'I want to make it work for everyone, including edge cases',
        careerSlug: 'ui-ux-designer',
      },
      {
        text: 'I want to assume someone might be trying to break it',
        careerSlug: 'cybersecurity-analyst',
      },
      { text: 'I want it to keep working when I am not looking', careerSlug: 'cloud-engineer' },
    ],
  },
  {
    order: 6,
    prompt: 'You have three weeks free. What do you build?',
    options: [
      { text: 'A notebook analysing a dataset you care about', careerSlug: 'data-analyst' },
      { text: 'A working app other people can actually use', careerSlug: 'web-developer' },
      { text: 'A security lab you can attack safely', careerSlug: 'cybersecurity-analyst' },
      { text: 'A redesigned form, tested with real users', careerSlug: 'ui-ux-designer' },
      { text: 'A documented process improvement for a real team', careerSlug: 'business-analyst' },
    ],
  },
  {
    order: 7,
    prompt: 'Which of these would annoy you most?',
    options: [
      { text: 'A chart that hides how small the sample is', careerSlug: 'data-scientist' },
      { text: 'A feature with no error handling', careerSlug: 'software-engineer' },
      { text: 'A page that is slow on a cheap phone', careerSlug: 'web-developer' },
      {
        text: 'A claim in marketing with no evidence behind it',
        careerSlug: 'digital-marketing-specialist',
      },
      {
        text: 'A meeting where nobody wrote down what was decided',
        careerSlug: 'business-analyst',
      },
    ],
  },
  {
    order: 8,
    prompt: 'What kind of result makes your day?',
    options: [
      { text: 'Finding the one number that explains the problem', careerSlug: 'data-analyst' },
      {
        text: 'A model that generalises to data it has never seen',
        careerSlug: 'machine-learning-engineer',
      },
      { text: 'A service running reliably at 3am without you', careerSlug: 'cloud-engineer' },
      { text: 'Detecting a real attack among the noise', careerSlug: 'cybersecurity-analyst' },
      { text: 'A real person completing a task without help', careerSlug: 'ui-ux-designer' },
    ],
  },
  {
    order: 9,
    prompt: 'Which subject did you find easiest at university?',
    options: [
      { text: 'Statistics and mathematics', careerSlug: 'data-scientist' },
      { text: 'Programming and algorithms', careerSlug: 'software-engineer' },
      { text: 'Databases and information systems', careerSlug: 'web-developer' },
      { text: 'Networks and operating systems', careerSlug: 'cybersecurity-analyst' },
      { text: 'Management and communication', careerSlug: 'business-analyst' },
    ],
  },
  {
    order: 10,
    prompt: 'What would make you give up on a task?',
    options: [
      { text: 'Nobody agrees on what good looks like', careerSlug: 'business-analyst' },
      { text: 'The design looks right but does not work for users', careerSlug: 'ui-ux-designer' },
      {
        text: 'The system keeps breaking for reasons nobody can find',
        careerSlug: 'cloud-engineer',
      },
      {
        text: 'You cannot tell whether your change actually helped',
        careerSlug: 'digital-marketing-specialist',
      },
      { text: 'The data is too messy to draw conclusions from', careerSlug: 'data-analyst' },
    ],
  },
];

export interface AchievementSeed {
  slug: string;
  name: string;
  description: string;
  icon: string;
  rule: { type: string; threshold: number };
  order: number;
}

/**
 * Achievement rules are evaluated by progressService against real counts.
 * Never hardcode an award in a UI component.
 */
export const ACHIEVEMENTS: AchievementSeed[] = [
  {
    slug: 'first-skill-added',
    name: 'First Skill Added',
    description: 'You added your first skill to your map.',
    icon: 'sparkles',
    rule: { type: 'user_skill_count', threshold: 1 },
    order: 1,
  },
  {
    slug: 'five-skills',
    name: 'Five Skills Recorded',
    description: 'You have five skills on your map.',
    icon: 'layers',
    rule: { type: 'user_skill_count', threshold: 5 },
    order: 2,
  },
  {
    slug: 'fifteen-skills',
    name: 'Fifteen Skills Recorded',
    description: 'Your map now covers fifteen skills.',
    icon: 'layers',
    rule: { type: 'user_skill_count', threshold: 15 },
    order: 3,
  },
  {
    slug: 'target-chosen',
    name: 'Target Career Chosen',
    description: 'You picked a career to work towards.',
    icon: 'target',
    rule: { type: 'career_chosen', threshold: 1 },
    order: 4,
  },
  {
    slug: 'first-roadmap',
    name: 'First Roadmap Generated',
    description: 'Your personalised roadmap is ready.',
    icon: 'map',
    rule: { type: 'roadmap_count', threshold: 1 },
    order: 5,
  },
  {
    slug: 'first-item-done',
    name: 'First Step Completed',
    description: 'You completed your first roadmap item.',
    icon: 'check',
    rule: { type: 'completed_item_count', threshold: 1 },
    order: 6,
  },
  {
    slug: 'ten-items-done',
    name: 'Ten Steps Completed',
    description: 'Ten roadmap items are done.',
    icon: 'check-double',
    rule: { type: 'completed_item_count', threshold: 10 },
    order: 7,
  },
  {
    slug: 'sql-started',
    name: 'SQL Started',
    description: 'You began working on SQL.',
    icon: 'database',
    rule: { type: 'skill_started', threshold: 1 },
    order: 8,
  },
  {
    slug: 'first-project',
    name: 'First Project Done',
    description: 'You completed a practice project.',
    icon: 'hammer',
    rule: { type: 'project_completed', threshold: 1 },
    order: 9,
  },
  {
    slug: 'three-projects',
    name: 'Three Projects Done',
    description: 'Three practice projects completed.',
    icon: 'hammer',
    rule: { type: 'project_completed', threshold: 3 },
    order: 10,
  },
  {
    slug: 'first-study-session',
    name: 'Study Session Logged',
    description: 'You logged your first study session.',
    icon: 'clock',
    rule: { type: 'study_session_count', threshold: 1 },
    order: 11,
  },
  {
    slug: 'seven-day-streak',
    name: 'Seven-Day Streak',
    description: 'You studied seven days in a row.',
    icon: 'flame',
    rule: { type: 'streak_days', threshold: 7 },
    order: 12,
  },
  {
    slug: 'thirty-day-streak',
    name: 'Thirty-Day Streak',
    description: 'You studied thirty days in a row.',
    icon: 'flame',
    rule: { type: 'streak_days', threshold: 30 },
    order: 13,
  },
  {
    slug: 'roadmap-adapted',
    name: 'Plan Adapted',
    description: 'Your roadmap was updated based on your progress.',
    icon: 'refresh',
    rule: { type: 'roadmap_version_count', threshold: 2 },
    order: 14,
  },
  {
    slug: 'alignment-60',
    name: 'Alignment Above 60%',
    description: 'Your alignment reached 60% for your target career.',
    icon: 'trending-up',
    rule: { type: 'alignment_percent', threshold: 60 },
    order: 15,
  },
  {
    slug: 'alignment-80',
    name: 'Alignment Above 80%',
    description: 'Your alignment reached 80% for your target career.',
    icon: 'trophy',
    rule: { type: 'alignment_percent', threshold: 80 },
    order: 16,
  },
];
