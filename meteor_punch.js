// ═══════════════════════════════════════════════════════════════════
// ☄️  METEOR PUNCH — Ultimate Skill System  v2
//
//  ملفات مطلوبة (نفس مجلد adventure_mode.html):
//    punch_sheet.png     — 8 فريم × 732×704   حركة اللاعب
//    meteor_sheet.png    — 6 فريم × 848×832   سقوط النيزك
//    explosion_sheet.png — 8 فريم × 732×704   الانفجار
//    shockwave_sheet.png — 4 فريم × 1032×1024 الصدمة الأرضية
//
//  أضف قبل </body>:
//    <script src="meteor_punch.js"></script>
// ═══════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────
    // 1. تعريف الشيتات الأربعة
    // ─────────────────────────────────────────────────────────────
    var SHEETS = {
        punch:     { src:'punch_sheet.png',     frames:8, fw:732,  fh:704  },
        meteor:    { src:'meteor_sheet.png',     frames:6, fw:848,  fh:832  },
        explosion: { src:'explosion_sheet.png',  frames:8, fw:732,  fh:704  },
        shockwave: { src:'shockwave_sheet.png',  frames:4, fw:1032, fh:1024 },
    };

    var _ready    = { punch:false, meteor:false, explosion:false, shockwave:false };
    var _canvases = { punch:null,  meteor:null,  explosion:null,  shockwave:null  };

    // ─────────────────────────────────────────────────────────────
    // 2. تحميل + إزالة الخلفية الرمادية على الـ canvas مباشرة
    // ─────────────────────────────────────────────────────────────
    function _removeGrayBg(imageData, threshold) {
        var d   = imageData.data;
        var thr = threshold || 108;
        for (var i = 0; i < d.length; i += 4) {
            var r = d[i], g = d[i+1], b = d[i+2];
            var isGray  = Math.abs(r-g) < 22 &&
                          Math.abs(g-b) < 22 &&
                          Math.abs(r-b) < 22;
            var inRange = r >= thr;
            if (isGray && inRange) d[i+3] = 0;
        }
        return imageData;
    }

    function _loadSheet(name, threshold) {
        var cfg = SHEETS[name];
        var img = new Image();
        img.onload = function () {
            var tmp = document.createElement('canvas');
            tmp.width  = img.naturalWidth;
            tmp.height = img.naturalHeight;
            var tc = tmp.getContext('2d');
            tc.drawImage(img, 0, 0);
            var id = tc.getImageData(0, 0, tmp.width, tmp.height);
            _removeGrayBg(id, threshold);
            tc.putImageData(id, 0, 0);
            _canvases[name] = tmp;
            _ready[name]    = true;
        };
        img.onerror = function () {
            console.warn('[MeteorPunch] فشل تحميل: ' + cfg.src);
        };
        img.src = cfg.src;
    }

    function _loadAllSheets() {
        _loadSheet('punch',     108);
        _loadSheet('meteor',    108);
        _loadSheet('explosion', 195); // خلفية فاتحة جداً تحتاج threshold أعلى
        _loadSheet('shockwave', 108);
    }

    // ─────────────────────────────────────────────────────────────
    // 3. رسم فريم من شيت على canvas
    // ─────────────────────────────────────────────────────────────
    function _drawFrame(ctx, name, frameIdx, cx, cy, dispH, facing, alpha) {
        if (!_ready[name] || !_canvases[name]) return;
        var cfg   = SHEETS[name];
        var fi    = Math.max(0, Math.min(frameIdx, cfg.frames - 1));
        var sx    = fi * cfg.fw;
        var scale = dispH / cfg.fh;
        var dw    = cfg.fw * scale;
        var dh    = cfg.fh * scale;

        ctx.save();
        if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
        ctx.translate(cx, cy);
        if (facing < 0) ctx.scale(-1, 1);
        ctx.drawImage(_canvases[name], sx, 0, cfg.fw, cfg.fh,
                      -dw / 2, -dh, dw, dh);
        ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────
    // 4. نظام Energy Bar
    // ─────────────────────────────────────────────────────────────
    var Energy = {
        current: 0,
        max:     100,
        perHit:  22,
        full:    false,

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
            fill.style.width = (this.current / this.max * 100).toFixed(1) + '%';
            if (pct) pct.textContent = Math.floor(this.current) + '%';
        },

        _onFull: function () {
            var bar = document.getElementById('mpEnergyBar');
            var btn = document.getElementById('btnMeteor');
            if (bar) bar.classList.add('mp-energy-ready');
            if (btn) btn.classList.add('mp-btn-ready');
            if (typeof damageNumbers !== 'undefined' &&
                typeof p1 !== 'undefined' && p1) {
                damageNumbers.push({
                    x:p1.x, y:p1.y-110, vy:-2.2, alpha:1,
                    text:'☄️ ULTIMATE READY!', color:'#ff6600', size:18
                });
            }
            if (typeof ScreenFlash !== 'undefined')
                ScreenFlash.trigger('#ff8800', 0.18);
        },

        _onEmpty: function () {
            var bar = document.getElementById('mpEnergyBar');
            var btn = document.getElementById('btnMeteor');
            if (bar) bar.classList.remove('mp-energy-ready');
            if (btn) btn.classList.remove('mp-btn-ready');
        }
    };

    // ─────────────────────────────────────────────────────────────
    // 5. CSS + HTML
    // ─────────────────────────────────────────────────────────────
    function _injectUI() {
        var style = document.createElement('style');
        style.textContent = [
            '#mpEnergyWrap{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);',
            'width:160px;z-index:25;display:none;flex-direction:column;align-items:center;gap:3px;}',

            '#mpEnergyLabel{font-size:0.6rem;font-weight:900;letter-spacing:2px;color:#ff8800;',
            'text-shadow:0 0 6px rgba(255,120,0,0.9);}',

            '#mpEnergyBar{width:100%;height:8px;border-radius:6px;',
            'background:rgba(0,0,0,0.45);border:1px solid rgba(255,100,0,0.35);',
            'overflow:hidden;box-shadow:0 0 8px rgba(255,80,0,0.2);transition:box-shadow 0.3s;}',

            '#mpEnergyBar.mp-energy-ready{border-color:rgba(255,140,0,0.9);',
            'animation:mpEPulse 0.6s ease-in-out infinite alternate;}',

            '@keyframes mpEPulse{',
            'from{box-shadow:0 0 10px rgba(255,100,0,0.5);}',
            'to{box-shadow:0 0 22px rgba(255,140,0,0.95),0 0 44px rgba(255,60,0,0.4);}}',

            '#mpEnergyFill{height:100%;width:0%;border-radius:6px;',
            'background:linear-gradient(90deg,#ff4400,#ff8800,#ffcc00);',
            'transition:width 0.25s ease-out;box-shadow:0 0 6px rgba(255,140,0,0.6);}',

            '#mpEnergyPct{font-size:0.55rem;color:rgba(255,200,100,0.75);font-weight:bold;}',

            '#btnMeteor{position:absolute;right:170px;bottom:160px;',
            'width:52px;height:52px;border-radius:50%;',
            'display:none;align-items:center;justify-content:center;',
            'background:radial-gradient(circle,rgba(255,80,0,0.25),rgba(100,20,0,0.18));',
            'border:2px solid rgba(255,100,0,0.45);',
            'box-shadow:0 0 16px rgba(255,60,0,0.3);z-index:25;',
            'cursor:pointer;touch-action:manipulation;font-size:1.5rem;',
            'transition:transform 0.1s;-webkit-tap-highlight-color:transparent;}',

            '#btnMeteor.mp-btn-ready{border-color:rgba(255,140,0,0.95);',
            'animation:mpBPulse 0.7s ease-in-out infinite alternate;}',

            '@keyframes mpBPulse{',
            'from{box-shadow:0 0 12px rgba(255,80,0,0.5);transform:scale(1);}',
            'to{box-shadow:0 0 28px rgba(255,140,0,0.95),0 0 50px rgba(255,60,0,0.4);transform:scale(1.08);}}',

            '#btnMeteor:active{transform:scale(0.88)!important;}',

            '#mpCutscene{position:absolute;inset:0;z-index:490;display:none;pointer-events:none;}',

            '#mpCutscene .mp-bar-top,#mpCutscene .mp-bar-bot{',
            'position:absolute;left:0;right:0;height:0;',
            'background:#000;transition:height 0.2s ease-out;z-index:2;}',

            '#mpCutscene .mp-bar-top{top:0;}',
            '#mpCutscene .mp-bar-bot{bottom:0;}',

            '#mpCutscene.mp-cs-active .mp-bar-top,',
            '#mpCutscene.mp-cs-active .mp-bar-bot{height:55px;}',
        ].join('');
        document.head.appendChild(style);

        var gs = document.getElementById('gameScreen');
        if (!gs) return;

        // Energy bar
        var wrap = document.createElement('div');
        wrap.id = 'mpEnergyWrap';
        wrap.innerHTML =
            '<div id="mpEnergyLabel">⚡ ENERGY</div>' +
            '<div id="mpEnergyBar"><div id="mpEnergyFill"></div></div>' +
            '<div id="mpEnergyPct">0%</div>';
        gs.appendChild(wrap);

        // زر Ultimate
        var btn = document.createElement('div');
        btn.id = 'btnMeteor';
        btn.title = '☄️ Meteor Punch';
        btn.textContent = '☄️';
        gs.appendChild(btn);

        // Cinematic bars container
        var cs = document.createElement('div');
        cs.id = 'mpCutscene';
        cs.innerHTML =
            '<div class="mp-bar-top"></div>' +
            '<div class="mp-bar-bot"></div>';
        gs.appendChild(cs);
    }

    // ─────────────────────────────────────────────────────────────
    // 6. Overlay Canvas
    // ─────────────────────────────────────────────────────────────
    var _ovCanvas = null;
    var _ovCtx    = null;

    function _ensureOverlay() {
        if (_ovCanvas) return;
        var gs = document.getElementById('gameScreen');
        if (!gs) return;
        _ovCanvas = document.createElement('canvas');
        _ovCanvas.style.cssText =
            'position:absolute;top:0;left:0;width:100%;height:100%;' +
            'pointer-events:none;z-index:450;display:none;';
        gs.insertBefore(_ovCanvas, gs.firstChild);
        _ovCtx = _ovCanvas.getContext('2d');
    }

    function _syncSize() {
        var gs = document.getElementById('gameScreen');
        var W  = gs ? gs.offsetWidth  : window.innerWidth;
        var H  = gs ? gs.offsetHeight : window.innerHeight;
        if (_ovCanvas.width  !== W) _ovCanvas.width  = W;
        if (_ovCanvas.height !== H) _ovCanvas.height = H;
        return { W:W, H:H };
    }

    // ─────────────────────────────────────────────────────────────
    // 7. Cutscene Loop
    //
    //   0   → 400ms  punch  فريم 0→3  اللاعب يستعد ويشحن
    //   400 → 900ms  punch  فريم 4→7  اللاعب يطلق + النيزك يبدأ
    //   400 →1300ms  meteor فريم 0→5  النيزك يسقط نحو العدو
    //   900 →1500ms  explosion 0→7    الانفجار
    //  1300 →1700ms  shockwave 0→3    الصدمة الأرضية
    //  1700 →1900ms  fade out
    // ─────────────────────────────────────────────────────────────
    var _csActive = false;
    var _csRaf    = null;
    var _csStart  = 0;
    var _csParticles = [];
    var CS_TOTAL  = 1900;

    function _phaseFrame(sheet, elapsed, t0, t1) {
        var n   = SHEETS[sheet].frames;
        var pct = Math.max(0, Math.min(1, (elapsed - t0) / (t1 - t0)));
        return Math.min(n - 1, Math.floor(pct * n));
    }

    function _runCutscene() {
        if (!_csActive) return;

        var elapsed = Date.now() - _csStart;
        var sz  = _syncSize();
        var W = sz.W, H = sz.H;
        var ctx = _ovCtx;

        // ══ امسح الـ overlay كل frame ══
        ctx.clearRect(0, 0, W, H);

        // مواضع الشخصيات
        var p1x    = (typeof p1 !== 'undefined' && p1) ? p1.x         : W * 0.28;
        var p2x    = (typeof p2 !== 'undefined' && p2) ? p2.x         : W * 0.72;
        var groundY= (typeof CONFIG !== 'undefined')   ? CONFIG.groundY: H - 55;
        var facing = (typeof p1 !== 'undefined' && p1) ? (p1.facing||1): 1;

        // تعتيم
        var bgA = elapsed < 250  ? elapsed / 250 * 0.6
                : elapsed > 1650 ? (1 - (elapsed-1650)/250) * 0.6
                : 0.6;
        ctx.fillStyle = 'rgba(0,0,0,' + bgA.toFixed(2) + ')';
        ctx.fillRect(0, 0, W, H);

        // ── 1. اللاعب يشحن (punch) ──
        if (elapsed < 900 && _ready.punch) {
            var pfi = _phaseFrame('punch', elapsed, 0, 900);
            var aR  = 65 + 18 * Math.sin(elapsed * 0.016);
            var ag  = ctx.createRadialGradient(p1x, groundY-65, 5, p1x, groundY-65, aR);
            ag.addColorStop(0,   'rgba(255,150,0,0.65)');
            ag.addColorStop(0.5, 'rgba(255,60,0,0.25)');
            ag.addColorStop(1,   'transparent');
            ctx.save();
            ctx.fillStyle = ag;
            ctx.beginPath(); ctx.arc(p1x, groundY-65, aR, 0, Math.PI*2); ctx.fill();
            ctx.restore();
            _drawFrame(ctx, 'punch', pfi, p1x, groundY, 140, facing);
        }

        // ── 2. النيزك يسقط (meteor) ──
        if (elapsed >= 400 && elapsed < 1300 && _ready.meteor) {
            var mfi  = _phaseFrame('meteor', elapsed, 400, 1300);
            var mpct = (elapsed - 400) / 900;
            // يبدأ من أعلى الشاشة وينتهي عند العدو
            var mX   = p2x;
            var mY   = H * 0.02 + mpct * (groundY - H * 0.02);
            var mH   = 70 + mpct * 90;
            // هالة نارية تكبر
            if (elapsed > 600) {
                var mr  = mH * 0.75;
                var mhg = ctx.createRadialGradient(mX, mY - mH*0.3, 4, mX, mY - mH*0.3, mr);
                mhg.addColorStop(0,   'rgba(255,120,0,0.6)');
                mhg.addColorStop(1,   'transparent');
                ctx.save();
                ctx.fillStyle = mhg;
                ctx.beginPath(); ctx.arc(mX, mY - mH*0.3, mr, 0, Math.PI*2); ctx.fill();
                ctx.restore();
            }
            _drawFrame(ctx, 'meteor', mfi, mX, mY, mH, 1);
        }

        // ── 3. الانفجار (explosion) ──
        if (elapsed >= 900 && elapsed < 1500 && _ready.explosion) {
            var efi = _phaseFrame('explosion', elapsed, 900, 1500);
            // Flash لحظي عند الاصطدام
            if (elapsed < 1000) {
                var fA = 1 - (elapsed - 900) / 100;
                ctx.fillStyle = 'rgba(255,200,80,' + fA.toFixed(2) + ')';
                ctx.fillRect(0, 0, W, H);
            }
            _drawFrame(ctx, 'explosion', efi, p2x, groundY, 200, 1);
        }

        // ── 4. الصدمة الأرضية (shockwave) ──
        if (elapsed >= 1300 && elapsed < 1700 && _ready.shockwave) {
            var sfi = _phaseFrame('shockwave', elapsed, 1300, 1700);
            _drawFrame(ctx, 'shockwave', sfi, p2x, groundY + 15, 150, 1);
        }

        // ── جسيمات نار ──
        _tickParticles(ctx, p2x, groundY, elapsed);

        // ── نص المرحلة ──
        var label =
            elapsed < 400  ? 'CHARGING...'        :
            elapsed < 900  ? '☄️ METEOR INCOMING!' :
            elapsed < 1300 ? '💥 METEOR PUNCH!!'   :
            elapsed < 1700 ? 'CRITICAL HIT!'       : null;

        if (label) {
            var lA = elapsed > 1600 ? (1-(elapsed-1600)/100) : 1;
            var lS = elapsed < 180  ? 0.4 + elapsed/180*0.6  : 1;
            ctx.save();
            ctx.globalAlpha = Math.max(0, lA);
            ctx.translate(W/2, H/2 - 15);
            ctx.scale(lS, lS);
            ctx.font         = 'bold 28px "Segoe UI",sans-serif';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle  = 'rgba(0,0,0,0.95)';
            ctx.lineWidth    = 6;
            ctx.fillStyle    = (elapsed >= 900 && elapsed < 1300) ? '#ffee00' : '#ff9900';
            ctx.strokeText(label, 0, 0);
            ctx.fillText  (label, 0, 0);
            ctx.restore();
        }

        if (elapsed < CS_TOTAL) {
            _csRaf = requestAnimationFrame(_runCutscene);
        } else {
            _endCutscene();
        }
    }

    function _tickParticles(ctx, cx, cy, elapsed) {
        if (elapsed > 400 && elapsed < 1600 && Math.random() < 0.55) {
            var ang = Math.random() * Math.PI * 2;
            var spd = 2 + Math.random() * 4;
            _csParticles.push({
                x: cx+(Math.random()-0.5)*25,
                y: cy-30+(Math.random()-0.5)*30,
                vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd - 3,
                life:1.0, size:2+Math.random()*5,
                color:Math.random()<0.5 ? '#ff6600' : '#ffcc00'
            });
        }
        for (var i = _csParticles.length-1; i >= 0; i--) {
            var p = _csParticles[i];
            p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 0.028;
            if (p.life <= 0) { _csParticles.splice(i,1); continue; }
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle   = p.color;
            ctx.shadowColor = p.color; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 8. بدء / نهاية الـ Cutscene
    // ─────────────────────────────────────────────────────────────
    function _startCutscene() {
        if (_csActive) return;
        _csActive    = true;
        _csStart     = Date.now();
        _csParticles = [];

        _ensureOverlay();
        _syncSize();
        _ovCanvas.style.display = 'block';

        if (typeof gameActive !== 'undefined') {
            window._mpSavedGA = gameActive;
            gameActive = false;
        }
        if (typeof animFrameId !== 'undefined' && animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }

        var cs = document.getElementById('mpCutscene');
        if (cs) {
            cs.style.display = 'block';
            requestAnimationFrame(function () { cs.classList.add('mp-cs-active'); });
        }

        if (typeof ScreenFlash !== 'undefined') ScreenFlash.trigger('#ffffff', 0.7);
        if (typeof ScreenShake !== 'undefined') ScreenShake.trigger(15, 18);

        _csRaf = requestAnimationFrame(_runCutscene);
    }

    function _endCutscene() {
        _csActive = false;
        if (_csRaf) { cancelAnimationFrame(_csRaf); _csRaf = null; }

        if (_ovCtx && _ovCanvas) {
            _ovCtx.clearRect(0, 0, _ovCanvas.width, _ovCanvas.height);
            _ovCanvas.style.display = 'none';
        }
        _csParticles = [];

        var cs = document.getElementById('mpCutscene');
        if (cs) {
            cs.classList.remove('mp-cs-active');
            setTimeout(function () { cs.style.display = 'none'; }, 220);
        }

        _executeUltimate();
    }

    // ─────────────────────────────────────────────────────────────
    // 9. تنفيذ الضربة
    // ─────────────────────────────────────────────────────────────
    function _executeUltimate() {
        if (typeof gameActive !== 'undefined')
            gameActive = window._mpSavedGA !== false;
        if (typeof gameLoop === 'function' && typeof animFrameId !== 'undefined')
            animFrameId = requestAnimationFrame(gameLoop);

        if (!gameActive) return;

        var _p1 = (typeof p1 !== 'undefined') ? p1 : null;
        var _p2 = (typeof p2 !== 'undefined') ? p2 : null;
        if (!_p1 || !_p2) return;

        var dmg = (_p1.damage || 12) * 3.5;

        _p2.isBlocking = false; _p2.blockStamina = 0; _p2.stunned = 150;
        _p2.setState((typeof STATES !== 'undefined') ? STATES.STUN : 'stun', true);
        _p2.invincible = false;
        if (typeof _p2.takeDamage === 'function') _p2.takeDamage(dmg, _p1);
        else _p2.health = Math.max(0, _p2.health - dmg);

        if (typeof ScreenShake  !== 'undefined') ScreenShake.trigger(22, 28);
        if (typeof ScreenFlash  !== 'undefined') ScreenFlash.trigger('#ff4400', 0.75);
        if (typeof SlowMo       !== 'undefined') SlowMo.trigger(0.05, 400);

        if (typeof particles !== 'undefined') {
            for (var i = 0; i < 50; i++) {
                var ang = (Math.PI*2/50)*i;
                var spd = 3 + Math.random()*8;
                particles.push({
                    x:_p2.x, y:_p2.y-50,
                    vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd-3,
                    size:4+Math.random()*6, alpha:1,
                    color:Math.random()<0.5?'#ff6600':'#ffcc00',
                    gravity:0.18, life:0.02,
                    type:'heavy', rotation:0, rotSpeed:0.2
                });
            }
        }

        if (typeof damageNumbers !== 'undefined') {
            damageNumbers.push({x:_p2.x,y:_p2.y-100,vy:-3.5,alpha:1,
                text:'☄️ METEOR PUNCH!!',color:'#ffdd00',size:24});
            damageNumbers.push({x:_p2.x+20,y:_p2.y-65,vy:-2.5,alpha:1,
                text:'-'+Math.round(dmg),color:'#ff4400',size:28});
        }

        if (typeof endBattle === 'function' && _p2.health <= 0)
            setTimeout(function () { endBattle(true); }, 400);

        Energy.spend();
    }

    // ─────────────────────────────────────────────────────────────
    // 10. ربط الزر
    // ─────────────────────────────────────────────────────────────
    function _bindButton() {
        var btn = document.getElementById('btnMeteor');
        if (!btn) return;
        function onPress(e) {
            e.preventDefault();
            if (!Energy.full) return;
            if (_csActive)    return;
            if (typeof gameActive !== 'undefined' && !gameActive) return;
            btn.classList.remove('btn-pressed');
            void btn.offsetWidth;
            btn.classList.add('btn-pressed');
            _startCutscene();
        }
        btn.addEventListener('touchstart', onPress, { passive:false });
        btn.addEventListener('mousedown',  onPress);
    }

    // ─────────────────────────────────────────────────────────────
    // 11. مراقبة الضربات
    // ─────────────────────────────────────────────────────────────
    var _lastP2Hp = -1;
    function _watchHits() {
        setInterval(function () {
            if (typeof gameActive === 'undefined' || !gameActive) return;
            if (typeof p2 === 'undefined' || !p2) return;
            var hp = p2.health;
            if (_lastP2Hp > 0 && hp < _lastP2Hp && !Energy.full) Energy.add();
            _lastP2Hp = hp;
        }, 16);
    }

    // ─────────────────────────────────────────────────────────────
    // 12. Hook على startStage / endBattle
    // ─────────────────────────────────────────────────────────────
    function _hookGameEvents() {
        var _origStart = window.startStage;
        if (typeof _origStart === 'function') {
            window.startStage = function () {
                _origStart.apply(this, arguments);
                setTimeout(function () {
                    _showUI();
                    _lastP2Hp = -1;
                    Energy.reset();
                }, 2700);
            };
        }

        var _origEnd = window.endBattle;
        if (typeof _origEnd === 'function') {
            window.endBattle = function () {
                _hideUI();
                if (_csActive) {
                    _csActive = false;
                    if (_csRaf) { cancelAnimationFrame(_csRaf); _csRaf = null; }
                    if (_ovCtx && _ovCanvas) {
                        _ovCtx.clearRect(0, 0, _ovCanvas.width, _ovCanvas.height);
                        _ovCanvas.style.display = 'none';
                    }
                    _csParticles = [];
                    var cs = document.getElementById('mpCutscene');
                    if (cs) { cs.classList.remove('mp-cs-active'); cs.style.display='none'; }
                }
                _origEnd.apply(this, arguments);
            };
        }
    }

    function _showUI() {
        var wrap = document.getElementById('mpEnergyWrap');
        var btn  = document.getElementById('btnMeteor');
        if (wrap) wrap.style.display = 'flex';
        if (btn)  btn.style.display  = 'flex';
    }
    function _hideUI() {
        var wrap = document.getElementById('mpEnergyWrap');
        var btn  = document.getElementById('btnMeteor');
        if (wrap) wrap.style.display = 'none';
        if (btn)  btn.style.display  = 'none';
        Energy.reset();
    }

    // ─────────────────────────────────────────────────────────────
    // 13. Init
    // ─────────────────────────────────────────────────────────────
    window.MeteorPunch = {
        energy:   Energy,
        isActive: function () { return _csActive; }
    };

    function _init() {
        _loadAllSheets();
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
