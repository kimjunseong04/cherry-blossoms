/* 
   벚꽃 흩날리는 페이지 - 메인 렌더링 스크립트
   Canvas 2D로 물리 연산이랑 드로잉을 프레임마다 처리함
*/

// 필수 DOM 엘리먼트들
const canvas = document.getElementById('cherry-blossoms');
const ctx = canvas.getContext('2d');
const windSpeedEl = document.getElementById('wind-speed'); 
const resetBtn = document.getElementById('reset-petals');
const titleEl = document.querySelector('.dancing-script');
const toggleImmersionBtn = document.getElementById('toggle-immersion');
const exitImmersionBtn = document.getElementById('exit-immersion');
const mainUI = document.getElementById('main-ui');

// 화면 크기 변수
let width, height;

let petals = [];       // 하늘에서 떨어지는 애들
let trees = [];        // 화면에 박혀있는 나무들
let groundPetals = []; // 바닥에 안착한 애들 (너무 많으면 성능 잡아먹어서 적당히 관리함)
let burstPetals = [];  // 나무 클릭했을 때 팍 튀어나오는 보너스 꽃잎들

// 테마랑 특수 상태 제어
let theme = 'spring';       
let isWindStorm = false;    // 타이틀 클릭 시 5초 폭풍
let isImmersionMode = false;
let lastTreeClickTime = 0;  // 나무 클릭이랑 배경 더블클릭 겹치는 거 방지용

const MAX_PETALS = 400;        // 공중 꽃잎은 최대 400개 정도로 타협
const MAX_GROUND_PETALS = 1000; // 바닥 꽃잎도 1000개 넘으면 오래된 거부터 지움

let groundY; // 바닥 높이 (resize 할 때 정해짐)

// 바람 관련 데이터
let wind = {
    currentX: 0.3,  // 현재 바람 세기 (살랑살랑 시작)
    targetX:  0.3,  // 이쪽으로 바람이 서서히 변함
    currentY: 0.2,  // 중력 느낌 주는 보조 값
    targetY:  0.2,
    time: 0         // 시간에 따라 바람 방향 바꾸려고 씀
};

let mouse = {
    x: -100, y: -100,
    vx: 0, vy: 0,
    lastX: 0, lastY: 0,
    isDown: false
};

// 벚꽃잎 하나하나의 생애주기를 담당하는 클래스
class Petal {
    constructor(isInitial = false, customX, customY, isBurst = false) {
        this.reset(isInitial, customX, customY, isBurst);
    }

    reset(isInitial, customX, customY, isBurst = false) {
        this.isBurst = isBurst; // 나무에서 강제로 떨어진 꽃잎인지 체크
        
        // 위치 없으면 상단 랜덤, 있으면 그 자리에서 생성
        this.x = customX !== undefined ? customX : Math.random() * width;
        this.y = customY !== undefined ? customY : (isInitial ? Math.random() * height : -20);
        this.size = Math.random() * 5 + 3;

        // 초기 속도 - 다 똑같이 떨어지면 낙하산 같으니까 속도 다르게 줌
        this.vx = (Math.random() - 0.5) * 1;
        this.vy = Math.random() * 0.5 + 0.5;
        this.weight = Math.random() * 0.15 + 0.05;

        // 회전값 - 팔랑팔랑 도는 느낌
        this.rotation = Math.random() * 360;
        this.rotationSpeed = (Math.random() - 0.5) * 3;

        // 테마별 색상 설정
        const colorBase = theme === 'dark' ? 220 : 190;
        if (this.isBurst) {
            // 나무 잎들은 더 뽀얗고 진한 핑크로 확실히 튀게 함
            this.color = `rgba(255, ${120 + Math.random() * 40}, ${150 + Math.random() * 40}, ${0.8 + Math.random() * 0.2})`;
        } else {
            this.color = `rgba(255, ${colorBase + Math.random() * 40}, ${colorBase + 10 + Math.random() * 40}, ${0.7 + Math.random() * 0.2})`;
        }

        // 좌우로 살살 흔들리게 만드는 위상차 값
        this.horizontalSwing = Math.random() * Math.PI * 2;
        this.swingSpeed = 0.02 + Math.random() * 0.03;

        this.isGrounded = false;
    }

    update() {
        if (this.isGrounded) return;

        // 외부 힘(바람, 중력) 계산
        const windBoost = isWindStorm ? 12 : 1; // 폭풍일 땐 12배 강하게
        const windFactor = (wind.currentX * windBoost) + Math.sin(this.horizontalSwing) * 0.5;

        this.vx += windFactor * 0.04;
        this.vy += (this.weight + wind.currentY) * 0.08;

        // 마우스 피하기 로직
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist < 60 && !mouse.isDown) {
            const force = (60 - dist) / 60; // 가까울수록 더 강하게 밀림
            this.vx += (dx / dist) * force * 1.5;
            this.vy += (dy / dist) * force * 1.5;
        }

        // 연산 결과 반영
        this.x += this.vx;
        this.y += this.vy;

        // 공기 저항 (속도가 무한정 빠르지 않게 깎아줌)
        this.vx *= 0.97;
        this.vy *= 0.97;

        this.rotation += this.rotationSpeed + (this.vx * 1.5);
        this.horizontalSwing += this.swingSpeed;

        // 바닥에 닿았을 때
        if (this.y >= groundY) {
            this.isGrounded = true;
            this.vx = 0;
            this.vy = 0;
            this.y = groundY + (Math.random() * 4 - 2);

            if (this.isBurst) {
                // 나무에서 떨어진 보너스 꽃잎은 바닥에서 서서히 사라지게 함
                this.fading = true;
                this.alpha = 1.0;
                groundPetals.push(this);
            } else {
                groundPetals.push(this);
                if (groundPetals.length > MAX_GROUND_PETALS) groundPetals.shift();
            }
            return true; 
        }

        // 화면 밖으로 나가면 반대편에서 재활용
        if (this.x > width + 50) this.x = -50;
        if (this.x < -50) this.x = width + 50;

        return false;
    }

    draw(context) {
        context.save();
        context.translate(this.x, this.y);
        context.rotate((this.rotation * Math.PI) / 180);

        const alpha = this.alpha !== undefined ? this.alpha : 1.0;
        context.globalAlpha = alpha;

        // 꽃잎 드로잉 (그냥 연한 타원임)
        context.beginPath();
        context.fillStyle = this.color;
        context.ellipse(0, 0, this.size, this.size * 0.6, 0, 0, Math.PI * 2);
        context.fill();

        context.globalAlpha = 1.0;
        context.restore();
    }
}

// 숲을 이루는 나무 클래스
class Tree {
    constructor(relX, relY, scale) {
        this.relX = relX;  
        this.relY = relY;  
        this.scale = scale;
        this.lastBurst = 0; 
        this.updatePosition();
        this.generate();
    }

    updatePosition() {
        this.x = width * this.relX;
        this.y = groundY + this.relY;
    }

    generate() {
        this.branches = [];
        this.foliage = [];
        this.blossoms = [];
        this.recolor();
        this.createBranch(0, 0, -Math.PI / 2, 13 * this.scale, 90 * this.scale, 0);
    }

    // 테마 바뀔 때마다 나무 새로 그려주면 랙 심해서 색만 덧칠함
    recolor() {
        this.woodColor = theme === 'dark'
            ? `rgba(30, 20, 40, 1)` 
            : `rgba(${65 + Math.floor(Math.random()*15)}, ${40+Math.floor(Math.random()*10)}, ${35+Math.floor(Math.random()*10)}, 1)`;

        this.foliage.forEach(f => {
            f.color = theme === 'dark'
                ? `rgba(180, 100, 255, 0.15)` 
                : `rgba(255, ${192 + Math.floor(Math.random() * 30)}, ${203 + Math.floor(Math.random() * 30)}, 0.2)`;
        });
    }

    // 팩토리얼처럼 자라는 나무 가지 (재귀로 계속 뻗게 함)
    createBranch(x, y, angle, thickness, length, depth) {
        const x2 = x + Math.cos(angle) * length;
        const y2 = y + Math.sin(angle) * length;
        this.branches.push({ x1: x, y1: y, x2, y2, thickness, depth });

        if (depth < 7) {
            const numSprouts = Math.random() > 0.8 ? 3 : 2;
            for (let i = 0; i < numSprouts; i++) {
                const newAngle = angle + (Math.random() - 0.5) * 1.1;
                const newLength = length * (0.75 + Math.random() * 0.1);
                this.createBranch(x2, y2, newAngle, thickness * 0.75, newLength, depth + 1);
            }
        }

        // 끝 가지들에만 잎이랑 꽃 달아주기
        if (depth >= 4) {
            this.foliage.push({
                x: x2, y: y2,
                size: (18 + Math.random() * 22) * this.scale,
                color: theme === 'dark' ? `rgba(180, 100, 255, 0.15)` : `rgba(255, ${192 + Math.floor(Math.random() * 30)}, ${203 + Math.floor(Math.random() * 30)}, 0.2)`
            });
            for (let i = 0; i < 4; i++) {
                this.blossoms.push({
                    x: x2 + (Math.random() - 0.5) * 35 * this.scale,
                    y: y2 + (Math.random() - 0.5) * 35 * this.scale,
                    size: (Math.random() * 2.5 + 2) * this.scale,
                    color: `rgba(255, ${185 + Math.random() * 55}, ${195 + Math.random() * 55}, 0.65)`
                });
            }
        }
    }

    draw(context) {
        context.save();
        context.translate(this.x, this.y); 

        // 나무 흔들림 피드백 (sin으로 살랑살랑 하다가 갈수록 작아짐)
        if (this.shakeStart) {
            const elapsed = Date.now() - this.shakeStart;
            const shakeAngle = Math.sin(elapsed * 0.025) * Math.exp(-elapsed * 0.004) * 0.06;
            context.rotate(shakeAngle);
            if (elapsed > 1500) this.shakeStart = null;
        }

        // 투명한 핑크 잎 뭉치들
        this.foliage.forEach(f => {
            context.fillStyle = f.color;
            context.beginPath();
            context.arc(f.x, f.y, f.size, 0, Math.PI * 2);
            context.fill();
        });

        // 뼈대 가지 선 긋기
        context.lineCap = 'round'; 
        context.strokeStyle = this.woodColor;
        this.branches.forEach(b => {
            context.lineWidth = b.thickness;
            context.beginPath();
            context.moveTo(b.x1, b.y1);
            context.lineTo(b.x2, b.y2);
            context.stroke();
        });

        // 작은 꽃 점들
        this.blossoms.forEach(b => {
            context.fillStyle = b.color;
            context.beginPath();
            context.arc(b.x, b.y, b.size, 0, Math.PI * 2);
            context.fill();
        });

        context.restore();
    }

    // 마우스가 나무 판정 범위 안에 있는지 체크
    contains(px, py) {
        return Math.hypot(this.x - px, (this.y - 120 * this.scale) - py) < 100 * this.scale;
    }
}

// 배경 정경 (산, 언덕, 해/달 등) 그리기
function drawScenery() {
    if (theme === 'dark') {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(0, height * 0.75);
        ctx.bezierCurveTo(width * 0.3, height * 0.6, width * 0.6, height * 0.9, width, height * 0.7);
        ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.fill();

        // 은은한 달빛
        const moonGrad = ctx.createRadialGradient(width * 0.85, height * 0.2, 0, width * 0.85, height * 0.2, 70);
        moonGrad.addColorStop(0, '#fffde7');
        moonGrad.addColorStop(1, 'rgba(255, 253, 231, 0)');
        ctx.fillStyle = moonGrad;
        ctx.beginPath(); ctx.arc(width * 0.85, height * 0.2, 70, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1e1b4b'; 
    } else {
        ctx.fillStyle = '#fce4ec';
        ctx.beginPath();
        ctx.moveTo(0, height * 0.75);
        ctx.bezierCurveTo(width * 0.3, height * 0.6, width * 0.6, height * 0.9, width, height * 0.7);
        ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.fill();

        // 햇살 비치는 효과
        const sunGrad = ctx.createRadialGradient(width * 0.85, height * 0.2, 0, width * 0.85, height * 0.2, 120);
        sunGrad.addColorStop(0, 'rgba(255, 236, 179, 0.5)');
        sunGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = sunGrad;
        ctx.beginPath(); ctx.arc(width * 0.85, height * 0.2, 120, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; 
    }

    ctx.fillRect(0, groundY, width, height - groundY);
    ctx.strokeStyle = theme === 'dark' ? 'rgba(76, 29, 149, 0.4)' : 'rgba(244, 143, 177, 0.3)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(width, groundY); ctx.stroke();
}

// 나무를 흔들어서 꽃비를 내리게 할 때
function blossomBurst(tree) {
    const now = Date.now();
    if (now - tree.lastBurst < 2000) return; 
    tree.lastBurst = now;
    lastTreeClickTime = now; 

    tree.shakeStart = now; 

    const burstPositions = tree.blossoms.length > 0
        ? tree.blossoms
        : [{ x: 0, y: -80 * tree.scale }];

    for (let i = 0; i < 80; i++) {
        const src = burstPositions[Math.floor(Math.random() * burstPositions.length)];
        const bx = tree.x + src.x + (Math.random() - 0.5) * 40;
        const by = tree.y + src.y + (Math.random() - 0.5) * 40;
        
        const p = new Petal(false, bx, by, true);
        p.alpha = 1.0;
        p.vy = -(Math.random() * 2.0 + 0.5); 
        p.vx = (Math.random() - 0.5) * 2.0;  
        burstPetals.push(p);
    }
}

function toggleImmersion() {
    isImmersionMode = !isImmersionMode;
    mainUI.classList.toggle('ui-hidden', isImmersionMode);
    exitImmersionBtn.classList.toggle('exit-ghost', isImmersionMode);

    if (isImmersionMode) {
        exitImmersionBtn.classList.remove('opacity-0', 'pointer-events-none');
    } else {
        exitImmersionBtn.classList.add('opacity-0', 'pointer-events-none');
    }
}

// 이벤트 핸들러 모음

window.addEventListener('mousemove', (e) => {
    mouse.vx = e.clientX - mouse.lastX;
    mouse.vy = e.clientY - mouse.lastY;
    mouse.lastX = mouse.x = e.clientX;
    mouse.lastY = mouse.y = e.clientY;
});

window.addEventListener('mousedown', (e) => {
    mouse.isDown = true;
    const mx = e.clientX;
    const my = e.clientY;

    trees.forEach(t => {
        if (t.contains(mx, my)) blossomBurst(t);
    });
});

window.addEventListener('mouseup', () => {
    mouse.isDown = false;
});

// 마우스가 화면 밖으로 나갈 때 좌표 초기화 (벚꽃들이 테두리에 계속 튕기는 현상 방지)
window.addEventListener('mouseleave', () => {
    mouse.isDown = false;
    mouse.x = -1000;
    mouse.y = -1000;
});

// 모바일 터치 지원: 터치를 마우스 클릭처럼 처리
window.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
        mouse.isDown = true;
        const touch = e.touches[0];
        const mx = touch.clientX;
        const my = touch.clientY;
        mouse.lastX = mouse.x = mx;
        mouse.lastY = mouse.y = my;

        trees.forEach(t => {
            if (t.contains(mx, my)) blossomBurst(t);
        });
    }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
        const touch = e.touches[0];
        mouse.vx = touch.clientX - mouse.lastX;
        mouse.vy = touch.clientY - mouse.lastY;
        mouse.lastX = mouse.x = touch.clientX;
        mouse.lastY = mouse.y = touch.clientY;
    }
}, { passive: true });

// 모바일 화면에서 손을 뗄 때 (터치 종료) 인터랙션 위치도 화면 밖으로 치워줌
// 이 처리가 없으면 화면의 마지막 터치 위치에 벚꽃들이 계속해서 반응하며 쌓이는 문제가 생김
window.addEventListener('touchend', () => {
    mouse.isDown = false;
    mouse.x = -1000;
    mouse.y = -1000;
});

window.addEventListener('touchcancel', () => {
    mouse.isDown = false;
    mouse.x = -1000;
    mouse.y = -1000;
});

window.addEventListener('dblclick', (e) => {
    if (Date.now() - lastTreeClickTime < 400) return; // 나무 클릭 직후엔 무시
    if (e.target === canvas) {
        theme = theme === 'spring' ? 'dark' : 'spring';
        document.body.setAttribute('data-theme', theme);
        trees.forEach(t => t.recolor()); 
    }
});

toggleImmersionBtn.addEventListener('click', toggleImmersion);
exitImmersionBtn.addEventListener('click', toggleImmersion);
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'm') toggleImmersion();
});

titleEl.addEventListener('click', () => {
    if (isWindStorm) return;
    isWindStorm = true;
    titleEl.innerText = "Stormy Breeze!";
    setTimeout(() => {
        isWindStorm = false;
        titleEl.innerText = "Spring Breeze";
    }, 5000);
});

// 메인 애니메이션 엔진

// 브라우저가 Safari인지 확인 (정규식 캐싱 처리)
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

function animate() {
    ctx.clearRect(0, 0, width, height);

    mouse.vx *= 0.8;
    mouse.vy *= 0.8;

    // 바람 주기 늦추기
    wind.time += 0.0015;
    wind.targetX = 0.5 + Math.sin(wind.time) * 0.7;       
    wind.targetY = 0.3 + Math.cos(wind.time * 0.7) * 0.1;

    // 현재 바람 상태를 목표치로 살살 옮겨줌 (부드러운 가속 느낌)
    const lerp = 0.05;
    wind.currentX += (wind.targetX - wind.currentX) * lerp;
    wind.currentY += (wind.targetY - wind.currentY) * lerp;

    drawScenery();

    // 1. 버스트 꽃잎 (나무클릭용) 처리 루프
    for (let i = burstPetals.length - 1; i >= 0; i--) {
        const bp = burstPetals[i];
        if (bp.isGrounded) {
            const dx = bp.x - mouse.x;
            const dy = bp.y - mouse.y;
            const dist = Math.hypot(dx, dy);

            // 바닥에서도 마우스 피해서 밀려나기
            if (dist < 150 && !mouse.isDown) {
                const force = (150 - dist) / 150;
                bp.x += (dx / dist) * force * 2;
                bp.rotation += (dx / dist) * force * 5;
            }

            // 마우스 가까이 오면 다시 공중으로 도망
            if (dist < 80 && !mouse.isDown && petals.length < MAX_PETALS) {
                bp.isGrounded = false;
                bp.fading = false;
                bp.alpha = 1.0;
                const force = (80 - dist) / 80;
                bp.vx = (dx / dist) * force * 3 + (Math.random() - 0.5);
                bp.vy = -(force * 3 + Math.random() * 2);
                petals.push(bp);
                burstPetals.splice(i, 1);
                continue;
            }

            // 폭풍 불면 바닥 꽃잎들도 다 휩쓸려감
            if (isWindStorm && Math.random() > 0.96) {
                bp.isGrounded = false;
                bp.fading = false;
                bp.alpha = 1.0;
                bp.vy = -(Math.random() * 3 + 2);
                bp.vx = wind.currentX * 8 + (Math.random() - 0.5) * 3;
                petals.push(bp);
                burstPetals.splice(i, 1);
                continue;
            }

            bp.alpha -= 0.008; // 탭댄스 추듯 서서히 소멸
            if (bp.alpha <= 0) { burstPetals.splice(i, 1); continue; }
            bp.draw(ctx);
        } else {
            const grounded = bp.update();
            if (grounded) {
                bp.isGrounded = true;
                bp.fading = true;
            } else {
                bp.draw(ctx);
            }
        }
    }

    // 2. 바닥에 원래 깔려있던 꽃잎들 처리
    for (let i = groundPetals.length - 1; i >= 0; i--) {
        const gp = groundPetals[i];

        if (gp.fading) {
            gp.alpha -= 0.006;
            if (gp.alpha <= 0) {
                groundPetals.splice(i, 1);
                continue;
            }
        }

        const dx = gp.x - mouse.x;
        const dy = gp.y - mouse.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 150 && !mouse.isDown) {
            const force = (150 - dist) / 150;
            gp.x += (dx / dist) * force * 2;
            gp.rotation += (dx / dist) * force * 5;
        }

        if (dist < 80 && !mouse.isDown && petals.length < MAX_PETALS) {
            gp.isGrounded = false;
            gp.fading = false;
            gp.alpha = 1.0;
            const force = (80 - dist) / 80;
            gp.vx = (dx / dist) * force * 3 + (Math.random() - 0.5);
            gp.vy = -(force * 3 + Math.random() * 2);
            petals.push(gp);
            groundPetals.splice(i, 1);
            continue;
        }

        if (isWindStorm && Math.random() > 0.96) {
            gp.isGrounded = false;
            gp.fading = false;
            gp.alpha = 1.0;
            gp.vy = -(Math.random() * 3 + 2);
            gp.vx = wind.currentX * 8 + (Math.random() - 0.5) * 3;
            petals.push(gp);
            groundPetals.splice(i, 1);
            continue;
        }

        gp.draw(ctx);
    }

    trees.forEach(t => t.draw(ctx));

    // 3. 현재 공중에 떠다니는 메인 꽃잎들
    for (let i = petals.length - 1; i >= 0; i--) {
        const isGrounded = petals[i].update();
        if (isGrounded) {
            petals[i] = new Petal(); // 바닥 가면 새로 하나 보충해줌
        } else {
            petals[i].draw(ctx);
        }
    }

    if (petals.length > MAX_PETALS) {
        petals.splice(0, petals.length - MAX_PETALS);
    }

    // 상태 보드 문구 업데이트
    if (!isImmersionMode) {
        if (isWindStorm) windSpeedEl.innerText = "바람: 폭풍 주의보!!";
        else if (Math.abs(wind.currentX) < 0.3) windSpeedEl.innerText = "바람: 고요한 오후";
        else if (Math.abs(wind.currentX) < 1.0) windSpeedEl.innerText = "바람: 살랑이는 봄바람";
        else windSpeedEl.innerText = "바람: 시원한 봄바람";
    }

    requestAnimationFrame(animate);
}

// 기타 설정들

function init() {
    // Safari 렌더링 성능 저하 및 잔상(Ghosting) 버그를 방지하기 위해 필터를 제거
    if (isSafari) {
        canvas.classList.remove('bloom-filter');
    }

    resize(true); // true = 화면 크기 조절뿐만 아니라 나무도 새로 그리기
    for (let i = 0; i < MAX_PETALS; i++) { // 화면에 꽃잎을 미리 뿌려놓기
        petals.push(new Petal(true));
    }
    animate(); // 애니메이션 시작

    // 개발자 도구 콘솔 메시지
    console.log(
        "%c🌸 벚꽃보러 오셨나요? 아쉽지만 여기에는 벚꽃이 없어요😭",
        "color: #ff69b4; font-size: 20px; font-weight: bold; font-family: 'Noto Sans KR', sans-serif; text-shadow: 2px 2px 4px rgba(255, 182, 193, 0.4); padding: 10px;"
    );
}

function resize(isInit = false) { // 화면 크기 조절
    const oldGroundY = groundY; // 창 크기 조절 전의 기존 바닥 높이 기억
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    groundY = height - 40; 

    // 화면이 회전되거나 창 크기가 변해서 바닥 높이가 달라진 경우
    // 기존에 바닥에 떨어져 있던 벚꽃들이 허공에 떠있거나 땅속에 파묻히지 않도록, 
    // 바닥이 변한 만큼 벚꽃들도 전부 위아래로 같이 이동시켜 줌 (`diffY`).
    if (!isInit && oldGroundY && oldGroundY !== groundY) {
        const diffY = groundY - oldGroundY;
        groundPetals.forEach(p => { p.y += diffY; });
        burstPetals.forEach(p => { if (p.isGrounded) p.y += diffY; });
    }

    if (isInit) {
        createInitialTrees();
    } else {
        trees.forEach(t => t.updatePosition());
    }
}

function createInitialTrees() { // 화면 크기에 따라 나무 개수랑 위치 설정
    trees = [];
    const isMobile = window.innerWidth < 768;
    const treeConfigs = isMobile ? [
        { rx: 0.25, ry: 15, s: 0.8 },
        { rx: 0.75, ry: 10, s: 1.0 }
    ] : [
        { rx: 0.12, ry: 10, s: 1.1  },
        { rx: 0.35, ry: 15, s: 0.75 },
        { rx: 0.75, ry: 10, s: 1.0  },
        { rx: 0.90, ry: 20, s: 0.85 }
    ];
    treeConfigs.forEach(c => trees.push(new Tree(c.rx, c.ry, c.s)));
}

resetBtn.addEventListener('click', () => { groundPetals = []; });
window.addEventListener('resize', () => resize(false));

init();
