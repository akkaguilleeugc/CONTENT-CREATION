/* KROOPY AI — talk to your creative partner. Streaming answers, history, and one-tap actions
   (save as idea, create task). Kroo shows what's happening: listening, thinking, writing. */
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from 'ai';
import { ArrowUp, Brain, Check, Copy, Download, History, Lightbulb, ListChecks, MessageSquarePlus, RefreshCw, Square, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Markdown } from '@/components/Markdown';
import { Mascot, type MascotState } from '@/components/Mascot';
import { Modal } from '@/components/overlay';
import { Button, Switch } from '@/components/ui';
import { ActionCard, isAction, ToolChip, toolName, type ToolPart } from '@/features/aiActions';
import { aiErrorText, aiStatus, aiToken, deleteConversation, forgetAllMemories, forgetMemory, listConversations, loadConversation, loadMemories, type AiActivity, type AiMemory, type AiStatus, type ConvMeta } from '@/lib/ai';
import { newIdea, newTask } from '@/lib/factories';
import { $t, LANG } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useSync } from '@/lib/sync';
import { confirmDialog, toast } from '@/lib/ui';
import { cn, downloadBlob } from '@/lib/utils';

const SUGGESTIONS = [
  $t('Analyse my performance this week'),
  $t('Give me 10 ideas for new videos'),
  $t('Improve this idea: '),
  $t('Organise my next week'),
  $t('Write a TikTok script about '),
  $t('What content should I post more of?'),
];

const newId = () => crypto.randomUUID();
const textOf = (m: UIMessage) => m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('').trim();
const firstLine = (s: string) => s.replace(/[#*_`>]/g, '').split('\n').map((l) => l.trim()).find(Boolean)?.slice(0, 90) ?? $t('Idea from KROOPY AI');

/* ── one conversation ── */
function Chat({ id, initial, deep, onSaved }: { id: string; initial: UIMessage[]; deep: boolean; onSaved: () => void }) {
  const deepRef = useRef(deep);
  deepRef.current = deep;
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai/chat',
        headers: () => ({ authorization: `Bearer ${aiToken() ?? ''}` }),
        body: () => ({ deep: deepRef.current, lang: LANG }),
      }),
    [],
  );
  const { messages, sendMessage, status, stop, regenerate, error, clearError, addToolOutput } = useChat({
    id,
    messages: initial,
    transport,
    onFinish: () => onSaved(),
    // after the person answers a confirmation card, the assistant continues on its own
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [cheer, setCheer] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = status === 'submitted' || status === 'streaming';
  const toolParts = (m: UIMessage) => m.parts.filter((p) => p.type.startsWith('tool-')) as unknown as ToolPart[];
  const lastMsg = messages[messages.length - 1];
  const awaiting = !busy && !!lastMsg && lastMsg.role === 'assistant' && toolParts(lastMsg).some((p) => isAction(toolName(p)) && p.state === 'input-available');
  const looking = busy && !!lastMsg && lastMsg.role === 'assistant' && toolParts(lastMsg).some((p) => !isAction(toolName(p)) && (p.state === 'input-available' || p.state === 'input-streaming'));

  // Kroo's mood follows the conversation.
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === 'streaming' && status === 'ready') {
      setCheer(true);
      const t = setTimeout(() => setCheer(false), 2600);
      prevStatus.current = status;
      return () => clearTimeout(t);
    }
    prevStatus.current = status;
  }, [status]);
  const mood: MascotState = awaiting ? 'waiting' : looking ? 'searching' : status === 'submitted' ? 'thinking' : status === 'streaming' ? 'writing' : status === 'error' ? 'confused' : cheer ? 'happy' : typing ? 'listening' : 'idle';

  // Keep the newest text in view while it streams (unless the person scrolled up to read).
  const stick = useRef(true);
  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current && messages.length) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy || awaiting) return;
    clearError();
    stick.current = true;
    void sendMessage({ text: t });
    setInput('');
    setTyping(false);
  };

  const saveIdea = (m: UIMessage) => {
    const text = textOf(m);
    useStore.getState().insert('ideas', newIdea({ title: firstLine(text), description: text.slice(0, 4000) }));
    toast($t('Saved to My Ideas'), { tone: 'success' });
  };
  const makeTask = (m: UIMessage) => {
    const text = textOf(m);
    useStore.getState().insert('tasks', newTask({ title: firstLine(text), description: text.slice(0, 4000) }));
    toast($t('Task created'), { tone: 'success' });
  };

  const empty = messages.length === 0;
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  return (
    <div className="ai-chat">
      <div
        className="ai-chat__list"
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {empty ? (
          <div className="ai-hello">
            <Mascot size={132} state={mood === 'idle' ? 'curious' : mood} followPointer />
            <h2 className="display">{$t('What are we creating today?')}</h2>
            <p className="subtle">{$t('Tell me an idea, a doubt or a goal — as you would to a friend. I know your ideas, calendar, tasks and goals in KROOPY.')}</p>
            <div className="ai-suggest">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="ai-suggest__chip"
                  onClick={() => {
                    if (s.endsWith(' ')) {
                      setInput(s);
                      inputRef.current?.focus();
                    } else send(s);
                  }}
                >
                  {s.trim()}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn('ai-msg', `ai-msg--${m.role}`)}>
              {m.role === 'assistant' && (
                <div className="ai-msg__who" aria-hidden>
                  <span className="ai-msg__dot" />
                  KROOPY AI
                </div>
              )}
              <div className="ai-msg__body">
                {m.role === 'assistant' ? (
                  m.parts.map((p, i) => {
                    if (p.type === 'text') return p.text ? <Markdown key={i} text={p.text} /> : null;
                    if (!p.type.startsWith('tool-')) return null;
                    const tp = p as unknown as ToolPart;
                    return isAction(toolName(tp)) ? (
                      <ActionCard key={tp.toolCallId} part={tp} onAnswer={(output) => void addToolOutput({ tool: toolName(tp) as never, toolCallId: tp.toolCallId, output: output as never })} />
                    ) : (
                      <ToolChip key={tp.toolCallId} part={tp} />
                    );
                  })
                ) : (
                  <p>{textOf(m)}</p>
                )}
              </div>
              {m.role === 'assistant' && !(busy && m.id === lastAssistant) && textOf(m) && (
                <div className="ai-msg__actions">
                  <CopyButton text={textOf(m)} />
                  {m.id === lastAssistant && (
                    <button type="button" className="ai-act" onClick={() => void regenerate()} title={$t('Regenerate')}>
                      <RefreshCw /> <span>{$t('Regenerate')}</span>
                    </button>
                  )}
                  <button type="button" className="ai-act" onClick={() => saveIdea(m)}>
                    <Lightbulb /> <span>{$t('Save as idea')}</span>
                  </button>
                  <button type="button" className="ai-act" onClick={() => makeTask(m)}>
                    <ListChecks /> <span>{$t('Create task')}</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
        {status === 'submitted' && (
          <div className="ai-msg ai-msg--assistant ai-msg--pending" aria-live="polite">
            <div className="ai-msg__who"><span className="ai-msg__dot" />KROOPY AI</div>
            <div className="ai-typing" aria-label={$t('Thinking…')}><i /><i /><i /></div>
          </div>
        )}
        {error && (
          <div className="ai-error" role="alert">
            <p>{aiErrorText(error)}</p>
            <Button size="sm" onClick={() => { clearError(); void regenerate(); }}>{$t('Try again')}</Button>
          </div>
        )}
      </div>

      <form
        className="ai-compose"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        {!empty && <Mascot className="ai-compose__kroo" size={46} state={mood} settleAfterMs={busy ? 0 : 5000} />}
        <textarea
          ref={inputRef}
          className="ai-compose__input"
          rows={1}
          value={input}
          placeholder={awaiting ? $t('Confirm or cancel the card above first') : $t('Message KROOPY AI…')}
          disabled={awaiting}
          aria-label={$t('Message KROOPY AI…')}
          onChange={(e) => {
            setInput(e.target.value);
            setTyping(!!e.target.value);
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
          onBlur={() => setTyping(false)}
        />
        {busy ? (
          <button type="button" className="ai-compose__btn ai-compose__btn--stop" onClick={() => void stop()} aria-label={$t('Stop')}>
            <Square />
          </button>
        ) : (
          <button type="submit" className="ai-compose__btn" disabled={!input.trim() || awaiting} aria-label={$t('Send')}>
            <ArrowUp />
          </button>
        )}
      </form>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="ai-act"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          toast($t('Could not copy'), { tone: 'error' });
        }
      }}
    >
      {done ? <Check /> : <Copy />} <span>{done ? $t('Copied') : $t('Copy')}</span>
    </button>
  );
}

/* ── conversation list ── */
function History_({ list, current, onOpen, onNew, onDelete }: { list: ConvMeta[]; current: string; onOpen: (id: string) => void; onNew: () => void; onDelete: (id: string) => void }) {
  return (
    <div className="ai-history">
      <Button variant="lime" icon={<MessageSquarePlus />} onClick={onNew} block>{$t('New conversation')}</Button>
      <div className="ai-history__label">{$t('Conversations')}</div>
      {list.length === 0 ? (
        <p className="subtle ai-history__empty">{$t('Your conversations appear here.')}</p>
      ) : (
        <ul>
          {list.map((c) => (
            <li key={c.id} className={cn(c.id === current && 'is-on')}>
              <button type="button" className="ai-history__item" onClick={() => onOpen(c.id)} title={c.title}>{c.title}</button>
              <button type="button" className="ai-history__del" aria-label={$t('Delete conversation')} onClick={() => onDelete(c.id)}><Trash2 /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── what KROOPY AI remembers, and what it did ── */
function MemoryPanel() {
  const [data, setData] = useState<{ memories: AiMemory[]; activity: AiActivity[] } | null>(null);
  const load = useCallback(() => void loadMemories().then(setData).catch(() => setData({ memories: [], activity: [] })), []);
  useEffect(load, [load]);
  if (!data) return <p className="subtle">{$t('Loading…')}</p>;
  const KIND: Record<AiMemory['kind'], string> = { preference: $t('Preference'), decision: $t('Decision'), fact: $t('Fact'), goal: $t('Goal') };
  const STATUS: Record<AiActivity['status'], string> = { done: $t('Done'), cancelled: $t('Cancelled'), proposed: $t('Proposed'), error: $t('Error') };
  const TOOL: Record<string, string> = { save_ideas: $t('Ideas'), create_tasks: $t('Tasks'), add_events: $t('Calendar'), create_video: $t('Video'), remember: $t('Memory'), search_kroopy: $t('Search'), get_schedule: $t('Calendar'), get_stats: $t('Statistics'), get_details: $t('Details') };
  return (
    <div className="ai-memory">
      <p className="subtle">{$t('What you asked KROOPY AI to keep in mind. It uses it in every conversation; delete anything at any time.')}</p>
      {data.memories.length === 0 ? (
        <p className="ai-memory__empty">{$t('Nothing yet. Say “remember that…” in a conversation.')}</p>
      ) : (
        <ul className="ai-memory__list">
          {data.memories.map((m) => (
            <li key={m.id}>
              <span className="badge">{KIND[m.kind]}</span>
              <span className="grow">{m.text}</span>
              <button type="button" className="ai-history__del" aria-label={$t('Forget')} onClick={() => void forgetMemory(m.id).then(load)}><Trash2 /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="row gap-8 wrap">
        <Button size="sm" icon={<Download />} onClick={() => downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'kroopy-ai-memory.json')}>{$t('Export')}</Button>
        {data.memories.length > 0 && (
          <Button
            size="sm"
            variant="danger"
            icon={<Trash2 />}
            onClick={async () => {
              if (await confirmDialog({ title: $t('Forget everything?'), description: $t('KROOPY AI will no longer remember any of this.'), confirmLabel: $t('Forget everything') })) await forgetAllMemories().then(load);
            }}
          >
            {$t('Forget everything')}
          </Button>
        )}
      </div>
      <h3 className="ai-memory__h">{$t('Activity')}</h3>
      {data.activity.length === 0 ? (
        <p className="ai-memory__empty">{$t('Searches, memories and actions appear here.')}</p>
      ) : (
        <ul className="ai-activity">
          {data.activity.slice(0, 60).map((a, i) => (
            <li key={i}>
              <span className="subtle">{new Date(a.at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
              <span className="grow"><b>{TOOL[a.tool] ?? a.tool}</b>{a.summary ? ` · ${a.summary}` : ''}</span>
              <span className={cn('badge', a.status === 'done' && 'badge--positive')}>{STATUS[a.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── page ── */
export default function AiPage() {
  const { user, status: syncStatus } = useSync();
  const [st, setSt] = useState<AiStatus | null>(null);
  const [stErr, setStErr] = useState('');
  const [list, setList] = useState<ConvMeta[]>([]);
  const [conv, setConv] = useState<{ id: string; messages: UIMessage[] }>(() => ({ id: newId(), messages: [] }));
  const [deep, setDeep] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMemory, setShowMemory] = useState(false);

  const refresh = useCallback(() => {
    if (!aiToken()) return;
    listConversations().then(setList).catch(() => undefined);
    aiStatus().then(setSt).catch((e: Error) => setStErr(e.message));
  }, []);
  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  const open = async (id: string) => {
    setShowHistory(false);
    try {
      const c = await loadConversation(id);
      setConv({ id, messages: c.messages as UIMessage[] });
    } catch {
      toast($t('Could not open the conversation'), { tone: 'error' });
    }
  };
  const fresh = () => {
    setShowHistory(false);
    setConv({ id: newId(), messages: [] });
  };
  const remove = async (id: string) => {
    const ok = await confirmDialog({ title: $t('Delete this conversation?'), description: $t('It is removed from all your devices.'), confirmLabel: $t('Delete') });
    if (!ok) return;
    await deleteConversation(id).catch(() => undefined);
    if (id === conv.id) fresh();
    refresh();
  };

  let gate: React.ReactNode = null;
  if (syncStatus === 'unconfigured') gate = <Gate state="sleeping" title={$t('KROOPY AI needs the KROOPY cloud')} text={$t('This copy of the app has no cloud, so the assistant can’t run here.')} />;
  else if (!user)
    gate = (
      <Gate state="curious" title={$t('Sign in to talk to KROOPY AI')} text={$t('Your conversations and what the assistant knows about your work are private to your account and follow you on every device.')}>
        <Link to="/account" className="btn btn--primary">{$t('Sign in or create account')}</Link>
      </Gate>
    );
  else if (st && !st.configured)
    gate = <Gate state="sleeping" title={$t('KROOPY AI is almost ready')} text={$t('The assistant still needs to be connected to its AI provider (OpenAI). We’re doing that step together — once it’s connected, you can start talking here.')} />;
  else if (stErr && !st) gate = <Gate state="confused" title={$t('KROOPY AI isn’t reachable')} text={stErr} />;

  return (
    <div className="page ai-page">
      <header className="ai-head">
        <div className="row gap-12" style={{ minWidth: 0 }}>
          <h1 className="page-title display">KROOPY AI<span className="stop" aria-hidden /></h1>
          <span className="badge">Beta</span>
        </div>
        {!gate && (
          <div className="row gap-12 ai-head__tools">
            <label className="ai-deep" title={$t('Uses a more capable model for strategy, analysis and long scripts (costs more).')}>
              <span>{$t('Think deeper')}</span>
              <Switch checked={deep} onChange={setDeep} label={$t('Think deeper')} />
            </label>
            <Button icon={<Brain />} onClick={() => setShowMemory(true)} aria-label={$t('Memory')}><span className="hide-mobile">{$t('Memory')}</span></Button>
            <Button className="only-mobile" icon={<History />} onClick={() => setShowHistory(true)} aria-label={$t('Conversations')} />
            <Button className="only-mobile" icon={<MessageSquarePlus />} onClick={fresh} aria-label={$t('New conversation')} />
          </div>
        )}
      </header>
      {gate ?? (
        <div className="ai-layout">
          <aside className="ai-side hide-mobile">
            <History_ list={list} current={conv.id} onOpen={open} onNew={fresh} onDelete={remove} />
            {st && (
              <p className="ai-usage subtle">
                {$t('Today: {n} messages', { n: st.usage.messagesToday })}
              </p>
            )}
          </aside>
          <Chat key={conv.id} id={conv.id} initial={conv.messages} deep={deep} onSaved={() => setTimeout(refresh, 800)} />
        </div>
      )}
      <Modal open={showMemory} onClose={() => setShowMemory(false)} title={$t('What KROOPY AI remembers')} size="md">
        {showMemory && <MemoryPanel />}
      </Modal>
      <Modal open={showHistory} onClose={() => setShowHistory(false)} title={$t('Conversations')} size="sm">
        <History_ list={list} current={conv.id} onOpen={open} onNew={fresh} onDelete={remove} />
      </Modal>
    </div>
  );
}

function Gate({ state, title, text, children }: { state: MascotState; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="ai-gate panel">
      <Mascot size={120} state={state} followPointer />
      <h2 className="display">{title}</h2>
      <p className="subtle">{text}</p>
      {children}
    </div>
  );
}
