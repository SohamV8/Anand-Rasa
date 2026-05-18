/**
 * Anand Rasa — Premium AI chat panel
 * Preserves legacy IDs and mock reply flow from floating-chat.liquid
 */
(function () {
  if (window.__arFloatingChatInit) return;
  window.__arFloatingChatInit = true;

  var toggleBtn = document.getElementById('ar-floating-chat-toggle');
  var closeBtn = document.getElementById('ar-chatbox-close');
  var chatbox = document.getElementById('ar-ai-chatbox');
  var backdrop = document.querySelector('[data-ar-chat-backdrop]');
  var form = document.getElementById('ar-chatbox-form');
  var input = document.getElementById('ar-chatbox-input');
  var messages = document.getElementById('ar-chatbox-messages');
  var typingEl = document.querySelector('[data-ar-chat-typing]');
  var sendBtn = document.querySelector('[data-ar-chat-send]');

  if (!toggleBtn || !chatbox || !form || !input || !messages) return;

  var STORAGE_KEY = 'anandrasa_ai_chat_v1';
  var isSending = false;

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function scrollToBottom() {
    requestAnimationFrame(function () {
      messages.scrollTop = messages.scrollHeight;
    });
  }

  function setOpenState(isOpen) {
    chatbox.classList.toggle('active', isOpen);
    chatbox.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    toggleBtn.classList.toggle('is-open', isOpen);
    toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (backdrop) {
      backdrop.classList.toggle('is-visible', isOpen);
      backdrop.hidden = !isOpen;
      backdrop.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    }
    document.documentElement.classList.toggle('ar-chat-open', isOpen);

    if (isOpen) {
      scrollToBottom();
      window.setTimeout(function () {
        input.focus();
      }, prefersReducedMotion() ? 0 : 280);
    }
  }

  function setTyping(visible) {
    if (!typingEl) return;
    typingEl.classList.toggle('is-visible', visible);
    typingEl.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (visible) scrollToBottom();
  }

  function setSending(sending) {
    isSending = sending;
    input.disabled = sending;
    if (sendBtn) sendBtn.disabled = sending;
    form.setAttribute('aria-busy', sending ? 'true' : 'false');
  }

  /** Safe text rendering — no raw HTML injection */
  function appendMessage(text, role, options) {
    options = options || {};
    var msg = document.createElement('div');
    msg.className = 'ar-msg ' + (role === 'user' ? 'ar-msg--user' : role === 'error' ? 'ar-msg--error' : 'ar-msg--ai');
    msg.setAttribute('role', 'article');

    var body = document.createElement('span');
    body.textContent = text;
    msg.appendChild(body);

    if (options.time !== false) {
      var time = document.createElement('span');
      time.className = 'ar-msg__time';
      time.textContent = formatTime(new Date());
      msg.appendChild(time);
    }

    if (typingEl && typingEl.parentNode === messages) {
      messages.insertBefore(msg, typingEl);
    } else {
      messages.appendChild(msg);
    }
    scrollToBottom();
    persistMessages();
    return msg;
  }

  function persistMessages() {
    try {
      var items = [];
      messages.querySelectorAll('.ar-msg').forEach(function (el) {
        var span = el.querySelector(':scope > span:not(.ar-msg__time)');
        var txt = span ? span.textContent : '';
        if (el.classList.contains('ar-msg--user')) items.push({ role: 'user', text: txt });
        else if (el.classList.contains('ar-msg--ai')) items.push({ role: 'ai', text: txt });
      });
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-40)));
    } catch (e) { /* no-op */ }
  }

  function restoreMessages() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var items = JSON.parse(raw);
      if (!Array.isArray(items) || !items.length) return;
      messages.querySelectorAll('.ar-msg').forEach(function (el) {
        el.remove();
      });
      items.forEach(function (item) {
        if (item && item.text) appendMessage(item.text, item.role === 'user' ? 'user' : 'ai', { time: false });
      });
    } catch (e) { /* no-op */ }
  }

  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }

  function sendMessage() {
    var text = input.value.trim();
    if (!text || isSending) return;

    appendMessage(text, 'user');
    input.value = '';
    autoGrow();
    setSending(true);
    setTyping(true);

    window.setTimeout(function () {
      setTyping(false);
      appendMessage('Thanks for your message. Our team will connect with you shortly.', 'ai');
      setSending(false);
      input.focus();
    }, 900);
  }

  restoreMessages();
  if (!messages.querySelector('.ar-msg')) {
    appendMessage('Hello! How can I help you today?', 'ai', { time: false });
  }

  toggleBtn.addEventListener('click', function () {
    setOpenState(!chatbox.classList.contains('active'));
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      setOpenState(false);
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', function () {
      setOpenState(false);
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && chatbox.classList.contains('active')) {
      setOpenState(false);
      toggleBtn.focus();
    }
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    sendMessage();
  });

  input.addEventListener('input', autoGrow);

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  function syncKeyboardInset() {
    if (!window.visualViewport) return;
    var inset = Math.max(0, window.innerHeight - window.visualViewport.height);
    chatbox.style.setProperty('--ar-keyboard-offset', inset > 72 ? inset + 'px' : '0px');
    if (chatbox.classList.contains('active')) scrollToBottom();
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncKeyboardInset);
    window.visualViewport.addEventListener('scroll', syncKeyboardInset);
  }
})();
