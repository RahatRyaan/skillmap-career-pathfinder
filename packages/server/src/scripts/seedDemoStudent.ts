/**
 * Demo student.
 *
 * Exactly the profile the specification describes: targeting Data Analyst with
 * Python 3, Excel 3, SQL 1, Statistics 2, Communication 3. These numbers are
 * chosen so the gap engine produces a visible, interesting result on first
 * load rather than a flat or empty screen.
 *
 * The password is for demonstration only and is documented in the demo guide.
 */

export const DEMO_STUDENT = {
  name: 'Ayesha Rahman',
  email: 'demo@skillmap.ai',
  password: 'Demo1234',
  university: 'University of Dhaka',
  department: 'Statistics',
  academicYear: 'Final year',
  interests: ['data analysis', 'visualisation', 'public sector'],
  targetCareerSlug: 'data-analyst',
  weeklyStudyHours: 6,
  skills: [
    { skillSlug: 'python', level: 3 as const, source: 'self_reported' as const },
    { skillSlug: 'excel', level: 3 as const, source: 'self_reported' as const },
    { skillSlug: 'sql', level: 1 as const, source: 'self_reported' as const },
    { skillSlug: 'statistics', level: 2 as const, source: 'quiz_verified' as const },
    { skillSlug: 'communication', level: 3 as const, source: 'self_reported' as const },
    { skillSlug: 'data-visualization', level: 2 as const, source: 'ai_extracted' as const },
    { skillSlug: 'time-management', level: 2 as const, source: 'self_reported' as const },
  ],
};

/** Fictional sample CVs for Demo Mode. No real person's data. */
export interface SampleCv {
  slug: string;
  title: string;
  isFictional: true;
  text: string;
}

export const SAMPLE_CVS: SampleCv[] = [
  {
    slug: 'sample-software-fresh-grad',
    title: 'Sample: Software Engineering Fresh Graduate',
    isFictional: true,
    text: `SAMIRA HOSSAIN
Software Engineering Fresh Graduate
Dhaka, Bangladesh

EDUCATION
BSc in Computer Science and Engineering
University of Dhaka
Graduation expected 2026

PROJECTS
Campus Event Management System
Built a full-stack web application using React, Node.js, Express and MongoDB.
Implemented JWT authentication and role-based access control.

Weather Dashboard
Created a responsive dashboard consuming a public weather API with error and
loading states.

SKILLS
JavaScript, TypeScript, React, Node.js, Express, MongoDB, Git, HTML, CSS

CERTIFICATIONS
Meta Front-End Developer Professional Certificate

TOOLS
Visual Studio Code, Postman, GitHub

EXPERIENCE
Software Engineering Intern
Contributed bug fixes and wrote unit tests for an internal reporting tool.
Used Git branches and pull requests in a team of four.`,
  },
  {
    slug: 'sample-business-analyst',
    title: 'Sample: Business Analyst Final-Year Student',
    isFictional: true,
    text: `TAHMINA ISLAM
Business Administration, Final Year
North South University

EDUCATION
BBA in Accounting and Finance
North South University
Graduation expected 2026

PROJECTS
Retail Process Improvement Study
Mapped the full purchase-to-delivery process for a local retailer using process
mapping. Identified a manual approval step causing a two-day delay, and
quantified the delay for the operations manager.

Customer Feedback Analysis
Cleaned 1,200 survey responses in Excel, grouped themes, and presented findings
with recommendations.

SKILLS
Excel, SQL, Data Analysis, Requirements Gathering, Stakeholder Management,
Process Mapping, Communication, Presentation

TOOLS
Microsoft Excel, Google Sheets, Power BI, Notion, Jira

CERTIFICATIONS
Google Data Analytics Professional Certificate

EXPERIENCE
Business Analysis Intern
Observed a requirements workshop and produced a written summary of stakeholder
needs with acceptance criteria.`,
  },
];
