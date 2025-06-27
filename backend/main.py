#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pay System v4.0 - Enterprise Settlement Backend
완전체 백엔드 서버 - Railway 배포 최적화
"""

import os
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import secrets
import hashlib

from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, EmailStr
import uvicorn

# Database
import sqlite3
from contextlib import contextmanager
import json

# JWT
import jwt
from datetime import timedelta

# SMS Parser
import re

# WebSocket Manager
from typing import Dict, List

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 환경 변수
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./settlement.db")
JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret-key-change-in-production")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,https://your-frontend.vercel.app").split(",")

# FastAPI 앱 초기화
app = FastAPI(
    title="Pay System v4.0 API",
    description="완전체 실시간 정산 시스템 API",
    version="4.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic 모델들
class SMSWebhookData(BaseModel):
    """문자자동전달앱에서 오는 데이터 모델 (공식 규격)"""
    date: str
    from_: str = None  # 'from'은 예약어라 from_으로 받음
    to: str = None
    message: str
    
    class Config:
        fields = {'from_': 'from'}

class CompanyCreate(BaseModel):
    company_name: str
    login_id: str
    password: str
    bank_name: str
    account_number: str
    account_holder: str
    fee_rate: float = 0.03

class LoginRequest(BaseModel):
    username: str
    password: str

class TransactionResponse(BaseModel):
    id: int
    transaction_type: str
    bank_name: str
    sender_name: str
    amount: float
    balance: Optional[float]
    fee_amount: float
    created_at: str
    is_rolling: bool = False

# 데이터베이스 초기화
def init_database():
    """데이터베이스 초기화"""
    conn = sqlite3.connect("settlement.db")
    cursor = conn.cursor()
    
    # 업체 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_name TEXT NOT NULL,
            login_id TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            api_key TEXT UNIQUE NOT NULL,
            bank_name TEXT NOT NULL,
            account_number TEXT NOT NULL,
            account_holder TEXT NOT NULL,
            fee_rate REAL DEFAULT 0.03,
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # 거래 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            transaction_type TEXT NOT NULL,
            bank_name TEXT NOT NULL,
            sender_name TEXT,
            account_number TEXT,
            amount DECIMAL(15,2) NOT NULL,
            balance DECIMAL(15,2),
            fee_amount DECIMAL(15,2) DEFAULT 0,
            raw_message TEXT NOT NULL,
            is_rolling BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
    """)
    
    # 관리자 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # 기본 관리자 생성
    admin_password = hashlib.sha256("79797979".encode()).hexdigest()
    cursor.execute("""
        INSERT OR IGNORE INTO admins (username, password_hash) 
        VALUES (?, ?)
    """, ("fjrzl7979", admin_password))
    
    conn.commit()
    conn.close()
    logger.info("데이터베이스 초기화 완료")

# SMS 파싱 엔진
class SMSParser:
    """SMS 메시지 파싱 엔진"""
    
    @staticmethod
    def parse_message(message: str) -> Dict[str, Any]:
        """
        SMS 메시지 파싱
        예시: "[Web발신]\n농협 출금700,000원\n06/27 13:00 302-****-5080-61 신주일 잔액307,006원"
        """
        result = {
            "transaction_type": None,
            "bank_name": None,
            "amount": 0.0,
            "balance": 0.0,
            "sender_name": None,
            "account_number": None,
            "parsed": False
        }
        
        try:
            # 은행명 추출
            bank_patterns = [
                r"농협", r"신한", r"국민", r"우리", r"하나", r"기업",
                r"SC제일", r"씨티", r"대구", r"부산", r"광주", r"전북",
                r"경남", r"새마을", r"신협", r"우체국", r"카카오뱅크", r"토스뱅크"
            ]
            
            for bank in bank_patterns:
                if bank in message:
                    result["bank_name"] = bank
                    break
            
            # 거래 유형 추출
            if "입금" in message:
                result["transaction_type"] = "deposit"
            elif "출금" in message:
                result["transaction_type"] = "withdrawal"
            
            # 금액 추출 (쉼표 포함 숫자)
            amount_match = re.search(r"([입출금]\s*)([\d,]+)원", message)
            if amount_match:
                amount_str = amount_match.group(2).replace(",", "")
                result["amount"] = float(amount_str)
            
            # 잔액 추출
            balance_match = re.search(r"잔액\s*([\d,]+)원", message)
            if balance_match:
                balance_str = balance_match.group(1).replace(",", "")
                result["balance"] = float(balance_str)
            
            # 이름 추출 (계좌번호 다음에 오는 한글/영문)
            name_match = re.search(r"[\d*-]+\s+([가-힣A-Za-z\s]+)\s+잔액", message)
            if name_match:
                result["sender_name"] = name_match.group(1).strip()
            
            # 계좌번호 추출 (일부 마스킹된 형태)
            account_match = re.search(r"(\d{2,3}-[\d*-]+)", message)
            if account_match:
                result["account_number"] = account_match.group(1)
            
            result["parsed"] = True
            
        except Exception as e:
            logger.error(f"SMS 파싱 실패: {e}")
            result["parsed"] = False
        
        return result

# WebSocket 매니저
class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, channel: str):
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = []
        self.active_connections[channel].append(websocket)
    
    def disconnect(self, websocket: WebSocket, channel: str):
        if channel in self.active_connections:
            if websocket in self.active_connections[channel]:
                self.active_connections[channel].remove(websocket)
    
    async def broadcast_to_channel(self, channel: str, message: dict):
        if channel in self.active_connections:
            dead_connections = []
            for connection in self.active_connections[channel]:
                try:
                    await connection.send_json(message)
                except:
                    dead_connections.append(connection)
            
            # 죽은 연결 제거
            for dead_conn in dead_connections:
                self.active_connections[channel].remove(dead_conn)

manager = WebSocketManager()

# 유틸리티 함수들
def hash_password(password: str) -> str:
    """비밀번호 해시"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """비밀번호 검증"""
    return hash_password(password) == hashed

def generate_api_key() -> str:
    """API 키 생성"""
    return secrets.token_urlsafe(32)

def create_jwt_token(data: dict) -> str:
    """JWT 토큰 생성"""
    expire = datetime.utcnow() + timedelta(hours=24)
    data.update({"exp": expire})
    return jwt.encode(data, JWT_SECRET, algorithm="HS256")

@contextmanager
def get_db():
    """데이터베이스 연결"""
    conn = sqlite3.connect("settlement.db")
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

# 인증 의존성
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """현재 사용자 확인"""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="토큰이 만료되었습니다")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")

# API 엔드포인트들

@app.get("/")
async def root():
    """API 상태 확인"""
    return {
        "message": "Pay System v4.0 API Server",
        "version": "4.0.0",
        "status": "running",
        "docs": "/docs"
    }

@app.post("/api/auth/login")
async def login(request: LoginRequest):
    """로그인 (관리자/업체 통합)"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 관리자 확인
        cursor.execute("SELECT * FROM admins WHERE username = ?", (request.username,))
        admin = cursor.fetchone()
        
        if admin and verify_password(request.password, admin["password_hash"]):
            token = create_jwt_token({
                "user_id": admin["id"],
                "username": admin["username"],
                "role": "admin"
            })
            return {
                "access_token": token,
                "token_type": "bearer",
                "role": "admin",
                "redirect": "/admin"
            }
        
        # 업체 확인
        cursor.execute("SELECT * FROM companies WHERE login_id = ?", (request.username,))
        company = cursor.fetchone()
        
        if company and verify_password(request.password, company["password_hash"]):
            token = create_jwt_token({
                "user_id": company["id"],
                "username": company["login_id"],
                "role": "company",
                "company_id": company["id"]
            })
            return {
                "access_token": token,
                "token_type": "bearer",
                "role": "company",
                "redirect": "/company"
            }
        
        raise HTTPException(status_code=401, detail="잘못된 로그인 정보입니다")

@app.post("/api/admin/companies")
async def create_company(company_data: CompanyCreate, current_user: dict = Depends(get_current_user)):
    """업체 생성 (관리자만)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="관리자만 접근 가능합니다")
    
    api_key = generate_api_key()
    password_hash = hash_password(company_data.password)
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO companies (
                    company_name, login_id, password_hash, api_key,
                    bank_name, account_number, account_holder, fee_rate
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                company_data.company_name,
                company_data.login_id,
                password_hash,
                api_key,
                company_data.bank_name,
                company_data.account_number,
                company_data.account_holder,
                company_data.fee_rate
            ))
            
            company_id = cursor.lastrowid
            conn.commit()
            
            # WebSocket으로 관리자에게 알림
            await manager.broadcast_to_channel("admin", {
                "type": "company_created",
                "data": {
                    "id": company_id,
                    "company_name": company_data.company_name,
                    "api_key": api_key
                }
            })
            
            return {
                "id": company_id,
                "company_name": company_data.company_name,
                "login_id": company_data.login_id,
                "api_key": api_key,
                "webhook_url": f"/api/webhook/{api_key}",
                "created_at": datetime.now().isoformat()
            }
            
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=400, detail="이미 존재하는 로그인 ID입니다")

@app.post("/api/webhook/{api_key}")
async def receive_sms(api_key: str, data: SMSWebhookData):
    """
    SMS 웹훅 수신 (문자자동전달앱에서 호출)
    공식 규격: {"date": "...", "from": "...", "to": "...", "message": "..."}
    """
    
    # API 키로 업체 확인
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM companies WHERE api_key = ? AND is_active = 1", (api_key,))
        company = cursor.fetchone()
        
        if not company:
            raise HTTPException(status_code=404, detail="Invalid API key")
        
        # SMS 파싱
        parsed_data = SMSParser.parse_message(data.message)
        
        if not parsed_data["parsed"]:
            logger.warning(f"SMS 파싱 실패: {data.message}")
            return {"status": "failed", "reason": "parsing_failed"}
        
        # 수수료 계산
        fee_amount = parsed_data["amount"] * company["fee_rate"] if parsed_data["transaction_type"] == "deposit" else 0.0
        
        # 롤링 여부 확인 (지정계좌)
        is_rolling = False
        if parsed_data["sender_name"] and company["account_holder"] in parsed_data["sender_name"]:
            is_rolling = True
        
        # 거래 저장
        cursor.execute("""
            INSERT INTO transactions (
                company_id, transaction_type, bank_name, sender_name,
                account_number, amount, balance, fee_amount, raw_message, is_rolling
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            company["id"],
            parsed_data["transaction_type"],
            parsed_data["bank_name"],
            parsed_data["sender_name"],
            parsed_data["account_number"],
            parsed_data["amount"],
            parsed_data["balance"],
            fee_amount,
            data.message,
            is_rolling
        ))
        
        transaction_id = cursor.lastrowid
        conn.commit()
        
        # WebSocket 실시간 알림
        transaction_data = {
            "type": "new_transaction",
            "data": {
                "id": transaction_id,
                "company_id": company["id"],
                "transaction_type": parsed_data["transaction_type"],
                "bank_name": parsed_data["bank_name"],
                "sender_name": parsed_data["sender_name"],
                "amount": parsed_data["amount"],
                "balance": parsed_data["balance"],
                "fee_amount": fee_amount,
                "is_rolling": is_rolling,
                "created_at": datetime.now().isoformat()
            }
        }
        
        # 관리자와 해당 업체에 알림
        await manager.broadcast_to_channel("admin", transaction_data)
        await manager.broadcast_to_channel(f"company_{company['id']}", transaction_data)
        
        return {"status": "success", "transaction_id": transaction_id}

@app.get("/api/webhook/setup-guide/{api_key}")
async def get_setup_guide(api_key: str):
    """SMS 앱 설정 가이드"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT company_name FROM companies WHERE api_key = ?", (api_key,))
        company = cursor.fetchone()
        
        if not company:
            raise HTTPException(status_code=404, detail="Invalid API key")
        
        base_url = "https://your-backend.railway.app"  # 실제 배포 URL로 변경
        
        return {
            "app_name": "문자자동전달",
            "company_name": company["company_name"],
            "webhook_url": f"{base_url}/api/webhook/{api_key}",
            "method": "POST",
            "content_type": "application/json",
            "setup_steps": [
                "1. 문자자동전달 앱 설치 및 실행",
                "2. '전달설정' → '새 설정' 선택",
                "3. '전달 번호' → 'REST API 주소 입력' 선택",
                f"4. URL 입력: {base_url}/api/webhook/{api_key}",
                "5. 필터 설정: '입금', '출금', '농협' 등 키워드 추가",
                "6. 저장 후 테스트 SMS 발송"
            ],
            "expected_format": {
                "date": "2025.06.27 13:00:30",
                "from": "***-****-****",
                "to": "***-****-****",
                "message": "[Web발신]\\n농협 출금700,000원\\n06/27 13:00 302-****-5080-61 신주일 잔액307,006원"
            }
        }

@app.get("/api/admin/dashboard")
async def admin_dashboard(current_user: dict = Depends(get_current_user)):
    """관리자 대시보드 데이터"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="관리자만 접근 가능합니다")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 전체 통계
        cursor.execute("SELECT COUNT(*) as total_companies FROM companies WHERE is_active = 1")
        total_companies = cursor.fetchone()["total_companies"]
        
        cursor.execute("""
            SELECT 
                SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END) as total_deposits,
                SUM(fee_amount) as total_fees,
                COUNT(*) as total_transactions
            FROM transactions 
            WHERE DATE(created_at) = DATE('now', 'localtime')
        """)
        daily_stats = cursor.fetchone()
        
        # 업체별 오늘 통계
        cursor.execute("""
            SELECT 
                c.id, c.company_name, c.login_id, c.fee_rate, c.api_key,
                COALESCE(SUM(CASE WHEN t.transaction_type = 'deposit' THEN t.amount ELSE 0 END), 0) as today_deposits,
                COALESCE(SUM(CASE WHEN t.transaction_type = 'withdrawal' THEN t.amount ELSE 0 END), 0) as today_withdrawals,
                COALESCE(SUM(t.fee_amount), 0) as today_fees,
                COUNT(t.id) as today_transactions
            FROM companies c
            LEFT JOIN transactions t ON c.id = t.company_id 
                AND DATE(t.created_at) = DATE('now', 'localtime')
            WHERE c.is_active = 1
            GROUP BY c.id
            ORDER BY today_deposits DESC
        """)
        companies = cursor.fetchall()
        
        return {
            "summary": {
                "total_companies": total_companies,
                "total_deposits": daily_stats["total_deposits"] or 0,
                "total_fees": daily_stats["total_fees"] or 0,
                "total_transactions": daily_stats["total_transactions"] or 0
            },
            "companies": [dict(company) for company in companies]
        }

@app.get("/api/companies/{company_id}/transactions")
async def get_company_transactions(company_id: int, current_user: dict = Depends(get_current_user)):
    """업체별 거래 내역"""
    # 권한 확인
    if current_user.get("role") == "company" and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="권한이 없습니다")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                id, transaction_type, bank_name, sender_name, account_number,
                amount, balance, fee_amount, is_rolling, created_at
            FROM transactions 
            WHERE company_id = ?
            ORDER BY created_at DESC
            LIMIT 100
        """, (company_id,))
        
        transactions = cursor.fetchall()
        
        return {
            "transactions": [dict(tx) for tx in transactions]
        }

@app.websocket("/ws/admin")
async def websocket_admin(websocket: WebSocket):
    """관리자 WebSocket"""
    await manager.connect(websocket, "admin")
    try:
        while True:
            data = await websocket.receive_text()
            # 연결 유지를 위한 ping-pong
    except WebSocketDisconnect:
        manager.disconnect(websocket, "admin")

@app.websocket("/ws/company/{company_id}")
async def websocket_company(websocket: WebSocket, company_id: int):
    """업체별 WebSocket"""
    await manager.connect(websocket, f"company_{company_id}")
    try:
        while True:
            data = await websocket.receive_text()
            # 연결 유지를 위한 ping-pong
    except WebSocketDisconnect:
        manager.disconnect(websocket, f"company_{company_id}")

# 애플리케이션 시작 시 실행
@app.on_event("startup")
async def startup_event():
    """앱 시작 시 실행"""
    init_database()
    logger.info("🚀 Pay System v4.0 Backend Started!")
    logger.info(f"📖 API 문서: http://localhost:8000/docs")
    logger.info(f"🔗 CORS Origins: {CORS_ORIGINS}")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True
    ) 