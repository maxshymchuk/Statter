const canvas = document.getElementById('canvas');
const gameover = document.getElementById('gameover');
const pause = document.getElementById('pause');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const TICK_TIME = 10;

const KEYS = new Set();

function keyDown(e) {
    KEYS.add(e.code);
}

function keyUp(e) {
    KEYS.delete(e.code);
}

document.onkeydown = keyDown;
document.onkeyup = keyUp;

function rand(a, b) {
    return Math.random() * (b - a) + a 
}

function checkCollision(o1, o2) {
    let dx = o2.x - o1.x;
    let dy = o2.y - o1.y;
    let d = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
    if (d > o1.radius + o2.radius) return null;
    return { o1, o2, dx, dy, d };
}

function resolveCollision(collision) { 
    const nx = collision.dx / collision.d;
    const ny = collision.dy / collision.d;
    const s = collision.o1.radius + collision.o2.radius - collision.d;
    collision.o1.x -= nx * s / 2;
    collision.o1.y -= ny * s / 2;
    collision.o2.x += nx * s / 2;
    collision.o2.y += ny * s / 2;

    const k = -2 * ((collision.o2.vx - collision.o1.vx) * nx + (collision.o2.vy - collision.o1.vy) * ny) / (1 / collision.o1.mass + 1 / collision.o2.mass);
    collision.o1.vx -= k * nx / collision.o1.mass;
    collision.o1.vy -= k * ny / collision.o1.mass;
    collision.o2.vx += k * nx / collision.o2.mass;
    collision.o2.vy += k * ny / collision.o2.mass;
}

function drawCircle(entity, ctx, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(entity.x, entity.y, entity.radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.lineWidth = entity.radius / 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle - 2 * Math.PI * entity.health / entity.maxHealth;
    ctx.arc(entity.x, entity.y, entity.radius - ctx.lineWidth / 2, startAngle, endAngle, true);
    ctx.stroke();
    ctx.restore();
}

class BaseEntity {
    _flagToRemove = false;

    id = undefined;
    zIndex = 0;

    radius = 25;

    state = 0; // 0 - default, 1 - invinsible
    invinsibleTimeProgress = 0;
    invinsibleTime = 0;

    maxHealth = 100;
    _health = 100;
    dmg = 0;

    _color = [0,0,0];

    x = 0;
    y = 0;

    mass = 1;

    bounded = true;
    
    _v = 1;
    _vx = 0;
    _vy = 0;

    get v() {
        return this._v;
    }

    set v(value) {
        this._v = value;
    }

    get vx() {
        return this._v * this._vx;
    }

    set vx(value) {
        this._vx = value / this._v;
    }

    get vy() {
        return this._v * this._vy;
    }

    set vy(value) {
        this._vy = value / this._v;
    }

    setInvinsible(flag) {
        this.state = flag ? 1 : 0;
        this.invinsibleTimeProgress = this.invinsibleTime;
    }

    damageBy(entity) {
        if (this.state === 1) return;
        this.health -= entity.dmg;
        this.setInvinsible(true);
    }

    set health(value) {
        this._health = value < 0 ? 0 : value > this.maxHealth ? this.maxHealth : value;
    }

    get health() {
        return this._health;
    }

    constructor({ id, x, y, radius, mass, health, maxHealth, v, vx, vy, dmg, bounded, invinsibleTime, color }) {
        this.id = id;
        this.bounded = bounded ?? true;
        if (color) this._color = color;
        if (x != undefined) this.x = x;
        if (y != undefined) this.y = y;
        if (v != undefined) this._v = v;
        if (vx != undefined) this._vx = vx;
        if (vy != undefined) this._vy = vy;
        if (mass >= 0) this.mass = mass;
        if (radius >= 0) this.radius = radius;
        if (maxHealth > 0) this.maxHealth = maxHealth;
        if (health > 0) this._health = health;
        if (invinsibleTime >= 0) this.invinsibleTime = invinsibleTime;
        if (dmg) this.dmg = dmg;
    }

    operate() {
        return [
            () => {
                this.invinsibleTimeProgress -= TICK_TIME;
                if (this.invinsibleTimeProgress <= 0) this.setInvinsible(false);
            }
        ];
    }

    render(ctx) {
        const alpha = this._color[3] ?? 1;
        const peak = this.state === 1 ? Math.min(Math.abs(Math.sin(7 * Math.PI / 2 * this.invinsibleTimeProgress / TICK_TIME / 100)), alpha) : alpha;
        const color = this.health === 0 ? 'rgb(0,0,0)' : `rgb(${this._color[0]},${this._color[1]},${this._color[2]},${peak})`;
        drawCircle(this, ctx, color);
    }
}

class Enemy extends BaseEntity {
    damageBy(entity) {
        if (this.state === 1 || entity instanceof Enemy) return;
        this.health -= entity.dmg;
        this.setInvinsible(true);
        if (this.health === 0) this._flagToRemove = true;
    }
    
    _move() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < this.radius) {
            this.x = this.radius;
            this.vx = -this.vx
        }
        if (this.x > canvas.width - this.radius) {
            this.x = canvas.width - this.radius;
            this.vx = -this.vx;
        }
        if (this.y < this.radius) {
            this.y = this.radius;
            this.vy = -this.vy;
        }
        if (this.y > canvas.height - this.radius) {
            this.y = canvas.height - this.radius;
            this.vy = -this.vy;
        }
    }

    operate() {
        return [
            () => this._move(),
            () => {
                this.invinsibleTimeProgress -= TICK_TIME;
                if (this.invinsibleTimeProgress <= 0) this.setInvinsible(false);
            }
        ];
    }
}

class Player extends BaseEntity {
    _move(keys) {
        this._vx = 0;
        this._vy = 0;
        if (keys.has('ArrowUp')) { this.vy = -this.v; }
        if (keys.has('ArrowRight')) { this.vx = this.v; }
        if (keys.has('ArrowDown')) { this.vy = this.v; }
        if (keys.has('ArrowLeft')) { this.vx = -this.v; }
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < this.radius) this.x = this.radius;
        if (this.x > canvas.width - this.radius) this.x = canvas.width - this.radius;
        if (this.y < this.radius) this.y = this.radius;
        if (this.y > canvas.height - this.radius) this.y = canvas.height - this.radius;
    }

    operate(keys) {
        return [
            () => this._move(keys),
            () => {
                this.invinsibleTimeProgress -= TICK_TIME;
                if (this.invinsibleTimeProgress <= 0) this.setInvinsible(false);
            }
        ];
    }
}

function generateEnemies(num) {
    const RADIUS = 10;
    const DIAMETER = RADIUS * 2;
    const enemies = [];
    const perRow = Math.trunc(canvas.width / DIAMETER);
    const perColumn = Math.trunc(canvas.height / 2 / DIAMETER);
    const limited = Math.min(num, perRow * perColumn);
    const marginX = (canvas.width - Math.min(limited, perRow) * DIAMETER) / 2;
    const marginY = (canvas.height / 2 - Math.round(limited / perRow) * DIAMETER) / 2;
    for (let i = 0; i < limited; i++) {
        const dmg = Math.round(rand(10, 90));
        enemies.push(new Enemy({
            id: i,
            x: marginX + RADIUS / 2 + Math.trunc(i % perRow) * DIAMETER, 
            y: marginY + RADIUS / 2 + Math.trunc(i / perRow) * DIAMETER, 
            v: 2,
            vx: rand(-1, 1),
            vy: rand(-1, 1),
            radius: RADIUS,
            dmg,
            invinsibleTime: 500,
            color: [255, 0, 0, 1 / 100 * dmg]
        }))
    }
    return enemies;
}

const entities = [
    ...generateEnemies(200),
    // new Enemy({
    //     x: 100,//marginX + RADIUS / 2 + Math.trunc(i % perRow) * DIAMETER, 
    //     y: 100,//marginY + RADIUS / 2 + Math.trunc(i / perRow) * DIAMETER, 
    //     v: 2,
    //     vx: rand(-1, 1),
    //     vy: rand(-1, 1),
    //     radius: 15,
    //     dmg: 25,
    //     // invinsibleTime: 500,
    //     color: [255, 0, 0]
    // }),
    new Player({ 
        x: canvas.width / 2, 
        y: canvas.height * 3 / 4, 
        radius: 20, 
        v: 10,
        health: 100,
        bounded: false,
        invinsibleTime: 2000,
        color: [0,255,0]
    }),
]

let state = {
    status: 1, // 0 - pause, 1 - running, 2 - win, 3 - lose
    entities
}

function setup() {
    document.addEventListener('keydown', (e) => {
        if (state.status > 1) return;
        if (e.code === 'Escape') {
            state.status = state.status === 1 ? 0 : 1;
        }
    });
}

function checkingPhase() {
    const players = state.entities.filter(entity => entity instanceof Player);
    if (players.length > 0 && players.every(player => player.health === 0)) {
        state.status = 3;
    }
    return state.status === 1;
}

function operatingPhase(keys) {
    const queue = [];
    const workEntities = state.entities.filter(entity => !entity._flagToRemove);
    for (let i = 0; i < workEntities.length - 1; i++) {
        if (workEntities[i]._flagToRemove) continue;
        for (let j = i + 1; j < workEntities.length; j++) {
            const collision = checkCollision(workEntities[i], workEntities[j]);
            if (!collision) continue;
            queue.push(() => {
                workEntities[i].damageBy(workEntities[j]);
                workEntities[j].damageBy(workEntities[i]);
            });
            if (workEntities[i].bounded && workEntities[j].bounded) {
                resolveCollision(collision);
            }
        }
    }
    for (const entity of workEntities) {
        queue.push(...entity.operate(keys), () => state.entities = workEntities);
    }
    return queue;
}

function drawingPhase() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const entity of state.entities) {
        entity.render(ctx);
    }
}

function updatingPhase(queue) {
    queue.forEach(q => q());
}

function tick() {
    if (checkingPhase()) {
        updatingPhase(operatingPhase(KEYS));
        drawingPhase();
    }
    canvas.style.filter = (state.status === 0 || state.status === 3) ? 'grayscale(1)' : '';
    pause.style.visibility = state.status === 0 ? 'visible' : 'hidden';
    gameover.style.visibility = state.status === 3 ? 'visible' : 'hidden';
    window.requestAnimationFrame(tick);
}

function init() {
    setup();
    window.requestAnimationFrame(tick);
}

init();