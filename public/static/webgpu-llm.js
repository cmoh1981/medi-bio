/**
 * MedDigest WebGPU LLM Module
 * Transformers.js v4 기반 브라우저 내 LLM 추론 시스템
 * 
 * 지원 모델: SmolLM2-360M-Instruct (의료 문헌 분석용)
 * 백업 모델: SmolLM2-135M-Instruct (초경량 버전)
 */

// CDN에서 Transformers.js 로드
const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@latest';

// 모델 설정 (브라우저 메모리 제약을 고려한 경량 모델)
const MODEL_CONFIG = {
  primary: {
    id: 'HuggingFaceTB/SmolLM2-360M-Instruct',
    name: 'SmolLM2-360M',
    description: '의료 문헌 분석용 (360M 파라미터)',
    size: '~200MB',
    minVRAM: 512
  },
  fallback: {
    id: 'HuggingFaceTB/SmolLM2-135M-Instruct',
    name: 'SmolLM2-135M',
    description: '초경량 버전 (135M 파라미터)',
    size: '~80MB',
    minVRAM: 256
  }
};

// 의료 문헌 분석용 시스템 프롬프트
const MEDICAL_SYSTEM_PROMPT = `You are a medical research assistant specializing in analyzing academic papers for clinical relevance. 
Your responses should be:
1. Evidence-based and cite specific study findings
2. Clinically actionable for practicing physicians
3. Concise but comprehensive
4. Written in Korean when the user asks in Korean

Focus on: efficacy data, safety signals, clinical implications, and study limitations.`;

class MedDigestLLM {
  constructor() {
    this.pipeline = null;
    this.tokenizer = null;
    this.model = null;
    this.isLoading = false;
    this.isReady = false;
    this.currentModel = null;
    this.device = 'webgpu';
    this.transformers = null;
    this.loadProgress = 0;
    this.callbacks = {
      onProgress: null,
      onReady: null,
      onError: null,
      onToken: null
    };
  }

  /**
   * WebGPU 지원 여부 확인
   */
  async checkWebGPUSupport() {
    if (!navigator.gpu) {
      console.warn('WebGPU not supported, falling back to WASM');
      return false;
    }
    
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.warn('No WebGPU adapter found');
        return false;
      }
      
      const device = await adapter.requestDevice();
      const info = await adapter.requestAdapterInfo();
      
      console.log('WebGPU Device:', info);
      return true;
    } catch (e) {
      console.error('WebGPU check failed:', e);
      return false;
    }
  }

  /**
   * Transformers.js 동적 로드
   */
  async loadTransformers() {
    if (this.transformers) return this.transformers;
    
    // ES Module 동적 import
    try {
      this.transformers = await import(TRANSFORMERS_CDN);
      console.log('Transformers.js loaded:', this.transformers);
      return this.transformers;
    } catch (e) {
      console.error('Failed to load Transformers.js:', e);
      throw new Error('Transformers.js 로드 실패');
    }
  }

  /**
   * 모델 초기화
   * @param {string} preferredModel - 'primary' 또는 'fallback'
   */
  async initialize(preferredModel = 'primary') {
    if (this.isLoading) {
      console.log('Model is already loading...');
      return;
    }
    
    if (this.isReady && this.currentModel === preferredModel) {
      console.log('Model already loaded:', this.currentModel);
      return;
    }
    
    this.isLoading = true;
    this.isReady = false;
    this.loadProgress = 0;
    
    try {
      // 1. WebGPU 지원 확인
      const hasWebGPU = await this.checkWebGPUSupport();
      this.device = hasWebGPU ? 'webgpu' : 'wasm';
      
      this._updateProgress(5, `${this.device.toUpperCase()} 모드로 실행`);
      
      // 2. Transformers.js 로드
      this._updateProgress(10, 'Transformers.js 로딩 중...');
      await this.loadTransformers();
      
      // 3. 모델 선택
      const modelConfig = MODEL_CONFIG[preferredModel] || MODEL_CONFIG.fallback;
      this._updateProgress(15, `${modelConfig.name} 모델 준비 중...`);
      
      // 4. Pipeline 생성 with progress callback
      const { pipeline, env } = this.transformers;
      
      // 캐시 설정
      env.cacheDir = './.cache';
      env.allowRemoteModels = true;
      env.allowLocalModels = false;
      
      this._updateProgress(20, '모델 다운로드 중...');

      // Track per-file progress for accurate overall %
      const fileProgress = {};
      let totalFiles = 0;

      this.pipeline = await pipeline('text-generation', modelConfig.id, {
        device: this.device,
        dtype: this.device === 'webgpu' ? 'q4f16' : 'q4',
        progress_callback: (event) => {
          if (event.status === 'initiate') {
            // New file starting to download
            totalFiles++;
            fileProgress[event.file] = 0;
            this._updateProgress(20, `파일 준비 중... (${event.file})`);
          } else if (event.status === 'progress') {
            // File download progress (event.progress = 0~100 per file)
            fileProgress[event.file] = event.progress || 0;
            const avgProgress = Object.values(fileProgress).reduce((a, b) => a + b, 0) / Math.max(totalFiles, 1);
            const percent = Math.round(20 + (avgProgress / 100) * 60);
            const mbLoaded = event.loaded ? Math.round(event.loaded / 1024 / 1024) : 0;
            const mbTotal = event.total ? Math.round(event.total / 1024 / 1024) : 0;
            const mbText = mbTotal > 0 ? `${mbLoaded}/${mbTotal}MB` : `${mbLoaded}MB`;
            this._updateProgress(percent, `다운로드 중... ${Math.round(avgProgress)}% (${mbText})`);
          } else if (event.status === 'done') {
            // File finished
            fileProgress[event.file] = 100;
            const avgProgress = Object.values(fileProgress).reduce((a, b) => a + b, 0) / Math.max(totalFiles, 1);
            const percent = Math.round(20 + (avgProgress / 100) * 60);
            this._updateProgress(percent, `다운로드 완료: ${event.file}`);
          } else if (event.status === 'ready') {
            this._updateProgress(85, '모델 초기화 중...');
          }
        }
      });
      
      this._updateProgress(95, '초기화 완료');
      
      this.currentModel = preferredModel;
      this.isReady = true;
      this.isLoading = false;
      
      this._updateProgress(100, `${modelConfig.name} 준비 완료!`);
      
      if (this.callbacks.onReady) {
        this.callbacks.onReady({
          model: modelConfig.name,
          device: this.device,
          dtype: this.device === 'webgpu' ? 'q4f16' : 'q4'
        });
      }
      
      console.log('Model ready:', modelConfig.name, 'on', this.device);
      
    } catch (error) {
      this.isLoading = false;
      this.isReady = false;

      // Detect memory-related errors and provide friendly message
      let err;
      if (typeof error === 'number' || (typeof error === 'string' && /^\d+$/.test(error))) {
        const bytes = Number(error);
        const mb = Math.round(bytes / 1024 / 1024);
        err = new Error(`메모리 부족 (${mb}MB 필요). 브라우저 탭을 닫고 다시 시도하세요.`);
      } else if (error instanceof Error) {
        err = error;
      } else {
        err = new Error(String(error || 'Unknown error'));
      }
      console.error('Model initialization failed:', err);

      // Fallback 시도
      if (preferredModel === 'primary') {
        console.log('Trying fallback model...');
        try {
          return await this.initialize('fallback');
        } catch (fallbackError) {
          const fbErr = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError || 'Unknown error'));
          if (this.callbacks.onError) {
            this.callbacks.onError(fbErr);
          }
          throw fbErr;
        }
      }

      if (this.callbacks.onError) {
        this.callbacks.onError(err);
      }
      throw err;
    }
  }

  /**
   * 진행률 업데이트
   */
  _updateProgress(percent, message) {
    this.loadProgress = percent;
    if (this.callbacks.onProgress) {
      this.callbacks.onProgress({ percent, message });
    }
    console.log(`[${percent}%] ${message}`);
  }

  /**
   * 텍스트 생성
   * @param {string} userMessage - 사용자 질문
   * @param {object} context - 논문 컨텍스트
   * @param {object} options - 생성 옵션
   */
  async generate(userMessage, context = {}, options = {}) {
    if (!this.isReady) {
      throw new Error('모델이 준비되지 않았습니다. initialize()를 먼저 호출하세요.');
    }

    const {
      maxNewTokens = 256,
      temperature = 0.7,
      topP = 0.95,
      doSample = true,
      stream = false
    } = options;

    // 컨텍스트를 포함한 사용자 메시지 구성
    let userContent = '';
    if (context.title) {
      userContent += `논문 정보:\n`;
      userContent += `제목: ${context.title}\n`;
      if (context.journal) userContent += `저널: ${context.journal}\n`;
      if (context.keyMessages) userContent += `핵심 메시지:\n${context.keyMessages.map((m, i) => `${i+1}. ${m}`).join('\n')}\n`;
      if (context.clinicalInsight) userContent += `임상 관점: ${context.clinicalInsight}\n`;
      userContent += '\n';
    }
    userContent += userMessage;

    // Chat messages 형식으로 구성 (SmolLM2 등 chat 모델용)
    const messages = [
      { role: 'system', content: MEDICAL_SYSTEM_PROMPT },
      { role: 'user', content: userContent }
    ];

    console.log('Generating response for:', userMessage.substring(0, 50) + '...');

    try {
      const output = await this.pipeline(messages, {
        max_new_tokens: maxNewTokens,
        temperature: temperature,
        top_p: topP,
        do_sample: doSample
      });

      // pipeline returns array; last message is the assistant response
      const generated = output[0].generated_text;
      let response;
      if (Array.isArray(generated)) {
        // Chat format: [{role, content}, ...] - get last assistant message
        const lastMsg = generated[generated.length - 1];
        response = (lastMsg && lastMsg.content) ? lastMsg.content.trim() : String(lastMsg).trim();
      } else {
        // Raw text fallback
        response = String(generated).trim();
      }

      // Stream tokens to UI if callback is set
      if (stream && this.callbacks.onToken && response) {
        // Simulate streaming by sending chunks
        const words = response.split(' ');
        for (const word of words) {
          this.callbacks.onToken(word + ' ');
          await new Promise(r => setTimeout(r, 30));
        }
      }

      console.log('Generated response:', response.substring(0, 100) + '...');
      return response;
    } catch (error) {
      console.error('Generation failed:', error);
      throw error;
    }
  }

  /**
   * 의료 논문 요약 특화 메서드
   */
  async summarizePaper(paperContent, options = {}) {
    const prompt = `다음 의료 논문 내용을 3줄로 요약해주세요. 임상적 중요성을 강조해주세요:\n\n${paperContent}`;
    return this.generate(prompt, {}, { maxNewTokens: 200, ...options });
  }

  /**
   * 논문 Q&A 특화 메서드
   */
  async askAboutPaper(question, paperContext) {
    return this.generate(question, paperContext, { maxNewTokens: 300, temperature: 0.5 });
  }

  /**
   * 콜백 설정
   */
  on(event, callback) {
    if (this.callbacks.hasOwnProperty(event)) {
      this.callbacks[event] = callback;
    }
    return this;
  }

  /**
   * 모델 언로드
   */
  async dispose() {
    if (this.pipeline) {
      // Transformers.js의 dispose 메서드 호출
      if (this.pipeline.dispose) {
        await this.pipeline.dispose();
      }
      this.pipeline = null;
    }
    this.isReady = false;
    this.currentModel = null;
    console.log('Model disposed');
  }

  /**
   * 현재 상태 조회
   */
  getStatus() {
    return {
      isLoading: this.isLoading,
      isReady: this.isReady,
      currentModel: this.currentModel,
      device: this.device,
      loadProgress: this.loadProgress
    };
  }
}

// 글로벌 인스턴스 생성
window.MedDigestLLM = MedDigestLLM;
window.medLLM = new MedDigestLLM();

// TextStreamer 클래스 (스트리밍용)
class TextStreamer {
  constructor(tokenizer, options = {}) {
    this.tokenizer = tokenizer;
    this.skipPrompt = options.skip_prompt || false;
    this.callback = options.callback_function || null;
    this.decodeArgs = options.decode_args || {};
    this.printedText = '';
  }

  put(value) {
    if (!this.callback) return;
    
    const text = this.tokenizer.decode(value, {
      skip_special_tokens: true,
      ...this.decodeArgs
    });
    
    const newText = text.slice(this.printedText.length);
    if (newText) {
      this.callback(newText);
      this.printedText = text;
    }
  }

  end() {
    // 스트림 종료
  }
}

console.log('MedDigest WebGPU LLM Module loaded');
