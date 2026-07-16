// ═══════════════════════════════════════════════════════════
//  i18n — Multi-language support for E.V.O.N. (FEAT-012)
// ═══════════════════════════════════════════════════════════

export type Locale = "en" | "es" | "fr" | "de" | "ja" | "zh" | "ko" | "pt" | "hi";

export interface LocaleMessages {
  // Common
  app_name: string;
  loading: string;
  error: string;
  cancel: string;
  save: string;
  delete: string;
  close: string;
  search: string;
  no_results: string;

  // Chat
  chat_new: string;
  chat_placeholder: string;
  chat_send: string;
  chat_voice: string;
  chat_text: string;
  chat_listening: string;
  chat_processing: string;
  chat_tap_to_speak: string;
  chat_tap_to_stop: string;
  chat_empty_title: string;
  chat_empty_desc: string;
  chat_empty_1: string;
  chat_empty_2: string;
  chat_empty_3: string;
  chat_empty_4: string;

  // Sidebar
  sidebar_conversations: string;
  sidebar_clear_all: string;
  sidebar_running_locally: string;

  // Voice
  voice_start: string;
  voice_stop: string;
  voice_recording: string;
  voice_error: string;

  // Settings
  settings_title: string;
  settings_theme: string;
  settings_theme_dark: string;
  settings_theme_light: string;
  settings_language: string;

  // Errors
  error_backend_offline: string;
  error_send_failed: string;
  error_voice_failed: string;
  error_image_upload: string;
}

const en: LocaleMessages = {
  app_name: "E.V.O.N.",
  loading: "Loading…",
  error: "Error",
  cancel: "Cancel",
  save: "Save",
  delete: "Delete",
  close: "Close",
  search: "Search",
  no_results: "No results found",

  chat_new: "New Conversation",
  chat_placeholder: "Message E.V.O.N. …",
  chat_send: "Send message",
  chat_voice: "Voice",
  chat_text: "Text",
  chat_listening: "Listening… tap to stop",
  chat_processing: "Processing your request…",
  chat_tap_to_speak: "Tap to speak",
  chat_tap_to_stop: "Tap to stop",
  chat_empty_title: "Hello, I'm E.V.O.N.",
  chat_empty_desc:
    "Your offline AI assistant. I can answer questions, explain code, open applications, and much more — all running locally on your machine.",
  chat_empty_1: "Ask me anything",
  chat_empty_2: "Open applications",
  chat_empty_3: "Explain code",
  chat_empty_4: "Talk to me",

  sidebar_conversations: "Conversations",
  sidebar_clear_all: "Clear all conversations",
  sidebar_running_locally: "Running locally",

  voice_start: "Start recording",
  voice_stop: "Stop recording",
  voice_recording: "Recording…",
  voice_error: "Voice error",

  settings_title: "Settings",
  settings_theme: "Theme",
  settings_theme_dark: "Dark",
  settings_theme_light: "Light",
  settings_language: "Language",

  error_backend_offline: "Backend is offline",
  error_send_failed: "Failed to send message",
  error_voice_failed: "Voice processing failed",
  error_image_upload: "Image upload failed",
};

const es: Partial<LocaleMessages> = {
  app_name: "E.V.O.N.",
  loading: "Cargando…",
  error: "Error",
  cancel: "Cancelar",
  save: "Guardar",
  delete: "Eliminar",
  close: "Cerrar",
  search: "Buscar",
  no_results: "No se encontraron resultados",
  chat_new: "Nueva conversación",
  chat_placeholder: "Escribe un mensaje…",
  chat_send: "Enviar mensaje",
  chat_voice: "Voz",
  chat_text: "Texto",
  chat_listening: "Escuchando… toca para parar",
  chat_processing: "Procesando tu solicitud…",
  chat_tap_to_speak: "Toca para hablar",
  chat_tap_to_stop: "Toca para parar",
  chat_empty_title: "Hola, soy E.V.O.N.",
  chat_empty_desc:
    "Tu asistente de IA sin conexión. Puedo responder preguntas, explicar código, abrir aplicaciones y mucho más — todo ejecutándose localmente.",
  chat_empty_1: "Pregúntame lo que sea",
  chat_empty_2: "Abrir aplicaciones",
  chat_empty_3: "Explicar código",
  chat_empty_4: "Habla conmigo",
  sidebar_conversations: "Conversaciones",
  sidebar_clear_all: "Borrar todas las conversaciones",
  sidebar_running_locally: "Ejecutando localmente",
  error_backend_offline: "El servidor está offline",
  error_send_failed: "Error al enviar mensaje",
  error_voice_failed: "Error en el procesamiento de voz",
  error_image_upload: "Error al subir imagen",
};

const fr: Partial<LocaleMessages> = {
  app_name: "E.V.O.N.",
  loading: "Chargement…",
  error: "Erreur",
  cancel: "Annuler",
  save: "Enregistrer",
  delete: "Supprimer",
  close: "Fermer",
  search: "Rechercher",
  no_results: "Aucun résultat trouvé",
  chat_new: "Nouvelle conversation",
  chat_placeholder: "Envoyer un message…",
  chat_send: "Envoyer le message",
  chat_voice: "Voix",
  chat_text: "Texte",
  chat_listening: "Écoute… appuyez pour arrêter",
  chat_processing: "Traitement de votre demande…",
  chat_tap_to_speak: "Appuyez pour parler",
  chat_tap_to_stop: "Appuyez pour arrêter",
  chat_empty_title: "Bonjour, je suis E.V.O.N.",
  chat_empty_desc:
    "Votre assistant IA hors ligne. Je peux répondre aux questions, expliquer le code, ouvrir des applications et bien plus — tout exécuté localement.",
  chat_empty_1: "Demandez-moi n'importe quoi",
  chat_empty_2: "Ouvrir des applications",
  chat_empty_3: "Expliquer le code",
  chat_empty_4: "Parlez-moi",
  sidebar_conversations: "Conversations",
  sidebar_clear_all: "Effacer toutes les conversations",
  sidebar_running_locally: "Exécuté localement",
  error_backend_offline: "Le serveur est hors ligne",
  error_send_failed: "Échec de l'envoi du message",
  error_voice_failed: "Échec du traitement vocal",
  error_image_upload: "Échec du téléchargement de l'image",
};

const de: Partial<LocaleMessages> = {
  app_name: "E.V.O.N.",
  loading: "Laden…",
  error: "Fehler",
  cancel: "Abbrechen",
  save: "Speichern",
  delete: "Löschen",
  close: "Schließen",
  search: "Suchen",
  no_results: "Keine Ergebnisse gefunden",
  chat_new: "Neues Gespräch",
  chat_placeholder: "Nachricht senden…",
  chat_send: "Nachricht senden",
  chat_voice: "Stimme",
  chat_text: "Text",
  chat_listening: "Höre zu… tippen zum Stoppen",
  chat_processing: "Verarbeitung Ihrer Anfrage…",
  chat_tap_to_speak: "Tippen zum Sprechen",
  chat_tap_to_stop: "Tippen zum Stoppen",
  chat_empty_title: "Hallo, ich bin E.V.O.N.",
  chat_empty_desc:
    "Ihr Offline-KI-Assistent. Ich kann Fragen beantworten, Code erklären, Anwendungen öffnen und vieles mehr — alles lokal.",
  chat_empty_1: "Fragen Sie mich alles",
  chat_empty_2: "Anwendungen öffnen",
  chat_empty_3: "Code erklären",
  chat_empty_4: "Sprechen Sie mit mir",
  sidebar_conversations: "Gespräche",
  sidebar_clear_all: "Alle Gespräche löschen",
  sidebar_running_locally: "Lokal ausgeführt",
  error_backend_offline: "Backend ist offline",
  error_send_failed: "Nachricht konnte nicht gesendet werden",
  error_voice_failed: "Sprachverarbeitung fehlgeschlagen",
  error_image_upload: "Bild-Upload fehlgeschlagen",
};

const ja: Partial<LocaleMessages> = {
  app_name: "E.V.O.N.",
  loading: "読み込み中…",
  error: "エラー",
  cancel: "キャンセル",
  save: "保存",
  delete: "削除",
  close: "閉じる",
  search: "検索",
  no_results: "結果が見つかりません",
  chat_new: "新しい会話",
  chat_placeholder: "メッセージを入力…",
  chat_send: "送信",
  chat_voice: "音声",
  chat_text: "テキスト",
  chat_listening: "聞きます…タップで停止",
  chat_processing: "リクエストを処理中…",
  chat_tap_to_speak: "タップして話す",
  chat_tap_to_stop: "タップして停止",
  chat_empty_title: "こんにちは、E.V.O.N.です",
  chat_empty_desc:
    "オフラインAIアシスタント。質問に答え、コードを説明し、アプリを開くなど、すべてローカルで実行されます。",
  chat_empty_1: "何でも聞いてください",
  chat_empty_2: "アプリを開く",
  chat_empty_3: "コードを説明",
  chat_empty_4: "話しかけてください",
  sidebar_conversations: "会話",
  sidebar_clear_all: "すべての会話を削除",
  sidebar_running_locally: "ローカル実行中",
  error_backend_offline: "バックエンドがオフラインです",
  error_send_failed: "送信に失敗しました",
  error_voice_failed: "音声処理に失敗しました",
  error_image_upload: "画像アップロードに失敗しました",
};

const zh: Partial<LocaleMessages> = {
  app_name: "E.V.O.N.",
  loading: "加载中…",
  error: "错误",
  cancel: "取消",
  save: "保存",
  delete: "删除",
  close: "关闭",
  search: "搜索",
  no_results: "未找到结果",
  chat_new: "新对话",
  chat_placeholder: "输入消息…",
  chat_send: "发送",
  chat_voice: "语音",
  chat_text: "文字",
  chat_listening: "正在聆听…点击停止",
  chat_processing: "正在处理请求…",
  chat_tap_to_speak: "点击说话",
  chat_tap_to_stop: "点击停止",
  chat_empty_title: "你好，我是 E.V.O.N.",
  chat_empty_desc: "你的离线AI助手。我可以回答问题、解释代码、打开应用程序等——全部在本地运行。",
  chat_empty_1: "随便问我",
  chat_empty_2: "打开应用",
  chat_empty_3: "解释代码",
  chat_empty_4: "和我聊天",
  sidebar_conversations: "对话",
  sidebar_clear_all: "清除所有对话",
  sidebar_running_locally: "本地运行中",
  error_backend_offline: "后端离线",
  error_send_failed: "发送失败",
  error_voice_failed: "语音处理失败",
  error_image_upload: "图片上传失败",
};

const ko: Partial<LocaleMessages> = {
  app_name: "E.V.O.N.",
  loading: "로딩 중…",
  error: "오류",
  cancel: "취소",
  save: "저장",
  delete: "삭제",
  close: "닫기",
  search: "검색",
  no_results: "결과를 찾을 수 없습니다",
  chat_new: "새 대화",
  chat_placeholder: "메시지 입력…",
  chat_send: "보내기",
  chat_voice: "음성",
  chat_text: "텍스트",
  chat_listening: "듣는 중… 탭하여 중지",
  chat_processing: "요청 처리 중…",
  chat_tap_to_speak: "탭하여 말하기",
  chat_tap_to_stop: "탭하여 중지",
  chat_empty_title: "안녕하세요, E.V.O.N.입니다",
  chat_empty_desc: "오프라인 AI 어시스턴트. 질문에 답하고, 코드를 설명하고, 앱을 열 수 있습니다.",
  chat_empty_1: "무엇이든 물어보세요",
  chat_empty_2: "앱 열기",
  chat_empty_3: "코드 설명",
  chat_empty_4: "이야기해요",
  sidebar_conversations: "대화",
  sidebar_clear_all: "모든 대화 삭제",
  sidebar_running_locally: "로컬 실행 중",
  error_backend_offline: "백엔드 오프라인",
  error_send_failed: "전송 실패",
  error_voice_failed: "음성 처리 실패",
  error_image_upload: "이미지 업로드 실패",
};

const pt: Partial<LocaleMessages> = {
  app_name: "E.V.O.N.",
  loading: "Carregando…",
  error: "Erro",
  cancel: "Cancelar",
  save: "Salvar",
  delete: "Excluir",
  close: "Fechar",
  search: "Pesquisar",
  no_results: "Nenhum resultado encontrado",
  chat_new: "Nova conversa",
  chat_placeholder: "Digite sua mensagem…",
  chat_send: "Enviar",
  chat_voice: "Voz",
  chat_text: "Texto",
  chat_listening: "Ouvvendo… toque para parar",
  chat_processing: "Processando sua solicitação…",
  chat_tap_to_speak: "Toque para falar",
  chat_tap_to_stop: "Toque para parar",
  chat_empty_title: "Olá, eu sou E.V.O.N.",
  chat_empty_desc: "Seu assistente de IA offline. Posso responder perguntas, explicar código, abrir aplicativos e muito mais.",
  chat_empty_1: "Pergunte qualquer coisa",
  chat_empty_2: "Abrir aplicativos",
  chat_empty_3: "Explicar código",
  chat_empty_4: "Fale comigo",
  sidebar_conversations: "Conversas",
  sidebar_clear_all: "Limpar todas as conversas",
  sidebar_running_locally: "Executando localmente",
  error_backend_offline: "Backend offline",
  error_send_failed: "Falha ao enviar mensagem",
  error_voice_failed: "Falha no processamento de voz",
  error_image_upload: "Falha no upload da imagem",
};

const hi: Partial<LocaleMessages> = {
  app_name: "E.V.O.N.",
  loading: "लोड हो रहा है…",
  error: "त्रुटि",
  cancel: "रद्द करें",
  save: "सहेजें",
  delete: "हटाएं",
  close: "बंद करें",
  search: "खोजें",
  no_results: "कोई परिणाम नहीं मिला",
  chat_new: "नई बातचीत",
  chat_placeholder: "संदेश लिखें…",
  chat_send: "भेजें",
  chat_voice: "आवाज़",
  chat_text: "पाठ",
  chat_listening: "सुन रहा हूँ… रोकने के लिए टैप करें",
  chat_processing: "अनुरोध संसाधित हो रहा है…",
  chat_tap_to_speak: "बोलने के लिए टैप करें",
  chat_tap_to_stop: "रोकने के लिए टैप करें",
  chat_empty_title: "नमस्ते, मैं E.V.O.N. हूँ",
  chat_empty_desc: "आपका ऑफ़लाइन AI सहायक। मैं सवालों के जवाब दे सकता हूँ, कोड समझा सकता हूँ, ऐप्स खोल सकता हूँ।",
  chat_empty_1: "कुछ भी पूछें",
  chat_empty_2: "ऐप्स खोलें",
  chat_empty_3: "कोड समझाएं",
  chat_empty_4: "मुझसे बात करें",
  sidebar_conversations: "बातचीत",
  sidebar_clear_all: "सभी बातचीत मिटाएं",
  sidebar_running_locally: "स्थानीय रूप से चल रहा है",
  error_backend_offline: "बैकएंड ऑफ़लाइन है",
  error_send_failed: "संदेश भेजने में विफल",
  error_voice_failed: "आवाज़ प्रसंस्करण विफल",
  error_image_upload: "छवि अपलोड विफल",
};

// ── Merge helper ───────────────────────────────────────
function merge(base: LocaleMessages, partial: Partial<LocaleMessages>): LocaleMessages {
  return { ...base, ...partial } as LocaleMessages;
}

// ── All locales ────────────────────────────────────────
export const locales: Record<Locale, LocaleMessages> = {
  en,
  es: merge(en, es),
  fr: merge(en, fr),
  de: merge(en, de),
  ja: merge(en, ja),
  zh: merge(en, zh),
  ko: merge(en, ko),
  pt: merge(en, pt),
  hi: merge(en, hi),
};

export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  ja: "日本語",
  zh: "中文",
  ko: "한국어",
  pt: "Português",
  hi: "हिन्दी",
};
