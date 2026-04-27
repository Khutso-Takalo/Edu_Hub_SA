import { useState, useCallback, useMemo } from 'react';
import { db } from '@/infrastructure/database/indexeddb/schema';
import { useAuth } from './useAuth';

// Type definitions
export interface WorkExperience {
  id?: string;
  jobTitle: string;
  companyName: string;
  location: string;
  startDate: string;
  endDate: string;
  currentlyWorking: boolean;
  description: string;
}

export interface Education {
  id?: string;
  schoolName: string;
  fieldOfStudy: string;
  degree: string;
  startDate: string;
  endDate: string;
  grade: string;
  activities: string;
}

export interface Skill {
  id?: string;
  skill: string;
  endorsements?: number;
}

export interface Achievement {
  id?: string;
  title: string;
  description: string;
  date: string;
  achievementType: string;
}

export interface Certification {
  id?: string;
  name: string;
  issuedBy: string;
  certificationDate: string;
  expiryDate?: string;
  credentialUrl?: string;
}

export interface CVProfile {
  id?: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  selectedTemplate: string;
  experiences: WorkExperience[];
  education: Education[];
  skills: Skill[];
  achievements: Achievement[];
  certifications: Certification[];
  createdAt: string;
  updatedAt: string;
}

export interface ATSAnalysis {
  id?: string;
  cvProfileId: string;
  keywordScore: number;
  formattingScore: number;
  readabilityScore: number;
  overallScore: number;
  missingKeywords: string[];
  suggestedKeywords: string[];
  formattingIssues: string[];
  strengths: string[];
  improvements: string[];
  analysisDate: string;
}

export const useCV = () => {
  const { profile } = useAuth();
  const [cvProfile, setCVProfile] = useState<CVProfile | null>(null);
  const [atsAnalysis, setATSAnalysis] = useState<ATSAnalysis | null>(null);
  const [atsHistory, setATSHistory] = useState<ATSAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadATSHistory = useCallback(async (cvProfileId: string, limit = 10) => {
    if (!cvProfileId) {
      setATSHistory([]);
      return [];
    }

    try {
      const rows = await db.table('atsAnalyses').where('cvProfileId').equals(cvProfileId).toArray();
      const sorted = rows
        .sort(
          (a, b) =>
            new Date(b.analysisDate).getTime() - new Date(a.analysisDate).getTime()
        )
        .slice(0, limit) as ATSAnalysis[];
      setATSHistory(sorted);
      return sorted;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load ATS history';
      setError(errorMsg);
      return [];
    }
  }, []);

  // Load CV profile by user ID
  const loadCV = useCallback(async (userId: string) => {
    if (!userId) return null;
    try {
      setLoading(true);
      setError(null);
      const cv = await db.table('cvProfiles').where('userId').equals(userId).first();
      if (cv) {
        // Load related data
        const [experiences, education, skills, achievements, certifications] = await Promise.all([
          db.table('cvExperiences').where('cvProfileId').equals(cv.id).toArray(),
          db.table('cvEducation').where('cvProfileId').equals(cv.id).toArray(),
          db.table('cvSkills').where('cvProfileId').equals(cv.id).toArray(),
          db.table('cvAchievements').where('cvProfileId').equals(cv.id).toArray(),
          db.table('cvCertifications').where('cvProfileId').equals(cv.id).toArray(),
        ]);

        const fullCV = {
          ...cv,
          experiences: experiences || [],
          education: education || [],
          skills: skills || [],
          achievements: achievements || [],
          certifications: certifications || [],
        };
        setCVProfile(fullCV);
        return fullCV;
      }
      return null;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load CV';
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create or update CV profile
  const saveCV = useCallback(async (cvData: CVProfile) => {
    if (!profile?.id) return null;
    try {
      setLoading(true);
      setError(null);

      const now = new Date().toISOString();
      const cvToSave = {
        ...cvData,
        userId: profile.id,
        updatedAt: now,
        createdAt: cvData.createdAt || now,
      };

      // Remove nested arrays before saving main profile
      const { experiences, education, skills, achievements, certifications, ...profileData } =
        cvToSave;

      let cvId = cvData.id;
      if (cvId) {
        await db.table('cvProfiles').put(profileData);
      } else {
        cvId = (await db.table('cvProfiles').add(profileData)) as string;
      }

      // Replace nested rows for this CV to avoid duplicate entries after each save.
      await Promise.all([
        db.table('cvExperiences').where('cvProfileId').equals(cvId).delete(),
        db.table('cvEducation').where('cvProfileId').equals(cvId).delete(),
        db.table('cvSkills').where('cvProfileId').equals(cvId).delete(),
        db.table('cvAchievements').where('cvProfileId').equals(cvId).delete(),
        db.table('cvCertifications').where('cvProfileId').equals(cvId).delete(),
      ]);

      // Save nested data
      if (experiences.length > 0) {
        const expToSave = experiences.map((exp) => ({
          ...exp,
          cvProfileId: cvId,
        }));
        await db.table('cvExperiences').bulkPut(expToSave);
      }

      if (education.length > 0) {
        const eduToSave = education.map((edu) => ({
          ...edu,
          cvProfileId: cvId,
        }));
        await db.table('cvEducation').bulkPut(eduToSave);
      }

      if (skills.length > 0) {
        const skillsToSave = skills.map((skill) => ({
          ...skill,
          cvProfileId: cvId,
        }));
        await db.table('cvSkills').bulkPut(skillsToSave);
      }

      if (achievements.length > 0) {
        const achToSave = achievements.map((ach) => ({
          ...ach,
          cvProfileId: cvId,
        }));
        await db.table('cvAchievements').bulkPut(achToSave);
      }

      if (certifications.length > 0) {
        const certToSave = certifications.map((cert) => ({
          ...cert,
          cvProfileId: cvId,
        }));
        await db.table('cvCertifications').bulkPut(certToSave);
      }

      const saved = await loadCV(profile.id);
      return saved;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save CV';
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [profile?.id, loadCV]);

  // Delete CV profile
  const deleteCV = useCallback(async (cvId: string) => {
    try {
      setLoading(true);
      setError(null);
      await db.table('cvProfiles').delete(cvId);
      await db.table('cvExperiences').where('cvProfileId').equals(cvId).delete();
      await db.table('cvEducation').where('cvProfileId').equals(cvId).delete();
      await db.table('cvSkills').where('cvProfileId').equals(cvId).delete();
      await db.table('cvAchievements').where('cvProfileId').equals(cvId).delete();
      await db.table('cvCertifications').where('cvProfileId').equals(cvId).delete();
      setCVProfile(null);
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete CV';
      setError(errorMsg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Analyze CV for ATS compliance
  const analyzeCV = useCallback(async (cv: CVProfile): Promise<ATSAnalysis | null> => {
    try {
      setLoading(true);
      setError(null);

      // Common relevant keywords for South African students
      const relevantKeywords = [
        'leadership',
        'teamwork',
        'communication',
        'problem-solving',
        'project management',
        'data analysis',
        'technical skills',
        'academic excellence',
        'volunteer',
        'research',
        'python',
        'javascript',
        'java',
        'sql',
        'html',
        'css',
        'agile',
        'excel',
        'analytical',
        'strategic',
        'creative',
      ];

      // Combine all CV text
      const cvText = [
        cv.summary,
        cv.experiences.map((e) => `${e.jobTitle} ${e.companyName} ${e.description}`).join(' '),
        cv.education.map((e) => `${e.degree} ${e.fieldOfStudy} ${e.activities}`).join(' '),
        cv.skills.map((s) => s.skill).join(' '),
        cv.achievements.map((a) => `${a.title} ${a.description}`).join(' '),
        cv.certifications.map((c) => c.name).join(' '),
      ]
        .join(' ')
        .toLowerCase();

      // Keyword Score (0-25)
      const foundKeywords = relevantKeywords.filter((kw) => cvText.includes(kw.toLowerCase()));
      const keywordScore = Math.min(25, (foundKeywords.length / relevantKeywords.length) * 25);

      const missingKeywords = relevantKeywords.filter(
        (kw) => !cvText.includes(kw.toLowerCase())
      );
      const suggestedKeywords = missingKeywords.slice(0, 5);

      // Formatting Score (0-25)
      let formattingScore = 25;
      const formattingIssues: string[] = [];

      if (!cv.phone || cv.phone.trim() === '') {
        formattingScore -= 5;
        formattingIssues.push('Missing phone number');
      }
      if (!cv.location || cv.location.trim() === '') {
        formattingScore -= 5;
        formattingIssues.push('Missing location/address');
      }
      if (cv.skills.length === 0) {
        formattingScore -= 5;
        formattingIssues.push('No skills listed');
      }
      if (cv.experiences.length === 0 && cv.achievements.length === 0) {
        formattingScore -= 5;
        formattingIssues.push('No experience or achievements listed');
      }
      if (cv.summary.length < 50) {
        formattingScore -= 5;
        formattingIssues.push('Professional summary is too short (less than 50 characters)');
      }

      // Readability Score (0-25)
      let readabilityScore = 25;
      const avgSentenceLength = cvText.split('.').length > 0 ? cvText.split(' ').length / cvText.split('.').length : 0;
      if (avgSentenceLength > 25) {
        readabilityScore -= 8;
      }

      const wordCount = cvText.split(' ').length;
      if (wordCount < 100) {
        readabilityScore -= 10;
      } else if (wordCount > 1000) {
        readabilityScore -= 5;
      }

      // Experience sections (0-25)
      let experienceScore = 0;
      if (cv.experiences.length > 1) experienceScore += 10;
      else if (cv.experiences.length === 1) experienceScore += 5;
      if (cv.education.length > 0) experienceScore += 8;
      if (cv.certifications.length > 0) experienceScore += 7;

      const overallScore = Math.round(
        (keywordScore + formattingScore + readabilityScore + experienceScore) / 100 * 100
      );

      const analysis: ATSAnalysis = {
        cvProfileId: cv.id || '',
        keywordScore: Math.round(keywordScore),
        formattingScore: Math.round(formattingScore),
        readabilityScore: Math.round(readabilityScore),
        overallScore,
        missingKeywords: suggestedKeywords,
        suggestedKeywords: suggestedKeywords,
        formattingIssues,
        strengths: [
          cv.skills.length > 5 ? 'Good number of skills listed' : '',
          cv.experiences.length > 0 ? 'Work experience included' : '',
          cv.education.length > 0 ? 'Education background included' : '',
          foundKeywords.length > 5 ? 'Good keyword coverage' : '',
        ].filter((s) => s !== ''),
        improvements: [
          cv.summary.length < 100 ? 'Expand professional summary' : '',
          missingKeywords.length > 5 ? 'Add more relevant keywords' : '',
          cv.certifications.length === 0 ? 'Add certifications if available' : '',
          formattingIssues.length > 0 ? 'Address formatting issues' : '',
        ].filter((s) => s !== ''),
        analysisDate: new Date().toISOString(),
      };

      // Save analysis
      if (cv.id) {
        const savedId = await db.table('atsAnalyses').add(analysis);
        analysis.id = String(savedId);
        await loadATSHistory(cv.id);
      }

      setATSAnalysis(analysis);
      return analysis;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to analyze CV';
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadATSHistory]);

  // Create a new CV from template
  const createFromTemplate = useCallback((templateName: string): CVProfile => {
    const templates: { [key: string]: Partial<CVProfile> } = {
      modern: {
        summary:
          'Driven and detail-oriented professional with strong academic background and proven ability to exceed expectations.',
        selectedTemplate: 'modern',
      },
      professional: {
        summary:
          'APS-focused scholar with expertise in [Your Key Skills] seeking to contribute to [Industry] through innovation and excellence.',
        selectedTemplate: 'professional',
      },
      creative: {
        summary:
          'Passionate about [Your Interest] with track record of [Key Achievement]. Ready to make an impact through [Your Strength].',
        selectedTemplate: 'creative',
      },
      minimal: {
        summary: 'Skilled professional with diverse experience.',
        selectedTemplate: 'minimal',
      },
    };

    const template = templates[templateName] || templates.modern;
    const now = new Date().toISOString();

    return {
      userId: profile?.id || '',
      fullName: profile?.full_name || '',
      email: profile?.email || '',
      phone: '',
      location: profile?.province || '',
      summary: template.summary || '',
      selectedTemplate: template.selectedTemplate || 'modern',
      experiences: [],
      education: [],
      skills: [],
      achievements: [],
      certifications: [],
      createdAt: now,
      updatedAt: now,
    };
  }, [profile]);

  return useMemo(
    () => ({
      cvProfile,
      atsAnalysis,
      atsHistory,
      loading,
      error,
      loadCV,
      saveCV,
      deleteCV,
      analyzeCV,
      loadATSHistory,
      createFromTemplate,
    }),
    [
      cvProfile,
      atsAnalysis,
      atsHistory,
      loading,
      error,
      loadCV,
      saveCV,
      deleteCV,
      analyzeCV,
      loadATSHistory,
      createFromTemplate,
    ]
  );
};
