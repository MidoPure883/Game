// ═══════════════════════════════════════════════════════════════════
// ☄️  METEOR PUNCH — Ultimate Skill  v4
//
//  ملف مطلوب: ult_sheet.png (نفس المجلد)
//  أضف قبل </body>: <script src="meteor_punch.js"></script>
//
//  الطريقة:
//   • ضربات عادية → Energy تشحن
//   • Energy 100% → زر ☄️ يظهر ويومض
//   • اضغط الزر → سلسلة ضربات نارية تنطلق لوحدها
//     (مش محتاج تضغط attack — الـ ultimate تضرب بنفسها)
// ═══════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ─── إعدادات ───────────────────────────────────────────────
    var SHEET_SRC   = 'ult_sheet.png';
    var FRAME_W     = 619;
    var FRAME_H     = 547;
    var FRAME_COUNT = 12;

    // سرعة أنيميشن الشيت — فريم كل كام ms
    // كل فريم بيمشي مع ضربة → 12 ضربة ÷ ~3 ثواني = فريم كل 250ms
    var FRAME_MS    = 250;

    // عدد الضربات في سلسلة الـ ultimate
    var ULT_HITS    = 5;

    // وقت بين كل ضربة وضربة (ms)
    var HIT_INTERVAL = 350;

    // مضاعف الضرر لكل ضربة في الـ ultimate
    var ULT_DMG_MULT = 2.8;
    // ──────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────
    // 1. تحميل الشيت + إزالة الخلفية
    // ─────────────────────────────────────────────────────────────
    var _sheetCanvas = null;
    var _sheetReady  = false;

    function _loadSheet() {
        var img = new Image();
        img.onload = function () {
            var tmp = document.createElement('canvas');
            tmp.width  = img.naturalWidth;
            tmp.height = img.naturalHeight;
            var tc = tmp.getContext('2d');
            tc.drawImage(img, 0, 0);
            var id = tc.getImageData(0, 0, tmp.width, tmp.height);
            var d  = id.data;
            for (var i = 0; i < d.length; i += 4) {
                var r = d[i], g = d[i+1], b = d[i+2];
                var gray  = Math.abs(r-g)<22 && Math.abs(g-b)<22 && r>108;
                var green = g>100 && g > r*1.35 && g > b*1.2;
                if (gray || green) d[i+3] = 0;
            }
            tc.putImageData(id, 0, 0);
            _sheetCanvas = tmp;
            _sheetReady  = true;
        };
        img.onerror = function () {
            console.warn('[MeteorPunch] فشل تحميل: ' + SHEET_SRC);
        };
        img.src = SHEET_SRC;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. رسم فريم الشيت
    // ─────────────────────────────────────────────────────────────
    var _curFrame  = 0;
    var _frameTime = 0;

    function _tickAndDraw(ctx, cx, cy, dispH, facing) {
        if (!_sheetReady || !_sheetCanvas) return;

        var now = Date.now();
        if (now - _frameTime >= FRAME_MS) {
            _curFrame  = (_curFrame + 1) % FRAME_COUNT;
            _frameTime = now;
        }

        var sx    = _curFrame * FRAME_W;
        var scale = dispH / FRAME_H;
        var dw    = FRAME_W * scale;
        var dh    = FRAME_H * scale;

        ctx.save();
        ctx.translate(cx, cy);
        if (facing < 0) ctx.scale(-1, 1);
        ctx.drawImage(_sheetCanvas, sx, 0, FRAME_W, FRAME_H,
                      -dw/2, -dh, dw, dh);
        ctx.restore();
    }

    function _resetAnim() {
        _curFrame  = 0;
        _frameTime = Date.now();
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Energy Bar
    // ─────────────────────────────────────────────────────────────
    var _energy    = 0;      // 0 → 100
    var _energyMax = 100;
    var _energyFull= false;  // جاهزة للضغط

    function _addEnergy(amount) {
        if (_energyFull) return;
        _energy = Math.min(_energyMax, _energy + (amount || 20));
        _updateBar();
        if (_energy >= _energyMax) {
            _energyFull = true;
            _onEnergyFull();
        }
    }

    function _resetEnergy() {
        _energy     = 0;
        _energyFull = false;
        _updateBar();
        _setBarState('');
        var btn = document.getElementById('btnMeteor');
        if (btn) btn.style.display = 'none';
    }

    function _updateBar() {
        var fill = document.getElementById('mpEnergyFill');
        if (fill) fill.style.width = (_energy / _energyMax * 100).toFixed(1) + '%';
    }

    function _setBarState(state) {
        // state: '' | 'ready' | 'active'
        var bar = document.getElementById('mpEnergyBar');
        if (!bar) return;
        bar.classList.remove('mp-bar-ready', 'mp-bar-active');
        if (state) bar.classList.add('mp-bar-' + state);
    }

    function _onEnergyFull() {
        _setBarState('ready');
        var btn = document.getElementById('btnMeteor');
        if (btn) {
            btn.style.display = 'flex';
            btn.classList.add('mp-btn-ready');
            btn.classList.remove('mp-btn-active');
        }
        // إعلان
        if (typeof ScreenFlash !== 'undefined') ScreenFlash.trigger('#ffaa00', 0.22);
        if (typeof damageNumbers !== 'undefined' && typeof p1 !== 'undefined' && p1) {
            damageNumbers.push({
                x:p1.x, y:p1.y-110, vy:-2.2, alpha:1,
                text:'☄️ ULTIMATE READY!', color:'#ffdd00', size:19
            });
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Ultimate — سلسلة ضربات تنطلق لوحدها
    // ─────────────────────────────────────────────────────────────
    var _ultActive  = false;
    var _ultTimers  = [];    // تخزين الـ timeouts عشان نقدر نلغيها

    function _fireUltimate() {
        if (_ultActive || !_energyFull) return;
        if (typeof gameActive === 'undefined' || !gameActive) return;

        _ultActive = true;
        _energyFull = false;
        _resetAnim();

        // وميض + shake عند التفعيل
        if (typeof ScreenFlash !== 'undefined') ScreenFlash.trigger('#ff6600', 0.4);
        if (typeof ScreenShake !== 'undefined') ScreenShake.trigger(10, 12);

        // تحديث الـ UI
        _setBarState('active');
        var btn = document.getElementById('btnMeteor');
        if (btn) {
            btn.classList.remove('mp-btn-ready');
            btn.classList.add('mp-btn-active');
        }

        // أطلق ULT_HITS ضربات بفاصل HIT_INTERVAL
        for (var i = 0; i < ULT_HITS; i++) {
            (function(hitIndex) {
                var t = setTimeout(function () {
                    _doOneHit(hitIndex);
                }, hitIndex * HIT_INTERVAL);
                _ultTimers.push(t);
            })(i);
        }

        // بعد كل الضربات — انهِ الـ ultimate
        var endT = setTimeout(function () {
            _endUltimate();
        }, ULT_HITS * HIT_INTERVAL + 200);
        _ultTimers.push(endT);
    }

    function _doOneHit(hitIndex) {
        if (!gameActive) return;

        var _p1 = (typeof p1 !== 'undefined') ? p1 : null;
        var _p2 = (typeof p2 !== 'undefined') ? p2 : null;
        if (!_p1 || !_p2 || _p2.health <= 0) return;

        // ── حساب الضرر ──
        var baseDmg = Math.max(1, Number(_p1.damage) || 12);
        var dmg     = baseDmg * ULT_DMG_MULT;

        // ── كسر الـ block ──
        _p2.isBlocking   = false;
        _p2.blockStamina = 0;

        // ── إزالة الـ invincibility مؤقتاً ──
        var wasInvincible      = _p2.invincible;
        var wasInvincibleEnd   = _p2.invincibleEnd;
        _p2.invincible         = false;

        // ── اعمل الضرر ──
        if (typeof _p2.takeDamage === 'function') {
            _p2.takeDamage(dmg, _p1);
        } else {
            _p2.health = Math.max(0, _p2.health - dmg);
        }

        // ── اعدّل الـ state animation للاعب ──
        if (typeof STATES !== 'undefined' && typeof _p1.setState === 'function') {
            _p1.setState(STATES.ATTACK_LIGHT, true);
            setTimeout(function () {
                if (_p1 && _p1.state === STATES.ATTACK_LIGHT)
                    _p1.setState(STATES.IDLE, true);
            }, 200);
        }

        // ── مؤثرات الضربة ──
        if (typeof ScreenShake !== 'undefined') ScreenShake.trigger(12, 10);
        if (typeof ScreenFlash !== 'undefined') ScreenFlash.trigger('#ff4400', 0.28);
        if (typeof SlowMo      !== 'undefined') SlowMo.trigger(0.12, 150);

        // جسيمات نار
        if (typeof particles !== 'undefined') {
            for (var j = 0; j < 18; j++) {
                var ang = Math.random() * Math.PI * 2;
                var spd = 2 + Math.random() * 5;
                particles.push({
                    x: _p2.x, y: _p2.y - 50,
                    vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd - 2.5,
                    size: 3 + Math.random()*5, alpha: 1,
                    color: hitIndex % 2 === 0 ? '#ff6600' : '#ffdd00',
                    gravity: 0.15, life: 0.024,
                    type: 'heavy', rotation: 0, rotSpeed: 0.18
                });
            }
        }

        // رقم الضرر
        if (typeof damageNumbers !== 'undefined') {
            var labels = ['☄️','🔥','💥','⚡','☄️'];
            damageNumbers.push({
                x: _p2.x + (Math.random()-0.5)*40,
                y: _p2.y - 70 - hitIndex*15,
                vy: -3, alpha: 1,
                text: labels[hitIndex % labels.length] + ' -' + Math.round(dmg),
                color: '#ffdd00', size: 22
            });
        }

        // تحقق موت بعد كل ضربة
        if (_p2.health <= 0 && typeof endBattle === 'function') {
            _cancelUltTimers();
            _endUltimate();
            setTimeout(function () { endBattle(true); }, 250);
        }
    }

    function _endUltimate() {
        _ultActive = false;
        _cancelUltTimers();
        _resetEnergy();
        _resetAnim();

        // آخر flash
        if (typeof ScreenFlash !== 'undefined') ScreenFlash.trigger('#ff8800', 0.15);
    }

    function _cancelUltTimers() {
        for (var i = 0; i < _ultTimers.length; i++) clearTimeout(_ultTimers[i]);
        _ultTimers = [];
    }

    // ─────────────────────────────────────────────────────────────
    // 5. رسم Overlay في الـ game loop
    //    يُستدعى من hook على gameLoop
    // ─────────────────────────────────────────────────────────────
    function _drawOverlay(ctx) {
        if (!_ultActive && !_energyFull) return;
        if (typeof p1 === 'undefined' || !p1) return;

        var cx     = p1.x + (p1.recoilX || 0);
        var cy     = p1.y;
        var facing = p1.facing || 1;

        if (_ultActive && _sheetReady) {
            // هالة نارية نابضة
            var t   = Date.now();
            var aR  = 60 + 14 * Math.sin(t * 0.014);
            var grd = ctx.createRadialGradient(cx, cy-58, 4, cx, cy-58, aR);
            grd.addColorStop(0,   'rgba(255,140,0,0.55)');
            grd.addColorStop(0.5, 'rgba(255,60,0,0.22)');
            grd.addColorStop(1,   'transparent');
            ctx.save();
            ctx.fillStyle = grd;
            ctx.beginPath(); ctx.arc(cx, cy-58, aR, 0, Math.PI*2); ctx.fill();
            ctx.restore();

            // فريم الشيت
            _tickAndDraw(ctx, cx, cy, 132, facing);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 6. Hook على gameLoop
    // ─────────────────────────────────────────────────────────────
    function _hookGameLoop() {
        var _orig = window.gameLoop;
        if (typeof _orig !== 'function') {
            setTimeout(_hookGameLoop, 200); return;
        }
        window.gameLoop = function (ts) {
            _orig.call(this, ts);
            if (_ultActive || _energyFull) {
                var gc = document.getElementById('gameCanvas');
                if (gc) _drawOverlay(gc.getContext('2d'));
            }
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 7. مراقبة ضربات اللاعب → شحن الـ energy
    // ─────────────────────────────────────────────────────────────
    function _watchHits() {
        var _lastHp = -1;
        setInterval(function () {
            if (typeof gameActive === 'undefined' || !gameActive) return;
            if (typeof p2 === 'undefined' || !p2) return;
            if (_ultActive) { _lastHp = p2.health; return; }   // متشحنيش وقت الـ ult

            var hp = p2.health;
            if (_lastHp > 0 && hp < _lastHp) _addEnergy(22);
            _lastHp = hp;
        }, 16);
    }

    // ─────────────────────────────────────────────────────────────
    // 8. CSS + HTML
    // ─────────────────────────────────────────────────────────────
    function _injectUI() {
        var css = document.createElement('style');
        css.textContent = [
            /* Energy wrap */
            '#mpEnergyWrap{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);',
            'width:160px;z-index:25;display:none;flex-direction:column;align-items:center;gap:3px;}',

            '#mpEnergyLabel{font-size:0.6rem;font-weight:900;letter-spacing:2px;',
            'color:#ff8800;text-shadow:0 0 6px rgba(255,120,0,0.9);}',

            '#mpEnergyBar{width:100%;height:8px;border-radius:6px;',
            'background:rgba(0,0,0,0.45);border:1px solid rgba(255,100,0,0.3);',
            'overflow:hidden;transition:border-color .3s,box-shadow .3s;}',

            '#mpEnergyFill{height:100%;width:0%;border-radius:6px;',
            'background:linear-gradient(90deg,#ff4400,#ff8800,#ffcc00);',
            'transition:width .18s ease-out;box-shadow:0 0 5px rgba(255,140,0,.5);}',

            '#mpEnergyPct{font-size:.55rem;color:rgba(255,200,100,.75);font-weight:bold;}',

            /* bar ready */
            '#mpEnergyBar.mp-bar-ready{border-color:rgba(255,200,0,.9);',
            'animation:mpBarR .6s ease-in-out infinite alternate;}',
            '@keyframes mpBarR{from{box-shadow:0 0 8px rgba(255,150,0,.4);}',
            'to{box-shadow:0 0 20px rgba(255,200,0,.9),0 0 40px rgba(255,80,0,.4);}}',

            /* bar active */
            '#mpEnergyBar.mp-bar-active{border-color:rgba(255,80,0,.95);',
            'animation:mpBarA .35s ease-in-out infinite alternate;}',
            '@keyframes mpBarA{from{box-shadow:0 0 12px rgba(255,80,0,.5);}',
            'to{box-shadow:0 0 26px rgba(255,120,0,1),0 0 52px rgba(255,40,0,.5);}}',

            /* زر */
            '#btnMeteor{position:absolute;right:170px;bottom:160px;',
            'width:56px;height:56px;border-radius:50%;',
            'display:none;align-items:center;justify-content:center;',
            'background:radial-gradient(circle,rgba(255,80,0,.28),rgba(80,10,0,.18));',
            'border:2px solid rgba(255,100,0,.45);z-index:25;',
            'cursor:pointer;touch-action:manipulation;',
            '-webkit-tap-highlight-color:transparent;',
            'font-size:1.6rem;transition:transform .08s;}',

            '#btnMeteor.mp-btn-ready{',
            'border-color:rgba(255,200,0,.95);',
            'animation:mpBtnR .55s ease-in-out infinite alternate;}',
            '@keyframes mpBtnR{from{box-shadow:0 0 10px rgba(255,150,0,.5);transform:scale(1);}',
            'to{box-shadow:0 0 24px rgba(255,200,0,.95),0 0 48px rgba(255,80,0,.45);transform:scale(1.1);}}',

            '#btnMeteor.mp-btn-active{',
            'border-color:rgba(255,80,0,.95);cursor:default;',
            'animation:mpBtnA .3s ease-in-out infinite alternate;}',
            '@keyframes mpBtnA{from{box-shadow:0 0 14px rgba(255,80,0,.6);transform:scale(1);}',
            'to{box-shadow:0 0 30px rgba(255,120,0,1),0 0 60px rgba(255,40,0,.5);transform:scale(1.12);}}',

            '#btnMeteor:active{transform:scale(.88)!important;}',
        ].join('');
        document.head.appendChild(css);

        var gs = document.getElementById('gameScreen');
        if (!gs) return;

        var wrap = document.createElement('div');
        wrap.id = 'mpEnergyWrap';
        wrap.innerHTML =
            '<div id="mpEnergyLabel">⚡ ENERGY</div>' +
            '<div id="mpEnergyBar"><div id="mpEnergyFill"></div></div>' +
            '<div id="mpEnergyPct">0%</div>';
        gs.appendChild(wrap);

        var btn = document.createElement('div');
        btn.id = 'btnMeteor';
        btn.textContent = '☄️';
        gs.appendChild(btn);
    }

    // ─────────────────────────────────────────────────────────────
    // 9. ربط زر الـ Ultimate
    // ─────────────────────────────────────────────────────────────
    function _bindButton() {
        // ننتظر الـ DOM يكون جاهز
        var btn = document.getElementById('btnMeteor');
        if (!btn) { setTimeout(_bindButton, 300); return; }

        function onPress(e) {
            e.preventDefault();
            if (!_energyFull || _ultActive) return;
            if (typeof gameActive !== 'undefined' && !gameActive) return;
            _fireUltimate();
        }
        btn.addEventListener('touchstart', onPress, { passive: false });
        btn.addEventListener('mousedown',  onPress);
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
                    _resetEnergy();
                    _cancelUltTimers();
                    _ultActive = false;
                    document.getElementById('mpEnergyWrap').style.display = 'flex';
                }, 2700);
            };
        }

        var _origEnd = window.endBattle;
        if (typeof _origEnd === 'function') {
            window.endBattle = function () {
                _cancelUltTimers();
                _ultActive = false;
                _resetEnergy();
                var wrap = document.getElementById('mpEnergyWrap');
                if (wrap) wrap.style.display = 'none';
                _origEnd.apply(this, arguments);
            };
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 11. Init
    // ─────────────────────────────────────────────────────────────
    window.MeteorPunch = {
        fire:    _fireUltimate,
        // ضبط من الـ console لو حبيت:
        setFPS:     function(ms){ FRAME_MS    = ms; },
        setHits:    function(n) { ULT_HITS    = n;  },
        setInterval:function(ms){ HIT_INTERVAL= ms; },
        setDamage:  function(x) { ULT_DMG_MULT= x;  },
    };

    function _init() {
        _loadSheet();
        _injectUI();
        _watchHits();
        _hookGameEvents();
        setTimeout(function () {
            _hookGameLoop();
            _bindButton();
        }, 600);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }

})();
