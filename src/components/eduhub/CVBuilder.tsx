import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  Eye,
  GraduationCap,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCV, CVProfile, WorkExperience, Education, Skill, Achievement, Certification } from '@/hooks/useCV';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const CVTemplates = [
  {
    id: 'modern',
    name: 'Modern',
    description: 'Clean, contemporary design with focus on impact',
    icon: '✨',
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Formal, traditional layout for corporate roles',
    icon: '💼',
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Eye-catching design with personality',
    icon: '🎨',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Simple, focused on content over design',
    icon: '📄',
  },
];

interface CVBuilderProps {
  onNavigate?: (view: string) => void;
}

export const CVBuilder: React.FC<CVBuilderProps> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const isPremium = !!profile?.isPremium;
  const {
    cvProfile,
    atsAnalysis,
    atsHistory,
    loading,
    error,
    loadCV,
    saveCV,
    analyzeCV,
    loadATSHistory,
    createFromTemplate,
  } = useCV();

  const [currentCV, setCurrentCV] = useState<CVProfile | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [editingMode, setEditingMode] = useState<'template-select' | 'editor' | 'preview'>('template-select');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    summary: true,
    experiences: false,
    education: false,
    skills: false,
    achievements: false,
    certifications: false,
  });

  // Load CV on mount
  useEffect(() => {
    if (profile?.id) {
      const result = loadCV(profile.id);
      if (result && typeof result.then === 'function') {
        result.then((cv) => {
          if (cv) {
            setCurrentCV(cv);
            setSelectedTemplate(cv.selectedTemplate);
            setEditingMode('editor');
          }
        });
      }
    }
  }, [profile?.id, loadCV]);

  useEffect(() => {
    if (currentCV?.id) {
      loadATSHistory(currentCV.id);
    }
  }, [currentCV?.id, loadATSHistory]);

  const handleCreateNewCV = (templateId: string) => {
    const premiumTemplate = templateId === 'creative' || templateId === 'minimal';
    if (premiumTemplate && !isPremium) {
      toast({
        title: 'Premium template',
        description: 'Upgrade to Premium to unlock this CV template.',
      });
      return;
    }

    const newCV = createFromTemplate(templateId);
    setCurrentCV(newCV);
    setSelectedTemplate(templateId);
    setEditingMode('editor');
  };

  const handleSaveCV = async () => {
    if (!currentCV) return;
    const saved = await saveCV(currentCV);
    if (saved) {
      setCurrentCV(saved);
      toast({ title: 'CV saved', description: 'Your latest changes are now stored.' });
    }
  };

  const handleAnalyzeCV = async () => {
    if (!currentCV) return;
    if (!isPremium) {
      toast({
        title: 'Premium feature',
        description: 'Upgrade to Premium to access advanced ATS analytics.',
      });
      return;
    }

    setIsAnalyzing(true);
    const analysis = await analyzeCV(currentCV);
    if (analysis) {
      toast({
        title: 'ATS scan complete',
        description: `Current overall score: ${analysis.overallScore}/100`,
      });
    }
    setIsAnalyzing(false);
  };

  const fileNameBase = (currentCV?.fullName || 'cv').trim().replace(/\s+/g, '-').toLowerCase();

  const handleExportPDF = async () => {
    if (!previewRef.current || !currentCV) {
      toast({ title: 'Export failed', description: 'Preview is not ready yet.', variant: 'destructive' });
      return;
    }

    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${fileNameBase}.pdf`);
      toast({ title: 'PDF exported', description: 'Your CV was downloaded as PDF.' });
    } catch (err) {
      toast({ title: 'Export failed', description: 'Could not generate PDF.', variant: 'destructive' });
    }
  };

  const handleExportWord = async () => {
    if (!currentCV) return;
    if (!isPremium) {
      toast({
        title: 'Premium feature',
        description: 'Upgrade to Premium to export your CV as Word.',
      });
      return;
    }

    try {
      const [{ Document, Packer, Paragraph, TextRun, HeadingLevel }, { saveAs }] = await Promise.all([
        import('docx'),
        import('file-saver'),
      ]);
      const sections: Paragraph[] = [
        new Paragraph({ text: currentCV.fullName || 'Curriculum Vitae', heading: HeadingLevel.TITLE }),
        new Paragraph({ text: `${currentCV.email} | ${currentCV.phone} | ${currentCV.location}` }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: 'Professional Summary', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: currentCV.summary || 'N/A' }),
      ];

      if (currentCV.experiences.length > 0) {
        sections.push(new Paragraph({ text: '' }));
        sections.push(new Paragraph({ text: 'Work Experience', heading: HeadingLevel.HEADING_2 }));
        currentCV.experiences.forEach((exp) => {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${exp.jobTitle} - ${exp.companyName}`, bold: true }),
                new TextRun({ text: ` (${exp.startDate} - ${exp.currentlyWorking ? 'Present' : exp.endDate})` }),
              ],
            })
          );
          if (exp.description) sections.push(new Paragraph({ text: exp.description }));
        });
      }

      if (currentCV.education.length > 0) {
        sections.push(new Paragraph({ text: '' }));
        sections.push(new Paragraph({ text: 'Education', heading: HeadingLevel.HEADING_2 }));
        currentCV.education.forEach((edu) => {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${edu.degree} in ${edu.fieldOfStudy}`, bold: true }),
                new TextRun({ text: ` - ${edu.schoolName} (${edu.startDate} - ${edu.endDate})` }),
              ],
            })
          );
        });
      }

      if (currentCV.skills.length > 0) {
        sections.push(new Paragraph({ text: '' }));
        sections.push(new Paragraph({ text: 'Skills', heading: HeadingLevel.HEADING_2 }));
        sections.push(new Paragraph({ text: currentCV.skills.map((s) => s.skill).join(', ') }));
      }

      if (currentCV.achievements.length > 0) {
        sections.push(new Paragraph({ text: '' }));
        sections.push(new Paragraph({ text: 'Achievements & Awards', heading: HeadingLevel.HEADING_2 }));
        currentCV.achievements.forEach((ach) => {
          sections.push(new Paragraph({ text: `${ach.title} (${ach.achievementType}, ${ach.date})` }));
          if (ach.description) sections.push(new Paragraph({ text: ach.description }));
        });
      }

      if (currentCV.certifications.length > 0) {
        sections.push(new Paragraph({ text: '' }));
        sections.push(new Paragraph({ text: 'Certifications', heading: HeadingLevel.HEADING_2 }));
        currentCV.certifications.forEach((cert) => {
          sections.push(new Paragraph({ text: `${cert.name} - ${cert.issuedBy} (${cert.certificationDate})` }));
        });
      }

      const doc = new Document({ sections: [{ children: sections }] });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${fileNameBase}.docx`);
      toast({ title: 'Word exported', description: 'Your CV was downloaded as .docx.' });
    } catch (err) {
      toast({ title: 'Export failed', description: 'Could not generate Word file.', variant: 'destructive' });
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Handle CV field updates
  const updateCV = (updates: Partial<CVProfile>) => {
    if (currentCV) {
      setCurrentCV({ ...currentCV, ...updates });
    }
  };

  // Handle experience CRUD
  const addExperience = () => {
    if (!currentCV) return;
    const newExperience: WorkExperience = {
      jobTitle: '',
      companyName: '',
      location: '',
      startDate: '',
      endDate: '',
      currentlyWorking: false,
      description: '',
    };
    setCurrentCV({
      ...currentCV,
      experiences: [...currentCV.experiences, newExperience],
    });
  };

  const updateExperience = (index: number, updates: Partial<WorkExperience>) => {
    if (!currentCV) return;
    const newExperiences = [...currentCV.experiences];
    newExperiences[index] = { ...newExperiences[index], ...updates };
    setCurrentCV({ ...currentCV, experiences: newExperiences });
  };

  const removeExperience = (index: number) => {
    if (!currentCV) return;
    setCurrentCV({
      ...currentCV,
      experiences: currentCV.experiences.filter((_, i) => i !== index),
    });
  };

  const addEducation = () => {
    if (!currentCV) return;
    const newEducation: Education = {
      schoolName: '',
      fieldOfStudy: '',
      degree: '',
      startDate: '',
      endDate: '',
      grade: '',
      activities: '',
    };
    setCurrentCV({
      ...currentCV,
      education: [...currentCV.education, newEducation],
    });
  };

  const updateEducation = (index: number, updates: Partial<Education>) => {
    if (!currentCV) return;
    const newEducation = [...currentCV.education];
    newEducation[index] = { ...newEducation[index], ...updates };
    setCurrentCV({ ...currentCV, education: newEducation });
  };

  const removeEducation = (index: number) => {
    if (!currentCV) return;
    setCurrentCV({
      ...currentCV,
      education: currentCV.education.filter((_, i) => i !== index),
    });
  };

  const addSkill = () => {
    if (!currentCV) return;
    const newSkill: Skill = { skill: '' };
    setCurrentCV({
      ...currentCV,
      skills: [...currentCV.skills, newSkill],
    });
  };

  const updateSkill = (index: number, skill: string) => {
    if (!currentCV) return;
    const newSkills = [...currentCV.skills];
    newSkills[index].skill = skill;
    setCurrentCV({ ...currentCV, skills: newSkills });
  };

  const removeSkill = (index: number) => {
    if (!currentCV) return;
    setCurrentCV({
      ...currentCV,
      skills: currentCV.skills.filter((_, i) => i !== index),
    });
  };

  const addAchievement = () => {
    if (!currentCV) return;
    const newAchievement: Achievement = {
      title: '',
      description: '',
      date: '',
      achievementType: '',
    };
    setCurrentCV({
      ...currentCV,
      achievements: [...currentCV.achievements, newAchievement],
    });
  };

  const updateAchievement = (index: number, updates: Partial<Achievement>) => {
    if (!currentCV) return;
    const newAchievements = [...currentCV.achievements];
    newAchievements[index] = { ...newAchievements[index], ...updates };
    setCurrentCV({ ...currentCV, achievements: newAchievements });
  };

  const removeAchievement = (index: number) => {
    if (!currentCV) return;
    setCurrentCV({
      ...currentCV,
      achievements: currentCV.achievements.filter((_, i) => i !== index),
    });
  };

  const addCertification = () => {
    if (!currentCV) return;
    const newCert: Certification = {
      name: '',
      issuedBy: '',
      certificationDate: '',
    };
    setCurrentCV({
      ...currentCV,
      certifications: [...currentCV.certifications, newCert],
    });
  };

  const updateCertification = (index: number, updates: Partial<Certification>) => {
    if (!currentCV) return;
    const newCerts = [...currentCV.certifications];
    newCerts[index] = { ...newCerts[index], ...updates };
    setCurrentCV({ ...currentCV, certifications: newCerts });
  };

  const removeCertification = (index: number) => {
    if (!currentCV) return;
    setCurrentCV({
      ...currentCV,
      certifications: currentCV.certifications.filter((_, i) => i !== index),
    });
  };

  const trendMeta = useMemo(() => {
    if (atsHistory.length < 2) {
      return { delta: 0, direction: 'flat' as 'up' | 'down' | 'flat' };
    }

    const newest = atsHistory[0].overallScore;
    const oldest = atsHistory[atsHistory.length - 1].overallScore;
    const delta = newest - oldest;
    if (delta > 0) return { delta, direction: 'up' as const };
    if (delta < 0) return { delta, direction: 'down' as const };
    return { delta: 0, direction: 'flat' as const };
  }, [atsHistory]);

  const trendChart = useMemo(() => {
    const scans = [...atsHistory].reverse().slice(-8);
    const width = 320;
    const height = 96;
    const padding = 10;

    if (!scans.length) {
      return { scans, width, height, padding, points: [] as Array<{ x: number; y: number; score: number; at: string }>, path: '' };
    }

    const chartHeight = height - padding * 2;
    const stepX = scans.length > 1 ? (width - padding * 2) / (scans.length - 1) : 0;

    const points = scans.map((scan, idx) => ({
      x: padding + idx * stepX,
      y: padding + (100 - Math.max(0, Math.min(100, scan.overallScore))) * (chartHeight / 100),
      score: scan.overallScore,
      at: scan.analysisDate,
    }));

    const path = points
      .map((point, idx) => `${idx === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(' ');

    return { scans, width, height, padding, points, path };
  }, [atsHistory]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8 flex items-center justify-center">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Please log in to use the CV Builder.</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Template Selection Screen
  if (editingMode === 'template-select' && !currentCV) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Build Your CV</h1>
            <p className="text-gray-600 text-lg">Choose a template to get started</p>
            {!isPremium ? (
              <p className="text-sm text-indigo-700 mt-2">Premium unlocks Creative and Minimal templates.</p>
            ) : null}
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {CVTemplates.map((template) => {
              const premiumTemplate = template.id === 'creative' || template.id === 'minimal';
              const locked = premiumTemplate && !isPremium;

              return (
              <Card
                key={template.id}
                className={`cursor-pointer hover:shadow-lg transition-shadow p-6 border-2 hover:border-blue-500 ${locked ? 'opacity-70' : ''}`}
                onClick={() => handleCreateNewCV(template.id)}
              >
                <div className="text-4xl mb-4">{template.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{template.name}</h3>
                <p className="text-gray-600 mb-4">{template.description}</p>
                {locked ? <Badge className="mb-3 bg-indigo-100 text-indigo-700">Premium</Badge> : null}
                <Button className="w-full" variant={locked ? 'outline' : 'default'}>
                  {locked ? 'Upgrade to use' : 'Start Building'}
                </Button>
              </Card>
              );
            })}
          </div>

          {!isPremium ? (
            <div className="text-center mb-6">
              <Button asChild variant="outline">
                <a href="https://payfast.io" target="_blank" rel="noopener noreferrer">
                  Upgrade to Premium
                </a>
              </Button>
            </div>
          ) : null}

          {currentCV && (
            <div className="text-center">
              <Button variant="outline" onClick={() => setEditingMode('editor')}>
                Continue Editing Previous CV
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Editor Screen
  if (!currentCV) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8 flex items-center justify-center">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Loading your CV...</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">CV Builder</h1>
          <div className="flex gap-2 items-center">
            <Badge>{currentCV.selectedTemplate.charAt(0).toUpperCase() + currentCV.selectedTemplate.slice(1)} Template</Badge>
            <span className="text-sm text-gray-600">Last updated: {new Date(currentCV.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-6 bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="editor" className="bg-white rounded-lg shadow-lg p-6">
          <TabsList className="mb-6">
            <TabsTrigger value="editor" className="flex items-center gap-2">
              <Edit3 className="w-4 h-4" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="ats" className="flex items-center gap-2" disabled={!isPremium}>
              <Target className="w-4 h-4" />
              ATS Analyzer
            </TabsTrigger>
          </TabsList>

          {/* Editor Tab */}
          <TabsContent value="editor" className="space-y-6">
            {/* Contact Info Section */}
            <Card className="p-6 border-2">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Contact Information</h3>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <Input
                      value={currentCV.fullName}
                      onChange={(e) => updateCV({ fullName: e.target.value })}
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <Input
                      value={currentCV.email}
                      onChange={(e) => updateCV({ email: e.target.value })}
                      placeholder="your.email@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <Input
                      value={currentCV.phone}
                      onChange={(e) => updateCV({ phone: e.target.value })}
                      placeholder="+27 XX XXX XXXX"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <Input
                      value={currentCV.location}
                      onChange={(e) => updateCV({ location: e.target.value })}
                      placeholder="City, Province"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Professional Summary */}
            <Card className="p-6 border-2">
              <div
                className="flex items-center justify-between cursor-pointer mb-4"
                onClick={() => toggleSection('summary')}
              >
                <h3 className="text-lg font-bold text-gray-900">Professional Summary</h3>
                {expandedSections.summary ? <ChevronUp /> : <ChevronDown />}
              </div>
              {expandedSections.summary && (
                <Textarea
                  value={currentCV.summary}
                  onChange={(e) => updateCV({ summary: e.target.value })}
                  placeholder="Write a compelling summary of your skills, experience, and career goals..."
                  rows={5}
                  className="w-full"
                />
              )}
            </Card>

            {/* Experience Section */}
            <Card className="p-6 border-2">
              <div
                className="flex items-center justify-between cursor-pointer mb-4"
                onClick={() => toggleSection('experiences')}
              >
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  <h3 className="text-lg font-bold text-gray-900">Work Experience</h3>
                  <Badge variant="secondary">{currentCV.experiences.length}</Badge>
                </div>
                {expandedSections.experiences ? <ChevronUp /> : <ChevronDown />}
              </div>
              {expandedSections.experiences && (
                <div className="space-y-4">
                  {currentCV.experiences.map((exp, idx) => (
                    <Card key={idx} className="p-4 bg-gray-50 border">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-semibold text-gray-900">Experience {idx + 1}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeExperience(idx)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-3 grid md:grid-cols-2 gap-3">
                        <Input
                          placeholder="Job Title"
                          value={exp.jobTitle}
                          onChange={(e) => updateExperience(idx, { jobTitle: e.target.value })}
                        />
                        <Input
                          placeholder="Company Name"
                          value={exp.companyName}
                          onChange={(e) => updateExperience(idx, { companyName: e.target.value })}
                        />
                        <Input
                          placeholder="Location"
                          value={exp.location}
                          onChange={(e) => updateExperience(idx, { location: e.target.value })}
                        />
                        <div className="flex gap-2">
                          <Input
                            placeholder="Start Date (YYYY-MM)"
                            value={exp.startDate}
                            onChange={(e) => updateExperience(idx, { startDate: e.target.value })}
                          />
                          <Input
                            placeholder={exp.currentlyWorking ? 'Current' : 'End Date (YYYY-MM)'}
                            value={exp.endDate}
                            onChange={(e) => updateExperience(idx, { endDate: e.target.value })}
                            disabled={exp.currentlyWorking}
                          />
                        </div>
                        <label className="flex items-center gap-2 col-span-2">
                          <input
                            type="checkbox"
                            checked={exp.currentlyWorking}
                            onChange={(e) =>
                              updateExperience(idx, { currentlyWorking: e.target.checked })
                            }
                          />
                          <span className="text-sm">Currently working here</span>
                        </label>
                        <Textarea
                          placeholder="Description of your responsibilities and achievements"
                          value={exp.description}
                          onChange={(e) => updateExperience(idx, { description: e.target.value })}
                          className="col-span-2"
                          rows={3}
                        />
                      </div>
                    </Card>
                  ))}
                  <Button onClick={addExperience} variant="outline" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Experience
                  </Button>
                </div>
              )}
            </Card>

            {/* Education Section */}
            <Card className="p-6 border-2">
              <div
                className="flex items-center justify-between cursor-pointer mb-4"
                onClick={() => toggleSection('education')}
              >
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  <h3 className="text-lg font-bold text-gray-900">Education</h3>
                  <Badge variant="secondary">{currentCV.education.length}</Badge>
                </div>
                {expandedSections.education ? <ChevronUp /> : <ChevronDown />}
              </div>
              {expandedSections.education && (
                <div className="space-y-4">
                  {currentCV.education.map((edu, idx) => (
                    <Card key={idx} className="p-4 bg-gray-50 border">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-semibold text-gray-900">Education {idx + 1}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEducation(idx)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-3 grid md:grid-cols-2 gap-3">
                        <Input
                          placeholder="School Name"
                          value={edu.schoolName}
                          onChange={(e) => updateEducation(idx, { schoolName: e.target.value })}
                        />
                        <Input
                          placeholder="Degree"
                          value={edu.degree}
                          onChange={(e) => updateEducation(idx, { degree: e.target.value })}
                        />
                        <Input
                          placeholder="Field of Study"
                          value={edu.fieldOfStudy}
                          onChange={(e) => updateEducation(idx, { fieldOfStudy: e.target.value })}
                        />
                        <Input
                          placeholder="Grade / GPA"
                          value={edu.grade}
                          onChange={(e) => updateEducation(idx, { grade: e.target.value })}
                        />
                        <Input
                          placeholder="Start Date (YYYY-MM)"
                          value={edu.startDate}
                          onChange={(e) => updateEducation(idx, { startDate: e.target.value })}
                        />
                        <Input
                          placeholder="End Date (YYYY-MM)"
                          value={edu.endDate}
                          onChange={(e) => updateEducation(idx, { endDate: e.target.value })}
                        />
                        <Textarea
                          placeholder="Activities, societies, awards..."
                          value={edu.activities}
                          onChange={(e) => updateEducation(idx, { activities: e.target.value })}
                          className="col-span-2"
                          rows={2}
                        />
                      </div>
                    </Card>
                  ))}
                  <Button onClick={addEducation} variant="outline" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Education
                  </Button>
                </div>
              )}
            </Card>

            {/* Skills Section */}
            <Card className="p-6 border-2">
              <div
                className="flex items-center justify-between cursor-pointer mb-4"
                onClick={() => toggleSection('skills')}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <h3 className="text-lg font-bold text-gray-900">Skills</h3>
                  <Badge variant="secondary">{currentCV.skills.length}</Badge>
                </div>
                {expandedSections.skills ? <ChevronUp /> : <ChevronDown />}
              </div>
              {expandedSections.skills && (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    {currentCV.skills.map((skill, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input
                          placeholder="e.g., Python, Leadership, Data Analysis"
                          value={skill.skill}
                          onChange={(e) => updateSkill(idx, e.target.value)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSkill(idx)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button onClick={addSkill} variant="outline" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Skill
                  </Button>
                </div>
              )}
            </Card>

            {/* Achievements Section */}
            <Card className="p-6 border-2">
              <div
                className="flex items-center justify-between cursor-pointer mb-4"
                onClick={() => toggleSection('achievements')}
              >
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  <h3 className="text-lg font-bold text-gray-900">Achievements & Awards</h3>
                  <Badge variant="secondary">{currentCV.achievements.length}</Badge>
                </div>
                {expandedSections.achievements ? <ChevronUp /> : <ChevronDown />}
              </div>
              {expandedSections.achievements && (
                <div className="space-y-4">
                  {currentCV.achievements.map((ach, idx) => (
                    <Card key={idx} className="p-4 bg-gray-50 border">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-semibold text-gray-900">Achievement {idx + 1}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAchievement(idx)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-3">
                        <Input
                          placeholder="Achievement Title"
                          value={ach.title}
                          onChange={(e) => updateAchievement(idx, { title: e.target.value })}
                        />
                        <Input
                          placeholder="Type (e.g., Award, Scholarship, Recognition)"
                          value={ach.achievementType}
                          onChange={(e) => updateAchievement(idx, { achievementType: e.target.value })}
                        />
                        <Input
                          placeholder="Date (YYYY-MM)"
                          value={ach.date}
                          onChange={(e) => updateAchievement(idx, { date: e.target.value })}
                        />
                        <Textarea
                          placeholder="Description of the achievement"
                          value={ach.description}
                          onChange={(e) => updateAchievement(idx, { description: e.target.value })}
                          rows={2}
                        />
                      </div>
                    </Card>
                  ))}
                  <Button onClick={addAchievement} variant="outline" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Achievement
                  </Button>
                </div>
              )}
            </Card>

            {/* Certifications Section */}
            <Card className="p-6 border-2">
              <div
                className="flex items-center justify-between cursor-pointer mb-4"
                onClick={() => toggleSection('certifications')}
              >
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-yellow-600" />
                  <h3 className="text-lg font-bold text-gray-900">Certifications</h3>
                  <Badge variant="secondary">{currentCV.certifications.length}</Badge>
                </div>
                {expandedSections.certifications ? <ChevronUp /> : <ChevronDown />}
              </div>
              {expandedSections.certifications && (
                <div className="space-y-4">
                  {currentCV.certifications.map((cert, idx) => (
                    <Card key={idx} className="p-4 bg-gray-50 border">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-semibold text-gray-900">Certification {idx + 1}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCertification(idx)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-3">
                        <Input
                          placeholder="Certification Name"
                          value={cert.name}
                          onChange={(e) => updateCertification(idx, { name: e.target.value })}
                        />
                        <Input
                          placeholder="Issued By"
                          value={cert.issuedBy}
                          onChange={(e) => updateCertification(idx, { issuedBy: e.target.value })}
                        />
                        <div className="grid md:grid-cols-2 gap-3">
                          <Input
                            placeholder="Certification Date (YYYY-MM)"
                            value={cert.certificationDate}
                            onChange={(e) => updateCertification(idx, { certificationDate: e.target.value })}
                          />
                          <Input
                            placeholder="Expiry Date (Optional)"
                            value={cert.expiryDate || ''}
                            onChange={(e) => updateCertification(idx, { expiryDate: e.target.value })}
                          />
                        </div>
                        <Input
                          placeholder="Credential URL (Optional)"
                          value={cert.credentialUrl || ''}
                          onChange={(e) => updateCertification(idx, { credentialUrl: e.target.value })}
                        />
                      </div>
                    </Card>
                  ))}
                  <Button onClick={addCertification} variant="outline" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Certification
                  </Button>
                </div>
              )}
            </Card>

            {/* Save Button */}
            <div className="flex gap-3">
              <Button onClick={handleSaveCV} disabled={loading} className="flex-1">
                {loading ? 'Saving...' : 'Save CV'}
              </Button>
              <Button onClick={() => setEditingMode('template-select')} variant="outline">
                Start Over
              </Button>
            </div>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-4">
            <Card className="p-8 bg-white">
              <div className="max-w-2xl mx-auto" id="cv-preview" ref={previewRef}>
                {/* Header */}
                <div className="border-b-2 pb-6 mb-6">
                  <h2 className="text-3xl font-bold text-gray-900">{currentCV.fullName}</h2>
                  <div className="text-gray-600 text-sm mt-2 space-y-1">
                    <p>{currentCV.location}</p>
                    <p>{currentCV.email}</p>
                    <p>{currentCV.phone}</p>
                  </div>
                </div>

                {/* Summary */}
                {currentCV.summary && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Professional Summary</h3>
                    <p className="text-gray-700 leading-relaxed">{currentCV.summary}</p>
                  </div>
                )}

                {/* Experience */}
                {currentCV.experiences.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Work Experience</h3>
                    <div className="space-y-4">
                      {currentCV.experiences.map((exp, idx) => (
                        <div key={idx}>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-gray-900">{exp.jobTitle}</p>
                              <p className="text-gray-600">{exp.companyName} • {exp.location}</p>
                            </div>
                            <p className="text-gray-500 text-sm">
                              {exp.startDate} - {exp.currentlyWorking ? 'Present' : exp.endDate}
                            </p>
                          </div>
                          {exp.description && <p className="text-gray-700 mt-2 text-sm">{exp.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Education */}
                {currentCV.education.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Education</h3>
                    <div className="space-y-4">
                      {currentCV.education.map((edu, idx) => (
                        <div key={idx}>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-gray-900">{edu.degree} in {edu.fieldOfStudy}</p>
                              <p className="text-gray-600">{edu.schoolName}</p>
                            </div>
                            <p className="text-gray-500 text-sm">{edu.startDate} - {edu.endDate}</p>
                          </div>
                          {edu.grade && <p className="text-gray-600 text-sm mt-1">Grade: {edu.grade}</p>}
                          {edu.activities && <p className="text-gray-700 mt-2 text-sm">{edu.activities}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills */}
                {currentCV.skills.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {currentCV.skills.map((skill, idx) => (
                        <Badge key={idx} variant="secondary">
                          {skill.skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Achievements */}
                {currentCV.achievements.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Achievements & Awards</h3>
                    <div className="space-y-3">
                      {currentCV.achievements.map((ach, idx) => (
                        <div key={idx}>
                          <p className="font-semibold text-gray-900">{ach.title}</p>
                          <p className="text-gray-600 text-sm">{ach.achievementType} • {ach.date}</p>
                          <p className="text-gray-700 text-sm mt-1">{ach.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Certifications */}
                {currentCV.certifications.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Certifications</h3>
                    <div className="space-y-3">
                      {currentCV.certifications.map((cert, idx) => (
                        <div key={idx}>
                          <p className="font-semibold text-gray-900">{cert.name}</p>
                          <p className="text-gray-600 text-sm">{cert.issuedBy} • {cert.certificationDate}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <div className="flex gap-3">
              <Button onClick={handleExportPDF} className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Export as PDF
              </Button>
              <Button variant="outline" onClick={handleExportWord} disabled={!isPremium}>Export as Word</Button>
            </div>
            {!isPremium ? (
              <p className="text-xs text-indigo-700">Word export and ATS analytics are part of Premium.</p>
            ) : null}
          </TabsContent>

          {/* ATS Tab */}
          <TabsContent value="ats" className="space-y-6">
            <Card className="p-6 bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">ATS Analyzer</h3>
                  <p className="text-gray-600">Optimize your CV for Applicant Tracking Systems</p>
                </div>
                <Button onClick={handleAnalyzeCV} disabled={!isPremium || isAnalyzing || loading}>
                  {isAnalyzing || loading ? 'Analyzing...' : 'Analyze CV'}
                </Button>
              </div>
            </Card>

            {atsHistory.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h4 className="font-semibold text-gray-900">ATS Score Trend</h4>
                    <p className="text-sm text-gray-600">Latest {atsHistory.length} scans</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {trendMeta.direction === 'up' && <ArrowUp className="w-4 h-4 text-green-600" />}
                    {trendMeta.direction === 'down' && <ArrowDown className="w-4 h-4 text-red-600" />}
                    <span
                      className={`text-sm font-semibold ${
                        trendMeta.direction === 'up'
                          ? 'text-green-700'
                          : trendMeta.direction === 'down'
                          ? 'text-red-700'
                          : 'text-gray-700'
                      }`}
                    >
                      {trendMeta.direction === 'flat'
                        ? 'No change'
                        : `${trendMeta.delta > 0 ? '+' : ''}${trendMeta.delta} pts`}
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid md:grid-cols-2 gap-3">
                  <div className="md:col-span-2 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-3">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                      <span>Older scans</span>
                      <span>Newer scans</span>
                    </div>
                    <svg
                      viewBox={`0 0 ${trendChart.width} ${trendChart.height}`}
                      className="w-full h-28"
                      role="img"
                      aria-label="ATS score trend line graph"
                    >
                      {[25, 50, 75].map((level) => {
                        const y = trendChart.padding + (100 - level) * ((trendChart.height - trendChart.padding * 2) / 100);
                        return (
                          <line
                            key={level}
                            x1={trendChart.padding}
                            y1={y}
                            x2={trendChart.width - trendChart.padding}
                            y2={y}
                            stroke="#dbeafe"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                          />
                        );
                      })}
                      {trendChart.path && (
                        <path
                          d={trendChart.path}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                      {trendChart.points.map((point, idx) => (
                        <circle key={`${point.at}-${idx}`} cx={point.x} cy={point.y} r="3.5" fill="#1d4ed8">
                          <title>{`${new Date(point.at).toLocaleString()}: ${point.score}/100`}</title>
                        </circle>
                      ))}
                    </svg>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-700">
                      <span>Start: {trendChart.scans[0]?.overallScore ?? 0}/100</span>
                      <span>Latest: {trendChart.scans[trendChart.scans.length - 1]?.overallScore ?? 0}/100</span>
                    </div>
                  </div>
                  {atsHistory.map((scan) => (
                    <div key={`${scan.id ?? 'scan'}-${scan.analysisDate}`} className="rounded-lg border p-3 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{new Date(scan.analysisDate).toLocaleString()}</span>
                        <Badge variant="outline">{scan.overallScore}/100</Badge>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        Keyword {scan.keywordScore}/25 · Formatting {scan.formattingScore}/25 · Readability {scan.readabilityScore}/25
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {atsAnalysis ? (
              <>
                {/* Score Overview */}
                <Card className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Overall Score</h3>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-5xl font-bold text-blue-600">{atsAnalysis.overallScore}/100</div>
                    <div className="w-32 h-32 rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 p-1 flex items-center justify-center">
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                        <span className={`text-3xl font-bold ${
                          atsAnalysis.overallScore >= 75 ? 'text-green-600' : 
                          atsAnalysis.overallScore >= 50 ? 'text-yellow-600' : 
                          'text-red-600'
                        }`}>
                          {atsAnalysis.overallScore}%
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Scores Grid */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Keyword Score</h4>
                    <div className="text-2xl font-bold text-blue-600">{atsAnalysis.keywordScore}/25</div>
                    <p className="text-sm text-gray-600 mt-2">Keywords relevant to industry</p>
                  </Card>
                  <Card className="p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Formatting Score</h4>
                    <div className="text-2xl font-bold text-blue-600">{atsAnalysis.formattingScore}/25</div>
                    <p className="text-sm text-gray-600 mt-2">ATS-friendly formatting</p>
                  </Card>
                  <Card className="p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Readability Score</h4>
                    <div className="text-2xl font-bold text-blue-600">{atsAnalysis.readabilityScore}/25</div>
                    <p className="text-sm text-gray-600 mt-2">Text clarity and structure</p>
                  </Card>
                </div>

                {/* Issues & Recommendations */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Formatting Issues */}
                  {atsAnalysis.formattingIssues.length > 0 && (
                    <Card className="p-6 border-red-200 bg-red-50">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        Issues Found
                      </h4>
                      <ul className="space-y-2">
                        {atsAnalysis.formattingIssues.map((issue, idx) => (
                          <li key={idx} className="text-sm text-gray-700">• {issue}</li>
                        ))}
                      </ul>
                    </Card>
                  )}

                  {/* Improvements */}
                  {atsAnalysis.improvements.length > 0 && (
                    <Card className="p-6 border-yellow-200 bg-yellow-50">
                      <h4 className="font-semibold text-gray-900 mb-3">Improvements</h4>
                      <ul className="space-y-2">
                        {atsAnalysis.improvements.map((imp, idx) => (
                          <li key={idx} className="text-sm text-gray-700">• {imp}</li>
                        ))}
                      </ul>
                    </Card>
                  )}
                </div>

                {/* Strengths */}
                {atsAnalysis.strengths.length > 0 && (
                  <Card className="p-6 border-green-200 bg-green-50">
                    <h4 className="font-semibold text-gray-900 mb-3">Strengths</h4>
                    <ul className="space-y-2">
                      {atsAnalysis.strengths.map((strength, idx) => (
                        <li key={idx} className="text-sm text-gray-700">✓ {strength}</li>
                      ))}
                    </ul>
                  </Card>
                )}

                {/* Suggested Keywords */}
                {atsAnalysis.suggestedKeywords.length > 0 && (
                  <Card className="p-6">
                    <h4 className="font-semibold text-gray-900 mb-3">Keywords to Add</h4>
                    <div className="flex flex-wrap gap-2">
                      {atsAnalysis.suggestedKeywords.map((keyword, idx) => (
                        <Badge key={idx} variant="outline">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            ) : (
              <Card className="p-8 text-center">
                <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Click "Analyze CV" to get ATS recommendations</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CVBuilder;
