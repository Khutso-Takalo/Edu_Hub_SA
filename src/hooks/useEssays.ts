import { useCallback, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db, type EssayDraft } from '@/infrastructure/database/indexeddb/schema';
import { useAuth } from '@/hooks/useAuth';

export interface EssayAnalysis {
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  readabilityScore: number;
  keywordCoverage: number;
  hasOpening: boolean;
  hasClosing: boolean;
  suggestedImprovements: string[];
}

const KEYWORDS = [
  'leadership',
  'impact',
  'community',
  'resilience',
  'motivation',
  'growth',
  'learning',
  'achievement',
  'responsibility',
  'future',
];

function analyzeEssay(content: string): EssayAnalysis {
  const trimmed = content.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
  const sentences = trimmed ? trimmed.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean) : [];
  const lower = trimmed.toLowerCase();

  const matches = KEYWORDS.filter((word) => lower.includes(word));
  const keywordCoverage = Math.round((matches.length / KEYWORDS.length) * 100);
  const avgSentenceLength = sentences.length ? Math.round(words.length / sentences.length) : 0;

  let readabilityScore = 100;
  if (avgSentenceLength > 28) readabilityScore -= 20;
  if (words.length < 180) readabilityScore -= 20;
  if (words.length > 750) readabilityScore -= 10;
  if (sentences.length < 6) readabilityScore -= 20;
  readabilityScore = Math.max(0, readabilityScore);

  const firstChunk = sentences.slice(0, 2).join(' ').toLowerCase();
  const lastChunk = sentences.slice(-2).join(' ').toLowerCase();
  const hasOpening = /i\s+am|my\s+name|i\s+grew|i\s+have|as\s+a/.test(firstChunk);
  const hasClosing = /thank|opportunity|future|contribute|goal|aspire/.test(lastChunk);

  const suggestedImprovements: string[] = [];
  if (words.length < 250) {
    suggestedImprovements.push('Expand your examples with specific impact and outcomes.');
  }
  if (avgSentenceLength > 24) {
    suggestedImprovements.push('Use shorter sentences to improve readability.');
  }
  if (keywordCoverage < 35) {
    suggestedImprovements.push('Include more intent-focused keywords like leadership, impact, and growth.');
  }
  if (!hasOpening) {
    suggestedImprovements.push('Strengthen your opening with a clear personal context.');
  }
  if (!hasClosing) {
    suggestedImprovements.push('Add a strong closing statement linked to your future goals.');
  }

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    avgSentenceLength,
    readabilityScore,
    keywordCoverage,
    hasOpening,
    hasClosing,
    suggestedImprovements,
  };
}

export const useEssays = () => {
  const { profile } = useAuth();
  const [drafts, setDrafts] = useState<EssayDraft[]>([]);
  const [activeDraft, setActiveDraft] = useState<EssayDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    if (!profile?.id) return [];

    try {
      setLoading(true);
      setError(null);
      const list = await db.essayDrafts.where('userId').equals(profile.id).toArray();
      const ordered = list.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setDrafts(ordered);
      if (!activeDraft && ordered.length > 0) {
        setActiveDraft(ordered[0]);
      }
      return ordered;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load drafts';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [activeDraft, profile?.id]);

  const createDraft = useCallback(
    async (input?: Partial<Pick<EssayDraft, 'title' | 'prompt' | 'content' | 'tags'>>) => {
      if (!profile?.id) return null;

      const now = new Date().toISOString();
      const draft: EssayDraft = {
        id: uuidv4(),
        userId: profile.id,
        title: input?.title?.trim() || 'Untitled essay draft',
        prompt: input?.prompt?.trim() || '',
        content: input?.content || '',
        wordCount: input?.content?.trim() ? input.content.trim().split(/\s+/).length : 0,
        tags: input?.tags || [],
        createdAt: now,
        updatedAt: now,
      };

      try {
        setLoading(true);
        setError(null);
        await db.essayDrafts.add(draft);
        setActiveDraft(draft);
        await loadDrafts();
        return draft;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create draft';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [loadDrafts, profile?.id]
  );

  const updateDraft = useCallback(
    async (draftId: string, updates: Partial<Pick<EssayDraft, 'title' | 'prompt' | 'content' | 'tags'>>) => {
      try {
        setLoading(true);
        setError(null);

        const existing = await db.essayDrafts.get(draftId);
        if (!existing) return null;

        const content = updates.content ?? existing.content;
        const next: EssayDraft = {
          ...existing,
          ...updates,
          content,
          wordCount: content.trim() ? content.trim().split(/\s+/).length : 0,
          updatedAt: new Date().toISOString(),
        };

        await db.essayDrafts.put(next);
        setActiveDraft(next);
        await loadDrafts();
        return next;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update draft';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [loadDrafts]
  );

  const deleteDraft = useCallback(
    async (draftId: string) => {
      try {
        setLoading(true);
        setError(null);
        await db.essayDrafts.delete(draftId);
        if (activeDraft?.id === draftId) {
          setActiveDraft(null);
        }
        await loadDrafts();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete draft';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [activeDraft?.id, loadDrafts]
  );

  const analysis = useMemo(() => analyzeEssay(activeDraft?.content || ''), [activeDraft?.content]);

  return {
    drafts,
    activeDraft,
    loading,
    error,
    analysis,
    setActiveDraft,
    loadDrafts,
    createDraft,
    updateDraft,
    deleteDraft,
  };
};
