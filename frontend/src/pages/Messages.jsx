import React, { useCallback, useEffect, useRef, useState } from 'react';
import { playSound } from '../utils/sounds';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft, FiMessageSquare, FiMic, FiPaperclip, FiSend, FiSquare, FiX } from 'react-icons/fi';
import { IoCheckmark, IoCheckmarkDone } from 'react-icons/io5';
import { RecordingStatus, VoicePlayer } from '../components/VoiceMessage';
import { messageService } from '../services/api';

const LIMITS = { image: 5, audio: 5, video: 25 };
const ACCEPT = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav',
  'video/mp4', 'video/webm', 'video/quicktime',
];
const TEXT_LIMIT = 4000;
const time = (value) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const date = (value) => new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
const name = (peer) => peer.display_name || peer.username;
const threadUrl = (peer) => '/messages/' + encodeURIComponent(peer.username);
const errorText = (error, fallback) => typeof error.response?.data?.detail === 'string'
  ? error.response.data.detail : fallback;
const mediaLabel = (type) => ({ image: 'Image', audio: 'Voice clip', video: 'Video' })[type?.split('/')[0]];
const iconButton = 'inline-grid size-9 shrink-0 place-items-center rounded-lg text-cs-text-dim hover:bg-cs-overlay/10 hover:text-cs-text disabled:opacity-40';

function Avatar({ peer }) {
  return <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-cs-primary/15 font-semibold text-cs-primary">
    {peer.avatar ? <img className="size-full object-cover" src={peer.avatar} alt="" /> : name(peer).charAt(0).toUpperCase()}
  </span>;
}

function Attachment({ message }) {
  const [load, setLoad] = useState(false);
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const kind = message.media_type.split('/')[0];
  useEffect(() => {
    if (!load) return;
    const controller = new AbortController();
    let objectUrl;
    messageService.media(message.id, controller.signal).then(({ data }) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(data);
      setUrl(objectUrl);
    }).catch(() => {
      if (!controller.signal.aborted) {
        setFailed(true);
        setLoad(false);
      }
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [load, message.id]);

  if (!url) return <button type="button" disabled={load}
    className="mb-1 rounded-lg border border-cs-line/20 px-3 py-2 text-sm hover:bg-cs-overlay/10"
    onClick={() => { setFailed(false); setLoad(true); }}>
    {load ? 'Loading…' : failed ? 'Could not load. Retry' : 'Open ' + mediaLabel(message.media_type).toLowerCase()}
  </button>;
  if (kind === 'image') return <img src={url} className="mb-1 max-h-80 rounded-lg object-contain" alt="Message attachment" />;
  return <video src={url} controls playsInline className="mb-1 max-h-80 w-full rounded-lg" aria-label="Video attachment" />;
}

function ImagePreview({ file }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const preview = URL.createObjectURL(file);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file]);
  return url && <img src={url} alt="Image attachment preview"
    className="size-11 shrink-0 rounded-lg border border-cs-line/15 object-cover" />;
}

function Composer({ username, onSent }) {
  const [draft, setDraft] = useState('');
  const [file, setFile] = useState(null);
  const [recordingMode, setRecordingMode] = useState(null);
  const [cancelArmed, setCancelArmed] = useState(false);
  const [canceled, setCanceled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const picker = useRef(null);
  const recorder = useRef(null);
  const timer = useRef(null);
  const active = useRef(false);
  const pointerPress = useRef(null);
  const discardRecording = useRef(false);
  const recording = Boolean(recordingMode);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      clearTimeout(timer.current);
      const current = recorder.current;
      if (current) {
        current.onstop = null;
        if (current.state !== 'inactive') current.stop();
        current.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!canceled) return;
    const timeout = setTimeout(() => setCanceled(false), 1800);
    return () => clearTimeout(timeout);
  }, [canceled]);

  function attach(next) {
    const type = next.type.split(';')[0];
    const limit = LIMITS[type.split('/')[0]];
    if (!ACCEPT.includes(type)) return setError('Choose a supported image, audio or video file.');
    if (next.size > limit * 1024 * 1024) return setError('This attachment must be ' + limit + ' MB or smaller.');
    setError('');
    setFile(next);
  }

  function pasteImage(event) {
    if (busy || recording) return;
    const clipboard = event.clipboardData;
    const image = Array.from(clipboard.files).find((file) => file.type.startsWith('image/'))
      || Array.from(clipboard.items).find((item) => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile();
    if (!image) return;
    if (!clipboard.getData('text/plain')) event.preventDefault();
    attach(image);
  }

  function stopRecording(discard = false) {
    pointerPress.current = null;
    setCancelArmed(false);
    if (recorder.current?.state !== 'recording') return;
    if (discard) setCanceled(true);
    discardRecording.current = discard;
    recorder.current.stop();
  }

  async function record(press = null) {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('Recording is unavailable here. You can attach an audio file.');
      return;
    }
    setError('');
    setCanceled(false);
    setBusy(true);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!active.current || (press && pointerPress.current !== press)) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((type) => MediaRecorder.isTypeSupported(type));
      const current = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks = [];
      recorder.current = current;
      discardRecording.current = false;
      current.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      current.onstop = () => {
        clearTimeout(timer.current);
        stream.getTracks().forEach((track) => track.stop());
        recorder.current = null;
        setRecordingMode(null);
        if (chunks.length && !discardRecording.current) {
          const type = (chunks[0].type || current.mimeType).split(';')[0];
          attach(new File(chunks, 'voice.' + type.split('/')[1], { type }));
        }
      };
      current.start();
      timer.current = setTimeout(() => stopRecording(), 60_000);
      setRecordingMode(press ? 'hold' : 'keyboard');
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      setError('Could not start the microphone. Check your browser permissions.');
    } finally {
      if (active.current) setBusy(false);
    }
  }

  function startPress(event) {
    if (busy || recording || pointerPress.current || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const press = { id: event.pointerId };
    pointerPress.current = press;
    record(press);
  }

  function pointerIsOutside(event) {
    const bounds = event.currentTarget.form.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom;
  }

  function releasePress(event, canceled = false) {
    if (pointerPress.current?.id !== event.pointerId) return;
    stopRecording(canceled || pointerIsOutside(event));
  }

  async function send(event) {
    event.preventDefault();
    if (busy || recording || (!draft.trim() && !file)) return;
    setBusy(true);
    setError('');
    const body = new FormData();
    body.append('text', draft);
    if (file) body.append('attachment', file);
    try {
      const { data } = await messageService.send(username, body);
      playSound('send');
      if (active.current) {
        setDraft('');
        setFile(null);
        onSent(data);
      }
    } catch (error) {
      setError(errorText(error, 'Could not send your message. Try again.'));
    } finally {
      if (active.current) setBusy(false);
    }
  }

  return <form onSubmit={send} onPaste={pasteImage} onKeyDown={(event) => {
    if (event.key === 'Escape' && (recording || pointerPress.current)) {
      event.preventDefault();
      stopRecording(true);
    }
  }} className="shrink-0 border-t border-cs-line/15 bg-cs-dark p-3 sm:p-4">
    {error && <p role="alert" className="mb-2 text-sm text-cs-orange">{error}</p>}
    {canceled && <p role="status" className="mb-2 text-xs font-medium text-cs-red">Recording canceled</p>}
    {file && !recording && <div className="mb-2 flex items-center gap-2 text-sm">
      {file.type.startsWith('audio/') ? <VoicePlayer key={file.name + file.lastModified} file={file} /> :
        <>{file.type.startsWith('image/') ? <ImagePreview file={file} /> : <FiPaperclip className="shrink-0" />}
          <span className="truncate">{file.name}</span></>}
      <button type="button" onClick={() => setFile(null)} disabled={busy} className={iconButton} aria-label="Remove attachment"><FiX /></button>
    </div>}
    <div className={'flex min-h-[3.75rem] items-center gap-1 rounded-xl border p-1.5 transition-colors sm:gap-2 ' +
      (recording && cancelArmed ? 'border-cs-red/50 bg-cs-red/[0.08]' : 'border-cs-line/20 bg-cs-overlay/[0.03] focus-within:border-cs-primary/40')}>
      <input type="file" hidden ref={picker} accept={ACCEPT.join(',')} onChange={(event) => {
        const next = event.target.files[0];
        if (next) attach(next);
        event.target.value = '';
      }} />
      {!recording && <button type="button" onClick={() => picker.current.click()} disabled={busy} className={iconButton} aria-label="Attach image, audio or video"><FiPaperclip /></button>}
      {recording ? <RecordingStatus holding={recordingMode === 'hold'} cancelArmed={cancelArmed} /> :
        <textarea rows={2} maxLength={TEXT_LIMIT} aria-label="Message" placeholder="Write a message…" value={draft}
        disabled={busy} onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.form.requestSubmit();
          }
        }}
        className="min-w-0 flex-1 resize-none bg-transparent py-1 text-sm leading-5 outline-none placeholder:text-cs-text-muted" />}
      <button type="button" onPointerDown={startPress} onPointerUp={releasePress}
        onPointerMove={(event) => {
          if (pointerPress.current?.id === event.pointerId) setCancelArmed(pointerIsOutside(event));
        }}
        onPointerCancel={(event) => releasePress(event, true)}
        onLostPointerCapture={(event) => releasePress(event, true)}
        onContextMenu={(event) => event.preventDefault()}
        onClick={(event) => {
          if (event.detail !== 0 || busy) return;
          if (recording) stopRecording();
          else record();
        }}
        aria-disabled={busy} title={recording ? 'Finish recording' : 'Hold to record a voice clip'}
        className={recording
          ? 'grid size-11 shrink-0 touch-none place-items-center rounded-full transition-colors ' +
            (cancelArmed ? 'bg-cs-red text-cs-darkest' : 'bg-cs-primary text-cs-btn-text')
          : iconButton + ' touch-none aria-disabled:opacity-40'}
        aria-label={recording ? 'Stop recording' : 'Record voice clip'}>
        {recording && recordingMode === 'keyboard' ? <FiSquare className="size-3 fill-current" /> : <FiMic className={recording ? 'size-5' : undefined} />}
      </button>
      {!recording && <button type="submit" aria-label="Send message" disabled={busy || (!draft.trim() && !file)}
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-cs-primary text-cs-dark disabled:opacity-40"><FiSend /></button>}
    </div>
  </form>;
}

function mergeMessages(current, incoming) {
  const byId = new Map([...current, ...incoming].map((message) => [message.id, message]));
  if (byId.size === current.length) return current;
  return [...byId.values()].sort((first, second) => first.id - second.id);
}

function Conversation({ username, refreshInbox }) {
  const [peer, setPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState('');
  const [peerReadThrough, setPeerReadThrough] = useState(0);
  const scroll = useRef(null);
  const scrollAction = useRef(null);
  const readThrough = useRef(0);
  const receiptPending = useRef(false);

  const markVisibleRead = useCallback(async () => {
    const panel = scroll.current;
    if (!panel || document.hidden || receiptPending.current) return;
    const viewport = panel.getBoundingClientRect();
    const visibleTop = Math.max(viewport.top, 0);
    const visibleBottom = Math.min(viewport.bottom, window.innerHeight);
    if (visibleTop >= visibleBottom) return;
    const incoming = panel.querySelectorAll('[data-incoming-message]');
    for (let index = incoming.length - 1; index >= 0; index -= 1) {
      const bubble = incoming[index];
      const id = Number(bubble.dataset.incomingMessage);
      if (id <= readThrough.current) break;
      const bounds = bubble.getBoundingClientRect();
      if (bounds.top >= visibleBottom || bounds.bottom <= visibleTop) continue;
      receiptPending.current = true;
      try {
        await messageService.markRead(username, id);
        readThrough.current = Math.max(readThrough.current, id);
      } catch {
        // The next refresh or scroll retries a receipt that could not be saved.
      } finally {
        receiptPending.current = false;
      }
      break;
    }
  }, [username]);

  useEffect(() => {
    const controller = new AbortController();
    let initialized = false;
    let pending = false;
    let latestId = 0;
    async function refresh() {
      if (pending || (initialized && document.hidden)) return;
      pending = true;
      try {
        const { data } = await messageService.thread(username, {}, controller.signal);
        let page = data;
        const incoming = [...data.messages];
        while (initialized && page.has_more && page.messages[0].id > latestId) {
          ({ data: page } = await messageService.thread(username, { before: page.messages[0].id }, controller.signal));
          incoming.push(...page.messages);
        }
        if (controller.signal.aborted) return;
        const panel = scroll.current;
        const newestId = data.messages.at(-1)?.id ?? 0;
        if (initialized && incoming.some((m) => m.id > latestId && !m.mine)) playSound('receive');
        if (!initialized || (newestId > latestId && panel && panel.scrollHeight - panel.scrollTop - panel.clientHeight < 80)) {
          scrollAction.current ??= { bottom: true };
        }
        setPeer(data.peer);
        setMessages((current) => mergeMessages(current, incoming));
        readThrough.current = Math.max(readThrough.current, data.read_through ?? 0);
        setPeerReadThrough((current) => Math.max(current, data.peer_read_through ?? 0));
        if (!initialized) setHasOlder(data.has_more);
        latestId = Math.max(latestId, newestId);
        initialized = true;
        setError('');
      } catch (error) {
        if (!controller.signal.aborted) setError(errorText(error, 'Could not refresh this conversation.'));
      } finally {
        pending = false;
      }
    }
    refresh();
    const interval = setInterval(refresh, 4000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [username]);

  useEffect(() => {
    const panel = scroll.current;
    const action = scrollAction.current;
    if (!panel || !action) return;
    panel.scrollTop = action.bottom ? panel.scrollHeight : action.top + panel.scrollHeight - action.height;
    scrollAction.current = null;
  }, [messages]);

  useEffect(() => {
    markVisibleRead();
  }, [messages, peer, markVisibleRead]);

  useEffect(() => {
    document.addEventListener('visibilitychange', markVisibleRead);
    return () => document.removeEventListener('visibilitychange', markVisibleRead);
  }, [markVisibleRead]);

  async function loadOlder() {
    setLoadingOlder(true);
    try {
      const { data } = await messageService.thread(username, { before: messages[0].id });
      const panel = scroll.current;
      if (panel) scrollAction.current = { top: panel.scrollTop, height: panel.scrollHeight };
      setMessages((current) => mergeMessages(current, data.messages));
      setHasOlder(data.has_more);
    } catch {
      setError('Could not load older messages. Try again.');
    } finally {
      setLoadingOlder(false);
    }
  }

  return <section className="flex min-h-0 min-w-0 flex-1 flex-col">
    <header className="flex min-h-16 shrink-0 items-center gap-3 border-b border-cs-line/15 bg-cs-dark px-3 sm:px-5">
      <Link to="/messages" aria-label="Back to inbox" className={iconButton + ' sm:hidden'}><FiArrowLeft /></Link>
      {peer ? <><Avatar peer={peer} /><Link to={'/u/' + peer.username} className="min-w-0 hover:text-cs-primary">
        <p className="truncate font-semibold">{name(peer)}</p>
        <p className="truncate text-xs text-cs-text-muted">@{peer.username}</p>
      </Link></> : <p className="font-semibold">@{username}</p>}
    </header>
    <div ref={scroll} onScroll={markVisibleRead} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6" aria-label="Message history">
      {error && <p role="alert" className="mb-3 text-sm text-cs-orange">{error}</p>}
      {hasOlder && <button type="button" disabled={loadingOlder} onClick={loadOlder}
        className="mx-auto mb-3 block rounded-lg border border-cs-line/15 px-3 py-1.5 text-xs text-cs-text-dim">
        {loadingOlder ? 'Loading…' : 'Load older messages'}
      </button>}
      {!messages.length && !error && <p className="my-8 text-center text-sm text-cs-text-muted">{peer ? 'Start the conversation.' : 'Loading conversation…'}</p>}
      {messages.map((message, index) => {
        const day = date(message.created_at);
        const dayChanged = index === 0 || day !== date(messages[index - 1].created_at);
        const seen = message.id <= peerReadThrough;
        return <React.Fragment key={message.id}>
          {dayChanged && <div className="my-4 flex justify-center">
            <span className="rounded-full bg-cs-overlay/10 px-3 py-1 text-xs text-cs-text-dim">{day}</span>
          </div>}
          <div data-incoming-message={message.mine ? undefined : message.id}
            className={'mb-2 flex ' + (message.mine ? 'justify-end' : 'justify-start')}>
            <div className={'min-w-0 max-w-[90%] border px-3 py-2 sm:max-w-[78%] ' + (message.mine
              ? 'rounded-2xl rounded-br-sm border-cs-primary/25 bg-cs-primary/15'
              : 'rounded-2xl rounded-bl-sm border-cs-line/15 bg-cs-overlay/[0.06]')}>
              {message.media_type?.startsWith('audio/') ? <VoicePlayer messageId={message.id} /> :
                message.media_type && <Attachment message={message} />}
              {message.text && <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>}
              <div className="mt-1 flex items-center justify-end gap-1.5 text-xs text-cs-text-muted">
                <time dateTime={message.created_at}>{time(message.created_at)}</time>
                {message.mine && <span role="img" aria-label={seen ? 'Seen' : 'Sent'} title={seen ? 'Seen' : 'Sent'}
                  className={seen ? 'text-cs-primary' : 'text-cs-text-dim'}>
                  {seen ? <IoCheckmarkDone className="size-4" /> : <IoCheckmark className="size-4" />}
                </span>}
              </div>
            </div>
          </div>
        </React.Fragment>;
      })}
    </div>
    {peer && <Composer username={username} onSent={(message) => {
      scrollAction.current = { bottom: true };
      setMessages((current) => mergeMessages(current, [message]));
      refreshInbox();
    }} />}
  </section>;
}

export default function Messages() {
  const { username } = useParams();
  const [inbox, setInbox] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(false);
  const openRef = React.useRef(username);
  openRef.current = username;
  const unreadRef = React.useRef(null);
  const refreshInbox = React.useCallback(async (signal) => {
    try {
      const { data } = await messageService.inbox(signal);
      // Chime when another conversation gets a new unread message.
      const others = data.filter((c) => c.peer.username !== openRef.current).reduce((a, c) => a + (c.unread || 0), 0);
      if (unreadRef.current !== null && others > unreadRef.current) playSound('receive');
      unreadRef.current = others;
      if (!signal?.aborted) { setInbox(data); setError(false); }
    } catch {
      if (!signal?.aborted) setError(true);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => { if (!document.hidden) refreshInbox(controller.signal); };
    refresh();
    const interval = setInterval(refresh, 8000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [refreshInbox]);

  const search = query.trim().toLowerCase();
  const filtered = inbox?.filter(({ peer }) => (name(peer) + ' ' + peer.username).toLowerCase().includes(search));
  return (
    <div className="flex min-w-0 flex-1 overflow-hidden bg-cs-overlay/[0.02]">
      <aside className={(username ? 'hidden sm:flex' : 'flex') + ' w-full min-w-0 shrink-0 flex-col border-cs-line/15 bg-cs-dark sm:w-[17rem] sm:border-r lg:w-[21rem]'}>
        <header className="shrink-0 border-b border-cs-line/15 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h1 className="text-xl font-semibold">Messages</h1>
            <Link to="/devs" className="text-sm text-cs-primary hover:underline">Find people</Link>
          </div>
          <input type="search" aria-label="Find a conversation" placeholder="Find a conversation…" value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-lg border border-cs-line/15 bg-cs-overlay/[0.04] px-3 py-2 text-sm outline-none focus:border-cs-primary/50" />
        </header>
        <nav aria-label="Conversations" className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {error && <p className="p-3 text-sm text-cs-orange" role="alert">Could not refresh your inbox.</p>}
          {!inbox && !error && <p className="p-3 text-sm text-cs-text-muted">Loading inbox…</p>}
          {filtered?.length === 0 && <p className="p-3 text-sm text-cs-text-muted">{search ? 'No matching conversations.' : 'Your conversations will show here.'}</p>}
          {filtered?.map(({ peer, last_message: last, unread = 0 }) => {
            const open = username === peer.username;
            const badge = !open && unread > 0;
            return (
              <Link key={peer.username} to={threadUrl(peer)}
                aria-current={open ? 'page' : undefined}
                aria-label={badge ? `${name(peer)}, ${unread} unread` : undefined}
                className={'flex items-center gap-3 rounded-xl px-3 py-2.5 ' + (open ? 'bg-cs-primary/15' : 'hover:bg-cs-overlay/[0.05]')}>
                <Avatar peer={peer} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${badge ? 'font-bold' : 'font-semibold'}`}>{name(peer)}</p>
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs text-cs-text-muted">
                      {last.mine && (last.status === 'seen'
                        ? <IoCheckmarkDone className="text-cs-primary text-sm" title="Seen" />
                        : <IoCheckmark className="text-sm" title="Sent" />)}
                      <time dateTime={last.created_at} className={badge ? 'text-cs-primary font-semibold' : ''}>{time(last.created_at)}</time>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-xs ${badge ? 'text-cs-text font-medium' : 'text-cs-text-dim'}`}>{last.mine ? 'You: ' : ''}{last.text || mediaLabel(last.media_type)}</p>
                    {badge && (
                      <span className="shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-cs-primary text-white text-[0.6875rem] font-bold grid place-items-center tabular-nums">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>
      {username ? <Conversation key={username} username={username} refreshInbox={refreshInbox} />
        : <section className="hidden flex-1 flex-col items-center justify-center gap-3 text-cs-text-muted sm:flex">
          <FiMessageSquare className="size-7 text-cs-primary" />
          <p className="text-sm">Choose a conversation or <Link to="/devs" className="text-cs-primary hover:underline">find a developer</Link>.</p>
        </section>}
    </div>
  );
}
