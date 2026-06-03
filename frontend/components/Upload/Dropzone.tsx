'use client';
import { useRef, useState } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

type DropzoneState = 'idle' | 'dragover' | 'validating' | 'uploading' | 'success' | 'error';

interface Props {
  accept: string;
  label: string;
  hint: string;
  state: DropzoneState;
  progress?: number;
  error?: string;
  successLabel?: string;
  onFiles: (files: FileList) => void;
  multiple?: boolean;
}

export function Dropzone({ accept, label, hint, state, progress, error, successLabel, onFiles, multiple }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const borderClass =
    state === 'success' ? 'border-status-success' :
    state === 'error'   ? 'border-status-error' :
    dragging            ? 'border-accent' :
                          'border-cream-subtle';

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div
        className={`relative border-2 border-dashed ${borderClass} rounded-lg p-8 transition-all cursor-pointer bg-bg-elevated hover:bg-bg-hover`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        tabIndex={0}
        role="button"
        aria-label={label}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => e.target.files && onFiles(e.target.files)}
        />

        <div className="flex flex-col items-center gap-3 text-center">
          {state === 'validating' || state === 'uploading' ? (
            <Loader2 size={24} className="text-accent animate-spin" />
          ) : state === 'success' ? (
            <CheckCircle size={24} className="text-status-success" />
          ) : state === 'error' ? (
            <AlertCircle size={24} className="text-status-error" />
          ) : (
            <Upload size={24} className="text-cream-muted" />
          )}

          <div>
            <p className="text-cream text-sm font-medium">
              {state === 'validating' ? 'Checking file…' :
               state === 'uploading' ? `Uploading… ${progress ?? 0}%` :
               state === 'success' && successLabel ? successLabel :
               label}
            </p>
            <p className="text-cream-muted text-xs mt-1">{hint}</p>
          </div>
        </div>

        {state === 'uploading' && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-bg-hover rounded-b-lg overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-200"
              style={{ width: `${progress ?? 0}%` }}
            />
          </div>
        )}
      </div>

      {state === 'error' && error && (
        <p className="text-status-error text-xs mt-2 ml-1">{error}</p>
      )}
    </div>
  );
}
