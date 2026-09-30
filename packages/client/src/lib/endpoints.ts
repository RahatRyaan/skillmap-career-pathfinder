/**
 * Typed endpoint wrappers.
 *
 * Pages call these instead of composing URL strings, so a contract change in
 * @skillmap/shared surfaces as a TypeScript error in one file rather than a
 * runtime 404 in thirty.
 */

import type {
  AssistantResponse,
  AuthResponse,
  CareerDetail,
  CareerListItem,
  CvDocumentResponse,
  DashboardResponse,
  ImpactResponse,
  LoginRequest,
  Paginated,
  PreferencesResponse,
  PrioritiesResponse,
  ProfileResponse,
  ProjectResponse,
  QuizSuggestion,
  RegisterRequest,
  ResourceResponse,
  RoadmapResponse,
  SimulationResult,
  SkillCatalogItem,
  SkillGapResponse,
  UserSkillResponse,
  Paginated as Paged,
} from '@skillmap/shared';
import { api } from './api';

/** Auth */
export const authApi = {
  register: (body: RegisterRequest) => api.anonymous.post<AuthResponse>('/auth/register', body),
  login: (body: LoginRequest) => api.anonymous.post<AuthResponse>('/auth/login', body),
  logout: (refreshToken: string) => api.post<void>('/auth/logout', { refreshToken }),
  logoutAll: () => api.post<void>('/auth/logout-all'),
  deleteAccount: () => api.delete<void>('/account'),
};

/** Profile and preferences */
export const profileApi = {
  get: (signal?: AbortSignal) => api.get<ProfileResponse>('/profile', signal),
  update: (body: Partial<ProfileResponse>) => api.put<ProfileResponse>('/profile', body),
  updatePreferences: (body: Partial<PreferencesResponse>) =>
    api.put<PreferencesResponse>('/preferences', body),
  updateOnboarding: (body: { currentStep: string; completedSteps: string[]; skipped?: boolean }) =>
    api.put<ProfileResponse>('/profile/onboarding', body),
};

/** Skills */
export const skillsApi = {
  catalog: (params: { search?: string; category?: string; page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') query.set(key, String(value));
    }
    const suffix = query.toString();
    return api.get<Paginated<SkillCatalogItem>>(`/skills${suffix ? `?${suffix}` : ''}`);
  },
  mine: (signal?: AbortSignal) => api.get<{ items: UserSkillResponse[] }>('/user-skills', signal),
  add: (body: { skillId: string; level: number; source?: string; evidence?: string }) =>
    api.post<UserSkillResponse>('/user-skills', body),
  update: (id: string, body: { level?: number; evidence?: string }) =>
    api.put<UserSkillResponse>(`/user-skills/${id}`, body),
  remove: (id: string) => api.delete<void>(`/user-skills/${id}`),
};

/** Careers */
export const careersApi = {
  list: (
    params: { search?: string; category?: string; page?: number; limit?: number } = {},
    signal?: AbortSignal,
  ) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') query.set(key, String(value));
    }
    const suffix = query.toString();
    return api.get<Paginated<CareerListItem>>(`/careers${suffix ? `?${suffix}` : ''}`, signal);
  },
  detail: (id: string, signal?: AbortSignal) => api.get<CareerDetail>(`/careers/${id}`, signal),
  compare: (ids: string[], signal?: AbortSignal) =>
    api.get<{
      careers: (CareerDetail extends never
        ? never
        : {
            id: string;
            name: string;
            category: string;
            summary: string;
            alignmentPercent: number | null;
            requiredSkillCount: number;
            missingSkillCount: number | null;
            topGaps: { skillName: string; gap: number; importance: string }[];
            sharedSkillCount: number;
          })[];
      sharedSkillCount: number;
      disclaimer: string;
    }>(`/careers/compare?ids=${ids.join(',')}`, signal),
};

/** Analysis */
export const analysisApi = {
  gap: (careerId: string, signal?: AbortSignal) =>
    api.get<SkillGapResponse>(`/skill-gap/${careerId}`, signal),
  priorities: (careerId: string, signal?: AbortSignal) =>
    api.get<PrioritiesResponse>(`/careers/${careerId}/priorities`, signal),
  simulate: (careerId: string, changes: { skillId: string; newLevel: number }[]) =>
    api.post<SimulationResult>('/skill-gap/simulate', { careerId, changes }),
  skillMap: (careerId: string, signal?: AbortSignal) =>
    api.get<{
      careerId: string;
      careerName: string;
      nodes: {
        id: string;
        label: string;
        category: string;
        currentLevel: number;
        requiredLevel: number;
        gap: number;
        importance: string;
        isCore: boolean;
        status: string;
        reason: string;
      }[];
      edges: { source: string; target: string }[];
      alignmentPercent: number;
      disclaimer: string;
    }>(`/skill-map/${careerId}`, signal),
  trends: (careerId?: string, signal?: AbortSignal) =>
    api.get<{ points: { takenAt: string; percent: number }[] }>(
      careerId ? `/dashboard/trends?careerId=${careerId}` : '/dashboard/trends',
      signal,
    ),
  analyzeJobDescription: (text: string) =>
    api.post<{
      detectedSkills: { name: string; confidence: number }[];
      matchedSkills: { id: string; name: string; confidence: number }[];
      studentHasMatched: number;
      matchPercent: number | null;
      seniorityHint: string;
      mode: string;
      notice: string | null;
    }>('/job-description/analyze', { text }),
};

/** CV */
export const cvApi = {
  list: () => api.get<{ items: CvDocumentResponse[] }>('/cv'),
  get: (id: string) => api.get<CvDocumentResponse>(`/cv/${id}`),
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<CvDocumentResponse>('/cv/upload', form);
  },
  review: (
    id: string,
    items: {
      extractionId: string;
      decision: 'accept' | 'reject' | 'edit';
      skillId?: string;
      level?: number;
      value?: string;
    }[],
  ) =>
    api.put<
      CvDocumentResponse & {
        summary: { message: string; accepted: number; rejected: number; edited: number };
      }
    >(`/cv/${id}/review`, { items }),
  remove: (id: string) => api.delete<void>(`/cv/${id}`),
  samples: () =>
    api.get<{ notice: string; samples: { slug: string; title: string; textLength: number }[] }>(
      '/cv/samples',
    ),
  loadSample: (slug: string) =>
    api.post<CvDocumentResponse & { notice: string }>(`/cv/samples/${slug}`),
};

/** Roadmap and progress */
export const roadmapApi = {
  current: (careerId?: string, signal?: AbortSignal) =>
    api.get<RoadmapResponse>(`/roadmap${careerId ? `?careerId=${careerId}` : ''}`, signal),
  generate: (careerId: string, body: { weeklyStudyHours?: number; months?: number } = {}) =>
    api.post<
      RoadmapResponse & { isReplan: boolean; carriedOverItems: number; newAchievements: unknown[] }
    >('/roadmap/generate', { careerId, ...body }),
  versions: (careerId: string) =>
    api.get<{
      versions: { version: number; isCurrent: boolean; createdAt: string; changeLog: string[] }[];
    }>(`/roadmap/versions?careerId=${careerId}`),
  changes: (careerId: string) =>
    api.get<{
      fromVersion: number;
      toVersion: number;
      changeLog: string[];
      changedItemCount: number;
      createdAt: string | null;
    }>(`/roadmap/changes?careerId=${careerId}`),
  updateItem: (
    itemId: string,
    body: { status: string; actualHours?: number; note?: string; newLevel?: number },
  ) =>
    api.put<{
      itemId: string;
      status: string;
      levelRaised: boolean;
      alignmentPercent: number;
      newAchievements: unknown[];
      replanSuggested: boolean;
      replanReason: string | null;
    }>(`/progress/${itemId}`, body),
  logSession: (body: {
    minutes: number;
    skillId?: string;
    roadmapItemId?: string;
    note?: string;
  }) => api.post<{ logged: boolean; newAchievements: unknown[] }>('/study-sessions', body),
};

/** Learning content */
export const learningApi = {
  resources: (
    params: {
      skillId?: string;
      level?: number;
      type?: string;
      free?: boolean;
      language?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
    signal?: AbortSignal,
  ) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') query.set(key, String(value));
    }
    const suffix = query.toString();
    return api.get<Paginated<ResourceResponse>>(`/resources${suffix ? `?${suffix}` : ''}`, signal);
  },
  projects: (careerId?: string, signal?: AbortSignal) =>
    api.get<{ items: ProjectResponse[] }>(
      `/projects${careerId ? `?careerId=${careerId}` : ''}`,
      signal,
    ),
  updateProject: (id: string, body: { status: string; confirmSkillUpdates: boolean }) =>
    api.put<{ projectId: string; status: string; levelsRaised: number; note: string }>(
      `/user-projects/${id}`,
      body,
    ),
};

/** Dashboard, quiz, assistant */
export const appApi = {
  dashboard: (signal?: AbortSignal) => api.get<DashboardResponse>('/dashboard', signal),
  achievements: () =>
    api.get<{
      items: {
        id: string;
        name: string;
        description: string;
        icon: string;
        earnedAt: string | null;
      }[];
    }>('/achievements'),
  quizQuestions: () =>
    api.get<{ id: string; order: number; prompt: string; options: { text: string }[] }[]>(
      '/quiz/questions',
    ),
  submitQuiz: (answers: { questionId: string; optionIndex: number }[]) =>
    api.post<{ suggestions: QuizSuggestion[] }>('/quiz/submit', { answers }),
  askAssistant: (message: string, conversationId?: string, pageContext?: string) =>
    api.post<AssistantResponse>('/assistant/chat', {
      message,
      ...(conversationId ? { conversationId } : {}),
      ...(pageContext ? { pageContext } : {}),
    }),
  aiMode: () =>
    api.get<{
      mode: string;
      available: boolean;
      description: string;
      usesRealLlm: boolean;
      deterministic: boolean;
      notice: string | null;
    }>('/system/ai-mode'),
};

/** Admin */
export const adminApi = {
  impact: () => api.get<ImpactResponse>('/admin/impact'),
  stats: () => api.get<Record<string, number | string>>('/admin/stats'),
  careers: () =>
    api.get<{ items: Record<string, unknown>[]; total: number }>('/admin/careers?limit=100'),
  skills: () =>
    api.get<{ items: Record<string, unknown>[]; total: number }>('/admin/skills?limit=100'),
  mappings: (careerId?: string) =>
    api.get<{ items: Record<string, unknown>[] }>(
      `/admin/career-skills${careerId ? `?careerId=${careerId}` : ''}`,
    ),
  resources: () =>
    api.get<{ items: Record<string, unknown>[]; total: number }>('/admin/resources?limit=100'),
  projects: () =>
    api.get<{ items: Record<string, unknown>[]; total: number }>('/admin/projects?limit=100'),
  users: () =>
    api.get<{ items: Record<string, unknown>[]; total: number }>('/admin/users?limit=100'),
  jobDescriptions: () =>
    api.get<{ items: Record<string, unknown>[]; total: number }>(
      '/admin/job-descriptions?limit=100',
    ),
  setUserActive: (id: string, isActive: boolean) =>
    api.patch<{ id: string; isActive: boolean }>(`/admin/users/${id}/active`, { isActive }),
  deleteResource: (id: string) => api.delete<void>(`/admin/resources/${id}`),
  deleteMapping: (careerId: string, skillId: string) =>
    api.delete<void>(`/admin/career-skills/${careerId}/${skillId}`),
};

export type { Paged };
