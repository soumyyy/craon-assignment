export interface SubtitleStyle {
  font_size: number;
  color: string;
  position: 'bottom' | 'top' | 'center';
}

export interface SubtitleCue {
  id: string;
  text: string;
  start_ms: number;
  end_ms: number;
  style: SubtitleStyle;
}

export interface MusicTrack {
  id: string;
  src: string;
  start_ms: number;
  end_ms: number;
  volume: number;
  fade_in_ms: number;
  fade_out_ms: number;
}

export interface VideoClip {
  id: string;
  src: string;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  resolution: { width: number; height: number };
}

export interface Timeline {
  _id: string;
  name: string;
  duration_ms: number;
  fps: number;
  resolution: { width: number; height: number };
  video_src: string;
  clips: VideoClip[];
  music: MusicTrack[];
  subtitles: SubtitleCue[];
  trim_start_ms: number;
  trim_end_ms: number | null;
  crop_aspect_ratio: '16:9' | '9:16' | '1:1' | '4:3' | '21:9' | null;
  video_volume: number;
}

export type MessageStatus = 'success' | 'warning' | 'error';
export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  status?: MessageStatus;
  timestamp: string;
}

export interface UploadVideoResult {
  url: string;
  duration_ms: number;
  timeline: Timeline;
}

export interface UploadAudioResult {
  url: string;
  timeline_id: string;
  attached_to: string | null;
  created_track: boolean;
  timeline: Timeline;
}

export interface ChatResponse {
  response: string;
  timeline: Timeline;
  tool_calls: Array<{ tool: string; args: Record<string, unknown> }>;
}

export type AppStage = 'onboarding' | 'upload' | 'editor';

export interface ValidationResult {
  ok: boolean;
  error?: string;
  warning?: string;
}
