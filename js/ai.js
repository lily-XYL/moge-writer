/* ============ 墨阁 · AI 辅助写作（本地自定义 API） ============ */
(function () {
  const U = window.Util;
  const DB = window.DB;
  const TASKS = {
    continue: { label: '续写正文', prompt: '在保持当前叙事视角、人物语气与情节连贯的前提下，续写 180 至 320 字正文。只返回可直接插入小说的正文，不解释。' },
    outline: { label: '扩展细纲', prompt: '将当前章节细纲扩展为 4 至 6 条可执行的情节要点，包含冲突、推进和结尾钩子。只返回条目。' },
    polish: { label: '润色选段', prompt: '润色当前选中的正文，使语言更生动自然，保持事实、人物称呼、叙事人称和情节不变。只返回润色后的正文。' },
    dialogue: { label: '生成对白', prompt: '根据本章上下文生成一段自然、有张力的角色对白，约 120 至 220 字。只返回对白和必要动作描写。' }
  };
  const DEFAULT_CONFIG = { provider: 'custom', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', temperature: 0.8 };
  const DEFAULT_CONTEXT_OPTIONS = { previousChapter: false, nextChapter: false, bookOutline: false, worldSetting: false };
  const CONTEXT_LABELS = { previousChapter: '上一章', nextChapter: '下一章', bookOutline: '全书大纲', worldSetting: '作品设定' };

  function currentConfig() {
    const saved = (window.App && App.settings && App.settings.aiConfig) || {};
    return Object.assign({}, DEFAULT_CONFIG, saved, { provider: 'custom' });
  }
  function currentContextOptions() {
    const saved = (window.App && App.settings && App.settings.aiContextOptions) || {};
    return Object.assign({}, DEFAULT_CONTEXT_OPTIONS, saved);
  }
  function isOpen() { return !window.App || !App.settings || App.settings.aiSidebarOpen !== false; }
  function clip(text, max) {
    text = String(text || '').trim();
    if (!text || text.length <= max) return text;
    return text.slice(0, max) + '…';
  }
  function tail(text, max) {
    text = String(text || '').trim();
    if (!text || text.length <= max) return text;
    return '…' + text.slice(-max);
  }
  function selectedText() {
    const ta = U.$('#editor-textarea');
    if (!ta) return '';
    const start = typeof ta.selectionStart === 'number' ? ta.selectionStart : 0;
    const end = typeof ta.selectionEnd === 'number' ? ta.selectionEnd : start;
    return ta.value.slice(start, end).trim();
  }
  function currentChapterRecord() {
    const id = App && App.state ? App.state.chapterId : '';
    return ((App && App.data && App.data.chapters) || []).find(ch => ch.id === id) || null;
  }
  function chapterContext() {
    const current = currentChapterRecord() || {};
    const title = (U.$('#editor-title-input') || {}).value || current.title || '';
    const outline = (U.$('#editor-outline') || {}).value || current.outline || '';
    const notes = (U.$('#editor-notes') || {}).value || current.notes || '';
    const text = (U.$('#editor-textarea') || {}).value || current.content || '';
    return { title: title, outline: outline, notes: notes, selected: selectedText(), bodyTail: tail(text, 5000), id: current.id || '' };
  }
  function orderedChapters() {
    if (App && typeof App.getOrderedChapters === 'function') return App.getOrderedChapters();
    return ((App && App.data && App.data.chapters) || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
  }
  function chapterReference(ch, direction) {
    if (!ch) return '';
    const title = ch.title || '无题章节';
    const meta = [ch.outline ? '细纲：' + clip(ch.outline, 700) : '', ch.notes ? '备注：' + clip(ch.notes, 500) : ''].filter(Boolean).join('\n');
    const body = direction === 'previous' ? tail(ch.content, 2600) : clip(ch.content, 2600);
    return '【' + (direction === 'previous' ? '上一章' : '下一章') + '：' + title + '】' +
      (meta ? '\n' + meta : '') + (body ? '\n正文摘录：\n' + body : '');
  }
  function joinLimited(parts, max) {
    let used = 0;
    const selected = [];
    (parts || []).forEach(part => {
      if (!part || used >= max) return;
      const allowed = max - used;
      const out = clip(part, allowed);
      if (!out) return;
      selected.push(out);
      used += out.length + 2;
    });
    return selected.join('\n\n');
  }
  function bookOutlineReference() {
    const docs = ((App && App.data && App.data.outlines) || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
    return joinLimited(docs.map(doc => {
      const title = doc.title || doc.name || '大纲文档';
      return doc.content ? '【' + title + '】\n' + doc.content : '';
    }), 5000);
  }
  function worldSettingReference() {
    const characters = ((App && App.data && App.data.characters) || []).map(c => {
      const facts = [c.alias ? '别名：' + c.alias : '', c.role ? '身份：' + c.role : '', c.gender ? '性别：' + c.gender : '', c.age ? '年龄：' + c.age : '', c.personality ? '性格：' + c.personality : '', c.background ? '背景：' + c.background : '', c.appearance ? '外貌：' + c.appearance : '', c.tags ? '标签：' + c.tags : ''].filter(Boolean).join('；');
      return facts ? '【人物：' + (c.name || '未命名') + '】' + facts : '';
    });
    const entries = ((App && App.data && App.data.entries) || []).map(e => e.content ? '【设定：' + (e.name || '未命名') + '】' + e.content : '');
    const foreshadows = ((App && App.data && App.data.foreshadows) || []).map(f => {
      const meta = [f.status === 'paid' ? '已回收' : '未回收', f.setupAt ? '埋设：' + f.setupAt : '', f.payoffAt ? '回收：' + f.payoffAt : '', f.note || ''].filter(Boolean).join('；');
      return f.content ? '【伏笔】' + f.content + (meta ? '（' + meta + '）' : '') : '';
    });
    return joinLimited(characters.concat(entries, foreshadows), 6000);
  }
  function optionalContext(context, options) {
    const chapters = orderedChapters();
    const at = chapters.findIndex(ch => ch.id === context.id);
    const segments = [];
    if (options.previousChapter && at > 0) {
      const value = chapterReference(chapters[at - 1], 'previous');
      if (value) segments.push(value);
    }
    if (options.nextChapter && at >= 0 && at < chapters.length - 1) {
      const value = chapterReference(chapters[at + 1], 'next');
      if (value) segments.push(value);
    }
    if (options.bookOutline) {
      const value = bookOutlineReference();
      if (value) segments.push('【全书大纲】\n' + value);
    }
    if (options.worldSetting) {
      const value = worldSettingReference();
      if (value) segments.push('【作品设定（人物、世界设定与伏笔）】\n' + value);
    }
    return segments;
  }
  function enabledContextNames(options) {
    const names = Object.keys(CONTEXT_LABELS).filter(key => options[key]).map(key => CONTEXT_LABELS[key]);
    return names.length ? names.join('、') : '无额外引用';
  }
  function contextControlsHtml() {
    const options = currentContextOptions();
    const checks = [
      ['previousChapter', '引用上一章', '发送上一章末尾摘录、细纲和备注'],
      ['nextChapter', '引用下一章', '发送下一章开头摘录、细纲和备注'],
      ['bookOutline', '引用全书大纲', '发送大纲文档，最多约 5,000 字符'],
      ['worldSetting', '引用作品设定', '发送人物、世界设定与伏笔，最多约 6,000 字符']
    ].map(item => '<label class="ai-context-check" title="' + U.escapeHtml(item[2]) + '"><input type="checkbox" data-action="aiContextToggle" data-key="' + item[0] + '"' + (options[item[0]] ? ' checked' : '') + '><span>' + item[1] + '</span></label>').join('');
    return '<details class="ai-context-panel"><summary>上下文引用（可选）</summary>' +
      '<div class="hint">仅发送你勾选的内容；为控制请求大小，章节和设定会自动截取摘要。</div>' +
      '<div class="ai-context-options">' + checks + '</div>' +
      '<div class="ai-context-summary" id="ai-context-summary">本次额外发送：' + U.escapeHtml(enabledContextNames(options)) + '</div>' +
      '</details>';
  }
  function panelHtml() {
    const selected = selectedText();
    return '<div class="ai-assist-panel" id="ai-assist-panel">' +
      '<div class="ai-assist-head"><div><b>✨ AI 辅助写作</b><div class="hint">自定义兼容 API</div></div>' +
      '<span class="topbar-spacer"></span><button class="btn small" data-action="aiOpenConfig">配置 API</button><button class="modal-close" data-action="aiHideSidebar" title="隐藏 AI 侧栏">✕</button></div>' +
      '<div class="ai-task-grid">' + Object.keys(TASKS).map(key =>
        '<button class="btn small" data-action="aiTask" data-task="' + key + '">' + U.escapeHtml(TASKS[key].label) + '</button>'
      ).join('') + '</div>' +
      contextControlsHtml() +
      '<textarea id="ai-extra-prompt" class="ai-extra-prompt" rows="3" placeholder="补充要求（可选），例如：氛围偏克制、采用第三人称"></textarea>' +
      '<button class="btn primary ai-generate" data-action="aiGenerate" data-task="continue">生成写作建议</button>' +
      (selected ? '<div class="hint ai-selection-note">已检测到 ' + selected.length + ' 字选中文本；选择“润色选段”可直接处理。</div>' : '') +
      '<div class="ai-result" id="ai-result"><div class="hint">配置 API 后，可在此生成续写、细纲、润色或对白建议。</div></div>' +
      '</div>';
  }
  function sidebarHtml() {
    return '<aside class="ai-sidebar' + (isOpen() ? '' : ' hidden') + '" id="ai-sidebar">' + panelHtml() + '</aside>';
  }
  function renderResult(text, meta) {
    const box = U.$('#ai-result');
    if (!box) return;
    const safe = U.escapeHtml(text || '').replace(/\n/g, '<br>');
    box.innerHTML = '<div class="ai-result-text">' + safe + '</div>' +
      '<div class="ai-result-actions"><span class="hint">' + U.escapeHtml((meta && meta.model) || '') + '</span><span class="topbar-spacer"></span>' +
      '<button class="btn small" data-action="aiCopyResult">复制</button>' +
      '<button class="btn small primary" data-action="aiInsertResult">插入正文</button></div>';
  }
  function configFormHtml(config, keyStatus) {
    const status = keyStatus && keyStatus.configured ? '已保存本机 API Key' : '尚未保存 API Key';
    const protection = keyStatus && keyStatus.encrypted ? '系统加密已启用' : '系统加密不可用，将以仅限本机文件权限保存';
    return '<h3 style="margin:0 0 4px">AI API 配置</h3>' +
      '<div class="hint" style="margin-bottom:14px">默认已填入 DeepSeek（可直接填写 API Key 使用）；也可改为其他兼容 OpenAI Chat Completions 的接口。API Key 仅保存在本机，不会写入作品、备份或源码。' + U.escapeHtml(protection) + '。</div>' +
      '<div><label class="label">基础地址</label><input class="input" id="ai-base-url" value="' + U.escapeHtml(config.baseUrl || '') + '" placeholder="https://api.deepseek.com"></div>' +
      '<div style="margin-top:10px"><label class="label">模型名称</label><input class="input" id="ai-model" value="' + U.escapeHtml(config.model || '') + '" placeholder="deepseek-chat"></div>' +
      '<div style="margin-top:10px"><label class="label">API Key</label><input class="input" type="password" id="ai-api-key" placeholder="' + status + '；留空则保留当前密钥"></div>' +
      '<label class="check-row" style="margin-top:8px"><input type="checkbox" id="ai-clear-key"> 删除本机已保存的 API Key</label>' +
      '<div style="margin-top:10px"><label class="label">创造度 <span id="ai-temp-value">' + (config.temperature || 0.8) + '</span></label><input type="range" id="ai-temperature" min="0" max="1.5" step="0.1" value="' + (config.temperature || 0.8) + '" data-action="aiConfigTemperature"></div>' +
      '<div class="modal-foot" style="padding:16px 0 0;justify-content:flex-end"><button class="btn" data-action="modal-close">取消</button><button class="btn primary" data-action="aiSaveConfig">保存配置</button></div>';
  }
  async function openConfig() {
    if (!window.mogeAI) { UI.toast('AI API 调用仅支持桌面 EXE 版', 'warn'); return; }
    const config = currentConfig();
    const status = await window.mogeAI.keyStatus();
    UI.openModal(configFormHtml(config, status), { wide: true });
  }
  async function setSidebar(open) {
    App.settings.aiSidebarOpen = !!open;
    await DB.put('settings', { key: 'aiSidebarOpen', value: App.settings.aiSidebarOpen });
    const sidebar = U.$('#ai-sidebar');
    if (sidebar) sidebar.classList.toggle('hidden', !open);
    const wrap = U.$('.editor-wrap');
    if (wrap) wrap.classList.toggle('ai-hidden', !open);
    const trigger = U.$('#ed-ai-toggle');
    if (trigger) {
      trigger.classList.toggle('active', open);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  }
  async function setContextOption(key, enabled) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_CONTEXT_OPTIONS, key)) return;
    const options = currentContextOptions();
    options[key] = !!enabled;
    App.settings.aiContextOptions = options;
    await DB.put('settings', { key: 'aiContextOptions', value: options });
    const summary = U.$('#ai-context-summary');
    if (summary) summary.textContent = '本次额外发送：' + enabledContextNames(options);
  }
  async function generate(taskKey) {
    const task = TASKS[taskKey] || TASKS.continue;
    if (!window.mogeAI) { UI.toast('AI API 调用仅支持桌面 EXE 版', 'warn'); return; }
    const config = currentConfig();
    if (!config.baseUrl || !config.model) { UI.toast('请先完成 API 配置', 'warn'); openConfig(); return; }
    const status = await window.mogeAI.keyStatus();
    if (!status.configured) { UI.toast('请先保存 API Key', 'warn'); openConfig(); return; }
    const context = chapterContext();
    if (taskKey === 'polish' && !context.selected) { UI.toast('请先在正文中选中要润色的段落', 'warn'); return; }
    const extra = ((U.$('#ai-extra-prompt') || {}).value || '').trim();
    const options = currentContextOptions();
    const button = U.$('.ai-generate');
    const box = U.$('#ai-result');
    if (button) { button.disabled = true; button.textContent = '正在生成…'; }
    if (box) box.innerHTML = '<div class="hint">正在请求 AI，请稍候…</div>';
    const userPrompt = [
      '作品：' + ((App.data.work && App.data.work.title) || '未命名作品'),
      '章节：' + (context.title || '无题章节'),
      context.outline ? '本章细纲：' + context.outline : '',
      context.notes ? '写作备注：' + context.notes : '',
      optionalContext(context, options).join('\n\n'),
      taskKey === 'polish' ? '待润色选段：\n' + context.selected : '当前正文末段：\n' + context.bodyTail,
      extra ? '额外要求：' + extra : '',
      '任务：' + task.prompt
    ].filter(Boolean).join('\n\n');
    try {
      const result = await window.mogeAI.chat(config, [
        { role: 'system', content: '你是中文网络小说写作助手。尊重用户提供的作品设定，不编造对作品世界观的解释，不输出与任务无关的说明。' },
        { role: 'user', content: userPrompt }
      ]);
      App._aiDraft = result.content;
      renderResult(result.content, result);
    } catch (e) {
      if (box) box.innerHTML = '<div class="hint" style="color:var(--danger)">生成失败：' + U.escapeHtml(String(e && e.message || e)) + '</div>';
      UI.toast('AI 生成失败', 'err');
    } finally {
      if (button) { button.disabled = false; button.textContent = '生成写作建议'; }
    }
  }

  Actions['aiOpenConfig'] = () => openConfig();
  Actions['aiConfigTemperature'] = t => { const el = U.$('#ai-temp-value'); if (el) el.textContent = t.value; };
  Actions['aiContextToggle'] = t => setContextOption(t.dataset.key, !!t.checked);
  Actions['aiSaveConfig'] = async () => {
    if (!window.mogeAI) { UI.toast('AI API 调用仅支持桌面 EXE 版', 'warn'); return; }
    const baseUrl = ((U.$('#ai-base-url') || {}).value || '').trim().replace(/\/+$/, '');
    const model = ((U.$('#ai-model') || {}).value || '').trim();
    const temperature = Number((U.$('#ai-temperature') || {}).value || 0.8);
    const key = ((U.$('#ai-api-key') || {}).value || '').trim();
    const clearKey = !!((U.$('#ai-clear-key') || {}).checked);
    if (!baseUrl || !model) { UI.toast('请填写基础地址和模型名称', 'warn'); return; }
    try { new URL(baseUrl); } catch (e) { UI.toast('基础地址格式不正确', 'warn'); return; }
    App.settings.aiConfig = { provider: 'custom', baseUrl: baseUrl, model: model, temperature: temperature };
    await DB.put('settings', { key: 'aiConfig', value: App.settings.aiConfig });
    if (key || clearKey) await window.mogeAI.saveKey(clearKey ? '' : key);
    UI.closeModal();
    UI.toast('AI 配置已保存在本机');
  };
  Actions['aiTask'] = t => {
    const key = t.dataset.task || 'continue';
    const button = U.$('.ai-generate');
    if (button) { button.dataset.task = key; button.textContent = '生成：' + TASKS[key].label; }
    U.$$('.ai-task-grid .btn').forEach(b => b.classList.toggle('active', b === t));
  };
  Actions['aiGenerate'] = t => generate(t.dataset.task || 'continue');
  Actions['aiToggleSidebar'] = () => setSidebar(!isOpen());
  Actions['aiHideSidebar'] = () => setSidebar(false);
  Actions['aiCopyResult'] = async () => {
    if (!App._aiDraft) return;
    try { await navigator.clipboard.writeText(App._aiDraft); UI.toast('已复制 AI 建议'); } catch (e) { UI.toast('复制失败，请手动复制', 'warn'); }
  };
  Actions['aiInsertResult'] = () => {
    if (!App._aiDraft) return;
    const ta = U.$('#editor-textarea');
    if (!ta) return;
    const start = typeof ta.selectionStart === 'number' ? ta.selectionStart : ta.value.length;
    const end = typeof ta.selectionEnd === 'number' ? ta.selectionEnd : start;
    const prefix = start && ta.value.slice(start - 1, start) !== '\n' ? '\n' : '';
    ta.setRangeText(prefix + App._aiDraft, start, end, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
    UI.toast('已插入正文；自动保存将随后执行');
  };

  window.AIWriter = { sidebarHtml, openConfig, generate, isOpen, currentContextOptions, currentConfig };
})();
