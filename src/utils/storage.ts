import { TranscriptionResult } from './exportUtils';

export interface SavedTranscription extends TranscriptionResult {
  id: string;
  timestamp: number;
}

const STORAGE_KEY = 'sawti_transcription_history';

export function getSavedTranscriptions(): SavedTranscription[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load history from localStorage', e);
    return [];
  }
}

export function saveTranscriptionToHistory(result: TranscriptionResult): SavedTranscription {
  const history = getSavedTranscriptions();
  const newItem: SavedTranscription = {
    ...result,
    id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
  };

  // Keep latest 50 items
  const updated = [newItem, ...history.filter((item) => item.id !== newItem.id)].slice(0, 50);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Storage quota exceeded, trimming history', e);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 20)));
  }
  return newItem;
}

export function updateTranscriptionInHistory(updatedItem: SavedTranscription): void {
  const history = getSavedTranscriptions();
  const index = history.findIndex((i) => i.id === updatedItem.id);
  if (index !== -1) {
    history[index] = updatedItem;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }
}

export function deleteTranscriptionFromHistory(id: string): void {
  const history = getSavedTranscriptions();
  const filtered = history.filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function clearTranscriptionHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
