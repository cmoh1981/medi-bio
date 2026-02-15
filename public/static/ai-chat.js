/**
 * MedDigest AI Chat UI Component
 * WebGPU LLM과 연동되는 인터랙티브 채팅 UI
 */

class MedDigestChat {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.llm = window.medLLM;
    this.currentArticle = null;
    this.messages = [];
    this.isModelLoading = false;
    this.isGenerating = false;
    
    // 초기화
    this.setupLLMCallbacks();
  }

  /**
   * LLM 콜백 설정
   */
  setupLLMCallbacks() {
    this.llm
      .on('onProgress', ({ percent, message }) => {
        this.updateLoadingProgress(percent, message);
      })
      .on('onReady', (info) => {
        this.onModelReady(info);
      })
      .on('onError', (error) => {
        this.onModelError(error);
      })
      .on('onToken', (token) => {
        this.appendToken(token);
      });
  }

  /**
   * UI 렌더링
   */
  render(article = null) {
    this.currentArticle = article;
    
    this.container.innerHTML = `
      <div class="ai-chat-container">
        <!-- 모델 상태 표시 -->
        <div id="model-status" class="model-status">
          <div class="status-icon">
            <i class="fas fa-robot text-purple-500"></i>
          </div>
          <div class="status-content">
            <div class="status-title">AI 분석 준비</div>
            <div class="status-message">WebGPU 기반 로컬 AI가 이 논문을 분석해 드립니다. 첫 실행 시 모델 다운로드에 2~5분이 소요됩니다.</div>
          </div>
          <button id="init-model-btn" onclick="window.medChat.initializeModel()" class="init-btn">
            <i class="fas fa-play mr-2"></i>AI 시작
          </button>
        </div>
        
        <!-- 로딩 프로그레스 -->
        <div id="loading-progress" class="loading-progress hidden">
          <div class="progress-bar">
            <div id="progress-fill" class="progress-fill" style="width: 0%"></div>
          </div>
          <div id="progress-text" class="progress-text">준비 중...</div>
          <div class="loading-tips">
            <i class="fas fa-info-circle text-blue-400 mr-1"></i>
            첫 로딩 시 AI 모델 다운로드(약 300~500MB)로 2~5분이 소요됩니다. 진행률(%)이 실시간 표시됩니다. 이후에는 캐시되어 빠르게 로드됩니다.
          </div>
        </div>
        
        <!-- 채팅 영역 -->
        <div id="chat-area" class="chat-area hidden">
          <!-- 빠른 질문 버튼 -->
          <div class="quick-questions">
            <span class="quick-label">빠른 질문:</span>
            <button onclick="window.medChat.askQuick('이 연구의 주요 한계점은 무엇인가요?')" class="quick-btn">한계점</button>
            <button onclick="window.medChat.askQuick('NNT(Number Needed to Treat)가 어떻게 되나요?')" class="quick-btn">NNT</button>
            <button onclick="window.medChat.askQuick('실제 임상에서 어떻게 적용할 수 있나요?')" class="quick-btn">임상 적용</button>
            <button onclick="window.medChat.askQuick('비슷한 다른 연구와 비교하면 어떤가요?')" class="quick-btn">비교 분석</button>
          </div>
          
          <!-- 메시지 목록 -->
          <div id="messages" class="messages"></div>
          
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
        
        <!-- WebGPU 미지원 안내 -->
        <div id="webgpu-unsupported" class="webgpu-unsupported hidden">
          <i class="fas fa-exclamation-circle text-4xl text-red-400 mb-4"></i>
          <h4 class="text-lg font-bold mb-2">WebGPU를 지원하지 않는 브라우저입니다</h4>
          <p class="text-gray-600 mb-4">AI 분석 기능을 사용하려면 다음 브라우저를 사용해 주세요:</p>
          <ul class="text-sm text-gray-500 space-y-2">
            <li><i class="fab fa-chrome text-yellow-500 mr-2"></i>Chrome 113+ (권장)</li>
            <li><i class="fab fa-edge text-blue-500 mr-2"></i>Edge 113+</li>
            <li><i class="fab fa-opera text-red-500 mr-2"></i>Opera 99+</li>
          </ul>
        </div>
      </div>
    `;
  }

  /**
   * 모델 초기화
   */
  async initializeModel() {
    if (this.isModelLoading) return;
    
    // WebGPU 지원 확인
    if (!navigator.gpu) {
      document.getElementById('model-status').classList.add('hidden');
      document.getElementById('webgpu-unsupported').classList.remove('hidden');
      return;
    }
    
    this.isModelLoading = true;
    
    // UI 전환
    document.getElementById('model-status').classList.add('hidden');
    document.getElementById('loading-progress').classList.remove('hidden');
    
    try {
      await this.llm.initialize('primary');
    } catch (error) {
      console.error('Model init error:', error);
      this.onModelError(error);
    }
  }

  /**
   * 로딩 프로그레스 업데이트
   */
  updateLoadingProgress(percent, message) {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    if (progressFill) {
      progressFill.style.width = `${percent}%`;
    }
    if (progressText) {
      progressText.textContent = `${Math.round(percent)}% — ${message}`;
    }
  }

  /**
   * 모델 준비 완료
   */
  onModelReady(info) {
    this.isModelLoading = false;
    
    // UI 전환
    document.getElementById('loading-progress').classList.add('hidden');
    document.getElementById('chat-area').classList.remove('hidden');
    
    // 환영 메시지
    this.addMessage('assistant', `안녕하세요! ${info.model} 모델이 ${info.device.toUpperCase()} 모드로 준비되었습니다. 이 논문에 대해 궁금한 점을 물어보세요. 🔬`);
  }

  /**
   * 모델 에러 처리
   */
  onModelError(error) {
    this.isModelLoading = false;
    
    const progressText = document.getElementById('progress-text');
    if (progressText) {
      progressText.innerHTML = `<span class="text-red-500"><i class="fas fa-exclamation-circle mr-1"></i>모델 로딩 실패: ${error.message}</span>`;
    }
    
    // 재시도 버튼 추가
    const loadingProgress = document.getElementById('loading-progress');
    if (loadingProgress) {
      loadingProgress.innerHTML += `
        <button onclick="window.medChat.initializeModel()" class="retry-btn mt-4">
          <i class="fas fa-redo mr-2"></i>다시 시도
        </button>
      `;
    }
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
        <div class="message-content">
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
   * 스트리밍 응답용 빈 메시지 추가
   */
  addStreamingMessage() {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;
    
    const messageId = `msg-${Date.now()}`;
    
    const messageHtml = `
      <div id="${messageId}" class="message message-assistant">
        <div class="message-avatar">
          <i class="fas fa-robot"></i>
        </div>
        <div class="message-content" id="${messageId}-content">
          <span class="typing-indicator"><i class="fas fa-spinner fa-spin"></i></span>
        </div>
      </div>
    `;
    
    messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    this.currentStreamingMessageId = messageId;
    this.currentStreamingContent = '';
    
    return messageId;
  }

  /**
   * 스트리밍 토큰 추가
   */
  appendToken(token) {
    if (!this.currentStreamingMessageId) return;
    
    const contentElement = document.getElementById(`${this.currentStreamingMessageId}-content`);
    if (!contentElement) return;
    
    this.currentStreamingContent += token;
    contentElement.innerHTML = this.formatContent(this.currentStreamingContent);
    
    const messagesContainer = document.getElementById('messages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
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
    
    if (!this.llm.isReady) {
      this.addMessage('assistant', '먼저 AI 모델을 시작해 주세요.');
      return;
    }
    
    // 입력 초기화
    if (input) input.value = '';
    
    // 사용자 메시지 추가
    this.addMessage('user', message);
    
    // 생성 시작
    this.isGenerating = true;
    this.setInputEnabled(false);
    
    // 스트리밍 메시지 컨테이너 추가
    this.addStreamingMessage();
    
    try {
      // 논문 컨텍스트 구성
      const context = this.currentArticle ? {
        title: this.currentArticle.title,
        journal: this.currentArticle.journal,
        keyMessages: this.currentArticle.key_messages,
        clinicalInsight: this.currentArticle.clinical_insight,
        studyN: this.currentArticle.study_n,
        studyEndpoint: this.currentArticle.study_endpoint,
        studyLimitations: this.currentArticle.study_limitations
      } : {};
      
      // 응답 생성 (스트리밍)
      const response = await this.llm.generate(message, context, {
        maxNewTokens: 300,
        temperature: 0.7,
        stream: true
      });
      
      // 최종 메시지 저장
      this.messages.push({
        id: this.currentStreamingMessageId,
        role: 'assistant',
        content: this.currentStreamingContent
      });
      
    } catch (error) {
      console.error('Generation error:', error);
      
      // 에러 메시지로 교체
      const contentElement = document.getElementById(`${this.currentStreamingMessageId}-content`);
      if (contentElement) {
        contentElement.innerHTML = `<span class="text-red-500"><i class="fas fa-exclamation-circle mr-1"></i>응답 생성 실패: ${error.message}</span>`;
      }
    } finally {
      this.isGenerating = false;
      this.setInputEnabled(true);
      this.currentStreamingMessageId = null;
      this.currentStreamingContent = '';
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
    
    if (this.llm.isReady) {
      this.addMessage('assistant', `"${article.title}" 논문에 대해 질문해 주세요!`);
    }
  }

  /**
   * 채팅 초기화
   */
  clearChat() {
    this.messages = [];
    const messagesContainer = document.getElementById('messages');
    if (messagesContainer) {
      messagesContainer.innerHTML = '';
    }
  }
}

// 스타일 추가
const chatStyles = document.createElement('style');
chatStyles.textContent = `
  .ai-chat-container {
    background: #f8f9fa;
    border-radius: 12px;
    padding: 16px;
  }
  
  .model-status {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
    border-radius: 12px;
  }
  
  .status-icon {
    width: 48px;
    height: 48px;
    background: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
  }
  
  .status-content {
    flex: 1;
  }
  
  .status-title {
    font-weight: 700;
    color: #7c3aed;
    margin-bottom: 4px;
  }
  
  .status-message {
    font-size: 14px;
    color: #6b7280;
  }
  
  .init-btn {
    padding: 10px 20px;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .init-btn:hover {
    background: #6d28d9;
  }
  
  .loading-progress {
    text-align: center;
    padding: 32px;
  }
  
  .progress-bar {
    width: 100%;
    height: 8px;
    background: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 12px;
  }
  
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #7c3aed, #a855f7);
    transition: width 0.3s;
  }
  
  .progress-text {
    color: #6b7280;
    font-size: 14px;
    margin-bottom: 16px;
  }
  
  .loading-tips {
    font-size: 12px;
    color: #9ca3af;
    background: #f3f4f6;
    padding: 12px;
    border-radius: 8px;
  }
  
  .chat-area {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .quick-questions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 8px 0;
  }
  
  .quick-label {
    font-size: 12px;
    color: #6b7280;
  }
  
  .quick-btn {
    padding: 6px 12px;
    background: #e9d5ff;
    color: #7c3aed;
    border: none;
    border-radius: 16px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .quick-btn:hover {
    background: #7c3aed;
    color: white;
  }
  
  .messages {
    max-height: 400px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: white;
    border-radius: 12px;
    min-height: 200px;
  }
  
  .message {
    display: flex;
    gap: 12px;
    max-width: 90%;
  }
  
  .message-user {
    margin-left: auto;
    flex-direction: row-reverse;
  }
  
  .message-avatar {
    width: 32px;
    height: 32px;
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
    padding: 12px 16px;
    border-radius: 12px;
    line-height: 1.5;
    font-size: 14px;
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
    gap: 8px;
  }
  
  .input-area input {
    flex: 1;
    padding: 12px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    font-size: 14px;
    transition: border-color 0.2s;
  }
  
  .input-area input:focus {
    outline: none;
    border-color: #7c3aed;
  }
  
  .input-area input:disabled {
    background: #f3f4f6;
  }
  
  .send-btn {
    padding: 12px 20px;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .send-btn:hover:not(:disabled) {
    background: #6d28d9;
  }
  
  .send-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }
  
  .disclaimer {
    font-size: 11px;
    color: #9ca3af;
    text-align: center;
    padding: 8px;
    background: #fffbeb;
    border-radius: 8px;
  }
  
  .webgpu-unsupported {
    text-align: center;
    padding: 32px;
    background: #fee2e2;
    border-radius: 12px;
  }
  
  .retry-btn {
    padding: 10px 20px;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }
  
  .retry-btn:hover {
    background: #dc2626;
  }
  
  .hidden {
    display: none !important;
  }
`;
document.head.appendChild(chatStyles);

// 글로벌 인스턴스
window.MedDigestChat = MedDigestChat;

console.log('MedDigest AI Chat UI loaded');
