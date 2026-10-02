export type Mode = 'append-only' | 'document-sync';
export type Retention = 'text' | 'activity-only';
export type Exposure = 'normal' | 'unknown' | 'secure';
export type Source = { id: string; control?: boolean; activity?: boolean; documentDiff?: boolean; composition?: boolean; committedText?: boolean; stableRevision?: boolean };
export type Header = { source: string; seq: number; epoch: number };
export type Change = { baseVersion: number; version: number; start: number; deleteCount: number; text: string };
export type CommitMetadata = { quality?: 'known' | 'unknown'; commitSerial?: number; stableRevision?: boolean; reason?: 'typing' | 'paste' | 'completion' | 'replace' | 'delete' | 'undo' | 'redo'; ink?: 'white' | 'blue' | 'green' | 'purple' };
export type Event = Header & (
  | { kind: 'focus'; context: { app: string; field: string; document: string; exposure: Exposure } }
  | { kind: 'activity'; activityClass: 'key' | 'shortcut' | 'edit'; count: number }
  | { kind: 'snapshot'; version: number; text: string; quality?: 'known' | 'unknown'; commitSerialBaseline?: number }
  | ({ kind: 'edit'; change: Change } & CommitMetadata)
  | { kind: 'composition-begin'; compositionId: string }
  | { kind: 'composition-update'; compositionId: string; text: string }
  | { kind: 'composition-cancel'; compositionId: string }
  | ({ kind: 'composition-commit'; compositionId: string; change: Change } & CommitMetadata)
  | { kind: 'tick'; budget?: number }
);
export type Config = { mode?: Mode; retention?: Retention; persistText?: boolean; maxSources?: number; maxEventText?: number; maxDocument?: number; maxPreview?: number; maxBody?: number; maxPending?: number; maxJobs?: number; drainPerTick?: number; sources?: Source[] };
export type Decision = { ack: boolean; disposition: string; reason: string; retry: boolean; knownCommit: boolean; queued: number };
export declare function createState(config?: Config): unknown;
export declare function reduce(state: unknown, event: Event): { state: unknown; decision: Decision };
export declare function serializeForPersistence(state: unknown): unknown;
export declare function inspect(state: unknown): unknown;
