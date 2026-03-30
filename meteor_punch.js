// ═══════════════════════════════════════════════════════════════════
// ☄️  METEOR PUNCH — Ultimate Skill System
//     ملف منفصل — يُضاف قبل </body> في adventure_mode.html:
//     <script src="meteor_punch.js"></script>
//
//     الـ spritesheet: meteor_sheet.png (1536×1024 — شبكة 4×4)
//     كل فريم: 384×256 px
//
//     طريقة التفعيل:
//       • كل ضربة ناجحة تعبّي شريط الـ Energy
//       • لما يكتمل (100%) يظهر زر ☄️ Ultimate
//       • اضغطه → Cutscene 1.5 ثانية → ضربة قاضية
// ═══════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ─────────────────────────────────────────────
    // 1. إعداد الـ Spritesheet
    // ─────────────────────────────────────────────
    var SHEET_SRC = 'meteor_sheet.png';   // نفس مجلد adventure_mode.html
    var FW = 384, FH = 256;               // أبعاد كل فريم

    // خريطة الفريمات (col, row) → sx = col*384, sy = row*256
    var FRAMES = {
        // ─ طور الشحن / استدعاء النيزك ─
        charge:      { sx: 384,  sy: 256  },   // r1c1 — وقفة الشحن مع زلزلة
        summon:      { sx: 384,  sy: 512  },   // r2c1 — رفع النيزك
        trail:       { sx: 1152, sy: 512  },   // r2c3 — جري مع نيزك ناري
        windup:      { sx: 0,    sy: 768  },   // r3c0 — استعداد الضربة الكبيرة
        impact:      { sx: 384,  sy: 768  },   // r3c1 — انفجار أرضي
        aftermath:   { sx: 768,  sy: 768  },   // r3c2 — موجة الانفجار الكبيرة
        // ─ حالات إضافية للـ aura ─
        aura:        { sx: 768,  sy: 0    },   // r0c2 — هالة برق (لما الـ energy تكتمل)
        fireCharge:  { sx: 1152, sy: 0    },   // r0c3 — قبضة نارية مشحونة
    };

    // ─────────────────────────────────────────────
    // 2. تحميل الشيت + إزالة الخلفية الخضراء
    // ─────────────────────────────────────────────
    var _sheet      = null;   // HTMLImageElement الأصلية
    var _sheetReady = false;  // هل اتحمل؟
    var _sheetCanvas = null;  // نسخة معالجة (بدون green-screen)

    function _loadSheet() {
        _sheet = new Image();
        _sheet.onload = function () {
            var tmp = document.createElement('canvas');
            tmp.width  = _sheet.naturalWidth;
            tmp.height = _sheet.naturalHeight;
            var tc = tmp.getContext('2d');
            tc.drawImage(_sheet, 0, 0);
            var id = tc.getImageData(0, 0, tmp.width, tmp.height);
            var d  = id.data;
            for (var i = 0; i < d.length; i += 4) {
                var r = d[i], g = d[i+1], b = d[i+2];
                // إزالة الخلفية الرمادية الفاتحة (الـ checker-board) وأي لون قريب منها
                // الشيت خلفيته رمادية فاتحة تقريباً r~180-220, g~180-220, b~180-220
                var isGray = Math.abs(r-g) < 22 && Math.abs(g-b) < 22 && r > 160;
                // إزالة الخلفية الخضراء كمان لو موجودة
                var isGreen = g > 100 && g > r * 1.35 && g > b * 1.2;
                if (isGray || isGreen) d[i+3] = 0;
            }
            tc.putImageData(id, 0, 0);
            _sheetCanvas = tmp;
            _sheetReady  = true;
        };
        _sheet.onerror = function () {
            console.warn('[MeteorPunch] تعذّر تحميل meteor_sheet.png — تأكد من وجوده في نفس المجلد');
        };
        _sheet.src = SHEET_SRC;
    }

    // ─────────────────────────────────────────────
    // 3. نظام Energy Bar
    // ─────────────────────────────────────────────
    var Energy = {
        current: 0,
        max:     100,
        perHit:  22,        // طاقة لكل ضربة ناجحة
        full:    false,     // هل اكتملت؟

        add: function (amount) {
            if (this.full) return;
            this.current = Math.min(this.max, this.current + (amount || this.perHit));
            this._updateBar();
            if (this.current >= this.max) {
                this.current = this.max;
                this.full    = true;
                this._onFull();
            }
        },

        spend: function () {
            this.current = 0;
            this.full    = false;
            this._updateBar();
            this._onEmpty();
        },

        reset: function () {
            this.current = 0;
            this.full    = false;
            this._updateBar();
            this._onEmpty();
        },

        _updateBar: function () {
            var fill = document.getElementById('mpEnergyFill');
            var pct  = document.getElementById('mpEnergyPct');
            if (!fill) return;
            var w = (this.current / this.max * 100).toFixed(1);
            fill.style.width = w + '%';
            if (pct) pct.textContent = Math.floor(this.current) + '%';
        },

        _onFull: function () {
            // وميض + اهتزاز بسيط للبار
            var bar  = document.getElementById('mpEnergyBar');
            var btn  = document.getElementById('btnMeteor');
            if (bar) { bar.classList.add('mp-energy-ready'); }
            if (btn) { btn.classList.add('mp-btn-ready');    }
            // نص floating
            if (typeof damageNumbers !== 'undefined') {
                var p = (typeof p1 !== 'undefined' && p1) ? p1 : null;
                if (p) {
                    damageNumbers.push({
                        x: p.x, y: p.y - 110, vy: -2.2, alpha: 1,
                        text: '☄️ ULTIMATE READY!', color: '#ff6600', size: 18
                    });
                }
            }
            // Screen flash برتقالي خفيف
            if (typeof ScreenFlash !== 'undefined') {
                ScreenFlash.trigger('#ff8800', 0.18);
            }
        },

        _onEmpty: function () {
            var bar = document.getElementById('mpEnergyBar');
            var btn = document.getElementById('btnMeteor');
            if (bar) bar.classList.remove('mp-energy-ready');
            if (btn) btn.classList.remove('mp-btn-ready');
        }
    };

    // ─────────────────────────────────────────────
    // 4. حقن HTML — شريط Energy + زر Ultimate
    // ─────────────────────────────────────────────
    function _injectUI() {
        // ── CSS ──
        var style = document.createElement('style');
        style.textContent = [
            /* شريط الـ Energy */
            '#mpEnergyWrap{',
            '  position:absolute; bottom:14px; left:50%; transform:translateX(-50%);',
            '  width:160px; z-index:25; display:none; flex-direction:column; align-items:center; gap:3px;',
            '}',
            '#mpEnergyLabel{',
            '  font-size:0.6rem; font-weight:900; letter-spacing:2px; color:#ff8800;',
            '  text-shadow:0 0 6px rgba(255,120,0,0.9); text-transform:uppercase;',
            '}',
            '#mpEnergyBar{',
            '  width:100%; height:8px; border-radius:6px;',
            '  background:rgba(0,0,0,0.45); border:1px solid rgba(255,100,0,0.35);',
            '  overflow:hidden; box-shadow:0 0 8px rgba(255,80,0,0.2);',
            '  transition:box-shadow 0.3s;',
            '}',
            '#mpEnergyBar.mp-energy-ready{',
            '  border-color:rgba(255,140,0,0.9);',
            '  box-shadow:0 0 14px rgba(255,100,0,0.7), 0 0 28px rgba(255,60,0,0.35);',
            '  animation:mpEnergyPulse 0.6s ease-in-out infinite alternate;',
            '}',
            '@keyframes mpEnergyPulse{',
            '  from{box-shadow:0 0 10px rgba(255,100,0,0.5);}',
            '  to  {box-shadow:0 0 22px rgba(255,140,0,0.95), 0 0 44px rgba(255,60,0,0.4);}',
            '}',
            '#mpEnergyFill{',
            '  height:100%; width:0%; border-radius:6px;',
            '  background:linear-gradient(90deg,#ff4400,#ff8800,#ffcc00);',
            '  transition:width 0.25s ease-out;',
            '  box-shadow:0 0 6px rgba(255,140,0,0.6);',
            '}',
            '#mpEnergyPct{',
            '  font-size:0.55rem; color:rgba(255,200,100,0.75); font-weight:bold;',
            '}',

            /* زر الـ Ultimate */
            '#btnMeteor{',
            '  position:absolute; right:170px; bottom:160px;',
            '  width:52px; height:52px; border-radius:50%;',
            '  display:none; align-items:center; justify-content:center;',
            '  background:radial-gradient(circle,rgba(255,80,0,0.25),rgba(100,20,0,0.18));',
            '  border:2px solid rgba(255,100,0,0.45);',
            '  box-shadow:0 0 16px rgba(255,60,0,0.3); z-index:25;',
            '  cursor:pointer; touch-action:manipulation;',
            '  font-size:1.5rem; transition:transform 0.1s;',
            '  -webkit-tap-highlight-color:transparent;',
            '}',
            '#btnMeteor.mp-btn-ready{',
            '  border-color:rgba(255,140,0,0.95);',
            '  animation:mpBtnPulse 0.7s ease-in-out infinite alternate;',
            '}',
            '@keyframes mpBtnPulse{',
            '  from{box-shadow:0 0 12px rgba(255,80,0,0.5); transform:scale(1);}',
            '  to  {box-shadow:0 0 28px rgba(255,140,0,0.95), 0 0 50px rgba(255,60,0,0.4); transform:scale(1.08);}',
            '}',
            '#btnMeteor:active{transform:scale(0.88) !important;}',

            /* Cutscene overlay */
            '#mpCutscene{',
            '  position:fixed; inset:0; z-index:99999;',
            '  display:none; flex-direction:column;',
            '  align-items:center; justify-content:center;',
            '  background:rgba(0,0,0,0); pointer-events:none;',
            '  transition:background 0.25s;',
            '}',
            /* شريطان سينمائيان */
            '#mpCutscene .mp-bar-top,#mpCutscene .mp-bar-bot{',
            '  position:absolute; left:0; right:0; height:0;',
            '  background:#000; transition:height 0.25s ease-out;',
            '}',
            '#mpCutscene .mp-bar-top{top:0;}',
            '#mpCutscene .mp-bar-bot{bottom:0;}',
            '#mpCutscene.mp-cs-active .mp-bar-top,',
            '#mpCutscene.mp-cs-active .mp-bar-bot{ height:60px; }',
            /* نص المهارة */
            '#mpCutscene .mp-title{',
            '  font-size:2.4rem; font-weight:900; letter-spacing:4px;',
            '  color:transparent;',
            '  background:linear-gradient(90deg,#ff4400,#ffcc00,#ff4400);',
            '  -webkit-background-clip:text; background-clip:text;',
            '  background-size:200%;',
            '  text-shadow:none;',
            '  filter:drop-shadow(0 0 12px rgba(255,100,0,0.9)) drop-shadow(0 0 28px rgba(255,60,0,0.5));',
            '  opacity:0; transform:scale(0.4);',
            '  transition:opacity 0.2s, transform 0.25s cubic-bezier(0.34,1.56,0.64,1);',
            '  text-align:center; z-index:2; pointer-events:none;',
            '}',
            '#mpCutscene.mp-cs-active .mp-title{',
            '  opacity:1; transform:scale(1);',
            '  animation:mpTitleShimmer 1.2s linear infinite;',
            '}',
            '@keyframes mpTitleShimmer{',
            '  0%  {background-position:200% 0;}',
            '  100%{background-position:-200% 0;}',
            '}',
            /* هالة الشخصية أثناء الـ cutscene */
            '#mpAura{',
            '  position:absolute; width:180px; height:180px;',
            '  border-radius:50%; pointer-events:none;',
            '  background:radial-gradient(circle,rgba(255,120,0,0.45),transparent 70%);',
            '  animation:mpAuraPulse 0.35s ease-in-out infinite alternate;',
            '  display:none; z-index:1;',
            '}',
            '@keyframes mpAuraPulse{',
            '  from{transform:scale(0.9); opacity:0.7;}',
            '  to  {transform:scale(1.15); opacity:1;}',
            '}',
        ].join('\n');
        document.head.appendChild(style);

        // ── HTML: شريط Energy ──
        var gs = document.getElementById('gameScreen');
        if (!gs) return;

        var wrap = document.createElement('div');
        wrap.id = 'mpEnergyWrap';
        wrap.innerHTML = [
            '<div id="mpEnergyLabel">⚡ Energy</div>',
            '<div id="mpEnergyBar">',
            '  <div id="mpEnergyFill"></div>',
            '</div>',
            '<div id="mpEnergyPct">0%</div>',
        ].join('');
        gs.appendChild(wrap);

        // ── HTML: زر Ultimate ──
        var btn = document.createElement('div');
        btn.id = 'btnMeteor';
        btn.title = 'Meteor Punch ☄️';
        btn.textContent = '☄️';
        gs.appendChild(btn);

        // ── HTML: Cutscene overlay ──
        var cs = document.createElement('div');
        cs.id = 'mpCutscene';
        cs.innerHTML = [
            '<div class="mp-bar-top"></div>',
            '<div id="mpAura"></div>',
            '<div class="mp-title">☄️ METEOR PUNCH</div>',
            '<div class="mp-bar-bot"></div>',
        ].join('');
        document.body.appendChild(cs);
    }

    // ─────────────────────────────────────────────
    // 5. إظهار / إخفاء الـ UI أثناء المعركة
    // ─────────────────────────────────────────────
    function _showInGame() {
        var wrap = document.getElementById('mpEnergyWrap');
        var btn  = document.getElementById('btnMeteor');
        if (wrap) wrap.style.display = 'flex';
        if (btn)  btn.style.display  = 'flex';
    }
    function _hideInGame() {
        var wrap = document.getElementById('mpEnergyWrap');
        var btn  = document.getElementById('btnMeteor');
        if (wrap) wrap.style.display = 'none';
        if (btn)  btn.style.display  = 'none';
        Energy.reset();
    }

    // ─────────────────────────────────────────────
    // 6. رسم فريم من الـ Spritesheet على الـ canvas
    //    (يُستدعى من خارج الـ closure عبر MeteorPunch.drawFrame)
    // ─────────────────────────────────────────────
    function _drawFrame(ctx, frameKey, cx, cy, displayH, facing) {
        if (!_sheetReady || !_sheetCanvas) return;
        var fr = FRAMES[frameKey];
        if (!fr) return;
        var scale  = displayH / FH;
        var dw     = FW * scale;
        var dh     = FH * scale;

        ctx.save();
        ctx.translate(cx, cy);
        if (facing < 0) ctx.scale(-1, 1);
        ctx.drawImage(_sheetCanvas, fr.sx, fr.sy, FW, FH, -dw / 2, -dh, dw, dh);
        ctx.restore();
    }

    // ─────────────────────────────────────────────
    // 7. تسلسل أنيميشن الـ Cutscene (بدون تداخل فريمات)
    //    كل Phase لها وقت بداية ونهاية واضح.
    // ─────────────────────────────────────────────
    var _csActive   = false;
    var _csRaf      = null;
    var _csStart    = 0;
    var _csPhase    = '';   // 'charge' | 'summon' | 'trail' | 'windup' | 'impact' | 'aftermath'
    var _csCanvas   = null;
    var _csCtx      = null;

    // جدول الأوقات (ms من بداية الـ cutscene)
    var CS_TIMELINE = [
        { t:    0, end:  280, frame: 'charge',   label: 'CHARGING...' },
        { t:  280, end:  560, frame: 'summon',   label: 'METEOR SUMMONED!' },
        { t:  560, end:  840, frame: 'trail',    label: null },
        { t:  840, end: 1080, frame: 'windup',   label: null },
        { t: 1080, end: 1320, frame: 'impact',   label: 'METEOR PUNCH!!' },
        { t: 1320, end: 1600, frame: 'aftermath',label: null },
    ];
    var CS_TOTAL = 1600; // ms — إجمالي مدة الـ cutscene

    function _getCurrentPhase(elapsed) {
        for (var i = CS_TIMELINE.length - 1; i >= 0; i--) {
            if (elapsed >= CS_TIMELINE[i].t) return CS_TIMELINE[i];
        }
        return CS_TIMELINE[0];
    }

    function _runCutscene() {
        if (!_csActive) return;

        var elapsed = Date.now() - _csStart;

        // جيب الـ canvas الحالي من الـ game
        if (!_csCanvas) {
            _csCanvas = document.getElementById('gameCanvas');
            if (_csCanvas) _csCtx = _csCanvas.getContext('2d');
        }

        var phase = _getCurrentPhase(elapsed);

        // ─ ارسم فريم الـ phase الحالي فوق game canvas ─
        if (_csCtx && (typeof p1 !== 'undefined') && p1 && _sheetReady) {
            var cx = p1.x;
            var cy = (typeof CONFIG !== 'undefined') ? CONFIG.groundY : p1.y;

            // هالة نارية حول الشخصية
            _csCtx.save();
            var grd = _csCtx.createRadialGradient(cx, cy - 60, 10, cx, cy - 60, 90);
            var a   = 0.25 + 0.15 * Math.sin(elapsed * 0.02);
            grd.addColorStop(0, 'rgba(255,120,0,' + a + ')');
            grd.addColorStop(1, 'transparent');
            _csCtx.fillStyle = grd;
            _csCtx.beginPath();
            _csCtx.arc(cx, cy - 60, 90, 0, Math.PI * 2);
            _csCtx.fill();
            _csCtx.restore();

            // الفريم من الـ sheet
            _drawFrame(_csCtx, phase.frame, cx, cy, 130, p1.facing || 1);

            // جسيمات نارية
            _spawnCsParticles(_csCtx, cx, cy, elapsed);
        }

        // ─ نص المرحلة ─
        if (phase.label && _csCtx && _csCanvas) {
            var W = _csCanvas.width;
            var H = _csCanvas.height;
            var tAlpha = Math.min(1, (elapsed - phase.t) / 120);
            _csCtx.save();
            _csCtx.globalAlpha = tAlpha;
            _csCtx.font        = 'bold 28px "Segoe UI",sans-serif';
            _csCtx.textAlign   = 'center';
            _csCtx.strokeStyle = 'rgba(0,0,0,0.9)';
            _csCtx.lineWidth   = 5;
            _csCtx.fillStyle   = phase.frame === 'impact' ? '#ffdd00' : '#ff8800';
            _csCtx.strokeText(phase.label, W / 2, H / 2 - 10);
            _csCtx.fillText  (phase.label, W / 2, H / 2 - 10);
            _csCtx.restore();
        }

        // ─ Screen flash على الـ Impact ─
        if (elapsed >= 1080 && elapsed < 1180 && typeof ScreenFlash !== 'undefined') {
            ScreenFlash.trigger('#ff6600', Math.max(0, 0.6 - (elapsed - 1080) / 100 * 0.6));
        }

        if (elapsed < CS_TOTAL) {
            _csRaf = requestAnimationFrame(_runCutscene);
        } else {
            _endCutscene();
        }
    }

    // جسيمات أثناء الـ cutscene
    var _csParticles = [];
    function _spawnCsParticles(ctx, cx, cy, elapsed) {
        // أضف جسيمات جديدة
        if (Math.random() < 0.45) {
            var ang = Math.random() * Math.PI * 2;
            var spd = 1.5 + Math.random() * 3.5;
            _csParticles.push({
                x: cx + (Math.random() - 0.5) * 30,
                y: cy - 50 + (Math.random() - 0.5) * 40,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd - 2.5,
                life: 1.0,
                size: 2 + Math.random() * 4,
                color: Math.random() < 0.5 ? '#ff6600' : '#ffcc00'
            });
        }
        // حدّث وارسم
        for (var i = _csParticles.length - 1; i >= 0; i--) {
            var p = _csParticles[i];
            p.x   += p.vx; p.y += p.vy;
            p.vy  += 0.12;
            p.life -= 0.032;
            if (p.life <= 0) { _csParticles.splice(i, 1); continue; }
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle   = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur  = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function _startCutscene() {
        if (_csActive) return;
        _csActive  = true;
        _csStart   = Date.now();
        _csParticles = [];

        // أوقف حركة اللعبة (freeze)
        if (typeof gameActive !== 'undefined') {
            window._mpSavedGameActive = gameActive;
            gameActive = false;
        }
        // أوقف الـ AI timer مؤقتاً
        if (typeof animFrameId !== 'undefined' && animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }

        // Cinematic bars
        var cs = document.getElementById('mpCutscene');
        if (cs) {
            cs.style.display = 'flex';
            requestAnimationFrame(function () { cs.classList.add('mp-cs-active'); });
        }

        // Screen flash قوي في البداية
        if (typeof ScreenFlash !== 'undefined') ScreenFlash.trigger('#ffffff', 0.7);
        if (typeof ScreenShake !== 'undefined') ScreenShake.trigger(15, 18);

        // اشغّل الأنيميشن
        _csRaf = requestAnimationFrame(_runCutscene);
    }

    function _endCutscene() {
        _csActive = false;
        if (_csRaf) { cancelAnimationFrame(_csRaf); _csRaf = null; }

        // أخفي الـ overlay
        var cs = document.getElementById('mpCutscene');
        if (cs) {
            cs.classList.remove('mp-cs-active');
            setTimeout(function () { cs.style.display = 'none'; }, 260);
        }

        // نفّذ ضربة الـ Ultimate الفعلية
        _executeUltimate();
    }

    // ─────────────────────────────────────────────
    // 8. تنفيذ الضربة الفعلية بعد الـ Cutscene
    // ─────────────────────────────────────────────
    function _executeUltimate() {
        // أعد اللعبة
        if (typeof gameActive !== 'undefined') {
            gameActive = window._mpSavedGameActive !== false ? true : false;
        }
        if (typeof animFrameId !== 'undefined' && typeof gameLoop === 'function') {
            animFrameId = requestAnimationFrame(gameLoop);
        }

        if (!gameActive) return;

        var _p1 = (typeof p1 !== 'undefined') ? p1 : null;
        var _p2 = (typeof p2 !== 'undefined') ? p2 : null;
        if (!_p1 || !_p2) return;

        // الضربة: 3.5× الضرر الأساسي — لا تتأثر بالـ block
        var dmg = (_p1.damage || 12) * 3.5;

        // اكسر الـ block وأضف stun للعدو
        _p2.isBlocking   = false;
        _p2.blockStamina = 0;
        _p2.stunned      = 150;
        _p2.setState(
            (typeof STATES !== 'undefined') ? STATES.STUN : 'stun',
            true
        );

        // أعط الضرر
        if (typeof _p2.takeDamage === 'function') {
            _p2.invincible = false; // اكسر الـ invincibility مؤقتاً
            _p2.takeDamage(dmg, _p1);
        } else {
            _p2.health = Math.max(0, _p2.health - dmg);
        }

        // مؤثرات بصرية
        if (typeof ScreenShake  !== 'undefined') ScreenShake.trigger(20, 25);
        if (typeof ScreenFlash  !== 'undefined') ScreenFlash.trigger('#ff4400', 0.75);
        if (typeof SlowMo       !== 'undefined') SlowMo.trigger(0.06, 350);

        // جسيمات الانفجار
        if (typeof particles !== 'undefined') {
            for (var i = 0; i < 40; i++) {
                var ang  = (Math.PI * 2 / 40) * i;
                var spd  = 3 + Math.random() * 7;
                particles.push({
                    x: _p2.x, y: _p2.y - 50,
                    vx: Math.cos(ang) * spd,
                    vy: Math.sin(ang) * spd - 3,
                    size: 4 + Math.random() * 6,
                    alpha: 1,
                    color: Math.random() < 0.5 ? '#ff6600' : '#ffcc00',
                    gravity: 0.18,
                    life: 0.022,
                    type: 'heavy',
                    rotation: 0, rotSpeed: 0.2
                });
            }
        }

        // نص الضرر
        if (typeof damageNumbers !== 'undefined') {
            damageNumbers.push({
                x: _p2.x, y: _p2.y - 100,
                vy: -3.5, alpha: 1,
                text: '☄️ METEOR PUNCH!!',
                color: '#ffdd00', size: 24
            });
            damageNumbers.push({
                x: _p2.x + 20, y: _p2.y - 65,
                vy: -2.5, alpha: 1,
                text: '-' + Math.round(dmg),
                color: '#ff4400', size: 28
            });
        }

        // تحقق من نهاية المعركة
        if (typeof endBattle === 'function' && _p2.health <= 0) {
            setTimeout(function () { endBattle(true); }, 400);
        }

        // صفّر الـ energy
        Energy.spend();
    }

    // ─────────────────────────────────────────────
    // 9. ربط زر الـ Ultimate
    // ─────────────────────────────────────────────
    function _bindButton() {
        var btn = document.getElementById('btnMeteor');
        if (!btn) return;

        function onPress(e) {
            e.preventDefault();
            if (!Energy.full) return;
            if (_csActive)    return;
            if (typeof gameActive !== 'undefined' && !gameActive) return;
            // bounce animation
            btn.classList.remove('btn-pressed');
            void btn.offsetWidth;
            btn.classList.add('btn-pressed');
            // شغّل الـ cutscene
            _startCutscene();
        }

        btn.addEventListener('touchstart', onPress, { passive: false });
        btn.addEventListener('mousedown',  onPress);
    }

    // ─────────────────────────────────────────────
    // 10. مراقبة الضربات الناجحة (hook على takeDamage)
    //     بنراقب متغير p2.health بدل ما نغيّر الكود الأصلي
    // ─────────────────────────────────────────────
    var _lastP2Health = -1;

    function _watchHits() {
        // نشوف كل frame إذا انخفض health الـ p2 (يعني ضربة اتسجّلت)
        setInterval(function () {
            if (typeof gameActive === 'undefined' || !gameActive) return;
            if (typeof p2 === 'undefined'  || !p2) return;
            var hp = p2.health;
            if (_lastP2Health > 0 && hp < _lastP2Health) {
                // ضربة ناجحة — اشحن الـ energy
                var gained = Math.min(Energy.perHit, Energy.max - Energy.current);
                if (gained > 0 && !Energy.full) Energy.add(gained);
            }
            _lastP2Health = hp;
        }, 16); // ~60fps
    }

    // ─────────────────────────────────────────────
    // 11. Hook على startStage / endBattle لإظهار UI
    // ─────────────────────────────────────────────
    function _hookGameEvents() {
        // startStage — نظهر الـ UI بعد ما اللعبة تبدأ
        var _origStartStage = window.startStage;
        if (typeof _origStartStage === 'function') {
            window.startStage = function () {
                _origStartStage.apply(this, arguments);
                setTimeout(_showInGame, 2600); // بعد انتهاء شاشة "FIGHT!"
                _lastP2Health = -1;
                Energy.reset();
            };
        }

        // endBattle — نخفي الـ UI
        var _origEndBattle = window.endBattle;
        if (typeof _origEndBattle === 'function') {
            window.endBattle = function () {
                _hideInGame();
                if (_csActive) {
                    _csActive = false;
                    if (_csRaf) { cancelAnimationFrame(_csRaf); _csRaf = null; }
                    var cs = document.getElementById('mpCutscene');
                    if (cs) { cs.classList.remove('mp-cs-active'); cs.style.display = 'none'; }
                }
                _origEndBattle.apply(this, arguments);
            };
        }
    }

    // ─────────────────────────────────────────────
    // 12. Public API
    // ─────────────────────────────────────────────
    window.MeteorPunch = {
        // للاستخدام من الـ game loop لو حبيت تضيف رسم إضافي
        drawFrame:   _drawFrame,
        energy:      Energy,
        isActive:    function () { return _csActive; },
    };

    // ─────────────────────────────────────────────
    // 13. التهيئة — بعد تحميل الصفحة كاملاً
    // ─────────────────────────────────────────────
    function _init() {
        _loadSheet();
        _injectUI();
        _bindButton();
        _watchHits();
        _hookGameEvents();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }

})();
