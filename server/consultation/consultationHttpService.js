import { createHash, randomBytes } from 'node:crypto';
import { canLeaveSiteTrace } from '../authService.js';

const guestCookieName = 'consultation_guest';
const cookiePath = '/zjubio/';
const maxMessageLength = 1000;

function guestTokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function guestCookie(token, request) {
  const secure = String(request.headers['x-forwarded-proto'] ?? '').split(',')[0].trim().toLowerCase() === 'https'
    ? '; Secure' : '';
  return `${guestCookieName}=${token}; Path=${cookiePath}; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
}

function fail(sendJson, response, status, message) {
  sendJson(response, status, { message });
  return true;
}

function publicConversation(conversation) {
  if (!conversation) return null;
  const { id, participantName, createdAt, updatedAt, unreadCount, latestMessageId } = conversation;
  return { id, participantName, createdAt, updatedAt, unreadCount, latestMessageId };
}

function currentSession(store, now) {
  const session = store.latestSession();
  const open = Boolean(session && !session.closedAt && session.startsAt <= now && now < session.endsAt);
  return { session, open };
}

function statusPayload(consultationStore, authStore, userId, user, now) {
  const { session, open } = currentSession(consultationStore, now);
  const mentor = session ? authStore.findUserById(session.mentorUserId) : null;
  const payload = {
    open,
    closed: Boolean(session?.closedAt),
    startsAt: session?.startsAt ?? null,
    endsAt: session?.endsAt ?? null,
    mentor: mentor ? { id: mentor.publicId, nickname: mentor.nickname } : null,
    isMentor: Boolean(session && userId === session.mentorUserId && !session.closedAt),
  };
  if (userId && user?.role === 'admin') payload.mentorUserId = session?.mentorUserId ?? null;
  return payload;
}

function parseSchedule(body, authStore, now) {
  const mentorUserId = Number(body?.mentorUserId);
  if (!Number.isSafeInteger(mentorUserId) || mentorUserId <= 0) return null;
  const mentor = authStore.findUserById(mentorUserId);
  if (!mentor || !/^\d+@zju\.edu\.cn$/.test(mentor.email)) return null;
  const starts = Date.parse(body?.startsAt);
  const ends = Date.parse(body?.endsAt);
  if (!Number.isFinite(starts) || !Number.isFinite(ends) || starts >= ends || ends <= Date.parse(now)) return null;
  return { mentorUserId, startsAt: new Date(starts).toISOString(), endsAt: new Date(ends).toISOString() };
}

function visitorIdentity({ consultationStore, cookies, user, userId, now, create }) {
  if (canLeaveSiteTrace(user) && userId) {
    return { visitorUserId: userId, guestTokenHash: null, setCookie: null,
      participantName: user.nickname || '同学' };
  }
  const token = cookies[guestCookieName];
  const hash = /^[A-Za-z0-9_-]{43}$/.test(token ?? '') ? guestTokenHash(token) : '';
  if (hash && consultationStore.hasGuestSession(hash)) {
    return { visitorUserId: null, guestTokenHash: hash, setCookie: null, participantName: null };
  }
  if (!create) return null;
  const newToken = randomBytes(32).toString('base64url');
  const newHash = guestTokenHash(newToken);
  consultationStore.createGuestSession(newHash, now);
  return { visitorUserId: null, guestTokenHash: newHash, setCookie: newToken, participantName: null };
}

export async function handleConsultationHttpRequest({
  request, response, url, user, userId, cookies, authStore, consultationStore,
  guestCreationGuard, clientIp, sendJson, readJsonBody, now = () => new Date().toISOString(),
}) {
  const path = url.pathname;
  if (!path.startsWith('/api/consultation/') && !path.startsWith('/api/admin/consultation/')) return false;
  const instant = now();
  const { session, open } = currentSession(consultationStore, instant);
  const isMentor = Boolean(session && !session.closedAt && userId === session.mentorUserId && canLeaveSiteTrace(user));

  if (request.method === 'GET' && path === '/api/consultation/status') {
    sendJson(response, 200, statusPayload(consultationStore, authStore, userId, user, instant));
    return true;
  }

  if (path.startsWith('/api/admin/consultation/')) {
    if (!userId) return fail(sendJson, response, 401, '请先登录管理员账号。');
    if (user?.role !== 'admin') return fail(sendJson, response, 403, '当前账号没有管理员权限。');
    if (request.method === 'GET' && path === '/api/admin/consultation/candidates') {
      const users = authStore.searchConsultationMentorCandidates(url.searchParams.get('q') ?? '')
        .filter((candidate) => /^\d+$/.test(candidate.studentId));
      sendJson(response, 200, { users });
      return true;
    }
    if (path === '/api/admin/consultation/session' && request.method === 'DELETE') {
      consultationStore.closeSession(instant);
      sendJson(response, 200, statusPayload(consultationStore, authStore, userId, user, instant));
      return true;
    }
    if (path === '/api/admin/consultation/session' && request.method === 'PUT') {
      if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
        return fail(sendJson, response, 415, '咨询室请求格式无效。');
      }
      const schedule = parseSchedule(await readJsonBody(request), authStore, instant);
      if (!schedule) return fail(sendJson, response, 400, '请选择已认证用户，并设置有效的开始和结束时间。');
      consultationStore.replaceSession({ ...schedule, now: instant });
      sendJson(response, 200, statusPayload(consultationStore, authStore, userId, user, instant));
      return true;
    }
    return false;
  }

  if (request.method === 'POST' && path === '/api/consultation/conversations') {
    if (!open) return fail(sendJson, response, 403, '咨询室当前未开放。');
    if (isMentor) return fail(sendJson, response, 403, '指导学长不能向自己发起咨询。');
    if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      return fail(sendJson, response, 415, '咨询室请求格式无效。');
    }
    const body = await readJsonBody(request);
    if (body?.guestName != null && typeof body.guestName !== 'string') {
      return fail(sendJson, response, 400, '称呼格式无效。');
    }
    const guestName = (body?.guestName ?? '').trim();
    if (guestName.length > 32 || /[\u0000-\u001f\u007f]/u.test(guestName)) {
      return fail(sendJson, response, 400, '称呼不能超过 32 个字。');
    }
    let identity = visitorIdentity({ consultationStore, cookies, user, userId, now: instant, create: false });
    if (!identity) {
      if (!guestCreationGuard.checkAndRecord(clientIp, Date.parse(instant))) {
        return fail(sendJson, response, 429, '咨询人数较多，请稍后再试。');
      }
      identity = visitorIdentity({ consultationStore, cookies, user, userId, now: instant, create: true });
    }
    const conversation = consultationStore.createOrFindConversation({
      sessionId: session.id,
      visitorUserId: identity.visitorUserId,
      guestTokenHash: identity.guestTokenHash,
      participantName: identity.participantName || guestName || '游客',
      now: instant,
    });
    const headers = identity.setCookie ? { 'set-cookie': guestCookie(identity.setCookie, request) } : {};
    sendJson(response, 201, { conversation: publicConversation(conversation) }, headers);
    return true;
  }

  if (request.method === 'GET' && path === '/api/consultation/conversations/current') {
    if (isMentor) return fail(sendJson, response, 403, '请使用指导学长会话列表。');
    const identity = visitorIdentity({ consultationStore, cookies, user, userId, now: instant, create: false });
    const conversation = session && identity
      ? consultationStore.findConversationForIdentity({ sessionId: session.id, ...identity }) : null;
    sendJson(response, 200, { conversation: publicConversation(conversation) });
    return true;
  }

  if (request.method === 'GET' && path === '/api/consultation/conversations') {
    if (!isMentor) return fail(sendJson, response, userId ? 403 : 401, '仅当前指导学长可查看咨询列表。');
    sendJson(response, 200, {
      conversations: consultationStore.listMentorConversations(session.id).map(publicConversation),
    });
    return true;
  }

  const messageMatch = path.match(/^\/api\/consultation\/conversations\/([0-9a-f-]{36})\/messages$/i);
  if (messageMatch && (request.method === 'GET' || request.method === 'POST')) {
    const conversation = consultationStore.findConversation(messageMatch[1]);
    const identity = visitorIdentity({ consultationStore, cookies, user, userId, now: instant, create: false });
    // The store never exposes the guest token hash in API payloads. Resolve
    // ownership separately to keep it off every public conversation object.
    const owner = conversation && consultationStore.isGuestConversationOwner(conversation.id, identity?.guestTokenHash);
    const actor = conversation && session && conversation.sessionId === session.id
      ? isMentor ? 'mentor'
        : identity?.visitorUserId === conversation.visitorUserId && identity?.visitorUserId ? 'visitor'
          : owner ? 'visitor' : null
      : null;
    if (!actor) return fail(sendJson, response, 404, '会话不存在。');
    if (request.method === 'GET') {
      if (actor === 'mentor') consultationStore.markMentorRead(conversation.id, instant);
      sendJson(response, 200, { messages: consultationStore.listMessages(conversation.id) });
      return true;
    }
    if (!open) return fail(sendJson, response, 403, '咨询室当前未开放。');
    if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      return fail(sendJson, response, 415, '咨询室请求格式无效。');
    }
    const body = await readJsonBody(request);
    if (typeof body?.text !== 'string') return fail(sendJson, response, 400, '消息格式无效。');
    const messageText = body.text.trim();
    if (!messageText || messageText.length > maxMessageLength) {
      return fail(sendJson, response, 400, `消息须为 1 到 ${maxMessageLength} 字。`);
    }
    if (actor === 'visitor') {
      const latest = consultationStore.latestMessage(conversation.id);
      if (latest?.sender === 'visitor' && Date.parse(instant) - Date.parse(latest.createdAt) < 1500) {
        return fail(sendJson, response, 429, '发送太快，请稍后再试。');
      }
      const hourAgo = new Date(Date.parse(instant) - 60 * 60 * 1000).toISOString();
      if (consultationStore.countMessagesSince(conversation.id, 'visitor', hourAgo) >= 60) {
        return fail(sendJson, response, 429, '发送过于频繁，请稍后再试。');
      }
    }
    const message = consultationStore.addMessage({
      conversationId: conversation.id, sender: actor, text: messageText, now: instant,
    });
    sendJson(response, 201, { message });
    return true;
  }

  return false;
}
