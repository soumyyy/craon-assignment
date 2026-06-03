'use client';
import { ArrowRight, Check, X } from 'lucide-react';

const CAN = [
  'Trim the video to a specific time range (e.g. "cut to the first 30 seconds")',
  'Crop the video aspect ratio — 16:9, 9:16, 1:1, 4:3, 21:9',
  'Add, edit, and delete subtitle cues with custom text, timing, and style',
  'Add, edit, and delete background music tracks with volume and fade control',
  'Export and download the final video with all edits baked in',
  'Auto-generate subtitles from speech using Whisper AI',
];

const CANNOT = [
  'Control the original video\'s audio volume — only background music is adjustable',
  'Upload files via chat — use the upload buttons in the header',
  'Undo or redo changes — edits are saved immediately',
  'Reorder or rearrange video clips',
];

const EXAMPLES = [
  'Trim to the first 30 seconds',
  'Crop to a vertical 9:16 format',
  'Lower the background music to 40%',
  'Add a subtitle saying "Hello" from 5s to 8s',
  'Generate subtitles from the video',
];

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-12">
          <h1 className="text-2xl font-semibold text-cream mb-2">Video Timeline Editor</h1>
          <p className="text-cream-muted text-sm">AI-powered editing through natural language</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          <div className="bg-bg-surface border-l-4 border-status-success rounded-lg p-5">
            <h2 className="text-cream text-sm font-semibold mb-4">What I can do</h2>
            <ul className="space-y-3">
              {CAN.map((item) => (
                <li key={item} className="flex gap-3 text-cream-muted text-sm">
                  <Check size={15} className="text-status-success shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-bg-surface border-l-4 border-status-error rounded-lg p-5">
            <h2 className="text-cream text-sm font-semibold mb-4">What I cannot do</h2>
            <ul className="space-y-3">
              {CANNOT.map((item) => (
                <li key={item} className="flex gap-3 text-cream-muted text-sm">
                  <X size={15} className="text-status-error shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mb-10">
          <p className="text-cream-muted text-xs uppercase tracking-widest mb-3">Example commands you can try</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <span
                key={ex}
                className="bg-bg-elevated text-cream-muted text-xs px-3 py-1.5 rounded-full border border-cream-subtle"
              >
                {ex}
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={onComplete}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg-primary text-sm font-semibold px-6 py-3 rounded-lg transition-all hover:scale-105 active:scale-95"
          >
            Start Editing
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
