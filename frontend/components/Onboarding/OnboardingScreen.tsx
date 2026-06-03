'use client';
import { ArrowRight, Check, X } from 'lucide-react';

const CAN = [
  'Add, edit, and delete subtitle cues with custom text, timing, and style',
  'Add, edit, and delete music tracks with volume and fade control',
  'Use natural language: "make it bigger", "move it earlier", "lower the music"',
  'See all changes reflected live in the preview player instantly',
  'Upload a video and music files to use as the timeline source',
];

const CANNOT = [
  'Edit, reorder, or trim video clips — clip editing is not supported',
  'Upload files via chat — use the upload buttons in the player panel',
  'Undo or redo changes — edits are permanent once confirmed',
  'Bulk operations like "delete all subtitles before 10 seconds"',
  'Export or download the final video — not in this version',
];

const EXAMPLES = [
  "Add a subtitle saying &lsquo;And we&apos;re live!&rsquo; from 10s to 13s",
  'Lower the background music volume to 30%',
  'Add a 3 second fade out to the music',
  'Change the first subtitle to say "Hello everyone"',
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
