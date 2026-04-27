import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User, Sparkles, ChevronDown } from 'lucide-react';
import { supabase, runtimeEnvStatus } from '@/lib/supabase';
import type { UserProfile } from '@/hooks/useAuth';
import {
  analyzeChatKeywords,
  buildLocalChatReply,
  isGenericAssistantReply,
  learnFromChatInteraction,
} from '@/lib/chatKeywordEngine';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CareerAdvisorChatProps {
  profile: UserProfile | null;
  isLoggedIn: boolean;
}

const SUGGESTED_QUESTIONS = [
  "What career suits my subjects?",
  "How do I improve my APS score?",
  "Which bursaries can I apply for?",
  "TVET vs University — which is better for me?",
  "What are the top in-demand careers in SA?",
  "How do I apply for NSFAS?",
];

const CareerAdvisorChat: React.FC<CareerAdvisorChatProps> = ({ profile, isLoggedIn }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (isOpen) setShowPulse(false);
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const normalizedText = text.trim();
    const analysis = analyzeChatKeywords(normalizedText, profile);
    const fallbackReply = buildLocalChatReply(normalizedText, profile, analysis);

    const userMessage: Message = { role: 'user', content: normalizedText };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      let reply = fallbackReply;
      let usedSupabaseReply = false;

      if (runtimeEnvStatus.isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.functions.invoke('career-advisor', {
          body: {
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
            atsAnalysis: analysis,
            profile: profile ? {
              full_name: profile.full_name,
              grade_level: profile.grade_level,
              province: profile.province,
              subjects: profile.subjects,
              aps_score: profile.aps_score,
              career_interests: profile.career_interests,
            } : null,
          },
        });

        if (error) {
          throw error;
        }

        usedSupabaseReply = !!(data?.reply && !isGenericAssistantReply(data.reply));
        reply = usedSupabaseReply ? data!.reply : fallbackReply;
      }

      learnFromChatInteraction(normalizedText, analysis, {
        replySource: usedSupabaseReply ? 'supabase' : 'local-fallback',
      });

      setMessages([...newMessages, { role: 'assistant', content: reply }]);
    } catch (err) {
      console.error('Chat error:', err);
      learnFromChatInteraction(normalizedText, analysis, {
        replySource: 'local-fallback',
      });
      setMessages([...newMessages, {
        role: 'assistant',
        content: fallbackReply
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestion = (q: string) => {
    sendMessage(q);
  };

  // Format message content with basic markdown-like styling
  const formatContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-bold text-gray-900 mt-2 mb-1">{line.replace(/\*\*/g, '')}</p>;
      }
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <p key={i} className="mb-1">
            {parts.map((part, j) => (
              j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
            ))}
          </p>
        );
      }
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return (
          <div key={i} className="flex gap-2 mb-0.5 ml-2">
            <span className="text-blue-500 mt-1 flex-shrink-0">•</span>
            <span>{line.replace(/^[-•]\s*/, '')}</span>
          </div>
        );
      }
      if (line.match(/^\d+\.\s/)) {
        return <p key={i} className="mb-0.5 ml-2">{line}</p>;
      }
      if (line.trim() === '') return <br key={i} />;
      return <p key={i} className="mb-1">{line}</p>;
    });
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 mb-0 sm:mb-0 ${
          isOpen
            ? 'bg-gray-700 hover:bg-gray-800'
            : 'bg-gradient-to-br from-blue-600 to-green-500 hover:from-blue-700 hover:to-green-600'
        }`}
        title="AI Career Advisor"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <>
            <MessageCircle className="w-6 h-6 text-white" />
            {showPulse && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full animate-ping" />
            )}
            {showPulse && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full" />
            )}
          </>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-28 right-4 sm:bottom-28 sm:right-8 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-green-600 p-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">AI Career Advisor</h3>
                <p className="text-blue-100 text-xs">Powered by EduHub SA</p>
              </div>
            </div>
            {/* SA flag accent */}
            <div className="flex gap-0.5 mt-3">
              <div className="h-0.5 flex-1 bg-green-400 rounded-full" />
              <div className="h-0.5 flex-1 bg-yellow-400 rounded-full" />
              <div className="h-0.5 flex-1 bg-red-400 rounded-full" />
              <div className="h-0.5 flex-1 bg-blue-300 rounded-full" />
              <div className="h-0.5 flex-1 bg-white/60 rounded-full" />
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-4">
                {/* Welcome Message */}
                <div className="flex gap-2.5">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-md p-3 max-w-[85%]">
                    <p className="text-sm text-gray-800">
                      Sawubona! 👋 I'm your AI Career Advisor. I can help you with:
                    </p>
                    <ul className="text-sm text-gray-700 mt-2 space-y-1 ml-1">
                      <li className="flex items-start gap-1.5"><span className="text-blue-500 mt-0.5">•</span> Career recommendations based on your subjects</li>
                      <li className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">•</span> Bursary and NSFAS guidance</li>
                      <li className="flex items-start gap-1.5"><span className="text-orange-500 mt-0.5">•</span> Study tips and APS improvement</li>
                      <li className="flex items-start gap-1.5"><span className="text-purple-500 mt-0.5">•</span> University vs TVET advice</li>
                    </ul>
                    {profile?.full_name && (
                      <p className="text-xs text-blue-600 mt-2 font-medium">
                        I can see your profile, {profile.full_name.split(' ')[0]} — I'll personalise my advice for you!
                      </p>
                    )}
                  </div>
                </div>

                {/* Suggested Questions */}
                <div className="pl-10">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Try asking:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_QUESTIONS.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestion(q)}
                        className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors border border-blue-100 font-medium"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className={`rounded-2xl p-3 max-w-[85%] text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-md'
                    : 'bg-gray-100 text-gray-800 rounded-tl-md'
                }`}>
                  {msg.role === 'assistant' ? formatContent(msg.content) : msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-md p-3">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Thinking...
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-3 flex-shrink-0 bg-white">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about careers, bursaries, studies..."
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                title="Send message"
                className="w-10 h-10 bg-gradient-to-br from-blue-600 to-green-500 text-white rounded-xl flex items-center justify-center hover:from-blue-700 hover:to-green-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <p className="text-[10px] text-gray-400 mt-1.5 text-center">
              AI-powered advice — always verify with official sources
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default CareerAdvisorChat;
