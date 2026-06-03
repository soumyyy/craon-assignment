'use client';
import { useEffect, useState } from 'react';
import { getTimeline } from '@/lib/api';
import type { AppStage, Timeline } from '@/types/timeline';
import { OnboardingScreen } from '@/components/Onboarding/OnboardingScreen';
import { UploadScreen } from '@/components/Upload/UploadScreen';
import { EditorLayout } from '@/components/Editor/EditorLayout';

export default function Home() {
  const [stage, setStage] = useState<AppStage | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);

  useEffect(() => {
    getTimeline()
      .then((tl) => {
        setTimeline(tl);
        if (tl.video_src) {
          setStage('editor');
        } else if (typeof window !== 'undefined' && localStorage.getItem('seen_onboarding')) {
          setStage('upload');
        } else {
          setStage('onboarding');
        }
      })
      .catch(() => setStage('onboarding'));
  }, []);

  if (!stage) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const advanceToUpload = () => {
    localStorage.setItem('seen_onboarding', '1');
    setStage('upload');
  };

  const advanceToEditor = (tl: Timeline) => {
    setTimeline(tl);
    setStage('editor');
  };

  return (
    <>
      {stage === 'onboarding' && <OnboardingScreen onComplete={advanceToUpload} />}
      {stage === 'upload' && <UploadScreen onComplete={advanceToEditor} />}
      {stage === 'editor' && timeline && (
        <EditorLayout initialTimeline={timeline} onTimelineChange={setTimeline} />
      )}
    </>
  );
}
