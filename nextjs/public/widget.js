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
    if (!senderId) {
        senderId = 'v_' + Math.random().toString(36).substr(2, 9) + Date.now();
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
        
        // Roundness: 0-100 translated to border-radius for a square bubble
        var roundness = typeof s.bubble_roundness !== 'undefined' ? s.bubble_roundness : 28;
        var radius    = Math.round(roundness * 0.5) + '%';
        
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
            '#nsa-wrap{position:fixed;z-index:2147483647;display:flex;flex-direction:column;align-items:' + (isRight ? 'flex-end' : 'flex-start') + ';' + posStyle + '}',
            '#nsa-bubble{width:' + size + 'px;height:' + size + 'px;border-radius:' + radius + ';background:' + bubbleBg + ';border:' + bubbleBorder + ';' + (showBg ? 'box-shadow:0 8px 30px rgba(0,0,0,.2);' : '') + 'display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;transition:transform .3s cubic-bezier(.175,.885,.32,1.275),box-shadow .3s;}',
            '#nsa-bubble:hover{transform:scale(1.11);' + (showBg ? 'box-shadow:0 14px 40px rgba(0,0,0,.26);' : '') + '}',
            '#nsa-bubble img{width:' + (showBg ? Math.round(size * .67) : size) + 'px;height:' + (showBg ? Math.round(size * .67) : size) + 'px;object-fit:contain;}',
            '#nsa-win{width:380px;height:600px;max-width:calc(100vw - 40px);max-height:calc(100vh - 100px);background:#fff;border-radius:24px;box-shadow:0 20px 60px rgba(0,0,0,.18);margin-' + (isBottom ? 'bottom' : 'top') + ':14px;display:none;flex-direction:column;overflow:hidden;border:1px solid rgba(0,0,0,.05);animation:nsa-in .35s ease;}',
            '@keyframes nsa-in{from{opacity:0;transform:translateY(' + (isBottom ? '16' : '-16') + 'px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}',
            '.nsa-hdr{padding:18px 20px;background:' + color + ';color:#fff;display:flex;align-items:center;gap:12px;}',
            '.nsa-hdr-img{width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,.2);overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
            '.nsa-hdr-img img{width:32px;height:32px;object-fit:contain;}',
            '.nsa-hdr h3{margin:0;font-size:15px;font-weight:800;font-style:italic;text-transform:uppercase;letter-spacing:.5px;}',
            '.nsa-hdr p{margin:3px 0 0;font-size:10px;opacity:.7;font-weight:600;text-transform:uppercase;letter-spacing:1px;}',
            '.nsa-body{flex:1;overflow-y:auto;padding:18px;background:#f8fafc;display:flex;flex-direction:column;gap:10px;}',
            '.nsa-msg{padding:10px 14px;border-radius:16px;font-size:14px;max-width:85%;line-height:1.6;word-break:break-word;}',
            '.nsa-ai{background:#fff;color:#1e293b;border-bottom-left-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.04);}',
            '.nsa-user{background:' + color + ';color:#fff;align-self:flex-end;border-bottom-right-radius:4px;}',
            '.nsa-foot-inp{padding:14px;background:#fff;border-top:1px solid #f1f5f9;display:flex;gap:8px;}',
            '.nsa-foot-inp input{flex:1;border:none;background:#f1f5f9;padding:10px 14px;border-radius:10px;font-size:14px;outline:none;}',
            '.nsa-foot-inp input:disabled{opacity:.5;}',
            '.nsa-send{background:' + color + ';border:none;color:#fff;width:42px;height:42px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .2s;}',
            '.nsa-send:hover{opacity:.85;}.nsa-send:disabled{opacity:.4;cursor:not-allowed;}',
            '.nsa-footer{padding:7px;text-align:center;background:#fff;font-size:9px;color:#94a3b8;font-weight:800;text-transform:uppercase;letter-spacing:1px;}',
            '.nsa-footer a{color:inherit;text-decoration:none;}',
        ].join('');

        var style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);

        // HTML
        var wrap = document.createElement('div');
        wrap.id = 'nsa-wrap';
        wrap.innerHTML = [
            '<div id="nsa-win">',
            '  <div class="nsa-hdr">',
            '    <div class="nsa-hdr-img"><img src="' + iconUrl + '" alt="icon" onerror="this.style.display=\'none\'"></div>',
            '    <div><h3>' + esc(s.header_title) + '</h3><p>' + esc(s.header_subtitle) + '</p></div>',
            '  </div>',
            '  <div class="nsa-body" id="nsa-body">',
            '    <div class="nsa-msg nsa-ai">' + esc(config.greeting) + '</div>',
            '  </div>',
            '  <div class="nsa-foot-inp">',
            '    <input type="text" id="nsa-inp" placeholder="' + esc(s.placeholder_text) + '">',
            '    <button class="nsa-send" id="nsa-send">',
            '      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
            '    </button>',
            '  </div>',
            '  <div class="nsa-footer"><a href="https://newsmartagent.com" target="_blank">Powered by New Smart Agent</a></div>',
            '</div>',
            '<div id="nsa-bubble">',
            '  <img src="' + iconUrl + '" alt="Chat" onerror="this.outerHTML=\'<svg width=\\\'28\\\' height=\\\'28\\\' fill=\\\'white\\\' viewBox=\\\'0 0 24 24\\\'><path d=\\\'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\\\'/></svg>\'">',
            '</div>',
        ].join('');

        document.body.appendChild(wrap);

        // ── SPA Routing Handle ────────────────────────────────────────────────
        // Hide widget if on dashboard, show otherwise. 
        // Checks every 500ms to handle Next.js client-side navigation.
        setInterval(function() {
            var isDash = window.location.pathname.includes('dashboard');
            wrap.style.display = isDash ? 'none' : 'flex';
        }, 500);

        // ── State & Events ────────────────────────────────────────────────────
        var bubble = document.getElementById('nsa-bubble');
        var winEl  = document.getElementById('nsa-win');
        var inp    = document.getElementById('nsa-inp');
        var send   = document.getElementById('nsa-send');
        var body   = document.getElementById('nsa-body');

        bubble.addEventListener('click', function() {
            isOpen = !isOpen;
            winEl.style.display = isOpen ? 'flex' : 'none';
            if (isOpen) { body.scrollTop = body.scrollHeight; inp.focus(); }
        });

        function addMsg(text, type) {
            var el = document.createElement('div');
            el.className = 'nsa-msg nsa-' + type;
            el.textContent = text;
            body.appendChild(el);
            body.scrollTop = body.scrollHeight;
            return el;
        }

        async function sendMessage() {
            var val = inp.value.trim();
            if (!val) return;
            addMsg(val, 'user');
            inp.value = '';
            inp.disabled = true;
            send.disabled = true;
            var loading = addMsg('· · ·', 'ai');
            try {
                var res = await fetch(apiBase + '/chat/' + widgetKey + '/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: val, sender_id: senderId })
                });
                var data = await res.json();
                loading.textContent = data.response || "Sorry, something went wrong.";
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
    }

    function esc(str) {
        return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
})();
