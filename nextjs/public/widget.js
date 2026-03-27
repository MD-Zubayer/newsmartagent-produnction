(function() {
    // ── Configuration ─────────────────────────────────────────────────────────
    if (document.getElementById('nsa-wrap')) return; // Prevent duplicate widgets if script re-executes
    var scriptTag = document.currentScript;
    var widgetKey = scriptTag ? scriptTag.getAttribute('data-key') : null;
    
    // Dynamically determine apiBase from the script URL
    var scriptSrc = scriptTag ? scriptTag.src : "";
    var origin    = scriptSrc ? new URL(scriptSrc).origin : "https://newsmartagent.com";
    var apiBase   = origin + "/api/aiAgent/widget";
    var DEFAULT_ICON = origin + "/newsmartagent_ai_logo.jpeg";

    if (!widgetKey) {
        console.error("New Smart Agent Widget: Missing data-key attribute.");
        return;
    }

    var senderId = localStorage.getItem('nsa_widget_sender_id');
    var visitorUuid = localStorage.getItem('visitor_uuid');
    
    // Priority: visitor_uuid (from tracker) > existing nsa_widget_sender_id > new generated ID
    if (!senderId) {
        if (visitorUuid) {
            senderId = visitorUuid;
        } else {
            senderId = 'v_' + Math.random().toString(36).substr(2, 9) + Date.now();
        }
        localStorage.setItem('nsa_widget_sender_id', senderId);
    }

    var config = null;
    var isOpen = false;

    // ── Fetch config then boot ────────────────────────────────────────────────
    fetch(apiBase + '/config/' + widgetKey + '/')
        .then(function(r){ return r.json(); })
        .then(function(data){ config = data; initWidget(); })
        .catch(function(e){ console.error("NSA Widget: config load failed", e); });

    // ── Build Widget ──────────────────────────────────────────────────────────
    function initWidget() {
        var s          = config.settings;
        var color      = s.primary_color || '#4f46e5';
        var size       = parseInt(s.bubble_size) || 60;
        var iconUrl    = s.effective_icon_url || s.bubble_icon_url || DEFAULT_ICON;
        var position   = s.widget_position || 'bottom-right';
        
        var waNum      = s.whatsapp_number || '';
        var msLink     = s.messenger_link || '';
        var hasMulti   = !!(waNum || msLink);
        var isMenuOpen = false;
        
        // Roundness: 0-100 translated to border-radius
        var roundness = typeof s.bubble_roundness !== 'undefined' ? s.bubble_roundness : 28;
        var radius    = Math.round(roundness * 0.5) + '%';
        
        // Menu AI Icon Customization
        var menuAiIconSize = parseInt(s.menu_ai_icon_size) || 44;
        var menuAiIconBgColor = s.menu_ai_icon_bg_color || 'transparent';
        var menuAiIconRoundness = typeof s.menu_ai_icon_roundness !== 'undefined' ? s.menu_ai_icon_roundness : 50;
        var menuAiIconRadius = Math.round(menuAiIconRoundness * 0.5) + '%';

        // Background
        var showBg    = typeof s.show_bubble_background !== 'undefined' ? s.show_bubble_background : true;
        var bubbleBg  = showBg ? color : 'transparent';
        var bubbleBorder = showBg ? 'none' : '2px solid ' + color;

        // Position CSS
        var isBottom = position.includes('bottom');
        var isRight  = position.includes('right');
        var posStyle = (isBottom ? 'bottom:20px;' : 'top:20px;') + (isRight ? 'right:20px;' : 'left:20px;');

        // CSS
        var css = [
            '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");',
            '#nsa-wrap { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; position: fixed; z-index: 2147483647; display: flex; flex-direction: column; align-items: ' + (isRight ? 'flex-end' : 'flex-start') + '; ' + posStyle + ' }',
            '#nsa-bubble { width: ' + size + 'px; height: ' + size + 'px; border-radius: ' + radius + '; background: ' + bubbleBg + '; border: ' + bubbleBorder + '; ' + (showBg ? 'box-shadow: 0 8px 32px rgba(0,0,0,0.15);' : '') + ' display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }',
            '#nsa-bubble:hover { transform: scale(1.1) rotate(5deg); ' + (showBg ? 'box-shadow: 0 12px 40px rgba(0,0,0,0.2);' : '') + ' }',
            '#nsa-bubble img { width: ' + (showBg ? Math.round(size * 0.6) : size) + 'px; height: ' + (showBg ? Math.round(size * 0.6) : size) + 'px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1)); }',
            '#nsa-fab-menu { position: absolute; bottom: calc(100% + 15px); display: none; flex-direction: column; gap: 12px; align-items: center; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); opacity: 0; transform: translateY(15px); z-index: 2147483648; pointer-events: none; }',
            '#nsa-fab-menu.nsa-open { display: flex; opacity: 1; transform: translateY(0); pointer-events: auto; }',
            '.nsa-fab-btn { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.1); transition: all 0.3s; text-decoration: none; border: 1px solid rgba(255,255,255,0.2); }',
            '.nsa-fab-btn:hover { transform: translateY(-3px) scale(1.05); box-shadow: 0 8px 25px rgba(0,0,0,0.15); }',
            '.nsa-fab-wa { background: #25D366; }',
            '.nsa-fab-ms { background: #0084FF; }',
            '.nsa-fab-btn svg { width: 22px; height: 22px; fill: #fff; }',
            '.nsa-fab-btn img { width: 24px; height: 24px; object-fit: contain; border-radius: 50%; }',
            '#nsa-fab-ai.nsa-fab-btn { background: ' + menuAiIconBgColor + '; border: none; box-shadow: none; border-radius: ' + menuAiIconRadius + '; display: flex; justify-content: center; align-items: center; width: ' + menuAiIconSize + 'px; height: ' + menuAiIconSize + 'px; overflow: hidden; }',
            '#nsa-fab-ai.nsa-fab-btn img { width: ' + menuAiIconSize + 'px; height: ' + menuAiIconSize + 'px; object-fit: contain; border-radius: ' + menuAiIconRadius + '; }',


            '#nsa-win { width: 380px; height: 620px; max-width: calc(100vw - 40px); max-height: calc(100vh - 100px); background: #fff; border-radius: 24px; box-shadow: 0 24px 80px rgba(0,0,0,0.2); margin-' + (isBottom ? 'bottom' : 'top') + ': 16px; display: none; flex-direction: column; overflow: hidden; border: 1px solid rgba(0,0,0,0.08); animation: nsa-in 0.4s cubic-bezier(0.16, 1, 0.3, 1); }',
            '@keyframes nsa-in { from { opacity: 0; transform: translateY(' + (isBottom ? '20' : '-20') + 'px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }',
            '.nsa-hdr { padding: 20px 24px; background: linear-gradient(135deg, ' + color + ' 0%, ' + color + 'dd 100%); color: #fff; display: flex; align-items: center; gap: 14px; position: relative; overflow: hidden; }',
            '.nsa-hdr::after { content: ""; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); pointer-events: none; }',
            '.nsa-hdr-img { width: 44px; height: 44px; border-radius: 12px; background: rgba(255,255,255,0.2); backdrop-filter: blur(4px); overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.3); }',
            '.nsa-hdr-img img { width: 36px; height: 36px; object-fit: contain; }',
            '.nsa-hdr h3 { margin: 0; font-size: 16px; font-weight: 700; letter-spacing: -0.2px; }',
            '.nsa-hdr p { margin: 2px 0 0; font-size: 11px; opacity: 0.85; font-weight: 500; }',
            '.nsa-controls { display: flex; padding: 4px 16px 16px; background: #fff; gap: 8px; }',
            '.nsa-ctrl-btn { flex: 1; padding: 8px 6px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; color: #64748b; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 5px; }',
            '.nsa-ctrl-btn:hover { background: #f1f5f9; border-color: ' + color + '; color: ' + color + '; }',
            '.nsa-ctrl-btn.active { background: ' + color + '; color: #fff; border-color: ' + color + '; box-shadow: 0 4px 12px ' + color + '44; }',
            '.nsa-ctrl-btn svg { transition: transform 0.2s; }',
            '.nsa-ctrl-btn:active svg { transform: scale(0.9); }',
            '.nsa-body { flex: 1; overflow-y: auto; padding: 20px; background: #fdfdfd; display: flex; flex-direction: column; gap: 12px; scroll-behavior: smooth; }',
            '.nsa-body::-webkit-scrollbar { width: 5px; }',
            '.nsa-body::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }',
            '.nsa-msg { padding: 12px 16px; border-radius: 18px; font-size: 14px; max-width: 85%; line-height: 1.5; word-break: break-word; position: relative; animation: msg-up 0.3s ease-out; }',
            '@keyframes msg-up { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }',
            '.nsa-ai { background: #fff; color: #1e293b; border-bottom-left-radius: 4px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; }',
            '.nsa-user { background: ' + color + '; color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; box-shadow: 0 4px 15px ' + color + '33; }',
            '.nsa-foot-inp { padding: 16px; background: #fff; border-top: 1px solid #f1f5f9; display: flex; gap: 10px; align-items: center; }',
            '.nsa-inp-wrap { flex: 1; position: relative; display: flex; align-items: center; background: #f1f5f9; border-radius: 14px; padding: 4px 4px 4px 12px; transition: all 0.2s; border: 1px solid transparent; }',
            '.nsa-inp-wrap:focus-within { background: #fff; border-color: ' + color + '; box-shadow: 0 0 0 4px ' + color + '11; }',
            '.nsa-inp-wrap input { flex: 1; border: none; background: transparent; padding: 8px 0; font-size: 14px; outline: none; color: #1e293b; }',
            '.nsa-send { background: ' + color + '; border: none; color: #fff; width: 36px; height: 36px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; }',
            '.nsa-send:hover { transform: scale(1.05); opacity: 0.9; }',
            '.nsa-send:disabled { opacity: 0.4; cursor: not-allowed; transform: scale(1); }',
            '.nsa-footer { padding: 10px; text-align: center; background: #fff; font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-top: 1px solid #f8fafc; }',
            '.nsa-footer a { color: inherit; text-decoration: none; transition: color 0.2s; }',
            '.nsa-footer a:hover { color: ' + color + '; }',
            '.nsa-ctrl-btn.nsa-btn-active { background: #ef4444; color: #fff; border-color: #ef4444; }',
            '.nsa-ctrl-btn.nsa-btn-resolve { background: #10b981; color: #fff; border-color: #10b981; }',
            '@media (max-width: 768px) { ' +
                '#nsa-win { ' +
                    'position: fixed !important; ' +
                    'top: 10px !important; ' +
                    'left: 10px !important; ' +
                    'right: 10px !important; ' +
                    'bottom: ' + (menuAiIconSize + 40) + 'px !important; ' +
                    'width: calc(100vw - 20px) !important; ' +
                    'max-width: none !important; ' +
                    'height: auto !important; ' +
                    'max-height: none !important; ' +
                    'margin: 0 !important; ' +
                    'box-sizing: border-box !important; ' +
                    'z-index: 2147483648 !important; ' +
                '} ' +
            '}'
        ].join('');




        var style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);

        // HTML
        var wrap = document.createElement('div');
        wrap.id = 'nsa-wrap';
        
        var htmlArr = [
            '<div id="nsa-win">',
            '  <div class="nsa-hdr">',
            '    <div class="nsa-hdr-img"><img src="' + iconUrl + '" alt="icon" onerror="this.style.display=\'none\'"></div>',
            '    <div><h3>' + esc(s.header_title) + '</h3><p>' + esc(s.header_subtitle) + '</p></div>',
            '  </div>',
            '  <div class="nsa-body" id="nsa-body">',
            '  </div>',
            '  <div class="nsa-foot-inp" style="flex-direction: column; align-items: stretch; gap: 12px;">',
            '    <div style="display: flex; gap: 10px; width: 100%;">',
            '      <div class="nsa-inp-wrap">',
            '        <input type="text" id="nsa-inp" placeholder="' + esc(s.placeholder_text) + '">',
            '        <button class="nsa-send" id="nsa-send">',
            '          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>',
            '        </button>',
            '      </div>',
            '    </div>',
            '    <div class="nsa-controls" id="nsa-controls" style="display:none; padding: 0;"></div>',
            '  </div>',
            '  <div class="nsa-footer"><a href="https://newsmartagent.com" target="_blank">Powered by New Smart Agent</a></div>',
            '</div>'
        ];

        
        if (hasMulti) {
            htmlArr.push('<div id="nsa-fab-menu">');
            if (waNum) {
                var waLink = 'https://wa.me/' + waNum.replace(/[^0-9]/g, '');
                htmlArr.push('<a href="' + waLink + '" target="_blank" class="nsa-fab-btn nsa-fab-wa" title="WhatsApp"><svg viewBox="0 0 24 24"><path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.656.84 5.109 2.25 7.109L.469 24l5.063-1.781a11.96 11.96 0 0 0 6.5 1.844c6.646 0 12.031-5.385 12.031-12.031S18.677 0 12.031 0zm0 20.063a9.927 9.927 0 0 1-5.063-1.359l-3.375 1.172 1.219-3.281A9.957 9.957 0 0 1 2.063 12.031C2.063 6.516 6.516 2.063 12.031 2.063S21.999 6.516 21.999 12.031s-4.453 9.969-9.968 10.031z"/></svg></a>');
            }
            if (msLink) {
                var mLink = msLink.startsWith('http') ? msLink : 'https://' + msLink;
                htmlArr.push('<a href="' + mLink + '" target="_blank" class="nsa-fab-btn nsa-fab-ms" title="Messenger"><svg viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.5 1.745 6.667 4.545 8.737v4.152l4.131-2.288a12.636 12.636 0 0 0 3.324.44C18.627 22.222 24 17.248 24 11.11S18.627 0 12 0zm1.202 14.889l-3.081-3.28-6.021 3.28 6.627-7.03 3.131 3.28 5.971-3.28-6.627 7.03z"/></svg></a>');
            }
            htmlArr.push('<div class="nsa-fab-btn nsa-fab-ai" id="nsa-fab-ai" title="Live Chat"><img src="' + iconUrl + '" onerror="this.style.display=\'none\'"></div>');
            htmlArr.push('</div>');
        }

        htmlArr.push('<div id="nsa-bubble">');
        htmlArr.push('  <img src="' + iconUrl + '" alt="Chat" onerror="this.outerHTML=\'<svg width=\\\'28\\\' height=\\\'28\\\' fill=\\\'white\\\' viewBox=\\\'0 0 24 24\\\'><path d=\\\'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\\\'/></svg>\'">');
        htmlArr.push('</div>');
        
        wrap.innerHTML = htmlArr.join('');
        document.body.appendChild(wrap);

        // ── SPA Routing Handle ────────────────────────────────────────────────
        setInterval(function() {
            var el = document.getElementById('nsa-wrap');
            if (el) {
                var isDash = window.location.href.indexOf('dashboard') !== -1;
                el.style.display = isDash ? 'none' : 'flex';
            }
        }, 500);

        // ── State & Events ────────────────────────────────────────────────────
        var bubble = document.getElementById('nsa-bubble');
        var winEl  = document.getElementById('nsa-win');
        var inp    = document.getElementById('nsa-inp');
        var send   = document.getElementById('nsa-send');
        var body   = document.getElementById('nsa-body');
        var menuEl = document.getElementById('nsa-fab-menu');
        var aiBtn  = document.getElementById('nsa-fab-ai');

        bubble.addEventListener('click', function() {
            if (hasMulti) {
                if (isOpen) {
                    isOpen = false;
                    winEl.style.display = 'none';
                }
                isMenuOpen = !isMenuOpen;
                if (isMenuOpen) {
                    menuEl.classList.add('nsa-open');
                } else {
                    menuEl.classList.remove('nsa-open');
                }
            } else {
                isOpen = !isOpen;
                winEl.style.display = isOpen ? 'flex' : 'none';
                if (isOpen) { body.scrollTop = body.scrollHeight; inp.focus(); }
            }
        });

        if (aiBtn) {
            aiBtn.addEventListener('click', function() {
                isMenuOpen = false;
                menuEl.classList.remove('nsa-open');
                isOpen = true;
                winEl.style.display = 'flex';
                body.scrollTop = body.scrollHeight; 
                inp.focus();
            });
        }

        function addMsg(text, type, skipSave) {
            var el = document.createElement('div');
            el.className = 'nsa-msg nsa-' + type;
            el.textContent = text;
            body.appendChild(el);
            body.scrollTop = body.scrollHeight;

            if (!skipSave) {
                var history = JSON.parse(localStorage.getItem('nsa_chat_history_' + widgetKey) || '[]');
                history.push({ text: text, type: type });
                if (history.length > 20) history.shift(); // Keep last 20 messages for better context
                localStorage.setItem('nsa_chat_history_' + widgetKey, JSON.stringify(history));
            }

            return el;
        }

        // Load history
        (function() {
            var history = JSON.parse(localStorage.getItem('nsa_chat_history_' + widgetKey) || '[]');
            if (history.length > 0) {
                history.forEach(function(m) {
                    addMsg(m.text, m.type, true);
                });
            } else {
                addMsg(config.greeting, 'ai', false);
            }
        })();

        async function sendMessage() {
            var val = inp.value.trim();
            if (!val) return;
            addMsg(val, 'user');
            inp.value = '';
            inp.disabled = true;
            send.disabled = true;
            var loading = addMsg('· · ·', 'ai', true);
            try {
                var res = await fetch(apiBase + '/chat/' + widgetKey + '/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: val, sender_id: senderId })
                });
                var data = await res.json();
                var responseText = data.response || "Sorry, something went wrong.";
                loading.textContent = responseText;
                
                // Manually save the final response to history
                var history = JSON.parse(localStorage.getItem('nsa_chat_history_' + widgetKey) || '[]');
                history.push({ text: responseText, type: 'ai' });
                if (history.length > 20) history.shift();
                localStorage.setItem('nsa_chat_history_' + widgetKey, JSON.stringify(history));
            } catch (e) {
                loading.textContent = "Sorry, I can't connect right now.";
            } finally {
                inp.disabled = false;
                send.disabled = false;
                inp.focus();
                body.scrollTop = body.scrollHeight;
            }
        }

        send.addEventListener('click', sendMessage);
        inp.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
        });

        // ── Dynamic Control Logic ───────────────────────────────────────────
        var controlsWrap = document.getElementById('nsa-controls');
        var isHumanActive = false;
        var isAIActive    = true;

        var enableHuman = !!s.enable_human_control;
        var enableAI    = !!s.enable_ai_control;

        if (enableHuman || enableAI) {
            controlsWrap.style.display = 'flex';
            if (enableHuman) {
                var hb = document.createElement('button');
                hb.className = 'nsa-ctrl-btn';
                hb.id = 'nsa-btn-human-toggle';
                hb.title = "Toggle Human Help";
                controlsWrap.appendChild(hb);
                hb.onclick = toggleHuman;
            }
            if (enableAI) {
                var ab = document.createElement('button');
                ab.className = 'nsa-ctrl-btn';
                ab.id = 'nsa-btn-ai-toggle';
                ab.title = "Toggle AI Response";
                controlsWrap.appendChild(ab);
                ab.onclick = toggleAI;
            }
            syncControlState();
        }

        async function syncControlState() {
            try {
                var r = await fetch(apiBase + '/status/' + widgetKey + '/?sender_id=' + senderId);
                var d = await r.json();
                isHumanActive = !!d.is_human_active;
                isAIActive    = !!d.is_ai_active;
                updateHumanUI();
                updateAIUI();
            } catch(e) {}
        }

        function updateHumanUI() {
            var btn = document.getElementById('nsa-btn-human-toggle');
            if (!btn) return;
            if (isHumanActive) {
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Resolve Help';
                btn.className = 'nsa-ctrl-btn nsa-btn-resolve';
            } else {
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> Human Help';
                btn.className = 'nsa-ctrl-btn';
            }
        }

        function updateAIUI() {
            var btn = document.getElementById('nsa-btn-ai-toggle');
            if (!btn) return;
            if (isAIActive) {
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg> Off AI';
                btn.className = 'nsa-ctrl-btn nsa-btn-active';
            } else {
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l14 9-14 9V3z"></path></svg> On AI';
                btn.className = 'nsa-ctrl-btn';
            }
        }

        async function toggleHuman() {
            var action = isHumanActive ? 'human_resolved' : 'human_request';
            var userMsg = !isHumanActive ? "I need human help." : "Issue resolved. Back to AI.";
            
            addMsg(userMsg, 'user');
            
            try {
                var r = await fetch(apiBase + '/control/' + widgetKey + '/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: action, sender_id: senderId })
                });
                var d = await r.json();
                if (d.status === 'ok') {
                    isHumanActive = !!d.is_human_active;
                    if (typeof d.is_ai_active !== 'undefined') isAIActive = !!d.is_ai_active;
                    if (isHumanActive) {
                        setTimeout(function() { addMsg("A human agent has been notified.", 'ai'); }, 800);
                    }
                    updateHumanUI();
                    updateAIUI();
                }
            } catch(e) {}
        }

        async function toggleAI() {
            var action = isAIActive ? 'stop_ai' : 'start_ai';
            var feedback = !isAIActive ? "AI responses enabled." : "AI responses paused.";
            
            try {
                var r = await fetch(apiBase + '/control/' + widgetKey + '/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: action, sender_id: senderId })
                });
                var d = await r.json();
                if (d.status === 'ok') {
                    isAIActive = !!d.is_ai_active;
                    addMsg(feedback, 'ai', true);
                    updateAIUI();
                }
            } catch(e) {}
        }

    }


    function esc(str) {
        return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
})();
