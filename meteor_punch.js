// ═══════════════════════════════════════════════════════════════════
// ☄️  METEOR PUNCH — Ultimate Skill System  v3
//
//  ملف الشيت المطلوب (نفس مجلد adventure_mode.html):
//    ult_sheet.png   ← الشيت اللي هترفعه
//    (أضف اسم الشيت في SHEET_SRC أسفل)
//
//  طريقة الشغل:
//    • كل ضربة ناجحة تشحن الـ Energy bar
//    • لما تكتمل → Ultimate Mode تتفعل أوتوماتيك
//    • كل ضربة جوا الـ ultimate تبقى أقوى (x2.5 damage)
//      مع أنيميشن الشيت الجديد
//    • لما الـ Energy تخلص ترجع عادي
// ═══════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────
    // !! غيّر الاسم ده لما ترفع الشيت
    // ─────────────────────────────────────────────────────────────
    var SHEET_SRC  = 'ult_sheet.png';   // 12 فريم × 632×562
    var FRAME_W    = 632;
    var FRAME_H    = 562;
    var FRAME_COUNT= 12;

    // ─────────────────────────────────────────────────────────────
    // 1. تحميل الشيت + إزالة الخلفية الرمادية
    // ─────────────────────────────────────────────────────────────
    var _sheetCanvas = null;
    var _sheetReady  = false;

    function _loadSheet() {
        var img = new Image();
        img.onload = function () {
            // الشيت: 12 فريم × 632×562 — صف واحد أفقي
            // الخلفية اتشالت بـ Python قبل التحميل (ult_sheet.png شفاف)
            // بس نعيد الـ cleanup على الـ canvas لضمان النظافة
            var tmp = document.createElement('canvas');
            tmp.width  = img.naturalWidth;
            tmp.height = img.naturalHeight;
            var tc = tmp.getContext('2d');
            tc.drawImage(img, 0, 0);
            var id = tc.getImageData(0, 0, tmp.width, tmp.height);
            _removeGrayBg(id);
            tc.putImageData(id, 0, 0);
            _sheetCanvas = tmp;
            _sheetReady  = true;
        };
        img.onerror = function () {
            console.warn('[MeteorPunch] فشل تحميل: ' + SHEET_SRC +
                         ' — تأكد إن الملف موجود في نفس المجلد');
        };
        img.src = SHEET_SRC;
    }

    function _removeGrayBg(imageData) {
        var d = imageData.data;
        for (var i = 0; i < d.length; i += 4) {
            var r = d[i], g = d[i+1], b = d[i+2];
            var isGray = Math.abs(r-g) < 22 &&
                         Math.abs(g-b) < 22 &&
                         Math.abs(r-b) < 22 &&
                         r > 108;
            // إزالة الخضراء كمان لو موجودة
            var isGreen = g > 100 && g > r * 1.35 && g > b * 1.2;
            if (isGray || isGreen) d[i+3] = 0;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. رسم فريم من الشيت
    // ─────────────────────────────────────────────────────────────
    var _animFrame  = 0;
    var _animTimer  = 0;
    var _animFPS    = 10;   // فريمات في الثانية للأنيميشن

    function _drawUltFrame(ctx, cx, cy, dispH, facing) {
        if (!_sheetReady || !_sheetCanvas) return;
        var now   = Date.now();
        var mspf  = 1000 / _animFPS;
        if (now - _animTimer > mspf) {
            _animFrame = (_animFrame + 1) % FRAME_COUNT;
            _animTimer = now;
        }
        var sx    = _animFrame * FRAME_W;
        var scale = dispH / FRAME_H;
        var dw    = FRAME_W * scale;
        var dh    = FRAME_H * scale;

        ctx.save();
        ctx.translate(cx, cy);
        if (facing < 0) ctx.scale(-1, 1);
        ctx.drawImage(_sheetCanvas, sx, 0, FRAME_W, FRAME_H,
                      -dw / 2, -dh, dw, dh);
        ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────
    // 3. نظام Energy
    // ─────────────────────────────────────────────────────────────
    var Energy = {
        current:  0,
        max:      100,
        perHit:   20,          // شحن لكل ضربة
        drainRate: 8,          // استهلاك في الثانية وقت الـ ultimate
        full:     false,
        active:   false,       // هل الـ Ultimate Mode شغّالة؟

        add: function (amount) {
            if (this.active) return;   // مش بنشحن وهي شغّالة
            this.current = Math.min(this.max, this.current + (amount || this.perHit));
            this._updateBar();
            if (this.current >= this.max && !this.active) {
                this.current = this.max;
                this.full    = true;
                this._activate();
            }
        },

        drain: function (dtMs) {
            if (!this.active) return;
            this.current = Math.max(0, this.current - this.drainRate * (dtMs / 1000));
            this._updateBar();
            if (this.current <= 0) this._deactivate();
        },

        reset: function () {
            this.current = 0;
            this.full    = false;
            this.active  = false;
            this._updateBar();
            this._onDeactivated();
        },

        _activate: function () {
            this.active = true;
            this._onActivated();
        },

        _deactivate: function () {
            this.current = 0;
            this.full    = false;
            this.active  = false;
            this._updateBar();
            this._onDeactivated();
        },

        _updateBar: function () {
            var fill = document.getElementById('mpEnergyFill');
            var pct  = document.getElementById('mpEnergyPct');
            if (!fill) return;
            fill.style.width = (this.current / this.max * 100).toFixed(1) + '%';
            if (pct) pct.textContent = Math.floor(this.current) + '%';
        },

        _onActivated: function () {
            // وميض للإعلان
            if (typeof ScreenFlash !== 'undefined')
                ScreenFlash.trigger('#ff8800', 0.35);
            if (typeof ScreenShake !== 'undefined')
                ScreenShake.trigger(8, 10);
            if (typeof damageNumbers !== 'undefined' &&
                typeof p1 !== 'undefined' && p1) {
                damageNumbers.push({
                    x:p1.x, y:p1.y - 110,
                    vy:-2.5, alpha:1,
                    text:'☄️ ULTIMATE!',
                    color:'#ffcc00', size:22
                });
            }
            // Bar تتوهج
            var bar = document.getElementById('mpEnergyBar');
            if (bar) bar.classList.add('mp-ult-active');
            // زر يتوهج
            var btn = document.getElementById('btnMeteor');
            if (btn) btn.classList.add('mp-ult-active');
        },

        _onDeactivated: function () {
            var bar = document.getElementById('mpEnergyBar');
            var btn = document.getElementById('btnMeteor');
            if (bar) bar.classList.remove('mp-energy-ready', 'mp-ult-active');
            if (btn) btn.classList.remove('mp-btn-ready',    'mp-ult-active');
            // إعادة أنيميشن الشيت
            _animFrame = 0;
            _animTimer = 0;
        }
    };

    // ─────────────────────────────────────────────────────────────
    // 4. Ultimate Attack — الضربة القوية
    //    تُستدعى من الـ hook على btnAttack
    // ─────────────────────────────────────────────────────────────
    var ULT_DAMAGE_MULT = 2.5;   // مضاعف الضرر في الـ ultimate
    var ULT_DRAIN_HIT   = 28;    // كمية الـ drain لكل ضربة ناجحة

    function _onUltHit(targetFighter, attackerFighter) {
        // استهلاك إضافي من الـ energy
        Energy.current = Math.max(0, Energy.current - ULT_DRAIN_HIT);
        Energy._updateBar();

        // تأثيرات بصرية مميزة
        if (typeof ScreenShake !== 'undefined') ScreenShake.trigger(14, 12);
        if (typeof ScreenFlash !== 'undefined') ScreenFlash.trigger('#ff6600', 0.3);
        if (typeof SlowMo      !== 'undefined') SlowMo.trigger(0.1, 200);

        // جسيمات نارية حول الضربة
        if (typeof particles !== 'undefined' && targetFighter) {
            for (var i = 0; i < 20; i++) {
                var ang = Math.random() * Math.PI * 2;
                var spd = 2 + Math.random() * 5;
                particles.push({
                    x: targetFighter.x,
                    y: targetFighter.y - 50,
                    vx: Math.cos(ang) * spd,
                    vy: Math.sin(ang) * spd - 2,
                    size: 3 + Math.random() * 5,
                    alpha: 1,
                    color: Math.random() < 0.5 ? '#ff6600' : '#ffcc00',
                    gravity: 0.15,
                    life: 0.025,
                    type: 'heavy',
                    rotation: 0, rotSpeed: 0.18
                });
            }
        }

        // نص ULTIMATE فوق الضربة
        if (typeof damageNumbers !== 'undefined' && targetFighter) {
            damageNumbers.push({
                x: targetFighter.x,
                y: targetFighter.y - 90,
                vy: -2.8, alpha: 1,
                text: '☄️ ULT!',
                color: '#ffdd00', size: 20
            });
        }

        // لو الـ energy خلصت
        if (Energy.current <= 0) Energy._deactivate();
    }

    // ─────────────────────────────────────────────────────────────
    // 5. رسم أنيميشن الـ Ultimate فوق الشخصية (في الـ game loop)
    // ─────────────────────────────────────────────────────────────
    // يُستدعى من _hookGameLoop كل فريم لما الـ ultimate active
    function _drawUltOverlay(ctx) {
        if (!Energy.active || !_sheetReady) return;
        if (typeof p1 === 'undefined' || !p1) return;

        var cx     = p1.x + (p1.recoilX || 0);
        var cy     = p1.y;
        var facing = p1.facing || 1;

        // هالة نارية نابضة خلف الشخصية
        var t  = Date.now();
        var aR = 55 + 10 * Math.sin(t * 0.012);
        var grd = ctx.createRadialGradient(cx, cy - 55, 5, cx, cy - 55, aR);
        grd.addColorStop(0,   'rgba(255,140,0,0.5)');
        grd.addColorStop(0.5, 'rgba(255,60,0,0.2)');
        grd.addColorStop(1,   'transparent');
        ctx.save();
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(cx, cy - 55, aR, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // فريم الشيت فوق الشخصية
        _drawUltFrame(ctx, cx, cy, 130, facing);
    }

    // ─────────────────────────────────────────────────────────────
    // 6. CSS + HTML
    // ─────────────────────────────────────────────────────────────
    function _injectUI() {
        var style = document.createElement('style');
        style.textContent = [
            /* ── Energy Bar ── */
            '#mpEnergyWrap{',
            '  position:absolute;bottom:14px;left:50%;transform:translateX(-50%);',
            '  width:160px;z-index:25;display:none;',
            '  flex-direction:column;align-items:center;gap:3px;',
            '}',
            '#mpEnergyLabel{',
            '  font-size:0.6rem;font-weight:900;letter-spacing:2px;color:#ff8800;',
            '  text-shadow:0 0 6px rgba(255,120,0,0.9);',
            '}',
            '#mpEnergyBar{',
            '  width:100%;height:8px;border-radius:6px;',
            '  background:rgba(0,0,0,0.45);border:1px solid rgba(255,100,0,0.35);',
            '  overflow:hidden;box-shadow:0 0 8px rgba(255,80,0,0.15);',
            '  transition:border-color 0.3s, box-shadow 0.3s;',
            '}',
            '#mpEnergyFill{',
            '  height:100%;width:0%;border-radius:6px;',
            '  background:linear-gradient(90deg,#ff4400,#ff8800,#ffcc00);',
            '  transition:width 0.2s ease-out;',
            '  box-shadow:0 0 6px rgba(255,140,0,0.5);',
            '}',
            '#mpEnergyPct{',
            '  font-size:0.55rem;color:rgba(255,200,100,0.75);font-weight:bold;',
            '}',

            /* ── Ultimate Active State ── */
            '#mpEnergyBar.mp-ult-active{',
            '  border-color:rgba(255,180,0,0.95);',
            '  box-shadow:0 0 18px rgba(255,120,0,0.8),0 0 36px rgba(255,60,0,0.4);',
            '  animation:mpUltPulse 0.45s ease-in-out infinite alternate;',
            '}',
            '@keyframes mpUltPulse{',
            '  from{box-shadow:0 0 14px rgba(255,120,0,0.6);}',
            '  to  {box-shadow:0 0 28px rgba(255,180,0,1),0 0 55px rgba(255,80,0,0.5);}',
            '}',
            '#mpEnergyFill{transition:width 0.1s linear;}',

            /* ── زر الـ Ultimate (يظهر فقط لما الـ ultimate active) ── */
            '#btnMeteor{',
            '  position:absolute;right:170px;bottom:160px;',
            '  width:52px;height:52px;border-radius:50%;',
            '  display:none;align-items:center;justify-content:center;',
            '  background:radial-gradient(circle,rgba(255,80,0,0.3),rgba(100,20,0,0.2));',
            '  border:2px solid rgba(255,100,0,0.5);',
            '  z-index:25;pointer-events:none;',
            '  font-size:1.5rem;',
            '}',
            '#btnMeteor.mp-ult-active{',
            '  display:flex;',
            '  border-color:rgba(255,180,0,0.95);',
            '  animation:mpBtnUlt 0.5s ease-in-out infinite alternate;',
            '}',
            '@keyframes mpBtnUlt{',
            '  from{box-shadow:0 0 12px rgba(255,100,0,0.5);transform:scale(1);}',
            '  to  {box-shadow:0 0 26px rgba(255,180,0,0.95),0 0 50px rgba(255,60,0,0.45);transform:scale(1.1);}',
            '}',
        ].join('\n');
        document.head.appendChild(style);

        var gs = document.getElementById('gameScreen');
        if (!gs) return;

        // Energy Bar
        var wrap = document.createElement('div');
        wrap.id = 'mpEnergyWrap';
        wrap.innerHTML =
            '<div id="mpEnergyLabel">⚡ ENERGY</div>' +
            '<div id="mpEnergyBar"><div id="mpEnergyFill"></div></div>' +
            '<div id="mpEnergyPct">0%</div>';
        gs.appendChild(wrap);

        // مؤشر الـ Ultimate (مش زر — بس بيوضّح إن الـ ult active)
        var btn = document.createElement('div');
        btn.id = 'btnMeteor';
        btn.textContent = '☄️';
        gs.appendChild(btn);
    }

    // ─────────────────────────────────────────────────────────────
    // 7. Hook على الـ Game Loop عشان:
    //    أ) نرسم أنيميشن الـ ultimate فوق الشخصية
    //    ب) نعمل drain للـ energy وقت الـ ultimate
    // ─────────────────────────────────────────────────────────────
    var _lastDrainTime = 0;

    function _hookGameLoop() {
        var _origLoop = window.gameLoop;
        if (typeof _origLoop !== 'function') {
            // لو الـ gameLoop مش موجود بعد، نستنى
            setTimeout(_hookGameLoop, 200);
            return;
        }
        window.gameLoop = function (timestamp) {
            _origLoop.call(this, timestamp);

            // drain الـ energy
            if (Energy.active) {
                var now = Date.now();
                var dt  = _lastDrainTime ? now - _lastDrainTime : 16;
                _lastDrainTime = now;
                Energy.drain(dt);
            } else {
                _lastDrainTime = 0;
            }

            // ارسم أنيميشن الـ ultimate فوق اللعبة
            if (Energy.active) {
                var gc = document.getElementById('gameCanvas');
                if (gc) {
                    var gctx = gc.getContext('2d');
                    _drawUltOverlay(gctx);
                }
            }
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 8. Hook على الضربات عشان:
    //    أ) نشحن الـ energy لما اللاعب يضرب عادي
    //    ب) نضاعف الضرر + تأثيرات لما الـ ultimate active
    // ─────────────────────────────────────────────────────────────
    function _hookAttacks() {
        // مراقبة hp الـ p2 كل 16ms
        var _lastP2Hp = -1;

        setInterval(function () {
            if (typeof gameActive === 'undefined' || !gameActive) return;
            if (typeof p2 === 'undefined' || !p2) return;

            var hp = p2.health;

            if (_lastP2Hp > 0 && hp < _lastP2Hp) {
                var dmgDealt = _lastP2Hp - hp;

                if (Energy.active) {
                    // Ultimate hit — أضف damage إضافي
                    var bonus = dmgDealt * (ULT_DAMAGE_MULT - 1);
                    p2.health  = Math.max(0, p2.health - bonus);

                    // مؤثرات
                    _onUltHit(p2, p1);

                    // تحقق موت
                    if (p2.health <= 0 && typeof endBattle === 'function') {
                        setTimeout(function () { endBattle(true); }, 200);
                    }
                } else {
                    // ضربة عادية — اشحن
                    Energy.add();
                }
            }

            _lastP2Hp = hp;
        }, 16);
    }

    // ─────────────────────────────────────────────────────────────
    // 9. إظهار / إخفاء الـ UI
    // ─────────────────────────────────────────────────────────────
    function _showUI() {
        var wrap = document.getElementById('mpEnergyWrap');
        if (wrap) wrap.style.display = 'flex';
    }
    function _hideUI() {
        var wrap = document.getElementById('mpEnergyWrap');
        if (wrap) wrap.style.display = 'none';
        Energy.reset();
    }

    // ─────────────────────────────────────────────────────────────
    // 10. Hook على startStage / endBattle
    // ─────────────────────────────────────────────────────────────
    function _hookGameEvents() {
        var _origStart = window.startStage;
        if (typeof _origStart === 'function') {
            window.startStage = function () {
                _origStart.apply(this, arguments);
                setTimeout(function () {
                    _showUI();
                    Energy.reset();
                }, 2700);
            };
        }

        var _origEnd = window.endBattle;
        if (typeof _origEnd === 'function') {
            window.endBattle = function () {
                _hideUI();
                _origEnd.apply(this, arguments);
            };
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 11. Public API + Init
    // ─────────────────────────────────────────────────────────────
    window.MeteorPunch = {
        energy:    Energy,
        isUltActive: function () { return Energy.active; },
        // لو حبيت تغير اسم الشيت أو عدد الفريمات من الـ console
        setSheet:  function (src) { SHEET_SRC = src; _loadSheet(); },
        setFPS:    function (fps) { _animFPS  = fps; },
        setDamage: function (mult) { ULT_DAMAGE_MULT = mult; },
    };

    function _init() {
        _loadSheet();
        _injectUI();
        _hookAttacks();
        _hookGameEvents();
        // نستنى الـ gameLoop يكون موجود
        setTimeout(_hookGameLoop, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }

})();
