from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt, get_jwt_identity,
    verify_jwt_in_request
)
from sqlalchemy import func, text
from pathlib import Path
import csv, io, json, random, statistics, time, math, os
from datetime import datetime, timedelta, timezone
from collections import defaultdict

# ---------------------------------------------------------------------
# App & Config
# ---------------------------------------------------------------------
app = Flask(__name__)

# Garante a pasta instance/ e usa SEMPRE o mesmo arquivo de banco ali dentro
Path(app.instance_path).mkdir(parents=True, exist_ok=True)
db_path = os.path.join(app.instance_path, "inovatech.db")
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = "troque-esta-chave-em-producao"  # troque em produção

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)
CORS(app)

# ---- Regras para criar/editar ADMIN ----
ALLOWED_ADMIN_DOMAINS = {"cannoli.com.br", "inovatech.com.br"}
ALLOWED_ADMIN_CODES   = {"CANNOLI", "INOVATECH"}

def _email_domain(email: str) -> str:
    try:
        return email.split("@", 1)[1].lower()
    except Exception:
        return ""

def _is_valid_admin(email: str, admin_code: str) -> bool:
        domain_ok = _email_domain(email) in ALLOWED_ADMIN_DOMAINS
        code_ok   = (admin_code or "").strip().upper() in ALLOWED_ADMIN_CODES
        return domain_ok and code_ok

def clean_cnpj(raw: str) -> str:
    return "".join([c for c in (raw or "") if c.isdigit()])

# ---------------------------------------------------------------------
# MODELS
# ---------------------------------------------------------------------
class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(160), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # "admin" | "cliente"
    cnpj = db.Column(db.String(20))
    codigo_cannoli = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def set_password(self, raw: str) -> None:
        self.password_hash = bcrypt.generate_password_hash(raw).decode("utf-8")

    def check_password(self, raw: str) -> bool:
        return bcrypt.check_password_hash(self.password_hash, raw)

def user_to_dict(u: "User"):
    return {
        "id": u.id,
        "nome": u.nome,
        "email": u.email,
        "role": u.role,
        "cnpj": u.cnpj,
        "codigo_cannoli": u.codigo_cannoli,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }

class CnpjRegistry(db.Model):
    __tablename__ = "cnpj_registry"
    id = db.Column(db.Integer, primary_key=True)
    cnpj = db.Column(db.String(20), unique=True, nullable=False, index=True)
    razao_social = db.Column(db.String(160))
    nome_fantasia = db.Column(db.String(160))
    contato_email = db.Column(db.String(160))
    approved = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class Channel(db.Model):
    __tablename__ = "channels"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(60), unique=True, nullable=False)

class Location(db.Model):
    __tablename__ = "locations"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(30), unique=True, nullable=False)

class MenuItem(db.Model):
    __tablename__ = "menu_items"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    price = db.Column(db.Float, nullable=False)

class Order(db.Model):
    __tablename__ = "orders"
    id = db.Column(db.Integer, primary_key=True)
    customer_email = db.Column(db.String(160), nullable=False)
    channel_id = db.Column(db.Integer, db.ForeignKey("channels.id"), nullable=False)
    location_id = db.Column(db.Integer, db.ForeignKey("locations.id"), nullable=False)
    ordered_at = db.Column(db.DateTime, index=True, nullable=False)
    total = db.Column(db.Float, nullable=False)
    owner_cnpj = db.Column(db.String(20), index=True)  # CNPJ dono

    channel = db.relationship("Channel")
    location = db.relationship("Location")
    items = db.relationship("OrderItem", backref="order", cascade="all, delete-orphan")

class OrderItem(db.Model):
    __tablename__ = "order_items"
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id"), index=True, nullable=False)
    item_id = db.Column(db.Integer, db.ForeignKey("menu_items.id"), nullable=False)
    qty = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Float, nullable=False)
    item = db.relationship("MenuItem")

# ---------------------------------------------------------------------
# MIGRAÇÃO SIMPLES (SQLite): garante coluna owner_cnpj em bancos antigos
# ---------------------------------------------------------------------
def ensure_owner_cnpj_column():
    try:
        cols = db.session.execute(text("PRAGMA table_info(orders);")).mappings().all()
        names = {c["name"] for c in cols}
        if "owner_cnpj" not in names:
            db.session.execute(text("ALTER TABLE orders ADD COLUMN owner_cnpj VARCHAR(20);"))
            db.session.commit()
    except Exception as e:
        print("[migrate] aviso ao checar/alterar owner_cnpj:", e)

# ---------------------------------------------------------------------
# SEED LEVE E CONTROLÁVEL
# ---------------------------------------------------------------------
def seed_business_data_if_empty():
    if Order.query.first():
        return

    SEED_DAYS  = int(os.getenv("SEED_DAYS",  "8"))
    SEED_SCALE = float(os.getenv("SEED_SCALE", "0.5"))
    CHUNK      = int(os.getenv("SEED_CHUNK", "4000"))

    channels  = ["Delivery Próprio","iFood","Balcão","WhatsApp"]
    locations = ["SP","RJ","BH","POA"]
    items     = [("Cannoli Clássico",16.0),("Cannoli Pistache",18.0),
                 ("Tiramisu",22.0),("Panna Cotta",19.0),("Espresso",8.0)]

    if not Channel.query.first():
        db.session.add_all([Channel(name=c) for c in channels])
    if not Location.query.first():
        db.session.add_all([Location(name=l) for l in locations])
    if not MenuItem.query.first():
        db.session.add_all([MenuItem(name=n, price=p) for n,p in items])
    db.session.commit()

    chmap = {c.name: c.id for c in Channel.query.all()}
    locmap = {l.name: l.id for l in Location.query.all()}
    itmap  = {i.name: i for i in MenuItem.query.all()}

    client_cnpjs = ["12345678000190", "11111111000191", "22222222000192"]

    try:
        db.session.execute(text("PRAGMA journal_mode=WAL;"))
        db.session.execute(text("PRAGMA synchronous=OFF;"))
    except Exception:
        pass

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    random.seed(42)

    def base_by_hour(h):
        if 11 <= h <= 14: return 6
        if 18 <= h <= 22: return 8
        return 2

    buffer = []
    total_ins = 0

    for d in range(SEED_DAYS):
        day = now - timedelta(days=d)
        for h in range(24):
            base = base_by_hour(h)
            vol = {
                "Delivery Próprio": int((base + random.randint(0,2)) * SEED_SCALE),
                "iFood":            int((base*1.4 + random.randint(0,2)) * SEED_SCALE),
                "Balcão":           int((base*0.6 + random.randint(0,1)) * SEED_SCALE),
                "WhatsApp":         int((base*0.9 + random.randint(0,1)) * SEED_SCALE),
            }
            for loc in locations:
                loc_mult = 1.15 if loc == "SP" else 1.0
                for ch, n in vol.items():
                    n = max(0, int(n * loc_mult))
                    for _ in range(n):
                        ts = day.replace(hour=h)
                        o = Order(
                            customer_email=f"cliente{random.randint(1,120)}@mail.com",
                            channel_id=chmap[ch],
                            location_id=locmap[loc],
                            ordered_at=ts,
                            total=0.0,
                            owner_cnpj=random.choices(client_cnpjs, weights=[5,2,2], k=1)[0]
                        )
                        k = random.randint(1,2)
                        total = 0.0
                        for _ in range(k):
                            item = random.choice(list(itmap.values()))
                            qty = 1
                            total += item.price * qty
                            o.items.append(OrderItem(item_id=item.id, qty=qty, unit_price=item.price))
                        o.total = round(total, 2)
                        buffer.append(o)

                        if len(buffer) >= CHUNK:
                            db.session.add_all(buffer)
                            db.session.commit()
                            total_ins += len(buffer)
                            buffer.clear()

    if buffer:
        db.session.add_all(buffer)
        db.session.commit()
        total_ins += len(buffer)

    try:
        db.session.execute(text("PRAGMA synchronous=NORMAL;"))
    except Exception:
        pass

    print(f"[seed] Pedidos inseridos: {total_ins}")

with app.app_context():
    db.create_all()
    ensure_owner_cnpj_column()

    if not User.query.filter_by(role="admin").first():
        u = User(
            nome="Admin InovaTech",
            email="admin@inovatech.com.br",
            role="admin",
            codigo_cannoli="INOVATECH"
        )
        u.set_password("admin123")
        db.session.add(u); db.session.commit()

    if not CnpjRegistry.query.first():
        db.session.add(CnpjRegistry(
            cnpj="12345678000190",
            razao_social="Demo LTDA",
            nome_fantasia="Cannoli Demo",
            contato_email="contato@demo.com.br",
            approved=True
        ))
        db.session.commit()

    seed_business_data_if_empty()

# ---------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------
def period_to_dt(period: str):
    now = datetime.now(timezone.utc)
    if period == "24h": return now - timedelta(hours=24)
    if period == "7d":  return now - timedelta(days=7)
    return now - timedelta(days=30)

def get_scope_cnpj():
    try:
        verify_jwt_in_request(optional=True)
        claims = get_jwt() or {}
        if claims.get("role") == "cliente":
            return claims.get("cnpj")
    except Exception:
        pass
    return None

def base_orders_query(period, channel, location, force_cnpj=None):
    dt_from = period_to_dt(period)
    q = Order.query.filter(Order.ordered_at >= dt_from)
    if channel:
        ch = Channel.query.filter_by(name=channel).first()
        if ch: q = q.filter(Order.channel_id == ch.id)
    if location:
        loc = Location.query.filter_by(name=location).first()
        if loc: q = q.filter(Order.location_id == loc.id)

    scope = force_cnpj or get_scope_cnpj()
    if scope:
        q = q.filter(Order.owner_cnpj == scope)

    return q

def compute_kpis_from_query(q):
    pedidos = q.count()
    total_receita = (db.session.query(func.coalesce(func.sum(Order.total), 0.0))
                     .select_from(q.subquery()).scalar())
    ticket = round((total_receita / pedidos), 2) if pedidos else 0.0
    conversoes = int(pedidos * 0.4)

    now = datetime.now(timezone.utc)
    d30 = now - timedelta(days=30)
    d7  = now - timedelta(days=7)

    cli_30 = set(e[0] for e in db.session.query(Order.customer_email)
                 .filter(Order.ordered_at >= d30)
                 .group_by(Order.customer_email).all())

    cli_7  = set(e[0] for e in db.session.query(Order.customer_email)
                 .filter(Order.ordered_at >= d7)
                 .group_by(Order.customer_email).all())

    churn = round((len(cli_30 - cli_7) / len(cli_30), 3)) if cli_30 else 0.0
    clientes_ativos = len(cli_7)
    clientes_inativos = len(cli_30 - cli_7)

    return {
        "conversoes": conversoes,
        "ticketMedio": ticket,
        "pedidos": pedidos,
        "churn": churn,
        "totalVendas": round(float(total_receita or 0.0), 2),
        "clientesAtivos": int(clientes_ativos),
        "clientesInativos": int(clientes_inativos),
    }

def zscore_anomaly(values):
    if len(values) < 6: return False
    mean = statistics.mean(values)
    stdev = statistics.pstdev(values) or 1
    return abs(values[-1] - mean) / stdev >= 2.2

# ---------------------------------------------------------------------
# AUTH
# ---------------------------------------------------------------------
@app.post("/auth/signup")
def signup():
    data  = request.get_json() or {}
    role  = (data.get("role") or "").lower()
    nome  = (data.get("nome") or "").strip()
    email = (data.get("email") or "").strip().lower()
    senha = data.get("senha")

    if role not in ("admin","cliente"):
        return jsonify({"error":"role inválido"}), 400
    if not nome or not email or not senha:
        return jsonify({"error":"dados obrigatórios"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error":"email já cadastrado"}), 409

    if role == "cliente":
        cnpj = clean_cnpj(data.get("cnpj"))
        if not cnpj:
            return jsonify({"error":"CNPJ obrigatório"}), 400
        reg = CnpjRegistry.query.filter_by(cnpj=cnpj).first()
        if not reg:
            return jsonify({"error":"CNPJ não cadastrado. Solicite inclusão antes de criar conta."}), 403
        if not reg.approved:
            return jsonify({"error":"CNPJ pendente de aprovação pelo administrador."}), 403

        u = User(nome=nome, email=email, role=role, cnpj=cnpj)
        u.set_password(senha)
        db.session.add(u); db.session.commit()
        return jsonify({"ok": True})

    admin_code = (data.get("adminCode") or
                  data.get("codigoAdmin") or
                  data.get("codigoCannoli") or "")
    if not _is_valid_admin(email, admin_code):
        return jsonify({
            "error": "Para ADMIN: e-mail deve ser @cannoli.com.br ou @inovatech.com.br "
                     "e o código deve ser CANNOLI ou INOVATECH."
        }), 400

    u = User(nome=nome, email=email, role=role, codigo_cannoli=admin_code)
    u.set_password(senha)
    db.session.add(u); db.session.commit()
    return jsonify({"ok": True})

@app.post("/auth/login")
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    senha = data.get("password") or data.get("senha")
    u = User.query.filter_by(email=email).first()
    if not u or not u.check_password(senha):
        return jsonify({"error":"credenciais inválidas"}), 401

    claims = {"role": u.role, "name": u.nome, "cnpj": u.cnpj}
    token = create_access_token(identity=str(u.id),
                                additional_claims=claims,
                                expires_delta=timedelta(hours=8))
    return jsonify({"token": token, "role": u.role, "name": u.nome, "cnpj": u.cnpj})

def admin_required(fn):
    from functools import wraps
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        if get_jwt().get("role") != "admin":
            return jsonify({"error":"apenas admin"}), 403
        return fn(*args, **kwargs)
    return wrapper

@app.post("/auth/reset-basic")
def auth_reset_basic():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    nova  = (data.get("password") or data.get("senha") or "").strip()

    if not email or not nova:
        return jsonify({"error": "email e senha são obrigatórios"}), 400
    if len(nova) < 6:
        return jsonify({"error": "senha muito curta (mín. 6)"}), 400

    u = User.query.filter_by(email=email).first()
    if not u:
        return jsonify({"error": "usuário não encontrado"}), 404

    u.set_password(nova)
    db.session.commit()
    return jsonify({"ok": True, "msg": "senha atualizada"})

# ----------------- CNPJ Registry -----------------
@app.post("/cnpj/request")
def cnpj_request():
    data = request.get_json() or {}
    cnpj = clean_cnpj(data.get("cnpj"))
    if not cnpj or len(cnpj) < 14:
        return jsonify({"error":"CNPJ inválido"}), 400

    reg = CnpjRegistry.query.filter_by(cnpj=cnpj).first()
    if reg:
        return jsonify({
            "ok": True,
            "status": "aprovado" if reg.approved else "pendente",
            "cnpj": reg.cnpj
        })

    reg = CnpjRegistry(
        cnpj=cnpj,
        razao_social=data.get("razao_social"),
        nome_fantasia=data.get("nome_fantasia"),
        contato_email=(data.get("contato_email") or "").strip().lower(),
        approved=False
    )
    db.session.add(reg); db.session.commit()
    return jsonify({"ok": True, "status": "pendente", "cnpj": reg.cnpj})

@app.get("/cnpj")
@admin_required
def cnpj_list():
    q = (request.args.get("q") or "").strip()
    query = CnpjRegistry.query
    if q:
        like = f"%{q}%"
        query = query.filter(
            (CnpjRegistry.cnpj.ilike(like)) |
            (CnpjRegistry.razao_social.ilike(like)) |
            (CnpjRegistry.nome_fantasia.ilike(like))
        )
    rows = query.order_by(CnpjRegistry.created_at.desc()).all()
    return jsonify([{
        "id": r.id,
        "cnpj": r.cnpj,
        "razao_social": r.razao_social,
        "nome_fantasia": r.nome_fantasia,
        "contato_email": r.contato_email,
        "approved": r.approved,
        "created_at": r.created_at.isoformat()
    } for r in rows])

@app.put("/cnpj/<int:cid>/approve")
@admin_required
def cnpj_approve(cid):
    reg = CnpjRegistry.query.get_or_404(cid)
    data = request.get_json() or {}
    reg.approved = bool(data.get("approved", True))
    db.session.commit()
    return jsonify({"ok": True, "approved": reg.approved})

# --------- CRUD Usuários (admin) ----------
@app.get("/users")
@admin_required
def users_list():
    q = (request.args.get("q") or "").strip().lower()
    query = User.query
    if q:
        like = f"%{q}%"
        query = query.filter(
            (User.nome.ilike(like)) |
            (User.email.ilike(like)) |
            (User.role.ilike(like))
        )
    users = query.order_by(User.created_at.desc()).all()
    return jsonify([user_to_dict(u) for u in users])

@app.post("/users")
@admin_required
def users_create():
    data  = request.get_json() or {}
    nome  = (data.get("nome") or "").strip()
    email = (data.get("email") or "").strip().lower()
    role  = (data.get("role") or "").lower()
    senha = data.get("senha") or data.get("password")
    cnpj  = clean_cnpj(data.get("cnpj"))
    admin_code = (data.get("adminCode") or data.get("codigoAdmin") or
                  data.get("codigoCannoli") or "")

    if role not in ("admin","cliente"): return jsonify({"error":"role inválido"}), 400
    if not nome or not email or not senha: return jsonify({"error":"nome, email e senha são obrigatórios"}), 400
    if User.query.filter_by(email=email).first(): return jsonify({"error":"email já cadastrado"}), 409

    if role=="cliente":
        if not cnpj: return jsonify({"error":"CNPJ obrigatório para cliente"}), 400
        reg = CnpjRegistry.query.filter_by(cnpj=cnpj).first()
        if not reg or not reg.approved:
            return jsonify({"error":"CNPJ não autorizado (apenas CNPJs aprovados podem ser vinculados)."}), 403

    if role=="admin" and not _is_valid_admin(email, admin_code):
        return jsonify({
            "error":"Para ADMIN: e-mail deve ser @cannoli.com.br ou @inovatech.com.br "
                    "e o código deve ser CANNOLI ou INOVATECH."
        }), 400

    u = User(nome=nome, email=email, role=role,
             cnpj=(cnpj or None), codigo_cannoli=(admin_code or None))
    u.set_password(senha)
    db.session.add(u); db.session.commit()
    return jsonify(user_to_dict(u)), 201

@app.get("/users/<int:uid>")
@admin_required
def users_get(uid):
    u = User.query.get_or_404(uid)
    return jsonify(user_to_dict(u))

@app.put("/users/<int:uid>")
@admin_required
def users_update(uid):
    u = User.query.get_or_404(uid)
    data  = request.get_json() or {}

    nome   = (data.get("nome")  or u.nome).strip()
    email  = (data.get("email") or u.email).strip().lower()
    role   = (data.get("role")  or u.role).lower()
    cnpj   = clean_cnpj(data.get("cnpj")) if "cnpj" in data else u.cnpj
    admin_code = (data.get("adminCode") or data.get("codigoAdmin") or
                  data.get("codigoCannoli") or u.codigo_cannoli)
    senha  = data.get("senha") or data.get("password")

    if role not in ("admin","cliente"): return jsonify({"error":"role inválido"}), 400
    if email != u.email and User.query.filter_by(email=email).first():
        return jsonify({"error":"email já cadastrado"}), 409

    if role=="cliente":
        if not cnpj: return jsonify({"error":"CNPJ obrigatório para cliente"}), 400
        reg = CnpjRegistry.query.filter_by(cnpj=cnpj).first()
        if not reg or not reg.approved:
            return jsonify({"error":"CNPJ não autorizado (apenas CNPJs aprovados podem ser vinculados)."}), 403

    if role=="admin" and not _is_valid_admin(email, admin_code):
        return jsonify({
            "error":"Para ADMIN: e-mail deve ser @cannoli.com.br ou @inovatech.com.br "
                    "e o código deve ser CANNOLI ou INOVATECH."
        }), 400

    u.nome, u.email, u.role = nome, email, role
    u.cnpj, u.codigo_cannoli = cnpj, admin_code
    if senha: u.set_password(senha)
    db.session.commit()
    return jsonify(user_to_dict(u))

@app.delete("/users/<int:uid>")
@admin_required
def users_delete(uid):
    current_id = int(get_jwt_identity())
    if uid == current_id:
        return jsonify({"error":"Você não pode excluir a si mesmo."}), 400

    u = User.query.get_or_404(uid)
    if u.role == "admin":
        total_admins = User.query.filter_by(role="admin").count()
        if total_admins <= 1:
            return jsonify({"error":"Não é possível excluir o último admin."}), 400

    db.session.delete(u); db.session.commit()
    return jsonify({"ok": True})

# ---------- Perfil ----------
@app.get("/me")
@jwt_required()
def me_get():
    uid = int(get_jwt_identity())
    u = User.query.get_or_404(uid)
    return jsonify(user_to_dict(u))

@app.put("/me")
@jwt_required()
def me_update():
    uid = int(get_jwt_identity())
    u = User.query.get_or_404(uid)
    data = request.get_json() or {}
    nome = (data.get("nome") or u.nome).strip()
    senha = data.get("senha") or data.get("password")
    u.nome = nome
    if senha:
        u.set_password(senha)
    db.session.commit()
    return jsonify(user_to_dict(u))

# ---------------------------------------------------------------------
# FILTERS / METRICS / PANELS
# ---------------------------------------------------------------------
@app.get("/filters/options")
def filter_options():
    periods = ["24h","7d","30d"]
    channels = [c.name for c in Channel.query.order_by(Channel.name).all()]
    locations = [l.name for l in Location.query.order_by(Location.name).all()]
    return jsonify({"periods": periods, "channels": channels, "locations": locations})

@app.get("/metrics")
@jwt_required(optional=True)
def metrics():
    period  = request.args.get("period","24h")
    channel = request.args.get("channel") or None
    location= request.args.get("location") or None

    q = base_orders_query(period, channel, location)
    kpis = compute_kpis_from_query(q)

    claims = get_jwt() or {}
    if claims.get("role") != "admin":
        kpis.pop("churn", None)

    dt_from = period_to_dt(period)
    rows = (db.session.query(
                func.strftime("%Y-%m-%d %H:00", Order.ordered_at).label("h"),
                func.count(Order.id))
            .filter(Order.ordered_at >= dt_from)
            .filter(Order.id.in_(q.with_entities(Order.id)))
            .group_by("h").order_by("h").all())

    serie = []
    for h_str, c in rows:
        label = h_str
        for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:00"):
            try:
                dt = datetime.strptime(h_str, fmt)
                label = dt.strftime("%H") if period == "24h" else dt.strftime("%d/%m")
                break
            except Exception:
                pass
        serie.append({"hora": label, "pedidos": int(c)})

    return jsonify({"kpis": kpis, "serie": serie})

@app.get("/panel/by-channel")
@jwt_required(optional=True)
def panel_by_channel():
    period  = request.args.get("period","24h")
    location= request.args.get("location") or None
    q = base_orders_query(period, None, location)

    rows = (db.session.query(Channel.name, func.coalesce(func.sum(Order.total), 0.0))
            .join(Channel, Channel.id == Order.channel_id)
            .filter(Order.id.in_(q.with_entities(Order.id)))
            .group_by(Channel.name).order_by(Channel.name).all())
    return jsonify({name: float(total) for name, total in rows})

@app.get("/panel/top-items")
@jwt_required(optional=True)
def panel_top_items():
    period  = request.args.get("period","24h")
    channel = request.args.get("channel") or None
    location= request.args.get("location") or None
    q = base_orders_query(period, channel, location)
    sub = q.with_entities(Order.id).subquery()
    rows = (db.session.query(MenuItem.name,
                             func.coalesce(func.sum(OrderItem.qty),0).label("qtd"),
                             func.coalesce(func.sum(OrderItem.qty * OrderItem.unit_price),0.0).label("revenue"))
            .join(OrderItem, OrderItem.item_id == MenuItem.id)
            .filter(OrderItem.order_id.in_(sub))
            .group_by(MenuItem.name)
            .order_by(func.sum(OrderItem.qty * OrderItem.unit_price).desc())
            .limit(10).all())
    out = [{"item": n, "qtd": int(qtd), "revenue": float(rev)} for n,qtd,rev in rows]
    return jsonify(out)

@app.get("/suggestions")
@jwt_required(optional=True)
def suggestions():
    s = []
    rows = (db.session.query(Channel.name, func.count(Order.id))
            .join(Channel, Channel.id == Order.channel_id)
            .filter(Order.ordered_at >= period_to_dt("7d"))
            .group_by(Channel.name)).all()
    byc = {n: int(c) for n, c in rows}

    if byc.get("Delivery Próprio", 0) < int(byc.get("iFood", 0) * 0.7):
        s.append("Invista em campanhas no Delivery Próprio para reduzir dependência do iFood.")

    s.append("Teste combos de sobremesa + bebida para elevar o ticket médio.")
    if not s:
        s.append("Mantenha o plano atual: métricas dentro do esperado.")
    return jsonify(s)

# ---------------------------------------------------------------------
# INSIGHTS (anomalia + RFM/propensão) - ADMIN
# ---------------------------------------------------------------------
@app.get("/insights/health")
@admin_required
def insights_health():
    dt_from = datetime.now(timezone.utc) - timedelta(days=7)
    rows = (db.session.query(
                func.strftime("%Y-%m-%d %H:00", Order.ordered_at).label("h"),
                func.coalesce(func.sum(Order.total), 0.0)
            )
            .filter(Order.ordered_at >= dt_from)
            .group_by("h").order_by("h").all())

    xs = [r[0] for r in rows]
    ys = [float(r[1] or 0.0) for r in rows]

    alpha = 0.3
    mu, s2 = [], []
    m, v = 0.0, 0.0
    for i, y in enumerate(ys):
        m = alpha*y + (1-alpha)*(m if i else y)
        v = alpha*((y-m)**2) + (1-alpha)*(v if i else 0.0)
        mu.append(m); s2.append(v)

    z_last = 0.0
    if ys:
        sd = math.sqrt(s2[-1]) if s2[-1] > 0 else 1.0
        z_last = abs(ys[-1] - mu[-1]) / sd if sd else 0.0

    severity = "normal"
    if z_last >= 3: severity = "alto"
    elif z_last >= 2: severity = "médio"

    now = datetime.now(timezone.utc)
    d30 = now - timedelta(days=30)
    q = (db.session.query(Order.customer_email, Order.total, Order.ordered_at)
         .filter(Order.ordered_at >= d30)).all()

    F = defaultdict(int)
    M = defaultdict(float)
    R = {}
    for email, tot, ts in q:
        F[email] += 1
        M[email] += float(tot or 0.0)
        days = max(0, (now - ts).days)
        R[email] = min(R.get(email, 99999), days)

    def norm(d):
        if not d: return {}
        lo, hi = min(d.values()), max(d.values())
        rng = (hi - lo) or 1
        return {k: (v - lo)/rng for k, v in d.items()}

    Fn = norm(F); Mn = norm(M)
    Rin = {}
    if R:
        lo, hi = min(R.values()), max(R.values())
        rng = (hi - lo) or 1
        for k, v in R.items():
            Rin[k] = 1 - ((v - lo)/rng)

    score = {k: 0.4*Fn.get(k,0) + 0.4*Mn.get(k,0) + 0.2*Rin.get(k,0)
             for k in set(F) | set(M) | set(R)}
    top = sorted(score.items(), key=lambda kv: kv[1], reverse=True)[:10]
    rfm_top = [{"customer": k, "score": round(v, 3)} for k, v in top]

    return jsonify({
        "anomaly": {
            "last_hour": xs[-1] if xs else None,
            "zscore": round(z_last, 2),
            "severity": severity
        },
        "rfm_top": rfm_top
    })

# ---------------------------------------------------------------------
# Série empilhada por canal
# ---------------------------------------------------------------------
@app.get("/series/by-channel")
@jwt_required(optional=True)
def series_by_channel():
    period  = request.args.get("period","24h")
    location= request.args.get("location") or None
    cnpj_q  = request.args.get("cnpj") or None

    q = base_orders_query(period, None, location, force_cnpj=cnpj_q)

    dt_from = period_to_dt(period)
    rows = (db.session.query(
                func.strftime("%Y-%m-%d %H:00", Order.ordered_at).label("h"),
                Channel.name,
                func.count(Order.id)
            )
            .join(Channel, Channel.id == Order.channel_id)
            .filter(Order.ordered_at >= dt_from)
            .filter(Order.id.in_(q.with_entities(Order.id)))
            .group_by("h", Channel.name)
            .order_by("h")
            .all())

    data = {}
    for h, ch, cnt in rows:
        data.setdefault(h, {})[ch] = int(cnt)

    labels = sorted(data.keys())
    channels = [c.name for c in Channel.query.order_by(Channel.name).all()]
    series = {ch: [data.get(h, {}).get(ch, 0) for h in labels] for ch in channels}
    return jsonify({"labels": labels, "series": series, "channels": channels})

# ---------------------------------------------------------------------
# ALERTS + SSE (tempo real simples)
# ---------------------------------------------------------------------
STATE = {"alerta": None, "kpis": {"conversoes":120,"ticketMedio":58.9,"pedidos":340,"churn":0.07}}

@app.get("/alerts")
def alerts():
    out = [STATE["alerta"]] if STATE["alerta"] else []
    STATE["alerta"] = None
    return jsonify(out)

@app.get("/stream/kpis")
def stream_kpis():
    def gen():
        values = [18 + random.randint(-6,6) for _ in range(12)]
        while True:
            STATE["kpis"]["pedidos"] += random.randint(-3, 3)
            STATE["kpis"]["conversoes"] += random.randint(-2, 2)
            STATE["kpis"]["ticketMedio"] = round(58 + (random.random()-0.5)*4, 2)
            novo = max(0, 18 + random.randint(-6,6))
            values.append(novo)
            if zscore_anomaly(values[-12:]) and not STATE["alerta"]:
                STATE["alerta"] = {"tipo":"anomalia","msg":"Variação atípica detectada nos pedidos (última hora)."}
            yield f"data: {json.dumps(STATE['kpis'])}\n\n"
            time.sleep(3)
    return Response(gen(), mimetype="text/event-stream")

# ---------------------------------------------------------------------
# EXPORT & SIMULADOR
# ---------------------------------------------------------------------
@app.get("/export/csv")
def export_csv():
    period  = request.args.get("period","24h")
    channel = request.args.get("channel") or None
    location= request.args.get("location") or None
    q = base_orders_query(period, channel, location)

    output = io.StringIO()
    w = csv.writer(output)
    w.writerow(["order_id","email","canal","loja","data","total"])
    rows = (db.session.query(Order.id, Order.customer_email, Channel.name, Location.name, Order.ordered_at, Order.total)
            .join(Channel, Channel.id==Order.channel_id)
            .join(Location, Location.id==Order.location_id)
            .filter(Order.id.in_(q.with_entities(Order.id)))
            .order_by(Order.ordered_at.desc()).all())
    for r in rows:
        w.writerow([r[0], r[1], r[2], r[3], r[4].isoformat(), r[5]])

    return Response(output.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition":"attachment; filename=pedidos.csv"})

@app.post("/simulate/campaign")
@admin_required
def simulate_campaign():
    data = request.get_json() or {}
    canal = data.get("canal","Delivery Próprio")
    investimento = float(data.get("investimento", 1000))
    dias = int(data.get("duracaoDias", 7))

    rows = (db.session.query(func.count(Order.id))
            .join(Channel, Channel.id==Order.channel_id)
            .filter(Channel.name==canal, Order.ordered_at >= period_to_dt("7d"))).first()
    base_vendas = int(rows[0] or 150)

    coef = 0.12 if canal=="Delivery Próprio" else 0.09
    uplift = int((investimento/1000.0) * coef * dias * 10)
    receita_media = 58.0
    receita = round((base_vendas + uplift) * receita_media, 2)

    return jsonify({
        "canal": canal,
        "uplift_pedidos": uplift,
        "proj_receita": receita,
        "kpi_esperado": {
            "ticketMedio": round(receita_media + (uplift*0.01), 2),
            "conversoes": int((base_vendas + uplift) * 0.4)
        }
    })

# --------- DEV: reseed / seed-more / peek ----------
@app.post("/dev/reseed")
@admin_required
def dev_reseed():
    db.drop_all()
    db.create_all()

    u = User(
        nome="Admin InovaTech",
        email="admin@inovatech.com.br",
        role="admin",
        codigo_cannoli="INOVATECH"
    )
    u.set_password("admin123")
    db.session.add(u)

    db.session.add(CnpjRegistry(
        cnpj="12345678000190",
        razao_social="Demo LTDA",
        nome_fantasia="Cannoli Demo",
        contato_email="contato@demo.com.br",
        approved=True
    ))
    db.session.commit()

    seed_business_data_if_empty()
    return jsonify({"ok": True, "msg": "Banco reseedado"}), 200

@app.post("/dev/seed-more")
@admin_required
def dev_seed_more():
    data = request.get_json() or {}
    extra_days = int(data.get("days", 14))
    cnpjs = data.get("cnpjs") or ["12345678000190","11111111000191","22222222000192"]

    if not Channel.query.first():
        seed_business_data_if_empty()
        return jsonify({"ok": True, "msg": "Seed base criado"}), 200

    chmap = {c.name: c.id for c in Channel.query.all()}
    locmap = {l.name: l.id for l in Location.query.all()}
    itmap = {i.name: i for i in MenuItem.query.all()}

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    random.seed()

    def base_by_hour(h):
        if 11 <= h <= 14: return 9
        if 18 <= h <= 22: return 11
        return 3

    added = 0
    for d in range(extra_days):
        day = now - timedelta(days=d)
        for h in range(24):
            base = base_by_hour(h)
            vol = {
                "Delivery Próprio": base + random.randint(0,3),
                "iFood": int(base*1.6) + random.randint(0,3),
                "Balcão": int(base*0.7) + random.randint(0,2),
                "WhatsApp": int(base*1.1) + random.randint(0,2),
            }
            for loc in ["SP","RJ","BH","POA"]:
                loc_mult = 1.25 if loc=="SP" else 1.0
                for ch, n in vol.items():
                    n = int(n * loc_mult)
                    for _ in range(n):
                        ts = day.replace(hour=h)
                        o = Order(
                            customer_email=f"cliente{random.randint(1,400)}@mail.com",
                            channel_id=chmap[ch],
                            location_id=locmap[loc],
                            ordered_at=ts,
                            total=0.0,
                            owner_cnpj=random.choice(cnpjs)
                        )
                        total = 0.0
                        for _ in range(random.randint(1,3)):
                            item = random.choice(list(itmap.values()))
                            qty = random.randint(1,2)
                            total += item.price * qty
                            o.items.append(OrderItem(item_id=item.id, qty=qty, unit_price=item.price))
                        o.total = round(total, 2)
                        db.session.add(o)
                        added += 1
    db.session.commit()
    return jsonify({"ok": True, "added": added}), 200

@app.get("/dev/peek")
def dev_peek():
    try:
        totals = {
            "users": User.query.count(),
            "orders": Order.query.count(),
            "order_items": OrderItem.query.count(),
            "channels": Channel.query.count(),
            "locations": Location.query.count(),
            "db_path": db_path
        }
        sample = db.session.execute(
            text("SELECT ordered_at,total FROM orders ORDER BY ordered_at DESC LIMIT 3;")
        ).mappings().all()
        return jsonify({"ok": True, "totals": totals, "latest": [dict(r) for r in sample]})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

# ---------------------------------------------------------------------
if __name__ == "__main__":
    print(f"[boot] usando banco: {db_path}")
    app.run(port=5001, debug=True)
