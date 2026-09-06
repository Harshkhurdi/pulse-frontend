import { useState, useEffect, useRef, useCallback } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from './firebaseClient';
import { BoardSwitcher } from './components/BoardSwitcher';
import { createBoard, deleteBoardDoc, ensureUserBoard } from './lib/boards';
import {
  Activity,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  GripVertical,
  Pencil,
  Trash2,
  Download,
  History,
} from 'lucide-react';
import {
  DndContext,
  pointerWithin,
  closestCorners,
  DragOverlay,
  useDroppable,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

/* ---------------------------------------------------------
   Pulse — AI Status & Risk Assistant
   Instrument-panel / vitals-monitor design language.
   Color carries meaning: live (cyan) = active/interactive,
   risk (red) = reserved exclusively for blocked/at-risk states.
--------------------------------------------------------- */

const STATUSES = [
  { key: 'todo', label: 'To Do' },
  { key: 'inprogress', label: 'In Progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Done' },
];
const STATUS_INDEX = Object.fromEntries(STATUSES.map((s, i) => [s.key, i]));
// Work-in-progress cap: no more than WIP_LIMIT tasks may sit in "In Progress".
const WIP_LIMIT = 6;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function isOverdue(iso, status) {
  if (status === 'done') return false;
  return new Date(iso + 'T23:59:59').getTime() < Date.now();
}
function relativeTime(iso) {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
/* Map a Firestore task document to the camelCase shape the UI expects. */
function mapTask(id, t) {
  return {
    id,
    title: t.title,
    owner: t.owner,
    status: t.status,
    dueDate: t.due_date,
    notes: t.notes || '',
    priority: t.priority || 'normal',
    tags: Array.isArray(t.tags) ? t.tags : [],
    subtasks: Array.isArray(t.subtasks)
      ? t.subtasks.map((s) => ({
          id: s.id || uid(),
          title: s.title || '',
          done: Boolean(s.done),
        }))
      : [],
    created_at: t.created_at ?? 0,
  };
}
/* ---------------------------------------------------------
   Styles
--------------------------------------------------------- */
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
      body { margin: 0; background: #0F141A; color: #E9EEF4; }

      .pulse-root {
        --bg: #0F141A;
        --surface: #1A212C;
        --surface-2: #222B38;
        --ink: #E9EEF4;
        --muted: #7C8A9C;
        --hairline: rgba(124, 138, 156, 0.16);
        --live: #41D6E0;
        --live-dim: rgba(65, 214, 224, 0.14);
        --risk: #EF4A52;
        --risk-dim: rgba(239, 74, 82, 0.12);
        --radius-sm: 6px;
        --radius-md: 10px;
        --radius-lg: 14px;
        font-family: 'Inter', -apple-system, sans-serif;
        background:
          radial-gradient(ellipse at 50% 0%, rgba(65, 214, 224, 0.07) 0%, transparent 55%),
          var(--bg);
        color: var(--ink);
        min-height: 100%;
        width: 100%;
        box-sizing: border-box;
        padding-bottom: 8px;
      }
      .pulse-root *, .pulse-root *::before, .pulse-root *::after { box-sizing: border-box; }
      .pulse-root .mono { font-family: 'JetBrains Mono', monospace; }
      .pulse-root .display { font-family: 'Space Grotesk', sans-serif; }
      .pulse-root button { font-family: inherit; cursor: pointer; }
      .pulse-root input, .pulse-root select, .pulse-root textarea { font-family: inherit; }
      .pulse-root :focus-visible { outline: 2px solid var(--live); outline-offset: 2px; }

      .pulse-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 28px;
        border-bottom: 1px solid var(--hairline);
        flex-wrap: wrap;
      }
      .pulse-brand { display: flex; align-items: center; gap: 12px; }
      .pulse-wordmark { font-size: 21px; font-weight: 700; letter-spacing: -0.01em; }
      .pulse-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .pulse-status-chip {
        display: flex;
        align-items: center;
        gap: 7px;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
        padding: 5px 10px;
        border: 1px solid var(--hairline);
        border-radius: 999px;
      }
      .pulse-dot {
        width: 7px; height: 7px; border-radius: 50%; background: var(--live);
        animation: pulse-dot 2.4s ease-in-out infinite;
      }
      @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

      .btn-generate {
        display: flex; align-items: center; gap: 8px;
        background: transparent; border: 1px solid var(--live); color: var(--live);
        padding: 10px 18px; border-radius: var(--radius-md);
        font-size: 13.5px; font-weight: 600;
        transition: background 0.15s ease;
      }
      .btn-generate:hover:not(:disabled) { background: var(--live-dim); }
      .btn-generate:disabled { opacity: 0.7; cursor: progress; }
      .btn-logout {
        background: none; border: 1px solid var(--hairline); color: var(--muted);
        padding: 8px 14px; border-radius: var(--radius-md); font-size: 12.5px; font-weight: 500;
        transition: border-color 0.15s ease, color 0.15s ease;
      }
      .btn-logout:hover { color: var(--risk); border-color: var(--risk); background: var(--risk-dim); }
      .btn-export {
        display: flex; align-items: center; gap: 6px;
        background: none; border: 1px solid var(--hairline); color: var(--muted);
        padding: 8px 14px; border-radius: var(--radius-md); font-size: 12.5px; font-weight: 500;
        transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
      }
      .btn-export:hover { color: var(--ink); border-color: var(--muted); background: var(--surface-2); }
      .spin { animation: spin 0.9s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }

      .pulse-wave path {
        fill: none; stroke: var(--live); stroke-width: 1.6;
        stroke-linecap: round; stroke-linejoin: round;
      }
      .pulse-wave.active path {
        stroke-dasharray: 1; stroke-dashoffset: 1;
        animation: draw 1.1s ease-in-out infinite;
      }
      @keyframes draw {
        0% { stroke-dashoffset: 1; opacity: 0.25; }
        55% { stroke-dashoffset: 0; opacity: 1; }
        100% { stroke-dashoffset: 0; opacity: 0.25; }
      }

      .update-panel {
        margin: 0 28px 24px;
        background: var(--surface);
        border: 1px solid var(--hairline);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }
      .update-header {
        width: 100%; background: none; border: none; text-align: left;
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 20px; cursor: pointer; color: inherit;
      }
      .update-title {
        display: flex; align-items: center; gap: 9px;
        font-size: 12.5px; font-weight: 600; letter-spacing: 0.07em;
        text-transform: uppercase; color: var(--muted);
      }
      .update-title svg { color: var(--live); }
      .update-meta { font-size: 11.5px; color: var(--muted); }
      .update-body { padding: 0 20px 20px; }
      .update-summary { font-size: 15px; line-height: 1.6; color: var(--ink); margin: 0 0 18px; padding-top: 2px; }
      .update-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
      .update-col { background: var(--surface-2); border-radius: var(--radius-md); padding: 12px 14px; }
      .update-col-head {
        display: flex; align-items: center; gap: 7px;
        font-size: 11px; font-weight: 600; letter-spacing: 0.07em;
        text-transform: uppercase; margin-bottom: 9px;
      }
      .update-col.shipped .update-col-head { color: #6FE3A8; }
      .update-col.inprog .update-col-head { color: var(--live); }
      .update-col.risk .update-col-head { color: var(--risk); }
      .update-item {
        font-size: 13px; line-height: 1.45; color: var(--ink);
        padding: 7px 0; border-top: 1px solid var(--hairline);
      }
      .update-item:first-child { border-top: none; padding-top: 0; }
      .update-item .reason { display: block; color: var(--muted); font-size: 12px; margin-top: 2px; }
      .update-empty { font-size: 12.5px; color: var(--muted); font-style: italic; }
      .update-error { font-size: 13.5px; color: var(--risk); padding: 10px; background: var(--risk-dim); border-radius: var(--radius-md); border: 1px solid rgba(239, 74, 82, 0.2); line-height: 1.5; font-family: monospace; }
      .update-loading { display: flex; align-items: center; gap: 10px; padding: 6px 0 4px; color: var(--muted); font-size: 13px; }

      .pulse-board {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
        padding: 0 28px 32px;
        align-items: start;
      }
      .pulse-col {
        background: rgba(255,255,255,0.015);
        border: 1px solid var(--hairline);
        border-radius: var(--radius-lg);
        padding: 14px;
        min-height: 200px;
        display: flex; flex-direction: column; gap: 10px;
        transition: border-color 0.15s ease, background 0.15s ease;
      }
      .pulse-col.drag-over { border-color: var(--live); background: var(--live-dim); }
      .col-head { display: flex; align-items: center; justify-content: space-between; }
      .col-label { font-size: 11.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
      .pulse-col.is-blocked .col-label { color: var(--risk); }
      .col-count { font-size: 11px; color: var(--muted); background: var(--surface-2); padding: 2px 7px; border-radius: var(--radius-sm); }
      .pulse-col.is-blocked .col-count { color: var(--risk); background: var(--risk-dim); }

      .task-card {
        background: var(--surface);
        border: 1px solid var(--hairline);
        border-radius: var(--radius-md);
        padding: 12px 12px 10px;
        cursor: grab;
        transition: border-color 0.15s ease;
        touch-action: none;
      }
      .task-card:hover { border-color: rgba(124,138,156,0.36); }
      .task-card.dragging { opacity: 0.4; }
      .task-card.is-blocked { border-left: 2px solid var(--risk); }
      .task-card.is-overdue .due { color: var(--risk); }
      .task-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; }
      .task-title { font-size: 13.5px; font-weight: 500; line-height: 1.4; color: var(--ink); }
      .task-edit-btn { background: none; border: none; color: var(--muted); padding: 2px; border-radius: var(--radius-sm); flex-shrink: 0; display: flex; }
      .task-edit-btn:hover { color: var(--live); }
      .task-meta { display: flex; align-items: center; justify-content: space-between; margin-top: 9px; }
      .task-owner { font-size: 11px; color: var(--muted); }
      .due { font-size: 11px; color: var(--muted); }
      .task-note {
        font-size: 11.5px; color: var(--muted); font-style: italic;
        margin-top: 7px; line-height: 1.4;
        border-top: 1px solid var(--hairline); padding-top: 7px;
      }
      .task-controls { display: flex; align-items: center; justify-content: space-between; margin-top: 9px; }
      .move-btns { display: flex; gap: 2px; }
      .move-btn { background: none; border: 1px solid var(--hairline); color: var(--muted); border-radius: var(--radius-sm); padding: 3px; display: flex; }
      .move-btn:hover:not(:disabled) { color: var(--live); border-color: var(--live); }
      .move-btn:disabled { opacity: 0.25; cursor: default; }
      .drag-handle { color: var(--muted); opacity: 0.5; display: flex; }

      .add-task-btn {
        background: none; border: 1px dashed var(--hairline); color: var(--muted);
        border-radius: var(--radius-md); padding: 9px; font-size: 12.5px;
        display: flex; align-items: center; justify-content: center; gap: 6px;
        margin-top: auto;
      }
      .add-task-btn:hover:not(:disabled) { color: var(--live); border-color: var(--live); }
      .add-task-btn:disabled { opacity: 0.45; cursor: not-allowed; }

      .modal-overlay {
        position: fixed; inset: 0; background: rgba(6,8,11,0.7);
        display: flex; align-items: center; justify-content: center;
        padding: 20px; z-index: 50;
      }
      .modal-box {
        background: var(--surface); border: 1px solid var(--hairline);
        border-radius: var(--radius-lg); width: 100%; max-width: 420px; padding: 22px;
        max-height: 90vh; overflow-y: auto;
      }
      .modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
      .modal-title { font-size: 16px; font-weight: 600; }
      .modal-close { background: none; border: none; color: var(--muted); display: flex; padding: 2px; }
      .modal-close:hover { color: var(--ink); }
      .field { margin-bottom: 14px; }
      .field label { display: block; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
      .field input, .field select, .field textarea {
        width: 100%; background: var(--surface-2); border: 1px solid var(--hairline);
        color: var(--ink); padding: 9px 11px; border-radius: var(--radius-sm); font-size: 13.5px;
      }
      .field textarea { resize: vertical; min-height: 56px; }
      .field input::placeholder, .field textarea::placeholder { color: var(--muted); }
      .modal-row { display: flex; gap: 12px; }
      .modal-row .field { flex: 1; }
      .modal-actions { display: flex; align-items: center; justify-content: space-between; margin-top: 18px; }
      .btn-delete { background: none; border: none; color: var(--muted); font-size: 12.5px; display: flex; align-items: center; gap: 5px; padding: 6px; }
      .btn-delete:hover { color: var(--risk); }
      .btn-save { background: var(--live); color: #06181A; border: none; padding: 10px 20px; border-radius: var(--radius-md); font-size: 13.5px; font-weight: 600; }
      .btn-save:hover { opacity: 0.9; }
      .btn-cancel { background: none; border: 1px solid var(--hairline); color: var(--muted); padding: 10px 16px; border-radius: var(--radius-md); font-size: 13.5px; margin-right: 8px; }

      .loading-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 14px; color: var(--muted); font-size: 13px; }

      .pulse-footer {
        text-align: center;
        padding: 32px 28px;
        font-size: 12.5px;
        color: var(--muted);
        border-top: 1px solid var(--hairline);
        margin-top: auto;
        letter-spacing: 0.02em;
      }
      .pulse-footer .heart {
        color: var(--risk);
        display: inline-block;
        animation: heartbeat 2s infinite;
      }
      @keyframes heartbeat {
        0%, 100% { transform: scale(1); }
        10%, 30% { transform: scale(1.1); }
        20% { transform: scale(1); }
      }

      /* Drag overlay styles */
      .drag-overlay-wrapper {
        cursor: grabbing;
      }

      /* Auth / Login styles */
      .auth-box {
        background: var(--surface);
        border: 1px solid rgba(65, 214, 224, 0.15);
        border-radius: var(--radius-lg);
        padding: 36px 32px 28px;
        width: 100%;
        max-width: 380px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      }
      .auth-brand {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin-bottom: 28px;
      }
      .auth-wordmark {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 24px;
        font-weight: 700;
        letter-spacing: -0.01em;
        color: var(--ink);
      }
      .auth-field {
        margin-bottom: 16px;
      }
      .auth-field label {
        display: block;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 6px;
      }
      .auth-field input {
        width: 100%;
        background: var(--surface-2);
        border: 1px solid var(--hairline);
        color: var(--ink);
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        font-size: 14px;
        outline: none;
        transition: border-color 0.15s ease;
      }
      .auth-field input:focus {
        border-color: var(--live);
        box-shadow: 0 0 0 3px rgba(65, 214, 224, 0.15);
      }
      .auth-field input::placeholder {
        color: var(--muted);
      }
      .auth-actions {
        display: flex;
        gap: 10px;
        margin-top: 20px;
      }
      .auth-actions button {
        flex: 1;
        padding: 10px 0;
        border-radius: var(--radius-md);
        font-size: 13.5px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease, opacity 0.15s ease;
      }
      .btn-login {
        background: var(--live);
        color: #06181A;
        border: none;
        transition: background 0.15s ease, opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
      }
      .btn-login:hover:not(:disabled) {
        opacity: 0.95;
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(65, 214, 224, 0.35);
      }
      .btn-signup {
        background: transparent;
        color: var(--muted);
        border: 1px solid var(--hairline);
      }
      .btn-signup:hover:not(:disabled) { color: var(--ink); border-color: var(--muted); }
      .auth-actions button:disabled { opacity: 0.6; cursor: progress; }
      .auth-error {
        font-size: 13px;
        color: var(--risk);
        padding: 10px 12px;
        background: var(--risk-dim);
        border-radius: var(--radius-md);
        border: 1px solid rgba(239, 74, 82, 0.2);
        line-height: 1.5;
        margin-top: 16px;
      }
      .auth-hint {
        text-align: center;
        font-size: 12px;
        color: var(--muted);
        margin-top: 18px;
      }

      /* ── Board switcher ── */
      .board-switcher { position: relative; }
      .board-switcher-btn { display: flex; align-items: center; gap: 6px; background: var(--surface); border: 1px solid var(--hairline); color: var(--ink); padding: 6px 12px; border-radius: var(--radius-md); font-size: 13px; font-weight: 600; transition: border-color .15s ease; }
      .board-switcher-btn:hover { border-color: var(--live); }
      .board-switcher-name { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .board-switcher-menu { position: absolute; left: 0; top: calc(100% + 6px); z-index: 40; background: var(--surface); border: 1px solid var(--hairline); border-radius: var(--radius-md); padding: 6px; min-width: 250px; box-shadow: 0 12px 40px rgba(0,0,0,.5); }
      .board-menu-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; color: var(--ink); }
      .board-menu-item:hover { background: var(--surface-2); }
      .board-menu-item.is-active { color: var(--live); }
      .board-menu-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .board-menu-delete { background: none; border: none; color: var(--muted); cursor: pointer; padding: 2px; display: flex; border-radius: 4px; }
      .board-menu-delete:hover:not(:disabled) { color: var(--risk); }
      .board-menu-delete:disabled { opacity: .3; cursor: default; }
      .board-new-form { display: flex; gap: 6px; padding: 8px 6px 4px; border-top: 1px solid var(--hairline); margin-top: 4px; }
      .board-new-form input { flex: 1; background: var(--surface-2); border: 1px solid var(--hairline); color: var(--ink); border-radius: var(--radius-sm); padding: 6px 8px; font-size: 12.5px; outline: none; }
      .board-new-form button { background: var(--live); color: #06181A; border: none; border-radius: var(--radius-sm); padding: 6px 10px; font-size: 12px; font-weight: 600; cursor: pointer; }
      .board-new-form button:disabled { opacity: .4; cursor: default; }
      .board-menu-new { width: 100%; text-align: left; background: none; border: none; color: var(--live); font-size: 12.5px; padding: 8px 10px; cursor: pointer; border-radius: var(--radius-sm); }
      .board-menu-new:hover { background: var(--surface-2); }

      /* ── Task priority · tags · subtask progress ── */
      .priority-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px; }
      .priority-dot.p-urgent { background: var(--risk); box-shadow: 0 0 6px var(--risk); }
      .priority-dot.p-high { background: #F5A623; }
      .priority-dot.p-low { background: var(--muted); opacity: .6; }
      .task-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 7px; }
      .tag-chip { font-size: 10px; padding: 1px 7px; border-radius: 999px; background: var(--surface-2); color: var(--muted); letter-spacing: .02em; }
      .subtask-chip { font-size: 10px; padding: 1px 7px; border-radius: 999px; background: var(--live-dim); color: var(--live); font-weight: 600; }
      .subtask-chip.all-done { background: rgba(52, 211, 153, .14); color: #34D399; }

      /* ── Modal subtask editor ── */
      .subtask-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
      .subtask-row { display: flex; align-items: center; gap: 8px; background: var(--surface-2); border-radius: var(--radius-sm); padding: 6px 8px; }
      .subtask-row input[type="checkbox"] { accent-color: var(--live); }
      .subtask-row span { flex: 1; font-size: 13px; }
      .subtask-row span.subtask-done { text-decoration: line-through; color: var(--muted); }
      .subtask-remove { background: none; border: none; color: var(--muted); cursor: pointer; display: flex; padding: 2px; }
      .subtask-remove:hover { color: var(--risk); }
      .subtask-add-row { display: flex; gap: 6px; }
      .subtask-add-row input { flex: 1; background: var(--surface-2); border: 1px solid var(--hairline); color: var(--ink); border-radius: var(--radius-sm); padding: 7px 9px; font-size: 12.5px; outline: none; }
      .subtask-add-row input:focus { border-color: var(--live); }
      .subtask-add-btn, .suggest-btn { background: var(--surface-2); border: 1px solid var(--hairline); color: var(--ink); border-radius: var(--radius-sm); padding: 7px 10px; font-size: 12px; cursor: pointer; white-space: nowrap; }
      .suggest-btn { border-color: rgba(65, 214, 224, .4); color: var(--live); }
      .suggest-btn:hover:not(:disabled) { background: var(--live-dim); }
      .subtask-add-btn:disabled, .suggest-btn:disabled { opacity: .4; cursor: default; }

      /* ── Report history ── */
      .history-wrap { position: relative; }
      .history-btn { display: flex; align-items: center; gap: 5px; background: rgba(65, 214, 224, .12); border: 1px solid rgba(65, 214, 224, .3); color: var(--live); padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; }
      .history-menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 40; background: var(--surface); border: 1px solid var(--hairline); border-radius: var(--radius-md); padding: 6px; width: 330px; max-height: 320px; overflow-y: auto; box-shadow: 0 12px 40px rgba(0,0,0,.5); }
      .history-item { width: 100%; text-align: left; background: none; border: none; color: var(--ink); padding: 8px 10px; border-radius: var(--radius-sm); cursor: pointer; font-size: 12px; display: flex; flex-direction: column; gap: 2px; }
      .history-item:hover { background: var(--surface-2); }
      .history-preview { color: var(--muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      @media (max-width: 880px) {
        .pulse-board { grid-template-columns: 1fr 1fr; }
        .update-grid { grid-template-columns: 1fr; }
      }
      @media (max-width: 560px) {
        .pulse-board { grid-template-columns: 1fr; padding: 0 16px 24px; }
        .pulse-header { padding: 16px; }
        .update-panel { margin: 0 16px 20px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .pulse-dot, .pulse-wave.active path, .spin { animation: none !important; }
      }
    `}</style>
  );
}

/* ---------------------------------------------------------
   Signature element — pulse waveform
--------------------------------------------------------- */
function PulseWave({ active = false, width = 56, height = 20 }) {
  return (
    <svg
      className={`pulse-wave${active ? ' active' : ''}`}
      width={width}
      height={height}
      viewBox="0 0 64 22"
      fill="none"
      aria-hidden="true"
    >
      <path pathLength="1" d="M0,11 L16,11 L20,3 L24,19 L28,5 L32,11 L48,11 L52,6 L56,16 L60,11 L64,11" />
    </svg>
  );
}

/* ---------------------------------------------------------
   Task card — @dnd-kit draggable
--------------------------------------------------------- */
function TaskCard({ task, onEdit, onMove, canMoveLeft, canMoveRight }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const overdue = isOverdue(task.dueDate, task.status);
  const classes = [
    'task-card',
    task.status === 'blocked' ? 'is-blocked' : '',
    overdue ? 'is-overdue' : '',
    isDragging ? 'dragging' : '',
  ].filter(Boolean).join(' ');

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  // Normalize defensively: a task object missing tags/subtasks must never
  // crash the render (white-screen) — degrade to empty collections.
  const tags = Array.isArray(task.tags) ? task.tags : [];
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const doneCount = subtasks.filter((s) => s.done).length;

  return (
    <div
      ref={setNodeRef}
      className={classes}
      style={style}
      {...listeners}
      {...attributes}
    >
      <div className="task-top">
        <div className="task-title">
          {task.priority && task.priority !== 'normal' && (
            <span className={`priority-dot p-${task.priority}`} title={`Priority: ${task.priority}`} />
          )}
          {task.title}
        </div>
        <button className="task-edit-btn" onClick={() => onEdit(task)} aria-label={`Edit ${task.title}`}>
          <Pencil size={13} />
        </button>
      </div>
      {(tags.length > 0 || subtasks.length > 0) && (
        <div className="task-chips">
          {tags.map((tag) => (
            <span className="tag-chip" key={tag}>#{tag}</span>
          ))}
          {subtasks.length > 0 && (
            <span
              className={`subtask-chip ${subtasks.every((s) => s.done) ? 'all-done' : ''}`}
              title="Subtask progress"
            >
              {doneCount}/{subtasks.length}
            </span>
          )}
        </div>
      )}
      <div className="task-meta">
        <span className="task-owner">{task.owner}</span>
        <span className="due mono">{formatDate(task.dueDate)}</span>
      </div>
      {task.status === 'blocked' && task.notes ? <div className="task-note">{task.notes}</div> : null}
      <div className="task-controls">
        <span className="drag-handle"><GripVertical size={13} /></span>
        <div className="move-btns">
          <button className="move-btn" onClick={() => onMove(task.id, -1)} disabled={!canMoveLeft} aria-label="Move to previous status">
            <ChevronLeft size={13} />
          </button>
          <button className="move-btn" onClick={() => onMove(task.id, 1)} disabled={!canMoveRight} aria-label="Move to next status">
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Column — @dnd-kit droppable
--------------------------------------------------------- */
function Column({ status, tasks, onEdit, onMove, onAdd, inProgressCount }) {
  const { setNodeRef, isOver } = useDroppable({
    id: status.key,
  });

  const idx = STATUS_INDEX[status.key];
  const wipFull = status.key === 'inprogress' && tasks.length >= WIP_LIMIT;
  const prevStatus = STATUSES[idx - 1]?.key;
  const nextStatus = STATUSES[idx + 1]?.key;
  const neighborIsFullWip = (s) => s === 'inprogress' && inProgressCount >= WIP_LIMIT;
  const colClasses = [
    'pulse-col',
    status.key === 'blocked' ? 'is-blocked' : '',
    isOver ? 'drag-over' : '',
  ].filter(Boolean).join(' ');

  return (
    <div ref={setNodeRef} className={colClasses}>
      <div className="col-head">
        <span className="col-label mono">{status.label}</span>
        <span className="col-count mono">{tasks.length}</span>
      </div>
      {tasks.map((t) => (
        <TaskCard
          key={t.id}
          task={t}
          onEdit={onEdit}
          onMove={onMove}
          canMoveLeft={idx > 0 && !neighborIsFullWip(prevStatus)}
          canMoveRight={idx < STATUSES.length - 1 && !neighborIsFullWip(nextStatus)}
        />
      ))}
      <button
        className="add-task-btn"
        onClick={() => onAdd(status.key)}
        disabled={wipFull}
        title={wipFull ? `WIP limit: max ${WIP_LIMIT} tasks in progress` : undefined}
      >
        <Plus size={13} /> {wipFull ? `WIP limit (${WIP_LIMIT})` : 'Add task'}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------
   Add / edit modal
--------------------------------------------------------- */
function TaskModal({ initial, defaultStatus, onSave, onDelete, onClose, inProgressFull }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [owner, setOwner] = useState(initial?.owner || '');
  const [status, setStatus] = useState(initial?.status || defaultStatus || 'todo');
  const [dueDate, setDueDate] = useState(initial?.dueDate || daysFromNow(7));
  const [notes, setNotes] = useState(initial?.notes || '');
  const [priority, setPriority] = useState(initial?.priority || 'normal');
  const [tagsInput, setTagsInput] = useState(
    Array.isArray(initial?.tags) ? initial.tags.join(', ') : '',
  );
  const [subtasks, setSubtasks] = useState(
    Array.isArray(initial?.subtasks)
      ? initial.subtasks.map((s) => ({ id: s.id || uid(), title: s.title || '', done: Boolean(s.done) }))
      : [],
  );
  const [newSubtask, setNewSubtask] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const parseTags = () =>
    tagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, 8);

  const addSubtask = () => {
    const clean = newSubtask.trim();
    if (!clean) return;
    setSubtasks((prev) => [...prev, { id: uid(), title: clean, done: false }]);
    setNewSubtask('');
  };

  const toggleSubtask = (id) => {
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));
  };

  const removeSubtask = (id) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  /** ✨ AI breakdown: asks the Pulse backend for 3-5 concrete subtasks. */
  const suggestSubtasks = async () => {
    if (suggesting) return;
    setSuggesting(true);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/suggest-subtasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ title: title.trim(), notes: notes.trim(), priority }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Server error ${response.status}`);
      const ideas = (Array.isArray(data.subtasks) ? data.subtasks : [])
        .map((s) => String(s).trim())
        .filter(Boolean)
        .map((s) => ({ id: uid(), title: s, done: false }));
      if (ideas.length > 0) setSubtasks((prev) => [...prev, ...ideas]);
    } catch (e) {
      console.error('Suggest subtasks failed:', e);
    } finally {
      setSuggesting(false);
    }
  };

  const handleSave = () => {
    if (!title.trim()) { titleRef.current?.focus(); return; }
    onSave({
      id: initial?.id || uid(),
      title: title.trim(),
      owner: owner.trim() || 'Unassigned',
      status,
      dueDate,
      notes: notes.trim(),
      priority,
      tags: parseTags(),
      subtasks,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title display">{initial ? 'Edit task' : 'New task'}</span>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="field">
          <label htmlFor="pulse-title">Title</label>
          <input id="pulse-title" ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to get done" />
        </div>
        <div className="modal-row">
          <div className="field">
            <label htmlFor="pulse-owner">Owner</label>
            <input id="pulse-owner" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Name" />
          </div>
          <div className="field">
            <label htmlFor="pulse-due">Due date</label>
            <input id="pulse-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="pulse-status">Status</label>
          <select id="pulse-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option
                key={s.key}
                value={s.key}
                disabled={s.key === 'inprogress' && inProgressFull && status !== 'inprogress'}
              >
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="modal-row">
          <div className="field">
            <label htmlFor="pulse-priority">Priority</label>
            <select id="pulse-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="pulse-tags">Tags</label>
            <input
              id="pulse-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="infra, q4-launch"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="pulse-notes">Context {status === 'blocked' ? "(what's blocking it)" : '(optional)'}</label>
          <textarea id="pulse-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything Pulse should weigh when judging risk" />
        </div>
        <div className="field">
          <label>Subtasks</label>
          {subtasks.length > 0 && (
            <div className="subtask-list">
              {subtasks.map((s) => (
                <div className="subtask-row" key={s.id}>
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={() => toggleSubtask(s.id)}
                    aria-label={`Toggle ${s.title}`}
                  />
                  <span className={s.done ? 'subtask-done' : ''}>{s.title}</span>
                  <button
                    type="button"
                    className="subtask-remove"
                    onClick={() => removeSubtask(s.id)}
                    aria-label={`Remove ${s.title}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="subtask-add-row">
            <input
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
              placeholder="Add a subtask…"
            />
            <button type="button" className="subtask-add-btn" onClick={addSubtask} disabled={!newSubtask.trim()}>
              Add
            </button>
            <button
              type="button"
              className="suggest-btn"
              onClick={() => void suggestSubtasks()}
              disabled={suggesting || !title.trim()}
              title="AI: break this task into subtasks"
            >
              {suggesting ? 'Thinking…' : '✨ Suggest'}
            </button>
          </div>
        </div>
        <div className="modal-actions">
          {initial ? (
            <button className="btn-delete" onClick={() => onDelete(initial.id)}><Trash2 size={13} /> Delete</button>
          ) : <span />}
          <div>
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
            <button className="btn-save" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   AI status update panel
--------------------------------------------------------- */
function UpdatePanel({ data, loading, error, open, onToggle, generatedAt, history = [], onLoadHistory }) {
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (historyRef.current && !historyRef.current.contains(e.target)) setHistoryOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const handleCopyUpdate = () => {
    if (!data) return;
    const text = `Pulse Status Update (${generatedAt ? new Date(generatedAt).toLocaleDateString() : 'Today'})
Summary: ${data.summary || ''}

Shipped:
${(data.shipped || []).map(s => `- ${s}`).join('\n')}

In Progress:
${(data.inProgress || []).map(s => `- ${s}`).join('\n')}

At Risk:
${(data.atRisk || []).map(r => `- ${r.title}: ${r.reasoning}`).join('\n')}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="update-panel">
      <div
        className="update-header"
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        aria-expanded={open}
      >
        <span className="update-title"><Activity size={14} /> Status update</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {history.length > 0 && (
            <div className="history-wrap" ref={historyRef}>
              <button
                className="history-btn"
                onClick={(e) => { e.stopPropagation(); setHistoryOpen((o) => !o); }}
                title="Past reports"
              >
                <History size={12} /> History
              </button>
              {historyOpen && (
                <div className="history-menu">
                  {history.map((h) => (
                    <button
                      key={h.id}
                      className="history-item"
                      onClick={(e) => {
                        // stopPropagation: the history menu lives inside the
                        // header button, so a bubbling click would hit the
                        // header's onToggle and instantly re-collapse the panel.
                        e.stopPropagation();
                        onLoadHistory(h.payload, h.created_at);
                        setHistoryOpen(false);
                      }}
                    >
                      {new Date(h.created_at).toLocaleString([], {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                      <span className="history-preview">{(h.payload?.summary || '').slice(0, 46)}…</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {data ? (
            <button
              onClick={(e) => { e.stopPropagation(); handleCopyUpdate(); }}
              style={{
                background: 'rgba(65, 214, 224, 0.12)',
                color: 'var(--live)',
                border: '1px solid rgba(65, 214, 224, 0.3)',
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {copied ? '✓ Copied' : 'Copy report'}
            </button>
          ) : null}
          {generatedAt ? <span className="update-meta mono">Updated {relativeTime(generatedAt)}</span> : null}
        </div>
      </div>
      {open ? (
        <div className="update-body">
          {loading ? (
            <div className="update-loading">
              <PulseWave active width={52} height={18} />
              Reading the board…
            </div>
          ) : error ? (
            <div className="update-error">{error}</div>
          ) : data ? (
            <>
              <p className="update-summary">{data.summary || 'Pulse read the board but had nothing to summarize.'}</p>
              <div className="update-grid">
                <div className="update-col shipped">
                  <div className="update-col-head"><CheckCircle2 size={13} /> Shipped</div>
                  {data.shipped?.length ? data.shipped.map((s, i) => <div className="update-item" key={i}>{s}</div>) : <div className="update-empty">Nothing shipped yet</div>}
                </div>
                <div className="update-col inprog">
                  <div className="update-col-head"><Clock size={13} /> In progress</div>
                  {data.inProgress?.length ? data.inProgress.map((s, i) => <div className="update-item" key={i}>{s}</div>) : <div className="update-empty">Nothing in flight</div>}
                </div>
                <div className="update-col risk">
                  <div className="update-col-head"><AlertTriangle size={13} /> At risk</div>
                  {data.atRisk?.length ? data.atRisk.map((s, i) => (
                    <div className="update-item" key={i}>{s.title}<span className="reason">{s.reasoning}</span></div>
                  )) : <div className="update-empty">Nothing flagged</div>}
                </div>
              </div>
            </>
          ) : (
            <div className="update-empty">Click "Generate update" to have Pulse read the board.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------
   Main app
--------------------------------------------------------- */
export default function PulseApp({ userId, userEmail }) {
  const [tasks, setTasks] = useState([]);
  const [ready, setReady] = useState(false);
  const [boards, setBoards] = useState([]);
  const [boardId, setBoardId] = useState(() => localStorage.getItem('pulse:board') || null);
  const [modal, setModal] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [updateData, setUpdateData] = useState(null);
  const [updateError, setUpdateError] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [activeDragTask, setActiveDragTask] = useState(null);
  const [reportHistory, setReportHistory] = useState([]);

  /* ---- Pointer sensor config (touch-friendly) ---- */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  /* ---- Pointer-first collision detection: a drop lands in the column the
     pointer is actually over. closestCorners only fills in when the pointer
     is outside every column — plain corner-distance math lets a short
     neighboring column "steal" drops near a tall column's edges. ---- */
  const collisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length > 0 ? pointerCollisions : closestCorners(args);
  }, []);

  /* ---- Board bootstrap: guarantee at least one board; claim legacy tasks ---- */
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const boards = await ensureUserBoard(userId);
        if (cancelled) return;
        setBoards(boards);
        const stored = localStorage.getItem('pulse:board');
        setBoardId(boards.some((b) => b.id === stored) ? stored : boards[0].id);
      } catch (err) {
        console.error('Pulse board bootstrap failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  /* ---- Live sync: subscribe to the active board's tasks (onSnapshot).
     Every write anywhere (this tab, another tab, another device) lands
     here within milliseconds — no manual refresh. ---- */
  useEffect(() => {
    if (!userId || !boardId) return;
    const q = query(
      collection(db, 'tasks'),
      where('user_id', '==', userId),
      where('board_id', '==', boardId)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const mapped = snap.docs
          .map((d) => mapTask(d.id, d.data()))
          .sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0));
        setTasks(mapped);
        setReady(true);
      },
      (err) => {
        console.error('Pulse live sync error:', err);
        setReady(true);
      }
    );
    return () => unsub();
  }, [userId, boardId]);

  /* ---- Report history for the active board ---- */
  useEffect(() => {
    if (!userId || !boardId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'reports'), where('user_id', '==', userId))
        );
        if (cancelled) return;
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data()) }))
          .filter((r) => r.board_id === boardId)
          .sort((a, b) => b.created_at - a.created_at)
          .slice(0, 8);
        setReportHistory(list);
      } catch {
        // History is a convenience — never block the board on it.
      }
    })();
    return () => { cancelled = true; };
  }, [userId, boardId, generatedAt]);

  /* ---- Board management ---- */
  const handleCreateBoard = useCallback(async (name) => {
    try {
      const board = await createBoard(userId, name);
      setBoards((prev) => [...prev, board]);
      setBoardId(board.id);
      localStorage.setItem('pulse:board', board.id);
    } catch (err) {
      console.error('Pulse board create failed:', err);
    }
  }, [userId]);

  const handleSelectBoard = useCallback((id) => {
    setBoardId(id);
    localStorage.setItem('pulse:board', id);
  }, []);

  const handleDeleteBoard = useCallback(async (id) => {
    if (boards.length <= 1) return;
    try {
      // Remove the board's tasks first, then the board itself.
      const boardTasks = await getDocs(
        query(collection(db, 'tasks'), where('board_id', '==', id))
      );
      for (const d of boardTasks.docs) await deleteDoc(d.ref);
      await deleteBoardDoc(id);
      const next = boards.filter((b) => b.id !== id);
      setBoards(next);
      if (id === boardId) {
        setBoardId(next[0].id);
        localStorage.setItem('pulse:board', next[0].id);
        setTasks([]);
        setReady(false);
      }
    } catch (err) {
      console.error('Pulse board delete failed:', err);
      setSaveError(
        err?.code === 'permission-denied'
          ? 'Firestore rules blocked board deletion — publish the latest firestore.rules in the Firebase console and retry.'
          : err?.message || 'Failed to delete the board. Please try again.'
      );
      setTimeout(() => setSaveError(null), 6000);
    }
  }, [boards, boardId]);

  /* ---- Restore the cached AI update (instant panel on return visits).
     The cache key is per-user: a shared key would leak one account's
     report into the next account logged in on the same browser. ---- */
  useEffect(() => {
    try {
      const upd = localStorage.getItem(`pulse:update:${userId}`);
      if (upd) {
        const parsed = JSON.parse(upd);
        // This restores persisted UI state once after the component mounts.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUpdateData(parsed.data);
        setGeneratedAt(parsed.generatedAt);
        setPanelOpen(true);
      }
      // Migration: drop the pre-per-user cache, which could belong to a
      // different account than the one now signed in.
      localStorage.removeItem('pulse:update');
    } catch {
      // Ignore a malformed cache.
    }
  }, [userId]);

  /* ---- Save / Upsert a task (CREATE + UPDATE) ---- */
  const saveTask = useCallback(async (taskData) => {
    // WIP limit guard — a save may never push In Progress past the cap.
    const otherInProgress = tasks.filter(
      (t) => t.status === 'inprogress' && t.id !== taskData.id
    ).length;
    if (taskData.status === 'inprogress' && otherInProgress >= WIP_LIMIT) {
      setModal(null);
      setSaveError(`WIP limit: no more than ${WIP_LIMIT} tasks can be in progress at once.`);
      setTimeout(() => setSaveError(null), 4000);
      return;
    }

    setSaveError(null);
    setModal(null);

    try {
      // The id generated by the modal (or the existing task id) doubles as the
      // Firestore document id, so create and update are the same setDoc call.
      const payload = {
        user_id: userId,
        board_id: boardId,
        title: taskData.title,
        owner: taskData.owner,
        status: taskData.status,
        due_date: taskData.dueDate,
        notes: taskData.notes,
        priority: taskData.priority || 'normal',
        tags: Array.isArray(taskData.tags) ? taskData.tags : [],
        subtasks: Array.isArray(taskData.subtasks)
          ? taskData.subtasks.map((s) => ({ id: s.id, title: s.title, done: Boolean(s.done) }))
          : [],
      };

      const isNew = !tasks.some((t) => t.id === taskData.id);
      if (isNew) {
        payload.created_at = Date.now();
      }

      // Database-first: wait for the write to be acknowledged before updating
      // React state. merge:true preserves created_at on updates.
      await setDoc(doc(db, 'tasks', taskData.id), payload, { merge: true });

      // Map the stored row back to the full camelCase shape the UI expects
      // (same defaults as mapTask — a partial object here crashes TaskCard).
      const savedTask = {
        id: taskData.id,
        title: taskData.title,
        owner: taskData.owner,
        status: taskData.status,
        dueDate: taskData.dueDate,
        notes: taskData.notes || '',
        priority: taskData.priority || 'normal',
        tags: Array.isArray(taskData.tags) ? taskData.tags : [],
        subtasks: Array.isArray(taskData.subtasks)
          ? taskData.subtasks.map((s) => ({ id: s.id, title: s.title, done: Boolean(s.done) }))
          : [],
        created_at: payload.created_at ?? null,
      };

      // Update state with the server-confirmed row
      setTasks((prev) => {
        const exists = prev.some((t) => t.id === savedTask.id);
        return exists
          ? prev.map((t) => (t.id === savedTask.id ? savedTask : t))
          : [...prev, savedTask];
      });
    } catch (err) {
      console.error('Pulse save error:', err.message);
      setSaveError(err.message || 'Failed to save task. Please try again.');

      // Auto-clear the error after 4 seconds
      setTimeout(() => setSaveError(null), 4000);
    }
  }, [userId, boardId, tasks]);

  /* ---- Delete a task ---- */
  const deleteTask = useCallback(async (id) => {
    const prevTasks = tasks;

    // Optimistic UI removal
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setModal(null);

    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (err) {
      console.error('Pulse delete error:', err);
      // Revert on failure
      setTasks(prevTasks);
    }
  }, [tasks]);

  /* ---- Move task via chevron buttons ---- */
  const moveTask = useCallback(async (id, dir) => {
    let newStatus = null;
    let wipViolation = false;

    setTasks((prev) => {
      const task = prev.find((t) => t.id === id);
      if (!task) return prev;
      const idx = STATUS_INDEX[task.status];
      const next = Math.min(STATUSES.length - 1, Math.max(0, idx + dir));
      newStatus = STATUSES[next].key;

      // WIP limit guard — a move may never push In Progress past the cap.
      const inProgressCount = prev.filter((t) => t.status === 'inprogress').length;
      if (
        newStatus === 'inprogress' &&
        task.status !== 'inprogress' &&
        inProgressCount >= WIP_LIMIT
      ) {
        wipViolation = true;
        return prev;
      }

      return prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t));
    });

    if (wipViolation) {
      setSaveError(`WIP limit: no more than ${WIP_LIMIT} tasks can be in progress at once.`);
      setTimeout(() => setSaveError(null), 4000);
      return;
    }

    if (newStatus) {
      try {
        await updateDoc(doc(db, 'tasks', id), { status: newStatus });
      } catch (err) {
        console.error('Pulse move error:', err);
        // Revert by re-fetching
        const snap = await getDocs(
          query(collection(db, 'tasks'), where('user_id', '==', userId))
        );
        setTasks(
          snap.docs
            .map((d) => mapTask(d.id, d.data()))
            .sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0))
        );
      }
    }
  }, [userId]);

  /* ---- @dnd-kit drag start ---- */
  const handleDragStart = useCallback((event) => {
    const { active } = event;
    const draggedTask = tasks.find((t) => t.id === active.id);
    if (draggedTask) {
      setActiveDragTask(draggedTask);
    }
  }, [tasks]);

  /* ---- @dnd-kit drag end (optimistic update + DB sync) ---- */
  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    setActiveDragTask(null);

    if (!over || active.id === over.id) return;

    // WIP limit guard — reject drops that would overfill In Progress.
    const dragged = tasks.find((t) => t.id === active.id);
    const inProgressCount = tasks.filter((t) => t.status === 'inprogress').length;
    if (
      over.id === 'inprogress' &&
      dragged &&
      dragged.status !== 'inprogress' &&
      inProgressCount >= WIP_LIMIT
    ) {
      setSaveError(`WIP limit: no more than ${WIP_LIMIT} tasks can be in progress at once.`);
      setTimeout(() => setSaveError(null), 4000);
      return;
    }

    // Snapshot for reverting on failure
    const prevTasks = [...tasks];

    // Optimistic update: change the dragged task's status to the column it was dropped on
    setTasks((prev) =>
      prev.map((t) =>
        t.id === active.id ? { ...t, status: over.id } : t
      )
    );

    try {
      await updateDoc(doc(db, 'tasks', active.id), { status: over.id });
    } catch (err) {
      console.error('DnD DB update error:', err);
      // Revert optimistic update
      setTasks(prevTasks);
      alert('Failed to update task status. Please try again.');
    }
  }, [tasks]);

  /* ---- @dnd-kit drag cancel ---- */
  const handleDragCancel = useCallback(() => {
    setActiveDragTask(null);
  }, []);

  const generateUpdate = async () => {
    if (tasks.length === 0) {
      setUpdateError('Add a few tasks first — Pulse needs a board to read.');
      setPanelOpen(true);
      return;
    }
    setGenerating(true);
    setUpdateError(null);
    setPanelOpen(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const boardText = tasks.map((t) => {
        const label = STATUSES.find((s) => s.key === t.status)?.label;
        const overdueFlag = isOverdue(t.dueDate, t.status) ? ' [PAST DUE]' : '';
        const priorityFlag = t.priority && t.priority !== 'normal' ? ` (priority: ${t.priority})` : '';
        const tags = Array.isArray(t.tags) ? t.tags : [];
        const subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
        const tagFlag = tags.length ? ` #${tags.join(' #')}` : '';
        const subtaskFlag = subtasks.length
          ? `, subtasks ${subtasks.filter((s) => s.done).length}/${subtasks.length} complete`
          : '';
        return `- [${label}] "${t.title}"${priorityFlag}${tagFlag} — Owner: ${t.owner}, Due: ${t.dueDate}${overdueFlag}${subtaskFlag}${t.notes ? `, Note: ${t.notes}` : ''}`;
      }).join('\n');

      // Get the current Firebase ID token for backend authentication
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/generate-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ boardText, today }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${response.status}`);
      }

      const parsed = await response.json();

      setUpdateData(parsed);
      const ts = Date.now();
      setGeneratedAt(ts);
      try {
        localStorage.setItem(`pulse:update:${userId}`, JSON.stringify({ data: parsed, generatedAt: ts }));
      } catch {
        // Caching is optional; the generated update remains visible.
      }

      // Archive the report so the History dropdown can recall it later.
      try {
        await addDoc(collection(db, 'reports'), {
          user_id: userId,
          board_id: boardId,
          created_at: ts,
          payload: parsed,
        });
      } catch (err) {
        console.warn('Pulse report archive skipped:', err?.message);
      }
    } catch (e) {
      console.error("Pulse API Failure:", e);

      // Differentiate between a network error and a structured API rejection
      if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
        setUpdateError("Network error — can't reach the server. Is the backend running on port 3001?");
      } else if (e.responseStatus) {
        setUpdateError(`Server error (${e.responseStatus}): ${e.message}`);
      } else {
        setUpdateError(e.message || "Couldn't generate an update. Try again in a moment.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const exportBoardToJSON = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      taskCount: tasks.length,
      tasks: tasks,
    };
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulse-board-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!ready) {
    return (
      <div className="pulse-root">
        <GlobalStyles />
        <div className="loading-screen">
          <PulseWave active width={72} height={24} />
          Loading board…
        </div>
      </div>
    );
  }

  return (
    <div className="pulse-root">
      <GlobalStyles />
      <div className="pulse-header">
        <div className="pulse-brand">
          <span className="pulse-wordmark display">Pulse</span>
          <PulseWave width={48} height={18} />
          {boards.length > 0 && (
            <BoardSwitcher
              boards={boards}
              currentId={boardId}
              onSelect={handleSelectBoard}
              onCreate={handleCreateBoard}
              onDelete={handleDeleteBoard}
              canDelete={() => boards.length > 1}
            />
          )}
        </div>
        <div className="pulse-actions">
          {userEmail ? (
            <span className="pulse-status-chip mono" style={{ opacity: 0.8, color: 'var(--muted)' }}>
              {userEmail}
            </span>
          ) : null}
          <span className="pulse-status-chip mono"><span className="pulse-dot" />{tasks.length} tasks</span>
          <button className="btn-generate" onClick={generateUpdate} disabled={generating}>
            {generating ? <Loader2 size={14} className="spin" /> : <Activity size={14} />}
            {generating ? 'Reading board…' : 'Generate update'}
          </button>
          <button className="btn-export" onClick={exportBoardToJSON} title="Export Board to JSON">
            <Download size={14} /> Export JSON
          </button>
          <button className="btn-logout" onClick={() => signOut(auth)}>
            Log out
          </button>
        </div>
      </div>

      {saveError ? (
        <div style={{
          margin: '0 28px 16px',
          padding: '10px 16px',
          background: 'var(--risk-dim)',
          border: '1px solid rgba(239, 74, 82, 0.2)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--risk)',
          fontSize: '13px',
          lineHeight: 1.5,
        }}>
          {saveError}
        </div>
      ) : null}

      <UpdatePanel
        data={updateData}
        loading={generating}
        error={updateError}
        open={panelOpen}
        onToggle={() => setPanelOpen((o) => !o)}
        generatedAt={generatedAt}
        history={reportHistory}
        onLoadHistory={(payload, createdAt) => {
          setUpdateData(payload);
          setGeneratedAt(createdAt);
          setPanelOpen(true);
        }}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="pulse-board">
          {STATUSES.map((s) => (
            <Column
              key={s.key}
              status={s}
              tasks={tasks.filter((t) => t.status === s.key)}
              inProgressCount={tasks.filter((t) => t.status === 'inprogress').length}
              onEdit={(t) => setModal({ task: t })}
              onMove={moveTask}
              onAdd={(statusKey) => setModal({ defaultStatus: statusKey })}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDragTask ? (
            <div className="task-card drag-overlay-wrapper" style={{ opacity: 0.85, transform: 'rotate(3deg)' }}>
              <div className="task-top">
                <div className="task-title">{activeDragTask.title}</div>
              </div>
              <div className="task-meta">
                <span className="task-owner">{activeDragTask.owner}</span>
                <span className="due mono">{formatDate(activeDragTask.dueDate)}</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {modal ? (
        <TaskModal
          initial={modal.task}
          defaultStatus={modal.defaultStatus}
          inProgressFull={tasks.filter((t) => t.status === 'inprogress').length >= WIP_LIMIT}
          onSave={saveTask}
          onDelete={deleteTask}
          onClose={() => setModal(null)}
        />
      ) : null}

      {/* Footer (Main App Only) */}
      <div className="pulse-footer">
        Copyright @harsh khurdi | Made with <span className="heart">❤️</span> by harsh khurdi
      </div>
    </div>
  );
}
