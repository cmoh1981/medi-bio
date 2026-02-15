/**
 * PaperMind AI Chat UI Component
 * Groq API (Llama 3.3 70B) 기반 서버사이드 AI 채팅
 */

class PaperMindChat {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentArticle = null;
    this.messages = [];
    this.isGenerating = false;
  }

  /**
   * UI 렌더링
   */
  render(article = null) {
    this.currentArticle = article;

    this.container.innerHTML = `
      <div class="ai-chat-container">
        <!-- 채팅 영역 -->
        <div id="chat-area" class="chat-area">
          <!-- 빠른 질문 버튼 -->
          <div class="quick-questions">
            <span class="quick-label">빠른 질문:</span>
            <button onclick="window.medChat.askQuick('이 연구의 주요 한계점은 무엇인가요?')" class="quick-btn">한계점</button>
            <button onclick="window.medChat.askQuick('NNT(Number Needed to Treat)가 어떻게 되나요?')" class="quick-btn">NNT</button>
            <button onclick="window.medChat.askQuick('실제 임상에서 어떻게 적용할 수 있나요?')" class="quick-btn">임상 적용</button>
            <button onclick="window.medChat.askQuick('비슷한 다른 연구와 비교하면 어떤가요?')" class="quick-btn">비교 분석</button>
          </div>

          <!-- 메시지 목록 -->
          <div id="messages" class="messages">
            <div class="message message-assistant">
              <div class="message-avatar"><i class="fas fa-robot"></i></div>
              <div class="message-content">안녕하세요! Llama 3.3 70B AI가 이 논문을 분석해 드립니다. 궁금한 점을 물어보세요.</div>
            </div>
          </div>

          <!-- 입력 영역 -->
          <div class="input-area">
            <input
              type="text"
              id="chat-input"
              placeholder="논문에 대해 궁금한 점을 물어보세요..."
              onkeypress="if(event.key === 'Enter') window.medChat.sendMessage()"
            >
            <button id="send-btn" onclick="window.medChat.sendMessage()" class="send-btn">
              <i class="fas fa-paper-plane"></i>
            </button>
          </div>

          <!-- 면책조항 -->
          <div class="disclaimer">
            <i class="fas fa-exclamation-triangle text-yellow-500 mr-1"></i>
            AI 분석은 참고용이며, 실제 임상 의사결정은 전문의의 판단을 따라야 합니다.
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 메시지 추가
   */
  addMessage(role, content) {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;

    const messageId = `msg-${Date.now()}`;
    const isUser = role === 'user';

    const messageHtml = `
      <div id="${messageId}" class="message ${isUser ? 'message-user' : 'message-assistant'}">
        <div class="message-avatar">
          <i class="fas ${isUser ? 'fa-user' : 'fa-robot'}"></i>
        </div>
        <div class="message-content" id="${messageId}-content">
          ${this.formatContent(content)}
        </div>
      </div>
    `;

    messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    this.messages.push({ id: messageId, role, content });
    return messageId;
  }

  /**
   * 로딩 메시지 추가
   */
  addLoadingMessage() {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;

    const messageId = `msg-${Date.now()}`;
    const messageHtml = `
      <div id="${messageId}" class="message message-assistant">
        <div class="message-avatar"><i class="fas fa-robot"></i></div>
        <div class="message-content" id="${messageId}-content">
          <span class="typing-indicator"><i class="fas fa-spinner fa-spin mr-1"></i>분석 중...</span>
        </div>
      </div>
    `;

    messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return messageId;
  }

  /**
   * 콘텐츠 포맷팅 (마크다운 기본 지원)
   */
  formatContent(content) {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  /**
   * 메시지 전송
   */
  async sendMessage(customMessage = null) {
    const input = document.getElementById('chat-input');
    const message = customMessage || input?.value?.trim();

    if (!message || this.isGenerating) return;

    // 입력 초기화
    if (input) input.value = '';

    // 사용자 메시지 추가
    this.addMessage('user', message);

    // 생성 시작
    this.isGenerating = true;
    this.setInputEnabled(false);

    // 로딩 메시지
    const loadingId = this.addLoadingMessage();

    try {
      // 논문 컨텍스트 구성
      const context = this.currentArticle ? {
        title: this.currentArticle.title,
        source: this.currentArticle.source,
        keyMessages: this.currentArticle.key_messages,
        clinicalInsight: this.currentArticle.clinical_insight
      } : {};

      // 서버 API 호출
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message, context })
      });

      const data = await res.json();

      // 로딩 메시지를 응답으로 교체
      const contentEl = document.getElementById(`${loadingId}-content`);

      if (!res.ok) {
        if (contentEl) {
          contentEl.innerHTML = `<span class="text-red-500"><i class="fas fa-exclamation-circle mr-1"></i>${data.error || 'AI 서비스 오류'}</span>`;
        }
        return;
      }

      if (contentEl) {
        contentEl.innerHTML = this.formatContent(data.reply);
      }

      this.messages.push({ id: loadingId, role: 'assistant', content: data.reply });

      // 스크롤
      const messagesContainer = document.getElementById('messages');
      if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;

    } catch (error) {
      console.error('AI chat error:', error);
      const contentEl = document.getElementById(`${loadingId}-content`);
      if (contentEl) {
        contentEl.innerHTML = `<span class="text-red-500"><i class="fas fa-exclamation-circle mr-1"></i>네트워크 오류. 다시 시도해 주세요.</span>`;
      }
    } finally {
      this.isGenerating = false;
      this.setInputEnabled(true);
    }
  }

  /**
   * 빠른 질문
   */
  askQuick(question) {
    this.sendMessage(question);
  }

  /**
   * 입력 활성화/비활성화
   */
  setInputEnabled(enabled) {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');

    if (input) {
      input.disabled = !enabled;
      input.placeholder = enabled ? '논문에 대해 궁금한 점을 물어보세요...' : 'AI가 응답 중입니다...';
    }

    if (sendBtn) {
      sendBtn.disabled = !enabled;
      sendBtn.innerHTML = enabled ? '<i class="fas fa-paper-plane"></i>' : '<i class="fas fa-spinner fa-spin"></i>';
    }
  }

  /**
   * 논문 컨텍스트 설정
   */
  setArticle(article) {
    this.currentArticle = article;
    this.addMessage('assistant', `"${article.title}" 논문에 대해 질문해 주세요!`);
  }

  /**
   * 채팅 초기화
   */
  clearChat() {
    this.messages = [];
    const messagesContainer = document.getElementById('messages');
    if (messagesContainer) messagesContainer.innerHTML = '';
  }
}

// 스타일
const chatStyles = document.createElement('style');
chatStyles.textContent = `
  .ai-chat-container {
    background: #f8f9fa;
    border-radius: 12px;
    padding: 12px;
  }
  .chat-area {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .quick-questions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 8px 0;
  }
  .quick-label {
    font-size: 11px;
    color: #6b7280;
    flex-shrink: 0;
  }
  .quick-btn {
    padding: 5px 10px;
    background: #e9d5ff;
    color: #7c3aed;
    border: none;
    border-radius: 16px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .quick-btn:hover {
    background: #7c3aed;
    color: white;
  }
  .messages {
    max-height: 300px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background: white;
    border-radius: 12px;
    min-height: 180px;
  }
  .message {
    display: flex;
    gap: 8px;
    max-width: 90%;
  }
  .message-user {
    margin-left: auto;
    flex-direction: row-reverse;
  }
  .message-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .message-assistant .message-avatar {
    background: #e9d5ff;
    color: #7c3aed;
  }
  .message-user .message-avatar {
    background: #dbeafe;
    color: #2563eb;
  }
  .message-content {
    padding: 10px 14px;
    border-radius: 12px;
    line-height: 1.5;
    font-size: 13px;
    word-wrap: break-word;
  }
  .message-assistant .message-content {
    background: #f3f4f6;
    color: #374151;
  }
  .message-user .message-content {
    background: #2563eb;
    color: white;
  }
  .typing-indicator {
    color: #7c3aed;
  }
  .input-area {
    display: flex;
    gap: 6px;
  }
  .input-area input {
    flex: 1;
    padding: 10px 14px;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    font-size: 13px;
    transition: border-color 0.2s;
    min-width: 0;
  }
  .input-area input:focus {
    outline: none;
    border-color: #7c3aed;
  }
  .input-area input:disabled {
    background: #f3f4f6;
  }
  .send-btn {
    padding: 10px 16px;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.2s;
    flex-shrink: 0;
  }
  .send-btn:hover:not(:disabled) {
    background: #6d28d9;
  }
  .send-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }
  .disclaimer {
    font-size: 10px;
    color: #9ca3af;
    text-align: center;
    padding: 6px 8px;
    background: #fffbeb;
    border-radius: 8px;
    line-height: 1.4;
  }
  .ai-chat-container .hidden {
    display: none !important;
  }

  /* Mobile responsive adjustments */
  @media (min-width: 640px) {
    .ai-chat-container {
      padding: 16px;
    }
    .quick-label {
      font-size: 12px;
    }
    .quick-btn {
      padding: 6px 12px;
      font-size: 12px;
    }
    .messages {
      max-height: 400px;
      padding: 16px;
      gap: 12px;
      min-height: 200px;
    }
    .message {
      gap: 12px;
    }
    .message-avatar {
      width: 32px;
      height: 32px;
    }
    .message-content {
      padding: 12px 16px;
      font-size: 14px;
      line-height: 1.6;
    }
    .input-area {
      gap: 8px;
    }
    .input-area input {
      padding: 12px 16px;
      font-size: 14px;
    }
    .send-btn {
      padding: 12px 20px;
    }
    .disclaimer {
      font-size: 11px;
      padding: 8px;
    }
  }
`;
document.head.appendChild(chatStyles);

// 글로벌 인스턴스
window.PaperMindChat = PaperMindChat;
window.MedDigestChat = PaperMindChat;

console.log('PaperMind AI Chat (Groq) loaded');
