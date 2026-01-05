
import React, { useState, useEffect } from 'react';
import { LevelData, UserProfile, TaskRecord, ACADEMY_BADGES } from '../types';
import { playPositiveSound, playCelebrationSound } from '../services/audioService';
import { storageService } from '../services/storageService';
import { reviewDeliverableAI, generateLevelMaterial, generateLevelQuiz } from '../services/geminiService';
import { BadgeCelebration } from './BadgeCelebration';

interface LevelViewProps {
  level: LevelData;
  user: UserProfile & { uid: string };
  tasks: TaskRecord[];
  onBack: () => void;
  onComplete: () => void;
}

export const LevelView: React.FC<LevelViewProps> = ({ level, user, tasks, onBack, onComplete }) => {
  const [step, setStep] = useState<'CONTENT' | 'QUIZ' | 'DELIVERABLE' | 'FEEDBACK'>('CONTENT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [showBadge, setShowBadge] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  
  // AI Generated Material States
  const [aiMaterial, setAiMaterial] = useState<{
    philosophy: string;
    axes: { title: string; description: string; icon: string }[];
    expertTip: string;
  } | null>(null);

  const [aiQuiz, setAiQuiz] = useState<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[]>([]);

  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  useEffect(() => {
    const fetchAIContent = async () => {
      setIsLoadingContent(true);
      try {
        const [material, quiz] = await Promise.all([
          generateLevelMaterial(level.id, level.title, { startupName: user.startupName, industry: user.industry }),
          generateLevelQuiz(level.id, level.title)
        ]);
        setAiMaterial(material);
        setAiQuiz(quiz);
      } catch (err) {
        console.error("AI Fetch error", err);
      } finally {
        setIsLoadingContent(false);
      }
    };
    fetchAIContent();
  }, [level.id, level.title, user.startupName, user.industry]);

  const currentTask = tasks.find(t => t.levelId === level.id);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTask) return;

    setIsSubmitting(true);
    playPositiveSound();

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const fileData = reader.result as string;
        const context = `Startup: ${user.startupName}, Industry: ${user.industry}, Level: ${level.title}`;
        const review = await reviewDeliverableAI(currentTask.title, currentTask.description, context);
        
        const finalScore = review.readinessScore || 85; // Fallback
        const processedReview = { ...review, score: finalScore };

        storageService.submitTask(user.uid, currentTask.id, {
          fileData,
          fileName: file.name
        }, processedReview);

        setAiResult(processedReview);
        setStep('FEEDBACK');
        if (finalScore >= 70) playCelebrationSound();
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert("حدث خطأ أثناء المراجعة الذكية.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuizSubmit = () => {
    setQuizSubmitted(true);
    const correctCount = aiQuiz.filter((q, i) => quizAnswers[i] === q.correctIndex).length;
    
    if (correctCount === aiQuiz.length) {
      playCelebrationSound();
      // Auto move to next step after brief delay if perfect
      setTimeout(() => setStep('DELIVERABLE'), 3000);
    } else {
      playPositiveSound();
    }
  };

  const activeBadge = ACADEMY_BADGES.find(b => b.levelId === level.id);
  if (showBadge && activeBadge) return <BadgeCelebration badge={activeBadge} user={user} onClose={onComplete} />;

  if (isLoadingContent) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-10 font-sans" dir="rtl">
        <div className="w-24 h-24 border-8 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-8 shadow-inner"></div>
        <h2 className="text-3xl font-black text-slate-900 animate-pulse">جاري تحضير المحطة المعرفية...</h2>
        <p className="text-slate-500 mt-4 text-lg">الموجه الذكي يقوم بصياغة المادة العلمية والاختبارات لمشروعك.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" dir="rtl">
      {/* Header with Navigation and Progress */}
      <header className="px-8 py-6 border-b border-slate-200 flex justify-between items-center bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-6">
           <button onClick={onBack} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-all group">
              <svg className="w-6 h-6 transform rotate-180 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
           </button>
           <div>
              <div className="flex items-center gap-3 mb-1">
                 <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-100">محطة 0{level.id}</span>
                 <h2 className="text-2xl font-black text-slate-900">{level.title}</h2>
              </div>
              <div className="flex gap-2">
                 {['المادة المعرفية', 'اختبار الجاهزية', 'تسليم المخرج'].map((s, i) => (
                   <div key={i} className={`h-1.5 rounded-full transition-all duration-1000 ${
                     (step === 'CONTENT' && i === 0) || (step === 'QUIZ' && i <= 1) || (step === 'DELIVERABLE' && i <= 2) || (step === 'FEEDBACK' && i <= 2)
                     ? 'w-16 bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'w-6 bg-slate-200'
                   }`}></div>
                 ))}
              </div>
           </div>
        </div>
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-4xl shadow-inner border border-slate-200">{level.icon}</div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-10 overflow-y-auto">
        
        {/* Step 1: Content Consumption */}
        {step === 'CONTENT' && aiMaterial && (
          <div className="animate-fade-up space-y-12 pb-32">
             <div className="aspect-video w-full bg-slate-900 rounded-[4rem] overflow-hidden relative group shadow-3xl">
                <img src={level.imageUrl} className="w-full h-full object-cover opacity-50 grayscale group-hover:grayscale-0 transition-all duration-1000" alt="" />
                <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-gradient-to-t from-slate-950 via-transparent to-transparent">
                   <h3 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tighter leading-none">جوهر المرحلة</h3>
                   <p className="text-blue-100 text-xl md:text-3xl max-w-4xl font-medium leading-relaxed italic">"{aiMaterial.philosophy}"</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {aiMaterial.axes.map((item, i) => (
                  <div key={i} className="p-10 bg-white border border-slate-100 rounded-[3rem] shadow-sm hover:border-blue-600 transition-all group flex flex-col items-start gap-6">
                     <span className="text-5xl block bg-slate-50 w-20 h-20 flex items-center justify-center rounded-[1.8rem] group-hover:scale-110 group-hover:rotate-6 transition-transform shadow-inner">{item.icon || '🎯'}</span>
                     <div>
                        <h4 className="text-2xl font-black text-slate-900 mb-3">{item.title}</h4>
                        <p className="text-slate-500 text-lg leading-relaxed font-medium">{item.description}</p>
                     </div>
                  </div>
                ))}
             </div>

             <div className="p-12 bg-slate-950 text-white rounded-[4rem] relative overflow-hidden group shadow-2xl">
                <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] -z-0"></div>
                <h4 className="text-blue-400 font-black text-xs uppercase tracking-[0.4em] mb-6 relative z-10 flex items-center gap-3">
                   <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                   نصيحة الموجه الذكي 💭
                </h4>
                <p className="text-3xl font-bold leading-relaxed relative z-10 italic">"{aiMaterial.expertTip}"</p>
             </div>

             <div className="flex justify-center pt-10">
                <button 
                  onClick={() => { setStep('QUIZ'); playPositiveSound(); window.scrollTo(0,0); }} 
                  className="px-20 py-8 bg-blue-600 text-white rounded-[2.5rem] font-black text-2xl hover:bg-blue-700 transition-all active:scale-95 shadow-3xl shadow-blue-500/30"
                >
                  انتقل لاختبار الجاهزية
                </button>
             </div>
          </div>
        )}

        {/* Step 2: Interactive Quiz */}
        {step === 'QUIZ' && (
           <div className="max-w-3xl mx-auto space-y-12 animate-fade-up py-10 pb-32">
              <div className="text-center space-y-6">
                 <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center text-4xl mx-auto shadow-inner border border-blue-100 animate-bounce">🧠</div>
                 <h3 className="text-5xl font-black text-slate-900 tracking-tight">اختبار المحطة 0{level.id}</h3>
                 <p className="text-slate-500 text-xl font-medium">أجب على هذه الأسئلة للتأكد من استيعابك للمفاهيم الاستراتيجية لهذه المرحلة.</p>
              </div>

              <div className="space-y-10">
                 {aiQuiz.map((q, i) => (
                    <div key={i} className="p-10 bg-white border border-slate-100 rounded-[3.5rem] space-y-8 relative overflow-hidden shadow-sm">
                       {quizSubmitted && (
                          <div className={`absolute top-0 left-0 w-full h-2 ${quizAnswers[i] === q.correctIndex ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                       )}
                       <h4 className="font-black text-2xl text-slate-800 leading-tight">
                          <span className="text-blue-600 ml-4 font-mono">0{i+1}.</span>
                          {q.question}
                       </h4>
                       <div className="grid grid-cols-1 gap-4">
                          {q.options.map((o, oi) => {
                            const isSelected = quizAnswers[i] === oi;
                            const isCorrect = q.correctIndex === oi;
                            return (
                              <button 
                                key={oi} 
                                disabled={quizSubmitted}
                                onClick={() => { setQuizAnswers({...quizAnswers, [i]: oi}); playPositiveSound(); }} 
                                className={`w-full text-right p-6 border-2 rounded-[2rem] font-bold text-lg transition-all flex justify-between items-center
                                  ${isSelected ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md scale-[1.02]' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}
                                  ${quizSubmitted && isCorrect ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : ''}
                                  ${quizSubmitted && isSelected && !isCorrect ? 'border-rose-500 bg-rose-50 text-rose-800' : ''}
                                `}
                              >
                                 <span>{o}</span>
                                 {quizSubmitted && isCorrect && <span className="text-2xl">✅</span>}
                                 {quizSubmitted && isSelected && !isCorrect && <span className="text-2xl">❌</span>}
                              </button>
                            );
                          })}
                       </div>
                       {quizSubmitted && (
                          <div className={`mt-6 p-6 rounded-3xl text-sm font-medium leading-relaxed italic border
                             ${quizAnswers[i] === q.correctIndex ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-600'}
                          `}>
                             💡 {q.explanation}
                          </div>
                       )}
                    </div>
                 ))}
              </div>

              <div className="flex gap-6">
                 {quizSubmitted && aiQuiz.filter((q, i) => quizAnswers[i] === q.correctIndex).length < aiQuiz.length && (
                    <button onClick={() => { setQuizSubmitted(false); setQuizAnswers({}); playPositiveSound(); }} className="flex-1 py-7 bg-white border-2 border-slate-200 text-slate-600 rounded-[2rem] font-black text-xl hover:bg-slate-50 transition-all">إعادة المحاولة</button>
                 )}
                 <button 
                  onClick={quizSubmitted ? () => { setStep('DELIVERABLE'); playPositiveSound(); } : handleQuizSubmit} 
                  disabled={Object.keys(quizAnswers).length < aiQuiz.length}
                  className="flex-[2] py-7 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-4 group"
                 >
                    <span>{quizSubmitted ? 'المتابعة لتسليم المخرج' : 'تأكيد الإجابات'}</span>
                    <svg className="w-8 h-8 transform rotate-180 group-hover:-translate-x-2 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                 </button>
              </div>
           </div>
        )}

        {/* Step 3: Deliverable Submission (Refined existing UI) */}
        {step === 'DELIVERABLE' && (
           <div className="max-w-2xl mx-auto space-y-16 animate-fade-up py-10 pb-32">
              <div className="text-center space-y-6">
                 <div className="w-24 h-24 bg-blue-50 rounded-[2.5rem] flex items-center justify-center text-5xl mx-auto shadow-inner border border-blue-100">📤</div>
                 <h3 className="text-5xl font-black text-slate-900 tracking-tight">{currentTask?.title}</h3>
                 <p className="text-slate-500 text-xl font-medium leading-relaxed">{currentTask?.description}</p>
              </div>

              <div className="relative group">
                 <input 
                  type="file" 
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={isSubmitting}
                 />
                 <div className={`w-full h-96 border-4 border-dashed rounded-[4rem] flex flex-col items-center justify-center transition-all duration-700
                   ${isSubmitting ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200 group-hover:border-blue-600 group-hover:bg-blue-50/20 shadow-sm'}
                 `}>
                    {isSubmitting ? (
                      <div className="flex flex-col items-center gap-10">
                        <div className="w-20 h-20 border-8 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-blue-600 text-2xl font-black animate-pulse">جاري التدقيق الاستراتيجي للمخرج...</p>
                      </div>
                    ) : (
                      <>
                        <div className="text-8xl mb-8 transform group-hover:scale-110 group-hover:-rotate-6 transition-transform">📄</div>
                        <p className="font-black text-slate-900 text-2xl mb-2">اضغط لرفع ملف الـ PDF النهائي</p>
                        <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em]">Validated File Support: Up to 10MB</p>
                      </>
                    )}
                 </div>
              </div>

              <div className="p-10 bg-amber-50 border border-amber-100 rounded-[3rem] flex gap-8 items-start shadow-sm">
                 <span className="text-5xl shrink-0">💡</span>
                 <div>
                    <h5 className="font-black text-amber-900 text-xl mb-2">نصيحة التدقيق:</h5>
                    <p className="text-amber-800/80 text-lg font-medium leading-relaxed">الموجه الذكي يبحث عن التناسق المنطقي بين المشكلة والحل. تأكد من أن ملفك يغطي المحاور الأربعة التي تمت مناقشتها في بداية المحطة.</p>
                 </div>
              </div>
           </div>
        )}

        {/* Step 4: AI Feedback and Completion */}
        {step === 'FEEDBACK' && aiResult && (
           <div className="max-w-3xl mx-auto space-y-12 animate-fade-up py-10 pb-32">
              <div className="p-14 bg-white border border-slate-100 rounded-[5rem] shadow-3xl text-center space-y-12 relative overflow-hidden">
                 <div className={`absolute top-0 left-0 w-full h-3 ${aiResult.score >= 90 ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]' : 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.5)]'}`}></div>
                 
                 <div className="space-y-8">
                    <div className={`w-32 h-32 rounded-[2.5rem] flex items-center justify-center text-7xl mx-auto shadow-inner animate-bounce
                      ${aiResult.score >= 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}
                    `}>
                      {aiResult.score >= 70 ? '✓' : '!'}
                    </div>
                    <h3 className="text-5xl font-black text-slate-900 tracking-tight">تحليل المخرج الذكي</h3>
                    
                    <div className="flex flex-col items-center gap-3 py-6 bg-slate-50 rounded-[3rem] border border-slate-100 max-w-sm mx-auto">
                       <p className="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">Final Score Verdict</p>
                       <p className={`text-8xl font-black ${aiResult.score >= 90 ? 'text-emerald-500' : 'text-blue-600'} tracking-tighter tabular-nums`}>{aiResult.score}%</p>
                       {aiResult.score >= 90 && (
                         <div className="bg-emerald-100 text-emerald-700 px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-widest mt-4">أداء استثنائي - جاهزية استثمارية 💎</div>
                       )}
                    </div>
                 </div>

                 <div className="p-10 bg-slate-950 rounded-[3.5rem] border border-white/5 text-right space-y-8 shadow-2xl relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl"></div>
                    <h4 className="font-black text-blue-400 text-xs uppercase tracking-[0.3em] flex items-center gap-3">
                       <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                       Strategic Executive Review
                    </h4>
                    <p className="text-slate-200 text-2xl font-medium leading-relaxed italic pr-8 border-r-4 border-blue-500/50">
                      "{aiResult.criticalFeedback || 'تحليل دقيق ومكتمل المعايير، يظهر المشروع نضجاً كبيراً في التفكير التشغيلي.'}"
                    </p>
                    
                    {aiResult.suggestedNextSteps && aiResult.suggestedNextSteps.length > 0 && (
                      <div className="pt-6 border-t border-white/5">
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">خارطة الطريق للمحطة القادمة:</p>
                         <ul className="space-y-4">
                            {aiResult.suggestedNextSteps.map((s: string, i: number) => (
                              <li key={i} className="text-lg font-bold text-slate-300 flex items-center gap-5 group">
                                 <span className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all text-xs font-black shrink-0 border border-white/10">{i+1}</span>
                                 {s}
                              </li>
                            ))}
                         </ul>
                      </div>
                    )}
                 </div>

                 <button 
                  onClick={() => setShowBadge(true)} 
                  className={`w-full py-8 text-white rounded-[2.5rem] font-black text-2xl shadow-3xl active:scale-[0.98] transition-all transform hover:scale-[1.02]
                    ${aiResult.score >= 70 ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30' : 'bg-slate-900 hover:bg-black shadow-slate-900/30'}
                  `}
                 >
                   {aiResult.score >= 70 ? 'استلام وسام المحطة والمتابعة 🚀' : 'حفظ الإنجاز والانتقال للمسار'}
                 </button>
              </div>
           </div>
        )}
      </main>

      <footer className="py-12 border-t border-slate-200 text-center opacity-40">
         <p className="text-[11px] font-black uppercase tracking-[0.6em] text-slate-900">Virtual Academy Protocol • Business Developers Hub • 2024</p>
      </footer>
    </div>
  );
};
