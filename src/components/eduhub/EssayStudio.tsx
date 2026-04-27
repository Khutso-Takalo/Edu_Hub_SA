import React, { useEffect, useMemo, useState } from 'react';
import { BookText, FilePlus2, Sparkles, Target, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useEssays } from '@/hooks/useEssays';
import { toast } from '@/hooks/use-toast';

interface EssayStudioProps {
  onNavigate?: (view: string) => void;
}

const PROMPT_PRESETS = [
  {
    title: 'Why I deserve this bursary',
    prompt:
      'Describe your educational journey, financial context, and why this bursary investment will create meaningful impact for your community.',
  },
  {
    title: 'Leadership and community impact',
    prompt:
      'Share one leadership challenge you faced, what actions you took, and how the outcome shaped your long-term goals.',
  },
  {
    title: 'Career motivation statement',
    prompt:
      'Explain what inspired your career path, what skills you are building now, and how your studies align with this direction.',
  },
  {
    title: 'Resilience narrative',
    prompt:
      'Reflect on a major setback and show how you adapted, learned, and improved your academic or personal outcomes.',
  },
];

const EssayStudio: React.FC<EssayStudioProps> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const {
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
  } = useEssays();

  const [draftTitle, setDraftTitle] = useState('');
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftContent, setDraftContent] = useState('');

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  useEffect(() => {
    if (activeDraft) {
      setDraftTitle(activeDraft.title);
      setDraftPrompt(activeDraft.prompt);
      setDraftContent(activeDraft.content);
    }
  }, [activeDraft]);

  const qualityScore = useMemo(() => {
    const weighted =
      analysis.readabilityScore * 0.4 +
      analysis.keywordCoverage * 0.3 +
      (analysis.hasOpening ? 15 : 0) +
      (analysis.hasClosing ? 15 : 0);
    return Math.max(0, Math.min(100, Math.round(weighted)));
  }, [analysis]);

  const handleCreateDraft = async (preset?: { title: string; prompt: string }) => {
    const newDraft = await createDraft({
      title: preset?.title || 'Untitled essay draft',
      prompt: preset?.prompt || '',
      content: '',
    });
    if (newDraft) {
      toast({ title: 'Draft created', description: 'Your new essay draft is ready.' });
    }
  };

  const handleSave = async () => {
    if (!activeDraft) return;
    const updated = await updateDraft(activeDraft.id, {
      title: draftTitle,
      prompt: draftPrompt,
      content: draftContent,
    });
    if (updated) {
      toast({ title: 'Draft saved', description: 'Your essay draft has been updated.' });
    }
  };

  const handleDelete = async () => {
    if (!activeDraft) return;
    const ok = await deleteDraft(activeDraft.id);
    if (ok) {
      toast({ title: 'Draft deleted', description: 'Essay draft removed.' });
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8 flex items-center justify-center">
        <Alert>
          <AlertDescription>Please log in to use Essay Studio.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Essay Studio</h1>
            <p className="text-gray-600 mt-1">
              Build and polish bursary motivation essays with live quality scoring.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onNavigate?.('cv-builder')}>
              Back to CV Builder
            </Button>
            <Button onClick={() => handleCreateDraft()}>
              <FilePlus2 className="w-4 h-4 mr-2" />
              New Draft
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="p-4 lg:col-span-1 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Prompt Presets</h2>
              <p className="text-sm text-gray-600">Start with a structured writing direction.</p>
            </div>
            <div className="space-y-2">
              {PROMPT_PRESETS.map((preset) => (
                <button
                  key={preset.title}
                  onClick={() => handleCreateDraft(preset)}
                  className="w-full text-left rounded-lg border p-3 bg-white hover:bg-blue-50 hover:border-blue-200 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900">{preset.title}</p>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{preset.prompt}</p>
                </button>
              ))}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Your Drafts</h3>
              <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                {drafts.map((draft) => (
                  <button
                    key={draft.id}
                    onClick={() => setActiveDraft(draft)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      activeDraft?.id === draft.id
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{draft.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{draft.wordCount} words</p>
                  </button>
                ))}
                {drafts.length === 0 && (
                  <p className="text-sm text-gray-500">No drafts yet. Start with a preset.</p>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-6 lg:col-span-2 space-y-4">
            {!activeDraft ? (
              <div className="text-center py-16">
                <BookText className="w-12 h-12 text-gray-300 mx-auto" />
                <h3 className="mt-3 text-lg font-semibold text-gray-900">No active draft</h3>
                <p className="text-sm text-gray-600 mt-1">Create one from the preset library to begin.</p>
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Draft Title</label>
                    <Input
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      placeholder="e.g. Why I deserve this bursary"
                    />
                  </div>
                  <div className="flex items-end justify-end gap-2">
                    <Button variant="outline" onClick={handleDelete} className="text-red-600 border-red-200">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                      Save Draft
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Prompt</label>
                  <Textarea
                    value={draftPrompt}
                    onChange={(e) => setDraftPrompt(e.target.value)}
                    rows={3}
                    placeholder="Paste the bursary prompt here"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Essay Content</label>
                  <Textarea
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    rows={14}
                    placeholder="Write your essay..."
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="p-4 border-blue-100 bg-blue-50">
                    <div className="flex items-center gap-2 text-blue-900 font-semibold">
                      <Target className="w-4 h-4" />
                      Quality Score
                    </div>
                    <p className="text-3xl font-bold text-blue-700 mt-2">{qualityScore}/100</p>
                    <p className="text-xs text-blue-900 mt-1">
                      {analysis.wordCount} words · {analysis.sentenceCount} sentences · Avg sentence {analysis.avgSentenceLength} words
                    </p>
                  </Card>

                  <Card className="p-4 border-emerald-100 bg-emerald-50">
                    <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                      <Sparkles className="w-4 h-4" />
                      Coverage
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-emerald-900">
                      <p>Keyword coverage: {analysis.keywordCoverage}%</p>
                      <p>Opening clarity: {analysis.hasOpening ? 'Good' : 'Needs work'}</p>
                      <p>Closing strength: {analysis.hasClosing ? 'Good' : 'Needs work'}</p>
                    </div>
                  </Card>
                </div>

                {analysis.suggestedImprovements.length > 0 && (
                  <Card className="p-4 border-amber-200 bg-amber-50">
                    <h4 className="text-sm font-semibold text-amber-900">Improvement Suggestions</h4>
                    <ul className="mt-2 space-y-1 text-sm text-amber-900">
                      {analysis.suggestedImprovements.map((suggestion) => (
                        <li key={suggestion}>• {suggestion}</li>
                      ))}
                    </ul>
                  </Card>
                )}
              </>
            )}
          </Card>
        </div>

        {error && (
          <Alert>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};

export default EssayStudio;
