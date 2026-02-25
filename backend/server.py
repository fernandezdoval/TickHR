from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Form
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import secrets
import httpx
import uuid
import base64
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'tickhr_db')]

# Create the main app
app = FastAPI(title="TickHR API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', secrets.token_hex(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

# Emergent Auth URL
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ============== Pydantic Models ==============

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str
    
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    role: str
    picture: Optional[str] = None
    department: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class SessionRequest(BaseModel):
    session_id: str

class ClockRecord(BaseModel):
    record_id: str
    user_id: str
    clock_in: datetime
    clock_out: Optional[datetime] = None
    total_hours: Optional[float] = None
    date: str

class TicketCreate(BaseModel):
    ticket_type: str  # vacation, absence, permission
    start_date: str
    end_date: str
    reason: str
    
class TicketResponse(BaseModel):
    ticket_id: str
    user_id: str
    user_name: str
    ticket_type: str
    start_date: str
    end_date: str
    reason: str
    status: str  # pending, approved, rejected
    created_at: datetime
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None

class ExpenseCreate(BaseModel):
    description: str
    amount: float
    category: str
    date: str

class ExpenseResponse(BaseModel):
    expense_id: str
    user_id: str
    user_name: str
    description: str
    amount: float
    category: str
    date: str
    receipt_data: Optional[str] = None
    status: str  # pending, approved, rejected
    created_at: datetime
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None

class ApprovalAction(BaseModel):
    action: str  # approve, reject
    reason: Optional[str] = None


# ============== Auth Helpers ==============

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

async def get_current_user(request: Request) -> Optional[dict]:
    """Get current user from session token or JWT"""
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        return None
    
    # Try JWT verification first
    payload = verify_token(session_token)
    if payload:
        user_id = payload.get("sub")
        if user_id:
            user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
            return user_doc
    
    # Try session-based auth
    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session_doc:
        return None
    
    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    return user_doc

async def require_auth(request: Request) -> dict:
    """Dependency that requires authentication"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

async def require_admin(request: Request) -> dict:
    """Dependency that requires admin role"""
    user = await require_auth(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ============== Auth Endpoints ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister, response: Response):
    """Register a new user with email/password"""
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    hashed_pw = hash_password(user_data.password)
    
    # First user becomes admin
    user_count = await db.users.count_documents({})
    role = "admin" if user_count == 0 else "employee"
    
    user_doc = {
        "user_id": user_id,
        "email": user_data.email,
        "full_name": user_data.full_name,
        "password": hashed_pw,
        "role": role,
        "department": "General",
        "picture": None,
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(user_doc)
    
    access_token = create_access_token(data={"sub": user_id})
    
    response.set_cookie(
        key="session_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=ACCESS_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    )
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            user_id=user_id,
            email=user_data.email,
            full_name=user_data.full_name,
            role=role
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin, response: Response):
    """Login with email/password"""
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    
    if not user_doc or not verify_password(credentials.password, user_doc.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": user_doc["user_id"]})
    
    response.set_cookie(
        key="session_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=ACCESS_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    )
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            user_id=user_doc["user_id"],
            email=user_doc["email"],
            full_name=user_doc["full_name"],
            role=user_doc.get("role", "employee"),
            picture=user_doc.get("picture"),
            department=user_doc.get("department")
        )
    )

@api_router.post("/auth/session", response_model=TokenResponse)
async def create_session_from_google(request: SessionRequest, response: Response):
    """Exchange Google OAuth session_id for app session (Emergent Auth)"""
    try:
        async with httpx.AsyncClient() as http_client:
            auth_response = await http_client.get(
                EMERGENT_AUTH_URL,
                headers={"X-Session-ID": request.session_id},
                timeout=10.0
            )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        
        auth_data = auth_response.json()
        email = auth_data.get("email")
        name = auth_data.get("name", email.split("@")[0] if email else "User")
        picture = auth_data.get("picture")
        
        if not email:
            raise HTTPException(status_code=400, detail="No email in auth response")
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if existing_user:
            user_id = existing_user["user_id"]
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"name": name, "picture": picture}}
            )
            role = existing_user.get("role", "employee")
            full_name = existing_user.get("full_name", name)
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            user_count = await db.users.count_documents({})
            role = "admin" if user_count == 0 else "employee"
            full_name = name
            
            await db.users.insert_one({
                "user_id": user_id,
                "email": email,
                "full_name": full_name,
                "picture": picture,
                "role": role,
                "department": "General",
                "created_at": datetime.now(timezone.utc)
            })
        
        # Create session
        session_token = secrets.token_hex(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
        
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc)
        })
        
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=ACCESS_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
        )
        
        return TokenResponse(
            access_token=session_token,
            user=UserResponse(
                user_id=user_id,
                email=email,
                full_name=full_name,
                role=role,
                picture=picture
            )
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Session creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return UserResponse(
        user_id=user["user_id"],
        email=user["email"],
        full_name=user["full_name"],
        role=user.get("role", "employee"),
        picture=user.get("picture"),
        department=user.get("department")
    )

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout - delete session and clear cookie"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/", secure=True, samesite="none")
    return {"ok": True, "message": "Logged out"}


# ============== Clock In/Out Endpoints ==============

@api_router.post("/clock/in")
async def clock_in(request: Request):
    """Clock in for the day"""
    user = await require_auth(request)
    user_id = user["user_id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Check if already clocked in today
    existing = await db.clock_records.find_one(
        {"user_id": user_id, "date": today, "clock_out": None},
        {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already clocked in")
    
    record_id = f"clock_{uuid.uuid4().hex[:12]}"
    record = {
        "record_id": record_id,
        "user_id": user_id,
        "clock_in": datetime.now(timezone.utc),
        "clock_out": None,
        "total_hours": None,
        "date": today
    }
    await db.clock_records.insert_one(record)
    
    return {"ok": True, "record_id": record_id, "clock_in": record["clock_in"].isoformat()}

@api_router.post("/clock/out")
async def clock_out(request: Request):
    """Clock out for the day"""
    user = await require_auth(request)
    user_id = user["user_id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    record = await db.clock_records.find_one(
        {"user_id": user_id, "date": today, "clock_out": None},
        {"_id": 0}
    )
    if not record:
        raise HTTPException(status_code=400, detail="Not clocked in")
    
    clock_out_time = datetime.now(timezone.utc)
    clock_in_time = record["clock_in"]
    if isinstance(clock_in_time, str):
        clock_in_time = datetime.fromisoformat(clock_in_time)
    
    total_hours = (clock_out_time - clock_in_time).total_seconds() / 3600
    
    await db.clock_records.update_one(
        {"record_id": record["record_id"]},
        {"$set": {"clock_out": clock_out_time, "total_hours": round(total_hours, 2)}}
    )
    
    return {"ok": True, "clock_out": clock_out_time.isoformat(), "total_hours": round(total_hours, 2)}

@api_router.get("/clock/status")
async def get_clock_status(request: Request):
    """Get current clock status for today"""
    user = await require_auth(request)
    user_id = user["user_id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    record = await db.clock_records.find_one(
        {"user_id": user_id, "date": today},
        {"_id": 0}
    )
    
    if not record:
        return {"clocked_in": False, "record": None}
    
    # Convert datetime objects to ISO strings
    if record.get("clock_in"):
        record["clock_in"] = record["clock_in"].isoformat() if isinstance(record["clock_in"], datetime) else record["clock_in"]
    if record.get("clock_out"):
        record["clock_out"] = record["clock_out"].isoformat() if isinstance(record["clock_out"], datetime) else record["clock_out"]
    
    return {"clocked_in": record["clock_out"] is None, "record": record}

@api_router.get("/clock/history")
async def get_clock_history(request: Request, limit: int = 30):
    """Get clock history for current user"""
    user = await require_auth(request)
    user_id = user["user_id"]
    
    records = await db.clock_records.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("date", -1).limit(limit).to_list(limit)
    
    # Convert datetime objects
    for r in records:
        if r.get("clock_in") and isinstance(r["clock_in"], datetime):
            r["clock_in"] = r["clock_in"].isoformat()
        if r.get("clock_out") and isinstance(r["clock_out"], datetime):
            r["clock_out"] = r["clock_out"].isoformat()
    
    return records


# ============== Ticket Endpoints ==============

@api_router.post("/tickets")
async def create_ticket(ticket_data: TicketCreate, request: Request):
    """Create a new ticket (vacation, absence, permission)"""
    user = await require_auth(request)
    
    ticket_id = f"ticket_{uuid.uuid4().hex[:12]}"
    ticket = {
        "ticket_id": ticket_id,
        "user_id": user["user_id"],
        "user_name": user["full_name"],
        "ticket_type": ticket_data.ticket_type,
        "start_date": ticket_data.start_date,
        "end_date": ticket_data.end_date,
        "reason": ticket_data.reason,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "reviewed_by": None,
        "reviewed_at": None
    }
    await db.tickets.insert_one(ticket)
    
    ticket["created_at"] = ticket["created_at"].isoformat()
    if "_id" in ticket:
        del ticket["_id"]
    return ticket

@api_router.get("/tickets")
async def get_my_tickets(request: Request):
    """Get tickets for current user"""
    user = await require_auth(request)
    
    tickets = await db.tickets.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    for t in tickets:
        if isinstance(t.get("created_at"), datetime):
            t["created_at"] = t["created_at"].isoformat()
        if isinstance(t.get("reviewed_at"), datetime):
            t["reviewed_at"] = t["reviewed_at"].isoformat()
    
    return tickets

@api_router.get("/admin/tickets")
async def get_all_tickets(request: Request, status: Optional[str] = None):
    """Get all tickets (admin only)"""
    await require_admin(request)
    
    query = {}
    if status:
        query["status"] = status
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    for t in tickets:
        if isinstance(t.get("created_at"), datetime):
            t["created_at"] = t["created_at"].isoformat()
        if isinstance(t.get("reviewed_at"), datetime):
            t["reviewed_at"] = t["reviewed_at"].isoformat()
    
    return tickets

@api_router.put("/admin/tickets/{ticket_id}")
async def review_ticket(ticket_id: str, action: ApprovalAction, request: Request):
    """Approve or reject a ticket (admin only)"""
    admin = await require_admin(request)
    
    ticket = await db.tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if ticket["status"] != "pending":
        raise HTTPException(status_code=400, detail="Ticket already reviewed")
    
    new_status = "approved" if action.action == "approve" else "rejected"
    
    await db.tickets.update_one(
        {"ticket_id": ticket_id},
        {"$set": {
            "status": new_status,
            "reviewed_by": admin["full_name"],
            "reviewed_at": datetime.now(timezone.utc),
            "rejection_reason": action.reason if action.action == "reject" else None
        }}
    )
    
    return {"ok": True, "status": new_status}


# ============== Expense Endpoints ==============

@api_router.post("/expenses")
async def create_expense(
    request: Request,
    description: str = Form(...),
    amount: float = Form(...),
    category: str = Form(...),
    date: str = Form(...),
    receipt: Optional[UploadFile] = File(None)
):
    """Create a new expense with optional receipt"""
    user = await require_auth(request)
    
    receipt_data = None
    if receipt:
        content = await receipt.read()
        receipt_data = base64.b64encode(content).decode('utf-8')
    
    expense_id = f"exp_{uuid.uuid4().hex[:12]}"
    expense = {
        "expense_id": expense_id,
        "user_id": user["user_id"],
        "user_name": user["full_name"],
        "description": description,
        "amount": amount,
        "category": category,
        "date": date,
        "receipt_data": receipt_data,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "reviewed_by": None,
        "reviewed_at": None,
        "rejection_reason": None
    }
    await db.expenses.insert_one(expense)
    
    # Return without receipt data (too large)
    return {
        "expense_id": expense_id,
        "description": description,
        "amount": amount,
        "category": category,
        "date": date,
        "status": "pending",
        "has_receipt": receipt_data is not None
    }

@api_router.get("/expenses")
async def get_my_expenses(request: Request):
    """Get expenses for current user"""
    user = await require_auth(request)
    
    expenses = await db.expenses.find(
        {"user_id": user["user_id"]},
        {"_id": 0, "receipt_data": 0}  # Exclude large receipt data
    ).sort("created_at", -1).to_list(100)
    
    for e in expenses:
        if isinstance(e.get("created_at"), datetime):
            e["created_at"] = e["created_at"].isoformat()
        if isinstance(e.get("reviewed_at"), datetime):
            e["reviewed_at"] = e["reviewed_at"].isoformat()
    
    return expenses

@api_router.get("/expenses/{expense_id}/receipt")
async def get_expense_receipt(expense_id: str, request: Request):
    """Get receipt image for an expense"""
    user = await require_auth(request)
    
    expense = await db.expenses.find_one(
        {"expense_id": expense_id},
        {"_id": 0}
    )
    
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # Allow access if user is owner or admin
    if expense["user_id"] != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not expense.get("receipt_data"):
        raise HTTPException(status_code=404, detail="No receipt attached")
    
    return {"receipt_data": expense["receipt_data"]}

@api_router.get("/admin/expenses")
async def get_all_expenses(request: Request, status: Optional[str] = None):
    """Get all expenses (admin only)"""
    await require_admin(request)
    
    query = {}
    if status:
        query["status"] = status
    
    expenses = await db.expenses.find(
        query,
        {"_id": 0, "receipt_data": 0}
    ).sort("created_at", -1).to_list(200)
    
    for e in expenses:
        if isinstance(e.get("created_at"), datetime):
            e["created_at"] = e["created_at"].isoformat()
        if isinstance(e.get("reviewed_at"), datetime):
            e["reviewed_at"] = e["reviewed_at"].isoformat()
    
    return expenses

@api_router.put("/admin/expenses/{expense_id}")
async def review_expense(expense_id: str, action: ApprovalAction, request: Request):
    """Approve or reject an expense (admin only)"""
    admin = await require_admin(request)
    
    expense = await db.expenses.find_one({"expense_id": expense_id})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    if expense["status"] != "pending":
        raise HTTPException(status_code=400, detail="Expense already reviewed")
    
    new_status = "approved" if action.action == "approve" else "rejected"
    
    await db.expenses.update_one(
        {"expense_id": expense_id},
        {"$set": {
            "status": new_status,
            "reviewed_by": admin["full_name"],
            "reviewed_at": datetime.now(timezone.utc),
            "rejection_reason": action.reason if action.action == "reject" else None
        }}
    )
    
    return {"ok": True, "status": new_status}


# ============== Dashboard/Stats Endpoints ==============

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(request: Request):
    """Get dashboard statistics for current user"""
    user = await require_auth(request)
    user_id = user["user_id"]
    is_admin = user.get("role") == "admin"
    
    # Get user's stats
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    this_month = datetime.now(timezone.utc).strftime("%Y-%m")
    
    # Clock stats
    month_records = await db.clock_records.find(
        {"user_id": user_id, "date": {"$regex": f"^{this_month}"}},
        {"_id": 0}
    ).to_list(100)
    total_hours = sum(r.get("total_hours", 0) or 0 for r in month_records)
    
    # Today's status
    today_record = await db.clock_records.find_one(
        {"user_id": user_id, "date": today},
        {"_id": 0}
    )
    
    # Pending tickets
    pending_tickets = await db.tickets.count_documents({"user_id": user_id, "status": "pending"})
    
    # Pending expenses
    pending_expenses = await db.expenses.count_documents({"user_id": user_id, "status": "pending"})
    
    # Total approved expenses this month
    approved_expenses = await db.expenses.find(
        {"user_id": user_id, "status": "approved", "date": {"$regex": f"^{this_month}"}},
        {"_id": 0}
    ).to_list(100)
    total_expenses = sum(e.get("amount", 0) for e in approved_expenses)
    
    stats = {
        "hours_this_month": round(total_hours, 1),
        "days_worked": len([r for r in month_records if r.get("total_hours")]),
        "pending_tickets": pending_tickets,
        "pending_expenses": pending_expenses,
        "total_expenses_month": round(total_expenses, 2),
        "clocked_in_today": today_record and today_record.get("clock_out") is None
    }
    
    # Admin stats
    if is_admin:
        stats["admin_pending_tickets"] = await db.tickets.count_documents({"status": "pending"})
        stats["admin_pending_expenses"] = await db.expenses.count_documents({"status": "pending"})
        stats["total_employees"] = await db.users.count_documents({})
    
    return stats

@api_router.get("/admin/users")
async def get_all_users(request: Request):
    """Get all users (admin only)"""
    await require_admin(request)
    
    users = await db.users.find(
        {},
        {"_id": 0, "password": 0}
    ).to_list(200)
    
    for u in users:
        if isinstance(u.get("created_at"), datetime):
            u["created_at"] = u["created_at"].isoformat()
    
    return users

@api_router.put("/admin/users/{user_id}/role")
async def update_user_role(user_id: str, request: Request, role: str = "employee"):
    """Update user role (admin only)"""
    admin = await require_admin(request)
    
    if role not in ["admin", "employee"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"role": role}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"ok": True, "user_id": user_id, "role": role}


# ============== Health Check ==============

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "TickHR API"}


# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Create indexes on startup"""
    logger.info("TickHR API starting up...")
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token")
    await db.clock_records.create_index([("user_id", 1), ("date", 1)])
    await db.tickets.create_index([("user_id", 1), ("status", 1)])
    await db.expenses.create_index([("user_id", 1), ("status", 1)])
    logger.info("Database indexes created")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("TickHR API shutting down...")
    client.close()
